# 110 — Lower Ventas bands: quiet captions, hairlines, asesores by project

**Date:** 2026-11-11
**Commit:** `5d778a6` — Give the lower Ventas bands room to read, and keep each asesor with their project.
**Route:** `/ventas` command center only.
**Scope:** The client. Four source files from this chat, plus two notes that were already on disk and one sticky-header hunk that was not written in this chat. No SQL, no loader, no change to a vista builder, no write to the database.

`npx tsc --noEmit` passed on the four source edits before the commit. `npm run build` was not run. No dev server was started, no browser was opened, and the database was not queried or written.

`src/lib/projects.ts` was not edited. `PROJECT_DISPLAY_ORDER` was already the shared list, by date of birth:

1. BOULEVARD 5
2. BENESTARE
3. BOSQUE LAS TAPIAS
4. SANTA ELENA

## What this does not change

Mercadeo, Cobros, Créditos, and Entregas are untouched by the four source edits. Mercadeo’s operativo view is dirty in the work tree and is not in `5d778a6`.

The vista routes, the filters, and the SQL behind a venta are untouched. The command center still asks for the same sections. The Asesores block still reads `objetivos`, `totales`, and the reserva stage that were already on the page. Nothing new is fetched.

The pill row is untouched. The opening band, `VentasTotalesBlock`, is untouched: the “Todos los Proyectos” card, the project bars, the fold height, and the rule between that overview and the per-project rows stay as changelog 108 left them. There is no new hairline between that opening and Asesores.

Chart and bar opacity are unchanged. Inventory stacks, the funnel, the rhythm lines, the gap bars, and the asesor bars keep their colors. Santa Elena still has no bar color of its own. A bar with hue `santa-elena` stays on the muted mix.

The word on the left cards is still “reserva” or “reservas”. The numbers on those cards were not resized again.

## Files

| File | What changed |
|---|---|
| `src/app/(panel)/ventas/landing-blocks.tsx` | The meta paragraph under Asesores is commented out. The list is grouped with `PROJECT_DISPLAY_ORDER`. |
| `src/app/(panel)/ventas/landing-blocks.module.css` | A container per project group, with 8px between groups. |
| `src/app/(panel)/ventas/command-center.tsx` | The “otro estado” note under inventario is commented out. A hairline follows each lower band. Tasa de conversión and Inventario are separate sections. |
| `src/app/globals.css` | `.vc-command > .vc-band-rule` only changes the hairline’s margin. The same commit also adds `.cc-filter-battery`, which this chat did not write. |

## The two sentences that are commented out

Both are still in the source, inside a JSX comment that says they can be restored. Neither string was deleted from the server.

### Asesores

Under the heading, the block used to print `objetivos.caption` when that string did not contain “¿”. The caption is built in `src/lib/ventas/vista.ts` for `objetivos-de-ventas`:

> La meta de un mes abierto es la del mes completo. El real corre hasta {rango}. Meses: {nombres}.

That paragraph is the one that wrapped under the heading. It is commented out in `AsesoresBlock`.

Two other lines under the same heading still render:

- `objetivos.notice`, when the period has no meta or the reserva notice is set.
- `totales.targetNote`, which is “La meta no se parte por torre.” when a tower is selected.

The empty state “Sin asesores en este periodo.” and the loading and error lines are unchanged.

### Inventario

`inventario.caption` was already commented out before this chat. That sentence is the one about the list price of Santa Elena staying in dollars. It stayed commented.

The line under “Inventario general por proyecto” that read “{n} unidades están en otro estado.” is `inventario.notice`. `src/lib/ventas/vista-operativo.ts` sets that notice to the “otro estado” sentence when some units fall outside vendido, congelado, and disponible, and to “Este inventario todavía no tiene filas.” when the stock query is empty.

The “otro estado” branch is commented out. A notice that does not contain that phrase still renders, so the empty-inventory sentence still shows. The note “El inventario no se parte por asesor.” still shows when an asesor is selected. The tower chart never had this notice.

## Hairlines between the lower bands

`.vc-command` is a column with `gap: 18px`. Dropping an `<hr>` in as another child would have put 18px above the stroke and 18px below it, on top of the rule’s own margin. That is too much air.

Each new rule is:

```tsx
<hr className="op-filter-rule vc-band-rule" />
```

`.op-filter-rule` is the stroke under the filters: width 100%, height 0, no border except `border-top: 1px solid #e2e8f0`. Its own margin is `8px 0 2px`.

`.vc-command > .vc-band-rule` overrides only the margin, to `-6px 0`. Flex gap is added to margin, so the space from the band above to the stroke is `18 + (-6) = 12px`, and the same 12px sits below the stroke. The bands that used to sit 18px apart now sit 12px, a 1px stroke, and 12px apart. Bar opacity is not part of this rule.

The rule is a direct child of `.vc-command`, so the selector matches. There is no rule after the last band, “Tratos que todavía no son venta”, and none between the opening and Asesores.

Tasa de conversión and the two inventory charts used to share one section, `aria-label="Conversión e inventario"`. They are now two sections, so the rule between them is also a direct child and uses the same spacing. The two inventory charts stay in one `vc-grid-2`.

A rule follows, in order:

1. Asesores
2. Status contra la fecha de cierre
3. Tasa de conversión
4. Inventario
5. Brechas contra el ritmo
6. Canales y modelos
7. Valor de proyecto (`ValorBand`)
8. Desistimientos
9. Controles (descuentos, subidas, F&F, promociones)
10. Control Referidos

The detalle section comes after the tenth rule. Nothing inside a chart was restyled to make room.

## Asesores, in canonical project order

The list used to be one flat rank: roster asesores sorted by reservas descending, then by Spanish name. The project under a name came only from `singleProject`, which looks at the reserva deals. An asesor with no reservas, or with deals in more than one project, had no project, so a sort by project could not place them.

The roster already says which project a rep carries. Migration 088 is one project per rep per month. Those cells are already on the objetivos payload as `editor.cells` (`asesorId`, `projectId`, `month`). This chat does not load them again.

`rosterProject` keeps the cells for that asesor whose `projectId` is in the display projects already passed into the block (`chartProjects`: the four names, in `PROJECT_DISPLAY_ORDER`). It sorts those cells by month descending. If two cells share a month, `compareProjectLabels` breaks the tie, so the constant still decides. The first cell wins. The label and the project’s reserva count come from that project row, in the spelling the dimension already uses (“Boulevard 5”, not the uppercase constant).

If no roster cell matches a visible project, the old `singleProject` path remains: every reserva deal for that name must sit in one display project, and the deal count must equal the row’s unidades. Otherwise the asesor has no project.

`AsesorRows` then builds one bucket per name in `PROJECT_DISPLAY_ORDER`, keyed with `projectKey`, so “Boulevard 5” and “BOULEVARD 5” are the same bucket. The sequence is the constant. It is not copied into the component as a second list.

Inside a bucket the old order remains: more reservas first, then Spanish name. A bucket with nobody is not rendered. Asesores who still have no project go in one last container, after Santa Elena, in that same unidades-then-name order.

Each bucket is a `div.projectGroup`. Adjacent groups have `margin-top: 8px`. There is no new heading. The project name under the asesor is the same `rowProject` span as before. The “de {proyecto}” share uses the chosen project’s reserva count. The unidades on the row, the meta, and the gap are still the asesor’s own figures. An asesor who changed project across the months in the period appears once, on the latest matching month, not in two blocks.

The bar scale is still one number for the whole list: the max of unidades and meta across every row. A bar in Boulevard 5 and a bar in Santa Elena are still drawn against that same scale. Widths did not become per-project.

The first row of each canonical group is the lead. `data-lead` is set only when that row also has a hue, which sets `--advisor-mix` to 18% instead of 50%, so that bar is the darker one of its color. That is the same treatment the old list gave the first row of each hue, and that first row is still the one with the most reservas in the project. The leftover group never gets a lead. No fill opacity was changed.

`AsesorLine` is the old row markup, moved so each group can render it. The accessible text on the row is the same sentence: unidades, share of the total, share of the project, meta, and the signed gap.

## Also in `5d778a6`, not written in this chat

The commit that carries the four source edits also adds:

- `changelog/108_2026-11-11_ventas-command-center-filters-and-cards.md` and `changelog/109_2026-11-11_ventas-exclude-casa-elisa.md`. Both describe earlier Ventas commits from the same day. 108 was already in the work tree when this chat started.
- A sticky filter battery. `command-center.tsx` adds `cc-filter-battery` on the existing `vc-head`. `globals.css` defines it as `position: sticky; top: 0; z-index: 30`, with the page background, and sets `overflow: auto` on `.op-screen:has(> .cc-filter-battery)`. That overflow rule matches only when the battery is a direct child of `.op-screen`. On this page the class sits on a header inside `.vc-command`, so the overflow rule does not apply here. Mercadeo’s operativo header uses the same class as a direct child of `.op-screen`, and that view is still uncommitted.

The commit as recorded is 6 files, +425 / −40. Most of the added lines are changelogs 108 and 109.
