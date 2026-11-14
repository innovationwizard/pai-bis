# 122 — Tasa de conversión is the Pipedrive creation-week embudo

**Date:** 2026-11-13
**Route:** `/ventas` command center, checklist item 9. The old `/ventas/tasa-de-conversion` screen now draws the same band.
**Scope:** The Tasa de conversión band, the vista that feeds it, a new `ventas.embudo_deal` table, the loader for that table, and two notes in `docs/SDD-Department-Command-Centers.md`. No write to Odoo. `ventas.dim_deal` was not altered. The four-bar reserva → promesa → recibo → venta neta series is still built for Ventas totales. It is no longer drawn on Tasa de conversión.

This file is the record of that work. No commit was made from this chat. The stage command and the commit message were proposed in chat and not run here.

`npx tsc --noEmit` was not run. `npm test`, `npm run build`, `next lint`, `next build`, `next dev`, and `next start` were not run. No port was bound. No browser was opened. No request was sent to localhost.

## What was asked

Six requests, in this order.

1. Replace the Tasa de conversión band. The band was the four-bar sequence Reservas → Promesas firmadas → Recibos publicados → Ventas netas. The replacement is the managers’ daily Pipedrive Embudo, a creation-week cohort, not a stage-entry funnel. Verified against the 22 September 2026 Boulevard 5 “semana pasada” screen: Brenda Pérez shows exactly 108 deals created that week and a 0 % win rate. Do not invent numbers. Use only fields that already exist.

   Cohort rules, to be followed exactly:

   - Cohort = deals whose `add_time` falls inside the selected period, interpreted in America/Guatemala.
   - For a week, the window that matched the screen is Monday 00:00 through the next Monday 00:00, exclusive.
   - Include open, lost, and won deals. Do not drop open deals.
   - The commercial pipelines named in that request were Benestare, Bosque Las Tapias, Boulevard 5, Santa Elena, Casa Elisa, and Torre Cobán. Leave Créditos, Eventos, and Marketing out.
   - Join pipelines by stage position, not by stage name. Torre Cobán uses the labels Contacto, Calificado, and Reseva for the corresponding positions.
   - The eight positions, in order: Ingreso, Contactado, En Perfilamiento, Calificados, Cita Programada, Visita Efectiva, En Decisión, Reserva.
   - A deal is counted in its current stage and in every stage before it. A won deal is counted in every stage.
   - The percentage beside a bar is the next bar’s count divided by that bar’s count.
   - Headline win rate = won deals divided by deals that reached Ingreso.
   - Fields required: `stage_id`, `status`, `add_time`, `pipeline_id`. Stage history is not required and must not be requested.

   Layout: first “de todos los proyectos”, one horizontal bar funnel of the eight positions. Immediately after, “por proyecto”, the same funnel once per commercial project, in canonical order. A project with zero deals created in the period is still shown, all bars 0, rates 0 or “—”. Santa Elena is included. Every bar shows its absolute count. Every conversion percentage is shown under or beside its bar. The headline win rate is shown once per funnel. Horizontal bars, as the SDD already says for item 9. Project identity uses the existing dark corporate blues. Standing rules: 0-click, amounts on every graphical element, Spanish colon for period labels, freshness stamp on the same line as the period description at the same weight and not bold, filter-to-content separator after the filter battery, no “En revisión”, no “Sin dato” placeholders, comment out explanatory notes, never write back to Odoo. The period control already on the page drives the `add_time` window. Default remains current month and all projects unless the user has already selected otherwise.

   After implementation, confirm the 14–20 September 2026 window (Monday–Sunday, Guatemala) for Boulevard 5 produces 108 deals for Brenda Pérez and a 0 % win rate. If the numbers do not match, stop and report the discrepancy. Do not adjust the rules to force a match.

   Primary files named in the request: `src/app/(panel)/ventas/command-center.tsx` and `src/app/(panel)/ventas/lower-bands.tsx` (`TasaBand`). Update the living SDD note only if the implementation reveals a necessary clarification. Do not change the meaning of item 9. Do not shade the section. Do not leave the old four-bar sequence.

2. Does the SDD say anything about Torre Cobán?

3. Add this verbatim to the SDD, under permanent scope: any name containing “Cobán” or “Coban” is out of scope; development on hold indefinitely; in-scope projects remain only Boulevard 5, Benestare, Bosque Las Tapias, and Santa Elena.

4. Per principle, code must not contradict the SDD. Update the code accordingly.

5. The shell command that stages only the files from this conversation, and a prose commit message. Do not commit from this chat.

6. This file.

## What was found before any edit

`ventas.dim_deal` stores `pipeline_id`, `add_time`, `add_on`, and `pipedrive_status`. It does not store `stage_id` or a stage position. The ventas loader skips Torre Cobán. `ventas.dim_project` refuses the names Torre Cobán and Torre Coban. Créditos, Eventos, and Marketing pipelines are already rows in `ventas.dim_source_pipeline`, and crédito deals sit on `ventas.dim_deal` under the building’s project. Reading `dim_deal` by project would mix those pipelines into the embudo and still could not place a deal on a stage.

The Pipedrive extract on this machine, `extraction_pipedrive/output/resolved`, refreshed 13 November 2026, has the four fields on `deals.csv` and the stage order on `stages.csv`. The six commercial pipelines in that extract, with Pipedrive ids, are Benestare (2), Bosque Las Tapias (3), Boulevard5 (4), Santa Elena (5), Casa Elisa (13), and Torre Coban (17). Each of those six has eight stages, `order_nr` 1 through 8. No commercial deal in that extract was deleted, pointed at a foreign stage, or sat outside positions 1–8. Status counts across those six pipelines: 3,676 open, 90,406 lost, 8 won. 94,090 deals in total. By pipeline: Benestare 43,014, Boulevard 5 28,265, Bosque Las Tapias 20,410, Santa Elena 2,300, Casa Elisa 100, Torre Cobán 1.

Brenda Pérez is Pipedrive user `26459864`. Her ventas asesor row is `01a12102-5498-70c2-83d9-c9725267a186`.

The live database, queried with the service role, confirmed `ventas.embudo_deal` did not exist, `dim_deal` did, and the asesor row above is Brenda Pérez. The linked Supabase CLI can run SQL. Applying migration 092 from this chat was blocked by review. The file was handed to the user. The user ran it, then ran the loader. See “What was run outside this chat”.

The SDD, before this conversation, did not contain the words Cobán or Coban. Canonical project order was, and remains, BOULEVARD 5, BENESTARE, BOSQUE LAS TAPIAS, SANTA ELENA. Item 9’s table cell was, and remains, “Horizontal bar funnel of the stages currently tracked for the users’ familiar flow”.

## What was decided

The familiar flow is the creation-week embudo, not the four gates already used by Ventas totales. Those four gates stay in `totales.funnel`. Tasa de conversión stops reading them.

Stage position is not on `dim_deal`, and putting Torre Cobán deals onto `dim_deal` would either violate the project-name check or file them under Sin dato and change other ventas counts. The embudo therefore has its own table, `ventas.embudo_deal`. The loader reads `stage_id`, `status`, `add_time`, and `pipeline_id` from the extract. It does not read stage history. It does not write to Odoo.

The page period is inclusive Guatemala calendar days. `add_on` is the Guatemala day of `add_time`. Filtering `add_on` from the period start through the period end is the same window as Monday 00:00 through the next Monday 00:00 when the user selects Monday through Sunday. That equivalence was checked on the Brenda cohort: both the instant window and the calendar-day window return 108 deals and 0 won.

A deal with status `won` increments every position, whatever its `stage_order`. A deal with status `open` or `lost` increments positions 1 through its `stage_order`, capped at 8. Any other status is ignored. An open or lost deal whose order is not an integer of at least 1 does not enter the counts. The win rate is won divided by the Ingreso count. Ingreso is 0, so the rate is null and the screen shows “—”, not 0 %. A bar with a following stage and a count of 0 has a null next rate and shows “—”. A bar with a following stage and a positive count shows next divided by current, including 0 %. Reserva has no following stage and no percentage pill.

The first implementation included Casa Elisa and Torre Cobán, because request 1 named them. Request 3 then put a permanent scope note in the SDD: any name containing Cobán or Coban is out of scope, development on hold indefinitely, and the in-scope projects are only the four. Request 4 required the code to follow that note. Casa Elisa and Torre Cobán came out of the funnel, the loader, the allowed slugs, and the bar colors that had been added for them. The item 9 clarification was edited so it no longer tells a later reader to keep those two projects on the band. The item 9 table cell was not rewritten.

The page queries only the four slugs. Rows for any other slug, if a previous load left them in the table, are not read. The migration file, as it stands now, also deletes those rows and tightens the check. The SQL the user already ran is the earlier text. See below.

## Verification of the 108

Against `deals.csv`, Boulevard 5 (`pipeline_id` 4), owner `26459864`, `add_time` from 2026-09-14 00:00 America/Guatemala inclusive to 2026-09-21 00:00 exclusive, `is_deleted` false, status in open, lost, or won:

| | |
|---|---|
| Deals | 108 |
| Won | 0 |
| Deleted in that slice | 0 |
| Status | 108 lost |
| Unmapped stage | 0 |

Current stage of those 108, which is the stage on the 13 November extract, not a reconstruction of the stage on 22 September:

| Position | Stage name on Boulevard 5 | Deals sitting there | Cumulative count |
|---|---|---|---|
| 1 Ingreso | [BLV5] Ingreso | 22 | 108 |
| 2 Contactado | Contactado | 49 | 86 |
| 3 En Perfilamiento | En Perfilamiento | 29 | 37 |
| 4 Calificados | Calificados | 3 | 8 |
| 5 Cita Programada | Cita Programada | 3 | 5 |
| 6 Visita Efectiva | Visita Efectiva [BLV5] | 2 | 2 |
| 7 En Decisión | En Decisión | 0 | 0 |
| 8 Reserva | Reserva | 0 | 0 |

Next-bar rates from those cumulative counts: 86/108, 37/86, 8/37, 5/8, 2/5, 0/2, and no rate on En Decisión because its count is 0. Reserva has no next bar. Win rate 0/108.

`embudoFunnel` was run on that same 22 / 49 / 29 / 3 / 3 / 2 distribution, all lost. It returned counts `108, 86, 37, 8, 5, 2, 0, 0` and win rate 0. A separate check, one won deal at position 2 plus one open deal at position 1, returned counts `2, 1, 1, 1, 1, 1, 1, 1` and win rate 0.5. An empty list returned a null win rate and eight zeros.

The calendar-day filter `add_on` from 2026-09-14 through 2026-09-20 returned the same 108 and the same 0 won as the instant window. The rules were not adjusted.

The user’s loader run printed `stored brenda_blv5 108 won 0`. That confirms the rows that were written, for that cohort, match the screen. That run wrote 94,090 deals, which is the six-pipeline total, so it was the loader from before request 4. The current loader will not write Casa Elisa or Torre Cobán.

## What was run outside this chat

The user ran the SQL in the Supabase editor. The screenshot shows “Success. No rows returned” and the file ending at `NOTIFY pgrst, 'reload schema';` on line 70, with `CREATE INDEX` for `embudo_deal_period` on line 52. That is the first revision of `092_ventas_embudo_deal.sql`. The current file has the four-slug delete and the constraint replace before those indexes, and `NOTIFY` is on line 86. The screenshot is not a run of the current file.

The user then ran `python3 scripts/ventas/load_embudo.py`. The terminal shows:

```
embudo deals 94090 skipped 0 new_asesores 0 brenda_blv5_2026-09-14_20 108 won 0
embudo_deal: 94090/94090
stored brenda_blv5 108 won 0
```

94,090 is every non-deleted deal on the six commercial pipelines in the extract. The table, as loaded, still contains Casa Elisa (100) and Torre Cobán (1). The page built from the current code does not select those slugs. To make the table match the four-project check, run the current `092` file again (it deletes every other slug and replaces `embudo_deal_slug`) and run the loader again.

## Files

| File | What changed |
|---|---|
| `src/lib/ventas/embudo.ts` | New. The eight stage labels, the four pipelines, and `embudoFunnel`. |
| `src/lib/ventas/vista-types.ts` | `ConversionVista` is now `all` and `projects`, each an `EmbudoFunnel`. The old leads / visitas / ventas / PCV fields are gone. `RateRow` is gone. |
| `src/lib/ventas/vista-operativo.ts` | `buildConversion` reads `embudo_deal` and calls `embudoFunnel`. The old lead, visit, sale, and PCV helpers used only by that builder are gone. |
| `src/lib/ventas/vista.ts` | The tasa question string is “Tasa de conversión”. It is no longer the sentence that asked how many leads reach visita, venta, and PCV. |
| `src/app/(panel)/ventas/lower-bands.tsx` | `TasaBand` draws the two headings and one `EmbudoChart` per funnel. It no longer takes `FunnelStage[]` or `onStage`. |
| `src/app/(panel)/ventas/lower-bands.module.css` | Unshaded band, win-rate line, project hairline, wider name column, zero-tick colors for the four projects. |
| `src/app/(panel)/ventas/command-center.tsx` | The page requests `tasa-de-conversion` and passes that vista to `TasaBand`. Asesor choices from that vista join the existing list. |
| `src/app/(panel)/ventas/glance-stock.tsx` | The old tasa screen renders `TasaBand`. The lead / visita / venta / PCV cards, the monthly line, and the fuente / asesor tables are gone from that component. |
| `scripts/migrations/092_ventas_embudo_deal.sql` | New table, indexes, select policy, grants. After the scope note: only the four slugs, and a delete of anything else so a second run corrects the first. |
| `scripts/ventas/load_embudo.py` | New. Reads the extract and replaces `embudo_deal`. Skips a pipeline whose name contains Cobán. Writes only the four projects. |
| `docs/SDD-Department-Command-Centers.md` | The verbatim permanent-scope note under principle 12. A clarification under item 9. The item 9 table cell is unchanged. |

`src/lib/ventas/report.ts` still computes the old lead and visit rates when its section is `tasa-de-conversion`. This conversation did not change that file. `src/app/(panel)/ventas/totales-view.tsx` still draws `totales.funnel` on the old ventas-totales screen. The command center does not use that component for item 9. Casa Elisa remains in older modules (mercadeo colors, cobros, the ventas project dimension). Those files were not part of this band and were not edited.

## Counting

`embudoFunnel` in `src/lib/ventas/embudo.ts` is the only place the bars are counted.

Won: add 1 to all eight positions, and add 1 to the won tally. Open or lost: if `stageOrder` is an integer greater than or equal to 1, add 1 to each position from 1 through `min(8, stageOrder)`. The Ingreso count is position 1. Win rate is won / Ingreso, or null when Ingreso is 0. `nextRate` on bar `i` is count `i+1` / count `i` when bar `i` has a next bar and count `i` is greater than 0. Otherwise `nextRate` is null. Reserva has `hasNext` false.

`buildConversion` loads `pipeline_slug`, `status`, `stage_order`, and `asesor_id` from `ventas.embudo_deal` where `add_on` is between the vista’s `from` and `to`, inclusive. Pages of 1,000, ordered by `pipedrive_deal_id`, stop at 200,000 rows and then throw rather than return a short count. An empty project selection (`proyecto=ninguno`) does not query. A null project selection is the four slugs. A list of project ids is matched with `projectKey` against the four labels, in canonical order. An asesor id, when set, is `asesor_id =`. Asesor choices are the owners of the loaded rows whose names are not “Sin dato”, “Sin asesor”, or “Asesor pending”. A read error is reported as “No se pudo leer la tasa de conversión.” The raw database message is not put on the screen.

The aggregate funnel is every loaded row. Each project funnel is the same rows filtered to that slug, including a slug with no rows.

## Table

`ventas.embudo_deal`, migration 092. One row per Pipedrive deal id.

| Column | Role |
|---|---|
| `pipedrive_deal_id` | Primary key. The extract’s deal id. |
| `pipeline_slug` | `boulevard-5`, `benestare`, `bosque-las-tapias`, or `santa-elena`. |
| `asesor_id` | `ventas.dim_asesor`. Required, so the page’s asesor filter can match. |
| `stage_order` | 1 through 8. The stage’s `order_nr` on that deal’s pipeline. |
| `status` | `open`, `won`, or `lost`. |
| `add_time` | The extract timestamp, stored as timestamptz. |
| `add_on` | Guatemala calendar day of `add_time`. This is the period filter. |
| `load_id` | One uuid for the run. After a successful upsert, rows whose `load_id` is not that uuid are deleted. |

Indexes: `(add_on, pipeline_slug)` and `(asesor_id, add_on)`. Row level security is on. `authenticated` may select when `jwt_role()` is `master`, `torredecontrol`, or `gerencia`. `service_role` may select, insert, update, and delete. `authenticated`, `anon`, and `PUBLIC` may not write. The statement ends with `NOTIFY pgrst, 'reload schema'`.

The current file, after the scope change, deletes every row whose slug is not one of the four, drops `embudo_deal_slug`, and adds it again with only those four values. That block is what a second run of the file does to a table created by the first revision. The first revision’s check also allowed `casa-elisa` and `torre-coban`, and its column comment mentioned Torre Cobán’s stage labels. Both are gone from the file.

## Loader

`python3 scripts/ventas/load_embudo.py`, from the repo root, after 092. It uses the ventas `Api` from `scripts/ventas/load.py` and the extract path that file already points at.

It reads `pipelines.csv`, `stages.csv`, `users.csv`, and `deals.csv`. A pipeline name whose letters, with accents stripped, contain `coban` is skipped before the allow-list. The allow-list is Benestare, Bosque Las Tapias, Boulevard5, and Santa Elena, mapped to the four slugs. Créditos, Eventos, Marketing, Casa Elisa, and Torre Cobán are not in that map.

A deal is skipped when it is deleted, when status is not open, won, or lost, when the stage is missing or belongs to another pipeline, when `order_nr` is outside 1–8, when owner or `add_time` is empty, or when `add_time` does not parse. `add_time` without a zone is treated as UTC, then converted to America/Guatemala for `add_on`. That is the same convention the ventas loader already uses.

Owners who are not yet in `dim_asesor` are inserted, keyed by Pipedrive user id, with the name from `users.csv`. The run that wrote 94,090 deals inserted no new asesores.

Upserts go out in batches of 400 on `pipedrive_deal_id`. Then every row with a different `load_id` is deleted. The script prints the in-memory Brenda count for Boulevard 5 and 14–20 September 2026, and after the write it counts the stored rows and the stored won rows for her asesor id. It does not refuse to write when that count is not 108. A later won deal in that week must not freeze the loader. This chat checked the count before treating the rules as confirmed.

The script does not call the full `load.py` main, does not change `dim_deal`, and does not write to Odoo.

## The band

`TasaBand` is one `section.bandPlain`. No card fill, no border, no extra padding. The title is “Tasa de conversión”.

Under it, “de todos los proyectos”, then one funnel. Then “por proyecto”, then one article per project in this order: Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena. Each article has the project name, a top hairline, and the same funnel at the thinner row weight. The all-projects funnel uses the project weight: 44 px bars in a 56 px row. Each project funnel uses the row weight: 26 px bars in a 36 px row. A project with no deals in the period is still an article of eight zeros.

Each funnel prints “Tasa de ganados” and the rate once, above the bars, at 14 px and weight 700. The eight stage names are the left column, 176 px. The bar is the project blue when the funnel is one project (`data-project` is the slug). The all-projects bars are navy `#0d2041`. A zero is a 2 px tick in that same color, with the digit 0 beside it. A positive count is printed just past the end of the bar. The scale is the tallest count, so Ingreso fills the row, with grid lines at 0, 25, 50, 75, and 100 percent of that count. The percentage pill sits in a 76 px column beside bars that have a next stage. The pill is “—” when the rate is null, “0%” when the rate is 0, otherwise one decimal when the percent is not a whole number, using `es-GT` (so a fractional percent uses a comma). Reserva has an empty pill cell so the bars still align.

The bars are not buttons. The old `onStage` path into the etapa focus is not wired from this band. The etapa focus type remains in `command-center.tsx` for the commented detail table.

While the vista is absent, the title stays and `StatusLine` shows the section error or “Cargando…”. There is no “Sin dato”, no “En revisión”, and no definition sentence on the band.

Colors, already used on the Ventas bars:

| Project | Slug | Bar |
|---|---|---|
| Boulevard 5 | `boulevard-5` | `#3d6f8f` |
| Benestare | `benestare` | `#0d2041` |
| Bosque Las Tapias | `bosque-las-tapias` | `#0573b0` |
| Santa Elena | `santa-elena` | `#1a4a68` |

`#6d8ea3` and `#16324f` were added for Casa Elisa and Torre Cobán and then removed with those pipelines.

The command center `SECTIONS` list includes `tasa-de-conversion`, so the existing period, project, and asesor controls are sent to that vista. The period line, the colon after the period label, the freshness stamp, and the filter rule were not moved and were not restyled. Default period is still “Este mes”. Default projects are still all of the pill projects, which is `projectIds === null`, which is the four embudo pipelines.

`/ventas/tasa-de-conversion` still mounts `GlanceView`, which still prints the vista question. That question is now the title “Tasa de conversión”. The chart under it is `TasaBand`.

## SDD

Under principle 12, verbatim:

```
Per permanent scope:
Any name containing “Cobán” or “Coban” is out of scope.
Explicit note: development on hold indefinitely.
In-scope projects remain only: Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena.
```

Under the item 9 row, a paragraph records that the familiar flow is this creation-week embudo, the cohort, the eight positions joined by order, the counting rule, the next-bar percentage, the win-rate headline, all in-scope projects first and then one funnel per project, Santa Elena included, and that stage history is not used. The table cell for item 9 is still the original sentence.

## What this conversation did not do

No commit. No `git add`. The proposed stage list is the eleven files in the table above. `changelog/121_2026-11-13_ventas-columns-and-outside-tables.md` was already staged when that command was proposed, and the proposal said to unstage it so it would not ride into this commit.

The migration was not applied from this chat. The loader was not run from this chat. The database write in the screenshots is the user’s run of the first SQL revision and the six-pipeline loader.

`report.ts`, `totales-bridge.ts`, `totales-view.tsx`, the ventas totales hero, and the reserva counts that read `totales.funnel` were not switched to this cohort. Inventario, canales, metas, and the other checklist bands were not edited. No Odoo table was written.
