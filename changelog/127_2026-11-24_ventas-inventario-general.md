# 127 — Inventario general is a waterfall and status blocks of torre columns

**Date:** 2026-11-24
**Route:** `/ventas` command center, checklist item 6, `#inventario-general`. The drawing is `InventarioGeneral` in `src/app/(panel)/ventas/inventario-general.tsx`.
**Scope:** The Item 6 lock in `docs/SDD-Department-Command-Centers.md` §4.1.3, the sentences elsewhere in that SDD that still described stacked columns or a navy Total, the chart itself, and the living notes that still described the retired drawing. `buildInventory` in `src/lib/ventas/vista-operativo.ts` was not rewritten. No write to the database. No write to Odoo.

This file is the record of that work. An earlier turn in the same chat proposed a stage command and a commit message for the SDD alone, before the chart and the later notes existed. That command was not run. This chat did not run `git add` or `git commit`.

`npx tsc --noEmit` was not run. `npm test`, `npm run build`, `next lint`, `next build`, `next dev`, and `next start` were not run. No port was bound. No browser was opened. No request was sent to localhost. The database was not queried.

## What was asked

Six requests, in this order.

1. Rewrite only §4.1.3, Item 6, Inventario general. Do not touch another item, another section, code, or another file. The new text supersedes every earlier description of the Expanded Hero and the Project Detail Cards on this item, including stacked columns per torre and the cascade label placement.

   The locked shape:

   - Title: Inventario general.
   - Compact Hero and Project KPI Cards stay horizontal waterfall bars. Bottom-to-top order is exactly Congelado → Disponible → En revisión → Reservado → Vendido. No Total row. Numbers always visible, including zeros.
   - Expanded Hero and every Project Detail Card use the same layout. One block per status, in that order. Inside each block, one vertical column per torre of that project. The number sits above the column and is the count for that status × torre combination. Torre labels use the Odoo short form (“TA”, “Principal”, and the rest). Zeros remain visible. A single-torre project shows one column inside each status block. Columns are squeezed to fit: no wrap, no overflow, no internal scroll. The Expanded Hero keeps the scale previously specified for it. Each Project Detail Card uses a within-card scale.
   - Status colors stay locked: green Disponible, orange En revisión, blue Reservado, purple Congelado, gray Vendido.
   - Periodo, asesor, and modelo do not change this item. Tooltips are for provenance, on click. Projects stay in canonical order. No static files. The cascade label placement is removed. The full item fits inside the scroll budget of Items 1 and 2.

2. Read the rest of the SDD and remove every sentence that still contradicted that lock, so a later conversation cannot restore the stack, the cascade, a shared scale across Project Detail Cards, or a Total row.

3. The shell command that stages the SDD change, and a prose commit message. Do not commit from this chat. At that moment the only edit was the SDD. The chart and the later notes did not exist yet.

4. Implement Item 6 as the revised §4.1.3 specifies it.

5. Make the relevant documentation match that SDD and the code that now draws it.

6. This file.

## What was found before any edit

§4.1.3 already called Item 6 exemplary. The Compact Hero and each Project KPI Card were five horizontal waterfall rows, and the Compact Hero still added a sixth navy Total bar (`#0d2041`) that filled the track. The Expanded Hero was one card per project, and each card was one vertical stacked column per torre. The stack ran bottom to top. A count was drawn inside its segment only when the segment was tall enough, and a short segment omitted the number. The Project Detail Card was told to repeat that stack, with a scale shared inside the card. A 24 November sentence in the same section said the Hero Band was unchanged and that the Project Detail Card ruling superseded status-row blocks and a scale shared across every Project Detail Card.

The scroll-order cell for item 6 still said the opposite of the new lock: one vertical status stack per torre in the Expanded Hero, and one status-row block per torre on one shared scale in the Project Detail Card. §2.1 and §3 still told every item other than Item 9, including Item 6, to put ordinary Project Summary Columns in the Expanded Hero and ordinary Member Columns in the Project Detail Card, and they told every other item to copy Items 5 and 6. Changelog 126, written earlier the same day, recorded that last sentence. This pass is what retires it. §3 also required the number on or above every bar and required long category names to rotate. Principle 11 said the same placement. The purple note in §2 still allowed a hunt for a replacement hue. A reader who stopped at any of those sentences would have redrawn the stack.

`InventarioGeneral` already drew the waterfall, including the five rows in bottom-to-top order, and it already drew the Expanded Hero as one card per project. The columns were Recharts stacked bars (`stackId="status"`). Each status was a segment. Counts were placed by `OutsideLabels`: a slot of −2 through +2 stepped the digits across the column, which is the cascade this lock removes. A segment that could not hold the digits omitted them. The same `HeroTowers` component filled both the Expanded Hero and each Project Detail Card, so both shared that stack. The y-scale was `tower.counts.total`, the sum of the five statuses, which is the stacked-column measure §4.1.3 now forbids.

The data behind that chart was already the lock’s data. `buildInventory` reads `v_rv_units_full` through `loadRvUnits`. It keeps the five statuses `AVAILABLE`, `SOFT_HOLD`, `RESERVED`, `FROZEN`, and `SOLD`. It ignores Periodo, asesor, and modelo. Project pills select the projects. NINGUNO leaves an empty project list and zero counts. Torre labels already go through `inventoryTowerLabel`: “A” and “Torre A” become “TA”, and “Principal” stays “Principal”. Torres are already sorted with `localeCompare(..., "es")`. Projects stay in the canonical roster order. `command-center.tsx` already mounts `InventarioGeneral` sixth, after the modelo split and before Valor de proyecto. None of that was rewritten.

`UNIT_STATUS_LABELS` and `UNIT_STATUS_COLORS` already match the lock: Disponible `#22c55e`, En revisión `#f59e0b`, Reservado `#3b82f6`, Congelado `#a855f7`, Vendido `#6b7280`.

Three diagnostics, the provenance handoff, the data contract, and `docs/db-ventas.md` still described the retired chart or a different inventory. The 23 November diagnostics said the Compact Hero had a navy Total, the Expanded Hero was stacked columns, the Project Detail Card was status-row blocks on a shared scale, and a count could be omitted when the segment was short. `docs/redesign/DATA_CONTRACT.md` still named an absorción rate and four statuses. `docs/db-ventas.md` still said Inventario general lists recibos and, when an observation table is empty, says the inventory has no rows.

## What was decided

§4.1.3 is the only chart description. Shorter sentences in the SDD point at it. They do not add a second geometry.

The five statuses always run bottom to top. Congelado is the bottom. Vendido is the top. That is the waterfall row order and the status-block order. The blocks are not left to right, and Congelado is not the top block.

The waterfall has five rows. There is no Total row, no sixth figure, and no navy total bar. The sum of the five counts is the denominator of the bar lengths. That sum is not printed. Congelado’s bar starts at the left of its track. Each row above starts where the bar below ended. A zero keeps the row, draws a bar of length zero, and prints 0 at the right. The integer is the click. The bar is not.

The Expanded Hero is one project card per project, in canonical order. Those cards are not Project Detail Cards, and they are not Project Summary Columns. Each card, and each Project Detail Card, is five status blocks. Inside a block the torres sit side by side, one solid column in that status color. The column is not divided into the five statuses. The number sits above the column. The torre label sits centered under it, horizontal, in the Odoo short form, and is not rotated. The §3 vertical-label rule does not move these labels. A zero keeps the column, draws height zero, and prints 0. A status whose every torre is zero still keeps the block. Boulevard 5, and any other project with one torre, shows one column inside each of the five blocks. Santa Elena uses the same rule. Item 5’s one-column-per-modelo rule stays on Item 5.

Scale is the tallest status × torre count in that card. Every column in the card, across all five blocks, uses that scale. Expanded Hero cards do not share a scale with each other. A Project Detail Card does not share a scale with any other Project Detail Card or with the Expanded Hero. The old measure, the sum of the five statuses, is not the scale. When every count is zero, every column has height zero and prints 0.

Item 6 keeps the ten official names. It does not draw ordinary Project Summary Columns or ordinary Member Columns. Other items do not copy this geometry. Item 5 remains their reference for ordinary columns. Item 9 remains §4.1.10. Changelog 126’s sentence that Items 5 and 6 are the column reference for every item other than Item 9 is the earlier record. The SDD now says otherwise.

The checklist name in `docs/Checklists-Authoritative.md` stays “Inventario general: Vendido, congelado, disponible”. That shorter name does not drop En revisión or Reservado. The chart draws all five. That file was not edited.

## SDD

`docs/SDD-Department-Command-Centers.md`.

The first edit rewrote §4.1.3 only. The second edit, after a full read of the same file, closed the contradictions outside that section.

The 23 November (17:09 GT) header no longer tells every other item to copy Item 6’s chart. Item 5 is the reference for ordinary columns. Item 6’s geometry is §4.1.3. A 24 November (later) header records the waterfall, the status blocks, the per-project-card scale, the within-card scale, and the removal of the stack and the cascade.

§2’s note that purple might be replaced now says Item 6 does not use that exploration. Principle 11 still requires a number on or above a mark, and it now records Item 6’s two placements: the waterfall integer at the right of the row, and the status × torre count above the column.

§2.1 keeps the ten names. The Compact Hero, Expanded Hero, Project Summary Columns, Project KPI Cards, Project Detail Cards, and Member Columns rows now say what Item 6 puts in those regions. Item 6 does not draw Project Summary Columns. Its Expanded Hero is one project card per project. Its Project Detail Card is the status-block layout, and the torre columns sit inside each status block.

§3 carves Item 6 out of “every item uses Project Summary Columns and ordinary Member Columns.” The Hero Band and the Project Bands stay mandatory. Item 6 does not rename them. The vertical-label rule and the “number on or above the bar” rule both name Item 6 as the exception, and they point at §4.1.3. Item 6 has no Total row and no total block.

The Ventas intro, the scroll-order intro, the item 6 cell, and the all-items paragraph point at §4.1.3. The cell describes the waterfall, the status blocks, the Odoo labels, the two scales, and the removed cascade. It says that cell is not a second geometry.

§4.1.3 was rewritten again after the contradiction pass, so the first draft’s phrase “shared or per-project scale” is not what the section says. The scale is stated once: per project card on the Expanded Hero, within the card on a Project Detail Card, the tallest status × torre column fills the plot, and the stacked sum is not the scale. Status blocks run bottom to top. The cascade is defined as removed: status names are not stepped beside, between, or under the columns. On the waterfall, the status name stays at the left and the integer stays at the right. The section says it wins over §3, over principle 11’s placement sentence, and over every shorter summary in the SDD.

§4.2.1’s purpose line no longer calls Item 6 an “inventory-status composition.” It says inventory status is Item 6 and that Item 5 does not draw it.

The acceptance list and the implementation note in §§7 and 9 name Item 6’s waterfall and status blocks, and they leave the other items, except Item 9, on ordinary columns.

## The screen

`HeroTowers`, `OutsideLabels`, the cascade slots, and the Recharts import are gone from `inventario-general.tsx`.

`StatusList` is the Compact Hero and every Project KPI Card. Five rows, Vendido at the top and Congelado at the bottom. The status name is on the left. The track is the gray ground. The colored bar is offset by the cumulative count of the statuses below it. The integer is a button at the right, in `UNIT_STATUS_COLORS`. A zero is a bar of width zero and the digit 0. The list does not scroll. The rows share the card’s height.

`StatusBlocks` is the Expanded Hero project card and every Project Detail Card. Five blocks, Vendido at the top and Congelado at the bottom. The status name labels the block, in a fixed left column so the torre columns line up from block to block. Each torre is a column: the count, then the plot, then the short label. The plot is a flex split. The empty part grows by `scale − value`. The colored part grows by `value`. A zero grows nothing and has height zero. The tallest column in that card is the scale, across all five blocks. `FitText` shrinks a count or a torre label that is wider than its column, so “Principal” and a wide count stay whole. The labels are not rotated and do not wrap. The card does not scroll, and the band heights are unchanged: the hero is `18dvh` with the existing minimum, and each Project Band is 156px.

A click on a waterfall integer opens the tip for that status across the projects in that card. A click on a column integer opens the tip for that project, that torre, and that status. The bar and the column are not buttons. Hover does not open the tip. The tip names the status, `v_rv_units_full` (`status`, `project_slug`, `tower_name`, `unit_number`), the active project pills, and every unit in the count as project, torre, and unit number. “Cerrar” and Escape close it. The tip was already the provenance surface. The cascade was the part that was removed.

`inventario-general.module.css` dropped the Recharts overflow rules and the full-row waterfall button. It added the block, the column, and the fit-text rules. The hero grid, the 156px bands, the card chrome, and the tip position are the ones the section already used.

`command-center.tsx`, `vista-operativo.ts`, `tower-label.ts`, and `glance-stock.tsx` were not edited. The section route `/ventas/inventario-general` still mounts the older glance. The command center is the page this lock draws.

## Other documents

These were updated so they no longer describe the retired chart as current.

- `docs/Ventas-Command-Center-Diagnostic-2026-11-23-1140.md` and `docs/Ventas-Command-Center-Diagnostic-2026-11-23-1215.md`. Item 6 now matches §4.1.3. The header dates name 24 November 2026.
- `docs/Ventas-Command-Center-Diagnostic-2026-11-21.md`. The morning reading is marked retired in the Item 6 section, and the current chart is written in its place. The rest of that file stays the 21 November snapshot.
- `docs/Ventas-Provenance-and-Scroll-Handoff-2026-11-23.md`. Item 6’s row now says the click is the number, the list is the units, and the bar, the column, and hover do not open it. The code note names the tip’s fields.
- `docs/redesign/DATA_CONTRACT.md`. The intended visual for L2 Ventas 6 is the §4.1.3 chart. The source is `v_rv_units_full`. The absorción rate is gone. The 5 November 2026 unit counts stay labeled as that day’s measurement.
- `docs/db-ventas.md`. The command-center chart does not read the workbook observation and does not list recibos. An empty project stays visible with zeros.

`docs/Checklists-Authoritative.md` and `docs/General-Rules-and-Principles.md` were read and not edited. The checklist wording is the shorter name, on purpose. The general rules do not describe this chart. Files under `changelog/` other than this one were not edited.

## Files

| Path | What changed |
|---|---|
| `docs/SDD-Department-Command-Centers.md` | Item 6 lock, and the sentences elsewhere in this SDD that would have kept the stack, the cascade, the navy Total, or a requirement that other items copy Item 6. Tracked. |
| `src/app/(panel)/ventas/inventario-general.tsx` | Waterfall rows and status blocks. The stacked columns and the cascade labels are gone. |
| `src/app/(panel)/ventas/inventario-general.module.css` | Layout for the five blocks, the columns, and the waterfall integer. Band heights unchanged. |
| `docs/Ventas-Command-Center-Diagnostic-2026-11-21.md` | Item 6 section replaced. Tracked. The rest of the file is still the morning snapshot. |
| `docs/Ventas-Command-Center-Diagnostic-2026-11-23-1140.md` | Item 6 section and the date line. |
| `docs/Ventas-Command-Center-Diagnostic-2026-11-23-1215.md` | Item 6 section and the date line. |
| `docs/Ventas-Provenance-and-Scroll-Handoff-2026-11-23.md` | Item 6 click and tip. |
| `docs/redesign/DATA_CONTRACT.md` | L2 Ventas 6 visual and source. |
| `docs/db-ventas.md` | The sentence that said Inventario general lists recibos. |
| `changelog/127_2026-11-24_ventas-inventario-general.md` | This file. |

`.gitignore` ignores `docs/` for files that are not already tracked. The 23 November diagnostics, the provenance handoff, the data contract, and `docs/db-ventas.md` are in that ignored set. `git add` of a pathspec will not pick them up. The SDD and the 21 November diagnostic are already tracked, so a pathspec that names them does update the index.

`src/lib/ventas/vista-operativo.ts` and `src/app/(panel)/ventas/command-center.tsx` were not edited.

## The commit that was proposed, and what it did not cover

Midway through this chat, before the chart existed, the proposed stage command was only:

```bash
git add docs/SDD-Department-Command-Centers.md
```

That command was not run. It does not cover the component, the stylesheet, the 21 November diagnostic, or this file. A later commit of the tracked work would also name:

```bash
git add \
  docs/SDD-Department-Command-Centers.md \
  docs/Ventas-Command-Center-Diagnostic-2026-11-21.md \
  "src/app/(panel)/ventas/inventario-general.tsx" \
  "src/app/(panel)/ventas/inventario-general.module.css" \
  changelog/127_2026-11-24_ventas-inventario-general.md
```

The working tree also held Cobros, Créditos, Mercadeo, cache, and Supabase CLI edits. Those paths stay out of any stage command for this work.

The message proposed for the SDD-only commit is recorded here so it is not mistaken for a description of the chart:

```
Lock Inventario general to one status-block drawing.

Item 6 keeps the horizontal waterfall on the Compact Hero and on each Project KPI Card. The order runs bottom to top: Congelado, Disponible, En revisión, Reservado, Vendido. There is no Total row, and every count stays visible, including zeros. The Expanded Hero and every Project Detail Card now share the same layout. Each status is its own block, in that same bottom-to-top order, and each block holds one vertical column per torre of the project. The number sits above the column and is the count for that status and that torre. Torre names stay in the Odoo short form. A project with one torre shows one column inside each block. The columns squeeze to fit, with no wrap, no overflow, and no internal scroll. The Expanded Hero scales inside each project card. Each Project Detail Card scales inside itself.

This retires the stacked column per torre and the cascade placement of the counts. The scroll-order row, the ten official names, and the three-level pattern now point at §4.1.3, so a later reading cannot restore the stack or copy this geometry onto the other Ventas items. Item 5 remains the reference for ordinary columns. Item 9 remains the funnel.
```
