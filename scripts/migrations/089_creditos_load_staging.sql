-- ============================================================================
-- Migration 089: creditos load staging
-- ============================================================================
-- 082 keeps the Pipedrive crédito read model in creditos.fact_deal,
-- creditos.fact_activity, creditos.fact_file, and creditos.fact_note. This
-- file adds four staging tables and creditos.swap_load() so a load can fill
-- the copies and then replace those live facts in the one transaction of
-- that call.
--
-- LIKE copies columns and defaults. Checks, indexes, and triggers stay on
-- the live tables. Row level security is on, with no policy. service_role
-- may select, insert, and delete the staging tables.
--
-- swap_load() raises when load_fact_deal has zero rows, then deletes
-- creditos.fact_deal. The foreign keys with ON DELETE CASCADE clear
-- activity, file, and note. It inserts fact_deal, fact_activity, fact_file,
-- and fact_note from the matching staging table, then empties staging. The
-- triggers on the live tables fill the labels and the signal on those
-- inserts. The inserted loaded_at is the staging value, because the insert
-- copies every column. A failure aborts the call and the live rows stay,
-- and the staging rows stay with them.
--
-- Running this file does not insert, update, or delete the live facts, the
-- dimensions, or the views, and it does not call swap_load().
--
-- Run the whole file, by hand, in the Supabase SQL editor, on a database
-- that already has migration 082. Safe to run twice. A second run does not
-- reshape a staging table that already exists. This session does not apply
-- the file.
-- ============================================================================

DO $pre$
BEGIN
  IF to_regclass('creditos.fact_deal') IS NULL
     OR to_regclass('creditos.fact_activity') IS NULL
     OR to_regclass('creditos.fact_file') IS NULL
     OR to_regclass('creditos.fact_note') IS NULL THEN
    RAISE EXCEPTION
      'creditos fact tables are missing. Migration 082 has to be applied first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'creditos'
      AND c.relname = 'fact_deal'
      AND t.tgname = 'fact_deal_labels'
      AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'creditos'
      AND c.relname = 'fact_activity'
      AND t.tgname = 'fact_activity_signal'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION
      'creditos fact triggers are missing. Migration 082 has to be applied first.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RAISE EXCEPTION
      'Supabase roles service_role, authenticated, and anon are required.';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- Staging. Same columns and defaults as the live facts. No keys, checks,
-- indexes, or triggers are added here.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS creditos.load_fact_deal (
  LIKE creditos.fact_deal INCLUDING DEFAULTS
);

CREATE TABLE IF NOT EXISTS creditos.load_fact_activity (
  LIKE creditos.fact_activity INCLUDING DEFAULTS
);

CREATE TABLE IF NOT EXISTS creditos.load_fact_file (
  LIKE creditos.fact_file INCLUDING DEFAULTS
);

CREATE TABLE IF NOT EXISTS creditos.load_fact_note (
  LIKE creditos.fact_note INCLUDING DEFAULTS
);

-- ---------------------------------------------------------------------------
-- No policy. 082's default privileges grant SELECT to authenticated and
-- UPDATE to service_role on a new creditos table; the revoke clears that.
-- service_role keeps select, insert, and delete, and bypasses row level
-- security the same way the 082 load does.
-- ---------------------------------------------------------------------------

ALTER TABLE creditos.load_fact_deal ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos.load_fact_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos.load_fact_file ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos.load_fact_note ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  creditos.load_fact_deal,
  creditos.load_fact_activity,
  creditos.load_fact_file,
  creditos.load_fact_note
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, DELETE ON TABLE
  creditos.load_fact_deal,
  creditos.load_fact_activity,
  creditos.load_fact_file,
  creditos.load_fact_note
TO service_role;

-- ---------------------------------------------------------------------------
-- One call, one transaction. The body writes the live facts only when the
-- caller executes it. Applying this file does not.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION creditos.swap_load()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = creditos, public, pg_temp
AS $$
DECLARE
  v_deal bigint;
  v_activity bigint;
  v_file bigint;
  v_note bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM creditos.load_fact_deal) THEN
    RAISE EXCEPTION
      'creditos.load_fact_deal has zero rows. Refusing to replace the live facts.';
  END IF;

  -- Activity, file, and note follow ON DELETE CASCADE.
  -- WHERE true keeps the statements valid where the API layer requires a WHERE clause.
  DELETE FROM creditos.fact_deal WHERE true;

  INSERT INTO creditos.fact_deal
  SELECT * FROM creditos.load_fact_deal;
  GET DIAGNOSTICS v_deal = ROW_COUNT;

  INSERT INTO creditos.fact_activity
  SELECT * FROM creditos.load_fact_activity;
  GET DIAGNOSTICS v_activity = ROW_COUNT;

  INSERT INTO creditos.fact_file
  SELECT * FROM creditos.load_fact_file;
  GET DIAGNOSTICS v_file = ROW_COUNT;

  INSERT INTO creditos.fact_note
  SELECT * FROM creditos.load_fact_note;
  GET DIAGNOSTICS v_note = ROW_COUNT;

  DELETE FROM creditos.load_fact_deal WHERE true;
  DELETE FROM creditos.load_fact_activity WHERE true;
  DELETE FROM creditos.load_fact_file WHERE true;
  DELETE FROM creditos.load_fact_note WHERE true;

  RETURN jsonb_build_object(
    'fact_deal', v_deal,
    'fact_activity', v_activity,
    'fact_file', v_file,
    'fact_note', v_note
  );
END;
$$;

COMMENT ON FUNCTION creditos.swap_load() IS
  'The swap relies on the staging tables having the same columns as the live tables, so an ALTER TABLE on a live fact table needs the same ALTER on its staging table; the triggers on the live tables fill the labels and the signal during the swap.';

REVOKE ALL ON FUNCTION creditos.swap_load() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION creditos.swap_load() TO service_role;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Rollback. Commented out. Drops the function and the four staging tables.
-- The live fact tables stay.
-- ---------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS creditos.swap_load();
-- DROP TABLE IF EXISTS creditos.load_fact_note;
-- DROP TABLE IF EXISTS creditos.load_fact_file;
-- DROP TABLE IF EXISTS creditos.load_fact_activity;
-- DROP TABLE IF EXISTS creditos.load_fact_deal;
