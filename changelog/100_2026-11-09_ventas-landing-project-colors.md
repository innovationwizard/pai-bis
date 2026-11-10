# 100 — Ventas landing colors by project

**Date:** 2026-11-09
**Route:** `/ventas`

## Problem

The vertical bars on the Ventas landing took their color from rank. The largest project got `.hue0`, the next `.hue1`, and so on, cycling four theme tokens (`--color-primary`, `--color-primary-hover`, `--color-unit-reserved`, `--color-unit-sold`). Those tokens are the royal-blue family in `src/app/globals.css`, not the company colors. The Asesores bars and the current segment of the "N reservas" meter used `--color-primary` (`#2563eb`).

The three company colors already existed on the previous centro de mando fixture (`PROJECT_HUE` in `src/app/(panel)/ventas/_centro-de-mando/model.ts`). They were not on the landing.

## Decision

Color the landing by project. Declare the three colors once, as custom properties on `.block` in `landing-blocks.module.css`. Do not add them to `globals.css`. Do not add any other color.

| Project | Custom property | Hex |
|---|---|---|
| Benestare | `--project-benestare` | `#0d2041` |
| Boulevard 5 | `--project-boulevard-5` | `#3d6f8f` |
| Bosque Las Tapias | `--project-bosque-las-tapias` | `#0573b0` |

A project with no entry, including Santa Elena, uses the existing `--color-muted` token (`#64748b`). Casa Elisa and Torre Cobán stay off the bar chart; that filter was already there and did not change.

The rank classes `.hue0`–`.hue3` and the code that assigned them are gone. Bar order is still by reservas, then name. Only the color changed.

## The color key is the project name

`objetivos.byProject[].id` is `ventas.dim_project.id`, a UUID. That table has no slug (`scripts/migrations/078_ventas_schema.sql`). The CSS selectors match `benestare`, `boulevard-5`, and `bosque-las-tapias`.

The first pass wrote the UUID into `data-project`. No selector matched, so every bar kept `--color-muted`. The meter was already navy, because it references `--project-benestare` and never reads the id.

`hueKey` in `landing-blocks.tsx` folds the dimension name: strip accents, lowercase, turn runs of other characters into hyphens. `Benestare`, `Boulevard 5`, and `Bosque Las Tapias` become the three selectors. `Santa Elena` becomes `santa-elena` and stays muted. `project.id` remains the React key, the zoom id, and the prior-period lookup.

## Where each color is used

**Vertical bars.** Project bars, the advisor columns after choosing a project, and the advisor columns under each project card use the solid project color. `background` is `currentColor`.

**Asesores bars.** The horizontal bar uses the project color mixed with white, the same channel math as `mixWhite` in the centro de mando. The CSS is `color-mix(in srgb, <project>, white <percent>)`. Among advisors of one project, the one with the most reservas (name as the tiebreak) is 18% white. The others are 50% white. An advisor whose reservas are not all in one project has no project key, so the bar is `--color-muted` at 50% white.

| Project | Solid bar | Asesores, most reservas | Asesores, the others |
|---|---|---|---|
| Benestare | `#0d2041` | `#394863` | `#8690a0` |
| Boulevard 5 | `#3d6f8f` | `#6089a3` | `#9eb7c7` |
| Bosque Las Tapias | `#0573b0` | `#328cbe` | `#82b9d8` |
| Santa Elena | `#64748b` | `#808da0` | `#b2bac5` |

The mixed hex values are the sRGB result of that mix. The lead advisor is the first of that project in the Asesores list, which is already ordered by reservas, then name. That is the list on the page, not the old fixture's advisor-array order.

**"N reservas" meter.** The current segment (`.meterNow`) is `--project-benestare` (`#0d2041`) on the total card and on every project card. The track stays `--color-border`. The prior segment stays `--color-muted`.

## Left unchanged

- The current breadcrumb and a pressed advisor's name still use `--color-primary`.
- `src/app/globals.css` `.vt-fill` (the older ventas bars) still paints every bar `#0d2041`.
- `_centro-de-mando/model.ts` still falls back to `#0d2041` when a fixture id is missing from `PROJECT_HUE`. `panels.tsx` still paints the project name with the mixed fill.
- Header, navigation, labels, layout, and data did not change.

## Files

| File | Change |
|---|---|
| `src/app/(panel)/ventas/landing-blocks.module.css` | Three project custom properties on `.block`. Vertical bars and Asesores bars read them. Meter current segment is `--project-benestare`. Rank hue classes removed. |
| `src/app/(panel)/ventas/landing-blocks.tsx` | `hueKey` from the project name. Bars and Asesores fills use that key. Rank hue assignment removed. |

## Checks

`npx tsc --noEmit` and `npm run build` passed on the first color pass, before the UUID bug was visible. The `hueKey` correction was confirmed on `/ventas`: Benestare navy, Bosque Las Tapias blue, Boulevard 5 blue-gray, including each project's advisor columns.
