# 124 — Tasa de conversión stands on vertical columns

**Date:** 2026-11-13
**Route:** `/ventas` command center, checklist item 9. `/ventas/tasa-de-conversion` draws the same `TasaBand`, so it receives the same chart without a separate edit.
**Scope:** The shape of the Tasa de conversión chart, and the item 9 visualization cell in `docs/SDD-Department-Command-Centers.md`. The creation-week counting rules are untouched. No write to Odoo. `ventas.embudo_deal`, `embudoFunnel`, and the vista query were not edited.

This file is the record of that work. This chat did not run `git add` or `git commit`. After the stage command and the message were proposed, commit `f0e6374` landed with that message. See “The commit”.

`npx tsc --noEmit` was not run. `npm test`, `npm run build`, `next lint`, `next build`, `next dev`, and `next start` were not run. No port was bound. No browser was opened. No request was sent to localhost. The 14–20 September 2026 Boulevard 5 cohort was not re-queried.

## What was asked

Three requests, in this order.

1. Update the living SDD, then replace the horizontal-bar Tasa de conversión with vertical columns (or a vertical funnel) under Design Principle 13.

   In `docs/SDD-Department-Command-Centers.md`, section 4.1 Band A, item 9, remove this visualization line and leave the rest of the item 9 description intact:

   > Horizontal bar funnel of the stages currently tracked for the users’ familiar flow

   After that edit, item 9 must no longer mandate horizontal bars. Design Principle 13 is the governing rule: horizontal bars are among the least preferred charts for the CEO and Managers. Prefer vertical bars, bullets, funnels, composed charts, or other forms when they communicate the same information with equal or better density and clarity. Use horizontal bars only when they are the clearest option, and apply the visual-density continuity rules so they do not look thin or sparse.

   The chart change keeps every data rule already implemented:

   - Creation-week (or selected-period) cohort on `add_time` in America/Guatemala.
   - Monday 00:00 to the next Monday 00:00 for a week.
   - Open, lost, and won deals stay.
   - The commercial pipelines are joined by stage position, not by stage name. In scope: Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena.
   - Eight positions, in order: Ingreso, Contactado, En Perfilamiento, Calificados, Cita Programada, Visita Efectiva, En Decisión, Reserva.
   - A deal counts in its current stage and every stage before it. A won deal counts in every stage.
   - The percentage beside or under a bar is the next count divided by that count.
   - Headline win rate = won deals divided by deals that reached Ingreso.
   - First, one funnel for all in-scope projects together. Then the same funnel once per project, in canonical order, including a zero funnel when a project has no deals created in the period.
   - Santa Elena stays in that list.
   - Fields used: stage position, status, `add_time`, `pipeline_id`. No stage history.

   Visual requirements: vertical columns, preferred, or a vertical funnel. No horizontal bars. Bars thick enough for visual-density continuity. Modest y-axis headroom, about 10–15 %. Every column shows its absolute count. Every conversion percentage is visible. The headline win rate is visible on each funnel. Per-project funnels use the existing dark corporate blues. Standing rules: 0-click, Spanish colon for period labels, freshness stamp on the same line as the period description at the same weight and not bold, filter-to-content separator, no “En revisión”, no “Sin dato” placeholders, explanatory notes stay commented out, never write back to Odoo.

   Primary files named in the request: `src/app/(panel)/ventas/command-center.tsx` and `src/app/(panel)/ventas/lower-bands.tsx` (`TasaBand`).

   After the change, the chart must still match the verified 14–20 September 2026 Boulevard 5 numbers when that window is selected: Brenda Pérez, 108 deals, 0 % win rate. If the numbers diverge, stop and report. Do not alter the counting rules.

2. The shell command that stages only the files from this turn, and a prose commit message. Do not commit from this chat.

3. This file.

## What was found before any edit

Item 9’s visualization cell was the sentence above. The paragraph under the Band A table already recorded the creation-week embudo: the cohort, the eight positions joined by order, the counting rule, the next-count percentage, the win-rate headline, all in-scope projects first and then one funnel per project, Santa Elena included, and that stage history is not used. Design Principle 13 was already in section 2. This turn did not rewrite it.

`TasaBand` already drew that cohort. `EmbudoChart` laid the eight stages out as horizontal bars. The all-projects funnel used the project weight: a 44 px bar in a 56 px row. Each project funnel used the row weight: a 26 px bar in a 36 px row. The scale was the tallest count, so Ingreso filled the row, with grid lines at 0, 25, 50, 75, and 100 percent of that count. The count sat just past the end of the bar. A zero was a 2 px tick with the digit beside it. The conversion percent was a pill in a 76 px column. The stage name was a 176 px left column. `frameEmbudo` was the grid: `176px`, the plot, `76px`.

`funnelScale` implemented that full-width scale. `columnScale`, already used by the other Ventas column charts, sets the axis to `peak * 1.12` and keeps grid lines on round values at or below that ceiling. `PROJECT_PLOT` is 300.

`command-center.tsx` does not draw the bars. It requests `tasa-de-conversion` and passes the vista to `TasaBand`. `glance-stock.tsx` mounts the same `TasaBand` for the old route. The counts come from `embudoFunnel` in `src/lib/ventas/embudo.ts`, called by `buildConversion` in `src/lib/ventas/vista-operativo.ts`. `funnelPct` formats a null rate as “—”, a zero rate as “0%”, and any other rate to one decimal in `es-GT` when the percent is not a whole number.

Changelog 122 had already checked the Brenda Pérez cohort against the extract and against `embudoFunnel`: Boulevard 5, 14–20 September 2026, 108 deals, 0 won, cumulative counts `108, 86, 37, 8, 5, 2, 0, 0`. This turn did not repeat that query.

## What was decided

Vertical columns, not a trapezoid funnel. A shared vertical scale keeps each absolute count readable. The percentage stays on the stage it converts from, under the stage name, which the request allowed (“beside or under”).

The counting path stays `embudoFunnel`. A visual-only change cannot move 108 or the 0 % win rate unless the stored rows change. The drawing code reads `bar.count`, `bar.nextRate`, `bar.hasNext`, and `winRate`. It does not recompute them.

The item 9 cell needed a replacement, not a blank. An empty cell would leave the next reader free to put horizontal bars back under Principle 13’s exception for long category labels. The new cell names vertical columns and points at Principle 13. The paragraph under the table was not rewritten, including the sentence that still says “the percentage beside a bar.”

`command-center.tsx` was left as it was. The band is already mounted there, and the vista contract did not change.

## SDD

Section 4.1, the item 9 row. One cell changed.

Before:

`Horizontal bar funnel of the stages currently tracked for the users’ familiar flow`

After:

`Vertical columns of the eight positions. Form follows Design Principle 13.`

The paragraph that begins “Item 9 is that familiar flow” is the same text as before this turn. Principle 13 in section 2 was not edited. No other checklist row was edited.

## The band

`TasaBand` is still one `section.bandPlain`. No card fill, no border, no extra padding. The title is still “Tasa de conversión”. Under it, “de todos los proyectos”, then one chart. Then “por proyecto”, then one article per project in the order the vista already returns: Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena. Each article still has the project name, a top hairline, and the same chart. A project with no deals in the period is still an article of eight zeros.

`EmbudoChart` no longer uses `frameEmbudo`, `funnelScale`, or horizontal `.bar` marks. `funnelScale` was removed. Each chart is a `colChart` plus `funnelChart`.

The headline is unchanged: “Tasa de ganados” and `funnelPct(winRate)`, 14 px, weight 700, above the columns. A win rate of 0 still reads `0%`. A null win rate, which is what `embudoFunnel` returns when Ingreso is 0, still reads “—”.

The y-axis is `columnScale`. For a positive peak the ceiling is `peak * 1.12`, so the empty band above the tallest column is `0.12 / 1.12` of the plot, about 10.7 %, inside the requested 10–15 %. Grid lines are the round marks at or below that ceiling. A peak of 0 uses scale 1 and marks 0 and 1, the same helper the other column charts use. The axis column is 56 px wide, wider than the 44 px count axis, so a grouped thousands mark still fits. The zero grid line is the baseline. Positive marks are hairlines across the plot.

Plot height follows the abstraction already used on this page. The all-projects chart uses `PROJECT_PLOT`, 300 px, and `data-weight="project"`. Each project chart uses `FUNNEL_PROJECT_PLOT`, 220 px, and `data-weight="row"`. The aggregate is the taller mass.

Columns share one baseline. The row gap is 8 px. Each column’s minimum width is 104 px, so “Perfilamiento” can sit on one line. The row is `max-content` and at least the full width of the plot: on a wide page the eight columns grow and the bars stay thick; on a narrow page the plot scrolls sideways instead of squeezing the bars. `overflow-x` is `auto` and `overflow-y` is `hidden` on the plot clip. The y-axis stays put while the columns scroll.

Bar width is 94 % of the column on the all-projects chart and 90 % on each project chart. A positive count is at least 2 px tall, so a small stage does not disappear. The number is the true count either way. The 2 px floor is only a visible mark.

The count sits inside the column, in white, when the column is at least 20 px tall and the formatted count is at most six characters. Otherwise it sits 4 px above the column, in the same ink as the column. A zero is the digit 0 above a 2 px tick in that ink, the full width of the bar slot. There is no horizontal bar.

Stage names are two lines, split on the last space. A one-word name keeps a blank second line so the rates line up.

| Stage | Lines |
|---|---|
| Ingreso | Ingreso |
| Contactado | Contactado |
| En Perfilamiento | En / Perfilamiento |
| Calificados | Calificados |
| Cita Programada | Cita / Programada |
| Visita Efectiva | Visita / Efectiva |
| En Decisión | En / Decisión |
| Reserva | Reserva |

The second line of a one-word name is a non-breaking space. `white-space: nowrap` keeps each of those tokens on one line. The stage block has a minimum height of 32 px, 12 px, weight 700, color `#0d2041`.

The conversion percent is under the stage name, same color, 12 px, weight 700, tabular numerals. It is `funnelPct(nextRate)` when the stage has a next stage. Reserva has `hasNext` false, so its rate cell is a non-breaking space and the columns still share a bottom edge. A next stage whose own count is 0 and whose current count is positive still shows `0%`, because `nextRate` is 0. A current count of 0 still has a null `nextRate` and shows “—”. That is the formatter and the counting rule from changelog 122. This turn did not change either.

The columns are not buttons. There is still no `onStage` path from this band into the etapa focus.

While the vista is absent, the title stays and `StatusLine` shows the section error or “Cargando…”. The band still has no “Sin dato”, no “En revisión”, and no definition sentence.

Ink:

| Funnel | Color |
|---|---|
| All projects | `#0d2041` |
| Boulevard 5 | `#3d6f8f` |
| Benestare | `#0d2041` |
| Bosque Las Tapias | `#0573b0` |
| Santa Elena | `#1a4a68` |

Those four project colors are the existing `PROJECT_BLUE` map. The all-projects chart passes no slug, so it stays navy.

The period line, the colon after the period label, the freshness stamp, and the filter rule were not moved and were not restyled. They still live on the command-center header.

## How the verified cohort would be drawn

This is a reading of the counts changelog 122 already stored, through the new drawing rules. This turn did not re-read `embudo_deal` or `deals.csv`. If those rows are still the ones `embudoFunnel` turned into `108, 86, 37, 8, 5, 2, 0, 0` with win rate 0, the chart shows them as follows.

The headline is `Tasa de ganados 0%`.

For a peak of 108, `columnScale` sets the ceiling to `108 * 1.12 = 120.96`. The step is 25. The marks are 0, 25, 50, 75, and 100. The 108 column reaches `108 / 120.96` of the plot, about 89.3 %.

| Stage | Count | On the 300 px chart | On the 220 px chart | Rate under the name |
|---|---:|---|---|---|
| Ingreso | 108 | Inside the column | Inside the column | 79,6% |
| Contactado | 86 | Inside the column | Inside the column | 43% |
| En Perfilamiento | 37 | Inside the column | Inside the column | 21,6% |
| Calificados | 8 | Just above the column (about 19.8 px) | Just above the column | 62,5% |
| Cita Programada | 5 | Just above the column | Just above the column | 40% |
| Visita Efectiva | 2 | Just above the column | Just above the column | 0% |
| En Decisión | 0 | Digit 0 on the baseline tick | Digit 0 on the baseline tick | — |
| Reserva | 0 | Digit 0 on the baseline tick | Digit 0 on the baseline tick | none |

The rates are the same next-count divisions as before: 86/108, 37/86, 8/37, 5/8, 2/5, 0/2, and no rate on a zero En Decisión. `funnelPct` was not edited, so the comma in `79,6%` and `21,6%` and `62,5%` is the existing `es-GT` format. None of the positive heights in this cohort fall under the 2 px floor.

If a later load changes those rows, the chart will follow the new rows. The drawing code does not pin the cohort at 108.

## Files

| File | What changed |
|---|---|
| `docs/SDD-Department-Command-Centers.md` | The item 9 visualization cell. The counting paragraph was not edited. |
| `src/app/(panel)/ventas/lower-bands.tsx` | `EmbudoChart` and a new `FunnelColumn`. `funnelScale` is gone. `TasaBand`’s headings and the vista props are the same. |
| `src/app/(panel)/ventas/lower-bands.module.css` | `frameEmbudo` is gone. Funnel column, stage, rate, and scroll rules were added. The 640 px rule no longer names `frameEmbudo`. |

`src/app/(panel)/ventas/command-center.tsx` was named in the request and was not modified.

## What this conversation did not change

`src/lib/ventas/embudo.ts`, `src/lib/ventas/vista-operativo.ts`, and `src/lib/ventas/vista-types.ts`. The cohort, the Monday window, the four slugs, the eight positions, the won-in-every-stage rule, `nextRate`, and the win rate are the functions from changelog 122.

`src/app/(panel)/ventas/glance-stock.tsx`. It already renders `TasaBand`, so the old route follows the new chart.

The horizontal charts that are not this band. `clickableChart`, the `.frame` and `.frameAside` layouts, and the other Ventas bands still use their existing marks. The 640 px media query still stacks those horizontal frames.

The period label, the freshness stamp, the filter separator, the project pills, and the asesor control.

`ventas.dim_deal`, `ventas.embudo_deal`, the loader, and migration 092. Nothing was written to Odoo.

Inventario, canales, metas, Ventas totales, and `totales.funnel`. The four-bar reserva chain is still built for Ventas totales. It is still not drawn on Tasa de conversión.

## The commit

This chat proposed, and did not run:

```bash
git add -- docs/SDD-Department-Command-Centers.md "src/app/(panel)/ventas/lower-bands.tsx" "src/app/(panel)/ventas/lower-bands.module.css"
```

Proposed message, which is the subject of `f0e6374`:

```
Stand Tasa de conversión on vertical columns, so item 9 no longer requires the horizontal bars the audience likes least and the creation-week counts stay on the same eight positions.
```

`f0e6374bfaf1e643b9ca2bb9d11f0436b99ad225` was committed at 2026-11-13 23:08:48 -0600. The author recorded on that commit is Jorge Luis Contreras Herrera. This chat did not create it.

The commit contains the three files in the table above, and also `changelog/122_2026-11-13_ventas-tasa-embudo.md`. This conversation did not edit changelog 122. The stage command proposed here did not list it. Changelog 122 was an untracked file at the start of this conversation, from the earlier embudo work.

This file, `changelog/124_2026-11-13_ventas-tasa-vertical-columns.md`, was written after that commit. It is not in `f0e6374`.
