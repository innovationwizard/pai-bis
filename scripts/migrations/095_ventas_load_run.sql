-- ============================================================================
-- Migration 095: ventas load completion
-- ============================================================================
-- One row each time scripts/ventas/load.py reaches its last count without
-- raising. The Ventas stamp reads the latest finished_at and prints the
-- Guatemala day. A run that stops early writes nothing, so the previous
-- success stays.
--
-- The inserted row is the load that wrote the activity facts now stored.
-- fact_pcv_issuance, fact_comprobante, fact_reception, and fact_visit all
-- carry identifiers minted 2026-11-27 18:40:12Z through 18:40:14.799Z, and
-- that process is not running. The loader records the real finish from the
-- next successful run on.
--
-- Does not write to Odoo. Does not change the fact tables.
--
-- Run the whole file, by hand, in the Supabase SQL editor, on a database
-- that already has migration 078. Safe to run twice. This session does not
-- apply the file. After it commits, the next python3 scripts/ventas/load.py
-- that finishes adds its own row.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ventas.load_run (
  id uuid PRIMARY KEY,
  finished_at timestamptz NOT NULL,
  script text NOT NULL,
  CONSTRAINT load_run_script CHECK (script = 'scripts/ventas/load.py')
);

COMMENT ON TABLE ventas.load_run IS
  'One finish of scripts/ventas/load.py. The Ventas stamp uses the latest finished_at. A run that stops early does not add a row.';

COMMENT ON COLUMN ventas.load_run.finished_at IS
  'Clock recorded for that run. A row the loader writes is the moment the run reached its last count. The first row is the latest identifier minted while that load built the activity facts, 2026-11-27 18:40:14.799Z. The stamp prints the Guatemala calendar day of this clock.';

CREATE INDEX IF NOT EXISTS load_run_finished
  ON ventas.load_run (script, finished_at DESC);

ALTER TABLE ventas.load_run ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ventas_select ON ventas.load_run;
CREATE POLICY ventas_select ON ventas.load_run
  FOR SELECT TO authenticated
  USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia'));

GRANT SELECT ON ventas.load_run TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ventas.load_run TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ventas.load_run FROM authenticated, anon, PUBLIC;

INSERT INTO ventas.load_run (id, finished_at, script)
SELECT
  '01a21e4e-ddcf-71b2-83d4-e5f60718a9b0'::uuid,
  '2026-11-27T18:40:14.799Z'::timestamptz,
  'scripts/ventas/load.py'
WHERE NOT EXISTS (
  SELECT 1 FROM ventas.load_run WHERE script = 'scripts/ventas/load.py'
);

NOTIFY pgrst, 'reload schema';
