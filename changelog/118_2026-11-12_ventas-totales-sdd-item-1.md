# 118 — Ventas totales in the command-center SDD is reservas and project bars

**Date:** 2026-11-12
**Document:** `docs/SDD-Department-Command-Centers.md`, section 4.1 Band A — Primary graphics.
**Scope:** One cell in that table. No application code, no stylesheet, no SQL, no loader, no vista, no API, no database read or write.

This file is the record of that edit. It was written after the SDD change and after a staging command and a commit message were proposed. Neither command was run. This file is not staged.

## What was asked

Three requests, in this order.

1. Update the software design document for Ventas checklist item 1, Ventas totales. The form already on the page is the one to keep. Value, and the cumulative pace chart, do not belong in item 1. In section 4.1, change only the visualization description for item 1. Leave every other item and every other section as they were, including the wording around the changed cell. Do not run local tests, do not start a development server, and do not open a browser.

2. Give the shell command that stages the change from that edit, and propose a commit message in the same prose style as recent commits. Do not commit.

3. Write this changelog.

## What changed

Section 4 is “Ventas Command Center”. Subsection 4.1 is the table “Band A — Primary graphics (0 clicks)”. The header row and the column headings are unchanged. The Ventas totales row was:

| # | Checklist item | Visualization |
|---|----------------|---------------|
| 1 | Ventas totales | Hero pair (units + value) + cumulative pace chart (solid = current period, dashed = prior) |

It is now:

| # | Checklist item | Visualization |
|---|----------------|---------------|
| 1 | Ventas totales | Hero units (reservas) + project bars |

`git diff` for that file is one deletion and one insertion, both on the visualization cell of row 1. The checklist name stays “Ventas totales”. The row number stays 1.

The old cell described three things: a units hero, a value hero, and a cumulative pace chart with a solid line for the current period and a dashed line for the prior period. The new cell describes two things: a hero of reserva units, and bars by project. Value is not part of item 1. The pace chart is not part of item 1.

## What this does not change

The rest of section 4.1 is the same text:

| # | Checklist item | Visualization |
|---|----------------|---------------|
| 2 | Ventas versus objetivos de proyectos - totales y por asesor | Compact bullet charts or overlapping bars, one set per proyecto + ranked asesor view |
| 3 | Status de ventas - Déficit o excedente versus fecha de cierre, por proyecto y por asesor | Pace or bullet against expected trajectory, color-coded for deficit/surplus, by proyecto and by asesor |
| 6 | Inventario general: Vendido, congelado, disponible | Stacked horizontal bars by proyecto/torre |
| 9 | Tasa de conversión | Horizontal bar funnel of the stages currently tracked for the users’ familiar flow |

The Santa Elena paragraph under that table is unchanged. Its meta for the current period is still zero, it still has no asesores assigned, and the document still forbids “Sin meta”, “Sin asesor”, “Asesor pending”, and any equivalent placeholder.

Section 4.2 Band B is unchanged, including item 4 Ventas por canales, item 5 Análisis de inventario, item 7 Valor de proyecto, item 8 Desistimientos, and items 10 through 14. Section 4.3, the deferred dual-gate note, is unchanged. Sections 1 through 3 and 5 through 10 are unchanged. The document date on the title block is still 10 November 2026.

No page, component, stylesheet, route, or query was opened for editing. The Ventas command center was not redrawn. Item 3 in the same table still names a pace or bullet against the expected trajectory. That sentence was left in place because the request was to remove the pace chart from item 1, not to rewrite item 3.

Mercadeo, Cobros, Créditos, and Entregas are untouched. Files that were already dirty before this conversation stayed dirty and were not part of the edit: `scripts/creditos/load.py`, `src/app/(panel)/mercadeo/operativo-view.tsx`, and the untracked files present at the start of the conversation.

## Staging and the proposed message

The file is tracked. After the edit, `git status --short -- docs/SDD-Department-Command-Centers.md` reported `M docs/SDD-Department-Command-Centers.md`.

The command proposed for staging that file alone was:

```bash
git add docs/SDD-Department-Command-Centers.md
```

It was not run. Nothing from this conversation is in the index because of that proposal.

The message proposed, and not used, was:

```
Align Ventas totales with the page, so item 1 is the hero reservas count and project bars.
```

Recent subjects on this branch are one sentence that says what the change is for. That sentence follows that pattern. It was not committed.

This changelog did not exist when that command was proposed. Staging the SDD with the command above does not stage this file.

## What was not run

`npx tsc --noEmit` was not run. `npm test`, `next lint`, `next build`, `next dev`, and `next start` were not run. No port was bound. No browser was opened. No request was sent to localhost. The database was not queried or written.

The check that was done was a read of section 4.1 after the replacement, lines 93–104, confirming the new cell and the four rows under it.
