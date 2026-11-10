# 102 — Remove stale department-navigation documents

**Date:** 2026-11-10
**Scope:** Documentation only. No application code, no SQL, no loaders.

The three living documents already in `docs/` are the design for every future change to the five departments:

- `docs/SDD-Department-Command-Centers.md`
- `docs/General-Rules-and-Principles.md`
- `docs/Checklists-Authoritative.md`

They were not opened for editing. Each department is one vertically scrollable page. Operativo checklist items are charts on that page. A left rail may scroll to a band. It does not open another URL.

Older notes were still telling agents to build separate paths under `/ventas`, `/mercadeo`, `/cobros`, `/creditos`, and `/entregas`, or to follow gap analyses and plans from March–May 2026. Those notes were deleted. Operational procedures and the Ventas store document were kept and, where they still described thirteen pages, rewritten.

`docs/` is listed in `.gitignore` (line 54). Deletions and edits under `docs/` are on disk and do not appear in `git status`. Git sees three paths from this pass: `CLAUDE.md` and `.cursorrules` modified, `ANATOMOS_SCAFFOLDING.md` deleted. The root markdown files and `wr420/` were untracked, so removing them also leaves no git deletion.

No local test, `next dev`, port bind, or browser pass was run.

The app still has section routes. They were not changed:

- `src/app/(panel)/ventas/[section]/page.tsx`
- `src/app/(panel)/mercadeo/[section]/page.tsx`
- `src/app/(panel)/cobros/[section]/page.tsx`
- `src/app/(panel)/creditos/[section]/page.tsx`
- `src/app/(panel)/entregas/[section]/page.tsx`

`docs/pai-bis.md` now says those routes are not the design and are not to be extended.

Older changelog entries were left as the record of the day they were written. Changelog 101 still names `Ventas-y-Mercadeo-paginas.md` and `Sitio-nuevo-estructura.md`. Both files are gone.

## Why

Section 10 of the command-center SDD says historical multi-page, secondary-menu, and outdated design documents are to be removed or rewritten so they no longer contradict the command-center model. `docs/ventas-secondary-menu.md` (2026-10-02) said each of the thirteen Ventas items should have its own path under `/ventas`. `docs/sdd-ventas.md` (last updated 2026-10-09) was the software design for those thirteen pages. `docs/REDESIGN_BRIEF.md` allowed at most three tabs per department and treated one click as a tab. `wr420/SDD-Ventas-Totales-1035.md` (6 November 2026) allowed 0–1 clicks, “a small number of focused views,” and a locked dual-gate definition of venta neta. The 10 November SDD requires 0 clicks, one page, and does not show or force the dual-gate definition.

## Deleted — navigation and superseded design

These files recommended separate department URLs, a secondary menu, tabs, or a draft command center that disagrees with the 10 November SDD.

| File | What it was |
|---|---|
| `docs/ventas-secondary-menu.md` | Sticky row under the primary bar. Each of 13 Ventas items gets its own path under `/ventas`. |
| `docs/sdd-ventas.md` | Living SDD for thirteen Ventas pages: measures, filters, empty states, and the two-gate sale rule as the headline. |
| `docs/ui-ux-ventas-mercadeo.md` | Screen notes for the thirteen pages. Cited `docs/ventas-secondary-menu.md` as the navigation rule. |
| `docs/handoff-ventas-build.md` | Build handoff. Told the reader to follow `docs/sdd-ventas.md` and not reopen those page decisions. |
| `docs/handoff-mercadeo-build.md` | Build handoff. Page list and schema were to come from reference images. Told the reader not to invent pages. |
| `docs/REDESIGN_BRIEF.md` | Redesign contract. At most three tabs per department. Checklist items visible on the landing or one click away (a tab or a drawer). |
| `docs/redesign/TRIAGE.md` | Functional triage of 7–8 November. Inventory of `/ventas/[section]` and the other department section routes as the app to repair. |
| `docs/redesign/TRIAGE_v1.md` | The 7 November triage, marked superseded by `TRIAGE.md`. |
| `docs/redesign/reference/BI-Dashboard-Visual-Architecture.md` | Single-page essay that also locks dual-gate venta neta, uses a slide-over drawer, and puts KPI cards in band 1. |
| `docs/redesign/reference/Dashboard-Lists-Of-Required-Items.md` | Earlier checklist. Superseded by `docs/Checklists-Authoritative.md`. |
| `ANATOMOS_SCAFFOLDING.md` | Scaffold for a different product: document assembly across the unit lifecycle (DCI, FHA forms, escrituración). No code in this repo referenced it. It was a tracked file. |
| `Ideal-End-State-Ventas-Totales-Landing-Page.md` | Design for a Ventas Totales page with one locked venta neta definition. Untracked. |
| `Proposed-Solution-for-badly-designed-Ventas-Ventas-Totales-page.md` | Funnel and KPI-card proposal for the Ventas Totales page, including a dual-gate reconciliation. Untracked. |
| `Sitio-nuevo-estructura.md` | Site map read on 4 November. `/ventas` is the command center, and the section URLs, including `/ventas/ventas-totales`, stay on `GlanceView`. Untracked. |
| `Ventas-y-Mercadeo-paginas.md` | Catalog of the separate Ventas and Mercadeo URLs and what each one answers. Untracked. |
| `wr420/SDD-Ventas-Totales-1035.md` | 6 November draft titled “Department Command Centers (Next Version).” 0–1 click rule and locked dual-gate. |
| `wr420/BI-Dashboard-Visual-Architecture.md` | Same architecture essay as the copy under `docs/redesign/reference/`. |
| `wr420/Dashboard-Lists-Of-Required-Items.md` | Same earlier checklist as the copy under `docs/redesign/reference/`. |
| `wr420/PAI-BIS-Redesign.md` | Project instructions that say the Directivo and Operativo lists are not authoritative requirements. `docs/Checklists-Authoritative.md` says the opposite. |

After the four `wr420/` markdown files were removed, the directory held only `.DS_Store`. That file was removed and `wr420/` was removed.

## Deleted — historical gaps, audits, plans, and status reports

These predate the command-center model. They are March–May 2026 gap analyses, audits, reconciliation logs, completed implementation plans, investigations, and status reports. Keeping them would send an agent at an old route, an old security phase, or an old cotizador plan.

Gap and role status:

- `docs/gap-comprehensive-status-2026-03-21.md`
- `docs/gap-master-status-2026-03-20.md`
- `docs/gap-prioritization-2026-03-19.md`
- `docs/gap-status-report-2026-03-20.md`
- `docs/gap_master_status.html`
- `docs/roles-gap-analysis.md`
- `docs/roles-current-state.md` (role inventory dated 2026-03-19, updated through 2026-03-24)
- `docs/roles-industry-best-practices.md`
- `docs/remaining-features.md` (cross-check against the reserve-observer SDD as of 2026-03-13)
- `docs/funcionalidades-pendientes-2026-04-20.md`

Audits, diagnostics, and investigations:

- `docs/audit-unit-status-transitions-2026-05-22.md`
- `docs/commission-audit-2026-04.md`
- `docs/commission-audit-plan.md` (2026-03-16)
- `docs/otto-herrera-commission-audit-2026-04-20.md`
- `docs/creditos-33-units-investigation.md`
- `docs/categorias-c-d-blt-torre-b.md` (marked superseded on 2026-03-20; the two PDFs of the same name were kept)
- `docs/diag-blt-torre-b-all-vendido-2026-04-21.md`
- `docs/orphaned-sales-investigation.md` (resolved 2026-03-18)
- `docs/sales-rep-commission-rates-investigation.md`
- `docs/cotizador-diff-report-2026-03-26.md`
- `docs/sync-diff-proposal-2026-03-25.md`
- `docs/transcript-feature-extraction-2026-03-26.md`
- `docs/transcript-feature-extraction-2026-04-14.md`

Plans, including plans whose status line said completed:

- `docs/plan-auth-deep-investigation.md`
- `docs/plan-cesion-derechos.md`
- `docs/plan-cotizador-image-compact-2026-05-19.md`
- `docs/plan-creditos-dashboard.md` (multi-tab `/creditos`)
- `docs/plan-custom-enganche-cuotas.md`
- `docs/plan-fix-blt-torre-b-vendido-2026-04-21.md`
- `docs/plan-fix-cotizador-2026-03-26.md`
- `docs/plan-fix-critical-gaps.md`
- `docs/plan-fix-high-severity-gaps.md`
- `docs/plan-frozen-units-visibility-authorization.md`
- `docs/plan-lead-sources-marketing-role.md`
- `docs/plan-onedrive-sync-2026-03-27.md`
- `docs/plan-onedrive-sync-2026-03-27 copy.md`
- `docs/plan-phase2-permission-architecture.md`
- `docs/plan-phase3-audit-phase5-dashboard.md`
- `docs/plan-phase4-field-masking.md`
- `docs/plan-sync-reservations-2026-03-25.md`
- `docs/plan-user-account-menu.md`
- `docs/plan-zero-diff-cotizador-2026-03-26.md`
- `docs/Plan_Sobreprecio.md`
- `docs/bulletproof-auth-plan.md`
- `docs/diff-08-isr-plan.md`
- `docs/diff-09-phase-proration-plan.md`
- `docs/ejecutivo-rate-solution.md` (2026-03-16). The running rule is `docs/commissions-calculation.md`.
- `docs/_pre_Devoluciones_Negative_Payments.md`. The schema change is `scripts/migrations/013_payments_allow_reimbursement_negative.sql`.

Reconciliation write-ups from the March–May close. The monthly procedure stays in the SOPs:

- `docs/reconciliation-blocking-log-2026-05.md`
- `docs/reconciliation-ce-2026-05.md`
- `docs/reconciliation-phase2-plan.md`

## Edited

### `docs/pai-bis.md`

Was the product definition dated 2026-10-09. It said the thirteen Ventas pages are what `gerencia`, `master`, and `torredecontrol` open, that `/ventas` is an icon bar, that a sale is both gates as a company-wide rule, and that `docs/handoff-mercadeo-build.md` records the Mercadeo rulings.

It is now product and data boundaries, reviewed 2026-11-10. The three living documents win if this file disagrees. The Ventas store remains `docs/db-ventas.md`. The Odoo 19 direction, Milestone 2, header-name spreadsheet parsing, Santa Elena in dollars, and the 7.80 Mercadeo FX rate are still here. The first Ventas load is still the 8 October 2026 extracts, and later loads are pointed at `changelog/`.

On-screen metrics follow the SDD. The dual-gate clocks may exist in the store. They are not shown and they are not forced. Mercadeo, Ventas, Cobros, Créditos, and Entregas are each one scrollable page. Existing `/[section]` routes under those areas are not the design and are not to be extended. Tools under `/old/` stay where they are.

### `docs/db-ventas.md`

Still the schema, keys, and load rules for schema `ventas`. The opening no longer calls it the store for thirteen sections, and it no longer cites `docs/sdd-ventas.md`. Checklist items are bands on the single Ventas page. Readers remain `gerencia`, `master`, and `torredecontrol`.

Vendido in the store is still derived from the two clocks. The command center does not present that derivation as the definition of a sale. Workbook statuses PCV, Promesa, and Vendido en archivo stay distinct. “The three stock pages” is now “the inventory bands.” “Status de ventas page” is now “Status de ventas band.”

The Recibo source paths lived only in the deleted `docs/sdd-ventas.md` (“Where the Recibo reading is”). They were copied into the Load section so the store document still names them:

- `/Users/orion-tech/go/singularity/_ Agents_Extract_Odoo15/output/raw/account.move.jsonl` — journal entry. `state` lives here. `posted` is Publicado.
- `/Users/orion-tech/go/singularity/_ Agents_Extract_Odoo15/output/raw/account.payment.jsonl` — payment. No `state`. `move_id` points at the journal entry.
- `/Users/orion-tech/go/singularity/orion_pa+p_extraccion_odoo15/output/messages/account.move.jsonl`
- `/Users/orion-tech/go/singularity/orion_pa+p_extraccion_odoo15/output/messages/account.payment.jsonl`
- `/Users/orion-tech/go/singularity/orion_pa+p_extraccion_odoo15/output/messages_index.csv`

Grain, filters, workbook headers, and the load scripts (`scripts/ventas/load.py`, `scripts/ventas/load_static.py`) were not rewritten. Some sentences in the body still say “the page” for an empty-state sentence. They describe copy, not a URL.

### `docs/redesign/DATA_CONTRACT.md`

Kept as the 6 November 2026 read of what the database held. A paragraph at the top says screen structure is the command-center SDD and that this file does not authorize tabs, section URLs, or a second definition of a sale.

Section “A. Brief section 6, checked live” is now “A. Checked live on 2026-11-06.” The rows of that check were not changed.

Section “D. Tabs and landings” specified three tabs per department (`resultados` / `inventario` / `control` for Ventas, and the matching sets for Mercadeo, Cobros, Créditos, and Entregas), with state in the URL. That section is now “D. Landings” and says the three-tab layout is withdrawn.

Section E still lists the open data questions from that day. The introduction says they do not choose the on-screen definition of a sale. Items 1 and 2 no longer default the headline to `v_sale` or put `confirmado_gtq` in a drawer. `v_sale.value_gtq` and `confirmado_gtq` stay named as columns in the store. `public.sales` and `public.reservations` stay in the file for the 222-vs-232 comparison. Item 8 says the client name belongs on the advisor detail on the same page.

Five table cells that said “drawer” now say the detail is on the same page: status by advisor, price history, cesión, trazabilidad, and cobros alertas. `tipo_pago` and `banco` for the 97 Boulevard 5 entregas are attributed to the Entregas command center.

### `docs/redesign/METRIC_ANCHOR.md`

Kept as the 6 November count comparison (which series matched the numbers managers read, including Paula Hernandez at Bosque Las Tapias). Two sentences at the top say it is not a screen design and that a second definition of a sale is not to be put on screen from this comparison. The counts were not edited.

### SOP and manifest cross-references

`docs/reconciliation-phase2-plan.md` was the “related file” for Phase 2 in three places. The procedure itself is `docs/SOP-monthly-cobros-reconciliation.md`. The plan row was removed from:

- `docs/SOP-monthly-cobros-reconciliation.md` (Key Reference Files)
- `docs/manifest-CIERRE_COBROS_ABRIL.md` (section 10)

In `docs/SOP-monthly-commission-etl.md` the same row now points at `docs/SOP-monthly-cobros-reconciliation.md`. `scripts/reconcile_phase2_payments.py` is still listed there.

### `docs/METADATA_SPEC.md`

`NEXTJS_VERSION` was `15.x`. `package.json` has `next` `^16.3.3`. The line is now `16.x`. The image rules were not changed.

### `CLAUDE.md`

Stack visualization is Recharts 3 and D3.js 7. CSS is `src/app/globals.css` with Tailwind 4 (`@import "tailwindcss"`). The previous line said components do not use Tailwind utility classes. `globals.css` does import Tailwind, and `package.json` has `tailwindcss` `^4.2.0` and `@tailwindcss/postcss` `^4.2.1`.

A “Department command centers” section was added under Project Context. It names the three living documents and the one-page rule.

Architecture now lists `src/app/(panel)/{mercadeo,ventas,cobros,creditos,entregas}/page.tsx` as one command center per department. `src/app/dashboard-client.tsx` is labeled the older analytics dashboard client. `origin/SSOT/` is historical discovery, and the department checklist SSOT is `docs/Checklists-Authoritative.md`. The `docs/` bullet says living design documents and operational procedures.

Rule 26 still records the pre-existing `next build` failure in `src/app/api/creditos/expedientes/[id]/checklist/route.ts` (it exports `documentKeyFrom`). The sentence now says Next.js forbids that export. It previously said Next 15.

The reservation-system table map, the Pati mission, and the shell rules were not rewritten.

### `.cursorrules`

The stack line adds Recharts 3, D3.js 7, and Tailwind 4. A “Department command centers” section names the three living documents and the one-page rule. The reservation-system section was not rewritten.

## Kept

Living documents, untouched:

- `docs/SDD-Department-Command-Centers.md`
- `docs/General-Rules-and-Principles.md`
- `docs/Checklists-Authoritative.md`

Procedures and close files:

- `docs/SOP-monthly-cobros-reconciliation.md`
- `docs/SOP-monthly-commission-etl.md`
- `docs/SOP-run-migration.md`
- `docs/manifest-CIERRE_COBROS_ABRIL.md`
- `docs/manifest-CIERRE_MARZO_RESERVAS.md`
- `docs/manifest-CIERRE_RESERVAS_ABRIL.md`

Rules and calculations that are still how the system runs:

- `docs/commissions-calculation.md` (engine as of migration `037_phase_proration.sql` and the later migrations that call it)
- `docs/business-case-types.md`
- `docs/access-control-matrix.md` (generated 2026-09-30 from `src/lib/permissions.ts`)
- `docs/cotizador-pricing-guide.md`
- `docs/guia-confirmacion-tasas-cfo.md`
- `docs/guia-enganche-personalizado.md`
- `docs/azure-app-registration-guide.md`
- `docs/pipedrive-creditos-data-spec.md`
- `docs/METADATA_SPEC.md`
- `docs/_THE_RULES.MD`
- `docs/_ INTENT OF THE RULES.TXT`
- `docs/_ THESE ARE THE RULES.TXT`

Open security note, not a March–May plan. `docs/tech-debt.md` has two items. TD-001 (2026-05-22) still says `scripts/migrations/` has 67 files and that only part of `supabase/migrations/` is registered. That count is the May snapshot. TD-002 (2026-08-24) says RLS is not on the request path because routes use `createAdminClient()`. The write-up is `docs/plan-rls-enforcement-user-scoped-client.md`. Both files were kept because TD-002 is still an open defense-in-depth item and does not describe department navigation.

Company and data context that does not specify department URLs:

- `docs/contexto-puerta-abierta.md`
- `docs/puerta-abierta-what-they-sell.md`
- `docs/consolidated-data-inventory.md`
- `docs/odoo-v19-data-big-picture.md`
- `docs/odoo-hud-data-inventory-request.md`
- `docs/entregas-editar-nombre-titular-2026-09-28.md` (findings on where the titular name is stored; no code was written with it)
- `docs/_____VentasEnPersona_limpia.txt`
- `docs/git-commit-cotizador-logos.txt`

Data files and reference images:

- The four `docs/*_Precios_y_Disponibilidad.xlsx` workbooks
- `docs/Used Workbooks/`
- `docs/projectslogos/`
- `docs/categorias-c-d-blt-torre-b.pdf`
- `docs/categorias-c-d-unidades-blt-torre-b.pdf`
- `docs/redesign/reference/Feedback.txt` and the screenshots in that folder (`before-redesign.png`, `after-redesign.png`, the 6 November screenshots, `ssot-1-general.png`, `ssot-2-proyectos.png`)

`changelog/`, `origin/`, and `origin/SSOT/` were not edited. `origin/SSOT/` remains the historical discovery set. It is not the department checklist.

## What this pass did not do

- Did not change a route, a component, a loader, or a migration.
- Did not remove the existing `[section]` pages. The documents now say not to extend them.
- Did not rewrite `docs/tech-debt.md` TD-001 to the current migration count.
- Did not run `npx tsc`, `next build`, `next dev`, or a browser check.
