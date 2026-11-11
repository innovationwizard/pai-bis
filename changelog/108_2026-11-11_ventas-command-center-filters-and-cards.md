# 108 — Ventas opening: project pills, card polish, and the canonical four

**Date:** 2026-11-11
**Route:** `/ventas`, and the Ventas section views that share the same project list
**Scope:** Display and the Proyecto filter on the client. No SQL, no loader, no change to how a vista is built on the server.

Five commits, in order:

| Commit | Subject |
|---|---|
| `baf261f` | Refine the Ventas Command Center opening bands for clarity and growth. |
| `154857a` | 2x Ventas totales card text |
| `54ea283` | Center reservas count. Singular word reserva when count is exactly one. |
| `01f6a63` | Exclude Casa Elisa from Ventas displays. |
| `dd5973f` | Shade of blue of left-side cards' label is #0d2041. |

`npx tsc --noEmit` passed after `baf261f` was written and before the four later commits. It was not run again after those four. `npm run build` was not run.

The two design notes in `docs/SDD-Department-Command-Centers.md` are on disk and are not in any of these commits. `.gitignore` ignores `docs/`, and that SDD is not a tracked file.

## What this does not change

Mercadeo, Cobros, Créditos, and Entregas are untouched.

The vista routes, `parseVistaFilters`, and the SQL behind a venta are untouched. The server already read every `proyecto` query parameter. The command center now sends more than one when more than one project is selected. `proyecto=ninguno` was already the empty selection.

The Asesores band under the project rows was not restyled. Advisor rows inside a project are still ordered by count, then by name.

The numbers on the left cards, the word “reserva” / “reservas”, and the bar charts were not recolored. Only the project name on the left card uses the logo navy.

## Canonical order

`src/lib/projects.ts` is the single list:

1. BOULEVARD 5
2. BENESTARE
3. BOSQUE LAS TAPIAS
4. SANTA ELENA

The comment on the constant says the order is by date of birth and that changing display order is a config change only. Matching ignores case, accents, and extra punctuation, so a dimension stored as “Boulevard 5” or “Bosque Las Tapias” joins the same slot. Anything that does not match one of the four sorts after them, by Spanish locale, when a list is sorted rather than filtered.

`projectPillOptions` returns only those four labels, in that order. A name with no dimension id yet is still shown, with an empty id. `isDisplayProject` is true only for those four. Casa Elisa, Cobán, and any later project are false until the constant is edited.

## Proyecto pills

The Proyecto `<select>` is gone from the command center toolbar. Periodo, Asesor, Torre, and Restablecer stay on that row. Above it, `src/components/project-pill-row.tsx` draws a row other departments can reuse: TODOS, then the four names from the constant.

TODOS is the default. It means every project (`proyectos: null`), and the request omits `proyecto`. Restablecer returns to that state. Each project pill toggles. Several can be on at once. Turning the last gap back on, so every known id is selected, collapses to TODOS again. Turning them all off sends `proyecto=ninguno`. A selected subset repeats `proyecto` once per id.

The last non-empty project list is kept while a refetch clears the vistas, so the pills do not flash empty on every filter change.

Pill type matches the value inside the remaining selects: 13px, weight 600, the page font. Height 32px, fully rounded. A pressed pill is `#0d2041` with white text, the same pressed treatment as the other toolbar toggles. A pill with no id yet is disabled and `#94a3b8`.

## Left cards

The first card’s first line is “Todos los Proyectos”. Each project card’s first line is the project name, in dimension spelling (“Boulevard 5”, not the uppercase constant). The second line is the count and the unit.

The count line is centered across the card. The name stays left.

The unit is “reserva” when the number drawn on the card is 1, and “reservas” otherwise, including 0. The same choice is used in that card’s accessible name. A value that rounds to the string `"1"` uses the singular. Bar labels and the Asesores sentences were not changed.

Type sizes, after the 2× pass:

| Text | Was | Is |
|---|---:|---:|
| Project name | 13px | 26px |
| Count on the totals card | 32px | 64px |
| Count on a project card | 26px | 52px |
| “reserva” / “reservas” | 13px | 26px |

The name is `#0d2041`. That is the wordmark color in `src/app/pabi/assets/logo-horizontal.png`: the opaque pixels of “PUERTA ABIERTA” are that hex, not a nearby theme gray. The previous name color was the theme text color `#0f172a`.

The delta, the thin comparison bar, the activity figures, and “Cantidad de actividades” are commented out on every left card, not deleted. The comment says they can be restored if requested. The prior-period data is still computed and still used in the card’s accessible name.

## The two opening bands

After the totals row (the “Todos los Proyectos” card and the project bars) there is a horizontal rule. It uses the same 1px `#e2e8f0` stroke as `.op-filter-rule`, with 16px of space above and below. Card and bar opacity were not changed.

The totals row is `22dvh`, with a floor of 168px. The rule and the project rows sit in a band whose height is `calc(100dvh - 308px)`, with a floor of 420px. The 308px is the room already taken by the page header, the page padding, the pill row, and the filter toolbar, so the two bands together end near the bottom of a laptop screen. Project rows share whatever height is left. Each row’s floor is 72px. If the list is taller than that remainder, the project band scrolls inside itself. Nothing in that layout divides by four.

Below 800px the fixed heights are dropped and the rows stack, using the same breakpoint the grid already used.

Project bars in that band, and the project charts lower on the command center, follow the canonical order. Charts that are not projects (canales, motivos, asesores, etapas) were not reordered.

## Casa Elisa, and every project outside the four

`01f6a63` stops Ventas from listing a project that is not in `PROJECT_DISPLAY_ORDER`. The reason recorded on that commit is that Casa Elisa is fully sold and no longer belongs in the Ventas filter or the Ventas charts. The dimension row is still loaded. Other departments are not filtered by this helper.

The command center headline count is still the vista total. It is not recomputed from the four cards. If a hidden project has unidades in the period, that headline can be larger than the sum of the four cards.

Hidden on the command center: the project inventory bars, the tower bars of a hidden project, the project pace bars, desistimientos por proyecto, valor por proyecto, subidas de precios por proyecto, the blocker table, the sales detail, and the stage-deal list.

Also filtered, on the section views:

| File | What is limited to the four |
|---|---|
| `landing-blocks.tsx` | The opening bars and the per-project rows. The old name check that dropped Casa Elisa and any label containing Cobán or Coban is gone; the constant replaces it. |
| `glance-view.tsx` | Project choices, project bars, sales lines, and the target editor’s project list. |
| `glance-stock.tsx` | Project bars on the stock vistas. |
| `glance-control.tsx` | Project bars and the trace rows that carry a project. |
| `board.tsx` | The Proyecto choices and the project rows. |
| `totales-view.tsx` | Blockers, project rows, and deal rows that carry a project. |

TODOS still does not send `proyecto`. The server can return Casa Elisa. These screens drop it after the response arrives.

## Design notes that are not in git

`docs/SDD-Department-Command-Centers.md`, section 2, gained two principles:

11. **Growth.** All design must support company growth without breaking. Example targets: 2× simultaneous projects, 10× sales reps.
12. **Project order.** Canonical project display order is BOULEVARD 5, BENESTARE, BOSQUE LAS TAPIAS, SANTA ELENA (by date of birth). It is defined in the shared constant `src/lib/projects.ts` so reordering is a config change.

`.gitignore` line 54 is `docs/`. This SDD is not tracked, so those two sentences are only in the working copy.
