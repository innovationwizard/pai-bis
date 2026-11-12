# 115 — Ventas por canales: a reserva dot plot, then one count per reserva

**Date:** 2026-11-12
**Route:** `/ventas` command center. The older section page at `/ventas/ventas-por-canales` still reads the sale series and was not restyled.
**Scope:** The command-center band, the `ventas-por-canales` payload field `byFuente`, and the reserva load that fills `dim_deal.fuente_id` onto each comprobante. No SQL. No change to `scripts/ventas/load.py`. The database was not queried or written.

Five commits landed from this chat. This file is the record of that work. It was not part of those commits.

| Commit | Date | Message |
|---|---|---|
| `1deb158` | 2026-11-12 | Draw Ventas por canales as a sorted dot plot of reservas, after Status por asesor, so each channel stays lighter than the project bars and the count sits on the same grid. |
| `0fb10ab` | 2026-11-12 | Count a multi-value Fuente once for each channel it names, so a joined label becomes separate dots sorted by reservas. |
| `9d093f7` | 2026-11-12 | Split a Fuente on every comma, so a joined label still becomes one channel when the stored separator has no space. |
| `9585849` | 2026-11-12 | Keep a channel off the dot plot when its label still contains a comma, so only a single Fuente name is drawn. |
| `c137d13` | 2026-11-12 | Count each reserva under one Fuente, keeping only the first name in a joined label so the channel counts no longer exceed the period total. |

`npx tsc --noEmit` passed after the dot plot, after the explosion, after the separator change, after the plot filter, and after the single-count change. Each run exited 0. The only console line was npm’s warning about an unknown `devdir` env config. `npm run build` was not run. No dev server was started and no browser was opened.

`1deb158` also contains `changelog/114_2026-11-12_ventas-status-cierre.md`. That file records the previous chat. It was already staged when the dot-plot files were committed, so it rode along. Its content is not this work.

A later commit, `84fca73` (“Restyle the Ventas bands under Ventas por canales…”), is not part of this chat. It moves the bands below this one into `lower-bands.tsx`. This file stops at `c137d13`.

## What this does not change

Mercadeo, Cobros, Créditos, and Entregas are untouched.

On Ventas, the opening fold, Objetivos, and the three Status bands are untouched. The filters are untouched. Periodo, Proyecto, Asesor, and Torre still define the window the same way.

The sale series inside the same payload is untouched through all five commits. `channels` is still the top 8 `v_sale` fuentes plus “Otras fuentes”. `series` is still the month lines for the top 4. `units`, `gtq`, `leader`, and `leaderShare` are still sale figures. `GET /api/ventas` (`src/lib/ventas/report.ts`) still groups closed sales by `fuente_id` and was not edited. `glance-view.tsx` still draws `vista.channels` as bars and `vista.series` as “Los cuatro canales, mes a mes”.

`scripts/ventas/load.py` still stores a Pipedrive set as one `dim_fuente.name`. `parse_label` still joins a JSON array with `", "` and still leaves any other string, including a pipe, as one name. This chat only changes how the vista reads that stored name.

## Files

| File | What changed |
|---|---|
| `src/app/(panel)/ventas/landing-blocks.tsx` | `CanalesBlock` and the dot plot. `9585849` adds the comma filter on the rows the plot draws. |
| `src/app/(panel)/ventas/landing-blocks.module.css` | The lollipop rules: frame, row, 2px stem, 7px dot, count. Added in `1deb158`. |
| `src/app/(panel)/ventas/command-center.tsx` | The band is mounted after Status por asesor. The old `CanalesPanel` bar card is removed. |
| `src/lib/ventas/vista-types.ts` | `CanalesVista.byFuente`. |
| `src/lib/ventas/vista.ts` | Reserva rows carry `fuenteId`. `byFuente` is built from them. `0fb10ab`, `9d093f7`, and `c137d13` only change that builder. |

## Where it sits

`CanalesBlock` is its own section, after the status `<article>` and its hairline, and before “Tasa de conversión”. It is not inside the status card, and it is not between “Status por proyecto” and “Status por asesor”.

The old “Canales y modelos” pair is gone. “Ventas por modelo” remains, alone, lower on the page, still a horizontal bar chart. The click on a channel name still calls `toggleFocus({ kind: "fuente", id, label })`, which filters the detalle. It does not refetch the vista.

## 1. The dot plot — `1deb158`

The band title is exactly “Ventas por canales”. It uses `.bandHead .panelTitle`: `rgba(13, 32, 65, 0.75)`, `calc(26px * 0.75)`, weight 700, line-height 1.25. That is the same rule as `.kpiName` on the left-side cards and as “Objetivos por proyecto”, “Status por proyecto”, “Status por asesor”, and “Status de todos los proyectos”. There is no unit word and no caption under the title.

The plot is a lollipop, not a bar:

- One row per channel, 32px tall, 2px row gap.
- Sort is descending by the reserva count, then the label in Spanish.
- A 2px horizontal line runs from the origin to a filled 7px dot. Both are `#0d2041` for every row. Channels do not take project colors.
- The integer count sits 10px to the right of the dot, 13px, weight 700.
- The grid is the existing `GoalScale` / `.goalGridLine`: one faint line per integer from 0 through `floor(scale) + 1`, color `rgba(148, 163, 184, 0.12)`.
- The scale is the largest count on the plot. The top dot sits at the right edge of the field. The number uses the same 60px gutter as the goal rows.
- A zero count is omitted. A label that normalizes to “sin dato” is omitted. There is no total, no share, and no sentence under the plot.
- The card is `styles.block` plus `styles.panel`, so it has the same border and surface as “Status por asesor”. The mark is lighter than the 48px project bars in `metaBand`.

Below 640px the frame stacks like the goal rows and the grid is hidden with `.goalScale`.

While the vista is null, the band shows the section error, or “Cargando…”. An empty `byFuente` renders the title and nothing else.

The count is reservas, not closed sales. `loadReservas` already read `ventas.fact_comprobante` for Objetivos and Status. For `ventas-por-canales` it now runs as well (`needsReservas`). Each comprobante in the period is joined to `ventas.dim_deal` on `id`, and the deal’s `fuente_id` is kept. `dim_deal.fuente_id` is filled by the loader from the Pipedrive deal column `Fuente`. The activity itself has no Fuente.

`loadReservas` selects `fuente_id` together with `id`, `project_id`, `asesor_id`, and `unit_id`. The in-memory `Reserva` type gains `fuenteId`. A comprobante with no deal is kept only when Proyecto, Asesor, and Torre are all open, and then `fuenteId` is `""`. Non-reps, the project filter, the asesor filter, and the torre filter are the same gates Objetivos and Status already use.

`CanalesVista` gains:

```ts
byFuente: { id: string; label: string; reservas: number }[]
```

`buildCanales` sets `byFuente` from that list. The command center passes the whole vista into `CanalesBlock`. `channelRows` reads `vista.byFuente`, copies `label`, and the plot prints `label`. It does not read `channels`.

## 2. One dot per name in a joined Fuente — `0fb10ab`

`dim_fuente.name` is one string even when Pipedrive stored several values. The loader’s only join is `", ".join(...)` inside `parse_label`. `0fb10ab` splits that stored name on the two characters comma and space, trims each piece, drops an empty piece and any piece that normalizes to “sin dato”, and adds 1 to every remaining piece.

A reserva whose name is `Label A, Label B` increments both labels. A name with no `", "` stays one channel. A fuente flagged `is_sin_dato` is still skipped before the split. The payload shape does not change. The sale series does not change.

This is the step that makes the channel counts larger than the reserva total. `c137d13` removes it.

## 3. Split on a comma with or without a space — `9d093f7`

The separator in `fuenteParts` changes from `", "` to `","`. Each segment is still trimmed. Empty segments and “sin dato” are still dropped. A name with no comma is still one element. No other function changes.

## 4. The plot refuses a label that still contains a comma — `9585849`

`channelRows` already dropped a zero count and a “sin dato” label. It now also drops any row whose `label` includes `","`:

```ts
.filter((row) => row.reservas > 0 && !sinDatoLabel(row.label) && !row.label.includes(","))
```

The payload is unchanged. A joined name that the server still returns as one string never reaches the dot. The sort, the lollipop, and the title stay as they were.

## 5. Each reserva is counted once — `c137d13`

This is the aggregation the page uses after this chat.

`fuenteParts` is replaced by `fuenteChannel`. For one stored name:

- If the name contains a comma, the channel is the first trimmed segment that is not empty. Every later segment is discarded.
- If the name contains no comma, the channel is the trimmed name.
- If that one segment is empty, or normalizes to “sin dato”, the reserva is not added to any channel.

Normalization strips accents, lowercases, collapses whitespace, and compares with `"sin dato"`.

`reservasByFuente` no longer loops over every segment. Each reserva that survives the gates increments exactly one map entry by 1. The gates that were already there stay: an empty `fuenteId` is skipped, and a fuente with `is_sin_dato` is skipped. Those reservas, and a reserva whose first segment is empty or “sin dato”, are absent from the sum. A reserva with a usable first segment is present once.

The returned objects are still `{ id, label, reservas }`. `id` is the `dim_fuente` id when the stored name equals the chosen label. Otherwise `id` is the label string, which is what a click sends into the detalle filter. `label` is the single segment. Rows with `reservas <= 0` are not returned.

`channelRows` still sorts descending by that count and still drops a label that contains a comma. After `c137d13` the server no longer emits the joined string, so that filter is a second guard.

The plotted total is the number of reservas in the filtered period that have a real first segment. It is not the count of every `fact_comprobante` row: a comprobante with no deal, a “Sin dato” fuente, and a first segment of “sin dato” stay out. It is also not the closed-sale total in `channels`.
