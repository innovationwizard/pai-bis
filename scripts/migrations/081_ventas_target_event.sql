-- ============================================================================
-- Migration 081: historical Ventas targets
-- ============================================================================
-- Append-only meta for one asesor, one project, and one month. The Operativo
-- view uses the latest row. Earlier rows stay. When a month has no row, the
-- page falls back to ventas.fact_target.
--
-- Run this once, by hand, in the Supabase SQL editor. This session has no
-- DATABASE_URL and no psql, and it does not apply the file.
-- Schema ventas must already exist (migration 078). This file does not
-- rewrite 078 and does not drop a table.
-- After it commits, NOTIFY reloads PostgREST.
-- ============================================================================

DO $pre$
BEGIN
  IF to_regnamespace('ventas') IS NULL THEN
    RAISE EXCEPTION 'schema ventas is missing. Run migration 078 first.';
  END IF;
  IF to_regclass('ventas.target_event') IS NOT NULL THEN
    RAISE EXCEPTION 'ventas.target_event already exists. This migration is the initial table, not a patch.';
  END IF;
  IF to_regprocedure('public.jwt_role()') IS NULL THEN
    RAISE EXCEPTION 'public.jwt_role() is missing. Migration 040 has to be applied first.';
  END IF;
END
$pre$;

CREATE TABLE ventas.target_event (
  id uuid PRIMARY KEY,
  asesor_id uuid NOT NULL REFERENCES ventas.dim_asesor (id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  month_start date NOT NULL,
  target_units integer,
  target_gtq numeric(18,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT target_event_month CHECK (month_start = date_trunc('month', month_start)::date),
  CONSTRAINT target_event_has_a_figure CHECK (target_units IS NOT NULL OR target_gtq IS NOT NULL),
  CONSTRAINT target_event_units_nonnegative CHECK (target_units IS NULL OR target_units >= 0),
  CONSTRAINT target_event_gtq_nonnegative CHECK (target_gtq IS NULL OR target_gtq >= 0)
);

COMMENT ON TABLE ventas.target_event IS
  'Append-only meta de ventas for one asesor, one project, and one month. The page reads the latest row. A later edit inserts a new row and leaves the previous one. No row means the page uses ventas.fact_target. Torre and fuente are not part of the grain.';

CREATE INDEX target_event_grain
  ON ventas.target_event (asesor_id, project_id, month_start, created_at DESC);

ALTER TABLE ventas.target_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY ventas_select_target_event ON ventas.target_event
  FOR SELECT TO authenticated
  USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia'));

CREATE POLICY ventas_insert_target_event ON ventas.target_event
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia'));

GRANT SELECT, INSERT ON ventas.target_event TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ventas.target_event TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ventas.target_event FROM authenticated, anon, PUBLIC;

NOTIFY pgrst, 'reload schema';
