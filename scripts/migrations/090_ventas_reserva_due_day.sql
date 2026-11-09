-- ============================================================================
-- Migration 090: reserva period day is the due date
-- ============================================================================
-- fact_comprobante.comprobante_on was the Guatemala day of marked_as_done_time.
-- Pipedrive's Reserva report places the activity on the due date. A due time
-- is UTC. 2026-09-01 01:00 UTC is 19:00 on 2026-08-31 in Guatemala, so that
-- activity belongs to August. A due date with no due time stays on that date.
-- marked_as_done_time stays the completion clock and is not the period day.
--
-- Does not reload activities. After this file commits, run
-- scripts/ventas/load.py so each existing row receives its due date.
--
-- Run the whole file, by hand, in the Supabase SQL editor, on a database
-- that already has migration 078. Safe to run twice. This session does not
-- apply the file.
-- ============================================================================

DO $pre$
BEGIN
  IF to_regclass('ventas.fact_comprobante') IS NULL THEN
    RAISE EXCEPTION
      'ventas.fact_comprobante is missing. Migration 078 has to be applied first.';
  END IF;
END
$pre$;

ALTER TABLE ventas.fact_comprobante
  ADD COLUMN IF NOT EXISTS due_on date;

ALTER TABLE ventas.fact_comprobante
  ADD COLUMN IF NOT EXISTS due_time time;

COMMENT ON COLUMN ventas.fact_comprobante.due_on IS
  'Pipedrive due_date. With due_time, the period day is the Guatemala day of that UTC clock. Without due_time, the period day is this date.';

COMMENT ON COLUMN ventas.fact_comprobante.due_time IS
  'Pipedrive due_time, UTC. Null when the activity has no clock. 2026-09-01 01:00 UTC is 2026-08-31 in Guatemala.';

COMMENT ON COLUMN ventas.fact_comprobante.comprobante_on IS
  'Guatemala day used for the period. Due date and due time when present. Otherwise the Guatemala day of marked_as_done_time.';

CREATE OR REPLACE FUNCTION ventas.fact_comprobante_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ventas, public, pg_temp
AS $$
BEGIN
  IF NEW.due_on IS NULL THEN
    NEW.comprobante_on := ventas.guatemala_day(NEW.marked_as_done_time);
  ELSIF NEW.due_time IS NULL THEN
    NEW.comprobante_on := NEW.due_on;
  ELSE
    NEW.comprobante_on := ventas.guatemala_day(
      (NEW.due_on + NEW.due_time) AT TIME ZONE 'UTC'
    );
  END IF;
  NEW.date_id := ventas.calendar_id(NEW.comprobante_on);
  RETURN NEW;
END;
$$;

DO $check$
BEGIN
  IF ventas.guatemala_day(
       (DATE '2026-09-01' + TIME '01:00') AT TIME ZONE 'UTC'
     ) <> DATE '2026-08-31' THEN
    RAISE EXCEPTION 'due clock 2026-09-01 01:00 UTC is not 2026-08-31 in Guatemala';
  END IF;
END
$check$;

NOTIFY pgrst, 'reload schema';
