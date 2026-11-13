# 119 — Torre and Modelo stay on Ventas por modelo, and inventario uses the availability colors

**Date:** 2026-11-12
**Route:** `/ventas` command center, checklist item 5 (Ventas por modelo) and the status colors on checklist item 6 (Inventario general). The shared filter description in `docs/SDD-Department-Command-Centers.md` changes with them.
**Scope:** Presentation and two local controls. No SQL, no loader, no rewrite of `dim_model`, no new request from the local filters, no write to the database.

This file is the record of that work. The code and the SDD were committed as `f996aa3` before this file existed. This file is not part of that commit.

| Commit | Time | Message |
|---|---|---|
| `f996aa3` | 2026-11-12 18:49 −0600 | Keep tower and model on the Ventas por modelo chart alone, so the shared filter bar no longer slices the rest of the page, and paint inventario with the same colors as the availability grid. |

`f996aa3` is 187 insertions and 41 deletions across the six files below. `npx tsc --noEmit` was not run. `npm test`, `next lint`, `next build`, `next dev`, and `next start` were not run. No port was bound. No browser was opened. No request was sent to localhost. The database was not queried or written. After the edits, the IDE reported no linter errors on `lower-bands.tsx`, `command-center.tsx`, `vista-types.ts`, `vista-operativo.ts`, and `glance-stock.tsx`.

## What was asked

Three requests, in this order.

1. Update the SDD and the Ventas command center for checklist item 5, Análisis de inventario: Split de ventas por modelo, and align the status colors on checklist item 6. Do not clean the modelo field in the source. Apply presentation rules and the new filters only.

   In `docs/SDD-Department-Command-Centers.md`:

   - Remove Torre from the shared sticky filter bar described in section 3 and everywhere else that lists Periodo / Proyecto / Asesor / Torre / Restablecer. Torre is no longer a global control.
   - Replace the section 4.2 visualization for item 5 with horizontal bars of ventas by modelo, local Torre and Modelo filters that affect only that band, default all towers and all models, zero or polluted model rows suppressed or grouped as “Otros / sin clasificar”, and any status colors taken from the availability grid.
   - In section 4.1, require the same availability-grid colors on the stacked bars of item 6, Inventario general.
   - Add a shared rule under Design Principles: inventory status colours must match `/disponibilidad`, with `UNIT_STATUS_COLORS` in `src/lib/reservas/constants.ts` as the source of truth (Disponible `#22c55e`, En revisión `#f59e0b`, Reservado `#3b82f6`, Congelado `#a855f7`, Vendido `#6b7280`).
   - Leave every other sentence in the SDD as it was.

   On the page:

   - Put Torre (default Todas) and Modelo (default Todos) immediately above the “Ventas por modelo” chart, inside that band only. They must not change the hero, objetivos, status, inventario general, tasa de conversión, or any other section.
   - Recolor the stacked bars in “Inventario general por proyecto” and “Inventario general por torre” to Disponible `#22c55e`, Congelado `#a855f7`, and Vendido `#6b7280`, using `UNIT_STATUS_COLORS` or the `--color-unit-*` tokens rather than new hard-coded values.
   - On the modelo chart, suppress pure-zero rows or group non-canonical labels (long decimals, `$/m2`, `$s`, and the like) under one “Otros / sin clasificar” bar. Keep a number on every remaining bar.
   - Keep bar thickness and row spacing consistent with the surrounding bands.
   - Do not touch any other checklist item, and do not touch the global filter battery beyond removing Torre.
   - Do not run local tests, do not start a development server, and do not open a browser.

2. Give the shell command that stages only the files from that edit, and propose a commit message in the prose style of recent commits. Do not commit from this chat.

3. Write this changelog.

## What was decided

Torre leaves the sticky bar, and it leaves the query string that bar builds. The modelo band then slices the analisis payload it already receives. That slice is component state. It does not call `setBar`, it does not call `buildParams`, and it does not refetch.

The analisis payload previously named a tower only by its display name. The same letter exists in more than one project, so a name filter would have mixed those towers. `buildAnalisis` now also sends `towerId` and `projectId` on each `byTower` row. The local Torre select stores the id. The visible name stays the tower name when that name is unique, and becomes `Proyecto · torre` when it is not.

Polluted labels are classified in the browser. `dim_model` is not updated. A row with `sold === 0` is omitted. A row whose label looks like a price, a long decimal, `$/m2`, or `$s` is added into the single “Otros / sin clasificar” bar. “Sin dato” is not in that group. It is the stored name for a missing model, and when it has sales it remains its own bar.

Item 6 already drew stacked bars. Only the three fills change, from the command-center navy, amber, and blue to the three availability-grid colors. The modelo bars stay navy. They count ventas. They are not a status.

## Files

| File | What changed |
|---|---|
| `docs/SDD-Department-Command-Centers.md` | Torre leaves the shared filter description in sections 3 and 6. A new inventory-color rule sits under Design Principles. Item 5 and item 6 visualization cells are replaced. |
| `src/app/(panel)/ventas/command-center.tsx` | The sticky Torre select is removed, and `torre` is removed from the bar state, the query, and the hero remount key. |
| `src/app/(panel)/ventas/lower-bands.tsx` | Local Torre and Modelo filters, the presentation rules for the modelo chart, and the inventario fills. |
| `src/app/(panel)/ventas/lower-bands.module.css` | `.localFilters` for those two selects. Bar thickness and row spacing are unchanged. |
| `src/lib/ventas/vista-types.ts` | `AnalisisVista.byTower` gains `towerId` and `projectId`. |
| `src/lib/ventas/vista-operativo.ts` | `buildAnalisis` fills those two fields from the tower id and `dims.towerProjects`. |

## 1. The SDD

The title block date stays 10 November 2026. Sections 1, 4.3, 5, 7, 8, 9, and 10 are unchanged. The numbered design principles 1 through 12 are unchanged. Visual density continuity and abstraction order are unchanged.

### Inventory status colours

A new subsection was inserted after principle 12 and before “Visual density continuity”. The wording was taken as given, including the British spellings “colours” and “centre”:

> Status colours for inventory (Disponible, Congelado, Reservado, Vendido, etc.) must be identical to those already used on the unit availability grid (/disponibilidad). Do not introduce a new palette on the command centre. Source of truth: UNIT_STATUS_COLORS in src/lib/reservas/constants.ts (Disponible #22c55e, En revisión #f59e0b, Reservado #3b82f6, Congelado #a855f7, Vendido #6b7280).

### Shared filter battery

Section 3, “Optional lightweight filters”, dropped Torre. It now reads “Periodo, Proyecto, Asesor”. The sticky-battery sentence in that section, and the same sentence repeated under section 6 Experience Requirements, dropped Torre from the slash list. Both now read “project pills + Periodo / Asesor / Restablecer”. The rest of each sentence is the same: full height, directly under the top navigation, no collapse, implemented first on Mercadeo and Ventas.

“por proyecto/torre” in the item 6 visualization was left in place. That phrase is the breakdown of the stacked bars, not the global control.

### Item 6

The checklist name stays “Inventario general: Vendido, congelado, disponible”. The visualization cell was “Stacked horizontal bars by proyecto/torre”. It is now that sentence plus: “Status colors on the stacked bars match the availability-grid palette (Disponible #22c55e, Congelado #a855f7, Vendido #6b7280).” This cell uses the American spelling “colors”, as the request did for this line.

### Item 5

The checklist name stays “Análisis de inventario: Split de ventas por modelo”. The visualization cell was “Horizontal bars or treemap by modelo/tipología”. It is now one cell, the five sentences from the request, in that order:

- Horizontal bars (or small multiples) of ventas by modelo.
- Local filters that affect ONLY this band: Torre and Modelo.
- Default = all towers, all models.
- Zero-value or polluted model rows are suppressed or grouped as “Otros / sin clasificar” until the source field is cleaned (data-cleaning is out of scope for the current turn).
- Any status colors that appear must match the availability-grid palette (Disponible #22c55e, Congelado #a855f7, Vendido #6b7280, etc.).

Items 4, 7, 8, and 10 through 14 in the same table were not edited.

## 2. Torre leaves the sticky bar

`BarState` no longer has `torre`. `INITIAL` no longer sets it. `buildParams` no longer appends `torre`. The `<label>Torre</label>` select between Asesor and Restablecer is gone. The `torres` memo that merged `totales.choices.torre` with `inventario.choices.torre` is gone. The remount key of `VentasTotalesBlock` no longer ends in `|${bar.torre}`.

Restablecer still clears focus and sets the bar back to `INITIAL`. Periodo, Desde, Hasta, the project pills, Asesor, the period line, the freshness stamp, and the rule under the battery are the same controls.

What stays, because it is not the global select:

- Clicking a tower row in Inventario general still calls `toggleFocus({ kind: "torre", ... })`. That focus still filters the detail tables at the bottom of the page. The note “La torre filtra el detalle de ventas…” is still there.
- `glance-view.tsx` and `board.tsx` still have their own Torre filters. They are not the command center.
- Cobros still has section-level Torre filters. Those are not the shared sticky bar. No file under Mercadeo, Cobros, Créditos, or Entregas was edited.

Because `torre` is no longer on the query, every section of `/ventas` is fetched without a tower constraint. A tower chosen on Ventas por modelo cannot narrow the hero, the objetivos, status, inventario, tasa de conversión, canales, valor, desistimientos, the control cards, Control Referidos, or the detail tables. Those sections never read the local state.

Changing Periodo, Proyecto, or Asesor still replaces `bar`, and the existing effect still clears `vistas` before the refetch. While the analisis vista is null, `ModeloBand` renders the pending line and does not mount `ModeloChart`, so the local selects return to Todas and Todos when the global bar changes.

## 3. Ventas por modelo

`ModeloBand` still owns the section, the title “Ventas por modelo”, and the pending state. When the vista is present it renders `ModeloChart`. The chart is still `clickableChart(..., count, "row", 64)` with no click handler. Weight `"row"` is the same 36px row and 26px bar as the inventario-por-torre rows and the other lower bands that use that weight. The number still sits to the right of every bar, including a short one. The gutter stays 64.

The two selects sit in `.localFilters`, after `vista.notice` and immediately above the bars. Each label is the 11px, weight-600 pattern of the global toolbar. Each select is 32px tall, at least 180px wide, with the same border, radius, and type color as `.op-toolbar select`. The band’s own gap stays 8px. No row padding and no bar height was changed.

### Torre

The value is a tower id, or `""` for Todas.

Options come from `vista.byTower` rows with `sold > 0`. A tower that only has disponible units in this payload does not appear, because the chart is ventas. The first time an id is seen, the option keeps that row’s `tower` name and `projectId`. If that short name belongs to more than one id, and `vista.projects` has a label for the project, the option text is `${project} · ${name}`. Otherwise the option text is the tower name. Options are sorted with `localeCompare(..., "es")`.

Selecting a tower rebuilds sales from `byTower` rows with that `towerId`, summed by `modelId`. Models with no sales in that tower contribute 0 and then drop out. If the current Modelo value is not among the labels that remain, it is cleared back to Todos.

If the stored id is no longer in the option list, the select’s value falls back to `""` and the chart shows every tower. The control does not keep a stale id visible.

### Modelo

The value is a trimmed model label, `""` for Todos, or the constant `Otros / sin clasificar`.

Options are the trimmed labels that still have sales after the tower slice, excluding polluted labels, sorted with `localeCompare(..., "es")`. If any polluted label has sales in that slice, “Otros / sin clasificar” is appended last. A polluted name is not offered on its own.

Todos draws every remaining canonical bar plus the Otros bar when that bar’s total is greater than zero. One canonical label draws only that bar. Otros draws only the grouped bar.

### What counts as a bar

`presentModelMarks` walks the sliced rows.

- `sold` that is not greater than zero is dropped. A model that is only disponible does not get a zero tick.
- The label is trimmed. The same trimmed text from two `dim_model` ids, which is what happens when two projects share a model name, is one bar. The height is the sum of `sold`. The previous chart was one row per id, so two bars could share a label. The select cannot tell those ids apart, and the band is “ventas por modelo”, so they are added together.
- A polluted label adds its `sold` into one bucket. The bar is labelled “Otros / sin clasificar” and uses the same navy tone as the other bars. It is sorted with them by value, then by label. It is not pinned to the bottom.
- Bars are ordered by `sold` descending, then `localeCompare(..., "es")`.

`isPollutedModelLabel` is true when any of these hold:

- The trimmed label is empty.
- The label contains `$`. That covers `$/m2`, `$s`, and a price written with a dollar sign.
- A unit token `m2` or `m²` appears, not as part of a longer letter-word. `120 m2` and `/m2` match. `Modelo2` and `AM2` do not.
- After spaces and commas are removed, the text contains a decimal with three or more fraction digits (`125000.123456`).
- The whole remaining text is an integer of five or more digits, with an optional decimal (`1250000`, `1250000.00`).
- The whole remaining text is four or more integer digits, a dot, and a fraction (`1250.50`).
- Stripping `gtq`, `usd`, or a leading-style `q` / `q.` leaves a different string that is four or more digits with an optional decimal (`Q.1250.00`).

“Sin dato”, “A”, “B”, “C”, “A PLUS”, “Tipo 2”, and other short names do not match. They stay as their own bars when `sold > 0`.

The classifier does not claim to know every future garbage string. A label that is neither a long number nor a `$` / `m2` token is drawn as written. Cleaning those rows in `dim_model` was out of scope.

### Empty state

If the period notice is set and neither local filter narrows the chart, the notice stands alone, as it did before. “Este periodo todavía no tiene ventas.” is that notice. If a local filter is on and nothing remains, or there is no notice and nothing remains, the existing line “Nada que graficar en este periodo.” is shown under the selects. The selects stay so the choice can be opened again.

## 4. Inventario general colors

`STOCK` is the legend and the segment list for both stacked charts. It is used only by `StackChart`, and `StackChart` is used only by `InventarioBands`. The three entries are now:

| Segment | Constant | Hex |
|---|---|---|
| Disponible | `UNIT_STATUS_COLORS.AVAILABLE` | `#22c55e` |
| Congelado | `UNIT_STATUS_COLORS.FROZEN` | `#a855f7` |
| Vendido | `UNIT_STATUS_COLORS.SOLD` | `#6b7280` |

Those are the same values as `--color-unit-available`, `--color-unit-frozen`, and `--color-unit-sold` in `src/app/globals.css`, and the same values the unit grid at `/disponibilidad` paints from `UNIT_STATUS_COLORS`. En revisión (`#f59e0b`) and Reservado (`#3b82f6`) are in the shared SDD rule. These two charts do not draw those statuses. They still draw only vendido, congelado, and disponible. Segment order is unchanged: Disponible, then Congelado, then Vendido.

The previous fills were `BLUE` `#0573b0`, `AMBER` `#b45309`, and `NAVY` `#0d2041`. Those three constants remain in the file. Valor, descuentos, and the other bands still use them. They are not inventory status.

A segment wide enough to hold its count (`value / scale >= 0.14`) still prints the count inside the segment. Disponible is a light green, so that count is navy `#0d2041`. Congelado and Vendido keep white, which is what the availability cells use on those fills. Counts that do not fit inside the segment still sit in the figures column, colored with the segment fill. The legend swatches use the same three fills. No opacity was copied from the sold cells on the grid. The grid draws Vendido at 0.6 opacity. These bars use `#6b7280` as stored.

The asesor note, the “otro estado” notice handling, project order, tower order, and the click that focuses a project or a tower are unchanged.

## 5. The analisis payload

`AnalisisVista.byTower` was `{ modelId, tower, sold, available }`. It is now `{ modelId, towerId, projectId, tower, sold, available }`.

`buildAnalisis` already grouped sales and disponible units by tower id. The push now keeps that id, reads `dims.towerProjects` for the project id, and still labels the tower with `dims.torres`. `towerProjects` was already loaded with `dim_tower.project_id`. No new query was added. `choices.torre` is still built from the sales rows. The command center no longer reads it. The local select does not read it either. It reads `byTower`.

`filters.torreId` and `filters.modeloId` are still honored inside `buildAnalisis` if a caller sends them. The command center does not send `torre`. It has never sent `modelo` from this bar. The fetched analisis vista is therefore all towers and all models for the current period, projects, and the other constraints that route already applied.

`glance-stock.tsx` still lists `byTower` for an analisis drill as Torre / Vendidas / Disponible, keyed by `modelId` and `tower`. It does not read `towerId` or `projectId`. The inventario drill still filters its own `byTower`, which was not given those fields. `InventarioVista.byTower` is still `{ projectId, tower, vendido, congelado, disponible }`.

## What this does not change

Mercadeo, Cobros, Créditos, and Entregas code is untouched. `scripts/creditos/load.py` and `src/app/(panel)/mercadeo/operativo-view.tsx` were already dirty and are not in `f996aa3`. The untracked files that were present at the start of the conversation are not in it either.

On Ventas, items other than the modelo band and the inventario fills are untouched: the hero, objetivos, status, Ventas por canales, tasa de conversión, valor de proyecto, desistimientos, the four control cards, Control Referidos, and both detail tables. The hairlines stay where they were. Brecha contra el ritmo stays inside the JSX comment.

The modelo source rows are untouched. No migration, no `UPDATE` of `ventas.dim_model`, and no change to `scripts/ventas/load.py`.

## Staging and the commit

The command proposed for staging this turn, and only this turn, was:

```bash
git add \
  docs/SDD-Department-Command-Centers.md \
  "src/app/(panel)/ventas/command-center.tsx" \
  "src/app/(panel)/ventas/lower-bands.module.css" \
  "src/app/(panel)/ventas/lower-bands.tsx" \
  src/lib/ventas/vista-operativo.ts \
  src/lib/ventas/vista-types.ts
```

It was not run from this chat. The commit that followed contains those six paths and no others.

The message proposed, and used as the subject of `f996aa3`, was:

```
Keep tower and model on the Ventas por modelo chart alone, so the shared filter bar no longer slices the rest of the page, and paint inventario with the same colors as the availability grid.
```

This changelog did not exist when that command was proposed. Staging with the command above does not stage this file.
