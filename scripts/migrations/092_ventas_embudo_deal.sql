-- ============================================================================
-- Migration 092: Pipedrive creation-week embudo
-- ============================================================================
-- One row per current commercial deal. The cohort is add_time, stored as the
-- Guatemala calendar day add_on. stage_order is the pipeline stage position
-- (1 Ingreso through 8 Reserva), not the stage name. status is open, lost,
-- or won. A deal counts in that position and every earlier one. A won deal
-- counts in every position. Stage history is not stored.
--
-- Pipelines: Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena.
-- Créditos, Eventos, and Marketing are not loaded. A pipeline whose name
-- contains Cobán is not loaded.
--
-- Does not write to Odoo. Does not change dim_deal. After this file commits,
-- run: python3 scripts/ventas/load_embudo.py
--
-- Run the whole file, by hand, in the Supabase SQL editor, on a database
-- that already has migration 078. Safe to run twice. This session does not
-- apply the file.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ventas.embudo_deal (
  pipedrive_deal_id text PRIMARY KEY,
  pipeline_slug text NOT NULL,
  asesor_id uuid NOT NULL REFERENCES ventas.dim_asesor (id) ON DELETE RESTRICT,
  stage_order smallint NOT NULL,
  status text NOT NULL,
  add_time timestamptz NOT NULL,
  add_on date NOT NULL,
  load_id uuid NOT NULL,
  CONSTRAINT embudo_deal_id_present CHECK (btrim(pipedrive_deal_id) <> ''),
  CONSTRAINT embudo_deal_slug CHECK (pipeline_slug IN (
    'boulevard-5',
    'benestare',
    'bosque-las-tapias',
    'santa-elena'
  )),
  CONSTRAINT embudo_deal_status CHECK (status IN ('open', 'won', 'lost')),
  CONSTRAINT embudo_deal_stage CHECK (stage_order BETWEEN 1 AND 8)
);

COMMENT ON TABLE ventas.embudo_deal IS
  'Current commercial Pipedrive deal for the creation-week embudo. add_on is the Guatemala day of add_time. stage_order is the stage position. Open, lost, and won stay. A won deal counts in every position. Stage history is not stored.';

COMMENT ON COLUMN ventas.embudo_deal.stage_order IS
  '1 Ingreso, 2 Contactado, 3 En Perfilamiento, 4 Calificados, 5 Cita Programada, 6 Visita Efectiva, 7 En Decisión, 8 Reserva. Joined by position.';

COMMENT ON COLUMN ventas.embudo_deal.add_on IS
  'Guatemala calendar day of add_time. The period is inclusive of these days, which is Monday 00:00 through the next Monday 00:00 when the period is a week.';

DELETE FROM ventas.embudo_deal
WHERE pipeline_slug NOT IN (
  'boulevard-5',
  'benestare',
  'bosque-las-tapias',
  'santa-elena'
);

ALTER TABLE ventas.embudo_deal DROP CONSTRAINT IF EXISTS embudo_deal_slug;
ALTER TABLE ventas.embudo_deal
  ADD CONSTRAINT embudo_deal_slug CHECK (pipeline_slug IN (
    'boulevard-5',
    'benestare',
    'bosque-las-tapias',
    'santa-elena'
  ));

CREATE INDEX IF NOT EXISTS embudo_deal_period
  ON ventas.embudo_deal (add_on, pipeline_slug);

CREATE INDEX IF NOT EXISTS embudo_deal_asesor
  ON ventas.embudo_deal (asesor_id, add_on);

ALTER TABLE ventas.embudo_deal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ventas_select ON ventas.embudo_deal;
CREATE POLICY ventas_select ON ventas.embudo_deal
  FOR SELECT TO authenticated
  USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia'));

GRANT SELECT ON ventas.embudo_deal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ventas.embudo_deal TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ventas.embudo_deal FROM authenticated, anon, PUBLIC;

NOTIFY pgrst, 'reload schema';
