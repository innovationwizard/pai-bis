# 109 — Casa Elisa stays out of Ventas

**Date:** 2026-11-11
**Commit:** `01f6a63` — Exclude Casa Elisa from Ventas displays.
**Route:** `/ventas`, and the Ventas section views that still list projects.
**Scope:** The client. Eight files, +90 / −58. No SQL, no loader, no change to a vista builder, no write to `ventas.dim_project`.

Changelog 108 is the same-day summary of the five Ventas commits, including this one. This entry is only the exclusion. The pill row, the card type, and the opening-band heights are in 108.

Casa Elisa is a previous project. Its units are fully sold. It was still appearing on the Ventas pill row because `projectPillOptions` appended every dimension project that was not one of the four names in `PROJECT_DISPLAY_ORDER`. The hero bars and the per-project cards already dropped it, through a local name check. This commit makes the rest of Ventas use the same four names, and leaves the row in the dimension so Cobros, Créditos, and Entregas can still read it.

`npx tsc --noEmit` passed on this edit before the commit. `npm run build` was not run. No dev server was started, no browser was opened, and the database was not queried or written.

## The four names

`src/lib/projects.ts` already held the order, by date of birth:

1. BOULEVARD 5
2. BENESTARE
3. BOSQUE LAS TAPIAS
4. SANTA ELENA

That array was not edited. What changed is who is allowed to appear.

`projectKey` is unchanged. It strips accents, turns every run of non-letters and non-digits into a space, trims, and uppercases. “Boulevard 5”, “BOULEVARD 5”, and “Boulevard-5” are one key. “Casa Elisa” and “Cobán” are not any of the four keys.

`DISPLAY_PROJECT_KEYS` is a set of those four keys, built once from the constant. `isDisplayProject(label)` is true only when `projectKey(label)` is in that set. Casa Elisa, Cobán, “Sin dato”, and any later project are false until the constant is edited. The function is exported. Today the only importers are the seven Ventas files below. Mercadeo, Cobros, Créditos, and Entregas do not import `@/lib/projects`.

`compareProjectLabels` and `sortByProjectLabel` still do not drop a row. A name outside the four still sorts after the four, then by Spanish locale. A chart shows Casa Elisa only when its call site forgot to filter. The call sites in this commit filter first, then sort.

## Pills

`projectPillOptions` used to do two passes. The first pass placed the four canonical names, using the dimension id when the label matched and an empty id when it did not. The second pass appended every choice whose id had not been used, Casa Elisa included, sorted by `compareProjectLabels`.

The second pass is gone. The function returns four entries, in constant order, and nothing else. A matched entry keeps the dimension id and uses the constant’s spelling as the label (`BOULEVARD 5`, not the dimension’s “Boulevard 5”). An unmatched name is still `{ id: "", label: name }`, so the pill can render before the dimension arrives. The old `used` set existed only to keep that extra pass from repeating a matched id. It was removed with the extra pass.

TODOS is not an entry in this array. `src/components/project-pill-row.tsx` draws TODOS itself, then one button per option. That component was not edited. A button with an empty id stays disabled. A button with an id toggles as before.

On `/ventas` the command center still builds the option list with `projectPillOptions(projects)`. `projects` is still the merged dimension list from ventas totales, objetivos, and inventario, and that merge still contains Casa Elisa. The pill row never receives it. TODOS still means `proyectos: null`. The request omits `proyecto`. The server can still return Casa Elisa. The screens below drop it after the response arrives.

Selecting every enabled pill still collapses to TODOS, because “every known id” is now the ids of the four names that have a dimension row. Turning them all off still sends `proyecto=ninguno`.

## Opening bands

`src/app/(panel)/ventas/landing-blocks.tsx`

`inBarChart` is gone. It lowercased the label, stripped accents, and returned false when the text contained “casa elisa” or “coban”. `chartProjects` now keeps a row only when `isDisplayProject` is true. The hero bars and the per-project cards both read `chartProjects`, so they show the four names and no other project. A label that merely contains those letters is no longer the rule. The rule is an exact key match against the constant.

The “Todos los Proyectos” card was not recomputed from those four bars. Its count is still `objetivos.units`, or the reserva-stage count when objetivos has not arrived. If a hidden project has reservas in the period, that headline is larger than the sum of the four cards.

`AsesoresBlock` used to pass `projectsOf`, which is every project on the objetivos vista, Casa Elisa included. It now passes `chartProjects`. That list is only used to name an asesor whose reservas in the period all sit in one project. Casa Elisa is not in the list, so that name is not printed next to an asesor. The asesor’s count, meta, and share of the total are still the vista’s numbers. Those numbers are not rebuilt from the four projects.

## Command center charts and lists

`src/app/(panel)/ventas/command-center.tsx`

`displayProjects` filters with `isDisplayProject`, then `sortByProjectLabel`. These bands use it:

| Band | What is drawn |
|---|---|
| Inventario general por proyecto | `inventario.byProject` |
| Inventario general por torre | A tower stays when its project label is one of the four. The label is taken from `inventario.byProject` for that `projectId`, then from the merged project map. An unknown id is dropped. |
| Brecha contra el ritmo por proyecto | `status.byProject` |
| Desistimientos por proyecto | `desistimientos.byProject`. Whether that card prints quetzales or units is decided from the rows that remain, plus the motivo rows. A hidden project’s quetzales no longer flip the card into money mode by themselves. |
| Valor de proyecto | The per-project bars under the twelve-month line. The twelve-month line is the vista’s `months` and was not filtered. |
| Subidas de precios | The quetzal bars and the dollar bars, each still limited to rows that have that currency. |

These lists use `isDisplayProject` on the project name of each row:

| List | Rule |
|---|---|
| Tratos que todavía no son venta | A blocker is drawn when its project is one of the four and it already matched the focus chip. |
| Detalle de ventas | A sale or desistimiento line is drawn when its project is one of the four and it already matched the focus chip. |
| Etapa, when a funnel stage is the focus | `listedDeals` drops deals, dropped deals, and entered deals whose project is outside the four. The “N de M” figure subtracts only the rows removed from the page that was loaded. Rows the vista never sent are still inside the server total. |

The sentence above the blocker table was not changed. It still compares `blockerTotal` with `blockers.length` from the vista, before this filter. The sales-detail sentence still uses `listShown` and `listTotal` from the vista. After a hidden row is removed, those two sentences can count a row the table does not show.

These command-center pieces were not passed through `isDisplayProject`. They are not a project axis, or they are a total the vista already summed:

- The funnel.
- The ritmo line (real, ritmo, meta).
- Brecha por asesor.
- Ventas por canales and ventas por modelo.
- Desistimientos por motivo.
- Descuentos, F&F y casos especiales, promociones, and Control Referidos.
- The Asesor and Torre selects. A tower that belongs to Casa Elisa can still be chosen there. The request then sends that `torre`. The project charts still drop any row whose project is outside the four, so that choice can leave those charts empty while the vista totals still include the tower.

The focus map `projectName` is still filled from the full merged project list, so a stored focus can still resolve a Casa Elisa id to its name. The charts no longer offer that id as a click.

## Section views

These routes still exist. Each one now drops a project that is not one of the four. TODOS on these screens is still `proyectos: null`, same as the command center: the server is not told to omit Casa Elisa.

### `glance-view.tsx`

The Proyecto menu is `vista.projects` filtered by `isDisplayProject`. “Todos los proyectos” is still the null selection. The ids used by “select all” are the ids that remain.

Objetivos “Real contra meta” and Status “Por proyecto” filter `byProject` before the grouped bars.

The drill list of sales lines returns before the project, asesor, or canal test when the line’s project fails `isDisplayProject`. A drill opened from an asesor or a canal does not list a Casa Elisa line.

The metas drawer builds its Proyecto `<select>` from `editor.projects` filtered the same way. The initial selection is the first remaining project, not `editor.projects[0]`, which could have been Casa Elisa. The history lines under the form do not print a project name. Their filter still looks up the selected id on the unfiltered `editor.projects` list, which is enough to match the label of a project that is one of the four.

### `glance-stock.tsx`

Inventario general: the stacked estado chart and the “Precio de lista disponible” chart both use `byProject` after the filter. If nothing remains, the estado chart says “Nada que graficar en este periodo.”

Valor del proyecto: “Disponible contra desistido” uses the filtered rows. The twelve-month line does not.

The vendido, congelado, and disponible KPIs are the vista totals. They were not rebuilt from the four projects.

The unit drawer still lists towers for the project or model that was opened. That open comes from a bar that already survived the filter.

### `glance-control.tsx`

| Screen | Filtered | Left as the vista sent it |
|---|---|---|
| Desistimientos | “Valor por proyecto”. The trace table in the overlay, including a trace opened from a motivo, so a Casa Elisa row does not appear under another title. | The motivo bars, the three KPIs, and the por-asesor bars inside the overlay. |
| Subidas de precios | “Por proyecto”, and the empty-state check uses the filtered length. | The twelve-month line, the KPIs, and the unit list (unidad, torre, prices, moneda). |
| F&F y casos especiales | “Por proyecto”. The “Ventas marcadas” table. | The “Contra el resto de ventas” bars and the KPIs. |
| Descuentos | — | Tipos, asesores, and the line table. Those rows have no project. |
| Promociones | — | The series and the asesor table. |

### `board.tsx`

The Proyecto checklist is `report.choices.proyecto` filtered by `isDisplayProject`. The “Por proyecto” table is `report.byProject` filtered the same way, and it is mounted when more than one of those rows remains. The tiles above the table are the report totals.

### `totales-view.tsx`

“Por proyecto” keeps a row when the project is one of the four and the row already had units or a non-zero quetzal amount. The share on that row is the share of the rows that remain, not of the vista’s net units.

The blocker table receives the filtered rows. Its “Se muestran N de M” uses a total that subtracts the blockers removed from the loaded page: `blockerTotal` from the vista, minus how many loaded blockers failed `isDisplayProject`, and never smaller than the number of rows actually passed in.

The stage dialog uses the same `listedDeals` idea as the command center, with the dialog title included. “En esta etapa”, the dropped list, and the entered list each drop a deal whose project is outside the four, and each adjusts its own “N de M” by the rows removed from that list.

## What the server still has

`ventas.dim_project` was not updated. Casa Elisa is still a project row.

`src/lib/ventas/vista.ts`, `vista-operativo.ts`, `report.ts`, and `totales-bridge.ts` were not edited. With no `proyecto` query parameter they still include every non-`is_sin_dato` project, and a sale can still add its `project_id` to a by-project series. The filter is applied in the browser, on the labels, after that payload arrives.

A request that sends one or more `proyecto` ids still means exactly those ids. The pills can only send an id that belongs to one of the four names, or `ninguno`, or no `proyecto` at all.

Cobros, Créditos, Entregas, and Mercadeo were not edited. A screen in those departments that lists Casa Elisa still lists it.
