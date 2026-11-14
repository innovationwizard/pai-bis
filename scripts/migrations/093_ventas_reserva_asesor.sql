-- ============================================================================
-- Migration 093: reserva activity owner
-- ============================================================================
-- A reserva is credited to dim_deal.asesor_id. When the deal moves to
-- Créditos, that owner becomes someone who does not carry a target (Job
-- Jiménez, Sales Supervisor). The chart then drops the reserva. The person
-- who logged the Pipedrive reserva activity is the commercial asesor.
--
-- fact_comprobante.asesor_id stores that activity owner. Null until
-- scripts/ventas/load.py runs. The readers keep the old count while it is
-- null. When the deal owner does not carry a target and this asesor does,
-- the reserva is counted under this asesor.
--
-- Does not change dim_deal. Does not write to Odoo.
--
-- Run the whole file, by hand, in the Supabase SQL editor, on a database
-- that already has migration 078. Safe to run twice. This session does not
-- apply the file. After it commits, run: python3 scripts/ventas/load.py
-- ============================================================================

DO $pre$
BEGIN
  IF to_regclass('ventas.fact_comprobante') IS NULL THEN
    RAISE EXCEPTION
      'ventas.fact_comprobante is missing. Migration 078 has to be applied first.';
  END IF;
  IF to_regclass('ventas.dim_asesor') IS NULL THEN
    RAISE EXCEPTION
      'ventas.dim_asesor is missing. Migration 078 has to be applied first.';
  END IF;
END
$pre$;

ALTER TABLE ventas.fact_comprobante
  ADD COLUMN IF NOT EXISTS asesor_id uuid REFERENCES ventas.dim_asesor (id) ON DELETE RESTRICT;

COMMENT ON COLUMN ventas.fact_comprobante.asesor_id IS
  'Pipedrive owner of the reserva activity. When dim_deal.asesor_id does not carry a target and this asesor does, the reserva is counted under this asesor. Null until the ventas load writes it.';

NOTIFY pgrst, 'reload schema';
