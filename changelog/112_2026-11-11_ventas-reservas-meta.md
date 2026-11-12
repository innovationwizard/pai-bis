# 112 — Reservas against the meta, one bar per project

**Date:** 2026-11-11
**Route:** `/ventas` command center only.
**Scope:** A new chart between the per-project volume cards and Asesores. Three source files. No SQL, no loader, no vista builder, no new request, no write to the database. This chat did not stage or commit.

`npx tsc --noEmit` passed after the edits (exit 0). The only console line was npm’s warning about an unknown `devdir` env config. `npm run build` was not run. No dev server was started, no browser was opened, and the database was not queried or written.

`src/lib/projects.ts` was not edited. `PROJECT_DISPLAY_ORDER` was already the shared list, by date of birth:

1. BOULEVARD 5
2. BENESTARE
3. BOSQUE LAS TAPIAS
4. SANTA ELENA

## What this does not change

Mercadeo, Cobros, Créditos, and Entregas are untouched.

The opening band, `VentasTotalesBlock`, is untouched. The “Todos los Proyectos” card, the project bars above the fold, the fold height, the rule between that overview and the per-project rows, and the optional “5.000” caption at the bottom of that section stay as changelog 108 left them. The chart is a sibling after that section, so it does not sit inside `.fold` and does not take height away from those two subsections.

`AsesoresBlock` is untouched and is still the next block. Its grouping by `PROJECT_DISPLAY_ORDER`, the lead bar, the meta tick on an asesor row, the signed gap, and the share sentences are changelog 110. This chart does not reuse those classes, so none of that CSS moved.

Every band below Asesores is untouched: status, tasa de conversión, inventario, brechas, canales, valor, desistimientos, controles, referidos, and the detalle. The hairline that changelog 110 placed after Asesores is still that hairline. No second new rule was inserted between the chart and Asesores.

The vista routes are untouched. The command center still asks for the same sections. The chart reads `objetivos`, which the page already loads for `objetivos-de-ventas`. It does not read `status-de-ventas`, so it does not plot ritmo or the pace gap. It does not read `totales`.

Filters are untouched. Periodo, Desde, Hasta, the project pills, Asesor, Torre, and Restablecer still rebuild the same query. The volume block is still remounted with its filter key so a drill-down resets. The new block has no drill-down and no key.

Chart opacity on the volume bars and the asesor bars is unchanged. Santa Elena still has no color on those bars. Only the new fill uses the Santa Elena color.

## Files

| File | What changed |
|---|---|
| `src/app/(panel)/ventas/command-center.tsx` | Imports `ReservasMetaBlock`. Renders a band hairline and that block between `VentasTotalesBlock` and `AsesoresBlock`. |
| `src/app/(panel)/ventas/landing-blocks.tsx` | `metaProjects` and the exported `ReservasMetaBlock`. |
| `src/app/(panel)/ventas/landing-blocks.module.css` | `--project-santa-elena` on `.block`, and the chart classes. The 640px query also stacks the new row. |

## Where it sits

`CommandCenter` already had this order: the filter battery, `VentasTotalesBlock`, `AsesoresBlock`, then the lower bands. The insertion is:

```tsx
<VentasTotalesBlock … />
<hr className="op-filter-rule vc-band-rule" />
<ReservasMetaBlock
  objetivos={objetivos}
  objetivosError={errors["objetivos-de-ventas"] ?? null}
/>
<AsesoresBlock … />
```

The rule is the same element the lower bands use, and the same stroke as the separator under the filters. `.op-filter-rule` is width 100%, height 0, border 0, `border-top: 1px solid #e2e8f0`, with its own margin `8px 0 2px`. Because the rule is a direct child of `.vc-command`, `.vc-command > .vc-band-rule` replaces that margin with `-6px 0`. Changelog 110 records why: `.vc-command` is a column with `gap: 18px`, and flex margins do not collapse, so a bare rule would have stacked the gap on top of its own margin.

The chart section adds `margin: 8px 0` (`.metaBand`). The space between border boxes is the first item’s bottom margin, plus the 18px gap, plus the next item’s top margin:

- Volume section to the stroke: `0 + 18 + (-6) = 12px`.
- Stroke to the chart: `-6 + 18 + 8 = 20px`.
- Chart to Asesores: `8 + 18 + 0 = 26px`.

There is one new stroke, above the chart. Asesores stays the next sibling.

When the objetivos notice contains “5.000”, that caption still renders at the end of `VentasTotalesBlock`, above the new stroke, not between the chart and Asesores.

## The rows

`metaProjects` takes `objetivos.byProject` and keeps a row only when `isDisplayProject` is true. That is the same four-name test the volume cards use. Casa Elisa and any other name are dropped. A project that is not in the payload is not invented as a zero. The pills and the period already decided which rows the vista returned.

The kept rows are sorted with `compareProjectLabels`. That function ranks by `PROJECT_DISPLAY_ORDER` through `projectKey`, so “Boulevard 5” and “BOULEVARD 5” are the same rank, and a tie falls through to `localeCompare` in Spanish. The visible name is the label on the payload, not the uppercase constant. The chart does not call `projectPillOptions`, which is the helper that rewrites pill labels to the constant.

Each row is a `MeasureRow` the vista already built:

- `units` is the reserva count for that project in the filtered set. `measureRows` in `src/lib/ventas/vista.ts` sets it to the length of the reserva rows for that project id.
- `targetUnits` is the meta. The same function sums the target cells for that project with `sumNullable`. `sumNullable` (`src/lib/ventas/pace.ts`) skips nulls. If it never sees a number, it returns null. A stored zero is a real zero, not a missing meta.

The block does not read `targetGtq`, `gapUnits`, or `gapGtq`.

## The bar

The section is `styles.block` plus `styles.metaBand`. It is not `styles.panel`, so it has no card border and no card padding. `.block` supplies the column, the tabular numbers, and the project colors. `.metaBand` sets `gap: 10px` and the 8px vertical margin. The heading “Reservas y meta” uses `panelTitle` (15px, weight 700). Inside this band that heading’s own bottom margin is reset to 0, so the 10px gap is the space under the title. The section is labeled by `vt-meta-title`.

One row per project, in a grid: the name (`minmax(132px, 200px)`), the track (`minmax(72px, 1fr)`), and the figures (`auto`). Column gap is 12px. Row gap inside the list is 8px. The name is 13px and weight 700.

The track is 8px tall, radius 2px, `overflow: visible`, background `var(--color-border)`. It is the shared scale, not the meta. It is `aria-hidden`.

The fill is absolutely positioned at the left, full height of the track, radius 2px. Its width is `widthOf(units, scale)`, the same helper the volume bars and the asesor bars use: value divided by the scale, clamped from 0 to 100. A count of zero is a zero-width fill. The track still shows.

The scale is one number for every row: the max of `units` and of `targetUnits` (treated as 0 when null), and at least 1. A bar in Boulevard 5 and a bar in Santa Elena are drawn against that same scale, so a longer bar is more reservas. It is not a per-project percentage of that project’s meta. When the actual is larger than the meta, the scale includes the actual, so the fill runs past the tick and still ends at or before the right edge.

The meta is a 2px tick, `var(--color-text-primary)`, offset 3px above and below the track, centered on its position with `translateX(-50%)`. Its `left` is `widthOf(targetUnits, scale)`. The tick is omitted when `targetUnits` is null. A meta of zero still draws the tick, at the left edge. The geometry matches the asesor `tickMark`. The class is `metaTick`, so the asesor rule was not edited.

The figures sit beside the track. The actual is `whole(units)` in the primary text color, weight 700. The meta is a second span, muted, weight 600: `meta {n}` or `Sin meta`. `whole` prints an integer without a decimal, and otherwise one decimal. There is no signed gap, no “de {proyecto}”, no share of the total, and no legend sentence. The tick and the bar are not recolored when the actual is above or below the meta. `toneClass` is not used.

The fill color is the project hue. `hueKey` strips accents, lowercases, and turns other characters into hyphens, then `data-project` selects the color:

| Hue | Variable | Color |
|---|---|---|
| `benestare` | `--project-benestare` | `#0d2041` |
| `boulevard-5` | `--project-boulevard-5` | `#3d6f8f` |
| `bosque-las-tapias` | `--project-bosque-las-tapias` | `#0573b0` |
| `santa-elena` | `--project-santa-elena` | `#1a4a68` |

The first three variables were already on `.block`. `--project-santa-elena` is new on that same rule. `#1a4a68` is the Santa Elena entry already used by Mercadeo’s `PROJECT_COLOR` in `operativo-view.tsx` and `glance-view.tsx`. An unmatched hue falls back to `var(--color-muted)`. `.vbar` and `.barFill` still have no `santa-elena` selector, so the volume bars and the asesor bars do not pick up the new variable.

At `max-width: 640px` the new row becomes one column, in the same media query that already stacks an asesor row, and the figures may wrap. The name, the track, and the figures then read top to bottom. The 800px rules were not extended. Above 640px the three columns stay.

## Empty, loading, and error

The heading is always there.

- `objetivos` is null and there is no error: “Cargando…”. The volume section can show the same word at the same time. This block does not wait for `VentasTotalesBlock`.
- `objetivos` is null and `objetivos-de-ventas` failed: the error string, in the existing warn style. The volume section shows that same error on its own.
- `objetivos` arrived and no display project remains: “Sin proyectos en este periodo.”
- Otherwise the rows. A project with reservas and a null meta is still a row: the fill, no tick, and “Sin meta”.

## Not done in this chat

The chat was asked for a stage command and for a commit message. Neither was run. The message that was proposed, and not committed, is:

> Lay each project's reservas against its meta, between the volume cards and Asesores.
