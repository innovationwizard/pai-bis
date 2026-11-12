# 116 — Bands under Ventas por canales: the same cards, thick marks, and numbers

**Date:** 2026-11-12
**Commit:** `84fca73` — Restyle the Ventas bands under Ventas por canales to match the command-center charts above them.
**Route:** `/ventas` command center only. The older section pages under `/ventas/[section]` were not restyled.
**Scope:** The command-center client. No SQL, no loader, no vista builder, no new request, no write to the database.

This file is the record of that work. It was written after `84fca73` and is not part of that commit.

`npx tsc --noEmit` was not run. `npm run build` was not run. No dev server was started, no browser was opened, and the database was not queried or written. The IDE reported no linter errors on the four source files after the edit.

`src/lib/projects.ts` was not edited. `PROJECT_DISPLAY_ORDER` was already the shared list, by date of birth:

1. BOULEVARD 5
2. BENESTARE
3. BOSQUE LAS TAPIAS
4. SANTA ELENA

The page still requests the same vistas. `SECTIONS` in `command-center.tsx` is unchanged, including `valor-del-proyecto`, which this pass no longer draws.

## What was decided before the edit

The eight bands above the line were frozen and were not to be edited:

1. Ventas todos los proyectos, and Ventas por proyecto, inside `VentasTotalesBlock`
2. Objetivos por proyecto
3. Objetivos por asesor
4. Status de todos los proyectos
5. Status por proyecto
6. Status por asesor
7. Ventas por canales

Six choices then fixed the rest:

| Question | Choice |
|---|---|
| How to apply the screenshots | Keep each checklist item’s chart type from the SDD. Use the visual system: a contained card, a short title, thick marks, the number on the mark, the current project blues, tight rows, and a red target with a gap pill only where a meta already exists. |
| Brecha contra el ritmo por proyecto and por asesor | Comment both cards out. They repeat the gap already drawn on Status por proyecto and Status por asesor. |
| Valor de proyecto versus Descuentos and Subidas de precios | Valor de proyecto keeps the price trajectory and the discount impact. Descuentos and Subidas de precios stay as their own control cards. The other charts that sat inside Valor de proyecto go away. |
| Tratos que todavía no son venta, and Detalle de ventas | Restyle the card and the table frame. Same columns. Same click-to-filter. |
| Layout | Full width for inventario, tasa, modelo, valor, desistimientos, and referidos. Keep the four control cards in the existing two-column grid. |
| Project rows | Always draw Boulevard 5, Benestare, Bosque Las Tapias, and Santa Elena, including a 0 mark, when those projects are in scope. |

None of the bands below Ventas por canales carries a meta. The red target and the gap pill are therefore not drawn on them. The funnel’s stage-to-stage rate is a neutral pill, not a deficit.

## What this does not change

Mercadeo, Cobros, Créditos, and Entregas are untouched. `src/app/(panel)/mercadeo/operativo-view.tsx` and `scripts/creditos/load.py` were already dirty in the work tree and are not in `84fca73`.

`landing-blocks.tsx` and `landing-blocks.module.css` are untouched. That is where the eight frozen bands live: `VentasTotalesBlock`, `ReservasMetaBlock`, `AsesoresBlock`, `StatusCierreChart`, `StatusProyectoBlock`, `StatusAsesorBlock`, and `CanalesBlock`. Their project colors stay `#3d6f8f` (Boulevard 5), `#0d2041` (Benestare), `#0573b0` (Bosque Las Tapias), and `#1a4a68` (Santa Elena).

The filter battery is untouched: project pills, Periodo, Asesor, Torre, Restablecer, the period line, the freshness stamp, and the rule under the battery. The sticky behavior is untouched. A click still calls `toggleFocus`, and the detail block still scrolls into view.

The vista payloads are untouched. No metric was redefined. Counts stay counts. Quetzales stay quetzales. Dólares stay dólares. The funnel is still `totales.funnel` (reservas, promesas, recibos, netas), not the separate `tasa-de-conversion` vista. Inventario is still vendido, congelado, and disponible. Desistimientos are still motivo and proyecto. Referidos are still tipo plus the list of referidores.

`.vc-card` by itself is unchanged, so the article that wraps the three Status bands does not pick up the new table frame. `.vt-table` in `totales-view.tsx` is unchanged, because the new table rules require `.vc-card.vc-detail`.

The global `.vc-referidos` rule is still in `globals.css`. The new referidos list does not use it.

## Files

| File | What changed |
|---|---|
| `src/app/(panel)/ventas/lower-bands.tsx` | New. Every band under Ventas por canales, except the commented brecha and the detail tables. |
| `src/app/(panel)/ventas/lower-bands.module.css` | New. Cards, scales, thick bars, stacks, and the price-line height. Not imported by the eight frozen bands. |
| `src/app/(panel)/ventas/command-center.tsx` | Mounts the new bands. Comments out Brecha. Adds `vc-detail` on the detail section. Deletes the old thin-bar components that those bands replaced. |
| `src/app/globals.css` | `.vc-card.vc-detail` only. Title size, card surface, and table frame for the two detail tables. |

`84fca73` is those four files: 1,185 insertions, 638 deletions.

## Page order under Ventas por canales

The hairline `hr.op-filter-rule.vc-band-rule` still separates topics. A pair that belongs together sits in `.stack` with an 8px gap and no hairline between the two cards.

1. Tasa de conversión
2. Inventario general por proyecto, then Inventario general por torre
3. Brecha contra el ritmo, commented out, including the hairline that followed it
4. Ventas por modelo
5. Valor de proyecto
6. Desistimientos por motivo, then Desistimientos por proyecto
7. Descuentos, Subidas de precios, F&F y casos especiales, Promociones, still in `.vc-grid-2`
8. Control Referidos
9. Tratos que todavía no son venta, then Detalle de ventas

## Shared drawing

`clickableChart` is the single-series bar. `StackChart` is the inventario stack. Both use one `Scale` per chart, on column 2, spanning every row, with `pointer-events: none` and the same faint line as the objective bands (`rgba(148, 163, 184, 0.12)`). Rows use `subgrid`, so the name column and the plot column line up.

`niceScale` picks the marks:

- Peak of 0: scale 1, marks at 0 and 1.
- Peak of 1 through 12: every integer from 0 through `ceil(peak)`.
- Above 12: pad the peak by 5 percent, round up to 1, 2, 5, or 10 times the power of ten, and draw five marks (0, one quarter, one half, three quarters, the top).

Below 640px the frames become a column, the scale is `display: none`, and each row stacks the name above the plot. That is the same breakpoint the objective and channel frames already use.

Two weights:

| Weight | Plot height | Bar height | Used for |
|---|---|---|---|
| `project` | 56px | 44px | Tasa, inventario por proyecto, desistimientos por proyecto, subidas, discount impact, referidos |
| `row` | 36px | 26px | Inventario por torre, ventas por modelo, desistimientos por motivo, descuentos, F&F, promociones |

Row gap inside a chart is 2px. The bar is the mass of the row. There is no empty lane above the bar, because these charts have no meta tick.

A value above 0 draws a bar at least 2px wide. The number sits 6px to the right of the bar end, in 13px weight 700, in the text color, not in white on the fill. A value of 0 draws a 2px tick and the formatted 0 at 8px from the origin. The field keeps a right gutter so the number does not run out of the card: 64px for a count, 136px for money, 168px when F&F prints a count and an amount on the same mark.

A row with an id and an `onPick` is a button. Enter and Space fire it. A synthesized row whose id is still empty is not clickable. Focus uses a 2px `#0573b0` outline.

The card is the same surface as the bands above: 8px padding, 1px `var(--color-border)`, 8px radius, `var(--color-card)`. The title is `calc(26px * 0.75)`, weight 700, `rgba(13, 32, 65, 0.75)`, which is the size and color of `.bandHead .panelTitle` on the frozen bands.

Project hue comes from the same slug as the frozen bars (`hueKey`): `boulevard-5`, `benestare`, `bosque-las-tapias`, `santa-elena`, and the same four hex values. A row that is not a project uses a tone: navy `#0d2041`, red `#b91c1c`, amber `#b45309`, or blue `#0573b0`.

`orderedProjects` is how a project chart keeps the four names. It takes the roster from the pill row and the rows from the vista. A vista row whose label is one of the four display projects is matched with `projectKey`, so `BOULEVARD 5` and `Boulevard 5` are the same project. The label on the chart is the vista’s own label when the row exists. A missing row uses `titleLabel`: Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena. The value is 0. The id is the vista id, or the pill id when the vista has no row. Casa Elisa and any other name are dropped by `isDisplayProject`, as they already were.

The roster itself follows the pills. `projectPillOptions` always returns the four names. When `bar.proyectos` is null (Todos), the roster is those four. When one or more pills are off, the roster is only the selected ids, and a pill that has not yet received an id is left out. Turning a project off removes it from these charts. It does not draw that project at 0.

The old `NamedBars` stopped at `CHART_CAP` (12) and printed how many rows were hidden. The new charts do not. Every modelo, motivo, tipo, and promoción the vista returns is drawn. `CHART_CAP`, `capRows`, and `displayProjects` remain in `command-center.tsx` only because the commented brecha block still names them.

Operational notices stay. A vista `notice` is still printed. The empty sentence is still “Nada que graficar en este periodo.” It is not repeated when the notice is already on screen. The inventario notice that contains “otro estado” is still withheld, as it was before this pass. No new definition sentence was added.

## 1. Tasa de conversión

Was a Recharts vertical bar, `barSize` 16, navy, with the label `count · percent` to the right of the bar, inside a plain `vc-card`.

Now one full-width card. Each stage is a project-weight navy bar. The count is the number on the bar. When `stage.conversion` is not null, the rate sits in a 72px column as a neutral pill (border `var(--color-border)`, navy text, 12px, weight 700). The first stage has no rate, and its pill cell is empty so the rows still share the plot column. A click still calls `toggleFocus({ kind: "etapa" })`, and the detail block still swaps to `StageDetail` for that stage.

The stages are still whatever `totales.funnel` returns. Their labels are not renamed.

## 2. Inventario general

Was two cards side by side in `.vc-grid-2`: “Inventario general por proyecto” and “Inventario general por torre”. Each was a thin Recharts stack. The segment order was disponible, congelado, vendido. Numbers sat in the segment when the formatter returned a non-zero count. A zero segment printed nothing.

Now two full-width cards, proyecto then torre. The stack order is the same, and the colors are the same meaning: disponible `#0573b0`, congelado `#b45309`, vendido `#0d2041`. A legend of those three names sits above each chart. The bars are not painted in the project hue. The row is the project or the torre. The segment is the state.

Proyecto uses the project weight. The four roster projects are always present. A project with no stock row is 0, 0, 0: one tick and the number 0, and no three-zero cluster beside it. A click with a real id still filters the detail by proyecto.

Torre uses the row weight, because a torre is under the project. Only torres that the vista already returns are drawn, and only for projects in the roster. They sort by tower name within the project order. The label is still `{proyecto} · {torre}`. A click still filters by torre. A project that has no torre rows does not get an invented torre. If the roster’s projects have no torres at all, the card says there is nothing to draw. The proyecto card above it still shows those projects at 0.

On a non-zero stack, a segment at least 14 percent of the scale prints its count in white, centered in the segment. A smaller segment, including a 0, prints its count in the segment color in a 112px column to the right of the plot. The spoken name of the row lists all three counts, including zeros.

The asesor sentence is unchanged and still appears only when an asesor is selected: “El inventario no se parte por asesor.” It sits in the proyecto card, under the title.

## 3. Brecha contra el ritmo

The two cards, “Brecha contra el ritmo por proyecto” and “Brecha contra el ritmo por asesor”, and the hairline after them, are inside a JSX comment in `command-center.tsx`. They are not mounted.

`GapBars` is still a function in that file. It is not called. Uncommenting the block would mount it again, including the 12-asesor cap, the “sin meta, fuera de la barra” sentence, and the tooltip that can still say “Sin meta”. None of that is on screen.

The comment does not contain the old inner comment about red for déficit and blue for excedente. A JSX comment cannot wrap another `*/`.

## 4. Ventas por modelo

Was one `NamedBars` chart, navy, `barSize` 12, capped at 12, sorted by units sold.

Now one full-width card. Every model in `analisis-de-inventario` is drawn, still sorted by `sold` descending and then by label. The bar is the row weight, navy, and the number is the sold count. Models at 0 are drawn. There is no click. The vista notice is still shown. This chart is not a project chart, so it does not invent the four projects.

## 5. Valor de proyecto

Was three pieces:

- A composed chart of `valor-del-proyecto` months: a ventas line and desistido bars, plus a by-project pair of disponible and desistido in quetzales, and disponible in dólares when present.
- A card “Trayectoria de precios”, two thin line charts of `subidas-de-precios` months.
- A card “Impacto del descuento”, two thin bars from the descuentos totals.

The first piece is gone. `valor-del-proyecto` is still requested and still arrives in `vistas`. Nothing on the page reads it.

The card is now one full-width band titled Valor de proyecto.

**Trayectoria de precios** is an `h3`, then the `subidas-de-precios` month series. Each currency that is drawn is its own line chart, 220px tall, so quetzales and dólares do not share an axis. The stroke is 4.5px. Dots are radius 3. The amount is labeled on every point at 10px. The month axis uses `interval={0}`. Quetzales is navy. Dólares is `#0573b0`. A currency is drawn when any month is not zero. Quetzales is also drawn when dólares is entirely zero, including when both are zero, so the band is not blank. A flat dólares line is omitted when quetzales has a non-zero month. An empty `months` array prints the notice, or the empty sentence when there is no notice.

**Impacto del descuento** is an `h3`, then two project-weight amber bars: “Ventas con descuento” (`saleGtq`, or 0) and “Descuento” (`gtq`, or 0). If both amounts are null, there is no chart. The control card Descuentos, further down, is still the breakdown by tipo. These two bars are the totals.

## 6. Desistimientos

Was two cards side by side, both red, capped at 12. If any row had `gtq`, both charts switched to money.

Now two full-width cards, motivo then proyecto. The money switch is the same: if any motivo or any project row has `gtq`, both charts format as quetzales and a null amount is 0. Otherwise both charts are unit counts.

Motivo keeps the vista’s own rows and order. The bars are the row weight and red. There is no click.

Proyecto uses `orderedProjects`, so the four names in the roster are present, including 0. The bars are the project weight and the project hue, not red. The title says what the number is. A click still filters the detail by proyecto.

The vista notice sits in the motivo card.

## 7. The four control cards

They stay in `.vc-grid-2` (`minmax(0, 1.35fr)` and `minmax(0, 1fr)`, 8px by 20px). Below 960px that grid is already one column. Each card is now a `.band`, not a bare `vc-card`.

**Descuentos.** Still by tipo. If any tipo has `gtq`, the bar is the amount and a null amount is 0. Otherwise the bar is the unit count. Amber, row weight. No click. No 12-row cap.

**Subidas de precios.** Was one or two `NamedBars` charts, and only for projects whose `gtq` or `usd` was not null. Now the roster. A missing project is 0. Null money is 0. The bars are the project weight and the project hue. Quetzales is drawn when any project’s quetzales are not zero, or when dólares are all zero. Dólares is drawn only when some dólares are not zero. When both charts are on screen, the subtitles are “Quetzales” and “Dólares”. When only one is on screen, the currency symbol on the number is the label. No click.

**F&F y casos especiales.** The bar is still the unit count, not the amount. `casoAmounts` is the same derivation as before: when every trace is priced and the trace count equals `marked`, a tipo that arrived without `gtq` receives the sum of its traces, except the `resto` row. When a row has `gtq`, the mark reads `{unidades} · {quetzales}` and the gutter is 168px. Otherwise the mark is the count. Navy, row weight. No click.

**Promociones.** Still by tipo. Money when any tipo has `gtq`, otherwise units. Navy, row weight. No click. The month series on the promoción vista is still not drawn. It was not drawn before.

## 8. Control Referidos

Was a `vc-card` with a sentence “{n} referidos.”, a thin bar chart by tipo, a heading Referidores, and `ul.vc-referidos`.

Now a full-width card. The count sentence is gone. The number is the bar. By tipo, the bars are project weight and navy. If nothing is broken out by tipo and `si` is greater than 0, one bar is labeled Referidos. `si === 0` still prints “Ningún trato está marcado como referido.” `scopedDeals === 0` still renders nothing under the title. The sentence about tratos that bring no referido, no tipo, and no referidor is unchanged. “{n} sin tipo de referido.” is unchanged. The referidor list is still there, now 13px and weight 700, with the same truncation note when `nombresTotal` is larger than the list. No click. Referidos are still not a filter on Ventas por canales.

## 9. The two detail tables

`#vc-detalle` gained the class `vc-detail` beside `vc-card`.

The titles “Tratos que todavía no son venta” and “Detalle de ventas” use the band title size and the same navy at 75 percent. The section has the card border, radius, and padding. Each `.vt-table-wrap` inside it has a 1px border, an 8px radius, and a white background. Header labels and header buttons use the same navy at 75 percent. Body cells are `#0d2041` with tabular numbers. The sticky header, the 480px scroll height, and the sort buttons are the global `.vt-table` rules and were not rewritten.

Unchanged, on purpose: the columns, the sort keys, the severity colors `vt-alta` and `vt-media`, the “Quitar filtro” chip, the three focus notes (canal, etapa, torre), the “se muestran n de n” note, the two `vc-sub` sentences, `StageDetail`, `DealTable`, and `SalesTable`. Cliente is still an em dash. A click on tasa, inventario, desistimientos por proyecto, a channel, or a status chart still filters these rows the same way.

## What left command-center.tsx

These functions were the thin charts. They were deleted after the new bands took their place:

`FunnelChart`, `StackChart`, `NamedBars`, `barMark`, `ModeloPanel`, `DesistenciasPanel`, the old `ValorBand`, `ValueTrajectory`, `ProjectValue`, `PriceTrajectory`, `CurrencyLine`, `DiscountImpact`, `casoAmounts`, `ControlesPanel`, the old `ReferidosBand`, and `ReferidosBody`.

With them went the Recharts composed chart and line chart imports, `dollars`, `pct`, `labelStack`, `labelMoney`, `labelDollars`, `readTower`, `isStageId`, `tipPair`, `moneyTip`, the `AMBER` constant, and the `compareProjectLabels` import. `casoAmounts` now lives in `lower-bands.tsx`. The line chart for precios lives there too.

`GapBars` stays, unmounted, as described above.
