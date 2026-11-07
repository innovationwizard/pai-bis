-- ============================================================================
-- Migration 087: ventas roster target
-- ============================================================================
-- fact_target gives every asesor who ever owned a deal a target in every
-- month from 2022-06 through 2026-10. October then sums to 151 instead of
-- about 26, and November has no rows. This file derives the monthly target
-- from activity instead.
--
-- An asesor carries a project's target in a month when their activity count
-- on that project's deals clears the roster threshold. The target equals the
-- project's meta, and it is measured against reservas. The threshold lives
-- once, on ventas.v_target_roster.
--
-- Does not alter ventas.fact_target or ventas.target_event. Does not load
-- activities. The activity table stays empty until scripts/ventas/load.py
-- fills it, and the view stays empty with it.
--
-- Run the whole file, by hand, in the Supabase SQL editor, on a database
-- that already has migration 078. Safe to run twice. This session does not
-- apply the file.
-- ============================================================================

DO $pre$
BEGIN
  IF to_regclass('ventas.dim_asesor') IS NULL
     OR to_regclass('ventas.dim_project') IS NULL THEN
    RAISE EXCEPTION
      'ventas.dim_asesor and ventas.dim_project are missing. Migration 078 has to be applied first.';
  END IF;

  IF to_regprocedure('public.jwt_role()') IS NULL THEN
    RAISE EXCEPTION
      'public.jwt_role() is missing. Migration 040 has to be applied first.';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- Activity counts. The load owns the rows.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ventas.fact_asesor_activity_month (
  asesor_id uuid NOT NULL REFERENCES ventas.dim_asesor (id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  month_start date NOT NULL,
  activities integer NOT NULL,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asesor_id, project_id, month_start),
  CONSTRAINT fact_asesor_activity_month_month CHECK (
    month_start = date_trunc('month', month_start)::date
  ),
  CONSTRAINT fact_asesor_activity_month_activities_nonnegative CHECK (
    activities >= 0
  )
);

COMMENT ON TABLE ventas.fact_asesor_activity_month IS
  'Count of Pipedrive activities due in the month, owned by the asesor, on deals of the project. Filled by scripts/ventas/load.py.';

-- ---------------------------------------------------------------------------
-- Project meta. One number of reserva units per asesor.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ventas.project_meta (
  project_id uuid PRIMARY KEY REFERENCES ventas.dim_project (id) ON DELETE RESTRICT,
  target_units_per_asesor integer NOT NULL,
  CONSTRAINT project_meta_units_nonnegative CHECK (
    target_units_per_asesor >= 0
  )
);

COMMENT ON TABLE ventas.project_meta IS
  'Duplicates public.projects.meta_mensual_por_asesor. Verified from the October 2026 fact_target rows.';

-- ---------------------------------------------------------------------------
-- Read access. The three roles may select. They may not write.
-- The load uses the service role, which bypasses row level security.
-- ---------------------------------------------------------------------------

ALTER TABLE ventas.fact_asesor_activity_month ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas.project_meta ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'ventas'
      AND tablename = 'fact_asesor_activity_month'
      AND policyname = 'ventas_select'
  ) THEN
    CREATE POLICY ventas_select
      ON ventas.fact_asesor_activity_month
      FOR SELECT
      TO authenticated
      USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'ventas'
      AND tablename = 'project_meta'
      AND policyname = 'ventas_select'
  ) THEN
    CREATE POLICY ventas_select
      ON ventas.project_meta
      FOR SELECT
      TO authenticated
      USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia'));
  END IF;
END
$rls$;

-- ---------------------------------------------------------------------------
-- Seed. Same five buildings as dim_project, looked up by name.
-- A second run restores these verified numbers.
-- ---------------------------------------------------------------------------

INSERT INTO ventas.project_meta (project_id, target_units_per_asesor)
SELECT p.id, v.target_units_per_asesor
FROM (
  VALUES
    ('Boulevard 5'::text, 3),
    ('Benestare', 5),
    ('Bosque Las Tapias', 5),
    ('Casa Elisa', 0),
    ('Santa Elena', 0)
) AS v(name, target_units_per_asesor)
JOIN ventas.dim_project p ON p.name = v.name
ON CONFLICT (project_id) DO UPDATE
SET target_units_per_asesor = EXCLUDED.target_units_per_asesor;

DO $seed_check$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(
           v.name || ' ' || COALESCE(m.target_units_per_asesor::text, 'missing'),
           ', ' ORDER BY v.name
         )
    INTO v_bad
  FROM (
    VALUES
      ('Boulevard 5'::text, 3),
      ('Benestare', 5),
      ('Bosque Las Tapias', 5),
      ('Casa Elisa', 0),
      ('Santa Elena', 0)
  ) AS v(name, units)
  LEFT JOIN ventas.dim_project p ON p.name = v.name
  LEFT JOIN ventas.project_meta m ON m.project_id = p.id
  WHERE p.id IS NULL
     OR m.project_id IS NULL
     OR m.target_units_per_asesor IS DISTINCT FROM v.units;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'project_meta seed check failed: %', v_bad;
  END IF;
END
$seed_check$;

-- ---------------------------------------------------------------------------
-- Roster. Columns match the fact_target select in src/lib/ventas/vista.ts.
-- target_gtq stays null: the roster has no quetzal figure.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW ventas.v_target_roster
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  a.asesor_id,
  a.project_id,
  a.month_start,
  m.target_units_per_asesor::integer AS target_units,
  NULL::numeric(18,2) AS target_gtq
FROM ventas.fact_asesor_activity_month a
JOIN ventas.project_meta m ON m.project_id = a.project_id
-- roster threshold: activities per month
WHERE a.activities >= 10;

COMMENT ON VIEW ventas.v_target_roster IS
  'One asesor, one project, one calendar month. The asesor carries the project when they own at least the roster threshold of activities due that month on deals of the project. target_units is project_meta.target_units_per_asesor, the same number for every asesor who clears it, and it is measured against reservas. target_gtq is null. Torre and Fuente are not part of the grain.';

GRANT SELECT ON
  ventas.fact_asesor_activity_month,
  ventas.project_meta,
  ventas.v_target_roster
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  ventas.fact_asesor_activity_month,
  ventas.project_meta
  TO service_role;

GRANT SELECT ON ventas.v_target_roster TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ventas.fact_asesor_activity_month, ventas.project_meta
  FROM authenticated, anon, PUBLIC;

NOTIFY pgrst, 'reload schema';

SELECT check_name, detail
FROM (
  SELECT 1 AS ord, 'project_meta'::text AS check_name,
    string_agg(
      p.name || ' = ' || m.target_units_per_asesor::text,
      ', ' ORDER BY p.name
    ) AS detail
  FROM ventas.project_meta m
  JOIN ventas.dim_project p ON p.id = m.project_id
  UNION ALL
  SELECT 2, 'v_target_roster columns',
    string_agg(
      a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod),
      ', ' ORDER BY a.attnum
    )
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'ventas'
    AND c.relname = 'v_target_roster'
    AND a.attnum > 0
    AND NOT a.attisdropped
) checks
ORDER BY ord;
