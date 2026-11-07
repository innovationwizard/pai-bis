-- ============================================================================
-- Migration 088: ventas roster rule
-- ============================================================================
-- 087 gives an asesor a target for every project whose activity count clears
-- the roster threshold in that month. The data owner ruled otherwise: a rep
-- carries one project's target per month.
--
-- A rep is anyone in ventas.dim_asesor who does not have a row in
-- ventas.asesor_role with carries_target = false. For each rep and month the
-- project is the one with the most activities in
-- ventas.fact_asesor_activity_month, ignoring projects flagged is_sin_dato.
-- A tie goes to the lowest project_id. The rep carries the target when that
-- project's activity count clears the roster threshold. The threshold lives
-- once, on ventas.v_target_roster. A mid-month reassignment gives the whole
-- month to that project.
--
-- Does not alter ventas.fact_target, ventas.target_event,
-- ventas.fact_asesor_activity_month, or ventas.project_meta.
--
-- Run the whole file, by hand, in the Supabase SQL editor, on a database
-- that already has migration 087. Safe to run twice. This session does not
-- apply the file.
-- ============================================================================

DO $pre$
BEGIN
  IF to_regclass('ventas.dim_asesor') IS NULL
     OR to_regclass('ventas.dim_project') IS NULL
     OR to_regclass('ventas.fact_asesor_activity_month') IS NULL
     OR to_regclass('ventas.project_meta') IS NULL THEN
    RAISE EXCEPTION
      'ventas roster tables are missing. Migration 087 has to be applied first.';
  END IF;

  IF to_regprocedure('public.jwt_role()') IS NULL THEN
    RAISE EXCEPTION
      'public.jwt_role() is missing. Migration 040 has to be applied first.';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- Roles maintained by hand. A row with carries_target = false is not a rep.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ventas.asesor_role (
  asesor_id uuid PRIMARY KEY REFERENCES ventas.dim_asesor (id) ON DELETE RESTRICT,
  role text NOT NULL,
  carries_target boolean NOT NULL,
  note text
);

COMMENT ON TABLE ventas.asesor_role IS
  'Job role of people who own Pipedrive activity and do not carry a sales target. Maintained by hand.';

-- ---------------------------------------------------------------------------
-- Read access. The three roles may select. They may not write.
-- Hand edits run as the table owner, which bypasses row level security.
-- ---------------------------------------------------------------------------

ALTER TABLE ventas.asesor_role ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'ventas'
      AND tablename = 'asesor_role'
      AND policyname = 'ventas_select'
  ) THEN
    CREATE POLICY ventas_select
      ON ventas.asesor_role
      FOR SELECT
      TO authenticated
      USING (public.jwt_role() IN ('master', 'torredecontrol', 'gerencia'));
  END IF;
END
$rls$;

-- ---------------------------------------------------------------------------
-- Seed. Looked up by Pipedrive user id. A second run does not overwrite a
-- hand edit.
-- ---------------------------------------------------------------------------

DO $seed_check$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(
           v.source_user_id || ' matched ' || COALESCE(n.n, 0)::text,
           ', ' ORDER BY v.source_user_id
         )
    INTO v_bad
  FROM (
    VALUES
      ('24538879'::text),
      ('24650595'),
      ('14165702'),
      ('24650705'),
      ('25046793')
  ) AS v(source_user_id)
  LEFT JOIN (
    SELECT source_user_id, count(*)::integer AS n
    FROM ventas.dim_asesor
    GROUP BY source_user_id
  ) n ON n.source_user_id = v.source_user_id
  WHERE COALESCE(n.n, 0) <> 1;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'asesor_role seed needs exactly one dim_asesor row: %', v_bad;
  END IF;
END
$seed_check$;

INSERT INTO ventas.asesor_role (asesor_id, role, carries_target, note)
SELECT
  a.id,
  v.role,
  false,
  'role confirmed by the data owner, 2026-11-07'
FROM (
  VALUES
    ('24538879'::text, 'Sales Manager'::text),
    ('24650595', 'Sales Supervisor'),
    ('14165702', 'Loans Coordinator'),
    ('24650705', 'Loans Manager'),
    ('25046793', 'Marketing Manager')
) AS v(source_user_id, role)
JOIN ventas.dim_asesor a ON a.source_user_id = v.source_user_id
ON CONFLICT (asesor_id) DO NOTHING;

DO $seed_present$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(v.source_user_id, ', ' ORDER BY v.source_user_id)
    INTO v_bad
  FROM (
    VALUES
      ('24538879'::text),
      ('24650595'),
      ('14165702'),
      ('24650705'),
      ('25046793')
  ) AS v(source_user_id)
  JOIN ventas.dim_asesor a ON a.source_user_id = v.source_user_id
  LEFT JOIN ventas.asesor_role r ON r.asesor_id = a.id
  WHERE r.asesor_id IS NULL;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'asesor_role seed missing after insert: %', v_bad;
  END IF;
END
$seed_present$;

-- ---------------------------------------------------------------------------
-- Roster. Columns match ventas.v_target_roster from migration 087.
-- target_gtq stays null: the roster has no quetzal figure.
-- One row per asesor and month. The winner is chosen first; the threshold
-- applies to that project's activity count.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW ventas.v_target_roster
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  winner.asesor_id,
  winner.project_id,
  winner.month_start,
  m.target_units_per_asesor::integer AS target_units,
  NULL::numeric(18,2) AS target_gtq
FROM (
  SELECT DISTINCT ON (a.asesor_id, a.month_start)
    a.asesor_id,
    a.project_id,
    a.month_start,
    a.activities
  FROM ventas.fact_asesor_activity_month a
  JOIN ventas.dim_project p ON p.id = a.project_id
  WHERE p.is_sin_dato IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM ventas.asesor_role r
      WHERE r.asesor_id = a.asesor_id
        AND r.carries_target = false
    )
  -- Most activities wins. A tie goes to the lowest project_id.
  ORDER BY a.asesor_id, a.month_start, a.activities DESC, a.project_id ASC
) winner
JOIN ventas.project_meta m ON m.project_id = winner.project_id
-- roster threshold: activities per month
WHERE winner.activities >= 10;

COMMENT ON VIEW ventas.v_target_roster IS
  'One asesor, one project, one calendar month. A rep is anyone in dim_asesor with no asesor_role row whose carries_target is false. The project is the one with the most activities that month, ignoring projects flagged is_sin_dato; a tie goes to the lowest project_id. The rep carries the target when that count clears the roster threshold. A mid-month reassignment gives the whole month to that project. target_units is project_meta.target_units_per_asesor, the same number for every asesor who carries that project, and it is measured against reservas. target_gtq is null. Torre and Fuente are not part of the grain.';

GRANT SELECT ON ventas.asesor_role TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ventas.asesor_role TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ventas.asesor_role
  FROM authenticated, anon, PUBLIC;

NOTIFY pgrst, 'reload schema';

SELECT
  a.name,
  a.source_user_id,
  r.asesor_id,
  r.role,
  r.carries_target,
  r.note
FROM ventas.asesor_role r
JOIN ventas.dim_asesor a ON a.id = r.asesor_id
ORDER BY a.name, a.source_user_id;
