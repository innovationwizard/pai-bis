# 113 — Objetivos bands: one scale, then density and hierarchy

**Date:** 2026-11-11
**Route:** `/ventas` command center. The design note covers all five departments.
**Scope:** The Ventas landing client and `docs/SDD-Department-Command-Centers.md`. No SQL, no loader, no vista builder, no new request, no write to the database.

Eight commits landed from this chat, `fcf5851` through `fe83b1b`. One SDD section written at the end of the chat is still uncommitted. This file is that record. It was not part of those eight commits.

`npx tsc --noEmit` passed after the alignment, the continuous grid, the unitary grid, the objective-band density pass, the opening-viewport pass, and the project-color pass. Each run exited 0. The only console line was npm’s warning about an unknown `devdir` env config. The later one-line opacity edits, the project-bar doubling, and both SDD insertions were CSS or Markdown only and were not typechecked on their own. `npm run build` was not run. No dev server was started, no browser was opened, and the database was not queried or written.

`src/lib/projects.ts` and `src/app/(panel)/ventas/command-center.tsx` were not edited. `PROJECT_DISPLAY_ORDER` was already the shared list, by date of birth:

1. BOULEVARD 5
2. BENESTARE
3. BOSQUE LAS TAPIAS
4. SANTA ELENA

## Commits

| Commit | Message |
|---|---|
| `fcf5851` | Put Objetivos por proyecto and Objetivos por asesor on the same scale: the actual beside the bar, the meta above the tick, and the gap at the right. |
| `333ddfa` | Draw one faint scale behind Objetivos por proyecto and Objetivos por asesor, so every bar in a band shares the same lines. |
| `c8dbc8d` | Give Objetivos por proyecto and Objetivos por asesor the density of the viewport above them, with a line on every integer, and commit the Command Center design note that now requires that continuity. |
| `107643e` | Lighten the opening Ventas viewport: narrower bars, smaller card type, and a shorter first band. |
| `d7d7c71` | Soften the opening card labels so the names sit a step behind the numbers. |
| `1869ae9` | Ease the opening card labels one step further behind the numbers. |
| `a47609a` | Give the objective bands the same weight and project blue as the opening cards, and let each asesor’s bar carry the project name. |
| `fe83b1b` | Give Objetivos por proyecto bars twice the weight, so each project reads before its asesor rows. |

`fcf5851` also added `changelog/112_2026-11-11_ventas-reservas-meta.md`. That note describes the chart that already existed before this chat (one bar per project, between the volume cards and Asesores). This chat did not write 112. It was untracked and went in with the first commit of this work.

## What this does not change

Mercadeo, Cobros, Créditos, and Entregas source files are untouched.

Mercadeo’s operativo view was read, not edited. Its project series already use the same dark blues (`benestare` `#0d2041`, `boulevard-5` `#3d6f8f`, `bosque-las-tapias` `#0573b0`, `santa-elena` `#1a4a68`). Bars whose color means budget status, a missing source, or “sin dato” were left on that meaning.

On Ventas, charts whose color means deficit or surplus, inventory state (vendido, congelado, disponible), desistimiento, or a money measure were left on that meaning. The project blue is for bars that identify a project or an asesor of a project.

Filters, the vista routes, and the command-center section list are untouched. Both bands still read the `objetivos` vista the page already loads.

The fold height is still `calc(100dvh - 308px)`. Shortening the first sub-section gives the second sub-section more of that fold. The second sub-section still fills the remainder and still scrolls inside the fold if the project list grows.

Everything below “Objetivos por asesor” is untouched: status, tasa de conversión, inventario, brechas, canales, valor, desistimientos, controles, referidos, and the detalle.

## 1. One chart for both objective bands — `fcf5851`

`ReservasMetaBlock` was titled “Reservas y meta”. `AsesoresBlock` was titled “Asesores”. They are now “Objetivos por proyecto” and “Objetivos por asesor”.

The old project row was a thin fill, a tick, and a figures column that printed the actual plus either `meta N` or the words “Sin meta”. The old asesor row printed share sentences (“del total”, “de {proyecto}”), the word “meta”, and a signed gap, and the empty roster printed “Sin asesores en este periodo”. `objetivos.notice` and `totales.targetNote` were shown above the asesor list. Those sentences are gone. The commented restore note for the open-month caption is still in the file and still commented.

Both bands now share `GoalLine`. Each row is a name, a plot, and a delta pill.

- The actual number sits just to the right of the bar end, in a 60px gutter inside the plot, so the longest bar does not run into the delta.
- The meta number sits above the tick. The tick is 2px wide and 14px tall. A 3px red segment spans a shortfall. A 3px green segment spans a surplus. They use the lane between the meta number and the bar.
- The delta is the existing green or red pill (`+N` / `−N`, or `0` when the gap is zero), in a 72px column, then 16px of outer padding.
- Project order is `compareProjectLabels`, which follows `PROJECT_DISPLAY_ORDER`. Asesores stay grouped in that same order. A project with no asesores renders nothing. There is no “Sin asesor”, “Sin meta”, or “Asesor pending” string in these two bands.
- Santa Elena is special only when its `targetUnits` is null. `metaProjects` then stores 0. A stored number, including an explicit 0, is left as stored. The row shows that actual and that meta. The vista builder was not changed, and no meta was written to the database.

The U / % control sits on “Objetivos por proyecto” only. It uses the same global classes as the Operativo / Directivo switch in the header: `tier-switch` and `tier-switch-compact`. The buttons read “U” and “%”, with accessible names “Unidades” and “Porcentaje”. Default is units.

- In units, bar length is the unit count on a shared scale of the largest actual or meta in the band. Labels are unit counts. The delta is units minus meta.
- In percent, if any row has a meta above zero, bar length is fulfillment and the shared scale is at least 100. The actual reads as a rounded percent. The meta above a positive target reads “100%”. The delta pill stays in units.
- A meta of zero does not become a percent. The labels stay the unit actual and `0`. If the band is otherwise on the percent scale, that row’s bar width is 0. If nobody in the band has a positive meta, the axis stays in units so a zero meta can still show a unit bar.

`AsesoresBlock` is always in units. It still places each asesor with `rosterProject`, then `singleProject`, and still drops anyone outside `rosterAsesorIds`.

## 2. One continuous scale, then a line per integer — `333ddfa`, then `c8dbc8d`

The first grid drew a short vertical segment inside each row. Because each row sized its own name column, those segments did not share an x position.

`333ddfa` replaced that with one `GoalScale` per band. The band is one grid: `minmax(140px, 200px)`, the plot, and a 72px delta. Rows and project groups use `subgrid`, so every plot in the band is the same column. The scale is placed on column 2, spanning every row of the band, with `margin-right: 60px` so its box is the same rectangle as the bar field. Lines are `pointer-events: none` and sit under the rows. Bars, ticks, and numbers paint above them.

Below 640px the rows stack to one column and `.goalScale` is `display: none`. A single column overlay cannot sit behind those stacked plots.

`c8dbc8d` replaced the sparse “nice” steps (roughly four marks) with every integer from 0 through `floor(scale) + 1`. Bar length still uses `fieldPct`, which clamps to the data maximum, so a bar that equals the maximum still ends at the right edge of the field. Grid lines use `markPct`, which does not clamp. The extra line, one past the maximum, sits one unit beyond that edge, in the gutter. On the data in front of the screen when this was specified, the maximum was 15 and the last line was 16. The code does not hardcode 16. A larger maximum draws through one past that maximum.

In percent mode the same rule runs on the percent scale, so a scale of 100 draws a line at every integer through 101.

## 3. The objective bands were tightened, then the hierarchy was put back — `c8dbc8d`, `a47609a`, `fe83b1b`

The first shared chart used a 72px plot and an 8px bar. Most of the row was empty, and the page dropped from the dense opening viewport into a thin chart.

`c8dbc8d` made the bar 16px in a 52px plot, cut the gap between rows from 6px to 2px, and cut the gap between asesor project groups from 12px to 8px. The grid ink went from `rgba(148, 163, 184, 0.18)` to `0.12`. “Objetivos por proyecto” received the existing card surface: `background: var(--color-card)`, a 1px border, 8px radius, and 8px padding. “Objetivos por asesor” already had that surface on `.panel`. The hairline between bands, and the 8px vertical margin on the project band, were left as the separation between bands.

`a47609a` raised both bands’ bars from 16px to 24px and the shared plot from 52px to 60px, so the thicker bar still starts where the tick ends. The actual number moved to `bottom: 6px` so it stays centered on that 24px bar. Asesor bars stopped using `color-mix` with white. They use the same solid project blue as the project bar: Benestare `#0d2041`, Boulevard 5 `#3d6f8f`, Bosque Las Tapias `#0573b0`, Santa Elena `#1a4a68`. An asesor with no project still falls back to the muted color. The project name that sat under each asesor name was removed. The opening vertical bars gained the Santa Elena color. They already colored the other three projects, and an asesor column there already took its project’s hue.

`fe83b1b` doubled only the “Objetivos por proyecto” bars, from 24px to 48px. That band’s plot grew from 60px to 84px, and its actual number moved to `bottom: 18px`, so the meta, the tick, and the number stay off the bar. “Objetivos por asesor” stays at 24px in a 60px plot.

The two titles use the same size, weight, and ink as the left-side card labels: `calc(26px * 0.75)`, weight 700, and `rgba(13, 32, 65, 0.75)`. That match was done in `a47609a` and still holds after the label opacity edits below.

## 4. The opening viewport was lightened — `107643e`, `d7d7c71`, `1869ae9`

This is `VentasTotalesBlock` only. The two sub-sections inside `.fold`.

`107643e`:

- Vertical bars in both sub-sections are `width: 60%`, centered in the column. The other 40% of each column is the extra gap between bars. Bar height, which is the value, is unchanged.
- The first sub-section went from `22dvh` to `18dvh`. Its floor went from `168px` to `calc(168px * 18 / 22)`, so the `dvh` value is not pinned by the old floor. The `max-width: 800px` rule still sets that band to `height: auto` and `min-height: 220px`.
- The totals card padding went from `8px` to `12px 14px`. Each project card went from `6px 8px` to `10px 12px`. The chart card beside them (`.hero`) went from `8px` to `14px`.
- Visible text in those left-side cards is 75% of the previous size: the label `calc(26px * 0.75)`, the opening number `calc(64px * 0.75)`, the word “reserva” / “reservas” `calc(26px * 0.75)`, and the per-project number `calc(52px * 0.75)`.

The label color then moved in two commits, on the same rule, which covers “Todos los Proyectos” and the four project names:

- `d7d7c71`: 90% to 80% (`rgba(13, 32, 65, 0.8)`).
- `1869ae9`: 80% to 75% (`rgba(13, 32, 65, 0.75)`).

The numbers on those cards stayed at full ink.

## 5. The design note

`docs/SDD-Department-Command-Centers.md` was not in `HEAD` before `c8dbc8d`. That commit added the whole living document, including two passages written in this chat.

Under Ventas band A, after the checklist table:

> Santa Elena sales are paused for strategic reasons. Its meta for the current period is zero. It has no asesores assigned. Do not display “Sin meta”, “Sin asesor”, “Asesor pending”, or any equivalent placeholder text.

After design principles 11 (Growth) and 12 (Project order), a section **Visual density continuity**. It requires, on every Command Center and every sub-section, that adjacent bands not drop abruptly in density: bar weight, tight row padding, a containing surface, a regular shared scale, and the same rules as the roster grows.

Still uncommitted, in the working tree only, immediately after that section: **Abstraction order and visual hierarchy**. Higher-level aggregates (project) come before lower-level aggregates (asesor), and the higher level carries more visual mass. The Objetivos bands are the example: project bars are thicker than asesor bars. The same principle is stated for every department Command Center and every sub-section.

## Files

| File | In these commits | Role |
|---|---|---|
| `src/app/(panel)/ventas/landing-blocks.tsx` | `fcf5851`, `333ddfa`, `c8dbc8d`, `a47609a` | Shared objective chart, U / % toggle, Santa Elena null meta as zero, integer grid, project name removed from asesor rows |
| `src/app/(panel)/ventas/landing-blocks.module.css` | all eight except the two SDD-only moments | Shared layout, continuous grid, density, opening viewport, project blues, project bars at 48px |
| `docs/SDD-Department-Command-Centers.md` | `c8dbc8d`, plus an uncommitted section | Santa Elena fact, visual density, abstraction order |
| `changelog/112_2026-11-11_ventas-reservas-meta.md` | `fcf5851` only | Prior chart. Not written in this chat |
