-- ============================================================================
-- Migration 082: schema creditos — Pipedrive read model for the Créditos pages
-- ============================================================================
-- Run this by hand in the Supabase SQL editor. This session has no
-- DATABASE_URL and no psql, and it does not apply the file.
--
-- After it commits:
--   1. Project Settings → Data API → Exposed schemas: add creditos.
--      The NOTIFY at the bottom reloads PostgREST. It does not expose the
--      schema by itself.
--   2. From the repo root: python3 scripts/creditos/load.py
--
-- This file does not drop or rewrite public.pai_credito_expediente, schema
-- ventas, schema mercadeo, reservations, or entregas. creditos here is the
-- Pipedrive read model. The operational expediente (migration 073) stays in
-- public and is not a source for these pages.
--
-- Idempotent for a re-run of this same shape: CREATE ... IF NOT EXISTS,
-- CREATE OR REPLACE, ON CONFLICT, DROP POLICY/TRIGGER IF EXISTS.
-- A column change is not a re-run. To rebuild: DROP SCHEMA creditos CASCADE;
-- That drop does not touch public.pai_credito_*.
--
-- Inventory: CREDITOS_PAGES_DATA_INVENTORY_2026-11-02. Six pipelines, 71
-- stages. There is no stage-change history. stage_change_time is only the
-- entry of the current stage. Two custom fields are both named Tipo de
-- Crédito and are not interchangeable. A stage name that contains FHA or CD
-- is not a tipo filter.
--
-- Primary keys are UUID v7, supplied here for dimensions and by the load
-- for facts. No key defaults to gen_random_uuid().
--
-- After changing creditos.activity_signal, refresh stored signals with:
--   UPDATE creditos.fact_activity SET subject = subject;
-- ============================================================================

DO $pre$
BEGIN
  IF to_regprocedure('uuid_v7()') IS NULL THEN
    RAISE EXCEPTION
      'uuid_v7() is not installed. Refusing to create creditos keys with gen_random_uuid().';
  END IF;

  IF to_regprocedure('public.jwt_role()') IS NULL THEN
    RAISE EXCEPTION
      'public.jwt_role() is missing. Migration 040 has to be applied first.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    RAISE EXCEPTION
      'Supabase roles authenticated, service_role, and authenticator are required.';
  END IF;
END
$pre$;

CREATE SCHEMA IF NOT EXISTS creditos;

COMMENT ON SCHEMA creditos IS
  'Pipedrive read model for the Créditos pages. Not the operational expediente in public.pai_credito_expediente. master, torredecontrol, gerencia, ventas, marketing, and creditos may select. The load writes with the service role. No stage history is stored.';

-- ---------------------------------------------------------------------------
-- Clock and classifiers. America/Guatemala does not observe daylight saving.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION creditos.guatemala_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = creditos, public, pg_temp
AS $$
  SELECT (clock_timestamp() AT TIME ZONE 'America/Guatemala')::date;
$$;

COMMENT ON FUNCTION creditos.guatemala_today() IS
  'Today in America/Guatemala. Used only to age the current stage. It is not a stage-to-stage duration.';

CREATE OR REPLACE FUNCTION creditos.days_in_current_stage(p_stage_change timestamptz)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = creditos, public, pg_temp
AS $$
  SELECT CASE
    WHEN p_stage_change IS NULL THEN NULL
    ELSE (creditos.guatemala_today() - (p_stage_change AT TIME ZONE 'America/Guatemala')::date)::integer
  END;
$$;

COMMENT ON FUNCTION creditos.days_in_current_stage(timestamptz) IS
  'Days since the deal entered its current stage. Null when stage_change_time is null. A negative number stays negative. The extract has no stage history, so this is not time spent in earlier stages.';

CREATE OR REPLACE FUNCTION creditos.tipo_bucket(p_a text, p_b text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = creditos, public, pg_temp
AS $$
  SELECT CASE
    WHEN p_a IS NULL AND p_b IS NULL THEN 'sin_dato'
    WHEN p_a IS NULL THEN p_b
    WHEN p_b IS NULL THEN p_a
    WHEN p_a = p_b THEN p_a
    WHEN (p_a = 'fha' AND p_b = 'credito_directo')
      OR (p_b = 'fha' AND p_a = 'credito_directo') THEN 'fha_y_directo'
    WHEN (p_a = 'fha' AND p_b = 'contado')
      OR (p_b = 'fha' AND p_a = 'contado') THEN 'fha_y_contado'
    WHEN (p_a = 'credito_directo' AND p_b = 'contado')
      OR (p_b = 'credito_directo' AND p_a = 'contado') THEN 'directo_y_contado'
    ELSE 'conflicto'
  END;
$$;

COMMENT ON FUNCTION creditos.tipo_bucket(text, text) IS
  'One bucket from the two Tipo de Crédito fields. Contado, Contado banco, and Contado Banco are the same family, so they agree. FHA together with crédito directo, and FHA together with contado, stay conflicts. There is no option named Banco. A stage name is not an input.';

CREATE OR REPLACE FUNCTION creditos.activity_signal(p_type text, p_subject text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = creditos, public, pg_temp
AS $$
  SELECT CASE
    WHEN p_type = 'ingreso_de_expediente' THEN 'ingreso_expediente'
    WHEN p_type = 'task' AND btrim(p_subject) = 'Checklist y cheque' THEN 'checklist'
    WHEN lower(btrim(p_subject)) IN (
      'seguimiento de expediente', 'status expediente', 'liquidación de expediente'
    ) THEN 'expediente_texto'
    WHEN p_type = 'promesa_firmada' AND btrim(p_subject) = 'Recepción de Promesa Firmada' THEN 'promesa_recepcion'
    WHEN p_type = 'promesa_firmada' THEN 'promesa_otra'
    WHEN p_type = 'envio_de_documentacion' AND btrim(p_subject) = 'Envío de documentación PCV' THEN 'envio_pcv'
    WHEN p_type = 'envio_de_documentacion' THEN 'envio_documentacion_otro'
    WHEN p_type = 'armado_de_expediente' THEN 'armado'
    WHEN p_type = 'contacto___solicitud_docum' THEN 'solicitud_papeleria'
    WHEN p_type = 'analisis_' THEN 'analisis'
    WHEN p_type = 'suspension' AND btrim(p_subject) = 'Suspensión por el FHA' THEN 'suspension_fha_texto'
    WHEN p_type = 'suspension' AND btrim(p_subject) = 'Rechazado' THEN 'suspension_rechazado'
    WHEN p_type = 'suspension' THEN 'suspension'
    WHEN p_type = 'suspension_levantada' THEN 'suspension_levantada'
    WHEN p_type = 're_analisis' THEN 're_analisis'
    WHEN p_type = 'aprobacion' AND btrim(p_subject) IN (
      'Aprobación - pago de contado', 'Aprobación - pago contado'
    ) THEN 'aprobacion_contado'
    WHEN p_type = 'aprobacion' THEN 'aprobacion'
    WHEN p_type = 'expediente_tecnico'
      AND btrim(p_subject) = 'Ingreso Expediente técnico / Avalúo' THEN 'ingreso_tecnico_actividad'
    WHEN p_type = 'expediente_tecnico' THEN 'expediente_tecnico_actividad'
    WHEN p_type = 'aprobacion_e_tecnico__aval' THEN 'aprobacion_tecnica_actividad'
    WHEN p_type = 'resguardo' THEN 'resguardo'
    WHEN p_type = 'resolucion' THEN 'resolucion'
    WHEN p_type = 'cita_firma_de_escritura' THEN 'cita_escritura'
    WHEN lower(btrim(p_subject)) IN (
      'firma de formularios',
      'reunión para firma de documentos',
      'reunion para firma de documentos',
      'firma de documentos para promesa',
      'armar papeleria para firma'
    ) THEN 'firma_documentos'
    WHEN p_type = 'task' AND (
      lower(btrim(p_subject)) LIKE '%llenad%'
      OR lower(btrim(p_subject)) LIKE '%llenar formulario%'
    ) THEN 'llenado'
    WHEN lower(btrim(p_subject)) IN (
      'seguimiento de papelería',
      'seguimiento papelería',
      'status de papelería',
      'papelería'
    ) THEN 'papeleria_seguimiento'
    WHEN lower(btrim(p_subject)) IN (
      'recoleccion de papeleria',
      'recolección de papelería',
      'recolección de corrección',
      'recolecta de papelerías',
      'recaudar papeleria',
      'pendiente papelería'
    ) THEN 'recoleccion'
    WHEN coalesce(p_subject, '') ~* '(papeler|recolec)' THEN 'papeleria_otro'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION creditos.activity_signal(text, text) IS
  'Classifies one activity. Milestone types win over free text. Checklist y cheque is not papelería. Cita firma de escritura is the escritura appointment, not firma de documentos del armado. The two expediente_tecnico subjects are wording variants, not an FHA/Banco split. Suspensión por el FHA and Rechazado are single subjects and are not the Suspendido FHA date. papeleria_otro is free text that mentions papelería and did not match 4.1–4.4. A null result is an activity this read model does not use.';

CREATE OR REPLACE FUNCTION creditos.file_scanner_loose(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = creditos, public, pg_temp
AS $$
  SELECT coalesce(p_name, '') ~* '(esc[aá]ner|escan|scanner|scaner)';
$$;

CREATE OR REPLACE FUNCTION creditos.file_scanner_strict(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = creditos, public, pg_temp
AS $$
  SELECT coalesce(p_name, '') ~* '(camscanner|escaneada)';
$$;

CREATE OR REPLACE FUNCTION creditos.file_pcv_name(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = creditos, public, pg_temp
AS $$
  SELECT coalesce(p_name, '') ~* '(promesa|pcv|compraventa|firmad)';
$$;

CREATE OR REPLACE FUNCTION creditos.file_numbered(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = creditos, public, pg_temp
AS $$
  SELECT coalesce(p_name, '') ~ '^[0-9]+\.';
$$;

CREATE OR REPLACE FUNCTION creditos.file_declaracion(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = creditos, public, pg_temp
AS $$
  SELECT coalesce(p_name, '') ~* 'declaraci[oó]n licita';
$$;

CREATE OR REPLACE FUNCTION creditos.note_scanner(p_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = creditos, public, pg_temp
AS $$
  SELECT coalesce(p_text, '') ~* '(esc[aá]ner|escan|scanner|scaner)';
$$;

COMMENT ON FUNCTION creditos.file_scanner_loose(text) IS
  'Free-text filename match: escáner, escan, scanner, scaner. Not a scanner-control flag. A substring can false-match.';

COMMENT ON FUNCTION creditos.file_scanner_strict(text) IS
  'Stricter filename match: CamScanner or escaneada. Still a filename, not a completed control step.';

COMMENT ON FUNCTION creditos.file_pcv_name(text) IS
  'Filename class promesa / pcv / compraventa / firmad. Not proof of a signed PCV and not a physical-versus-digital split.';

COMMENT ON FUNCTION creditos.file_numbered(text) IS
  'Filename starts with digits and a dot (1. Precalificacion and the same pattern). Not a required-document model.';

COMMENT ON FUNCTION creditos.file_declaracion(text) IS
  'Filename contains Declaración licita. A filename count, not a checklist item.';

COMMENT ON FUNCTION creditos.note_scanner(text) IS
  'Free-text note match for the same scanner words. A handful of notes in the inventory. Not a control.';

-- ---------------------------------------------------------------------------
-- Dimensions. Seeded from the 2026-11-02 stage list. Not measured facts.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS creditos.dim_project (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL UNIQUE,
  pipeline_name text NOT NULL,
  CONSTRAINT dim_project_slug_present CHECK (btrim(slug) <> ''),
  CONSTRAINT dim_project_name_present CHECK (btrim(name) <> '')
);

COMMENT ON TABLE creditos.dim_project IS
  'The six crédito pipelines. Torre Cobán is Créditos TCA. ventas.dim_project refuses that building; this schema keeps it because the pipeline exists and, in the inventory, holds zero deals.';

CREATE TABLE IF NOT EXISTS creditos.dim_pipeline (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES creditos.dim_project (id),
  pipedrive_pipeline_id integer NOT NULL UNIQUE,
  name text NOT NULL UNIQUE
);

COMMENT ON TABLE creditos.dim_pipeline IS
  'Pipedrive pipelines 7, 8, 9, 10, 11, and 18. Every stage has deal_probability 100 and rot disabled, so probability is not stored.';

CREATE TABLE IF NOT EXISTS creditos.dim_stage (
  id uuid PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES creditos.dim_pipeline (id),
  pipedrive_stage_id integer NOT NULL UNIQUE,
  pipedrive_name text NOT NULL,
  name text NOT NULL,
  order_nr integer NOT NULL,
  lane_key text NOT NULL,
  lane_label text NOT NULL,
  lane_order integer NOT NULL,
  stage_scope text NOT NULL,
  CONSTRAINT dim_stage_scope CHECK (stage_scope IN ('seis_embudos', 'sin_blv5', 'solo_blv5')),
  CONSTRAINT dim_stage_name_trimmed CHECK (name = btrim(pipedrive_name))
);

COMMENT ON TABLE creditos.dim_stage IS
  '71 stages from the 2026-11-02 extract. pipedrive_name keeps the trailing space on four TCA stages. lane_key lines up the same step across pipelines and is not a tipo. Resguardo FHA and Certificación Avalúo CD do not mean the deals inside are FHA or crédito directo. Non-BLV5 Expediente Técnico is a different lane from BLV5 Ingreso E. Técnico / Avalúo.';

COMMENT ON COLUMN creditos.dim_stage.stage_scope IS
  'seis_embudos: the stage exists on all six pipelines. sin_blv5: Expediente Técnico and Resguardo / Resolución, which BLV5 does not have. solo_blv5: the BLV5 split. A zero in a stage that exists is an empty queue. A lane that does not exist on a pipeline is not a zero.';

CREATE TABLE IF NOT EXISTS creditos.dim_enum (
  field_key text NOT NULL,
  option_id integer NOT NULL,
  api_key text NOT NULL,
  label text NOT NULL,
  family text,
  PRIMARY KEY (field_key, option_id),
  CONSTRAINT dim_enum_family CHECK (
    (field_key IN ('tipo_a', 'tipo_b') AND family IN ('fha', 'credito_directo', 'contado'))
    OR (field_key NOT IN ('tipo_a', 'tipo_b') AND family IS NULL)
  )
);

COMMENT ON TABLE creditos.dim_enum IS
  'Option lists from the Pipedrive field definitions of the 2026-11-02 recon. tipo_a is API key 4388f9408bee97892d7e815a8aea5578cc15db23. tipo_b is a5faa716153e778e295dab71a2bb4462bcc2389f. Same screen label, different options, not interchangeable. Contado and Contado banco share family contado. There is no option named Banco. Coordinadora Ninguna is a real option, not a blank.';

CREATE OR REPLACE FUNCTION creditos.lookup_enum(
  p_field text,
  p_option integer,
  OUT o_label text,
  OUT o_family text
)
RETURNS record
LANGUAGE plpgsql
STABLE
SET search_path = creditos, public, pg_temp
AS $$
BEGIN
  IF p_option IS NULL THEN
    o_label := NULL;
    o_family := NULL;
    RETURN;
  END IF;

  SELECT label, family
    INTO o_label, o_family
  FROM creditos.dim_enum
  WHERE field_key = p_field
    AND option_id = p_option;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'creditos.dim_enum has no % option %', p_field, p_option
      USING ERRCODE = 'foreign_key_violation';
  END IF;
END;
$$;

COMMENT ON FUNCTION creditos.lookup_enum(text, integer) IS
  'Label and family for one seeded option. An option that is not in dim_enum fails the load. The load does not invent a label.';

-- ---------------------------------------------------------------------------
-- Facts. The load replaces these rows. The stage catalog stays.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS creditos.fact_deal (
  id uuid PRIMARY KEY,
  pipedrive_deal_id bigint NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES creditos.dim_project (id),
  pipeline_id uuid NOT NULL REFERENCES creditos.dim_pipeline (id),
  stage_id uuid NOT NULL REFERENCES creditos.dim_stage (id),
  title text,
  status text NOT NULL,
  person_id bigint,
  currency text,
  value_amount numeric(16, 2),
  add_time timestamptz,
  update_time timestamptz,
  stage_change_time timestamptz,
  expected_close_on date,
  won_time timestamptz,
  lost_time timestamptz,
  lost_reason text,
  apartamento text,
  caso_fha numeric,
  monto_prestamo numeric(16, 2),
  monto_prestamo_currency text,
  valor_bien numeric(16, 2),
  valor_bien_currency text,
  enganche_pactado numeric(16, 2),
  enganche_currency text,
  tipo_a_option_id integer,
  tipo_a_label text,
  tipo_a_family text,
  tipo_b_option_id integer,
  tipo_b_label text,
  tipo_b_family text,
  tipo_bucket text,
  banco_option_id integer,
  banco_label text,
  coordinadora_option_id integer,
  coordinadora_label text,
  papeleria_vencida_option_id integer,
  papeleria_vencida text,
  reserva_completa_option_id integer,
  reserva_completa text,
  armado_option_id integer,
  armado_label text,
  armado_on date,
  ingreso_analisis_option_id integer,
  ingreso_analisis_label text,
  ingreso_analisis_on date,
  suspendido_fha_on date,
  suspendido_banco_on date,
  suspension_levantada_on date,
  aprobacion_fha_option_id integer,
  aprobacion_fha_label text,
  aprobacion_fha_on date,
  aprobacion_banco_option_id integer,
  aprobacion_banco_label text,
  aprobacion_banco_on date,
  aprobacion_tecnica_on date,
  fecha_pcv_on date,
  envia_pcv_on date,
  revision_pcv_on date,
  fecha_promesa_on date,
  fecha_legalizacion_on date,
  recepcion_legalizacion_on date,
  recepcion_compraventa_on date,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fact_deal_status CHECK (status IN ('open', 'lost', 'won')),
  CONSTRAINT fact_deal_family CHECK (
    (tipo_a_family IS NULL OR tipo_a_family IN ('fha', 'credito_directo', 'contado'))
    AND (tipo_b_family IS NULL OR tipo_b_family IN ('fha', 'credito_directo', 'contado'))
  ),
  CONSTRAINT fact_deal_bucket CHECK (
    tipo_bucket IS NULL OR tipo_bucket IN (
      'sin_dato', 'fha', 'credito_directo', 'contado',
      'fha_y_directo', 'fha_y_contado', 'directo_y_contado', 'conflicto'
    )
  )
);

COMMENT ON TABLE creditos.fact_deal IS
  'One current crédito deal from the Pipedrive extract. status won is not Desembolso or Liquidación. stage_change_time is only the entry of the current stage. A milestone date remains after the deal leaves the stage, so a date count is a historical event and not the open queue. Labels are filled from dim_enum. An unknown option id fails the insert.';

COMMENT ON COLUMN creditos.fact_deal.tipo_a_option_id IS
  'Field 4388f9408bee97892d7e815a8aea5578cc15db23. 113 Contado, 114 FHA, 115 Crédito directo, 116 Contado banco. Also used on sales-pipeline deals. Not tipo_b.';

COMMENT ON COLUMN creditos.fact_deal.tipo_b_option_id IS
  'Field a5faa716153e778e295dab71a2bb4462bcc2389f. 128 FHA, 129 Crédito Directo, 130 Contado, 131 Contado Banco. Almost only BLV5. Not a copy of tipo_a.';

COMMENT ON COLUMN creditos.fact_deal.tipo_bucket IS
  'Family of the two tipo fields. sin_dato means both are blank. fha_y_directo and fha_y_contado stay visible as conflicts. Stage names are not used.';

COMMENT ON COLUMN creditos.fact_deal.caso_fha IS
  'Field d509057bfda9b8fb9552a7e3241010ef9943d191, # Caso FHA. A case number. Not an approval amount and not an expediente-técnico status.';

COMMENT ON COLUMN creditos.fact_deal.banco_option_id IS
  'Field 4b61271f6d436ee08ff792cd771bc4053d456753, Banco Seleccionado. A bank on the deal does not mean the send or the stage was the bank track.';

COMMENT ON COLUMN creditos.fact_deal.coordinadora_option_id IS
  'Field 67d0a55bcaf20e7e973f45e6dfa1aaa4be409d88. Ninguna (611) is a chosen option. Null means the field was empty.';

COMMENT ON COLUMN creditos.fact_deal.papeleria_vencida IS
  'Label of field ac1bd387053111fea23f28fd36a6bb1fac127788. Si/No. Not a document checklist. The inventory shows Si on a handful of BLV5 deals and No unused.';

COMMENT ON COLUMN creditos.fact_deal.reserva_completa IS
  'Label of field 9ca2acd17f92715febc0a101577cd36867424905. A different fact from the PCV dates.';

COMMENT ON COLUMN creditos.fact_deal.armado_label IS
  'Label of field 9568a9d777a27747822682790e25fbf1c93e1d18. The Si flag is not the same population as the Armado de Expediente stage.';

COMMENT ON COLUMN creditos.fact_deal.armado_on IS
  'Field 093d453d59a4b987f30c7445caebd2f4ba792ce0. BLV5 milestone date in the inventory. It remains after the deal leaves Armado.';

COMMENT ON COLUMN creditos.fact_deal.ingreso_analisis_label IS
  'Label of field 942d8169c323f390480d8516ca4a25375a7b2899. One flag shared by FHA and crédito directo. There is no FHA send field and no Banco send field.';

COMMENT ON COLUMN creditos.fact_deal.ingreso_analisis_on IS
  'Field 18492b3389a7a7d7d5c7d1d179c4566fc6b99fc3. One shared date. Not an FHA/Banco split.';

COMMENT ON COLUMN creditos.fact_deal.suspendido_fha_on IS
  'Field 493ee81c1c7aa8a78719b4a947c0da1d94e58154. Historical date. Most deals with this date are no longer in stage Suspendido.';

COMMENT ON COLUMN creditos.fact_deal.suspendido_banco_on IS
  'Field d2c300fd3c827ca3d7c41b048fae507155732d03. Not the same thing as Tipo = crédito directo. Deals with this date are often Tipo FHA.';

COMMENT ON COLUMN creditos.fact_deal.suspension_levantada_on IS
  'Field 71590de955fd7558f5e409295704e63598164aa0. One lift date. It is not split by FHA and Banco.';

COMMENT ON COLUMN creditos.fact_deal.aprobacion_fha_label IS
  'Label of field b730ab421170bd024fe55e1a18c41ce5da92679f. Not the set of deals currently in stage Aprobación.';

COMMENT ON COLUMN creditos.fact_deal.aprobacion_fha_on IS
  'Field a888e0e8c76625232ced492085d5b977b3752015. A date can exist without the Si flag.';

COMMENT ON COLUMN creditos.fact_deal.aprobacion_banco_label IS
  'Label of field 37842b89e49a1fabb48a4de60ff0549023d2e367. Si is common on FHA deals. It does not mean the deal is the bank track.';

COMMENT ON COLUMN creditos.fact_deal.aprobacion_banco_on IS
  'Field 5c3c31beb091f7f9c10047b417fc4f4ac335d948. A date can exist without the Si flag.';

COMMENT ON COLUMN creditos.fact_deal.aprobacion_tecnica_on IS
  'Field a21100d69dbe3be2786cb131a221ff55730d4a37. This field is a date, not Si/No. There is no separate Banco avalúo date.';

COMMENT ON COLUMN creditos.fact_deal.fecha_pcv_on IS
  'Field d4b106a562009efef109aee1944bcbbbbd0797c7, Fecha de PCV- Dcto. Not the same deals as activity promesa_firmada.';

COMMENT ON COLUMN creditos.fact_deal.envia_pcv_on IS
  'Field a5b27df2a5306c04c5ea32fc7d3d642f29541ae5, Envía PCV - Asesor.';

COMMENT ON COLUMN creditos.fact_deal.revision_pcv_on IS
  'Field 459ddcc313129c5a4cff448c5ed91bc3834d9c73, Revisión PCV Legal.';

COMMENT ON COLUMN creditos.fact_deal.fecha_promesa_on IS
  'Field e7b3ab5f094694b2b493d2bc474ad74504013ca9, Fecha de Promesa.';

COMMENT ON COLUMN creditos.fact_deal.fecha_legalizacion_on IS
  'Field 513ca755843b58564ee28b886cd59b1c6f743a82. Stored so it is not treated as a PCV-control field. The pages do not count it as one.';

COMMENT ON COLUMN creditos.fact_deal.recepcion_legalizacion_on IS
  'Field ecf50140d4fd16f80f49d57f70d297cf490281fc. Not a PCV-control field.';

COMMENT ON COLUMN creditos.fact_deal.recepcion_compraventa_on IS
  'Field 297ac70629ee4328af41f1607c608c1c8d872c2e. Rare in the inventory. Not a PCV-control field.';

COMMENT ON COLUMN creditos.fact_deal.lost_reason IS
  'Pipedrive lost_reason. Commercial withdrawal in the inventory. No lost reason is named Suspendido, FHA, or rechazo bancario.';

COMMENT ON COLUMN creditos.fact_deal.value_amount IS
  'deal.value. Zero stays zero. Null stays null. A non-GTQ currency is not added into a GTQ total.';

COMMENT ON COLUMN creditos.fact_deal.stage_change_time IS
  'Entry time of the current stage only. Filled on most deals in the inventory and null on the rest. Not a history of previous stages.';

CREATE TABLE IF NOT EXISTS creditos.fact_activity (
  id uuid PRIMARY KEY,
  pipedrive_activity_id bigint NOT NULL UNIQUE,
  deal_id uuid NOT NULL REFERENCES creditos.fact_deal (id) ON DELETE CASCADE,
  type text NOT NULL,
  subject text,
  signal text,
  due_on date,
  done boolean,
  marked_as_done_time timestamptz,
  note text,
  add_time timestamptz
);

COMMENT ON TABLE creditos.fact_activity IS
  'Activities on crédito-pipeline deals. signal is set in the database from type and subject. Activities have no custom fields. due_on is the Pipedrive due_date and is the event day. A null due_on stays null. note is free text, useful on suspension, and is not a reason code.';

COMMENT ON COLUMN creditos.fact_activity.signal IS
  'Null means the activity is stored and not used by a page. Free-text signals are subject matches, not structured steps.';

CREATE TABLE IF NOT EXISTS creditos.fact_file (
  id uuid PRIMARY KEY,
  pipedrive_file_id bigint NOT NULL UNIQUE,
  deal_id uuid NOT NULL REFERENCES creditos.fact_deal (id) ON DELETE CASCADE,
  name text,
  file_type text,
  add_time timestamptz,
  active boolean NOT NULL
);

COMMENT ON TABLE creditos.fact_file IS
  'Human filenames on crédito deals. Classification is a filename match in the views. add_time is upload time, not a finished scanner step. The load skips inactive files.';

CREATE TABLE IF NOT EXISTS creditos.fact_note (
  id uuid PRIMARY KEY,
  pipedrive_note_id bigint NOT NULL UNIQUE,
  deal_id uuid NOT NULL REFERENCES creditos.fact_deal (id) ON DELETE CASCADE,
  content text,
  add_time timestamptz
);

COMMENT ON TABLE creditos.fact_note IS
  'Notes on crédito deals whose text matches the scanner words. Other notes are not loaded. The view checks the match again. Not a control.';

CREATE INDEX IF NOT EXISTS fact_deal_stage ON creditos.fact_deal (stage_id, status);
CREATE INDEX IF NOT EXISTS fact_deal_project ON creditos.fact_deal (project_id, status);
CREATE INDEX IF NOT EXISTS fact_deal_bucket ON creditos.fact_deal (tipo_bucket);
CREATE INDEX IF NOT EXISTS fact_deal_stage_change ON creditos.fact_deal (stage_change_time);
CREATE INDEX IF NOT EXISTS fact_activity_deal ON creditos.fact_activity (deal_id);
CREATE INDEX IF NOT EXISTS fact_activity_signal ON creditos.fact_activity (signal, due_on);
CREATE INDEX IF NOT EXISTS fact_file_deal ON creditos.fact_file (deal_id);
CREATE INDEX IF NOT EXISTS fact_note_deal ON creditos.fact_note (deal_id);

CREATE OR REPLACE FUNCTION creditos.apply_deal_labels()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = creditos, public, pg_temp
AS $$
DECLARE
  v_label text;
  v_family text;
BEGIN
  SELECT o_label, o_family INTO v_label, v_family
  FROM creditos.lookup_enum('tipo_a', NEW.tipo_a_option_id);
  NEW.tipo_a_label := v_label;
  NEW.tipo_a_family := v_family;

  SELECT o_label, o_family INTO v_label, v_family
  FROM creditos.lookup_enum('tipo_b', NEW.tipo_b_option_id);
  NEW.tipo_b_label := v_label;
  NEW.tipo_b_family := v_family;

  NEW.tipo_bucket := creditos.tipo_bucket(NEW.tipo_a_family, NEW.tipo_b_family);

  SELECT o_label INTO v_label FROM creditos.lookup_enum('banco', NEW.banco_option_id);
  NEW.banco_label := v_label;

  SELECT o_label INTO v_label FROM creditos.lookup_enum('coordinadora', NEW.coordinadora_option_id);
  NEW.coordinadora_label := v_label;

  SELECT o_label INTO v_label FROM creditos.lookup_enum('papeleria_vencida', NEW.papeleria_vencida_option_id);
  NEW.papeleria_vencida := v_label;

  SELECT o_label INTO v_label FROM creditos.lookup_enum('reserva_completa', NEW.reserva_completa_option_id);
  NEW.reserva_completa := v_label;

  SELECT o_label INTO v_label FROM creditos.lookup_enum('armado', NEW.armado_option_id);
  NEW.armado_label := v_label;

  SELECT o_label INTO v_label FROM creditos.lookup_enum('ingreso_analisis', NEW.ingreso_analisis_option_id);
  NEW.ingreso_analisis_label := v_label;

  SELECT o_label INTO v_label FROM creditos.lookup_enum('aprobacion_fha', NEW.aprobacion_fha_option_id);
  NEW.aprobacion_fha_label := v_label;

  SELECT o_label INTO v_label FROM creditos.lookup_enum('aprobacion_banco', NEW.aprobacion_banco_option_id);
  NEW.aprobacion_banco_label := v_label;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION creditos.apply_deal_labels() IS
  'Fills labels and the tipo bucket from dim_enum before insert. The load sends option ids only. An option outside the seed raises and the row is not written.';

CREATE OR REPLACE FUNCTION creditos.apply_activity_signal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = creditos, public, pg_temp
AS $$
BEGIN
  NEW.signal := creditos.activity_signal(NEW.type, NEW.subject);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION creditos.apply_activity_signal() IS
  'Stores activity_signal(type, subject). Re-run UPDATE creditos.fact_activity SET subject = subject after changing the classifier.';

DROP TRIGGER IF EXISTS fact_deal_labels ON creditos.fact_deal;
CREATE TRIGGER fact_deal_labels
  BEFORE INSERT OR UPDATE ON creditos.fact_deal
  FOR EACH ROW EXECUTE FUNCTION creditos.apply_deal_labels();

DROP TRIGGER IF EXISTS fact_activity_signal ON creditos.fact_activity;
CREATE TRIGGER fact_activity_signal
  BEFORE INSERT OR UPDATE OF type, subject ON creditos.fact_activity
  FOR EACH ROW EXECUTE FUNCTION creditos.apply_activity_signal();
-- ---------------------------------------------------------------------------
-- Seed. Structural members of the 2026-11-02 extract. Not measured facts.
-- ---------------------------------------------------------------------------

INSERT INTO creditos.dim_project (id, slug, name, sort_order, pipeline_name)
VALUES
  (uuid_v7(), 'benestare', 'Benestare', 1, 'Créditos Benestare'),
  (uuid_v7(), 'bosque-las-tapias', 'Bosque Las Tapias', 2, 'Créditos BLT'),
  (uuid_v7(), 'boulevard-5', 'Boulevard 5', 3, 'Créditos BLV5'),
  (uuid_v7(), 'santa-elena', 'Santa Elena', 4, 'Créditos Santa Elena'),
  (uuid_v7(), 'casa-elisa', 'Casa Elisa', 5, 'Créditos Casa Elisa'),
  (uuid_v7(), 'torre-coban', 'Torre Cobán', 6, 'Créditos TCA')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    pipeline_name = EXCLUDED.pipeline_name;

INSERT INTO creditos.dim_pipeline (id, project_id, pipedrive_pipeline_id, name)
SELECT uuid_v7(), p.id, v.pipedrive_pipeline_id, v.name
FROM (
  VALUES
    ('benestare', 7, 'Créditos Benestare'),
    ('bosque-las-tapias', 8, 'Créditos BLT'),
    ('boulevard-5', 9, 'Créditos BLV5'),
    ('santa-elena', 10, 'Créditos Santa Elena'),
    ('casa-elisa', 11, 'Créditos Casa Elisa'),
    ('torre-coban', 18, 'Créditos TCA')
) AS v(slug, pipedrive_pipeline_id, name)
JOIN creditos.dim_project p ON p.slug = v.slug
ON CONFLICT (pipedrive_pipeline_id) DO UPDATE
SET name = EXCLUDED.name,
    project_id = EXCLUDED.project_id;

INSERT INTO creditos.dim_stage (
  id, pipeline_id, pipedrive_stage_id, pipedrive_name, name,
  order_nr, lane_key, lane_label, lane_order, stage_scope
)
SELECT
  uuid_v7(),
  pl.id,
  v.stage_id,
  v.raw_name,
  btrim(v.raw_name),
  v.order_nr,
  v.lane_key,
  v.lane_label,
  v.lane_order,
  v.stage_scope
FROM (
  VALUES
  (7, 46, 1, 'Promesa', 'promesa', 'Promesa', 1, 'seis_embudos'),
  (7, 47, 2, 'Armado de Expediente', 'armado', 'Armado de Expediente', 2, 'seis_embudos'),
  (7, 49, 3, 'Análisis', 'analisis', 'Análisis', 3, 'seis_embudos'),
  (7, 50, 4, 'Suspendido', 'suspendido', 'Suspendido', 4, 'seis_embudos'),
  (7, 51, 5, 'Re-análisis', 'reanalisis', 'Re-análisis', 5, 'seis_embudos'),
  (7, 53, 6, 'Aprobación', 'aprobacion', 'Aprobación', 6, 'seis_embudos'),
  (7, 54, 7, 'Expediente Técnico', 'expediente_tecnico', 'Expediente Técnico', 9, 'sin_blv5'),
  (7, 52, 8, 'Resguardo / Resolución', 'resguardo_resolucion', 'Resguardo / Resolución', 13, 'sin_blv5'),
  (7, 55, 9, 'Escritura', 'escritura', 'Escritura', 16, 'seis_embudos'),
  (7, 130, 10, 'Desembolso', 'desembolso', 'Desembolso', 17, 'seis_embudos'),
  (7, 131, 11, 'Liquidación', 'liquidacion', 'Liquidación', 18, 'seis_embudos'),
  (8, 56, 1, 'Promesa', 'promesa', 'Promesa', 1, 'seis_embudos'),
  (8, 57, 2, 'Armado de Expediente', 'armado', 'Armado de Expediente', 2, 'seis_embudos'),
  (8, 59, 3, 'Análisis', 'analisis', 'Análisis', 3, 'seis_embudos'),
  (8, 60, 4, 'Suspendido', 'suspendido', 'Suspendido', 4, 'seis_embudos'),
  (8, 61, 5, 'Re-análisis', 'reanalisis', 'Re-análisis', 5, 'seis_embudos'),
  (8, 63, 6, 'Aprobación', 'aprobacion', 'Aprobación', 6, 'seis_embudos'),
  (8, 64, 7, 'Expediente Técnico', 'expediente_tecnico', 'Expediente Técnico', 9, 'sin_blv5'),
  (8, 62, 8, 'Resguardo / Resolución', 'resguardo_resolucion', 'Resguardo / Resolución', 13, 'sin_blv5'),
  (8, 65, 9, 'Escritura', 'escritura', 'Escritura', 16, 'seis_embudos'),
  (8, 132, 10, 'Desembolso', 'desembolso', 'Desembolso', 17, 'seis_embudos'),
  (8, 133, 11, 'Liquidación', 'liquidacion', 'Liquidación', 18, 'seis_embudos'),
  (9, 66, 1, 'Promesa', 'promesa', 'Promesa', 1, 'seis_embudos'),
  (9, 67, 2, 'Armado de Expediente', 'armado', 'Armado de Expediente', 2, 'seis_embudos'),
  (9, 69, 3, 'Análisis', 'analisis', 'Análisis', 3, 'seis_embudos'),
  (9, 70, 4, 'Suspendido', 'suspendido', 'Suspendido', 4, 'seis_embudos'),
  (9, 71, 5, 'Re-análisis', 'reanalisis', 'Re-análisis', 5, 'seis_embudos'),
  (9, 73, 6, 'Aprobación', 'aprobacion', 'Aprobación', 6, 'seis_embudos'),
  (9, 74, 7, 'Ingreso E. Técnico / Avalúo', 'ingreso_tecnico', 'Ingreso E. Técnico / Avalúo', 7, 'solo_blv5'),
  (9, 163, 8, 'Aprobación E. Técnico / Avalúo', 'aprobacion_tecnico', 'Aprobación E. Técnico / Avalúo', 8, 'solo_blv5'),
  (9, 72, 9, 'Resguardo FHA', 'resguardo_fha', 'Resguardo FHA', 10, 'solo_blv5'),
  (9, 165, 10, 'Visita Tercera Inspección', 'visita_tercera', 'Visita Tercera Inspección', 11, 'solo_blv5'),
  (9, 166, 11, 'Aprobación Tercera Ins. / Certificación Avalúo CD', 'certificacion_avaluo', 'Aprobación Tercera Ins. / Certificación Avalúo CD', 12, 'solo_blv5'),
  (9, 164, 12, 'Resolución Bancaria', 'resolucion_bancaria', 'Resolución Bancaria', 14, 'solo_blv5'),
  (9, 167, 13, 'Programación de firmas', 'programacion_firmas', 'Programación de firmas', 15, 'solo_blv5'),
  (9, 75, 14, 'Escritura', 'escritura', 'Escritura', 16, 'seis_embudos'),
  (9, 134, 15, 'Desembolso', 'desembolso', 'Desembolso', 17, 'seis_embudos'),
  (9, 135, 16, 'Liquidación', 'liquidacion', 'Liquidación', 18, 'seis_embudos'),
  (10, 76, 1, 'Promesa', 'promesa', 'Promesa', 1, 'seis_embudos'),
  (10, 77, 2, 'Armado de Expediente', 'armado', 'Armado de Expediente', 2, 'seis_embudos'),
  (10, 79, 3, 'Análisis', 'analisis', 'Análisis', 3, 'seis_embudos'),
  (10, 80, 4, 'Suspendido', 'suspendido', 'Suspendido', 4, 'seis_embudos'),
  (10, 81, 5, 'Re-análisis', 'reanalisis', 'Re-análisis', 5, 'seis_embudos'),
  (10, 83, 6, 'Aprobación', 'aprobacion', 'Aprobación', 6, 'seis_embudos'),
  (10, 84, 7, 'Expediente Técnico', 'expediente_tecnico', 'Expediente Técnico', 9, 'sin_blv5'),
  (10, 82, 8, 'Resguardo / Resolución', 'resguardo_resolucion', 'Resguardo / Resolución', 13, 'sin_blv5'),
  (10, 85, 9, 'Escritura', 'escritura', 'Escritura', 16, 'seis_embudos'),
  (10, 136, 10, 'Desembolso', 'desembolso', 'Desembolso', 17, 'seis_embudos'),
  (10, 137, 11, 'Liquidación', 'liquidacion', 'Liquidación', 18, 'seis_embudos'),
  (11, 86, 1, 'Promesa', 'promesa', 'Promesa', 1, 'seis_embudos'),
  (11, 87, 2, 'Armado de Expediente', 'armado', 'Armado de Expediente', 2, 'seis_embudos'),
  (11, 89, 3, 'Análisis', 'analisis', 'Análisis', 3, 'seis_embudos'),
  (11, 90, 4, 'Suspendido', 'suspendido', 'Suspendido', 4, 'seis_embudos'),
  (11, 91, 5, 'Re-análisis', 'reanalisis', 'Re-análisis', 5, 'seis_embudos'),
  (11, 93, 6, 'Aprobación', 'aprobacion', 'Aprobación', 6, 'seis_embudos'),
  (11, 94, 7, 'Expediente Técnico', 'expediente_tecnico', 'Expediente Técnico', 9, 'sin_blv5'),
  (11, 92, 8, 'Resguardo / Resolución', 'resguardo_resolucion', 'Resguardo / Resolución', 13, 'sin_blv5'),
  (11, 95, 9, 'Escritura', 'escritura', 'Escritura', 16, 'seis_embudos'),
  (11, 138, 10, 'Desembolso', 'desembolso', 'Desembolso', 17, 'seis_embudos'),
  (11, 139, 11, 'Liquidación', 'liquidacion', 'Liquidación', 18, 'seis_embudos'),
  (18, 148, 1, 'Promesa', 'promesa', 'Promesa', 1, 'seis_embudos'),
  (18, 149, 2, 'Armado de Expediente', 'armado', 'Armado de Expediente', 2, 'seis_embudos'),
  (18, 150, 3, 'Análisis', 'analisis', 'Análisis', 3, 'seis_embudos'),
  (18, 151, 4, 'Suspendido', 'suspendido', 'Suspendido', 4, 'seis_embudos'),
  (18, 152, 5, 'Re-análisis', 'reanalisis', 'Re-análisis', 5, 'seis_embudos'),
  (18, 153, 6, 'Aprobación ', 'aprobacion', 'Aprobación', 6, 'seis_embudos'),
  (18, 154, 7, 'Expediente Técnico', 'expediente_tecnico', 'Expediente Técnico', 9, 'sin_blv5'),
  (18, 155, 8, 'Resguardo / Resolución ', 'resguardo_resolucion', 'Resguardo / Resolución', 13, 'sin_blv5'),
  (18, 156, 9, 'Escritura ', 'escritura', 'Escritura', 16, 'seis_embudos'),
  (18, 157, 10, 'Desembolso', 'desembolso', 'Desembolso', 17, 'seis_embudos'),
  (18, 158, 11, 'Liquidación ', 'liquidacion', 'Liquidación', 18, 'seis_embudos')
) AS v(pipeline_pipedrive_id, stage_id, order_nr, raw_name, lane_key, lane_label, lane_order, stage_scope)
JOIN creditos.dim_pipeline pl ON pl.pipedrive_pipeline_id = v.pipeline_pipedrive_id
ON CONFLICT (pipedrive_stage_id) DO UPDATE
SET pipedrive_name = EXCLUDED.pipedrive_name,
    name = EXCLUDED.name,
    order_nr = EXCLUDED.order_nr,
    lane_key = EXCLUDED.lane_key,
    lane_label = EXCLUDED.lane_label,
    lane_order = EXCLUDED.lane_order,
    stage_scope = EXCLUDED.stage_scope,
    pipeline_id = EXCLUDED.pipeline_id;

INSERT INTO creditos.dim_enum (field_key, option_id, api_key, label, family)
VALUES
  ('tipo_a', 113, '4388f9408bee97892d7e815a8aea5578cc15db23', 'Contado', 'contado'),
  ('tipo_a', 114, '4388f9408bee97892d7e815a8aea5578cc15db23', 'FHA', 'fha'),
  ('tipo_a', 115, '4388f9408bee97892d7e815a8aea5578cc15db23', 'Crédito directo', 'credito_directo'),
  ('tipo_a', 116, '4388f9408bee97892d7e815a8aea5578cc15db23', 'Contado banco', 'contado'),
  ('tipo_b', 128, 'a5faa716153e778e295dab71a2bb4462bcc2389f', 'FHA', 'fha'),
  ('tipo_b', 129, 'a5faa716153e778e295dab71a2bb4462bcc2389f', 'Crédito Directo', 'credito_directo'),
  ('tipo_b', 130, 'a5faa716153e778e295dab71a2bb4462bcc2389f', 'Contado', 'contado'),
  ('tipo_b', 131, 'a5faa716153e778e295dab71a2bb4462bcc2389f', 'Contado Banco', 'contado'),
  ('banco', 245, '4b61271f6d436ee08ff792cd771bc4053d456753', 'Banco de Guatemala', NULL),
  ('banco', 246, '4b61271f6d436ee08ff792cd771bc4053d456753', 'Banco Industrial', NULL),
  ('banco', 247, '4b61271f6d436ee08ff792cd771bc4053d456753', 'Banco Promerica', NULL),
  ('banco', 248, '4b61271f6d436ee08ff792cd771bc4053d456753', 'Banco CHN', NULL),
  ('banco', 249, '4b61271f6d436ee08ff792cd771bc4053d456753', 'Bantrab', NULL),
  ('banco', 250, '4b61271f6d436ee08ff792cd771bc4053d456753', 'Banco G&T Continental', NULL),
  ('banco', 251, '4b61271f6d436ee08ff792cd771bc4053d456753', 'Vivibanco', NULL),
  ('banco', 252, '4b61271f6d436ee08ff792cd771bc4053d456753', 'Banco Credicorp', NULL),
  ('banco', 478, '4b61271f6d436ee08ff792cd771bc4053d456753', 'BAC', NULL),
  ('banco', 484, '4b61271f6d436ee08ff792cd771bc4053d456753', 'BAM', NULL),
  ('banco', 639, '4b61271f6d436ee08ff792cd771bc4053d456753', 'Banrural', NULL),
  ('banco', 640, '4b61271f6d436ee08ff792cd771bc4053d456753', 'Interbanco', NULL),
  ('coordinadora', 293, '67d0a55bcaf20e7e973f45e6dfa1aaa4be409d88', 'Alejandro Morales', NULL),
  ('coordinadora', 294, '67d0a55bcaf20e7e973f45e6dfa1aaa4be409d88', 'Andrea Gonzalez', NULL),
  ('coordinadora', 611, '67d0a55bcaf20e7e973f45e6dfa1aaa4be409d88', 'Ninguna', NULL),
  ('coordinadora', 670, '67d0a55bcaf20e7e973f45e6dfa1aaa4be409d88', 'Javier Pérez', NULL),
  ('armado', 139, '9568a9d777a27747822682790e25fbf1c93e1d18', 'Si', NULL),
  ('armado', 140, '9568a9d777a27747822682790e25fbf1c93e1d18', 'No', NULL),
  ('ingreso_analisis', 141, '942d8169c323f390480d8516ca4a25375a7b2899', 'Si', NULL),
  ('ingreso_analisis', 142, '942d8169c323f390480d8516ca4a25375a7b2899', 'No', NULL),
  ('aprobacion_fha', 585, 'b730ab421170bd024fe55e1a18c41ce5da92679f', 'Si', NULL),
  ('aprobacion_fha', 586, 'b730ab421170bd024fe55e1a18c41ce5da92679f', 'No', NULL),
  ('aprobacion_banco', 583, '37842b89e49a1fabb48a4de60ff0549023d2e367', 'Si', NULL),
  ('aprobacion_banco', 584, '37842b89e49a1fabb48a4de60ff0549023d2e367', 'No', NULL),
  ('papeleria_vencida', 673, 'ac1bd387053111fea23f28fd36a6bb1fac127788', 'Si', NULL),
  ('papeleria_vencida', 674, 'ac1bd387053111fea23f28fd36a6bb1fac127788', 'No', NULL),
  ('reserva_completa', 608, '9ca2acd17f92715febc0a101577cd36867424905', 'Si', NULL),
  ('reserva_completa', 609, '9ca2acd17f92715febc0a101577cd36867424905', 'No', NULL)
ON CONFLICT (field_key, option_id) DO UPDATE
SET api_key = EXCLUDED.api_key,
    label = EXCLUDED.label,
    family = EXCLUDED.family;

-- ---------------------------------------------------------------------------
-- Views. security_invoker so the reader role, not the owner, is checked.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW creditos.v_deal
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  d.pipedrive_deal_id,
  d.title,
  p.slug AS project_slug,
  p.name AS project_name,
  p.sort_order AS project_sort,
  pl.name AS pipeline_name,
  pl.pipedrive_pipeline_id,
  s.pipedrive_stage_id,
  s.name AS stage_name,
  s.lane_key,
  s.lane_label,
  s.lane_order,
  s.order_nr AS stage_order,
  s.stage_scope,
  d.status,
  d.currency,
  d.value_amount,
  d.monto_prestamo,
  d.monto_prestamo_currency,
  d.valor_bien,
  d.valor_bien_currency,
  d.enganche_pactado,
  d.enganche_currency,
  d.tipo_a_label,
  d.tipo_b_label,
  d.tipo_bucket,
  d.banco_label,
  d.coordinadora_label,
  CASE
    WHEN d.caso_fha IS NULL THEN NULL
    WHEN d.caso_fha = trunc(d.caso_fha) THEN to_char(d.caso_fha, 'FM9999999999')
    ELSE to_char(d.caso_fha, 'FM9999999999.99')
  END AS caso_fha_text,
  d.apartamento,
  creditos.days_in_current_stage(d.stage_change_time) AS days_in_stage,
  (d.stage_change_time AT TIME ZONE 'America/Guatemala')::date AS entered_on,
  d.lost_reason,
  d.armado_label,
  d.armado_on,
  d.ingreso_analisis_label,
  d.ingreso_analisis_on,
  d.suspendido_fha_on,
  d.suspendido_banco_on,
  d.suspension_levantada_on,
  d.aprobacion_fha_label,
  d.aprobacion_fha_on,
  d.aprobacion_banco_label,
  d.aprobacion_banco_on,
  d.aprobacion_tecnica_on,
  d.fecha_pcv_on,
  d.envia_pcv_on,
  d.revision_pcv_on,
  d.fecha_promesa_on,
  d.reserva_completa,
  d.papeleria_vencida,
  COALESCE((
    SELECT array_agg(DISTINCT a.signal ORDER BY a.signal)
    FROM creditos.fact_activity a
    WHERE a.deal_id = d.id
      AND a.signal IS NOT NULL
  ), ARRAY[]::text[]) AS signals,
  EXISTS (
    SELECT 1 FROM creditos.fact_file f
    WHERE f.deal_id = d.id AND f.active AND creditos.file_scanner_loose(f.name)
  ) AS file_scanner,
  EXISTS (
    SELECT 1 FROM creditos.fact_file f
    WHERE f.deal_id = d.id AND f.active AND creditos.file_scanner_strict(f.name)
  ) AS file_scanner_strict,
  EXISTS (
    SELECT 1 FROM creditos.fact_file f
    WHERE f.deal_id = d.id AND f.active AND creditos.file_pcv_name(f.name)
  ) AS file_pcv,
  EXISTS (
    SELECT 1 FROM creditos.fact_file f
    WHERE f.deal_id = d.id AND f.active AND creditos.file_numbered(f.name)
  ) AS file_numbered,
  EXISTS (
    SELECT 1 FROM creditos.fact_file f
    WHERE f.deal_id = d.id AND f.active AND creditos.file_declaracion(f.name)
  ) AS file_declaracion
FROM creditos.fact_deal d
JOIN creditos.dim_project p ON p.id = d.project_id
JOIN creditos.dim_pipeline pl ON pl.id = d.pipeline_id
JOIN creditos.dim_stage s ON s.id = d.stage_id;

COMMENT ON VIEW creditos.v_deal IS
  'One current deal for the pages. days_in_stage and entered_on use stage_change_time of the current stage only; there is no history. tipo_bucket comes from the two Tipo de Crédito fields, never from the stage name. won is not desembolso. signals are activity classes, including free-text subject matches. file_* flags are filename matches, not document controls. A null amount stays null. Casa Elisa and the non-BLV5 pipelines do not have the BLV5 milestone fields; those columns stay null and the page must say sin registro rather than invent a zero completeness score.';

CREATE OR REPLACE VIEW creditos.v_open_stage
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  p.slug AS project_slug,
  p.name AS project_name,
  p.sort_order AS project_sort,
  pl.name AS pipeline_name,
  s.pipedrive_stage_id,
  s.name AS stage_name,
  s.lane_key,
  s.lane_label,
  s.lane_order,
  s.order_nr AS stage_order,
  s.stage_scope,
  count(d.id) FILTER (WHERE d.status = 'open') AS open_n,
  count(d.id) FILTER (WHERE d.status = 'lost') AS lost_n,
  count(d.id) FILTER (WHERE d.status = 'won') AS won_n,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY creditos.days_in_current_stage(d.stage_change_time)
  ) FILTER (
    WHERE d.status = 'open' AND d.stage_change_time IS NOT NULL
  ) AS median_days,
  count(d.id) FILTER (
    WHERE d.status = 'open' AND d.stage_change_time IS NULL
  ) AS open_without_entry
FROM creditos.dim_stage s
JOIN creditos.dim_pipeline pl ON pl.id = s.pipeline_id
JOIN creditos.dim_project p ON p.id = pl.project_id
LEFT JOIN creditos.fact_deal d ON d.stage_id = s.id
GROUP BY
  p.slug, p.name, p.sort_order, pl.name,
  s.pipedrive_stage_id, s.name, s.lane_key, s.lane_label,
  s.lane_order, s.order_nr, s.stage_scope;

COMMENT ON VIEW creditos.v_open_stage IS
  'Every seeded stage, including stages with zero deals. open_n is the current queue. A zero means the stage exists and has no deals in that status. It does not invent a lane the pipeline does not have. median_days is the median days in the current stage for open deals that have stage_change_time. It is not a transition time. won_n is Pipedrive won, which in this book is not Desembolso. TCA rows stay at zero until a deal exists.';

CREATE OR REPLACE VIEW creditos.v_event
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  'activity'::text AS source,
  a.signal,
  p.slug AS project_slug,
  p.name AS project_name,
  a.due_on AS event_on,
  d.pipedrive_deal_id,
  d.tipo_bucket,
  d.status,
  a.pipedrive_activity_id AS ref_id
FROM creditos.fact_activity a
JOIN creditos.fact_deal d ON d.id = a.deal_id
JOIN creditos.dim_project p ON p.id = d.project_id
WHERE a.signal IS NOT NULL
UNION ALL
SELECT
  'milestone_date'::text,
  v.signal,
  p.slug,
  p.name,
  v.event_on,
  d.pipedrive_deal_id,
  d.tipo_bucket,
  d.status,
  d.pipedrive_deal_id AS ref_id
FROM creditos.fact_deal d
JOIN creditos.dim_project p ON p.id = d.project_id
CROSS JOIN LATERAL (
  VALUES
    ('armado_fecha', d.armado_on),
    ('ingreso_analisis_fecha', d.ingreso_analisis_on),
    ('suspendido_fha_fecha', d.suspendido_fha_on),
    ('suspendido_banco_fecha', d.suspendido_banco_on),
    ('suspension_levantada_fecha', d.suspension_levantada_on),
    ('aprobacion_fha_fecha', d.aprobacion_fha_on),
    ('aprobacion_banco_fecha', d.aprobacion_banco_on),
    ('aprobacion_tecnica_fecha', d.aprobacion_tecnica_on),
    ('fecha_pcv', d.fecha_pcv_on),
    ('envia_pcv', d.envia_pcv_on),
    ('revision_pcv', d.revision_pcv_on),
    ('fecha_promesa', d.fecha_promesa_on)
) AS v(signal, event_on)
WHERE v.event_on IS NOT NULL
UNION ALL
SELECT
  'filename'::text,
  v.signal,
  p.slug,
  p.name,
  (f.add_time AT TIME ZONE 'America/Guatemala')::date,
  d.pipedrive_deal_id,
  d.tipo_bucket,
  d.status,
  f.pipedrive_file_id AS ref_id
FROM creditos.fact_file f
JOIN creditos.fact_deal d ON d.id = f.deal_id
JOIN creditos.dim_project p ON p.id = d.project_id
CROSS JOIN LATERAL (
  VALUES
    ('archivo', true),
    ('archivo_escaner', creditos.file_scanner_loose(f.name)),
    ('archivo_escaner_estricto', creditos.file_scanner_strict(f.name)),
    ('archivo_pcv', creditos.file_pcv_name(f.name)),
    ('archivo_numerado', creditos.file_numbered(f.name)),
    ('archivo_declaracion', creditos.file_declaracion(f.name))
) AS v(signal, hit)
WHERE f.active
  AND v.hit
UNION ALL
SELECT
  'note'::text,
  'nota_escaner',
  p.slug,
  p.name,
  (n.add_time AT TIME ZONE 'America/Guatemala')::date,
  d.pipedrive_deal_id,
  d.tipo_bucket,
  d.status,
  n.pipedrive_note_id AS ref_id
FROM creditos.fact_note n
JOIN creditos.fact_deal d ON d.id = n.deal_id
JOIN creditos.dim_project p ON p.id = d.project_id
WHERE creditos.note_scanner(n.content);

COMMENT ON VIEW creditos.v_event IS
  'Historical events, not the open queue. Activity event_on is due_date and is null when Pipedrive has no due date; those rows are kept so the page can say sin fecha instead of dropping them. Milestone dates are BLV5-only in the inventory except the PCV dates, which also exist on Benestare and BLT, and they remain after the deal leaves the stage. Filename event_on is the Guatemala upload day, not a control completion. archivo counts every active file. Scanner, PCV, numbered, and declaración rows are free-text filename matches. nota_escaner is a free-text note match. tipo_bucket is an attribute of the deal. The activity itself does not say FHA except the single subject Suspensión por el FHA. This view has no stage-to-stage duration.';

-- ---------------------------------------------------------------------------
-- Read access. Same readers as Ventas plus Mercadeo, and the creditos role.
-- The load uses the service role, which bypasses row level security.
-- ---------------------------------------------------------------------------

DO $rls$
DECLARE
  v_table text;
BEGIN
  FOR v_table IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'creditos'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE creditos.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS creditos_select ON creditos.%I', v_table);
    EXECUTE format(
      'CREATE POLICY creditos_select ON creditos.%I FOR SELECT TO authenticated USING (public.jwt_role() IN (''master'', ''torredecontrol'', ''gerencia'', ''ventas'', ''marketing'', ''creditos''))',
      v_table
    );
  END LOOP;
END
$rls$;

REVOKE ALL ON SCHEMA creditos FROM PUBLIC;
GRANT USAGE ON SCHEMA creditos TO authenticator, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA creditos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA creditos TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA creditos FROM authenticated, anon, PUBLIC;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA creditos FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA creditos TO service_role;
GRANT EXECUTE ON FUNCTION
  creditos.guatemala_today(),
  creditos.days_in_current_stage(timestamptz),
  creditos.file_scanner_loose(text),
  creditos.file_scanner_strict(text),
  creditos.file_pcv_name(text),
  creditos.file_numbered(text),
  creditos.file_declaracion(text),
  creditos.note_scanner(text)
  TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA creditos
  GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA creditos
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

DO $check$
BEGIN
  IF (SELECT count(*) FROM creditos.dim_project) <> 6 THEN
    RAISE EXCEPTION 'creditos.dim_project should have 6 rows';
  END IF;
  IF (SELECT count(*) FROM creditos.dim_pipeline) <> 6 THEN
    RAISE EXCEPTION 'creditos.dim_pipeline should have 6 rows';
  END IF;
  IF (SELECT count(*) FROM creditos.dim_stage) <> 71 THEN
    RAISE EXCEPTION 'creditos.dim_stage should have 71 rows';
  END IF;
  IF (SELECT count(*) FROM creditos.dim_enum) <> 36 THEN
    RAISE EXCEPTION 'creditos.dim_enum should have 36 rows';
  END IF;
  IF (SELECT count(*) FROM creditos.dim_stage WHERE pipedrive_name <> btrim(pipedrive_name)) <> 4 THEN
    RAISE EXCEPTION 'TCA should keep exactly four stage names with a trailing space';
  END IF;
  IF creditos.activity_signal('ingreso_de_expediente', 'Ingreso de Expediente')
       IS DISTINCT FROM 'ingreso_expediente'
     OR creditos.activity_signal('task', 'Checklist y cheque') IS DISTINCT FROM 'checklist'
     OR creditos.activity_signal('promesa_firmada', 'Recepción de Promesa Firmada')
       IS DISTINCT FROM 'promesa_recepcion'
     OR creditos.activity_signal('promesa_firmada', 'Promesa Firmada') IS DISTINCT FROM 'promesa_otra'
     OR creditos.activity_signal('aprobacion', 'Aprobación - pago de contado')
       IS DISTINCT FROM 'aprobacion_contado'
     OR creditos.activity_signal('task', 'Llenado de formularios') IS DISTINCT FROM 'llenado'
     OR creditos.activity_signal('task', 'Firma de formularios') IS DISTINCT FROM 'firma_documentos'
     OR creditos.activity_signal('task', 'Recolección de papelería') IS DISTINCT FROM 'recoleccion'
     OR creditos.activity_signal('task', 'Seguimiento de papelería') IS DISTINCT FROM 'papeleria_seguimiento'
     OR creditos.activity_signal('cita_firma_de_escritura', 'Cita firma de escritura')
       IS DISTINCT FROM 'cita_escritura'
     OR creditos.activity_signal('task', 'Llamada cualquiera') IS NOT NULL
     OR creditos.activity_signal('suspension', 'Suspensión por el FHA')
       IS DISTINCT FROM 'suspension_fha_texto'
     OR creditos.tipo_bucket(NULL, NULL) IS DISTINCT FROM 'sin_dato'
     OR creditos.tipo_bucket('fha', NULL) IS DISTINCT FROM 'fha'
     OR creditos.tipo_bucket('contado', 'contado') IS DISTINCT FROM 'contado'
     OR creditos.tipo_bucket('fha', 'credito_directo') IS DISTINCT FROM 'fha_y_directo'
     OR creditos.tipo_bucket('contado', 'fha') IS DISTINCT FROM 'fha_y_contado'
     OR creditos.file_scanner_loose('CamScanner 08-05-2025.pdf') IS NOT TRUE
     OR creditos.file_scanner_strict('PAPELERIA ESCANEADA.pdf') IS NOT TRUE
     OR creditos.file_pcv_name('Promesa firmada.pdf') IS NOT TRUE
     OR creditos.file_numbered('1. Precalificacion.pdf') IS NOT TRUE
     OR creditos.file_declaracion('Declaración licita con financimiento.pdf') IS NOT TRUE
  THEN
    RAISE EXCEPTION 'creditos classifier self-check failed';
  END IF;
END
$check$;

NOTIFY pgrst, 'reload schema';

SELECT check_name, detail
FROM (
  SELECT 1 AS ord, 'projects'::text AS check_name,
    string_agg(name || ' (' || pipeline_name || ')', ', ' ORDER BY sort_order) AS detail
  FROM creditos.dim_project
  UNION ALL
  SELECT 2, 'stages', count(*)::text FROM creditos.dim_stage
  UNION ALL
  SELECT 3, 'enums', count(*)::text FROM creditos.dim_enum
  UNION ALL
  SELECT 4, 'deals', count(*)::text FROM creditos.fact_deal
) checks
ORDER BY ord;
