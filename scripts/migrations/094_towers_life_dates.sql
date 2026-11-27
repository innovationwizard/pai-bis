-- ============================================================================
-- Migration 094: torre life dates
-- ============================================================================
-- Two nullable dates on the existing torre row. No seed. No other column.
-- Does not write to Odoo.
-- Safe to run twice.
-- ============================================================================

ALTER TABLE public.towers
  ADD COLUMN IF NOT EXISTS initial_date date,
  ADD COLUMN IF NOT EXISTS final_date date;

COMMENT ON COLUMN public.towers.initial_date IS
  'Date of birth of the torre. Day 1 for Status de ventas and the first valuation date for Valorización del proyecto. Null is allowed.';

COMMENT ON COLUMN public.towers.final_date IS
  'Final date of the torre. Null is allowed.';

NOTIFY pgrst, 'reload schema';
