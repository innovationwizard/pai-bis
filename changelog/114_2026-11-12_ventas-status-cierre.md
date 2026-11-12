# 114 — Status de ventas: pace by project and by asesor, then the cumulative line

**Date:** 2026-11-12
**Route:** `/ventas` command center only.
**Scope:** The Ventas landing client. No SQL, no loader, no vista builder, no new request, no write to the database.

Three commits landed from this chat. This file is the record of that work. It was not part of those commits.

| Commit | Date | Message |
|---|---|---|
| `606213f` | 2026-11-11 | Show the closing-date gap under the rhythm line, one bar per project and one per asesor, with today's pace on the tick and the difference at the right. |
| `01b5513` | 2026-11-11 | Give the closing-date line the weight of the bands around it, so the title matches the cards and the stroke fills a shorter field. |
| `cb8f5c6` | 2026-11-12 | Name the cumulative chart Status de todos los proyectos, and remove the Reservas subtitle so the title stands alone. |

`npx tsc --noEmit` passed after the two bands (`606213f`) and again after the line was moved and restyled (`01b5513`). Each run exited 0. The only console line was npm’s warning about an unknown `devdir` env config. The title rename (`cb8f5c6`) is a string change and was not typechecked on its own. `npm run build` was not run. No dev server was started, no browser was opened, and the database was not queried or written.

`src/lib/projects.ts` and `src/lib/ventas/vista.ts` were not edited. `PROJECT_DISPLAY_ORDER` was already the shared list, by date of birth:

1. BOULEVARD 5
2. BENESTARE
3. BOSQUE LAS TAPIAS
4. SANTA ELENA

The page still loads the same `status-de-ventas` vista. Nothing in the pace math changed. `paceUnits` is still the meta prorated to today through `monthFactor`. `units` is still the count of reservas in the filtered period. `rhythm` is still the day-by-day (or month-by-month) series the line already drew.

## What this does not change

Mercadeo, Cobros, Créditos, and Entregas are untouched.

On Ventas, the opening fold, “Objetivos por proyecto”, and “Objetivos por asesor” are untouched. The filters are untouched. There is no new fecha-de-cierre control. The existing Periodo filter is still what defines the window, and the vista still treats the closing date as the last day of that window’s month.

Below this block, the page is the same: Tasa de conversión, both inventario charts, “Brecha contra el ritmo por proyecto”, “Brecha contra el ritmo por asesor”, canales, modelo, valor, desistimientos, controles, referidos, and the detalle. Those brecha charts are still the diverging bars of `gapUnits`. They were not replaced by the new bands.

`glance-view.tsx` and `totales-view.tsx` still have their own rhythm lines, still at stroke 2 with dash `4 3`. `ChartFrame` is still in the command center and is still 280px where the other charts use it.

## Files

| File | What changed |
|---|---|
| `src/app/(panel)/ventas/landing-blocks.tsx` | `StatusProyectoBlock`, `StatusAsesorBlock`, and `StatusCierreChart`. The line chart moved here from the command center. |
| `src/app/(panel)/ventas/landing-blocks.module.css` | `.statusBand` (4px gap) and `.statusPlot` (188px). Added in `01b5513`. |
| `src/app/(panel)/ventas/command-center.tsx` | Wires the three pieces into the old status section. The local `RhythmChart` and `labelCount` are gone. |

## Where it sits

The section is still the one that used to be titled “Status contra la fecha de cierre”. It is still one `<article className="vc-card">` between the Objetivos bands and Tasa de conversión, still followed by the same hairline.

Inside that article, top to bottom:

1. `StatusCierreChart` — the cumulative line, now titled “Status de todos los proyectos”.
2. `status.notice`, when the vista has one, and `totales.targetNote` (“La meta no se parte por torre.”) when a tower is selected. Both were already rendered under the line. They stay between the line and the new bands. They are not inside either bar band.
3. `StatusProyectoBlock` — “Status por proyecto”.
4. `StatusAsesorBlock` — “Status por asesor”.

While `status` is still null, the chart component renders the same `StatusLine` the section used before (“Cargando…”, or the section error). The two bar bands stay unmounted until the vista arrives. An empty `rhythm` still prints “Nada que graficar en este periodo.”

The outer section’s accessible name, and the chart’s own `aria-labelledby`, are both “Status de todos los proyectos”.

## 1. Status por proyecto — `606213f`

One row per display project in `status.byProject`, sorted with `compareProjectLabels`. Casa Elisa and any other name outside `PROJECT_DISPLAY_ORDER` are dropped by `isDisplayProject`. Santa Elena stays, because it is a display project. The checklist says its meta for the period is zero and it has no asesores. The project row is not that omission. The asesor band is.

The band reuses `GoalList` / `GoalLine` in units only. There is no U / % switch.

The row is the same three-part line as Objetivos por proyecto:

- Bar length is `units`, the cumulative reservas for that project under the current period filter.
- The tick, and the number above it, are `paceUnits`. `GoalLine` reads that through the existing `target` field. A null pace draws no tick, no number, and no pill.
- The pill is `units − paceUnits`, signed, green when positive, red when negative, muted when zero. It is the difference against the pace number printed above the tick, not a second rounding of the raw pace. `status.gapUnits` is `round1(units − rawPace)` and can differ by a tenth from the pill.

The section uses `styles.metaBand`, so the bars are the thick ones: plot 84px, bar 48px. That is the same thickness as “Objetivos por proyecto”. Color is the project’s existing dark blue, through `hueKey` and the `data-project` rules already on `.goalBarSolid`.

The shared integer grid is the one `GoalList` already draws. No caption is rendered under the band. An empty project list renders the title and nothing else. There is no “Sin proyectos” sentence here.

The title uses `.bandHead .panelTitle`: `rgba(13, 32, 65, 0.75)`, `calc(26px * 0.75)`, weight 700, line-height 1.25. That is the same rule as the left-card names (`.kpiName`) and as “Objetivos por proyecto” / “Objetivos por asesor”.

## 2. Status por asesor — `606213f`

Thinner bars. The section uses `styles.panel`, not `metaBand`, so the plot stays 60px and the bar stays 24px. That is the same thickness as “Objetivos por asesor”. The title uses the same `.bandHead .panelTitle` rule. No caption under the band.

One bar per row of `status.byAsesor`. That list is already built without the non-rep ids. It is not cut down to `rosterAsesorIds`, and it is not capped at the 12 rows the brecha chart still caps.

Each asesor is placed on a project in two steps, in this order:

1. `statusAsesorProject` reads `status.editor.cells` for that asesor, keeps only cells whose project is in the current display-project list, and takes the latest month. A tie on month breaks with `compareProjectLabels`.
2. If that finds nothing, `singleProject` uses the reserva-stage deals already on the page. It returns a project only when every deal for that name is in one display project and the counts match.

Rows are then bucketed with `PROJECT_DISPLAY_ORDER`. A bucket with nobody in it is dropped, which is how Santa Elena disappears when it has no asesores. Asesores who still have no project go in a trailing group. Their bars have an empty hue, so they paint with the muted bar color. Inside a group, order is reservas descending, then name (`es`). The first row of a group sets `lead`, which only writes `data-lead`. No rule in the stylesheet reads that attribute.

The bar, the tick, and the pill are the same as the project band: `units`, `paceUnits`, and `units − paceUnits`. The hue is the project the asesor was placed on, so the bar is that project’s dark blue.

Both bands share one scale per band, the same `GoalScale` as Objetivos. Below 640px that scale hides, as it already does for the objective bands.

## 3. The cumulative line — `01b5513`, then `cb8f5c6`

`RhythmChart` used to live in `command-center.tsx`. It was a `ChartFrame` of 280px. Real was navy at stroke 2.5. Ritmo was blue, dashed `4 3`, at stroke 2. Dots were radius 2. The heading was a `.vc-card h2`: 15px, weight 700, solid `#0d2041`. Under it sat the subtitle “Reservas”. A commented paragraph (fecha de cierre, day label, real, ritmo, gap, and `status.caption`) sat in the JSX and was not rendered. That comment was deleted when the chart moved. It is not in the file anymore.

`01b5513` moved the plot into `StatusCierreChart` in `landing-blocks.tsx` and wrapped it in `.panel` plus `.statusBand`, so the line sits on the same card surface as the bands around it. The series are still `real` and `ritmo` from `vista.rhythm`. `type="monotone"`, `connectNulls={false}`, and `isAnimationActive={false}` are unchanged. Margins are still `{ left: 0, right: 8, top: 18, bottom: 16 }`. The grid is still horizontal only, `#e2e8f0`. Axis ticks are still 11px `#64748b`. The legend is still 12px. Real labels stay above the line in `#334155` at 9px. Ritmo labels stay below the line in the ritmo blue at 9px. A null tooltip value still reads “Sin meta”. Counts still use `Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 })`, copied next to the plot so the command center’s `labelCount` could be removed. `tipPair` stayed in the command center because the other charts still use it.

What changed in the drawing:

- Real stroke is 4.5. Ritmo stroke is 3.5. The dash is `8 5`, scaled so the thicker ritmo stroke still reads as a dash rather than a dot.
- Dots are radius 3, so they still show past the thicker stroke.
- `.statusPlot` is 188px tall, down from 280. The label margins were left at 18 and 16 so the numbers above Real and below Ritmo keep their room.

`cb8f5c6` replaced the visible title with “Status de todos los proyectos” and deleted the “Reservas” subtitle. The heading element is an `h2.panelTitle` inside `.bandHead`, so it takes the card-label size, weight, and opacity. The old 15px `.vc-card h2` rule no longer wins: two classes outrank one class plus an element.

## Numbers, in one place

For a project or an asesor, the three figures on a row are meant to be read together. The number at the end of the bar is the reserva count. The number above the tick is the pace for today. The pill is the first minus the second. The line above those rows is the same reserva count, accumulated, against the same pace, drawn across the days of the period. Neither band recomputes the pace. Neither band adds a closing-date filter.
