-- ============================================================================
-- Migration 082: schema cobros
-- ============================================================================
-- The store for the twelve Cobros pages.
-- Contract: COBROS_PAI_BIS_ODOO15_MAP_2026-11-02.md (Odoo 15 archive,
-- run 20261102T184027Z, cutoff 2026-11-02 12:00:00 America/Guatemala,
-- exclusive). This file does not invent analytic accounts, reason codes,
-- refunds, alert rows, or a Santa Elena / Casa Elisa book.
--
-- Run by hand, in the Supabase SQL editor, in this order:
--   1. This file (082).
--   2. 083_cobros_load_partners.sql
--   3. 084_cobros_load_receipts_*.sql, in the numeric suffix order
--   4. 085_cobros_load_01_units.sql, then 085_cobros_load_02_months_*.sql
--   5. 086_cobros_load_check.sql  (raises if the loaded book disagrees
--      with the mapping's published totals)
--
-- After 082 commits:
--   Project Settings → Data API → Exposed schemas: add cobros,
--   the same way ventas is exposed. NOTIFY reloads PostgREST. It does
--   not add the schema to the exposed list by itself.
--
-- This file does not drop ventas, mercadeo, reservations, or public.
-- Fact tables stay empty until the load files run. The five project
-- rows and the three plan-file headers are structural, not cash.
--
-- Primary keys are UUID v7 via uuid_v7(). No key uses gen_random_uuid().
--
-- Rollback is the commented block at the bottom. Do not paste it with
-- this migration.
-- ============================================================================

DO $pre$
BEGIN
  IF to_regprocedure('uuid_v7()') IS NULL THEN
    RAISE EXCEPTION
      'uuid_v7() is not installed. Refusing to create cobros keys with gen_random_uuid(), which is a v4.';
  END IF;

  IF to_regprocedure('public.jwt_role()') IS NULL THEN
    RAISE EXCEPTION
      'public.jwt_role() is missing. Migration 040 has to be applied first.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cobros') THEN
    RAISE EXCEPTION
      'schema cobros already exists. To rebuild: uncomment the rollback at the bottom of this file, run that statement alone, then paste this file again.';
  END IF;
END
$pre$;

CREATE SCHEMA cobros;

COMMENT ON SCHEMA cobros IS
  'Posted customer receipts from the Odoo 15 archive (cutoff 2026-11-02 12:00 America/Guatemala, exclusive; run 20261102T184027Z). A cobro is inbound, partner_type customer, anulado false, move state posted, not an internal transfer. The date is account.move.date. The amount stays in account.payment.currency. Project is the prefix on res.partner.name, not an analytic account. Déficit and superávit are not Odoo fields: they are the frozen enganche plans loaded beside this book. Santa Elena and Casa Elisa have no unit partners and no receipts.';

-- ---------------------------------------------------------------------------
-- Projects. The five names the pages use, plus the two books that must
-- stay out of those totals: Antigua Panorama (01-) and receipts whose
-- partner name matches no prefix.
-- ---------------------------------------------------------------------------

CREATE TABLE cobros.project (
  slug text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  in_five boolean NOT NULL,
  has_unit_book boolean NOT NULL,
  company_odoo_id integer,
  company_name text,
  sort_order integer NOT NULL
);

COMMENT ON TABLE cobros.project IS
  'Page projects. has_unit_book false means Santa Elena or Casa Elisa: the archive has no unit partners and no receipts. A query must not turn that into a measured zero. in_five false is Antigua Panorama or an unassigned receipt. Company is the check on the prefix, not the definition of the project.';

COMMENT ON COLUMN cobros.project.has_unit_book IS
  'False only for Santa Elena and Casa Elisa. Those rows exist so the pages can say sin datos en Odoo 15.';

INSERT INTO cobros.project (slug, name, in_five, has_unit_book, company_odoo_id, company_name, sort_order) VALUES
  ('boulevard-5', 'Boulevard 5', true, true, 56, 'INMOBILIARIA EL GRAN JAGUAR, S.A.', 1),
  ('benestare', 'Benestare', true, true, 55, 'INMOBILIARIA CHINAUTLA', 2),
  ('bosque-las-tapias', 'Bosque Las Tapias', true, true, 79, 'INVERSIONES DE CASTILLA, SOCIEDAD ANONIMA', 3),
  ('santa-elena', 'Santa Elena', true, false, NULL, NULL, 4),
  ('casa-elisa', 'Casa Elisa', true, false, NULL, NULL, 5),
  ('antigua-panorama', 'Antigua Panorama', false, true, 72, 'CONDOMINIO ANTIGUA PANORAMA, S.A.', 6),
  ('sin-asignar', 'Sin asignar', false, false, NULL, NULL, 7);

-- ---------------------------------------------------------------------------
-- Partner name grammar. One function, so the load and the views cannot
-- drift. Prefixes and the DS- splices are the ones the mapping measured.
-- ---------------------------------------------------------------------------

CREATE TYPE cobros.partner_parts AS (
  project_slug text,
  prefix_family text,
  tower text,
  modelo text,
  apt text,
  buyer_name text,
  is_desistimiento boolean,
  co_buyer boolean,
  gv1 boolean
);

CREATE FUNCTION cobros.parse_partner(p_name text)
RETURNS cobros.partner_parts
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  raw text := btrim(coalesce(p_name, ''));
  body text;
  rest text;
  m text[];
  tail text;
  buyer text;
  parts cobros.partner_parts;
BEGIN
  -- DS- at the start, plus the two older splices the mapping names.
  -- A DS- inside a buyer name is not a marker.
  parts.is_desistimiento :=
    raw LIKE 'DS-%'
    OR raw LIKE '%02-DS-%'
    OR position('02-04DS-' IN raw) > 0;
  parts.co_buyer := position('/' IN raw) > 0;
  parts.gv1 := position('GV1' IN raw) > 0;

  body := CASE WHEN raw LIKE 'DS-%' THEN substr(raw, 4) ELSE raw END;

  IF body LIKE 'CD-02-%' THEN
    parts.prefix_family := 'cd-02';
    parts.project_slug := 'boulevard-5';
    rest := substr(body, 4);
  ELSIF body LIKE '02-%' THEN
    parts.prefix_family := '02';
    parts.project_slug := 'boulevard-5';
    rest := body;
  ELSIF body LIKE 'BNT-%' THEN
    parts.prefix_family := 'bnt';
    parts.project_slug := 'benestare';
  ELSIF body LIKE '03-%' THEN
    parts.prefix_family := '03';
    parts.project_slug := 'benestare';
  ELSIF body ~ '^C-[0-9]+-[0-9]+' THEN
    parts.prefix_family := 'c';
    parts.project_slug := 'bosque-las-tapias';
  ELSIF body LIKE 'BLT-%' THEN
    parts.prefix_family := 'blt';
    parts.project_slug := 'bosque-las-tapias';
  ELSIF body LIKE '01-%' THEN
    parts.prefix_family := '01';
    parts.project_slug := 'antigua-panorama';
  ELSE
    parts.prefix_family := 'none';
    parts.project_slug := 'sin-asignar';
  END IF;

  IF parts.prefix_family IN ('02', 'cd-02') THEN
    -- 02-<apto 4 digits>-<modelo>-<seq>-<buyer>. No tower.
    -- CD-02- is the same shape after the CD- prefix. A name that does
    -- not match (the 02-04DS- splice) stays on the project with null parts.
    m := regexp_match(rest, '^02-([0-9]{4})-([^-]+)(?:-(.*))?$');
    IF m IS NOT NULL THEN
      parts.apt := m[1];
      parts.modelo := m[2];
      tail := m[3];
      IF tail IS NOT NULL THEN
        IF tail ~ '^[0-9]+-' THEN
          buyer := btrim(regexp_replace(tail, '^[0-9]+-', ''));
        ELSIF tail ~ '^[0-9]+$' THEN
          buyer := NULL;
        ELSE
          buyer := btrim(tail);
        END IF;
        IF buyer = '' THEN
          buyer := NULL;
        END IF;
        parts.buyer_name := buyer;
      END IF;
    END IF;
  ELSIF parts.prefix_family = 'bnt' THEN
    -- BNT-<apto>-<MA|MB|MC>-<TA|TB|TC|TD>-<buyer>
    m := regexp_match(body, '^BNT-([^-]+)-([^-]+)-(TA|TB|TC|TD)[- ]?(.*)$');
    IF m IS NOT NULL THEN
      parts.apt := m[1];
      parts.modelo := m[2];
      parts.tower := CASE m[3]
        WHEN 'TA' THEN 'Torre A'
        WHEN 'TB' THEN 'Torre B'
        WHEN 'TC' THEN 'Torre C'
        WHEN 'TD' THEN 'Torre D'
        ELSE NULL
      END;
      IF m[4] IS NOT NULL AND btrim(m[4]) <> '' THEN
        parts.buyer_name := btrim(m[4]);
      END IF;
    END IF;
  ELSIF parts.prefix_family = '03' THEN
    -- 03-<tower>-<apto>-<modelo>-...
    m := regexp_match(body, '^03-(TA|TB|TC|TD)-([^-]+)-([^-]*)(?:-(.*))?$');
    IF m IS NOT NULL THEN
      parts.tower := CASE m[1]
        WHEN 'TA' THEN 'Torre A'
        WHEN 'TB' THEN 'Torre B'
        WHEN 'TC' THEN 'Torre C'
        WHEN 'TD' THEN 'Torre D'
        ELSE NULL
      END;
      parts.apt := m[2];
      IF m[3] IS NOT NULL AND btrim(m[3]) <> '' THEN
        parts.modelo := btrim(m[3]);
      END IF;
      tail := m[4];
      IF tail IS NOT NULL AND btrim(tail) <> '' AND tail !~ '^[0-9]+$' THEN
        parts.buyer_name := btrim(tail);
      END IF;
    END IF;
  ELSIF parts.prefix_family = 'c' THEN
    -- C-<nivel>-<apto>-<modelo>. Torre C. Torre A has no partners.
    -- C-IMPRIME does not match the digit pattern and is not this project.
    m := regexp_match(body, '^C-([0-9]+)-([0-9]+)-(.*)$');
    IF m IS NOT NULL THEN
      parts.tower := 'Torre C';
      parts.apt := m[2];
      IF m[3] IS NOT NULL AND btrim(m[3]) <> '' THEN
        parts.modelo := btrim(m[3]);
      END IF;
    END IF;
  ELSIF parts.prefix_family = 'blt' THEN
    -- BLT- <apto>-<MA|MB|MC>-TB. Torre B. The space after BLT- is real.
    m := regexp_match(body, '^BLT-\s*([0-9]+)-([^-]+)-TB\s*-?\s*(.*)$');
    IF m IS NOT NULL THEN
      parts.tower := 'Torre B';
      parts.apt := m[1];
      parts.modelo := m[2];
      IF m[3] IS NOT NULL AND btrim(m[3]) <> '' THEN
        parts.buyer_name := btrim(m[3]);
      END IF;
    END IF;
  END IF;

  RETURN parts;
END;
$fn$;

COMMENT ON FUNCTION cobros.parse_partner(text) IS
  'Project, tower, modelo, apartment, and the DS- mark, read from res.partner.name. Boulevard 5 is 02- and CD-02- (no tower). Benestare is BNT- and 03-. Bosque Las Tapias is C- (Torre C) and BLT- (Torre B). 01- is Antigua Panorama and is outside the five projects. Anything else is sin-asignar, including the two Gran Jaguar receipts the mapping leaves unmatched. Santa Elena and Casa Elisa are never returned: they have no unit names. DS- at the start, the splice 02-DS-, and the splice 02-04DS- are the desistimiento mark. The rename does not move receipts.';

-- ---------------------------------------------------------------------------
-- Partners and receipts. Raw Odoo fields. The views classify the name.
-- ---------------------------------------------------------------------------

CREATE TABLE cobros.partner (
  id uuid PRIMARY KEY DEFAULT uuid_v7(),
  odoo_partner_id bigint NOT NULL UNIQUE,
  name text NOT NULL,
  write_at timestamptz,
  CONSTRAINT partner_name_present CHECK (btrim(name) <> '')
);

COMMENT ON TABLE cobros.partner IS
  'Unit partners and any other partner that owns a loaded receipt. write_at is res.partner.write_date stored as UTC. It is the last edit of the partner, not the date a desistimiento was decided.';

COMMENT ON COLUMN cobros.partner.write_at IS
  'Naive UTC write_date from Odoo, stored as timestamptz. Not a decision date.';

CREATE TABLE cobros.receipt (
  id uuid PRIMARY KEY DEFAULT uuid_v7(),
  odoo_payment_id bigint NOT NULL UNIQUE,
  odoo_move_id bigint,
  odoo_partner_id bigint REFERENCES cobros.partner (odoo_partner_id),
  partner_name text NOT NULL,
  lane text NOT NULL,
  payment_type text NOT NULL,
  partner_type text NOT NULL,
  anulado boolean NOT NULL,
  is_internal_transfer boolean NOT NULL,
  is_matched boolean,
  is_reconciled boolean,
  amount numeric(18, 2) NOT NULL,
  currency text NOT NULL,
  debit_gtq numeric(18, 2),
  move_date date,
  move_state text,
  move_type text,
  company_odoo_id integer,
  company_name text,
  journal_odoo_id integer,
  journal_name text,
  descripcion text,
  x_no_recibo text,
  fecha_anulacion date,
  CONSTRAINT receipt_name_present CHECK (btrim(partner_name) <> ''),
  CONSTRAINT receipt_lane CHECK (lane IN ('customer', 'cesion_proveedor')),
  CONSTRAINT receipt_currency CHECK (currency ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE cobros.receipt IS
  'Customer account.payment rows, plus the two vendor payments whose description is CESION DE DERECHO. Those two are lane cesion_proveedor and are not cobros. Vendor outbound payments are not loaded. debit_gtq is the sum of account.move.line.debit on the payment move. For a GTQ receipt it equals amount. For a USD receipt it is the quetzales the company booked. Do not add a USD amount to a GTQ amount. The GTQ series the pages sum is amount where currency = GTQ. debit_gtq on a USD row is a second figure, labeled as quetzales of the journal entry.';

COMMENT ON COLUMN cobros.receipt.move_date IS
  'account.move.date. The payment has no date of its own. Period filters use this calendar date. Timezone America/Guatemala does not shift it: it is already a date.';

COMMENT ON COLUMN cobros.receipt.debit_gtq IS
  'Sum of debit on the payment move. Company currency is GTQ. Not a license to add USD amount into the GTQ total.';

COMMENT ON COLUMN cobros.receipt.lane IS
  'customer: partner_type customer. cesion_proveedor: the two outbound vendor payments that mention CESION DE DERECHO. Not a cesión object on the buyer receipt.';

CREATE INDEX receipt_move_date_idx ON cobros.receipt (move_date);
CREATE INDEX receipt_partner_idx ON cobros.receipt (odoo_partner_id);
CREATE INDEX receipt_state_idx ON cobros.receipt (move_state, anulado, payment_type);

-- ---------------------------------------------------------------------------
-- Frozen enganche plans. Built 2026-10-01. Not an Odoo field.
-- balance on the unit row is the file's own balance:
--   Boulevard 5: whole plan versus all cash, because as_of is null.
--   Benestare and Tapias: cut at 2026-10.
-- A page that means "as of a month" recomputes cum_expected - cum_confirmed
-- from plan_month and ignores the stored balance for that question.
-- Months before 2020-01 are bad OCR on Boulevard 5 and stay in the table
-- with ocr_garbage true. v_plan_mes hides them.
-- ---------------------------------------------------------------------------

CREATE TABLE cobros.plan_file (
  project_slug text PRIMARY KEY REFERENCES cobros.project (slug),
  source_file text NOT NULL,
  built_on date NOT NULL,
  as_of text,
  balance_scope text NOT NULL,
  note text NOT NULL,
  expected_to_date_total numeric(18, 2),
  confirmed_to_date_total numeric(18, 2),
  collection_rate numeric(18, 6),
  reportado_total numeric(18, 2),
  cash_without_plan numeric(18, 2),
  n_units integer,
  n_with_plan integer
);

COMMENT ON TABLE cobros.plan_file IS
  'Header of the three plan JSON files. built_on is 2026-10-01. The files are older than the 2026-11-02 receipt cutoff: cash posted after 2026-10-01 is in cobros.receipt and absent from confirmed_to_date. Expected is the OCR PLAN DE CUOTAS reconciled to the enganche, not to the sale price and not to a budget. Santa Elena and Casa Elisa have no file.';

INSERT INTO cobros.plan_file (project_slug, source_file, built_on, as_of, balance_scope, note) VALUES
  (
    'boulevard-5',
    'reports/plan_vs_actual_b5.json',
    DATE '2026-10-01',
    NULL,
    'plan_completo',
    'as_of is null. The stored balance compares the whole enganche plan, including future cuotas, with all cash then on file. A monthly cut is recomputed from plan_month. Months before 2020-01 are bad OCR and v_plan_mes drops them. Coverage on live planned units is ahead of the enganche (collection_rate 1.6369 in the file) because buyers keep paying after the enganche is covered.'
  ),
  (
    'benestare',
    'reports/plan_vs_actual_benestare.json',
    DATE '2026-10-01',
    '2026-10',
    'al_2026-10',
    'as_of 2026-10. Stored balance is that cut. Coverage confirmed includes cash on units with no plan; a déficit chart uses only has_plan and keeps brecha (paying, no plan) as its own row with no déficit number. duplicado rows are shadow partners and stay out of the totals.'
  ),
  (
    'bosque-las-tapias',
    'reports/plan_vs_actual_tapias.json',
    DATE '2026-10-01',
    '2026-10',
    'al_2026-10',
    'as_of 2026-10. Same subtraction as Benestare. preventa has neither plan nor payments. Torre A has no partners. duplicado rows stay out of the totals.'
  );

CREATE TABLE cobros.plan_unit (
  id uuid PRIMARY KEY DEFAULT uuid_v7(),
  project_slug text NOT NULL REFERENCES cobros.project (slug),
  odoo_partner_id bigint NOT NULL,
  raw_name text NOT NULL,
  apt text,
  modelo text,
  tower text,
  buyer_name text,
  population text,
  status text,
  commercial_state text,
  has_plan boolean NOT NULL,
  plan_confidence text,
  n_cuotas integer,
  cuota_typical numeric(18, 2),
  expected_to_date numeric(18, 2),
  confirmed_to_date numeric(18, 2),
  reported_to_date numeric(18, 2),
  balance numeric(18, 2),
  collection_rate numeric(18, 6),
  months_behind numeric(18, 4),
  n_payments integer,
  last_receipt_on date,
  flags text[] NOT NULL DEFAULT '{}',
  UNIQUE (project_slug, odoo_partner_id)
);

COMMENT ON TABLE cobros.plan_unit IS
  'One partner in a plan JSON file, not one apartment. CD-02- and 02-, and BNT- and 03-, stay on their own partner_id. balance = expected_to_date - confirmed_to_date as the file stored it. Positive is short of the plan. Negative is ahead. Boulevard 5 stored balance is the full plan. Benestare and Tapias are as of 2026-10. months_behind is the file''s own figure: Boulevard 5 uses balance / typical cuota when balance > 0; the other two count due months whose cumulative expected is not covered. Neither number exists in Odoo. commercial_state brecha is paying without a parsed plan, not a measured deficit. duplicado is a shadow partner.';

COMMENT ON COLUMN cobros.plan_unit.balance IS
  'File balance. Positive = short. Negative = ahead. Not invoice amount_residual. Not a 2022 budget variance.';

COMMENT ON COLUMN cobros.plan_unit.months_behind IS
  'The file''s figure, not recomputed for the page period. Boulevard 5 and the other two projects do not use the same formula.';

COMMENT ON COLUMN cobros.plan_unit.last_receipt_on IS
  'Latest receipts[].date in the plan file with estado publicado. Frozen with the file. The live book is cobros.v_cobro.';

CREATE TABLE cobros.plan_month (
  project_slug text NOT NULL,
  odoo_partner_id bigint NOT NULL,
  month_on date NOT NULL,
  expected numeric(18, 2) NOT NULL,
  reported numeric(18, 2) NOT NULL,
  confirmed numeric(18, 2) NOT NULL,
  cum_expected numeric(18, 2) NOT NULL,
  cum_reported numeric(18, 2) NOT NULL,
  cum_confirmed numeric(18, 2) NOT NULL,
  ocr_garbage boolean NOT NULL,
  PRIMARY KEY (project_slug, odoo_partner_id, month_on),
  FOREIGN KEY (project_slug, odoo_partner_id)
    REFERENCES cobros.plan_unit (project_slug, odoo_partner_id)
);

COMMENT ON TABLE cobros.plan_month IS
  'monthly[] from the plan JSON. expected is the enganche cuota of that month, not the sale price. confirmed is posted cash the file had matched to that partner at build time. reported is the draft receipt in the file. ocr_garbage marks Boulevard 5 months before 2020-01. Future months are the remaining schedule and are real.';

CREATE INDEX plan_month_cut_idx ON cobros.plan_month (project_slug, month_on) WHERE NOT ocr_garbage;

-- ---------------------------------------------------------------------------
-- Views. security_invoker so RLS on the tables applies. The app reads
-- them with the service role, which bypasses RLS, same as ventas.
-- ---------------------------------------------------------------------------

CREATE VIEW cobros.v_partner
WITH (security_invoker = true) AS
SELECT
  partner.id,
  partner.odoo_partner_id,
  partner.name,
  partner.write_at,
  (partner.write_at AT TIME ZONE 'UTC')::date AS write_on_utc,
  parts.project_slug,
  project.name AS project_name,
  project.in_five,
  project.has_unit_book,
  parts.prefix_family,
  parts.tower,
  parts.modelo,
  parts.apt,
  parts.buyer_name,
  parts.is_desistimiento,
  parts.co_buyer,
  parts.gv1
FROM cobros.partner AS partner
CROSS JOIN LATERAL cobros.parse_partner(partner.name) AS parts
JOIN cobros.project AS project ON project.slug = parts.project_slug;

COMMENT ON VIEW cobros.v_partner IS
  'Partner name parsed once. write_on_utc is the UTC calendar day of write_at, matching the mapping''s month counts of write_date. It is not America/Guatemala and it is not a decision date.';

CREATE VIEW cobros.v_cobro
WITH (security_invoker = true) AS
SELECT
  receipt.id,
  receipt.odoo_payment_id,
  receipt.odoo_move_id,
  receipt.odoo_partner_id,
  receipt.partner_name,
  parts.project_slug,
  project.name AS project_name,
  project.in_five,
  project.has_unit_book,
  parts.prefix_family,
  parts.tower,
  parts.modelo,
  parts.apt,
  parts.buyer_name,
  parts.is_desistimiento,
  parts.co_buyer,
  parts.gv1,
  receipt.currency,
  receipt.amount,
  receipt.debit_gtq,
  receipt.move_date,
  to_char(receipt.move_date, 'YYYY-MM') AS move_month,
  receipt.company_odoo_id,
  receipt.company_name,
  CASE parts.project_slug
    WHEN 'boulevard-5' THEN receipt.company_odoo_id = 56
    WHEN 'benestare' THEN receipt.company_odoo_id = 55
    WHEN 'bosque-las-tapias' THEN receipt.company_odoo_id = 79
    WHEN 'antigua-panorama' THEN receipt.company_odoo_id = 72
    ELSE NULL
  END AS company_agrees,
  receipt.journal_odoo_id,
  receipt.journal_name,
  receipt.descripcion,
  receipt.x_no_recibo,
  receipt.is_matched,
  receipt.is_reconciled
FROM cobros.receipt AS receipt
CROSS JOIN LATERAL cobros.parse_partner(receipt.partner_name) AS parts
JOIN cobros.project AS project ON project.slug = parts.project_slug
WHERE receipt.lane = 'customer'
  AND receipt.payment_type = 'inbound'
  AND receipt.partner_type = 'customer'
  AND receipt.anulado = false
  AND receipt.move_state = 'posted'
  AND receipt.is_internal_transfer = false;

COMMENT ON VIEW cobros.v_cobro IS
  'The cobro population. inbound, customer, anulado false, move posted, not an internal transfer. One account.payment per row. Date is account.move.date. Amount is account.payment.amount in its own currency. GTQ and USD are both here and must not be added. Antigua Panorama and sin-asignar are in this view; the five-project pages filter in_five. Santa Elena and Casa Elisa contribute no rows. Drafts, anulado, and cancel are in v_recibo_fuera.';

CREATE VIEW cobros.v_recibo_fuera
WITH (security_invoker = true) AS
SELECT
  receipt.id,
  receipt.odoo_payment_id,
  receipt.odoo_partner_id,
  receipt.partner_name,
  parts.project_slug,
  project.name AS project_name,
  parts.prefix_family,
  parts.is_desistimiento,
  receipt.currency,
  receipt.amount,
  receipt.debit_gtq,
  receipt.move_date,
  receipt.move_state,
  receipt.journal_name,
  receipt.descripcion,
  receipt.fecha_anulacion,
  receipt.company_name,
  CASE
    WHEN receipt.lane = 'cesion_proveedor' THEN 'cesion_proveedor'
    WHEN receipt.anulado THEN 'anulado'
    WHEN receipt.partner_type = 'customer' AND receipt.payment_type = 'outbound' THEN 'salida_cliente'
    WHEN receipt.partner_type = 'customer'
      AND receipt.payment_type = 'inbound'
      AND receipt.move_state = 'cancel' THEN 'cancel'
    WHEN receipt.partner_type = 'customer'
      AND receipt.payment_type = 'inbound'
      AND receipt.anulado = false
      AND receipt.is_internal_transfer = false
      AND receipt.move_state = 'draft' THEN 'reportado'
    ELSE 'otro'
  END AS clase
FROM cobros.receipt AS receipt
CROSS JOIN LATERAL cobros.parse_partner(receipt.partner_name) AS parts
JOIN cobros.project AS project ON project.slug = parts.project_slug
WHERE NOT (
  receipt.lane = 'customer'
  AND receipt.payment_type = 'inbound'
  AND receipt.partner_type = 'customer'
  AND receipt.anulado = false
  AND receipt.move_state = 'posted'
  AND receipt.is_internal_transfer = false
);

COMMENT ON VIEW cobros.v_recibo_fuera IS
  'Receipts kept out of the posted total. reportado = inbound customer draft. anulado = anulado true. cancel = move state cancel and not anulado. salida_cliente = the outbound customer payments (the G&T card charges); they are not buyer refunds. cesion_proveedor = the two vendor payments whose text says CESION DE DERECHO. otro = anything else that was loaded and is not a cobro.';

CREATE VIEW cobros.v_cobro_mes
WITH (security_invoker = true) AS
SELECT
  date_trunc('month', move_date)::date AS month_on,
  project_slug,
  project_name,
  in_five,
  prefix_family,
  tower,
  currency,
  count(*)::integer AS receipts,
  sum(amount) AS amount,
  sum(debit_gtq) AS debit_gtq,
  count(*) FILTER (WHERE amount = 0)::integer AS zero_receipts,
  count(*) FILTER (WHERE is_desistimiento)::integer AS ds_receipts,
  sum(amount) FILTER (WHERE is_desistimiento) AS ds_amount
FROM cobros.v_cobro
WHERE move_date IS NOT NULL
GROUP BY 1, 2, 3, 4, 5, 6, 7;

COMMENT ON VIEW cobros.v_cobro_mes IS
  'Posted cobros by month, project, prefix, tower, and currency. Currencies are separate groups. A missing month is an absent row, not a zero. Do not zero-fill Santa Elena or Casa Elisa.';

CREATE VIEW cobros.v_acumulado_mes
WITH (security_invoker = true) AS
SELECT
  month_on,
  project_slug,
  project_name,
  in_five,
  currency,
  receipts,
  amount,
  debit_gtq,
  sum(amount) OVER (
    PARTITION BY project_slug, currency
    ORDER BY month_on
  ) AS acumulado,
  sum(debit_gtq) OVER (
    PARTITION BY project_slug, currency
    ORDER BY month_on
  ) AS acumulado_debit_gtq
FROM (
  SELECT
    date_trunc('month', move_date)::date AS month_on,
    project_slug,
    project_name,
    in_five,
    currency,
    count(*)::integer AS receipts,
    sum(amount) AS amount,
    sum(debit_gtq) AS debit_gtq
  FROM cobros.v_cobro
  WHERE move_date IS NOT NULL
  GROUP BY 1, 2, 3, 4, 5
) AS month_rows;

COMMENT ON VIEW cobros.v_acumulado_mes IS
  'Running sum of posted amount by project and currency, from the first posted month of that pair. Nothing in Odoo stores the cumulative. GTQ amount and USD amount each have their own running sum. acumulado_debit_gtq on a USD row is quetzales booked, and it is not added to the GTQ running sum.';

CREATE VIEW cobros.v_plan_unidad
WITH (security_invoker = true) AS
SELECT
  unit.project_slug,
  project.name AS project_name,
  unit.odoo_partner_id,
  unit.raw_name,
  unit.apt,
  unit.modelo,
  unit.tower,
  unit.buyer_name,
  unit.population,
  unit.status,
  unit.commercial_state,
  unit.has_plan,
  unit.plan_confidence,
  unit.n_cuotas,
  unit.cuota_typical,
  unit.expected_to_date,
  unit.confirmed_to_date,
  unit.reported_to_date,
  unit.balance,
  unit.collection_rate,
  unit.months_behind,
  unit.n_payments,
  unit.last_receipt_on,
  unit.flags,
  unit.commercial_state = 'duplicado'
    OR EXISTS (
      SELECT 1
      FROM unnest(unit.flags) AS flag
      WHERE flag LIKE 'duplicate_partner_record%'
    ) AS is_duplicate,
  file.built_on,
  file.as_of,
  file.balance_scope
FROM cobros.plan_unit AS unit
JOIN cobros.project AS project ON project.slug = unit.project_slug
JOIN cobros.plan_file AS file ON file.project_slug = unit.project_slug;

COMMENT ON VIEW cobros.v_plan_unidad IS
  'Plan unit plus the file''s balance scope. is_duplicate marks shadow partners. They stay in the view and out of déficit totals. Positive balance is short. Negative balance is ahead.';

CREATE VIEW cobros.v_plan_mes
WITH (security_invoker = true) AS
SELECT
  project_slug,
  odoo_partner_id,
  month_on,
  expected,
  reported,
  confirmed,
  cum_expected,
  cum_reported,
  cum_confirmed,
  (cum_expected - cum_confirmed) AS cum_balance,
  (expected - confirmed) AS month_balance
FROM cobros.plan_month
WHERE NOT ocr_garbage;

COMMENT ON VIEW cobros.v_plan_mes IS
  'Enganche month rows, without Boulevard 5 OCR months before 2020-01. cum_balance and month_balance use the file''s sign: positive is short of the plan, negative is ahead. This is not the live ledger. The file was built on 2026-10-01.';

CREATE VIEW cobros.v_alerta
WITH (security_invoker = true) AS
SELECT *
FROM cobros.v_plan_unidad
WHERE has_plan
  AND NOT is_duplicate
  AND balance > 1;

COMMENT ON VIEW cobros.v_alerta IS
  'The only alert proxy in the archive: a parsed enganche plan whose stored balance is greater than 1. Not a follow-up, not an activity, not a reason. Boulevard 5 balance is the whole plan because as_of is null. Benestare and Tapias are as of 2026-10. months_behind is the file''s figure. The page recomputes a period cut from v_plan_mes; this view is the file''s own cut.';

CREATE VIEW cobros.v_desistimiento
WITH (security_invoker = true) AS
SELECT
  partner.odoo_partner_id,
  partner.name,
  partner.write_at,
  partner.write_on_utc,
  partner.project_slug,
  partner.project_name,
  partner.in_five,
  partner.prefix_family,
  partner.tower,
  partner.modelo,
  partner.apt,
  partner.buyer_name,
  cash.gtq_receipts,
  cash.gtq_amount,
  cash.usd_receipts,
  cash.usd_amount,
  cash.usd_debit_gtq,
  cash.first_on,
  cash.last_on
FROM cobros.v_partner AS partner
LEFT JOIN (
  SELECT
    odoo_partner_id,
    count(*) FILTER (WHERE currency = 'GTQ')::integer AS gtq_receipts,
    sum(amount) FILTER (WHERE currency = 'GTQ') AS gtq_amount,
    count(*) FILTER (WHERE currency = 'USD')::integer AS usd_receipts,
    sum(amount) FILTER (WHERE currency = 'USD') AS usd_amount,
    sum(debit_gtq) FILTER (WHERE currency = 'USD') AS usd_debit_gtq,
    min(move_date) AS first_on,
    max(move_date) AS last_on
  FROM cobros.v_cobro
  GROUP BY odoo_partner_id
) AS cash ON cash.odoo_partner_id = partner.odoo_partner_id
WHERE partner.is_desistimiento;

COMMENT ON VIEW cobros.v_desistimiento IS
  'A desistimiento is the DS- mark on the partner name (or the two older splices). Receipts stay on that partner. There is no reason, no refund, no retention, and no decision date. write_at is the last edit. gtq_amount and usd_amount are posted cobros still sitting on the name. A null amount means that currency has no posted receipt on the partner.';

CREATE VIEW cobros.v_caso_revision
WITH (security_invoker = true) AS
SELECT
  'cd-02'::text AS kind,
  partner.project_slug,
  partner.odoo_partner_id,
  partner.name AS partner_name,
  NULL::date AS move_date,
  NULL::text AS currency,
  NULL::numeric AS amount,
  'Segundo nombre de socio en Boulevard 5. No es un caso especial.'::text AS detail
FROM cobros.v_partner AS partner
WHERE partner.prefix_family = 'cd-02'
UNION ALL
SELECT
  'co-comprador',
  partner.project_slug,
  partner.odoo_partner_id,
  partner.name,
  NULL::date,
  NULL::text,
  NULL::numeric,
  'Una diagonal en el nombre. Un socio, un flujo de recibos.'
FROM cobros.v_partner AS partner
WHERE partner.co_buyer
  AND partner.prefix_family IN ('02', 'cd-02', 'bnt', '03', 'c', 'blt', '01')
UNION ALL
SELECT
  'gv1-cero',
  cobro.project_slug,
  cobro.odoo_partner_id,
  cobro.partner_name,
  cobro.move_date,
  cobro.currency,
  cobro.amount,
  'Recibo publicado en cero con GV1 en el nombre. Cuenta como recibo y no suma dinero.'
FROM cobros.v_cobro AS cobro
WHERE cobro.gv1
  AND cobro.amount = 0
UNION ALL
SELECT
  'sin-asignar',
  cobro.project_slug,
  cobro.odoo_partner_id,
  cobro.partner_name,
  cobro.move_date,
  cobro.currency,
  cobro.amount,
  'Recibo publicado cuyo nombre no trae prefijo de proyecto. No se suma a los cinco.'
FROM cobros.v_cobro AS cobro
WHERE cobro.project_slug = 'sin-asignar'
UNION ALL
SELECT
  'cesion-proveedor',
  parts.project_slug,
  receipt.odoo_partner_id,
  receipt.partner_name,
  receipt.move_date,
  receipt.currency,
  receipt.amount,
  COALESCE(receipt.descripcion, 'Pago a proveedor con el texto CESION DE DERECHO. No es un recibo del comprador.')
FROM cobros.receipt AS receipt
CROSS JOIN LATERAL cobros.parse_partner(receipt.partner_name) AS parts
WHERE receipt.lane = 'cesion_proveedor';

COMMENT ON VIEW cobros.v_caso_revision IS
  'There is no caso especial code and no Friends & Family flag in the archive. Category ids 1, 2, and 5 are common and their names were not extracted, so they are not a flag. This view is the review list the mapping allows: CD-02- partners, slash names, GV1 zero receipts, the unassigned Gran Jaguar receipts, and the two cesión vendor payments.';

CREATE VIEW cobros.v_cierre_mes
WITH (security_invoker = true) AS
SELECT
  date_trunc('month', move_date)::date AS month_on,
  project_slug,
  project_name,
  in_five,
  currency,
  journal_name,
  count(*)::integer AS receipts,
  count(*) FILTER (WHERE amount = 0)::integer AS zero_receipts,
  sum(amount) AS amount,
  sum(debit_gtq) AS debit_gtq,
  count(*) FILTER (WHERE is_desistimiento)::integer AS ds_receipts,
  sum(amount) FILTER (WHERE is_desistimiento) AS ds_amount
FROM cobros.v_cobro
WHERE move_date IS NOT NULL
GROUP BY 1, 2, 3, 4, 5, 6;

COMMENT ON VIEW cobros.v_cierre_mes IS
  'A month close is this aggregation of posted cobros, by project, currency, and journal. Zero-amount receipts stay in the count and out of the money. DS- receipts stay in the month of account.move.date. Drafts, anulado, and cancel for the same month are v_recibo_fuera, visible and excluded. There is no lock row and no checklist in the archive.';

CREATE VIEW cobros.v_meta
WITH (security_invoker = true) AS
SELECT
  DATE '2026-11-02' AS archive_cutoff_on,
  '2026-11-02 12:00:00 America/Guatemala, exclusive'::text AS archive_cutoff_label,
  '20261102T184027Z'::text AS archive_run,
  (SELECT max(move_date) FROM cobros.v_cobro) AS last_posted_on,
  (SELECT count(*) FROM cobros.v_cobro) AS cobro_count,
  (SELECT count(*) FROM cobros.plan_unit) AS plan_unit_count;

COMMENT ON VIEW cobros.v_meta IS
  'The archive this schema was built for. It does not move during the day. last_posted_on comes from the loaded book. A newer extract needs a new load and a new constant here.';

-- ---------------------------------------------------------------------------
-- Read access. Same three operational roles as ventas.v_sale, plus
-- financiero and contabilidad, because this book is collections.
-- The load uses the service role, which bypasses row level security.
-- ---------------------------------------------------------------------------

DO $rls$
DECLARE
  v_table text;
BEGIN
  FOR v_table IN
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'cobros'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'ALTER TABLE cobros.%I ENABLE ROW LEVEL SECURITY',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY cobros_select ON cobros.%I FOR SELECT TO authenticated USING (public.jwt_role() IN (''master'', ''torredecontrol'', ''gerencia'', ''financiero'', ''contabilidad''))',
      v_table
    );
  END LOOP;
END
$rls$;

REVOKE ALL ON SCHEMA cobros FROM PUBLIC;
GRANT USAGE ON SCHEMA cobros TO authenticator, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA cobros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cobros TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA cobros FROM authenticated, anon, PUBLIC;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cobros FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cobros TO service_role;
GRANT EXECUTE ON FUNCTION cobros.parse_partner(text) TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA cobros
  GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA cobros
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

DO $seed_check$
DECLARE
  v_projects integer;
  v_plans integer;
  v_receipts integer;
  v_empty integer;
BEGIN
  SELECT count(*) INTO v_projects FROM cobros.project;
  SELECT count(*) INTO v_plans FROM cobros.plan_file;
  SELECT count(*) INTO v_receipts FROM cobros.receipt;
  SELECT count(*) INTO v_empty
  FROM cobros.project
  WHERE slug IN ('santa-elena', 'casa-elisa')
    AND in_five
    AND NOT has_unit_book;

  IF v_projects <> 7 OR v_plans <> 3 OR v_receipts <> 0 OR v_empty <> 2 THEN
    RAISE EXCEPTION
      'cobros seed check failed: projects %, plan files %, receipts %, empty projects %',
      v_projects, v_plans, v_receipts, v_empty;
  END IF;
END
$seed_check$;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Rollback
-- Paste this statement alone to remove Cobros. Do not paste it with the
-- migration above.
-- ---------------------------------------------------------------------------
-- DROP SCHEMA IF EXISTS cobros CASCADE;
