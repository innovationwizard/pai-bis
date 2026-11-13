# 121 — Ventas columns take the project blues, and the two tables outside the checklist come off the page

**Date:** 2026-11-13
**Route:** `/ventas` command center. Checklist items 5 through 14, except item 4 (Ventas por canales), which was left as it was. Then the two tables that are not on the Operativo list.
**Scope:** Presentation in `lower-bands.tsx`, `lower-bands.module.css`, and `command-center.tsx`. No SQL migration. No change to a vista builder, a loader, or `docs/SDD-Department-Command-Centers.md`. No write to the database. No write to Odoo.

This file is the record of that work. The two commits below landed before this file existed. This file is not part of those commits.

| Commit | Time | Message |
|---|---|---|
| `3180011` | 2026-11-13 12:39 −0600 | Give Ventas por modelo its own project blue and a line between groups, keep all four projects on Inventario por proyecto, and stand the bands from Valor de proyecto through promociones as vertical columns, so every amount keeps its number. |
| `836298f` | 2026-11-13 13:27 −0600 | Hold the exception list and the line-level sales table off the Ventas command center, so the page ends with the checklist and those two tables stay outside the 14 Operativo items. |

`3180011` also contains `changelog/120_2026-11-12_ventas-inventario-columns.md`. That file was already staged when this conversation started. This conversation did not write it and did not edit it. It rode into the commit because it was already in the index.

`npx tsc --noEmit` was not run. `npm test`, `npm run build`, `next lint`, `next build`, `next dev`, and `next start` were not run. No port was bound. No browser was opened. No request was sent to localhost. The database was not queried or written from this chat.

## What was asked

Four requests, in this order.

1. Finish the Ventas Command Center gap closure against `docs/SDD-Department-Command-Centers.md`. Every remaining checklist row should be Yes on Present, Correct data, and Follows SDD. Item 4 is skipped. In order: finish item 5 (Análisis de inventario / Ventas por modelo) with project-identifying dark blues and a confirmed separator between project groups; finish item 6 so Inventario por proyecto shows Boulevard 5, Benestare, Bosque Las Tapias, and Santa Elena at the same time; then take items 7 through 14 to the same standard. Standing rules for that pass: omit En revisión; Santa Elena stays in the inventory and sales bands with its real counts; project identity uses the current dark blues; Torre and Modelo stay local to item 5; vertical columns are preferred; no “Sin dato”, “Sin modelo”, or “Sin torre”; every graphical amount shows its number; the page stays one scroll with no extra click; explanatory notes are commented out; nothing writes back to Odoo. Do not run local tests, do not start a server, and do not open a browser.

2. The shell command that stages only the files from that pass, and a prose commit message. Do not commit from this chat.

3. Comment out the two elements that sit outside the 14 Operativo items: “Tratos que todavía no son venta” and “Detalle de ventas”. Then the stage command and a prose commit message for that pass.

4. This file.

Requests 2 and 3 asked for a stage command and a commit message. Those commands were proposed in chat. The commits above are the ones that landed. Request 2 staged the two lower-band files. The already-staged changelog 120 was still in the index and went out with them.

## What was decided

Items 5 and 6 already had project blues, a CSS border between groups, and a shrink-to-fit row for Inventario por proyecto. The border was an adjacent-sibling rule, and the width of each group still grew with the number of towers, so a wide project could crowd the other three. This pass replaces that border with a real element and gives the four Inventario por proyecto groups equal width.

Items 7, 8, and 10 through 14 were horizontal bars. They are now one vertical-column chart, `MarkColumns`. Item 9 stays a horizontal bar funnel, because section 4.1 of the SDD specifies that shape for Tasa de conversión.

The numbers on the new columns are the numbers the vistas already return. No metric was redefined. Reembolso and retención are still absent from the desistimientos payload, and they are not drawn as zero. When the price-rise table is not loaded, Subidas de precios does not draw four zeros. When the F&F marks are not loaded, period sales are not drawn as if they were F&F.

Explanatory notes on the bands this pass touched are commented out. The empty sentence “Nada que graficar en este periodo.” now returns nothing. The two tables under Control Referidos are commented out with the hairline that introduced them. The functions that draw those tables stay in the file.

## Files

| File | What changed |
|---|---|
| `src/app/(panel)/ventas/lower-bands.tsx` | Project blues in one map. A drawn separator between small-multiple groups. Equal width for the four Inventario por proyecto groups. `MarkColumns` for the single-series bands. Commented notes. F&F no longer graphs unloaded sales. Subidas de precios no longer graphs an unloaded rise table as zero. |
| `src/app/(panel)/ventas/lower-bands.module.css` | The separator is its own bar. Money axes are wider. The small-multiple row stretches so the separator runs the full height of the group. |
| `src/app/(panel)/ventas/command-center.tsx` | “Tratos que todavía no son venta” and “Detalle de ventas” are inside a JSX comment, with the rule above them. The scroll into `#vc-detalle` is commented out. |
| `changelog/120_2026-11-12_ventas-inventario-columns.md` | Not edited here. Already staged, and included in `3180011`. |

`landing-blocks.tsx`, the vista builders, and the SDD were not edited.

## Shared drawing

`PROJECT_BLUE` is the palette already used on the Ventas landing bars.

| Project | Slug | Color |
|---|---|---|
| Boulevard 5 | `boulevard-5` | `#3d6f8f` |
| Benestare | `benestare` | `#0d2041` |
| Bosque Las Tapias | `bosque-las-tapias` | `#0573b0` |
| Santa Elena | `santa-elena` | `#1a4a68` |

`projectBarColor` reads that map for Ventas por modelo. An unknown slug falls back to navy `#0d2041`. `projectFill` matches a label with `projectKey`, so `SANTA ELENA` and `Santa Elena` take the same blue. `markFill` uses red `#b91c1c`, amber `#b45309`, or blue `#0573b0` when the mark sets that tone. Otherwise it uses `projectFill`, and navy when the label is not one of the four projects. A motivo stays red even if its name matches a project. A project row that sets no tone takes its blue from the label.

`MarkColumns` is the single-series vertical chart. It drops a row whose label is “Sin dato”, “Sin torre”, “Sin modelo”, “Sin asesor”, “Asesor pending”, or “Meta pending”. The plot is 252 px (`TOWER_PLOT`). The scale is the existing `columnScale`, 12 percent above the tallest column. Each mark is one segment. A count axis is 44 px wide. A money axis is 104 px wide and its ticks are 10 px, so a quetzal or dollar amount fits beside the plot. A column with an id and an `onPick` is still a button. The status legend is not drawn, because these columns are not an inventory stack.

`StackColumn` now takes a formatter. The default is still `count`, so Inventario general is unchanged in what it prints. A segment may carry `text`. The printed number is that text when it is set, otherwise the formatted value. A string longer than nine characters is drawn in the colored chip even when the slice is tall enough for an inside label, so a long amount is not clipped inside a narrow column. A zero column with exactly one segment uses that segment’s color for the zero and the baseline tick. A stacked inventory column still has four segments, so its zero tick stays navy.

`emptyNote` returns `null`. The old sentence is left in a comment. Every band that used to say there was nothing to graph now shows the title and no sentence.

The small-multiple separator is a `span.miniRule` between groups, 3 px wide, `#0d2041`, with 14 px of margin on each side. Inventario por proyecto passes `fit`, and that rule uses `miniRuleFit` (8 px of margin). The track aligns stretch, so the rule runs from the top of the project title to the bottom of the labels. The old `border-left` on `.mini + .mini` is gone.

When `fit` is set, each project group is `flex: 1 1 0`. The four groups share the row. Columns inside a group still shrink (`width: 0`, `flex: 1 1 0`, `min-width: 0`). Ventas por modelo and Inventario por modelo do not pass `fit`. Their groups still grow with the number of columns.

## 1. Item 5 — Ventas por modelo

Torre and Modelo stay on this band only. Default is still Todas and Todos. The columns are still `RESERVED` + `SOLD` from the vista’s `modelSales`. Boulevard 5 is still the letter families. Santa Elena still inserts `491.91 m²` and `581 m²` at zero when neither local filter is set.

What changed is the color and the separator. Each column is `projectBarColor` for its slug, including a zero Santa Elena column, because a one-segment zero now paints with the segment color. The groups are separated by `miniRule` rather than by a border on the next section.

## 2. Item 6 — Inventario general

The three bands are unchanged in content. Inventario de todos los proyectos is still one stacked column per roster project. Inventario por proyecto still collapses Santa Elena to a single Casas column with the real stock counts, and still draws a fallback column from the project totals when another project has no named tower. Inventario por modelo still forces Santa Elena’s two sizes onto the band. En revisión is still absent. Status colors are still the availability grid.

What changed is the layout of Inventario por proyecto and the notes. That band still passes `fit`. Each of the four groups now takes an equal share of the row, so a project with many towers cannot push another project off the card. The separator is the same `miniRule` as item 5, with the tighter fit margin. The asesor sentence and the inventario notice are commented out. `asesorNote` is still a prop; the function voids it so the call from `command-center.tsx` does not have to change.

## 3. Item 7 — Valor de proyecto

The price lines are the same two charts: quetzales in navy, dólares in `#0573b0`, 220 px, a label on every point. A currency still appears when any month is not zero, and quetzales still appears when dólares is entirely zero. An empty month list still calls `emptyNote`, which now renders nothing.

Impacto del descuento is no longer two horizontal amber bars. It is `MarkColumns` with a money axis. The two columns are still “Ventas con descuento” (`saleGtq`, or 0) and “Descuento” (`gtq`, or 0). If both amounts are null, there is still no chart. The notice is commented out. The control card Descuentos, further down, is still the breakdown by tipo.

`valor-del-proyecto` is still requested and still unused on the page. This pass did not put it back.

## 4. Item 8 — Desistimientos

Motivo and proyecto are vertical columns. The money switch is the same: if any motivo or any project row has `gtq`, both charts format as quetzales and a null amount is 0. Otherwise both charts are unit counts. Motivo is red. Proyecto uses `orderedProjects`, so the roster projects are present, including Santa Elena at 0, in the project blue. A click on a project with an id still filters by proyecto. The notice is commented out.

Reembolso and retención are not series. The builder still says those amounts are not in the base, and this pass does not invent them. The column is the deal value when `gtq` is present, and the count when it is not.

## 5. Item 9 — Tasa de conversión

Unchanged in shape. It is still `clickableChart`: horizontal bars, project weight, navy, the stage count on the bar, and the stage-to-stage rate in the neutral pill when `conversion` is not null. A click still calls `toggleFocus({ kind: "etapa" })`. The SDD asks for a horizontal bar funnel here, so this item was not turned into columns. An empty funnel now renders nothing under the title, because `emptyNote` returns null.

## 6. Item 10 — Descuentos

`AmountCard` no longer takes a bar weight and no longer calls `clickableChart`. Descuentos is `MarkColumns`. If any tipo has `gtq`, the column is the amount and a null amount is 0. Otherwise the column is the unit count. Amber. A “Sin dato” tipo is omitted by `MarkColumns`. The notice is commented out. The card title stays when there are no rows.

## 7. Item 11 — Subidas de precios

The roster chart is vertical, in the project blues, with a money axis. Quetzales and dólares stay on separate charts and are not added together. The subtitles “Quetzales” and “Dólares” still appear only when both charts are on screen.

New gate: `pricesUnloaded` is true when `gtq` is null, `usd` is null, and `byProject` is empty. That is the builder’s “table not loaded” payload. The band then draws no columns. A loaded period whose sums are 0 (`gtq` and `usd` are numbers, including 0) still draws the four roster projects at 0, Santa Elena included. The notice is commented out.

## 8. Item 12 — F&F y casos especiales

`casoMarks` prepares the rows. A tipo labeled with a missing-data phrase is omitted. The `resto` row (“Ventas del periodo” or “Resto de ventas”) is kept only when `marked` is greater than 0. When the case-mark table is not loaded, `marked` is null and the only row used to be the period’s sales. That row is no longer drawn. The card title remains.

When every remaining row has `gtq`, the column is the amount and the axis is money. When some rows have an amount and some do not, the column stays the unit count and the printed text is `{unidades} · {quetzales}` so the amount is still on the mark. The notice is commented out.

## 9. Item 13 — Control Referidos

The chart is vertical. Counts by tipo stay. A tipo with a missing-data label is omitted. If that removes every tipo and `si` is greater than 0, one column labeled Referidos shows `si`. The referidor list is still under the heading Referidores. These sentences are commented out: the notice, “Ningún trato está marcado como referido.”, the “sin tipo de referido” line, the “estos tratos no traen referido…” line, and the “la lista trae n de n” line. `scopedDeals === 0` still renders nothing under the title. Referidos are still not a filter on Ventas por canales. The vista still has no project breakdown; the SDD allows tipo or proyecto, and the payload has tipo.

## 10. Item 14 — Promociones

Same `AmountCard` path as Descuentos. Navy. Money when any tipo has `gtq`, otherwise units. The month series on the promoción vista is still not drawn. The notice is commented out.

## 11. The two tables outside the checklist (`836298f`)

Both lived in `#vc-detalle`, after Control Referidos.

| Element | Why it is outside |
|---|---|
| Tratos que todavía no son venta | Not on the Operativo list. It lists deals with reserva, promesa, or recibo that have not closed both gates. It is not a chart of items 1–3 or of item 8. |
| Detalle de ventas | Not on the Operativo list. It is a line-level listing of closed sales. The SDD allows an optional Band C table and says that table is not required for checklist coverage. |

The JSX comment starts at the hairline above the section and ends after the section. The page now ends on Control Referidos. There is no trailing rule.

The effect that scrolled `#vc-detalle` into view on `focus` is commented out with it. Chart clicks still call `toggleFocus`, and Restablecer still clears `focus`. Nothing on the page reads that focus to filter a table.

These functions are still in `command-center.tsx` and are not mounted: `Blockers`, `SalesTable`, `StageDetail`, `DealTable`, `listedDeals`, `compareBlocker`, `Th`, `focusText`, `lineMatches`, `blockerMatches`, and `unitsFromNetas`. `GapBars` was already unmounted before this pass. Uncommenting the section would mount the two tables again, including the focus chip and the three focus notes.

## What the page shows now

The sticky filter battery is unchanged: project pills, Periodo, Asesor, Restablecer, the period line with its colon, the freshness stamp on that same line, and the rule under the battery.

Below Ventas por canales, in the same order as before:

1. Tasa de conversión, still horizontal.
2. Inventario de todos los proyectos, Inventario por proyecto, Inventario por modelo. The middle band holds all four projects at once, with a navy line between them.
3. Ventas por modelo, with Torre and Modelo, project blues, and the same line between projects.
4. Valor de proyecto: price lines, then two vertical money columns for the discount impact.
5. Desistimientos por motivo, then Desistimientos por proyecto.
6. Descuentos, Subidas de precios, F&F y casos especiales, Promociones, still in `.vc-grid-2`.
7. Control Referidos, counts and the referidor list.

Brecha contra el ritmo stays in the comment it was already in. The two detail tables are in a new comment under Referidos.

## What was not done

Item 4, Ventas por canales, was not edited. Items 1, 2, and 3 were not edited. The SDD was not edited. No vista query was changed, so a figure that the payload does not contain was not added. Reembolso, retención, and a referidos-by-proyecto breakdown are in that category. The chat did not run the page, so the live counts were not printed here.
