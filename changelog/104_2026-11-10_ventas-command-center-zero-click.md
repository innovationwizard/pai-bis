# 104 — Ventas command center: the 14 Operativo items on one scroll

**Date:** 2026-11-10
**Route:** `/ventas`
**File:** `src/app/(panel)/ventas/command-center.tsx`
**Diff:** 378 insertions, 179 deletions. No other application file, no SQL, no loader, no new route.

Changelog 102 is the documentation pass. Changelog 103 removes the retired `/old` routes. This entry is the Ventas page itself, brought in line with `docs/SDD-Department-Command-Centers.md` section 4 and `docs/General-Rules-and-Principles.md`.

`npx tsc --noEmit` passed. `npm run build` was not run. No dev server was started and no browser was opened.

## What the page does now

`/ventas` is still `src/app/(panel)/ventas/page.tsx` rendering `CommandCenter`. It is still one client page. The filters are still Periodo, Proyecto, Asesor, Torre, and Restablecer. The period description and the freshness stamp still share the `.op-range` line. The stamp is still `stampDate(...)` of `totales.freshness.label`, with the time stripped, and `data-stale` still marks a stale stamp.

After that line, and after the freshness warning when `totales.freshness.note` is set, the header now ends with `<hr className="op-filter-rule" />`. That class already lived in `src/app/globals.css` (the glance pages use it). The command center did not. The rule is the break between the filter battery and the charts.

The scroll, top to bottom:

1. Ventas totales. `VentasTotalesBlock` in `landing-blocks.tsx`. Not edited.
2. Asesores against meta. `AsesoresBlock`. Not edited.
3. Status contra la fecha de cierre. The pace chart. Subtitle still reads «Reservas».
4. Tasa de conversión. The funnel, then inventario general por proyecto and por torre.
5. Brecha contra el ritmo por proyecto, and por asesor.
6. Ventas por canales, and ventas por modelo. Side by side.
7. Valor de proyecto, then trayectoria de precios and impacto del descuento.
8. Desistimientos por motivo, and por proyecto.
9. Descuentos, subidas de precios, F&F y casos especiales, promociones.
10. Control Referidos.
11. The operative detail that was already at the bottom: «Tratos que todavía no son venta» and «Detalle de ventas». Clicking a bar still filters that block. The focus chip, the scroll to `#vc-detalle`, and the three notes for canal, etapa, and torre are unchanged.

Nothing required for those 14 items sits behind a tab. The strip titled «Detalle por modelo, canal y controles» is gone: the four buttons Modelo, Canales, Desistimientos, and «Descuentos, precios, F&F y promociones», the `panel` state, `togglePanel`, the `Panel` type, and `PANEL_SECTIONS`. `.vc-tabs` remains in `globals.css` and is unused. It was not deleted.

## Checklist, and where each item is drawn

| # | Operativo item | Where it is |
|---|---|---|
| 1 | Ventas totales | Existing hero and project bars. Untouched. |
| 2 | Ventas versus objetivos, totales y por asesor | Existing Asesores block and the project bars. Untouched. |
| 3 | Status contra la fecha de cierre | Pace chart, plus the two brecha charts. |
| 4 | Ventas por canales | Ranked horizontal bars by fuente. |
| 5 | Split de ventas por modelo | Horizontal bars of units sold, ranked by `sold`. |
| 6 | Inventario general | Existing stacked bars by proyecto and by torre. |
| 7 | Valor de proyecto | Composed chart of ventas and desistido, project bars for lista disponible and desistido, separate price lines, and the discount against the sales that carry it. |
| 8 | Desistimientos | Bars by motivo and by proyecto. |
| 9 | Tasa de conversión | Existing funnel. |
| 10 | Control de descuentos | Bars by tipo. |
| 11 | Control de subidas de precios | Bars by proyecto, quetzales and dollars apart. |
| 12 | F&F y casos especiales | Bars by tipo. |
| 13 | Control Referidos | Its own section. See the limit below. |
| 14 | Control de promociones | Bars by tipo. |

Colors are the ones already on the page: navy `#0d2041`, blue `#0573b0`, red `#b91c1c`, amber `#b45309`. Project hues inside the landing blocks were not retouched.

## How the vistas load

Previously two effects talked to `GET /api/ventas/vista`.

The first ran on every filter change and requested only `PRIORITY`: `ventas-totales`, `objetivos-de-ventas`, `status-de-ventas`, `inventario-general`.

The second ran only after a tab was pressed. `PANEL_SECTIONS` mapped Modelo to `analisis-de-inventario`, Canales to `ventas-por-canales`, Desistimientos to `desistimientos`, and the last tab to `descuentos`, `subidas-de-precios`, `ff-y-casos-especiales`, and `promociones`. Closing the tab aborted that request. `valor-del-proyecto` was a real section of the same API and was not requested at all.

There is now one effect, still keyed on `bar`. `SECTIONS` is the old priority list plus:

- `ventas-por-canales`
- `analisis-de-inventario`
- `valor-del-proyecto`
- `desistimientos`
- `descuentos`
- `subidas-de-precios`
- `ff-y-casos-especiales`
- `promociones`

Each section is still its own query string (`section=` plus the same periodo, desde, hasta, proyecto, asesor, torre). `readVista` is unchanged. One `AbortController` cancels all of them when the filters change or the component unmounts. A successful response now also clears that section’s previous error. The old priority effect left a stale error in place. The tab effect already cleared it. The merged effect keeps the tab behavior.

The filter dropdowns still build their options from totales, objetivos, status, and inventario. The new vistas are not merged into those lists.

No vista builder, route, or column list was changed. The page only asks for sections the API already returns.

## Numbers on the graphics

`labelCount`, `labelMoney`, `labelDollars`, and `labelSigned` turn a chart value into the same strings the rest of the page uses (`count`, `money`, `dollars`, `signed`). A null value prints nothing, so a missing point does not become an em dash sitting on the line. `labelStack` also prints nothing for zero, so an empty segment of a stack does not draw a 0 on the boundary.

Pace chart (`RhythmChart`). Height 280, top margin 18, bottom margin 16. Both series draw a dot of radius 2. Real is labeled above the point. Ritmo is labeled below it. Future days stay null on Real and are not labeled. The tooltip is unchanged.

Funnel. The right-hand mark was already there: the count, and the conversion percent when the stage has one. It was left. The line under the chart that listed each stage’s `source` and `grain` is commented out.

Brecha (`GapBars`). Right margin went from 12 to 48. Each bar is labeled with the signed gap (`+` when the real is ahead of the pace). Rows with `gapUnits == null` are still left off the chart, and the note «N sin meta, fuera de la barra» is still there. The asesor chart is still capped at 12 (`CHART_CAP`). Red is still a deficit, blue a surplus, navy a zero gap. Clicking a bar still focuses the detail table.

Inventario (`StackChart`). Each of Disponible, Congelado, and Vendido has a centered white label of its count when the count is not zero. Clicking a segment still focuses proyecto or torre.

`NamedBars` is the horizontal bar used by canales, modelo, desistimientos, and the four controls. It now puts a `mark` on each row and a `LabelList` to the right of the bar. Right margin is 132 when the mark is money or a custom format, and 48 when it is a count. The mark is chosen by `barMark`:

- `format` wins. Subidas de precios in dollars uses `dollars`.
- `moneyValues` prints the quetzal amount.
- `showGtq` prints `unidades · quetzales` when `gtq` is present, and the unit count otherwise.
- Otherwise the mark is the unit count.

Rows whose `gtq` is null are still dropped when the bar encodes `gtq`. The cap of 12 and the «N de M» note are unchanged. A click still ignores the synthetic id `otras`.

## Band B, section by section

### Ventas por canales

`CanalesPanel` no longer wraps itself in an `<article>` or an `<h3>`. The parent `<h2>` is «Ventas por canales». The caption is not printed. `notice` still is. The bars are `vista.channels`, length = units, mark = units and quetzales (`showGtq`). Clicking a fuente still sets `focus.kind = "fuente"`. «Otras fuentes» still does not.

### Ventas por modelo

`ModeloPanel` likewise dropped its own heading and caption. Models are still sorted by `sold`, then by label. The bar is units sold. `listGtq` is no longer copied into the row. That field is the list price of the model, not the amount the bar represents, so the mark is the sold count only.

### Valor de proyecto

`ValorBand` is new. It reads three vistas that were already defined on `VentasVista`: `valor-del-proyecto`, `subidas-de-precios`, and `descuentos`.

«Valor de proyecto» draws `ValueTrajectory` from `valor.months`: a `ComposedChart`, bar `desistido` in red labeled above in quetzales, line `ventas` in navy labeled below. The Y axis is also formatted as quetzales, width 84. Empty `months` prints «Nada que graficar en este periodo.» `valor.notice` is shown when set.

Under that, `ProjectValue` draws the projects that have `disponibleGtq` or `desistidoGtq` as two horizontal series, Disponible in blue and Desistido in red, each amount labeled to the right. Projects with `disponibleUsd` get a second chart, series «Disponible $», labeled with `dollars`. Quetzales and dollars are not placed on one axis. If neither currency has a value, the block renders nothing.

«Trayectoria de precios» is `PriceTrajectory` on `precios.months`. Quetzales and dollars are two separate line charts (`CurrencyLine`), each with its own scale, a one-item legend, and the amount above every point. An empty `months` array prints `vista.notice`, or «Nada que graficar en este periodo.» when the notice is null. Those months are the twelve-month window the vista already builds. They are not summed with the valor chart.

«Impacto del descuento» is two bars, and only when `descuentos.gtq` or `descuentos.saleGtq` is non-null: «Ventas con descuento» (`saleGtq`) and «Descuento» (`gtq`). A null side is dropped by `NamedBars`. When both are null, the notice is printed instead of a zero. The breakdown by tipo is the Descuentos control below, not this chart.

### Desistimientos

Two cards, always mounted: «Desistimientos por motivo» and «Desistimientos por proyecto». While the vista is loading, each card shows `StatusLine`. The sentence «N desistimientos · Q… valor del trato» and the caption are gone.

When any motivo or project row has `gtq`, both charts use that amount and the series name «Valor». Otherwise they use units. Clicking a project bar still focuses the detail table.

Reembolso and retención are not series. `buildDesistencias` in `src/lib/ventas/vista-operativo.ts` says they are not in the base and must not be shown as zero. The vista’s rows are `motivos` and `byProject`, each `{ id, label, units, gtq }`. The bars use that `gtq` when it is present. No zero bar was added for a split the payload does not have. The builder was not changed.

### Descuentos, subidas, F&F, promociones

`ControlesPanel` is a `vc-grid-2` of four `vc-card` articles with `<h2>` titles. Captions are not printed. Notices still are. The summary sentences are gone:

- «N descuentos · monto · porcentaje del valor de esas ventas.»
- «N unidades · quetzales · dólares. Quetzales y dólares no se suman.»
- «Marcadas N · F&F N · especiales N · peso N.»
- «N ventas · N con promoción · monto.»

Descuentos. Bars of `tipos`. The bar is quetzales when any tipo has `gtq`, otherwise units. An empty `tipos` array leaves the notice and no chart.

Subidas de precios. Quetzal rows and dollar rows are separate charts. A project with only dollars is no longer dropped. The dollar chart passes `row.usd` through the `gtq` slot and formats it with `dollars`, series name «Dólares», fill blue. Ids are suffixed `:usd` so they do not collide with the quetzal row. The old gate that hid the whole block when `gtq`, `usd`, and `byProject` were all empty is gone. An empty pair of lists simply draws no bars.

F&F y casos especiales. The old guard `marked == null` hid the chart even when `tipos` had the «Ventas del periodo» row. The chart now draws whenever `tipos.length > 0`. The bar is units. `casoAmounts` may attach a quetzal figure to a tipo, and `showGtq` then prints `unidades · quetzales`. It does that only when `marked` is non-null, `traces.length === marked`, every trace of that tipo has `gtq`, and the trace count equals the tipo’s units. The «resto» row is left as the vista sent it, because that row already carries `gtq` from the builder. A truncated trace list (the builder keeps 80) fails the length check and is not summed. A partial sum is not shown as the total.

Promociones. When any tipo has `gtq`, the bar is quetzales. Otherwise the bar is units, and `showGtq` still appends money on a row that has it.

### Control Referidos

Its own section, under the controls and above the detail table. Heading «Control Referidos». Body: «Referido, tipo de referido y nombre de referidor no vienen en esta vista.»

Those three fields are not on `VentasVista`. `SaleLine` has fuente, not a referidor. `CanalesVista.channels` is fuentes. There is no `referidos` member of `VISTA_SECTIONS`. The section does not filter the canales chart, and it does not draw a zero.

`/api/reservas/referidos` was not called. That route reads `v_rv_referrals_full` (`referido_por`, `project_name`, `precio_referido`) and requires `ADMIN_ROLES`. It has no tipo de referido, and it is the special-price register from migration 019, not the Pipedrive trail named in the checklist. Using it would have been a second fetch and a different meaning. No new route was added and the vista builders were not extended.

## Copy that was commented out, not deleted

`plainCaption` used to drop any caption that contained «¿» and print the rest. It was removed. The definition sentences are JSX comments, so the wording is still in the file and is not rendered.

Under «Status contra la fecha de cierre», both of these:

- «Fecha de cierre {closeOn}. {dayLabel}. Real {units} · ritmo {paceUnits} · {gap} unidades.»
- `status.caption`. The vista sets that to «El ritmo es la meta prorrateada a hoy. Un mes ya cerrado se compara contra la meta completa. La fecha de cierre es el último día del mes.»

`status.notice` and `totales.targetNote` still render.

Under «Tasa de conversión»:

- «Reservas, promesas firmadas, recibos publicados y ventas netas. El porcentaje compara cada etapa con la anterior. Si pasa de 100 %, entraron tratos que no venían de esa etapa.»
- The generated line `{etapa}: {source}, {grain}` joined with « · ».

Under inventario por proyecto, `inventario.caption`. The vista sets that to «Inventario al {fecha}. El precio de lista de Santa Elena queda en dólares. No se suma con los quetzales.» `inventario.notice` still renders, including the asesor note «El inventario no se parte por asesor.»

Under the project brecha, «Real menos ritmo a la fecha de cierre. Rojo: déficit. Azul: excedente.» The color is still the bar fill. Under the asesor brecha, «El déficit más grande primero.» was removed rather than commented. The sort itself is unchanged. It still comes from the vista.

The detail-table sentences were not touched. They describe what a click did to the list.

## What was not changed

- `src/app/(panel)/ventas/landing-blocks.tsx` and its CSS. Hero, project bars, asesor progress, roster, and project colors.
- `src/app/(panel)/ventas/page.tsx`.
- Every other department page.
- `src/app/api/ventas/vista/route.ts`, `src/lib/ventas/vista.ts`, `src/lib/ventas/vista-operativo.ts`, and `src/lib/ventas/vista-types.ts`.
- The detail tables, their sort, and the focus kinds `proyecto`, `asesor`, `fuente`, `torre`, and `etapa`.
- `globals.css`, including the now-unused `.vc-tabs` rules.
- No database read or write was run from this pass.
