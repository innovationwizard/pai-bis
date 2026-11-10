# 101 — Ventas landing: reservas, roster, and the due day

**Date:** 2026-11-09
**Route:** `/ventas`

The color pass is changelog 100. This entry is the rest of the same day's landing work.

## What `/ventas` shows

`/ventas` is `command-center.tsx`. `/ventas/ventas-totales` stays the glance. Filters: Periodo, Proyecto, Asesor, Torre, Restablecer. The stamp is `Datos al dd.mm.yyyy` with no time. The day is still the latest business clock on the vista, not a load-run column.

Removed from the landing: the sentence under the filters that defined venta neta, the project cards under the reservas card, the block «Mes pasado y mes anterior», and the L-shaped corner marks in `landing-blocks` and `_centro-de-mando`.

The first row stretches so the reservas card matches the bar chart. Casa Elisa and any project whose name contains Cobán or Coban are left off the bars and remain in the Proyecto filter. Santa Elena stays, including at zero. Under that row, one row per chart project: the same reservas card, named, and the advisor columns for that project. The prior pill uses `priorByProject` on the reservas stage, the same window as the total. The Asesores list is only `v_target_roster` for the months in the period. It does not print «Sin meta».

## Who counts

A sales rep is anyone in `ventas.dim_asesor` without `ventas.asesor_role.carries_target = false`. Migration 088 seeds those five rows. Their reservas are not counted and they are not listed.

A Créditos pipeline is counted when the owner is a sales rep. An earlier pass excluded every pipeline whose name starts with Créditos. That made November match only because the two extra rows were also non-reps, and it dropped October's sales-rep reservas on Créditos Benestare, Créditos BLT, and Créditos BLV5 (27 down to 4). That exclusion was removed.

## Period day

`fact_comprobante.comprobante_on` followed `marked_as_done_time`. Pipedrive's Reserva report uses the due date, and a due time is UTC. Activity 456978 (Javier Soto, Apto. 1302) is due `2026-09-01` at `01:00` UTC, which is 31 August in Guatemala, and it is in the extract. Activity 462895 (Erwin Cardona, Apto 315) is due 24 August and marked done 10 September, and it is in the extract.

Migration `090_ventas_reserva_due_day.sql` adds `due_on` and `due_time` and points the trigger at that clock. `scripts/ventas/load.py` writes both fields. Applied in the SQL editor on 2026-11-09 (`Success. No rows returned` is the expected result), then the loader rewrote 597 comprobantes and deleted none.

Checked on `/ventas` the same day. 1–31 August is 26: Benestare 12 (Rony Ramírez 7, Ivan Castillo 5), Bosque Las Tapias 7 (Paula Hernandez 5, Javier Soto 2), Boulevard 5 7 (Erwin Cardona 5, Brenda Pérez 2). That matches the Pipedrive Reserva report, including the project pills +2 (20%), 0 (0%), and +4 (133.33%). The total pill is +6 (30%), July’s 20 against August’s 26. Este mes, 1–9 November, is 3: Ivan Castillo, Javier Soto, and Erwin Cardona, one each. That matches the report’s counts. The pill is −1 (−25%) because Este mes compares those nine days with 1–9 October (4 reservas), not with the whole of October (27).

## Also recorded

`load.py` prints `deals`, `skipped_coban`, `usd_values`, and `habitacion_conflicts`. A non-GTQ deal is stored with `value_gtq` null. Pipedrive keeps the amount. The 2026-11-09 extract's only case is deal 52177, «Antonio Prueba 2», USD 1,250,000, lost.

Pages and schema notes: `Ventas-y-Mercadeo-paginas.md`, `Sitio-nuevo-estructura.md`, `prod-db-schema.md`.
