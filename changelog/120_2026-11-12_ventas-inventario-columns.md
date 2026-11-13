# 120 — Inventario general stands up, and Ventas por modelo counts the availability grid

**Date:** 2026-11-12
**Route:** `/ventas` command center. Checklist item 6 (Inventario general) and checklist item 5 (Análisis de inventario: Split de ventas por modelo / Ventas por modelo). `docs/SDD-Department-Command-Centers.md` changes with them.
**Scope:** Presentation, the inventario payload, and the ventas-por-modelo payload. No SQL migration. No change to `dim_model`. No write to the database. The page reads `v_rv_units_full` for the two modelo bands. The other inventario bands still read the ventas stock snapshot.

This file is the record of that work. The code and the SDD were committed before this file existed. This file is not part of those commits.

| Commit | Time | Message |
|---|---|---|
| `e9092af` | 2026-11-12 19:44 −0600 | Stand Inventario general on vertical columns by proyecto and by torre, so the status mix keeps the availability-grid colors, a count on every segment, and the same weight as the charts above. |
| `6c94944` | 2026-11-12 20:13 −0600 | Count Reservado in the Inventario general columns and hold the y-axis to a small margin above the tallest stack, so the bars keep the availability-grid colors and the empty scale no longer outweighs them. |
| `0a84a1a` | 2026-11-12 20:45 −0600 | Lay Inventario general out as three bands — all projects, towers grouped by project, and models grouped by project — and keep those columns inside the card, so the status mix stays readable without a sideways scroll. |
| `2825bb0` | 2026-11-12 21:02 −0600 | Give each project its own Inventario por proyecto and Inventario por modelo chart on one shared scale, so the towers and models stand vertical on a common baseline and stay inside the card. |
| `d936cf2` | 2026-11-12 21:17 −0600 | Read Inventario por modelo from the availability units, grouped by project and unit type, so Boulevard 5 shows its letter families and Santa Elena shows its two house sizes. |
| `1445682` | 2026-11-12 22:40 −0600 | Count Ventas por modelo from reserved and sold units on the availability grid, so each project’s models stand as vertical columns and Boulevard 5 and Santa Elena keep their own categories. |
| `690305c` | 2026-11-12 23:05 −0600 | Draw a line between projects in the inventory and Ventas por modelo charts, keep Santa Elena in each band with its real counts, and paint each project's sales columns in its own blue. |
| `02da3c6` | 2026-11-12 23:13 −0600 | Keep all four projects on Inventario por proyecto at once, so Boulevard 5 and Santa Elena both stay on the band and the columns shrink to fit the card. |

`npx tsc --noEmit` was not run. `npm test`, `next lint`, `next build`, `next dev`, and `next start` were not run. No port was bound. No browser was opened. No request was sent to localhost. The database was not queried or written from this chat. After each edit, the IDE reported no linter errors on the files that were open for that edit.

The missing-data rule and the expanded Santa Elena paragraph were written as their own turn. They were committed inside `0a84a1a`, because that commit staged the whole SDD file, which already held both the three-band visualization and those two notes.

## What was asked

Nine requests, in this order.

1. Replace the horizontal stacked bars for Inventario general with vertical stacked columns, and update section 4.1 item 6 of the SDD. Both charts (por proyecto and por torre). Availability-grid colors. A number on every segment. Thick columns and tight gaps. Torre labels wrap onto two lines. If the tower set grows large, scroll inside the band rather than thinning the columns. Do not touch the Torre/Modelo filters, the global filter bar, or any other checklist item. Do not run local tests or open a browser.

2. The shell command that stages only those files, and a prose commit message. Do not commit from this chat.

3. Add Reservado to both inventario columns. Omit En revisión. Tighten the y-axis so the tallest column has about 10–15 % of headroom and the large empty scale goes away. Do not set the axis maximum equal to the highest value. Add visual-density rule 6 for that headroom. Do not run local tests or open a browser.

4. The stage command and a prose commit message for that turn.

5. Replace the two inventario cards with three bands: “Inventario de todos los proyectos”, “Inventario por proyecto” (towers grouped by project, columns narrow enough that the card does not scroll sideways), and “Inventario por modelo” (same rules, grouped if useful). No Torre or Modelo filter on those bands. Do not run local tests or open a browser.

6. Write the missing-data rule and expand the Santa Elena note in the SDD. Do not change any other visualization or principle. Do not run local tests or open a browser. A screenshot of a Santa Elena column labeled “Sin dato” was attached with that request.

7. The stage command and a prose commit message for the three-band turn, which sat in the working tree before the SDD-only notes.

8. Replace the broken project and model layout with small multiples: one mini vertical stacked-column chart per project, a shared y-scale, a common baseline, tight gaps inside a project, a slightly larger gap between projects, no sideways scroll. Santa Elena’s placeholder tower is not drawn. “Sin dato”, “Sin torre”, and “Sin modelo” are not drawn. Do not run local tests or open a browser.

9. Point “Inventario por modelo” at `v_rv_units_full`, grouped by `project_slug` + `unit_type`. Boulevard 5 uses the letter family A–E. Santa Elena splits `491.91 m²` and `581 m²`. Omit En revisión and non-canonical types. Do not run local tests or open a browser.

10. Point “Ventas por modelo” at the same view. Sales are `RESERVED` + `SOLD` only. Keep the local Torre and Modelo filters on that band alone. Draw vertical small multiples. Same letter families and house sizes. Omit non-canonical and zero rows. Do not run local tests or open a browser.

11. Draw a stark vertical separator between projects in Inventario por proyecto, Inventario por modelo, and Ventas por modelo. Santa Elena must appear in all three, with its real counts. Ventas por modelo uses the existing project blues, not one navy for every column. Do not run local tests or open a browser.

12. Inventario por proyecto must show Boulevard 5, Benestare, Bosque Las Tapias, and Santa Elena at the same time. Do not drop one project to make room for another. Shrink columns or spacing instead. Do not run local tests or open a browser.

Requests 2, 4, and 7 asked only for a stage command and a commit message. Those commands were proposed in chat. The commits above are the ones that landed.

## What was decided

Inventario general is no longer two horizontal stacks. It is three bands of vertical columns. The first band is one column per project. The second and third are small multiples: one mini chart per project, towers or models underneath, one shared scale, and a dark line between projects.

The status colors stay the availability grid. Disponible is `#22c55e` with navy text. Reservado is `#3b82f6`. Congelado is `#a855f7`. Vendido is `#6b7280`. En revisión (`SOFT_HOLD`) is not a segment. The stack rises from the baseline in that order: Disponible, Reservado, Congelado, Vendido.

The y-axis maximum is 12 % above the tallest column in the band (`peak * 1.12`). Grid lines stay on round numbers at or below that ceiling. The old nice-number scale, which could jump from 100 to 200 or from 250 to 500, is still used by the horizontal bars. The column charts do not use it.

A segment tall enough for the digits (16 px) prints the count inside the color. A shorter segment keeps its true height and carries the count in a chip of the same color, centered on the slice. A zero segment is not drawn, except where a later rule forces a Santa Elena category to stay visible at zero.

Inventario por modelo and Ventas por modelo do not read `ventas.dim_model`. They read `v_rv_units_full` through the service-role client, in pages of 1,000, and stop if the view exceeds 5,000 rows. The group key always includes `project_slug`. Boulevard 5 collapses `unit_type` to its first letter when that letter is A, B, C, D, or E. Santa Elena, whose `unit_type` is A for every house, splits the two known sizes and still counts a house whose area is neither size under its measured area. A house with no area is counted as “Casas” so the unit is not dropped and the label is not “Sin dato”.

Ventas por modelo counts only `RESERVED` and `SOLD`. Disponible, Congelado, and En revisión stay out. The local Torre and Modelo selects still live only on that band. Default is Todas and Todos. Santa Elena’s default “Principal” tower is not offered in Torre. Its sales still appear in the chart when Todas is selected.

Santa Elena is houses, not towers. Inventario por proyecto does not draw a column named Principal. It draws one column, Casas, with the sum of that project’s stock statuses. The other three projects draw their real tower names. A roster project with no named tower still gets one column from its project totals, so the band cannot drop Boulevard 5 to make room for Santa Elena. On that band the columns are forced to shrink (`width: 0` plus `flex: 1 1 0` and `min-width: 0`) and the separator padding is 8 px, so four projects fit the card.

The project blues on Ventas por modelo are the ones already used on the Ventas landing: Benestare `#0d2041`, Boulevard 5 `#3d6f8f`, Bosque Las Tapias `#0573b0`, Santa Elena `#1a4a68`.

## Files

| File | What changed |
|---|---|
| `docs/SDD-Department-Command-Centers.md` | Item 6 becomes three vertical bands, then small multiples, then separators, then the four-project rule. Item 5 becomes vertical sales columns from `v_rv_units_full`, then separators and project blues. Visual-density rule 6 requires 10–15 % of headroom. A missing-data note forbids placeholder labels. The Santa Elena paragraph says the project is houses and must stay in canonical order. |
| `src/app/(panel)/ventas/lower-bands.tsx` | The inventario charts, the modelo sales chart, Santa Elena’s Casas column, the shared scale, and the project colors. |
| `src/app/(panel)/ventas/lower-bands.module.css` | Vertical-column layout, small multiples, and the line between projects. |
| `src/lib/ventas/vista-types.ts` | Reservado on the inventario rows. `projectSlug` on `byModel`. `modelSales` on the analisis vista. |
| `src/lib/ventas/vista-operativo.ts` | Reservado in the stock bucket. `v_rv_units_full` for both modelo bands. Letter families, house sizes, and the sales count. |

`command-center.tsx` was not edited. It already mounts `InventarioBands` and `ModeloBand`.

## 1. Vertical columns (`e9092af`)

Section 4.1 item 6 changed from “Stacked horizontal bars by proyecto/torre” to vertical stacked columns by proyecto and by torre, with a number on every segment, thick columns, tight gaps, and two-line torre labels.

`StackChart` in `lower-bands.tsx` stopped drawing a horizontal flex row. Each category is a column. The plot is 300 px for the four projects and 252 px for the towers. Project bars are 90 % of the slot. Tower bars are 86 %. The gap is 4 px. Tower columns had a floor of 152 px and the band scrolled sideways when that floor no longer fit. That floor was removed in a later commit.

Segment order from the baseline is the `STOCK` array. At this commit the array was Disponible, Congelado, Vendido. A later commit inserted Reservado. Green text is navy (`#0d2041`). The other fills use white. The same rule is still in `segmentInk`.

The y-axis at this commit still used `niceScale`, the scale the horizontal bars use. The empty field above a tall column was fixed in the next commit.

## 2. Reservado and the 12 % headroom (`6c94944`)

`bucket` in `vista-operativo.ts` now returns `reservado` when `page_status` is `Reservado`. En revisión, PCV, Promesa, Vendido en archivo, and Sin dato stay `otro` and are not drawn. `StockProject`, `InventarioVista`, and `byTower` gained `reservado`. `buildGeneral` fills it.

`STOCK` order, bottom to top: Disponible, Reservado, Congelado, Vendido. Colors are `UNIT_STATUS_COLORS.AVAILABLE`, `.RESERVED`, `.FROZEN`, and `.SOLD`.

`columnScale` sets the axis maximum to `peak * 1.12`. When that ceiling is 16 or less, the marks are every integer up to it. Above that, `columnStep` picks a 1 / 2 / 2.5 / 5 / 10 step so the plot has about four to six round lines. The top of the plot is the 12 % ceiling even when the last labeled line sits lower. `niceScale` is unchanged and still serves the horizontal charts.

Visual-density continuity gained rule 6, Vertical scale headroom. The wording is the one that was requested, including “10–15 %” and “The bars, not the empty scale, must dominate the visual weight.”

## 3. Three bands, and the two SDD notes (`0a84a1a`)

The cards were renamed.

| Before | After |
|---|---|
| Inventario general por proyecto | Inventario de todos los proyectos |
| Inventario general por torre | Inventario por proyecto |
| (none) | Inventario por modelo |

Inventario de todos los proyectos is still one `StackChart`: four columns, canonical roster order, no group header.

Inventario por proyecto groups towers by project. The visible axis label is the tower name. The accessible name is still `Proyecto · torre`. A click still calls `onTower`.

Inventario por modelo was first filled from `ventas.dim_model` on the stock rows, one row per `projectId` + `modelId`. That source was replaced in `d936cf2`. Columns with a placeholder name (`Sin dato`, `Sin modelo`, `Sin torre`, and the other missing-data phrases) are not drawn. A model whose four statuses are all zero is not drawn.

The 152 px column floor and the sideways scroll were removed so the tower and model bands stay inside the card.

### Missing-data labels

A subsection was inserted after principle 13 and before “Inventory status colours”. Principles 1 through 13 were not renumbered. The text forbids “Sin dato”, “Sin asesor”, “Asesor pending”, “Meta pending”, “Sin torre”, “Sin modelo”, and any equivalent. A breakdown with no rows is omitted. The gap is the signal.

### Santa Elena

The paragraph under the Band A table was replaced. Santa Elena is houses, not towers. A stored “Principal” row must not be shown as a tower. Sales are paused, the meta for the period is zero, and no asesores are assigned. The project stays in canonical order and is shown with its real values and its real meta, including zero.

## 4. Small multiples (`2825bb0`)

Inventario por proyecto and Inventario por modelo stopped sharing one flex row and one absolute grid. `SmallMultiples` draws one mini chart per project. The project name is an `h3` above the columns. Every mini chart uses the same `columnScale` result. Each mini chart has its own baseline and its own grid lines. The y-axis sits once, at the left, and its top margin matches the header height (26 px).

The gap inside a mini chart stayed 4 px. The first separator between minis was 14 px of margin and padding. A later commit made that break a line.

Santa Elena’s tower group was skipped in this commit, because the SDD said not to surface Principal. “Sin dato”, “Sin torre”, and “Sin modelo” were dropped by `isMissingLabel`. Both of those omissions were walked back, in part, by `690305c` and `02da3c6`.

## 5. Inventario por modelo reads the availability view (`d936cf2`)

`loadRvUnits` selects `project_slug`, `unit_type`, `area_total`, and `status` from `v_rv_units_full` with `createAdminClient()` on the public schema. The ventas client stays on `schema("ventas")` and is not used for this view. A later commit added `tower_id`, `tower_name`, and `tower_is_default` to the same select so Ventas por modelo can filter by tower without a second query shape.

`modelRowsFromUnits` groups by `projectSlug|label`. The label is:

- Boulevard 5: the first character of `unit_type`, and only when it is A, B, C, D, or E. The individual plan codes are not plotted.
- Santa Elena: `491.91 m²` or `581 m²` when `area_total` is within 0.05 of those values. After `690305c`, any other finite area is labeled with that measurement, and a missing area is labeled “Casas”, so a house is not dropped for failing the two-size test.
- Any other project: the trimmed `unit_type`, when it is canonical.

Canonical rejects an empty string, “Sin dato”, “Sin modelo”, “Sin torre”, “Cantidad”, “Modelo”, “Tipo”, “unit type”, “unit_type”, “tipologia”, “precio”, “price”, “header”, any value containing `$`, an `m²` token, a long decimal, and a long bare number. En revisión (`SOFT_HOLD`) returns null from `availabilityStatus` and is not counted. `AVAILABLE`, `RESERVED`, `FROZEN`, and `SOLD` map to disponible, reservado, congelado, and vendido.

The global project pills still apply. `allowedSlugs` maps the selected ventas project ids through `projectKey` onto `boulevard-5`, `benestare`, `bosque-las-tapias`, and `santa-elena`. Casa Elisa is not in that list. A null `projectIds` means all four. An empty array means none.

`byModel` carries `projectId` (the ventas dimension id when the name matches) and `projectSlug`. The chart matches on the slug first, so a public `projects.id` and a `ventas.dim_project.id` do not have to be the same uuid.

## 6. Ventas por modelo (`1445682`)

`AnalisisVista` gained `modelSales`: `projectSlug`, `projectId`, `towerId`, `towerName`, `model`, `sold`. `buildAnalisis` still builds the old `models` and `byTower` arrays for the glance screen. The command-center band does not read them.

`saleRowsFromUnits` keeps a unit only when `status` is `RESERVED` or `SOLD`. The category rules are `modelCategory`, the same function Inventario por modelo uses. The grain is `projectSlug|towerId|label`, so the local Torre select can slice without a refetch. Santa Elena’s default tower, a tower named Principal, and a tower named Sin torre or Sin dato are stored with an empty `towerId`. Those units still count in the chart. They are not listed in the Torre select.

The horizontal `clickableChart` path, the “Otros / sin clasificar” bucket, and the old `dim_model` tower join were removed from `ModeloChart`. The band now calls `SmallMultiples` with `legend={false}`, because the column is a sales count, not a status stack. Each column is one navy segment. `690305c` replaced that navy with the project blue.

Torre defaults to Todas. Modelo defaults to Todos. Choosing a tower drops a Modelo value that the tower does not contain. Both selects are component state. They do not call `setBar` and they do not refetch. The sticky filter bar is untouched.

## 7. Separators, Santa Elena, and the project blues (`690305c`)

`.mini + .mini` draws `border-left: 3px solid #0d2041`, with 14 px of margin and padding. The line runs through the project header and the columns. Spacing is not the only break. The same class is used by all three small-multiple bands, so each band has its own line between its own projects. Inventario de todos los proyectos is still one chart and has no such line.

Inventario por proyecto stopped skipping Santa Elena. Its towers, including Principal, are summed into one column labeled Casas. The word Principal is not printed. A click on that column filters by the project, not by a tower. `02da3c6` kept that Casas column and stopped using the Principal test on the other projects.

`santaElenaSize` no longer returns null for an unmatched area. Inventario por modelo and Ventas por modelo therefore keep those units.

Ventas por modelo colors:

| Project | Slug | Color |
|---|---|---|
| Benestare | `benestare` | `#0d2041` |
| Boulevard 5 | `boulevard-5` | `#3d6f8f` |
| Bosque Las Tapias | `bosque-las-tapias` | `#0573b0` |
| Santa Elena | `santa-elena` | `#1a4a68` |

These are the `--project-*` tokens already used by the Ventas landing bars. When Todas is selected and no Modelo is selected, Santa Elena is inserted even if both sizes are zero, so a paused project is not an empty gap. A Torre or Modelo selection does not invent that zero pair back into the chart.

The SDD cells for item 6 and item 5 gained the separator sentence, the “do not omit Santa Elena” sentence, and, on item 5, the project-blue sentence.

## 8. All four projects on Inventario por proyecto (`02da3c6`)

`towerGroups` used to drop a project whose towers were all named Principal or were all placeholder labels. That dropped Boulevard 5 when its towers failed the Principal test, and it dropped any project once Santa Elena occupied the row. The Principal test now applies only inside the Santa Elena branch, which still collapses every tower into Casas.

For Boulevard 5, Benestare, and Bosque Las Tapias, every tower whose name is not a missing-data label is drawn. If a roster project has no such tower, the band still draws one column from `byProject` (vendido, reservado, congelado, disponible), so the project is not removed to make room. Order is the roster order, which is the canonical order when every project pill is on.

`SmallMultiples` takes `fit` only from Inventario por proyecto. `.multiplesFit` sets each column to `flex: 1 1 0`, `width: 0`, and `min-width: 0`, and reduces the separator padding from 14 px to 8 px. The 3 px line stays. Inventario por modelo and Ventas por modelo keep the wider separator and their own column sizing.

The item 6 cell gained this sentence: “Inventario por proyecto” must display all four projects (BOULEVARD 5, BENESTARE, BOSQUE LAS TAPIAS, SANTA ELENA) simultaneously in canonical order. No project may be omitted to make room for another.

## What the page shows now

Inventario de todos los proyectos. Four stacked columns. Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena. Scale is 12 % above the tallest. Colors as above. A click still filters the detail by project.

Inventario por proyecto. One mini chart per roster project, in that order, with a dark line between them. Towers under the first three. Casas under Santa Elena, equal to the sum of its stock rows, or to the project totals when no tower row is linked. Shared scale. No sideways scroll.

Inventario por modelo. One mini chart per project that has a canonical unit type. Boulevard 5 is A–E. Santa Elena is the two sizes, plus any other measured area the view actually returns, plus Casas when the area is missing. Shared scale. Same four statuses. En revisión is absent. A dark line between projects.

Ventas por modelo. Torre and Modelo, default Todas and Todos. One mini chart per project that has reserved or sold units, plus Santa Elena’s two sizes when neither filter is set. Columns are the project blue. Counts are `RESERVED` + `SOLD` only. A dark line between projects.

The sticky bar is still project pills, Periodo, Asesor, and Restablecer. Torre is not on it.

## What was not done

No migration was written. `v_rv_units_full` was not altered. The chat did not run the page, so the live counts for Santa Elena were not printed here. The chart uses whatever that view and the ventas stock snapshot return. A size or a tower that the view does not contain is not given a made-up positive count. Santa Elena’s two size labels are shown at zero on Ventas por modelo, and on Inventario por modelo when that size has no row, because those two categories are the specified split and the project is not allowed to disappear.

Glance still reads `AnalisisVista.models` and `byTower` from the period sales query. The command-center band does not.
