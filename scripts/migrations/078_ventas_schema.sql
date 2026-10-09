-- ============================================================================
-- Migration 078: schema ventas
-- ============================================================================
-- The store for the thirteen Ventas pages. Spec: docs/db-ventas.md,
-- docs/sdd-ventas.md, and docs/pai-bis.md, in that order.
--
-- Run this once, by hand, in the Supabase SQL editor. This session has no
-- DATABASE_URL and no psql, and it does not apply the file.
--
-- After it commits:
--   1. Project Settings → Data API → Exposed schemas: add ventas.
--      The NOTIFY at the bottom reloads PostgREST. It does not expose the
--      schema by itself.
--   2. Do not run scripts/migrations/077_pipedrive_deal_dates.sql.
--
-- This file does not drop or rewrite reservation, créditos, entregas, or the
-- old sales-feed tables. It does not seed deals, units, payments, discount
-- types, or caso especial values. Fact tables stay empty.
--
-- Primary keys are UUID v7, supplied by the load (or by ventas.calendar_id
-- for dim_date, and by the seed below for the structural members). No key
-- defaults to gen_random_uuid(). A missing key fails.
--
-- Postgres 15 or newer: NULLS NOT DISTINCT and security_invoker views.
-- ============================================================================

DO $pre$
BEGIN
  IF to_regprocedure('uuid_v7()') IS NULL THEN
    RAISE EXCEPTION
      'uuid_v7() is not installed. Refusing to create ventas keys with gen_random_uuid(), which is a v4.';
  END IF;

  IF to_regprocedure('public.jwt_role()') IS NULL THEN
    RAISE EXCEPTION
      'public.jwt_role() is missing. Migration 040 has to be applied first.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ventas') THEN
    RAISE EXCEPTION
      'schema ventas already exists. This migration is the initial store, not a patch.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    RAISE EXCEPTION
      'Supabase roles authenticated, service_role, and authenticator are required.';
  END IF;
END
$pre$;

CREATE SCHEMA ventas;

COMMENT ON SCHEMA ventas IS
  'Read model for the thirteen Ventas pages. Not a copy of Odoo. master, torredecontrol, and gerencia may select. The load writes with the service role.';

-- ---------------------------------------------------------------------------
-- Clock and unit identity
-- ---------------------------------------------------------------------------

CREATE FUNCTION ventas.guatemala_day(p_at timestamptz)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = ventas, public, pg_temp
AS $$
  SELECT (p_at AT TIME ZONE 'America/Guatemala')::date;
$$;

COMMENT ON FUNCTION ventas.guatemala_day(timestamptz) IS
  'America/Guatemala calendar day of a UTC timestamp. Guatemala is UTC-6 and does not observe daylight saving time.';

CREATE FUNCTION ventas.canonical_unit_token(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ventas, public, pg_temp
AS $$
  SELECT CASE
    WHEN p_token IS NULL THEN NULL
    WHEN btrim(p_token) = '' THEN NULL
    WHEN btrim(p_token) ~ '^[0-9]+$' THEN
      CASE
        WHEN ltrim(btrim(p_token), '0') = '' THEN '0'
        ELSE ltrim(btrim(p_token), '0')
      END
    ELSE btrim(p_token)
  END;
$$;

COMMENT ON FUNCTION ventas.canonical_unit_token(text) IS
  'Whole unit token. All-digit tokens lose leading zeros, so 203 and 0203 are one unit. 203 is not 1203. L-1 and Casa 1 stay whole. This does not search inside a longer token.';

CREATE FUNCTION ventas.calendar_id(p_day date)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_month_start date;
  v_month_end date;
BEGIN
  IF p_day IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM ventas.dim_date
  WHERE calendar_day = p_day;

  IF FOUND THEN
    RETURN v_id;
  END IF;

  v_month_start := date_trunc('month', p_day)::date;
  v_month_end := (date_trunc('month', p_day) + interval '1 month' - interval '1 day')::date;

  INSERT INTO ventas.dim_date (
    id, calendar_day, year, quarter, month, month_start, month_end
  ) VALUES (
    uuid_v7(),
    p_day,
    EXTRACT(YEAR FROM p_day)::integer,
    EXTRACT(QUARTER FROM p_day)::integer,
    EXTRACT(MONTH FROM p_day)::integer,
    v_month_start,
    v_month_end
  )
  ON CONFLICT (calendar_day) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM ventas.dim_date
    WHERE calendar_day = p_day;
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION ventas.calendar_id(date) IS
  'Returns the dim_date id for a Guatemala calendar day, inserting that day with uuid_v7() when it is missing. Service role only.';

DO $tz$
BEGIN
  IF ventas.guatemala_day('2026-10-05T06:00:00Z') <> DATE '2026-10-05'
     OR ventas.guatemala_day('2026-10-05T05:59:59Z') <> DATE '2026-10-04' THEN
    RAISE EXCEPTION 'America/Guatemala day boundary is not UTC-6.';
  END IF;

  IF ventas.canonical_unit_token('0203') <> '203'
     OR ventas.canonical_unit_token('203') <> '203'
     OR ventas.canonical_unit_token('1203') <> '1203'
     OR ventas.canonical_unit_token('1203') = ventas.canonical_unit_token('203')
     OR ventas.canonical_unit_token('L-1') <> 'L-1'
     OR ventas.canonical_unit_token('Casa 1') <> 'Casa 1'
     OR ventas.canonical_unit_token('000') <> '0' THEN
    RAISE EXCEPTION 'canonical unit token rule failed.';
  END IF;
END
$tz$;

-- ---------------------------------------------------------------------------
-- Conformed dimensions
-- ---------------------------------------------------------------------------

CREATE TABLE ventas.dim_date (
  id uuid PRIMARY KEY,
  calendar_day date NOT NULL UNIQUE,
  year integer NOT NULL,
  quarter integer NOT NULL,
  month integer NOT NULL,
  month_start date NOT NULL,
  month_end date NOT NULL,
  CONSTRAINT dim_date_parts CHECK (
    year = EXTRACT(YEAR FROM calendar_day)::integer
    AND quarter = EXTRACT(QUARTER FROM calendar_day)::integer
    AND month = EXTRACT(MONTH FROM calendar_day)::integer
    AND month BETWEEN 1 AND 12
    AND quarter BETWEEN 1 AND 4
    AND month_start = date_trunc('month', calendar_day)::date
    AND month_end = (date_trunc('month', calendar_day) + interval '1 month' - interval '1 day')::date
  )
);

COMMENT ON TABLE ventas.dim_date IS
  'One Guatemala calendar day. Period presets are ranges of these days. The load and ventas.calendar_id write the rows. No calendar is invented ahead of the facts.';

CREATE TABLE ventas.dim_project (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_project_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT dim_project_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato')),
  CONSTRAINT dim_project_not_torre_coban CHECK (
    name <> 'Torre Cobán' AND name <> 'Torre Coban'
  )
);

COMMENT ON TABLE ventas.dim_project IS
  'One building. A sales pipeline and a créditos pipeline for the same building are two dim_source_pipeline rows and one row here. Torre Cobán is not a building in this store.';

CREATE UNIQUE INDEX dim_project_one_sin_dato
  ON ventas.dim_project (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_source_pipeline (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  project_id uuid REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_source_pipeline_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT dim_source_pipeline_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato')),
  CONSTRAINT dim_source_pipeline_sin_dato_has_no_building CHECK (
    is_sin_dato = false OR project_id IS NULL
  )
);

COMMENT ON TABLE ventas.dim_source_pipeline IS
  'One source pipeline. project_id is null when the pipeline is not a building. Eventos and Marketing & Sales PAI are not buildings. Their deals take the Sin dato project and are not dropped. Torre Cobán deals are not loaded.';

CREATE UNIQUE INDEX dim_source_pipeline_one_sin_dato
  ON ventas.dim_source_pipeline (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_tower (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  name text NOT NULL,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_tower_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT dim_tower_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato')),
  CONSTRAINT dim_tower_identity UNIQUE (project_id, name)
);

COMMENT ON TABLE ventas.dim_tower IS
  'One tower in one project. The Sin dato member belongs to the Sin dato project. Santa Elena has no tower row. Boulevard 5 and Casa Elisa each have one tower, Principal. NUEVA is not a tower.';

CREATE UNIQUE INDEX dim_tower_one_sin_dato
  ON ventas.dim_tower (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_model (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  name text NOT NULL,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_model_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT dim_model_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato')),
  CONSTRAINT dim_model_identity UNIQUE (project_id, name)
);

COMMENT ON TABLE ventas.dim_model IS
  'One model in one project. Model B in one project is not model B in another. Empty model points at the Sin dato member.';

CREATE UNIQUE INDEX dim_model_one_sin_dato
  ON ventas.dim_model (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_habitaciones (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_habitaciones_name CHECK (name IN ('1H', '2H', '3H', 'Sin dato')),
  CONSTRAINT dim_habitaciones_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato'))
);

COMMENT ON TABLE ventas.dim_habitaciones IS
  'Bedroom class from Pipedrive Tipo de Apartamento: 1H, 2H, 3H, plus Sin dato. A blank value points at Sin dato. Any other value is not a member and is not stored as Sin dato.';

CREATE UNIQUE INDEX dim_habitaciones_one_sin_dato
  ON ventas.dim_habitaciones (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_asesor (
  id uuid PRIMARY KEY,
  source_user_id text NOT NULL UNIQUE,
  name text NOT NULL,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_asesor_user_present CHECK (btrim(source_user_id) <> ''),
  CONSTRAINT dim_asesor_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT dim_asesor_sin_dato CHECK (
    is_sin_dato = (source_user_id = 'sin_dato')
    AND (is_sin_dato = false OR name = 'Sin dato')
  )
);

COMMENT ON TABLE ventas.dim_asesor IS
  'One source user. The deal owner. Asesor.';

CREATE UNIQUE INDEX dim_asesor_one_sin_dato
  ON ventas.dim_asesor (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_fuente (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_fuente_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT dim_fuente_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato'))
);

COMMENT ON TABLE ventas.dim_fuente IS
  'One Pipedrive Fuente value, plus Sin dato. The same row is used on the sale, the visit, and the lead. An empty Fuente is Sin dato, not a dropped row.';

CREATE UNIQUE INDEX dim_fuente_one_sin_dato
  ON ventas.dim_fuente (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_promotion_type (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_promotion_type_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT dim_promotion_type_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato'))
);

COMMENT ON TABLE ventas.dim_promotion_type IS
  'One Pipedrive Tipo de Promoción value, plus Sin dato. The field exists. Empty rows stay Sin dato.';

CREATE UNIQUE INDEX dim_promotion_type_one_sin_dato
  ON ventas.dim_promotion_type (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_discount_type (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_discount_type_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT dim_discount_type_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato'))
);

COMMENT ON TABLE ventas.dim_discount_type IS
  'One discount type. No rows besides Sin dato until the Odoo 19 list is loaded. Do not insert Genérico, Pago al contado, Family & Friends, Volumen, Especial, Cliente directo, or Promoción.';

CREATE UNIQUE INDEX dim_discount_type_one_sin_dato
  ON ventas.dim_discount_type (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_case_type (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_case_type_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT dim_case_type_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato'))
);

COMMENT ON TABLE ventas.dim_case_type IS
  'One Family & Friends or caso especial type. No rows besides Sin dato until the Odoo 19 list is loaded. A Family & Friends discount is a discount row, not a case row.';

CREATE UNIQUE INDEX dim_case_type_one_sin_dato
  ON ventas.dim_case_type (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_lost_reason (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_lost_reason_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT dim_lost_reason_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato'))
);

COMMENT ON TABLE ventas.dim_lost_reason IS
  'One Pipedrive lost_reason, plus Sin dato.';

CREATE UNIQUE INDEX dim_lost_reason_one_sin_dato
  ON ventas.dim_lost_reason (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.dim_unit_status (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_sin_dato boolean NOT NULL,
  CONSTRAINT dim_unit_status_name CHECK (
    name IN (
      'Sin dato',
      'Disponible',
      'Reservado',
      'Congelado',
      'PCV',
      'Promesa',
      'Vendido en archivo',
      'En revisión'
    )
  ),
  CONSTRAINT dim_unit_status_sin_dato_label CHECK (is_sin_dato = (name = 'Sin dato')),
  CONSTRAINT dim_unit_status_not_page_vendido CHECK (name <> 'Vendido')
);

COMMENT ON TABLE ventas.dim_unit_status IS
  'Workbook inventory status after the mapping in docs/db-ventas.md. PCV, Promesa, and Vendido en archivo stay three statuses. The page line Vendido is not a member. En revisión is a member the workbook does not produce. A blank workbook cell is Disponible and is not a word in unit_status_word.';

CREATE UNIQUE INDEX dim_unit_status_one_sin_dato
  ON ventas.dim_unit_status (is_sin_dato) WHERE is_sin_dato;

CREATE TABLE ventas.unit_status_word (
  word text PRIMARY KEY,
  status_id uuid NOT NULL REFERENCES ventas.dim_unit_status (id) ON DELETE RESTRICT,
  CONSTRAINT unit_status_word_normal CHECK (
    word = lower(word) AND word = btrim(word) AND word <> ''
  )
);

COMMENT ON TABLE ventas.unit_status_word IS
  'Workbook word to stored status. Lookup is lower(btrim(word)). No row means the word is not stored as Disponible. Blank is not a word here. The load maps a blank cell to Disponible.';

CREATE TABLE ventas.dim_unit (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  tower_id uuid NOT NULL REFERENCES ventas.dim_tower (id) ON DELETE RESTRICT,
  model_id uuid NOT NULL REFERENCES ventas.dim_model (id) ON DELETE RESTRICT,
  habitaciones_id uuid NOT NULL REFERENCES ventas.dim_habitaciones (id) ON DELETE RESTRICT,
  canonical_unit text NOT NULL,
  unit_token_2 text,
  CONSTRAINT dim_unit_token_present CHECK (btrim(canonical_unit) <> ''),
  CONSTRAINT dim_unit_token_2_present CHECK (
    unit_token_2 IS NULL OR btrim(unit_token_2) <> ''
  ),
  CONSTRAINT dim_unit_tokens_differ CHECK (
    unit_token_2 IS NULL OR unit_token_2 <> canonical_unit
  ),
  CONSTRAINT dim_unit_identity UNIQUE NULLS NOT DISTINCT (
    project_id, tower_id, canonical_unit, unit_token_2, model_id
  )
);

COMMENT ON TABLE ventas.dim_unit IS
  'One project, tower, canonical unit, and model. unit_token_2 is Casa Elisa''s second nomenclature, stored only when the two Número columns differ. Neither token is then the chosen unit. Santa Elena uses the Sin dato tower. A traslado is another row, not two towers on this row.';

COMMENT ON COLUMN ventas.dim_unit.habitaciones_id IS
  'Tipo de Apartamento on the unit. Sin dato until a deal names 1H, 2H, or 3H. The stock pages filter this column.';

COMMENT ON COLUMN ventas.dim_unit.canonical_unit IS
  'The unit token when unit_token_2 is null. When unit_token_2 is present, both tokens are this unit and canonical_unit is not a chosen winner. A partner match must not treat either token as the only unit.';

COMMENT ON COLUMN ventas.dim_unit.unit_token_2 IS
  'Casa Elisa second Número column, kept only when it differs from canonical_unit. Both are the unit. Neither is chosen.';

CREATE INDEX dim_unit_canonical ON ventas.dim_unit (project_id, canonical_unit);
CREATE INDEX dim_unit_token_2 ON ventas.dim_unit (unit_token_2) WHERE unit_token_2 IS NOT NULL;

CREATE TABLE ventas.dim_deal (
  id uuid PRIMARY KEY,
  pipedrive_deal_id text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  pipeline_id uuid NOT NULL REFERENCES ventas.dim_source_pipeline (id) ON DELETE RESTRICT,
  asesor_id uuid NOT NULL REFERENCES ventas.dim_asesor (id) ON DELETE RESTRICT,
  fuente_id uuid NOT NULL REFERENCES ventas.dim_fuente (id) ON DELETE RESTRICT,
  habitaciones_id uuid NOT NULL REFERENCES ventas.dim_habitaciones (id) ON DELETE RESTRICT,
  unit_id uuid REFERENCES ventas.dim_unit (id) ON DELETE RESTRICT,
  promotion_type_id uuid NOT NULL REFERENCES ventas.dim_promotion_type (id) ON DELETE RESTRICT,
  lost_reason_id uuid NOT NULL REFERENCES ventas.dim_lost_reason (id) ON DELETE RESTRICT,
  add_time timestamptz NOT NULL,
  add_on date NOT NULL,
  add_date_id uuid NOT NULL REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  value_gtq numeric(18,2),
  valor_del_bien_gtq numeric(18,2),
  valor_promocion_gtq numeric(18,2),
  valor_vale_gtq numeric(18,2),
  envia_pcv_on date,
  lost_time timestamptz,
  lost_on date,
  lost_date_id uuid REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  pipedrive_status text NOT NULL,
  CONSTRAINT dim_deal_id_present CHECK (btrim(pipedrive_deal_id) <> ''),
  CONSTRAINT dim_deal_status CHECK (pipedrive_status IN ('open', 'won', 'lost')),
  CONSTRAINT dim_deal_lost_day CHECK (
    (lost_time IS NULL AND lost_on IS NULL AND lost_date_id IS NULL)
    OR (lost_time IS NOT NULL AND lost_on IS NOT NULL AND lost_date_id IS NOT NULL)
  )
);

COMMENT ON TABLE ventas.dim_deal IS
  'One Pipedrive deal. This is the lead. The lead date is add_time. A deal that later becomes a sale stays a lead row. There is no second lead table. pipedrive_status is open, won, or lost as Pipedrive stored it. Status de ventas does not read that column.';

COMMENT ON COLUMN ventas.dim_deal.unit_id IS
  'Set from Torre Apartamento, Modelo, and Tipo de Apartamento when those fields parse. Null only when the deal names no unit. A named unit that fails the whole-token rule is not guessed.';

COMMENT ON COLUMN ventas.dim_deal.value_gtq IS
  'Deal value, quetzales. Null when empty. Zero stays zero. This is the quetzales of Comprobante, PCV, and Ventas. Valor del Bien is not that figure.';

COMMENT ON COLUMN ventas.dim_deal.habitaciones_id IS
  'Tipo de Apartamento. Sin dato when the deal field is empty. Ventas totales filters this column, including a deal that names no unit.';

COMMENT ON COLUMN ventas.dim_deal.lost_time IS
  'When the deal was lost. Null when it is not lost. A desistimiento is booked on this timestamp, not on a partner write_date.';

CREATE INDEX dim_deal_project ON ventas.dim_deal (project_id);
CREATE INDEX dim_deal_asesor ON ventas.dim_deal (asesor_id);
CREATE INDEX dim_deal_fuente ON ventas.dim_deal (fuente_id);
CREATE INDEX dim_deal_unit ON ventas.dim_deal (unit_id);
CREATE INDEX dim_deal_add_on ON ventas.dim_deal (add_on);
CREATE INDEX dim_deal_lost_on ON ventas.dim_deal (lost_on);

-- ---------------------------------------------------------------------------
-- Partner text. Not the match key.
-- ---------------------------------------------------------------------------

CREATE TABLE ventas.odoo_partner (
  id uuid PRIMARY KEY,
  odoo_partner_id text NOT NULL UNIQUE,
  name_raw text NOT NULL,
  project_id uuid REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  tower_id uuid REFERENCES ventas.dim_tower (id) ON DELETE RESTRICT,
  model_id uuid REFERENCES ventas.dim_model (id) ON DELETE RESTRICT,
  canonical_unit text,
  buyer_name text,
  desistimiento_prefix boolean NOT NULL,
  cd_prefix boolean NOT NULL,
  unproven_token text,
  CONSTRAINT odoo_partner_id_present CHECK (btrim(odoo_partner_id) <> ''),
  CONSTRAINT odoo_partner_name_present CHECK (btrim(name_raw) <> '')
);

COMMENT ON TABLE ventas.odoo_partner IS
  'Odoo partner name and the columns parsed from it. Partner is not the join to Pipedrive. The load parses only the templates in docs/db-ventas.md. A token that template does not prove goes to unproven_token and is not written into project, tower, unit, or model. Null parsed columns mean unparsed, not Sin dato. DS- sets desistimiento_prefix. CD- sets cd_prefix and is not a desistimiento. The desistimiento date is lost_time on the matched deal.';

COMMENT ON COLUMN ventas.odoo_partner.buyer_name IS
  'The person written on the partner name of that project, tower, unit, and model. It can corroborate a match. It cannot make one. Successive buyers stay successive when their payment spans do not overlap.';

-- ---------------------------------------------------------------------------
-- Facts. One grain each. Natural keys make a reload replace the row.
-- ---------------------------------------------------------------------------

CREATE TABLE ventas.fact_comprobante (
  id uuid PRIMARY KEY,
  pipedrive_activity_id text NOT NULL UNIQUE,
  deal_id uuid REFERENCES ventas.dim_deal (id) ON DELETE RESTRICT,
  marked_as_done_time timestamptz NOT NULL,
  comprobante_on date NOT NULL,
  date_id uuid NOT NULL REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  CONSTRAINT fact_comprobante_activity_present CHECK (btrim(pipedrive_activity_id) <> '')
);

COMMENT ON TABLE ventas.fact_comprobante IS
  'One Pipedrive activity with type reserva and done true. The clock is marked_as_done_time. This is not a sale gate. deal_id is null when the activity has no deal. That row stays and is the remainder on Ventas totales. It cannot become a sale. Quetzales are dim_deal.value_gtq when a deal exists, and null when it does not.';

CREATE INDEX fact_comprobante_deal ON ventas.fact_comprobante (deal_id, comprobante_on);

CREATE TABLE ventas.fact_recibo (
  id uuid PRIMARY KEY,
  odoo_payment_id text NOT NULL UNIQUE,
  odoo_move_id text,
  partner_id uuid REFERENCES ventas.odoo_partner (id) ON DELETE RESTRICT,
  move_state text,
  payment_type text NOT NULL,
  anulado boolean NOT NULL,
  fecha date,
  fecha_date_id uuid REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  created_at timestamptz,
  written_at timestamptz,
  published_at timestamptz,
  published_on date,
  published_date_id uuid REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  amount_gtq numeric(18,2),
  partner_name_raw text,
  printed_name text,
  buyer_name text,
  desistimiento_prefix boolean NOT NULL,
  project_id uuid REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  tower_id uuid REFERENCES ventas.dim_tower (id) ON DELETE RESTRICT,
  model_id uuid REFERENCES ventas.dim_model (id) ON DELETE RESTRICT,
  canonical_unit text,
  matched_deal_id uuid REFERENCES ventas.dim_deal (id) ON DELETE RESTRICT,
  matched_unit_id uuid REFERENCES ventas.dim_unit (id) ON DELETE RESTRICT,
  match_unresolved boolean NOT NULL,
  CONSTRAINT fact_recibo_payment_present CHECK (btrim(odoo_payment_id) <> ''),
  CONSTRAINT fact_recibo_payment_type CHECK (payment_type IN ('inbound', 'outbound')),
  CONSTRAINT fact_recibo_published_day CHECK (
    (published_at IS NULL AND published_on IS NULL AND published_date_id IS NULL)
    OR (published_at IS NOT NULL AND published_on IS NOT NULL AND published_date_id IS NOT NULL)
  ),
  CONSTRAINT fact_recibo_fecha_day CHECK (
    (fecha IS NULL AND fecha_date_id IS NULL)
    OR (fecha IS NOT NULL AND fecha_date_id IS NOT NULL)
  ),
  CONSTRAINT fact_recibo_match_pair CHECK (
    (matched_deal_id IS NULL AND matched_unit_id IS NULL)
    OR (matched_deal_id IS NOT NULL AND matched_unit_id IS NOT NULL)
  ),
  CONSTRAINT fact_recibo_unresolved_has_no_winner CHECK (
    match_unresolved = false
    OR (matched_deal_id IS NULL AND matched_unit_id IS NULL)
  )
);

COMMENT ON TABLE ventas.fact_recibo IS
  'One Odoo 15 account.payment. State is account.move.state on odoo_move_id. posted is Publicado. published_at is mail.message.date of the first empty message on that journal entry, UTC. Fecha, created_at, and written_at do not fill a missing clock. A Publicado payment with no note keeps its amount and a null clock. Confirmado is not stored: inbound, move_state posted, anulado false. Reportado is inbound, not posted, not cancel, not anulado. While this table has no rows, Recibo and Ventas say the Odoo 15 reading is not loaded.';

COMMENT ON COLUMN ventas.fact_recibo.fecha IS
  'account.move.date, the accounting date on the Recibo. The plan-vs-actual month uses this. The match against the Comprobante day uses this. It is not the publication clock.';

COMMENT ON COLUMN ventas.fact_recibo.printed_name IS
  'The name printed on the payment. Stored, and not by itself the buyer.';

COMMENT ON COLUMN ventas.fact_recibo.matched_deal_id IS
  'Set only when one deal and one unit meet the match key. The key is project, tower, canonical unit, and model, plus the Comprobante day against Fecha, when the partner name supplies a model. Without a model, the key drops model. Santa Elena drops tower. More than one deal or more than one unit sets match_unresolved and leaves both ids null. The load does not pick a winner.';

COMMENT ON COLUMN ventas.fact_recibo.project_id IS
  'Parsed from the partner name. Null when the token is unproven. Null is not Sin dato.';

CREATE INDEX fact_recibo_match
  ON ventas.fact_recibo (project_id, tower_id, canonical_unit, model_id, fecha);
CREATE INDEX fact_recibo_matched_deal
  ON ventas.fact_recibo (matched_deal_id, published_on);
CREATE INDEX fact_recibo_matched_unit
  ON ventas.fact_recibo (matched_unit_id);
CREATE INDEX fact_recibo_unresolved
  ON ventas.fact_recibo (match_unresolved) WHERE match_unresolved;

CREATE TABLE ventas.fact_pcv_issuance (
  id uuid PRIMARY KEY,
  deal_id uuid NOT NULL UNIQUE REFERENCES ventas.dim_deal (id) ON DELETE RESTRICT,
  pipedrive_activity_id text UNIQUE,
  activity_marked_as_done_time timestamptz,
  envia_pcv_on date,
  clock_at timestamptz,
  clock_on date NOT NULL,
  clock_is_date_only boolean NOT NULL,
  clock_date_id uuid NOT NULL REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  CONSTRAINT fact_pcv_activity_present CHECK (
    pipedrive_activity_id IS NULL OR btrim(pipedrive_activity_id) <> ''
  ),
  CONSTRAINT fact_pcv_clock_rule CHECK (
    (
      activity_marked_as_done_time IS NOT NULL
      AND clock_is_date_only = false
      AND clock_at = activity_marked_as_done_time
    )
    OR (
      activity_marked_as_done_time IS NULL
      AND envia_pcv_on IS NOT NULL
      AND clock_is_date_only = true
      AND clock_at IS NULL
      AND clock_on = envia_pcv_on
    )
  )
);

COMMENT ON TABLE ventas.fact_pcv_issuance IS
  'One deal that has an issuance recording. Promesa emitida. Not the reception. When the envio_de_documentacion activity exists, clock_at is its marked_as_done_time. When only Envía PCV - Asesor exists, clock_on is that calendar day and clock_is_date_only is true. When both exist, the activity clock is the one used. The two recordings are not averaged. A deal with neither recording has no row.';

COMMENT ON COLUMN ventas.fact_pcv_issuance.pipedrive_activity_id IS
  'The activity whose marked_as_done_time is stored. Null when the only recording is the deal date. The grain is the deal, so several activities of this type are not several rows.';

CREATE INDEX fact_pcv_clock ON ventas.fact_pcv_issuance (clock_on);

CREATE TABLE ventas.fact_reception (
  id uuid PRIMARY KEY,
  pipedrive_activity_id text NOT NULL UNIQUE,
  deal_id uuid REFERENCES ventas.dim_deal (id) ON DELETE RESTRICT,
  marked_as_done_time timestamptz NOT NULL,
  reception_on date NOT NULL,
  date_id uuid NOT NULL REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  subject text NOT NULL,
  CONSTRAINT fact_reception_activity_present CHECK (btrim(pipedrive_activity_id) <> ''),
  CONSTRAINT fact_reception_subject CHECK (subject = 'Recepción de Promesa Firmada')
);

COMMENT ON TABLE ventas.fact_reception IS
  'One Pipedrive activity with type promesa_firmada, done true, and subject exactly Recepción de Promesa Firmada. Other subjects of that type, and type firma_de_promesa, are not loaded. The second sale gate for a deal is the latest clock in this table. Earlier rows stay. A reception with no PCV issuance still closes the gate.';

CREATE INDEX fact_reception_deal
  ON ventas.fact_reception (deal_id, marked_as_done_time DESC);

CREATE TABLE ventas.fact_visit (
  id uuid PRIMARY KEY,
  pipedrive_activity_id text NOT NULL UNIQUE,
  deal_id uuid REFERENCES ventas.dim_deal (id) ON DELETE RESTRICT,
  fuente_id uuid NOT NULL REFERENCES ventas.dim_fuente (id) ON DELETE RESTRICT,
  marked_as_done_time timestamptz NOT NULL,
  visit_on date NOT NULL,
  date_id uuid NOT NULL REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  CONSTRAINT fact_visit_activity_present CHECK (btrim(pipedrive_activity_id) <> '')
);

COMMENT ON TABLE ventas.fact_visit IS
  'One Pipedrive activity with type visita_efectiva and done true. The date is marked_as_done_time. fuente_id is the deal Fuente, or Sin dato when the activity has no deal or the Fuente is empty.';

CREATE INDEX fact_visit_day ON ventas.fact_visit (visit_on, fuente_id);

CREATE TABLE ventas.fact_inventory_observation (
  id uuid PRIMARY KEY,
  unit_id uuid NOT NULL REFERENCES ventas.dim_unit (id) ON DELETE RESTRICT,
  observed_on date NOT NULL,
  date_id uuid NOT NULL REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  status_id uuid NOT NULL REFERENCES ventas.dim_unit_status (id) ON DELETE RESTRICT,
  list_price_amount numeric(18,2),
  list_price_currency text,
  CONSTRAINT fact_inventory_day UNIQUE (unit_id, observed_on),
  CONSTRAINT fact_inventory_price_pair CHECK (
    (list_price_amount IS NULL AND list_price_currency IS NULL)
    OR (list_price_amount IS NOT NULL AND list_price_currency IN ('GTQ', 'USD'))
  )
);

COMMENT ON TABLE ventas.fact_inventory_observation IS
  'One observed workbook status of one unit on one day. The list price is an amount and a currency. The reader sees it labeled Precio de lista. That label is not a workbook header. Santa Elena is USD. Every other project is GTQ. The amount is not converted and is not deal value. Reload conflict target is (unit_id, observed_on). While this table has no rows, the three stock pages say this cut has no rows yet. They do not say No hay datos en PipeDrive, and they do not invent a stock from deals or Recibos. Headers are parsed by name, as listed in docs/db-ventas.md, never by column letter.';

CREATE INDEX fact_inventory_unit_day
  ON ventas.fact_inventory_observation (unit_id, observed_on DESC);

CREATE TABLE ventas.fact_price_rise (
  id uuid PRIMARY KEY,
  source_natural_key text NOT NULL UNIQUE,
  unit_id uuid NOT NULL REFERENCES ventas.dim_unit (id) ON DELETE RESTRICT,
  tower_id uuid NOT NULL REFERENCES ventas.dim_tower (id) ON DELETE RESTRICT,
  model_id uuid NOT NULL REFERENCES ventas.dim_model (id) ON DELETE RESTRICT,
  effective_on date NOT NULL,
  date_id uuid NOT NULL REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  previous_amount numeric(18,2) NOT NULL,
  new_amount numeric(18,2) NOT NULL,
  difference_amount numeric(18,2) NOT NULL,
  currency text NOT NULL,
  CONSTRAINT fact_price_rise_key_present CHECK (btrim(source_natural_key) <> ''),
  CONSTRAINT fact_price_rise_currency CHECK (currency IN ('GTQ', 'USD')),
  CONSTRAINT fact_price_rise_difference CHECK (
    difference_amount = new_amount - previous_amount
  ),
  CONSTRAINT fact_price_rise_grain UNIQUE (unit_id, effective_on)
);

COMMENT ON TABLE ventas.fact_price_rise IS
  'One unit on one effective date. Empty until Odoo 19. The page shows No hay datos en PipeDrive. No Pipedrive column is invented. Currency is stored so Santa Elena dollars are not added into a quetzales total.';

CREATE TABLE ventas.fact_discount (
  id uuid PRIMARY KEY,
  source_natural_key text NOT NULL UNIQUE,
  deal_id uuid NOT NULL REFERENCES ventas.dim_deal (id) ON DELETE RESTRICT,
  discount_type_id uuid NOT NULL REFERENCES ventas.dim_discount_type (id) ON DELETE RESTRICT,
  amount_gtq numeric(18,2) NOT NULL,
  rate numeric(9,6) NOT NULL,
  CONSTRAINT fact_discount_key_present CHECK (btrim(source_natural_key) <> '')
);

COMMENT ON TABLE ventas.fact_discount IS
  'One discount line on one deal that is a sale. Empty until Odoo 19. The page shows No hay datos en PipeDrive. The Sin dato dimension member is not a discount row. rate is a fraction, numeric(9,6).';

CREATE INDEX fact_discount_deal ON ventas.fact_discount (deal_id);

CREATE TABLE ventas.fact_case_mark (
  id uuid PRIMARY KEY,
  source_natural_key text NOT NULL UNIQUE,
  deal_id uuid NOT NULL REFERENCES ventas.dim_deal (id) ON DELETE RESTRICT,
  case_type_id uuid NOT NULL REFERENCES ventas.dim_case_type (id) ON DELETE RESTRICT,
  CONSTRAINT fact_case_mark_key_present CHECK (btrim(source_natural_key) <> ''),
  CONSTRAINT fact_case_mark_grain UNIQUE (deal_id, case_type_id)
);

COMMENT ON TABLE ventas.fact_case_mark IS
  'One case mark on one deal that is a sale. Family & Friends and caso especial. Empty until Odoo 19. The page shows No hay datos en PipeDrive. These sales stay inside the Ventas totales headline.';

CREATE TABLE ventas.fact_target (
  id uuid PRIMARY KEY,
  source_natural_key text NOT NULL UNIQUE,
  asesor_id uuid NOT NULL REFERENCES ventas.dim_asesor (id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  month_start date NOT NULL,
  date_id uuid NOT NULL REFERENCES ventas.dim_date (id) ON DELETE RESTRICT,
  target_units integer,
  target_gtq numeric(18,2),
  CONSTRAINT fact_target_key_present CHECK (btrim(source_natural_key) <> ''),
  CONSTRAINT fact_target_month CHECK (
    month_start = date_trunc('month', month_start)::date
  ),
  CONSTRAINT fact_target_has_a_figure CHECK (
    target_units IS NOT NULL OR target_gtq IS NOT NULL
  ),
  CONSTRAINT fact_target_units_nonnegative CHECK (
    target_units IS NULL OR target_units >= 0
  ),
  CONSTRAINT fact_target_gtq_nonnegative CHECK (
    target_gtq IS NULL OR target_gtq >= 0
  ),
  CONSTRAINT fact_target_grain UNIQUE (asesor_id, project_id, month_start)
);

COMMENT ON TABLE ventas.fact_target IS
  'One asesor, one project, one calendar month. Torre and Fuente are not part of the grain. Empty until Odoo 19. The page shows No hay datos en PipeDrive. For Este mes the actual runs through today and the target is that calendar month. A quarter or a year sums the month rows inside it.';

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

CREATE FUNCTION ventas.assert_project_currency(
  p_unit_id uuid,
  p_amount numeric,
  p_currency text
) RETURNS void
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
DECLARE
  v_name text;
  v_sin boolean;
BEGIN
  SELECT p.name, p.is_sin_dato
    INTO v_name, v_sin
  FROM ventas.dim_unit u
  JOIN ventas.dim_project p ON p.id = u.project_id
  WHERE u.id = p_unit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unit % is not in ventas.dim_unit', p_unit_id;
  END IF;

  IF v_sin THEN
    RAISE EXCEPTION 'list price is not stored on the Sin dato project';
  END IF;

  IF (p_amount IS NULL) <> (p_currency IS NULL) THEN
    RAISE EXCEPTION 'list price amount and currency are both present or both absent';
  END IF;

  IF p_amount IS NULL THEN
    RETURN;
  END IF;

  IF v_name = 'Santa Elena' AND p_currency <> 'USD' THEN
    RAISE EXCEPTION 'Santa Elena list price is USD and is not converted';
  END IF;

  IF v_name <> 'Santa Elena' AND p_currency <> 'GTQ' THEN
    RAISE EXCEPTION 'list price for % is GTQ and is not converted from dollars', v_name;
  END IF;
END;
$$;

CREATE FUNCTION ventas.dim_tower_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
DECLARE
  v_project_name text;
BEGIN
  IF lower(btrim(NEW.name)) = 'nueva' THEN
    RAISE EXCEPTION 'NUEVA is not a tower';
  END IF;

  SELECT name INTO v_project_name
  FROM ventas.dim_project
  WHERE id = NEW.project_id;

  IF v_project_name = 'Santa Elena' THEN
    RAISE EXCEPTION 'Santa Elena has no tower';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER dim_tower_before
  BEFORE INSERT OR UPDATE ON ventas.dim_tower
  FOR EACH ROW
  EXECUTE FUNCTION ventas.dim_tower_before();

CREATE FUNCTION ventas.dim_unit_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
DECLARE
  v_project_name text;
  v_tower_name text;
  v_tower_sin boolean;
  v_tower_project uuid;
  v_model_sin boolean;
  v_model_project uuid;
BEGIN
  NEW.canonical_unit := ventas.canonical_unit_token(NEW.canonical_unit);
  NEW.unit_token_2 := ventas.canonical_unit_token(NEW.unit_token_2);

  IF NEW.canonical_unit IS NULL THEN
    RAISE EXCEPTION 'a unit token is required';
  END IF;

  IF NEW.unit_token_2 IS NOT NULL AND NEW.unit_token_2 = NEW.canonical_unit THEN
    NEW.unit_token_2 := NULL;
  END IF;

  SELECT name INTO v_project_name
  FROM ventas.dim_project
  WHERE id = NEW.project_id;

  SELECT name, is_sin_dato, project_id
    INTO v_tower_name, v_tower_sin, v_tower_project
  FROM ventas.dim_tower
  WHERE id = NEW.tower_id;

  SELECT is_sin_dato, project_id
    INTO v_model_sin, v_model_project
  FROM ventas.dim_model
  WHERE id = NEW.model_id;

  IF v_project_name IS NULL OR v_tower_sin IS NULL OR v_model_sin IS NULL THEN
    RAISE EXCEPTION 'unit project, tower, or model is missing';
  END IF;

  IF NOT v_tower_sin AND v_tower_project <> NEW.project_id THEN
    RAISE EXCEPTION 'tower does not belong to the unit project';
  END IF;

  IF NOT v_model_sin AND v_model_project <> NEW.project_id THEN
    RAISE EXCEPTION 'model does not belong to the unit project';
  END IF;

  IF v_project_name = 'Santa Elena' AND NOT v_tower_sin THEN
    RAISE EXCEPTION 'Santa Elena has no tower';
  END IF;

  IF v_project_name IN ('Boulevard 5', 'Casa Elisa')
     AND (v_tower_sin OR v_tower_name <> 'Principal') THEN
    RAISE EXCEPTION '% uses the tower Principal', v_project_name;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER dim_unit_before
  BEFORE INSERT OR UPDATE ON ventas.dim_unit
  FOR EACH ROW
  EXECUTE FUNCTION ventas.dim_unit_before();

CREATE FUNCTION ventas.dim_deal_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
DECLARE
  v_pipeline_project uuid;
  v_sin_dato uuid;
BEGIN
  SELECT project_id INTO v_pipeline_project
  FROM ventas.dim_source_pipeline
  WHERE id = NEW.pipeline_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deal pipeline % is missing', NEW.pipeline_id;
  END IF;

  IF v_pipeline_project IS NOT NULL THEN
    IF NEW.project_id IS DISTINCT FROM v_pipeline_project THEN
      RAISE EXCEPTION 'deal project must be the pipeline building';
    END IF;
  ELSE
    SELECT id INTO v_sin_dato
    FROM ventas.dim_project
    WHERE is_sin_dato;

    IF NEW.project_id IS DISTINCT FROM v_sin_dato THEN
      RAISE EXCEPTION 'a pipeline that is not a building takes the Sin dato project';
    END IF;
  END IF;

  NEW.add_on := ventas.guatemala_day(NEW.add_time);
  NEW.add_date_id := ventas.calendar_id(NEW.add_on);

  IF NEW.lost_time IS NULL THEN
    NEW.lost_on := NULL;
    NEW.lost_date_id := NULL;
  ELSE
    NEW.lost_on := ventas.guatemala_day(NEW.lost_time);
    NEW.lost_date_id := ventas.calendar_id(NEW.lost_on);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER dim_deal_before
  BEFORE INSERT OR UPDATE ON ventas.dim_deal
  FOR EACH ROW
  EXECUTE FUNCTION ventas.dim_deal_before();

CREATE FUNCTION ventas.odoo_partner_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  NEW.canonical_unit := ventas.canonical_unit_token(NEW.canonical_unit);
  RETURN NEW;
END;
$$;

CREATE TRIGGER odoo_partner_before
  BEFORE INSERT OR UPDATE ON ventas.odoo_partner
  FOR EACH ROW
  EXECUTE FUNCTION ventas.odoo_partner_before();

CREATE FUNCTION ventas.fact_comprobante_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  NEW.comprobante_on := ventas.guatemala_day(NEW.marked_as_done_time);
  NEW.date_id := ventas.calendar_id(NEW.comprobante_on);
  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_comprobante_before
  BEFORE INSERT OR UPDATE ON ventas.fact_comprobante
  FOR EACH ROW
  EXECUTE FUNCTION ventas.fact_comprobante_before();

CREATE FUNCTION ventas.fact_recibo_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
DECLARE
  v_unit_project uuid;
  v_unit_tower uuid;
  v_unit_model uuid;
  v_unit_canonical text;
  v_unit_token_2 text;
  v_deal_project uuid;
BEGIN
  NEW.canonical_unit := ventas.canonical_unit_token(NEW.canonical_unit);

  IF NEW.published_at IS NULL THEN
    NEW.published_on := NULL;
    NEW.published_date_id := NULL;
  ELSE
    NEW.published_on := ventas.guatemala_day(NEW.published_at);
    NEW.published_date_id := ventas.calendar_id(NEW.published_on);
  END IF;

  IF NEW.fecha IS NULL THEN
    NEW.fecha_date_id := NULL;
  ELSE
    NEW.fecha_date_id := ventas.calendar_id(NEW.fecha);
  END IF;

  IF NEW.matched_deal_id IS NOT NULL THEN
    SELECT project_id, tower_id, model_id, canonical_unit, unit_token_2
      INTO v_unit_project, v_unit_tower, v_unit_model, v_unit_canonical, v_unit_token_2
    FROM ventas.dim_unit
    WHERE id = NEW.matched_unit_id;

    SELECT project_id INTO v_deal_project
    FROM ventas.dim_deal
    WHERE id = NEW.matched_deal_id;

    IF v_unit_project IS NULL OR v_deal_project IS NULL THEN
      RAISE EXCEPTION 'matched recibo deal or unit is missing';
    END IF;

    IF v_unit_project <> v_deal_project THEN
      RAISE EXCEPTION 'matched recibo deal and unit are different projects';
    END IF;

    IF v_unit_token_2 IS NOT NULL THEN
      RAISE EXCEPTION 'a unit with two nomenclatures is not a match winner';
    END IF;

    IF NEW.project_id IS NOT NULL AND NEW.project_id <> v_unit_project THEN
      RAISE EXCEPTION 'parsed project and matched unit project differ';
    END IF;

    IF NEW.tower_id IS NOT NULL AND NEW.tower_id <> v_unit_tower THEN
      RAISE EXCEPTION 'parsed tower and matched unit tower differ';
    END IF;

    IF NEW.model_id IS NOT NULL AND NEW.model_id <> v_unit_model THEN
      RAISE EXCEPTION 'parsed model and matched unit model differ';
    END IF;

    IF NEW.canonical_unit IS NOT NULL AND NEW.canonical_unit <> v_unit_canonical THEN
      RAISE EXCEPTION 'parsed unit and matched unit differ';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_recibo_before
  BEFORE INSERT OR UPDATE ON ventas.fact_recibo
  FOR EACH ROW
  EXECUTE FUNCTION ventas.fact_recibo_before();

CREATE FUNCTION ventas.fact_pcv_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
DECLARE
  v_deal_envia date;
BEGIN
  SELECT envia_pcv_on INTO v_deal_envia
  FROM ventas.dim_deal
  WHERE id = NEW.deal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PCV deal % is missing', NEW.deal_id;
  END IF;

  IF v_deal_envia IS DISTINCT FROM NEW.envia_pcv_on THEN
    RAISE EXCEPTION 'PCV envia_pcv_on must equal the deal date Envía PCV - Asesor';
  END IF;

  IF NEW.clock_is_date_only THEN
    NEW.clock_on := NEW.envia_pcv_on;
  ELSIF NEW.clock_at IS NOT NULL THEN
    NEW.clock_on := ventas.guatemala_day(NEW.clock_at);
  END IF;

  NEW.clock_date_id := ventas.calendar_id(NEW.clock_on);
  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_pcv_before
  BEFORE INSERT OR UPDATE ON ventas.fact_pcv_issuance
  FOR EACH ROW
  EXECUTE FUNCTION ventas.fact_pcv_before();

CREATE FUNCTION ventas.dim_deal_sync_pcv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  UPDATE ventas.fact_pcv_issuance
  SET envia_pcv_on = NEW.envia_pcv_on
  WHERE deal_id = NEW.id
    AND envia_pcv_on IS DISTINCT FROM NEW.envia_pcv_on;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dim_deal_sync_pcv
  AFTER UPDATE OF envia_pcv_on ON ventas.dim_deal
  FOR EACH ROW
  EXECUTE FUNCTION ventas.dim_deal_sync_pcv();

CREATE FUNCTION ventas.fact_reception_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  NEW.reception_on := ventas.guatemala_day(NEW.marked_as_done_time);
  NEW.date_id := ventas.calendar_id(NEW.reception_on);
  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_reception_before
  BEFORE INSERT OR UPDATE ON ventas.fact_reception
  FOR EACH ROW
  EXECUTE FUNCTION ventas.fact_reception_before();

CREATE FUNCTION ventas.fact_visit_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  NEW.visit_on := ventas.guatemala_day(NEW.marked_as_done_time);
  NEW.date_id := ventas.calendar_id(NEW.visit_on);
  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_visit_before
  BEFORE INSERT OR UPDATE ON ventas.fact_visit
  FOR EACH ROW
  EXECUTE FUNCTION ventas.fact_visit_before();

CREATE FUNCTION ventas.fact_inventory_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  PERFORM ventas.assert_project_currency(
    NEW.unit_id, NEW.list_price_amount, NEW.list_price_currency
  );
  NEW.date_id := ventas.calendar_id(NEW.observed_on);
  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_inventory_before
  BEFORE INSERT OR UPDATE ON ventas.fact_inventory_observation
  FOR EACH ROW
  EXECUTE FUNCTION ventas.fact_inventory_before();

CREATE FUNCTION ventas.fact_price_rise_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
DECLARE
  v_tower uuid;
  v_model uuid;
BEGIN
  SELECT tower_id, model_id INTO v_tower, v_model
  FROM ventas.dim_unit
  WHERE id = NEW.unit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'price rise unit % is missing', NEW.unit_id;
  END IF;

  IF NEW.tower_id <> v_tower OR NEW.model_id <> v_model THEN
    RAISE EXCEPTION 'price rise tower and model are the unit tower and model';
  END IF;

  PERFORM ventas.assert_project_currency(
    NEW.unit_id, NEW.new_amount, NEW.currency
  );

  NEW.date_id := ventas.calendar_id(NEW.effective_on);
  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_price_rise_before
  BEFORE INSERT OR UPDATE ON ventas.fact_price_rise
  FOR EACH ROW
  EXECUTE FUNCTION ventas.fact_price_rise_before();

CREATE FUNCTION ventas.fact_target_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  NEW.date_id := ventas.calendar_id(NEW.month_start);
  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_target_before
  BEFORE INSERT OR UPDATE ON ventas.fact_target
  FOR EACH ROW
  EXECUTE FUNCTION ventas.fact_target_before();

-- ---------------------------------------------------------------------------
-- Derived. A reload of the facts rebuilds these. They store no second date.
-- ---------------------------------------------------------------------------

CREATE VIEW ventas.v_recibo_confirmado
WITH (security_invoker = true, security_barrier = true) AS
SELECT *
FROM ventas.fact_recibo
WHERE payment_type = 'inbound'
  AND lower(btrim(move_state)) = 'posted'
  AND anulado = false;

COMMENT ON VIEW ventas.v_recibo_confirmado IS
  'Confirmado rows. Inbound, Publicado, not anulado. Not a stored sum. Unmatched rows stay here and are not sales. Outbound, cancel, and anulado rows are absent.';

CREATE VIEW ventas.v_recibo_reportado
WITH (security_invoker = true, security_barrier = true) AS
SELECT *
FROM ventas.fact_recibo
WHERE payment_type = 'inbound'
  AND anulado = false
  AND lower(btrim(coalesce(move_state, ''))) NOT IN (
    'posted', 'cancel', 'cancelled', 'cancelado'
  );

COMMENT ON VIEW ventas.v_recibo_reportado IS
  'Reportado. Borrador: inbound, not Publicado, not cancelado, not anulado. It stays on the unit receipt list and is outside Confirmado. The load stores Odoo move state draft, posted, or cancel.';

CREATE VIEW ventas.v_sale
WITH (security_invoker = true, security_barrier = true) AS
WITH posted AS (
  SELECT *
  FROM ventas.v_recibo_confirmado
  WHERE match_unresolved = false
    AND matched_deal_id IS NOT NULL
    AND matched_unit_id IS NOT NULL
),
first_gate AS (
  SELECT DISTINCT ON (matched_unit_id, matched_deal_id)
    matched_unit_id AS unit_id,
    matched_deal_id AS deal_id,
    id AS payment_id,
    published_at
  FROM posted
  ORDER BY matched_unit_id, matched_deal_id, published_at NULLS LAST, odoo_payment_id
),
second_gate AS (
  SELECT DISTINCT ON (deal_id)
    deal_id,
    id AS reception_id,
    marked_as_done_time
  FROM ventas.fact_reception
  WHERE deal_id IS NOT NULL
  ORDER BY deal_id, marked_as_done_time DESC, pipedrive_activity_id
),
confirmado AS (
  SELECT
    matched_unit_id AS unit_id,
    matched_deal_id AS deal_id,
    sum(amount_gtq) AS confirmado_gtq
  FROM posted
  GROUP BY matched_unit_id, matched_deal_id
)
SELECT
  fg.unit_id,
  fg.deal_id,
  u.project_id,
  u.tower_id,
  u.model_id,
  d.habitaciones_id,
  d.asesor_id,
  d.fuente_id,
  d.promotion_type_id,
  d.lost_reason_id,
  fg.payment_id AS first_gate_payment_id,
  fg.published_at AS first_gate_at,
  sg.reception_id AS second_gate_reception_id,
  sg.marked_as_done_time AS second_gate_at,
  CASE
    WHEN fg.published_at IS NULL THEN NULL
    ELSE GREATEST(fg.published_at, sg.marked_as_done_time)
  END AS sale_at,
  CASE
    WHEN fg.published_at IS NULL THEN NULL
    ELSE ventas.guatemala_day(GREATEST(fg.published_at, sg.marked_as_done_time))
  END AS sale_on,
  d.value_gtq,
  c.confirmado_gtq,
  d.lost_time,
  d.lost_on
FROM first_gate fg
JOIN second_gate sg ON sg.deal_id = fg.deal_id
JOIN ventas.dim_deal d ON d.id = fg.deal_id
JOIN ventas.dim_unit u ON u.id = fg.unit_id
JOIN confirmado c ON c.unit_id = fg.unit_id AND c.deal_id = fg.deal_id;

COMMENT ON VIEW ventas.v_sale IS
  'Both gates on the same unit. The first gate is the earliest matched inbound Publicado payment. Later Publicado payments add to confirmado_gtq and do not move the gate. The second gate is the latest reception on that deal. sale_at is the later of the two clocks. When the first gate has no publication clock, the sale exists and sale_on is null: sin fecha de venta, in no period. Fecha, created_at, and written_at are not used. value_gtq is deal value. Null or zero stays in the unit count as sin monto. confirmado_gtq is the sum of the matched Publicado payments on that deal and unit, including clocks outside a later period filter. A null amount is not turned into zero. Gross of a period is sale_on inside the period. While fact_recibo has no rows this view is empty, and the pages say the Odoo 15 reading is not loaded. They do not borrow the Comprobante count.';

CREATE VIEW ventas.v_desistimiento
WITH (security_invoker = true, security_barrier = true) AS
SELECT *
FROM ventas.v_sale
WHERE lost_time IS NOT NULL;

COMMENT ON VIEW ventas.v_desistimiento IS
  'A sale whose deal has lost_time. Booked on lost_time. The sale stays in the gross of sale_on. Net of the loss period is that period''s gross minus the rows whose lost_on falls in it. A lost deal that never had both gates is not here. A row with null sale_on is a sin fecha sale. It is in no gross period.';

CREATE FUNCTION ventas.fact_discount_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ventas.v_sale s WHERE s.deal_id = NEW.deal_id
  ) THEN
    RAISE EXCEPTION 'a discount is stored on a deal that is a sale';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_discount_before
  BEFORE INSERT OR UPDATE ON ventas.fact_discount
  FOR EACH ROW
  EXECUTE FUNCTION ventas.fact_discount_before();

CREATE FUNCTION ventas.fact_case_mark_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ventas.v_sale s WHERE s.deal_id = NEW.deal_id
  ) THEN
    RAISE EXCEPTION 'a case mark is stored on a deal that is a sale';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_case_mark_before
  BEFORE INSERT OR UPDATE ON ventas.fact_case_mark
  FOR EACH ROW
  EXECUTE FUNCTION ventas.fact_case_mark_before();

CREATE FUNCTION ventas.status_at(p_as_of date)
RETURNS TABLE (
  deal_id uuid,
  comprobante_id uuid,
  unit_id uuid,
  project_id uuid,
  asesor_id uuid,
  position_code text,
  position_order smallint,
  value_gtq numeric,
  lost_on date,
  has_comprobante boolean,
  has_receipt boolean,
  has_undated_receipt boolean,
  has_pcv boolean,
  has_reception boolean,
  is_lost boolean
)
LANGUAGE plpgsql
STABLE
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  IF p_as_of IS NULL THEN
    RAISE EXCEPTION 'status_at requires the end of the period';
  END IF;

  RETURN QUERY
  WITH gate_unit AS (
    SELECT DISTINCT ON (r.matched_deal_id)
      r.matched_deal_id AS deal_id,
      r.matched_unit_id AS unit_id
    FROM ventas.v_recibo_confirmado r
    WHERE r.matched_deal_id IS NOT NULL
      AND r.matched_unit_id IS NOT NULL
      AND r.match_unresolved = false
    ORDER BY r.matched_deal_id, r.published_at NULLS LAST, r.odoo_payment_id
  ),
  flags AS (
    SELECT
      d.id AS deal_id,
      COALESCE(g.unit_id, d.unit_id) AS unit_id,
      d.project_id,
      d.asesor_id,
      d.value_gtq,
      d.lost_on,
      EXISTS (
        SELECT 1
        FROM ventas.fact_comprobante c
        WHERE c.deal_id = d.id
          AND c.comprobante_on <= p_as_of
      ) AS has_comprobante,
      EXISTS (
        SELECT 1
        FROM ventas.v_recibo_confirmado r
        WHERE r.matched_deal_id = d.id
          AND r.match_unresolved = false
          AND r.published_on IS NOT NULL
          AND r.published_on <= p_as_of
      ) AS has_receipt,
      EXISTS (
        SELECT 1
        FROM ventas.v_recibo_confirmado r
        WHERE r.matched_deal_id = d.id
          AND r.match_unresolved = false
          AND r.published_at IS NULL
      ) AS has_undated_receipt,
      EXISTS (
        SELECT 1
        FROM ventas.fact_pcv_issuance p
        WHERE p.deal_id = d.id
          AND p.clock_on <= p_as_of
      ) AS has_pcv,
      EXISTS (
        SELECT 1
        FROM ventas.fact_reception rc
        WHERE rc.deal_id = d.id
          AND rc.reception_on <= p_as_of
      ) AS has_reception,
      (d.lost_on IS NOT NULL AND d.lost_on <= p_as_of) AS is_lost
    FROM ventas.dim_deal d
    LEFT JOIN gate_unit g ON g.deal_id = d.id
  ),
  positioned AS (
    SELECT
      f.deal_id,
      f.unit_id,
      f.project_id,
      f.asesor_id,
      f.value_gtq,
      f.lost_on,
      f.has_comprobante,
      f.has_receipt,
      f.has_undated_receipt,
      f.has_pcv,
      f.has_reception,
      f.is_lost,
      CASE
        WHEN f.has_undated_receipt AND NOT f.has_receipt AND f.has_reception
          THEN 'sale_date_unknown'
        WHEN f.has_receipt AND f.has_reception AND f.is_lost
          THEN 'desistida'
        WHEN f.is_lost
          THEN 'closed_without_sale'
        WHEN f.has_receipt AND f.has_reception
          THEN 'sale'
        WHEN f.has_reception AND NOT f.has_receipt AND NOT f.has_undated_receipt
          THEN 'signed_receipt_pending'
        WHEN f.has_pcv AND f.has_receipt AND NOT f.has_reception
          THEN 'pcv_and_receipt_unsigned'
        WHEN f.has_receipt AND NOT f.has_pcv AND NOT f.has_reception
          THEN 'receipt_without_pcv'
        WHEN f.has_undated_receipt AND NOT f.has_receipt AND NOT f.has_reception
          THEN 'receipt_date_unknown'
        WHEN f.has_pcv AND NOT f.has_receipt AND NOT f.has_undated_receipt
             AND NOT f.has_reception
          THEN 'pcv_without_receipt'
        WHEN f.has_comprobante AND NOT f.has_receipt AND NOT f.has_undated_receipt
             AND NOT f.has_pcv AND NOT f.has_reception AND NOT f.is_lost
          THEN 'comprobante_only'
        ELSE NULL
      END AS position_code
    FROM flags f
  )
  SELECT
    p.deal_id,
    NULL::uuid AS comprobante_id,
    p.unit_id,
    p.project_id,
    p.asesor_id,
    p.position_code,
    CASE p.position_code
      WHEN 'desistida' THEN 1
      WHEN 'closed_without_sale' THEN 2
      WHEN 'sale' THEN 3
      WHEN 'signed_receipt_pending' THEN 4
      WHEN 'pcv_and_receipt_unsigned' THEN 5
      WHEN 'receipt_without_pcv' THEN 6
      WHEN 'pcv_without_receipt' THEN 7
      WHEN 'comprobante_only' THEN 8
      WHEN 'sale_date_unknown' THEN 9
      WHEN 'receipt_date_unknown' THEN 10
      ELSE NULL
    END::smallint AS position_order,
    p.value_gtq,
    CASE WHEN p.is_lost THEN p.lost_on ELSE NULL END AS lost_on,
    p.has_comprobante,
    p.has_receipt,
    p.has_undated_receipt,
    p.has_pcv,
    p.has_reception,
    p.is_lost
  FROM positioned p
  WHERE p.position_code IS NOT NULL

  UNION ALL

  SELECT
    NULL::uuid,
    c.id,
    NULL::uuid,
    NULL::uuid,
    NULL::uuid,
    'comprobante_only',
    8::smallint,
    NULL::numeric,
    NULL::date,
    true,
    false,
    false,
    false,
    false,
    false
  FROM ventas.fact_comprobante c
  WHERE c.deal_id IS NULL
    AND c.comprobante_on <= p_as_of;
END;
$$;

COMMENT ON FUNCTION ventas.status_at(date) IS
  'Status at the end of the period. First position that fits. Codes: desistida = Desistida; closed_without_sale = Cerrada sin venta; sale = Ventas; signed_receipt_pending = Firma recibida, Recibo pendiente; pcv_and_receipt_unsigned = PCV y Recibo, sin firma; receipt_without_pcv = Recibo, sin PCV; pcv_without_receipt = PCV, sin Recibo; comprobante_only = Solo Comprobante. sale_date_unknown and receipt_date_unknown are sin fecha: a Publicado payment with no clock is not placed in a month. lost_on is set only when the loss is on or before p_as_of. A dated fact counts when its Guatemala day is on or before p_as_of. Pipedrive open, won, and lost is not a position. A Comprobante with no deal is a remainder, units only, value null.';

CREATE FUNCTION ventas.stock_at(p_as_of date)
RETURNS TABLE (
  unit_id uuid,
  project_id uuid,
  tower_id uuid,
  model_id uuid,
  habitaciones_id uuid,
  observed_on date,
  status_id uuid,
  status_name text,
  page_status text,
  vendido boolean,
  list_price_amount numeric,
  list_price_currency text
)
LANGUAGE plpgsql
STABLE
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  IF p_as_of IS NULL THEN
    RAISE EXCEPTION 'stock_at requires the end of the period';
  END IF;

  RETURN QUERY
  WITH obs AS (
    SELECT DISTINCT ON (o.unit_id)
      o.unit_id,
      o.observed_on,
      o.status_id,
      o.list_price_amount,
      o.list_price_currency
    FROM ventas.fact_inventory_observation o
    WHERE o.observed_on <= p_as_of
    ORDER BY o.unit_id, o.observed_on DESC
  )
  SELECT
    obs.unit_id,
    u.project_id,
    u.tower_id,
    u.model_id,
    u.habitaciones_id,
    obs.observed_on,
    obs.status_id,
    st.name AS status_name,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM ventas.v_sale s
        WHERE s.unit_id = obs.unit_id
          AND s.sale_on IS NOT NULL
          AND s.sale_on <= p_as_of
          AND (s.lost_on IS NULL OR s.lost_on > p_as_of)
      ) THEN 'Vendido'
      ELSE st.name
    END AS page_status,
    EXISTS (
      SELECT 1
      FROM ventas.v_sale s
      WHERE s.unit_id = obs.unit_id
        AND s.sale_on IS NOT NULL
        AND s.sale_on <= p_as_of
        AND (s.lost_on IS NULL OR s.lost_on > p_as_of)
    ) AS vendido,
    obs.list_price_amount,
    obs.list_price_currency
  FROM obs
  JOIN ventas.dim_unit u ON u.id = obs.unit_id
  JOIN ventas.dim_unit_status st ON st.id = obs.status_id;
END;
$$;

COMMENT ON FUNCTION ventas.stock_at(date) IS
  'Latest inventory observation on or before the date. page_status is Vendido only when the unit has a two-gate sale on or before that date and the deal is not already lost. A null sale date is not Vendido. PCV, Promesa, and Vendido en archivo stay their own labels and are not folded into Disponible. Congelado and En revisión stay their own labels. list_price_currency is GTQ or USD. This function does not add dollars into a quetzales total. No observation means no row. An empty result is not No hay datos en PipeDrive.';

-- ---------------------------------------------------------------------------
-- Read access. The three roles may select. They may not write.
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
    WHERE n.nspname = 'ventas'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'ALTER TABLE ventas.%I ENABLE ROW LEVEL SECURITY',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY ventas_select ON ventas.%I FOR SELECT TO authenticated USING (public.jwt_role() IN (''master'', ''torredecontrol'', ''gerencia''))',
      v_table
    );
  END LOOP;
END
$rls$;

REVOKE ALL ON SCHEMA ventas FROM PUBLIC;
GRANT USAGE ON SCHEMA ventas TO authenticator, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA ventas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ventas TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA ventas FROM authenticated, anon, PUBLIC;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ventas FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ventas TO service_role;
GRANT EXECUTE ON FUNCTION
  ventas.guatemala_day(timestamptz),
  ventas.canonical_unit_token(text),
  ventas.status_at(date),
  ventas.stock_at(date)
  TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA ventas
  GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA ventas
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- ---------------------------------------------------------------------------
-- Structural members. Not business facts.
-- Sin dato on every text dimension. The five buildings and the starting
-- pipeline map. Principal only where the spec names that tower.
-- 1H, 2H, 3H. The workbook statuses and their word map.
-- Discount types and case types: Sin dato only.
-- ---------------------------------------------------------------------------

INSERT INTO ventas.dim_project (id, name, is_sin_dato) VALUES
  (uuid_v7(), 'Sin dato', true),
  (uuid_v7(), 'Benestare', false),
  (uuid_v7(), 'Bosque Las Tapias', false),
  (uuid_v7(), 'Boulevard 5', false),
  (uuid_v7(), 'Santa Elena', false),
  (uuid_v7(), 'Casa Elisa', false);

INSERT INTO ventas.dim_source_pipeline (id, name, project_id, is_sin_dato)
SELECT uuid_v7(), v.pipeline_name, p.id, false
FROM (
  VALUES
    ('Benestare', 'Benestare'),
    ('Créditos Benestare', 'Benestare'),
    ('Bosque Las Tapias', 'Bosque Las Tapias'),
    ('Créditos BLT', 'Bosque Las Tapias'),
    ('Boulevard5', 'Boulevard 5'),
    ('Créditos BLV5', 'Boulevard 5'),
    ('Santa Elena', 'Santa Elena'),
    ('Casa Elisa', 'Casa Elisa')
) AS v(pipeline_name, project_name)
JOIN ventas.dim_project p ON p.name = v.project_name;

INSERT INTO ventas.dim_source_pipeline (id, name, project_id, is_sin_dato) VALUES
  (uuid_v7(), 'Sin dato', NULL, true),
  (uuid_v7(), 'Eventos', NULL, false),
  (uuid_v7(), 'Marketing & Sales PAI', NULL, false);

INSERT INTO ventas.dim_tower (id, project_id, name, is_sin_dato)
SELECT uuid_v7(), p.id, 'Sin dato', true
FROM ventas.dim_project p
WHERE p.is_sin_dato;

INSERT INTO ventas.dim_tower (id, project_id, name, is_sin_dato)
SELECT uuid_v7(), p.id, 'Principal', false
FROM ventas.dim_project p
WHERE p.name IN ('Boulevard 5', 'Casa Elisa');

INSERT INTO ventas.dim_model (id, project_id, name, is_sin_dato)
SELECT uuid_v7(), p.id, 'Sin dato', true
FROM ventas.dim_project p
WHERE p.is_sin_dato;

INSERT INTO ventas.dim_habitaciones (id, name, is_sin_dato) VALUES
  (uuid_v7(), 'Sin dato', true),
  (uuid_v7(), '1H', false),
  (uuid_v7(), '2H', false),
  (uuid_v7(), '3H', false);

INSERT INTO ventas.dim_asesor (id, source_user_id, name, is_sin_dato)
VALUES (uuid_v7(), 'sin_dato', 'Sin dato', true);

INSERT INTO ventas.dim_fuente (id, name, is_sin_dato)
VALUES (uuid_v7(), 'Sin dato', true);

INSERT INTO ventas.dim_promotion_type (id, name, is_sin_dato)
VALUES (uuid_v7(), 'Sin dato', true);

INSERT INTO ventas.dim_discount_type (id, name, is_sin_dato)
VALUES (uuid_v7(), 'Sin dato', true);

INSERT INTO ventas.dim_case_type (id, name, is_sin_dato)
VALUES (uuid_v7(), 'Sin dato', true);

INSERT INTO ventas.dim_lost_reason (id, name, is_sin_dato)
VALUES (uuid_v7(), 'Sin dato', true);

INSERT INTO ventas.dim_unit_status (id, name, is_sin_dato) VALUES
  (uuid_v7(), 'Sin dato', true),
  (uuid_v7(), 'Disponible', false),
  (uuid_v7(), 'Reservado', false),
  (uuid_v7(), 'Congelado', false),
  (uuid_v7(), 'PCV', false),
  (uuid_v7(), 'Promesa', false),
  (uuid_v7(), 'Vendido en archivo', false),
  (uuid_v7(), 'En revisión', false);

INSERT INTO ventas.unit_status_word (word, status_id)
SELECT v.word, s.id
FROM (
  VALUES
    ('disponible', 'Disponible'),
    ('liberado', 'Disponible'),
    ('reservado', 'Reservado'),
    ('reservada', 'Reservado'),
    ('congelado', 'Congelado'),
    ('congelado junta directiva', 'Congelado'),
    ('pcv', 'PCV'),
    ('promesa', 'Promesa'),
    ('vendido', 'Vendido en archivo')
) AS v(word, status_name)
JOIN ventas.dim_unit_status s ON s.name = v.status_name;

DO $seed_check$
DECLARE
  v_projects integer;
  v_pipelines integer;
  v_words integer;
  v_facts integer;
  v_santa_elena_towers integer;
  v_discount_types integer;
  v_case_types integer;
BEGIN
  SELECT count(*) INTO v_projects FROM ventas.dim_project;
  SELECT count(*) INTO v_pipelines FROM ventas.dim_source_pipeline;
  SELECT count(*) INTO v_words FROM ventas.unit_status_word;
  SELECT count(*) INTO v_discount_types FROM ventas.dim_discount_type;
  SELECT count(*) INTO v_case_types FROM ventas.dim_case_type;

  SELECT
    (SELECT count(*) FROM ventas.fact_comprobante)
    + (SELECT count(*) FROM ventas.fact_recibo)
    + (SELECT count(*) FROM ventas.fact_pcv_issuance)
    + (SELECT count(*) FROM ventas.fact_reception)
    + (SELECT count(*) FROM ventas.fact_visit)
    + (SELECT count(*) FROM ventas.fact_inventory_observation)
    + (SELECT count(*) FROM ventas.fact_price_rise)
    + (SELECT count(*) FROM ventas.fact_discount)
    + (SELECT count(*) FROM ventas.fact_case_mark)
    + (SELECT count(*) FROM ventas.fact_target)
  INTO v_facts;

  SELECT count(*) INTO v_santa_elena_towers
  FROM ventas.dim_tower t
  JOIN ventas.dim_project p ON p.id = t.project_id
  WHERE p.name = 'Santa Elena';

  IF v_projects <> 6
     OR v_pipelines <> 11
     OR v_words <> 9
     OR v_discount_types <> 1
     OR v_case_types <> 1
     OR v_facts <> 0
     OR v_santa_elena_towers <> 0 THEN
    RAISE EXCEPTION
      'ventas seed check failed: projects %, pipelines %, words %, discounts %, cases %, facts %, santa elena towers %',
      v_projects, v_pipelines, v_words, v_discount_types, v_case_types, v_facts, v_santa_elena_towers;
  END IF;
END
$seed_check$;

NOTIFY pgrst, 'reload schema';

SELECT check_name, detail
FROM (
  SELECT 1 AS ord, 'projects'::text AS check_name,
    string_agg(name, ', ' ORDER BY name) AS detail
  FROM ventas.dim_project
  UNION ALL
  SELECT 2, 'pipelines', string_agg(name, ', ' ORDER BY name)
  FROM ventas.dim_source_pipeline
  UNION ALL
  SELECT 3, 'towers', string_agg(p.name || ' / ' || t.name, ', ' ORDER BY p.name, t.name)
  FROM ventas.dim_tower t
  JOIN ventas.dim_project p ON p.id = t.project_id
  UNION ALL
  SELECT 4, 'unit statuses', string_agg(name, ', ' ORDER BY name)
  FROM ventas.dim_unit_status
  UNION ALL
  SELECT 5, 'habitaciones', string_agg(name, ', ' ORDER BY name)
  FROM ventas.dim_habitaciones
  UNION ALL
  SELECT 6, 'discount types', string_agg(name, ', ' ORDER BY name)
  FROM ventas.dim_discount_type
  UNION ALL
  SELECT 7, 'case types', string_agg(name, ', ' ORDER BY name)
  FROM ventas.dim_case_type
  UNION ALL
  SELECT 8, 'fact rows', '0'
) checks
ORDER BY ord;
