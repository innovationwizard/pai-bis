-- ============================================================================
-- Migration 080: historical pauta targets
-- ============================================================================
-- Append-only presupuesto the Mercadeo readers enter for one cost center and
-- one month. The Operativo view uses the latest row. Earlier rows stay.
-- When a month has no row, the page falls back to the sum of
-- mercadeo.budget_month.presupuestado for that center and month.
--
-- Run this once, by hand, in the Supabase SQL editor. This session has no
-- DATABASE_URL and no psql, and it does not apply the file.
-- Schema mercadeo must already exist (migration 079). This file does not
-- rewrite 079 and does not drop a table.
-- After it commits, NOTIFY reloads PostgREST. Expose nothing new: mercadeo
-- is already an exposed schema.
-- ============================================================================

DO $pre$
BEGIN
  IF to_regnamespace('mercadeo') IS NULL THEN
    RAISE EXCEPTION 'schema mercadeo is missing. Run migration 079 first.';
  END IF;
  IF to_regclass('mercadeo.pauta_target') IS NOT NULL THEN
    RAISE EXCEPTION 'mercadeo.pauta_target already exists. This migration is the initial table, not a patch.';
  END IF;
  IF to_regprocedure('public.jwt_role()') IS NULL THEN
    RAISE EXCEPTION 'public.jwt_role() is missing. Migration 040 has to be applied first.';
  END IF;
END
$pre$;

CREATE TABLE mercadeo.pauta_target (
  id uuid PRIMARY KEY,
  cost_center_id uuid NOT NULL REFERENCES mercadeo.cost_center (id) ON DELETE RESTRICT,
  month_start date NOT NULL,
  amount_gtq numeric(18,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT pauta_target_month CHECK (month_start = date_trunc('month', month_start)::date),
  CONSTRAINT pauta_target_amount CHECK (amount_gtq >= 0)
);

COMMENT ON TABLE mercadeo.pauta_target IS
  'Append-only presupuesto de pauta for one cost center and one month, in quetzales. The page reads the latest row. A later edit inserts a new row and leaves the previous one. No row means the page uses the loaded budget_month.presupuestado sum. Puerta Abierta is a cost center and is not added into a building total.';

CREATE INDEX pauta_target_center_month
  ON mercadeo.pauta_target (cost_center_id, month_start, created_at DESC);

ALTER TABLE mercadeo.pauta_target ENABLE ROW LEVEL SECURITY;

CREATE POLICY mercadeo_select_pauta_target ON mercadeo.pauta_target
  FOR SELECT TO authenticated
  USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia', 'ventas', 'marketing'));

CREATE POLICY mercadeo_insert_pauta_target ON mercadeo.pauta_target
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia', 'ventas', 'marketing'));

GRANT SELECT, INSERT ON mercadeo.pauta_target TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mercadeo.pauta_target TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON mercadeo.pauta_target FROM authenticated, anon, PUBLIC;

NOTIFY pgrst, 'reload schema';
