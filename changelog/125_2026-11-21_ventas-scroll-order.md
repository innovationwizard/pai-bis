# 125 — Ventas scrolls in Operativo order

**Date:** 2026-11-21
**Route:** `/ventas` command center.
**Scope:** The top-to-bottom order of the 14 Operativo items, and the documents that were still describing a second order. Chart geometry, counting rules, and filters were not changed. No write to Odoo.

This file is the record of that work. This chat did not run `git add` or `git commit`.

`npx tsc --noEmit` was not run. `npm test`, `npm run build`, `next lint`, `next build`, `next dev`, and `next start` were not run. No port was bound. No browser was opened. No request was sent to localhost.

## What was asked

Four requests, in this order.

1. Read `docs/Ventas-Command-Center-Diagnostic-2026-11-21.md` and say whether the corrections could start.
2. Lock the scroll order the stakeholder confirmed: the Operativo list, items 1 through 14, top to bottom. Update the documents so they no longer disagree.
3. Put that order on the Ventas page.
4. This file, the commands that stage only this work, and a commit message. Do not commit from this chat.

The confirmed sequence is:

1. Ventas totales
2. Objetivos de ventas
3. Status de ventas
4. Ventas por canales
5. Split de ventas por modelo
6. Inventario general
7. Valor de proyecto
8. Desistimientos
9. Tasa de conversión
10. Descuentos
11. Subidas de precios
12. F&F y casos especiales
13. Control Referidos
14. Promociones

## What was found before any edit

The command center in `src/app/(panel)/ventas/command-center.tsx` drew the bands in this order:

1. Ventas totales
2. Objetivos de ventas
3. Status de ventas
4. Ventas por canales
5. Tasa de conversión
6. Split de ventas por modelo
7. Inventario general
8. Valor de proyecto
9. Desistimientos
10. A two-column block: Descuentos, Subidas de precios, F&F y casos especiales, Promociones
11. Control Referidos

Tasa sat between Canales and the split. Promociones was the fourth cell of `.vc-grid-2`, on the same row as F&F, and Referidos came after the whole block. So a reader met Promociones before Referidos.

The SDD described two sequences at once. Section 4.1, “Band A — Primary graphics,” listed items 1, 2, 3, 6, and 9. Section 4.2, “Band B,” listed 4, 5, 7, 8, 10, 11, 12, 13, and 14. The Item 6 spec already said Inventario general sits after the split and before Valor de proyecto, which is the checklist neighborhood and not the Band A table. Principle 4 still said the top of a page is the most important graphics, which a later reader could use to put items 6 and 9 back at the top.

`VISTA_SECTIONS` in `src/lib/ventas/vista-types.ts` and the fetch list inside the command center had Tasa before Desistimientos and Promociones before Referidos. `VENTAS_SECTIONS` in `src/app/(panel)/ventas/sections.ts` had the same Tasa placement. That array feeds the old `/ventas/[section]` routes. It does not draw the command center. It still has no `control-referidos` entry. Adding one would publish a new URL, so this turn left that gap.

The Ventas operativo rail in `src/app/pabi/department-icons.ts` is an empty list. There was no rail to reorder. The SDD sentence that the rail follows the locked order is a specification. It is not a rail on screen.

`.gitignore` ignores `docs/`. `docs/SDD-Department-Command-Centers.md` is already tracked, so its edits show in `git status`. `docs/Checklists-Authoritative.md`, `docs/General-Rules-and-Principles.md`, and `docs/Ventas-Command-Center-Diagnostic-2026-11-21.md` are untracked and ignored. A plain `git add` will not pick them up.

The working tree was already dirty before this conversation. Two of the files this turn edited also contain hunks this turn did not write. See “Hunks that are not this turn.”

## What was decided

The stakeholder confirmed the numbered list as the page. Checklist numbers are the scroll order. Band A and Band B are not a second sequence. An item’s importance does not move it.

Item 3 stays por torre. The SDD had already recorded that correction. This turn did not reopen it.

Items 10 and 11 stay side by side, as they were. Item 12 takes the full width of the next row, so the cell Promociones left does not look like a missing chart. Items 13 and 14 are full-width bands after that block, Referidos then Promociones.

The charts were not redrawn. Tasa is still vertical columns. The SDD cell for item 9 still says “Horizontal bar funnel of the stages currently tracked for the users’ familiar flow.” Changelog 124 describes a vertical-column edit to that cell. The cell in the file today is the horizontal sentence. This turn did not reconcile that.

## The page

`command-center.tsx` now mounts the bands in the locked order. `TasaBand` moved from after `CanalesBlock` to after `DesistimientosBands`. `PromocionesBand` is a new export in `lower-bands.tsx`. It draws the same `AmountCard` the grid used to draw for Promociones: title “Promociones,” id `vt-promos-title`, navy, the `tipos` rows. `ControlesGrid` no longer takes `promos` or `promosPending`.

The control block is still `.vc-grid-2`. Its children are Descuentos, Subidas de precios, and F&F. F&F has the class `vc-grid-span`. `src/app/globals.css` adds:

```css
.vc-grid-2 > .vc-grid-span { grid-column: 1 / -1; }
```

On a wide page the block reads left to right, then down: Descuentos, Subidas, then F&F across the row. Below the hairline, Referidos, then Promociones. At the 960 px breakpoint `.vc-grid-2` is already one column, so the span does not change that stacking.

The fetch list `SECTIONS` in the command center, and `VISTA_SECTIONS`, follow the same sequence. Membership is unchanged. Nothing that renders the page iterates `VISTA_SECTIONS` for layout. The reorder keeps the canonical list from describing the old page.

`VENTAS_SECTIONS` moves Tasa to after Desistimientos, in line with items 8 and 9. Promociones stays last in that array because Referidos is not in it.

Counts, filters, the period line, the freshness stamp, and the project pills are the same functions and the same header. The NINGUNO pill is still absent.

## The documents

`docs/SDD-Department-Command-Centers.md`, the tracked copy:

- The title block records that the Ventas scroll order was locked on 21 November 2026.
- Principle 4 keeps the general hierarchy sentence and adds that, on Ventas, the principle does not move an item. Positions are §4.1.
- The shared layout still defines Band A, Band B, and Band C. A new paragraph says a locked scroll order is the stack, and that Ventas is items 1 through 14.
- Section 4.1 is no longer “Band A.” It is “Scroll order (locked 21 November 2026)” and one table of all 14 items. The visualization cells were copied from the old Band A and Band B tables. They were not rewritten.
- The Band B table was removed. The precise specs keep their numbers: §4.1.1, §4.1.2, §4.1.3, §4.2.1. Those numbers are not a page order.
- The Item 6 placement sentence now cites the lock: sixth, after the split and before Valor de proyecto.
- Acceptance criteria gain one unchecked line: the items appear in §4.1 order, and the left rail follows it.

`docs/Checklists-Authoritative.md` keeps the original row wording. A note under the Ventas table says this list is the page order, confirmed 21 November 2026.

`docs/General-Rules-and-Principles.md` gains “Ventas page order.” The same list, the same date, and the same rule that importance does not move an item.

`docs/Ventas-Command-Center-Diagnostic-2026-11-21.md` records the decision and that the command center was reordered the same day. The morning screenshot notes stay, labeled as the page before the reorder. The open question that asked the reader to choose Band A or the checklist is marked resolved.

Those three files are under the `docs/` ignore. They are on disk. They are not in `git status`.

## Hunks that are not this turn

`docs/SDD-Department-Command-Centers.md` also differs from `HEAD` in the Item 6 spec: the status list and its order, the note that color names are a mapping, the total as a sixth figure on the Compact Hero only, and the Expanded Hero and Project Band sentences that follow. Those sentences were already in the working copy when this conversation started. This turn’s Item 6 edit is the placement sentence that cites §4.1. Staging the whole file publishes the earlier Item 6 drift together with the scroll-order lock.

`src/app/globals.css` also changes `.mk-kpis p` padding from `10px 12px 8px` to `10px 12px 8px 22px`. This turn did not write that line. The only line this turn added is the `.vc-grid-span` rule.

The rest of the dirty tree is unrelated: cobros loaders and migrations, `scripts/creditos/load.py`, `src/lib/cobros/vista.ts`, `src/app/(panel)/mercadeo/operativo-view.tsx`, `scripts/ventas/__pycache__`, and `supabase/.temp/cli-latest`. Do not stage them with this work.

## What this conversation did not change

The drawing of any chart. Tasa’s columns, the split, Inventario general, canales, objetivos, and the lower amount cards keep their previous marks.

The data queries. `src/lib/ventas/vista-operativo.ts` was not edited. `embudoFunnel` was not edited.

The NINGUNO pill. `ProjectPillRow` still renders TODOS and the projects.

The left rail. `department-icons.ts` still has `ventas.operativo` as an empty array.

A route for Control Referidos. `VENTAS_SECTIONS` still omits `control-referidos`.

Item 3. It remains the lifetime pace by project and by torre.

Item 9’s SDD sentence. It still names a horizontal bar funnel.

## Files

| File | What changed |
|---|---|
| `src/app/(panel)/ventas/command-center.tsx` | Band order, and the fetch list `SECTIONS`. |
| `src/app/(panel)/ventas/lower-bands.tsx` | `PromocionesBand`. Promociones leaves `ControlesGrid`. F&F spans the grid. |
| `src/app/globals.css` | `.vc-grid-span`. The `.mk-kpis` padding hunk is not this turn. |
| `src/lib/ventas/vista-types.ts` | `VISTA_SECTIONS` order only. |
| `src/app/(panel)/ventas/sections.ts` | Tasa after Desistimientos in the legacy section list. |
| `docs/SDD-Department-Command-Centers.md` | Locked scroll order. The file also carries earlier uncommitted Item 6 spec edits. |
| `docs/Checklists-Authoritative.md` | Note that the Ventas list is the page order. Ignored by git. |
| `docs/General-Rules-and-Principles.md` | “Ventas page order.” Ignored by git. |
| `docs/Ventas-Command-Center-Diagnostic-2026-11-21.md` | Decision recorded. Ignored by git. |
| `changelog/125_2026-11-21_ventas-scroll-order.md` | This file. |

## The commit

This chat proposed, and did not run, a stage of the files whose diff is only this turn:

```bash
git add -- \
  changelog/125_2026-11-21_ventas-scroll-order.md \
  "src/app/(panel)/ventas/command-center.tsx" \
  "src/app/(panel)/ventas/lower-bands.tsx" \
  "src/app/(panel)/ventas/sections.ts" \
  src/lib/ventas/vista-types.ts
```

`src/app/globals.css` and `docs/SDD-Department-Command-Centers.md` need a hunk choice, because each file also contains edits from earlier work. Accept the `.vc-grid-span` hunk. In the SDD, accept the scroll-order hunks (title block, principle 4, the Band A/B override, §4.1, the Item 6 placement sentence, the acceptance line). Leave the Item 6 spec rewrite unless that earlier draft is meant to ship in the same commit.

```bash
git add -p -- src/app/globals.css docs/SDD-Department-Command-Centers.md
```

The three ignored documents stay out of the commit unless the ignore is overridden on purpose:

```bash
git add -f -- \
  docs/Checklists-Authoritative.md \
  docs/General-Rules-and-Principles.md \
  docs/Ventas-Command-Center-Diagnostic-2026-11-21.md
```

Do not run `git add .` or `git add -A`. The cobros, créditos, and mercadeo edits in this working tree are not this change.

Proposed message:

```
Put the Ventas command center in Operativo order, so the page reads as the checklist the CEO already uses and the old Band A sequence can no longer pull Tasa and Inventario out of place.

On 21 November 2026 that order was locked: Ventas totales, Objetivos, Status de ventas, Canales, the split by modelo, Inventario general, Valor de proyecto, Desistimientos, Tasa de conversión, Descuentos, Subidas de precios, F&F, Control Referidos, and Promociones. The SDD had been keeping a second sequence, with Inventario and Tasa among the primary graphics and the rest in a later band. The checklist is now the only page order. Importance does not move an item.

Tasa de conversión leaves the gap between Canales and the split and stands after Desistimientos. Promociones leaves the control grid and stands after Control Referidos. Descuentos and Subidas stay side by side. F&F takes the full width beneath them, so the cell Promociones vacated does not read as a missing chart. The marks, the counts, and the filters are the ones already on the page.
```
