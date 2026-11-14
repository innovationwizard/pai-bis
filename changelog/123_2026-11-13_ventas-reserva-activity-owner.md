# 123 — A reserva stays with the asesor who logged it

**Date:** 2026-11-13
**Route:** `/ventas` command center, the Ventas totales block. The same reserva count also feeds Objetivos, Status de ventas, and Ventas por canales.
**Scope:** `ventas.fact_comprobante.asesor_id`, the ventas loader, and the two readers that turn a comprobante into a reserva. `ventas.dim_deal.asesor_id` was not changed. Promesas, recibos, and ventas netas still follow the deal owner. Nothing was written to Odoo.

This file is the record of that work. The code commit is `67a3a5e` (13 November 2026, 18:18, America/Guatemala). This changelog was written after that commit and is not part of it.

`npx tsc --noEmit` was not run. `npm test`, `npm run build`, `next lint`, `next build`, `next dev`, and `next start` were not run. No port was bound. No browser was opened. No request was sent to localhost.

## What was asked

1. Why Daniel Veliz, whose name is Eder Daniel Veliz, does not appear for his Benestare sale in March. Investigate the root cause and propose a fix. The attached screen was the Ventas totales block: 17 reservas, Boulevard 5 at 6, Benestare at 7, Bosque Las Tapias at 4, Santa Elena at 0. Benestare’s bars were Rony Ramírez 5 and Ivan Castillo 2.

2. Implement the proposed fix.

3. After the migration and `scripts/ventas/load.py` had been run, confirm the row.

4. The shell command that stages only the files from this conversation, and a prose commit message. The commit was made outside this chat, with that message.

5. This file.

## What was found before any edit

The bars are reservas, not ventas netas. A reserva is one done Pipedrive activity of type `reserva`. Its period day is `ventas.fact_comprobante.comprobante_on`, which follows the due date. The project card reads `loadReservas` in `src/lib/ventas/vista.ts` (the Objetivos vista). The asesor bars read the reserva stage built in `src/lib/ventas/totales-bridge.ts`. `advisorsInProject` draws the bars only when those two counts agree for the project. Both paths credited `ventas.dim_deal.asesor_id` and then skipped anyone in `ventas.asesor_role` with `carries_target = false`.

`fact_comprobante` did not store the activity owner. The loader wrote `pipedrive_activity_id`, `deal_id`, `marked_as_done_time`, `due_on`, and `due_time`.

Pipedrive has one user for this person: id `24650617`, name `Daniel Veliz`, email `eder.veliz@puertaabierta.com.gt`, `active_flag` false. There is no second user named Eder Daniel Veliz. In `ventas.dim_asesor` that user is `01a12102-51a3-7246-83a2-1eed6d2d45e5`, name `Daniel Veliz`. He has no `asesor_role` row, so he carries a target. The older `public.salespeople` pair, Eder Veliz `d5895fe3-62c8-4815-af0b-086feafead42` and Daniel Veliz `c5e33ccb-6c39-45ac-8d4d-ee5cdf598895`, was merged by migration 066. That merge does not feed this chart.

The March screen matches the Pipedrive extract exactly, counting done `reserva` activities whose deal sits on Boulevard 5, Benestare, Bosque Las Tapias, or Santa Elena, including the Créditos pipelines that map onto those buildings, and dropping a deal whose owner does not carry a target:

| Project | Shown | Asesores |
|---|---:|---|
| Boulevard 5 | 6 | Erwin Cardona 4, Jose Gutierrez 2 |
| Benestare | 7 | Rony Ramirez 5, Ivan Castillo 2 |
| Bosque Las Tapias | 4 | Paula Hernandez 3, Javier Soto 1 |
| Santa Elena | 0 | |
| Total shown | 17 | |
| Dropped | 1 | Benestare, deal owner Job Jiménez |

The dropped activity is Pipedrive `340256`, subject `APTO 204 TA MB -BNT`, due `2026-03-12`, marked done `2026-03-12T20:58:07`. The deal is `49410`, Rosa Elena Rojas Cano, pipeline `7` (Créditos Benestare), status open, apartamento `204`, torre A, Reserva Completa `Si`, Envía PCV `2026-03-25`, Fecha de Promesa `2026-04-06`. The activity owner is Daniel Veliz. The deal owner is Job Jiménez, Pipedrive `24650595`.

Production, read with the service role before the fix:

| | |
|---|---|
| Comprobante | `01a1d634-3e6f-7c82-adc5-2480a1dd14a4` |
| `pipedrive_activity_id` | `340256` |
| `comprobante_on` | `2026-03-12` |
| Deal | `01a12102-53b9-7e5b-9d2a-aa0caf411ceb`, Pipedrive `49410` |
| Project | Benestare |
| Unit | canonical `204`, tower `A` |
| Deal owner | Job Jiménez, `01a12102-5145-7cb7-83b3-b182fe0122a6` |
| Role | Sales Supervisor, `carries_target` false |

Job is one of the five seeded non-reps in migration 088. Because both readers dropped him, Benestare still added up (5 + 2 = 7) and the block looked complete.

The same extract, for 2026, drops these done reservas because the deal owner is Job and the activity owner is a rep:

| Month | Activity owner | Count |
|---|---|---:|
| January | Daniel Veliz | 5 |
| January | Efren Sánchez | 4 |
| February | Daniel Veliz | 4 |
| February | Efren Sánchez | 4 |
| March | Daniel Veliz | 1 |
| April | Daniel Veliz | 4 |
| May | Daniel Veliz | 1 |

That is 15 for Daniel and 8 for Efrén, all Benestare. March is the one on the screenshot. The other 22 use the same rule.

Migration 057 also imported four March Benestare sales under the old Daniel Veliz salesperson id. Three of them have no done `reserva` activity in the extract, so this chart cannot show them:

| Excel sale | Date | Client | Pipedrive deal | What the extract has |
|---|---|---|---|---|
| `a2a0d9e9-41e3-449b-bfe1-71fa54a026c1` | 2026-03-12 | Rosa Elena Rojas Cano | `49410`, apto 204, torre A | Activity `340256`, the missing bar |
| `d74498bb-94ed-445a-bf57-bacd31606d68` | 2026-03-08 | Pedro Orlando Jose Carias Leiva | `56820`, apto 404, torre D, lost 2026-08-14 | Promesa and envío de documentación. No `reserva` activity |
| `4d47106f-4ae7-439a-ab89-4fb11f9fc260` | 2026-03-29 | Ana Paola Garcia Reyes 402 | `36150`, apto 402, torre A, lost 2026-10-29 | Envío de documentación only |
| `83ba25ae-7300-42ea-80d7-416f898d6843` | 2026-03-30 | Ana Paola Garcia Reyes 406 | `61456`, apto 406, torre A, lost 2026-10-29 | Envío de documentación only |

The Rosa Elena row was matched by client name, project, and date. The legacy `sales.unit_id` was not joined to canonical unit `204`.

## What was decided

Keep the deal owner when that person carries a target. When the deal owner does not carry a target, and the person who logged the reserva does, count the reserva under the activity owner. When neither carries a target, or the activity owner was never stored, keep dropping the row.

Store the activity owner on the comprobante. Do not rewrite `dim_deal.asesor_id`. A deal that has moved to Créditos stays owned by the coordinator for promesas, recibos, and ventas netas. Those stages still go through `inScope`, which rejects a non-rep.

Both reserva readers have to apply the same function. If only one of them includes Daniel, `advisorsInProject` sees unequal sums and the block prints “No conectado” instead of the bars.

Until the column exists, the readers must keep selecting the old column list. A deploy before the SQL would otherwise fail the Ventas page. A missing-column probe is not remembered. A successful probe is remembered for the life of the process.

## Migration 093

`scripts/migrations/093_ventas_reserva_asesor.sql`. Run by hand in the Supabase SQL editor. Safe to run twice. It checks that `ventas.fact_comprobante` and `ventas.dim_asesor` exist, then:

```sql
ALTER TABLE ventas.fact_comprobante
  ADD COLUMN IF NOT EXISTS asesor_id uuid REFERENCES ventas.dim_asesor (id) ON DELETE RESTRICT;
```

The column comment says it is the Pipedrive owner of the reserva activity, and that the reserva is counted under that asesor when the deal owner does not carry a target. The file ends with `NOTIFY pgrst, 'reload schema'`. It does not backfill rows. It does not change `dim_deal`.

The user ran it. The editor reported `Success. No rows returned`.

## Loader

`scripts/ventas/load.py`.

The module note says `fact_comprobante.asesor_id` is the Pipedrive owner of the reserva activity, and that migration 093 has to be applied before the load.

For each done `reserva` activity that already passes the existing filters, the payload now includes `asesor_id`. That value is `ensure_asesor` of the activity `owner_id`, or null when the activity has no owner. `ensure_asesor` reuses a `dim_asesor` row whose `source_user_id` is already known, including Daniel. An owner who has never been seen is appended to `new_asesores`.

Deal owners are upserted before activities are read. The length of `new_asesores` is recorded at the start of the activity file. After the file, only the tail is upserted, and that upsert happens before `fact_comprobante`, so the foreign key exists. The roster’s activity-month count is unchanged: it still looks the owner up and skips an unknown one. It does not call `ensure_asesor`.

The user ran `python3 scripts/ventas/load.py` from the repo root after the SQL. The log showed:

| | |
|---|---|
| Deals read | 95,280. Skipped Cobán 1. USD values 1. Habitación conflicts 63 |
| Units written this run | 0 |
| `dim_deal` | 95,280 |
| `dim_asesor` tail | 1/1 |
| Comprobantes | 600. Receptions 320. Visits 2,068. PCV 571. Skipped activity deals 0 |
| `fact_comprobante` | 600/600, deleted 0 |
| `fact_reception` | 320/320 |
| `fact_visit` | 2,068/2,068 |
| `fact_pcv_issuance` | 571/571 |
| Activities skipped before the month count | no due date 0, no deal 6,549, no asesor 2,358, no project 6 |
| `fact_asesor_activity_month` | 743/743 |
| Odoo | partners 1,190, payments 12,928, matched 159, unresolved 1,689, non-GTQ 286 |
| `fact_recibo` | 12,931 |
| `v_sale` | 121 |

`dim_asesor: 1/1` is one activity owner who was not already in the deal-owner batch. Which person that row is was not looked up.

The loader still mints a new uuid for every comprobante and upserts on `pipedrive_activity_id`. That was already true. After this load, activity `340256` has a new primary key.

## Readers

`src/lib/ventas/reserva-asesor.ts` holds the shared rule and the column probe.

`creditedAsesor(dealAsesorId, activityAsesorId, notRepIds)`:

- The deal owner is returned when that id is not in the non-rep set. An empty deal owner is not in the set, so an empty owner is still returned, as before.
- Otherwise the activity owner is returned when that id is present and is not a non-rep.
- Otherwise the result is null, and the reserva is dropped.

`factComprobanteHasAsesor` selects `asesor_id` with `limit(1)`. No error means the column is usable, and that answer is kept. An error whose message matches `asesor_id`, `PGRST204`, `42703`, `schema cache`, or `does not exist` means the column is absent, and that answer is not kept. Any other error is thrown.

`loadReservas` probes once, then selects `id,deal_id,comprobante_on,asesor_id` or the three columns without `asesor_id`. The credited id is what the row stores, what the non-rep check uses, and what the asesor filter compares. Project and tower still come from the deal and its unit. A comprobante with no deal is still the open-filter remainder, with an empty asesor.

`loadTotalesBridge` does the same probe and the same select. Each activity carries `asesorId`. `activityInScope` no longer calls `inScope` for reservas. It drops a null credit, then applies project, the credited asesor, and tower. `inScope` remains the gate for promesas and recibos, so Job’s deal still does not enter those stages.

The reserva stage label uses the credited id. `stageDeal` takes that id as an optional fourth argument and still defaults to the deal owner, so promesas, recibos, and the other stage rows are unchanged. The funnel count is still the number of in-scope reserva activities, including a comprobante with no deal.

A blocker that names the asesor uses `blockerAsesor`. That looks up the first in-period reserva activity on the deal and runs `creditedAsesor`. If that returns null, the label falls back to the deal owner. The intent is that a deal which is visible only because Daniel logged the reserva is not labeled Job Jiménez.

## What production holds after the load

Read with the service role after the user’s load:

| | |
|---|---|
| `pipedrive_activity_id` | `340256` |
| Comprobante id | `01a1d728-fa9f-7ae7-9a0d-b77b9cdf8821` |
| `comprobante_on` | `2026-03-12` |
| `asesor_id` | `01a12102-51a3-7246-83a2-1eed6d2d45e5`, Daniel Veliz, source `24650617` |
| Daniel’s `asesor_role` | none |
| Deal | still `01a12102-53b9-7e5b-9d2a-aa0caf411ceb`, Pipedrive `49410` |
| Deal owner | still Job Jiménez, Sales Supervisor, `carries_target` false |
| March comprobantes | 18 |
| March comprobantes with a null `asesor_id` | 0 |
| All comprobantes with a null `asesor_id` | 0 |

March in the extract was 17 shown plus this one dropped row. The table now has 18 March comprobantes, and this one points at Daniel.

With the new readers deployed, March is 18 reservas. Benestare is 8. Daniel Veliz is 1, for apartamento 204, torre A. The name on the bar is `Daniel Veliz`, the Pipedrive user name. The other 22 rows in the table above are counted under Daniel or Efrén in their own months. Promesas, recibos, and ventas netas for deal `49410` stay out, because the deal owner is still Job.

The readers are in commit `67a3a5e`. This chat did not push that commit and did not check a deployment. Until that commit is what the server is running, the page still drops the deal owner and the bar stays at 7.

## Files

| File | Change |
|---|---|
| `scripts/migrations/093_ventas_reserva_asesor.sql` | New. Adds nullable `ventas.fact_comprobante.asesor_id`. |
| `scripts/ventas/load.py` | Writes the activity owner. Upserts any asesor created while reading activities before the comprobantes. |
| `src/lib/ventas/reserva-asesor.ts` | New. `creditedAsesor` and the column probe. |
| `src/lib/ventas/vista.ts` | `loadReservas` credits the activity owner when the deal owner does not carry a target. |
| `src/lib/ventas/totales-bridge.ts` | The reserva stage, its scope check, and the blocker label use the same credit. |

Commit `67a3a5e` contains those five files. 117 insertions, 14 deletions.

## What this conversation did not do

- It did not change `ventas.dim_deal.asesor_id`. Job remains the owner of deal `49410`.
- It did not move promesas, recibos, or ventas netas off the deal owner.
- It did not give the three other March Excel sales a reserva. They still have no done `reserva` activity.
- It did not change the roster month count, Mercadeo’s lectura of `fact_comprobante`, or `src/lib/ventas/report.ts`.
- It did not edit the SDD.
- It did not run the SQL or `load.py`. The user did both.
- It did not deploy the readers.
