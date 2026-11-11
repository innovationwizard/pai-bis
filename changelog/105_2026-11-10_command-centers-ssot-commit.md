# 105 — Commit 91f7c6a: command centers as the only department pages

**Date:** 2026-11-10
**Commit:** `91f7c6ab131e68e3049630a579ea2d38a3e66b68`
**Message:** Establish the Department Command Centers as the Single Source Of Truth.
**Size:** 130 files. 4 added, 20 modified, 106 deleted. 1,043 insertions, 33,324 deletions.

This is the commit that landed the 10 November command-center work. Three earlier notes split the same day and stay the long inventories:

- Changelog 102 — documentation deleted or rewritten so it no longer tells an agent to build thirteen Ventas URLs.
- Changelog 103 — deletion of `src/app/old/` and the unused Ventas prototype, and every in-app link that still pointed there. That file is on disk and was not part of this commit.
- Changelog 104 — the edit to `src/app/(panel)/ventas/command-center.tsx` only.

This entry is the commit itself: what Git recorded, in the order a reader needs it. It does not repeat 102’s paragraph on every historical plan. It does name every path the commit deleted or changed.

No SQL and no loader source were in the commit. `scripts/ventas/__pycache__/load.cpython-314.pyc` changed as a binary (49,982 bytes to 57,106). That is a compiled cache, not a migration. `supabase/.temp/cli-latest` went from empty to the single line `v3.0.0`. That is a CLI temp file, not application behavior.

`npx tsc --noEmit` had passed on the Ventas page (changelog 104) and again after the `/old` deletion once the stale `.next` validators were removed (changelog 103). `npm run build` was not run for either pass. No dev server was started and no browser was opened.

## What a person gets

Mercadeo, Ventas, Cobros, Créditos, and Entregas each remain one page under `src/app/(panel)/`. This commit did not edit `cobros-view.tsx`, the Créditos board, the Entregas board, `operativo-view.tsx`, or any `[section]/page.tsx`. Those section routes still exist and still compile. Agent guidance now says not to add more of them.

`/ventas` is the command center. The fourteen Operativo items are on that scroll. The tab strip is gone. Login, the home page, the proxy, and both navbars send Ventas, Créditos, and Entregas to `/ventas`, `/creditos`, and `/entregas`. A bookmark under `/old/...` is not rewritten. For a confined role it falls through to that role’s home. For an unrestricted role it 404s.

## 1. Ventas command center

**File:** `src/app/(panel)/ventas/command-center.tsx`
**Diff in this commit:** 557 lines touched on that path (the working tree before the commit was +378 / −179 against the previous blob).

`page.tsx` still renders `CommandCenter`. Filters are still Periodo, Proyecto, Asesor, Torre, and Restablecer. The period description and the freshness stamp still share `.op-range`. The stamp is still `stampDate` of `totales.freshness.label`, time stripped, with `data-stale` when the vista says the data is stale.

The header now ends with `<hr className="op-filter-rule" />`, after the freshness warning when `totales.freshness.note` is set. The class was already in `src/app/globals.css`. The command center did not use it. `.vc-tabs` is still in that stylesheet and is now unused. The stylesheet was not edited.

Scroll, top to bottom:

1. Ventas totales. `VentasTotalesBlock` in `landing-blocks.tsx`. That file was not in the commit.
2. Asesores against meta. `AsesoresBlock`. Not in the commit.
3. Status contra la fecha de cierre. Pace chart. The subtitle is still «Reservas».
4. Tasa de conversión, then inventario general por proyecto and por torre.
5. Brecha contra el ritmo por proyecto, and por asesor.
6. Ventas por canales beside ventas por modelo.
7. Valor de proyecto, then trayectoria de precios and impacto del descuento.
8. Desistimientos por motivo, and por proyecto.
9. Descuentos, subidas de precios, F&F y casos especiales, promociones.
10. Control Referidos.
11. The detail that was already last: «Tratos que todavía no son venta» and «Detalle de ventas». A bar click still filters that block. The focus chip, the scroll to `#vc-detalle`, and the notes for canal, etapa, and torre are unchanged.

### Checklist

| # | Item | Where |
|---|---|---|
| 1 | Ventas totales | Existing hero and project bars. |
| 2 | Ventas versus objetivos | Existing Asesores block and the project bars. |
| 3 | Status contra la fecha de cierre | Pace chart and the two brecha charts. |
| 4 | Ventas por canales | Ranked horizontal bars by fuente. |
| 5 | Split de ventas por modelo | Horizontal bars of units sold. |
| 6 | Inventario general | Existing stacked bars by proyecto and by torre. |
| 7 | Valor de proyecto | Composed chart, project bars, separate price lines, discount against the sales that carry it. |
| 8 | Desistimientos | Bars by motivo and by proyecto. |
| 9 | Tasa de conversión | Existing funnel. |
| 10 | Control de descuentos | Bars by tipo. |
| 11 | Control de subidas de precios | Bars by proyecto. Quetzales and dollars are separate charts. |
| 12 | F&F y casos especiales | Bars by tipo. |
| 13 | Control Referidos | Its own section. The three trail fields are not in the vista. See below. |
| 14 | Control de promociones | Bars by tipo. |

Colors on the new charts are the ones already used: navy `#0d2041`, blue `#0573b0`, red `#b91c1c`, amber `#b45309`.

### How the vistas load

Two effects used to call `GET /api/ventas/vista`.

The first ran on every filter change and requested only `ventas-totales`, `objetivos-de-ventas`, `status-de-ventas`, and `inventario-general`.

The second ran only after a tab press. Modelo loaded `analisis-de-inventario`. Canales loaded `ventas-por-canales`. Desistimientos loaded `desistimientos`. The last tab loaded `descuentos`, `subidas-de-precios`, `ff-y-casos-especiales`, and `promociones`. Closing the tab aborted that request. `valor-del-proyecto` was a real section of the same API and was never requested.

One effect remains, still keyed on the filter bar. `SECTIONS` is the old priority list plus the eight sections above, including `valor-del-proyecto`. Each section is still its own query: `section=` plus periodo, desde, hasta, proyecto, asesor, and torre. `readVista` is unchanged. One `AbortController` cancels all of them when the filters change or the component unmounts. A successful response now clears that section’s previous error. The old priority effect left a stale error in place.

The Proyecto, Asesor, and Torre dropdowns still build their options from totales, objetivos, status, and inventario. The new vistas are not merged into those lists.

`src/app/api/ventas/vista/route.ts`, `src/lib/ventas/vista.ts`, `src/lib/ventas/vista-operativo.ts`, and `src/lib/ventas/vista-types.ts` were not in the commit.

Removed with the tabs: `panel` state, `togglePanel`, the `Panel` type, `PANEL_SECTIONS`, and the heading «Detalle por modelo, canal y controles».

### Numbers on the graphics

`labelCount`, `labelMoney`, `labelDollars`, and `labelSigned` format a chart value with the same `count`, `money`, `dollars`, and `signed` helpers the page already used. A null value prints nothing. `labelStack` also prints nothing for zero, so an empty segment of a stack does not draw a 0 on the boundary.

Pace (`RhythmChart`). Height 280. Top margin 18, bottom margin 16. Both series draw a dot of radius 2. Real is labeled above the point. Ritmo is labeled below it. A future day stays null on Real and has no label. The tooltip is unchanged.

Funnel. The right-hand mark was already the count, plus the conversion percent when the stage has one. It stayed. The line under the chart that listed each stage’s `source` and `grain` is a JSX comment.

Brecha (`GapBars`). Right margin went from 12 to 48. Each bar is labeled with the signed gap. Rows with `gapUnits == null` stay off the chart, and «N sin meta, fuera de la barra» is still there. The asesor chart is still capped at 12 (`CHART_CAP`). Red is still a deficit, blue a surplus, navy a zero gap. A click still focuses the detail table.

Inventario (`StackChart`). Disponible, Congelado, and Vendido each have a centered white label when the count is not zero. A click still focuses proyecto or torre.

`NamedBars` puts a `mark` to the right of each bar. Right margin is 132 when the mark is money or a custom format, and 48 when it is a count. `barMark` chooses the text: a `format` function wins (dollars on price rises); otherwise `moneyValues` prints quetzales; otherwise `showGtq` prints `unidades · quetzales` when `gtq` is present; otherwise the mark is the unit count. Rows with a null `gtq` are still dropped when the bar encodes `gtq`. The cap of 12 and the «N de M» note are unchanged. A click still ignores the synthetic id `otras`.

### Band B

**Canales.** Parent heading «Ventas por canales». The caption is not printed. `notice` still is. Bars are `vista.channels`, length = units, mark = units and quetzales. A fuente click still sets `focus.kind = "fuente"`. «Otras fuentes» still does not.

**Modelo.** Heading «Ventas por modelo». Models stay sorted by `sold`, then label. The bar is units sold. `listGtq` is not copied onto the row. That field is the list price of the model, not the amount the bar represents.

**Valor de proyecto.** New `ValorBand`. It reads `valor-del-proyecto`, `subidas-de-precios`, and `descuentos`.

`ValueTrajectory` is a `ComposedChart` of `valor.months`: bar `desistido` in red, labeled above in quetzales; line `ventas` in navy, labeled below. The Y axis is quetzales, width 84. Empty `months` prints «Nada que graficar en este periodo.»

`ProjectValue` draws projects that have `disponibleGtq` or `desistidoGtq` as two horizontal series, Disponible in blue and Desistido in red, amounts labeled to the right. Projects with `disponibleUsd` get a second chart, series «Disponible $», labeled with `dollars`. The two currencies are not on one axis.

«Trayectoria de precios» is two line charts (`CurrencyLine`) on `precios.months`, one for quetzales and one for dollars, each with its own scale, a one-item legend, and the amount above every point. An empty month list prints `vista.notice`, or «Nada que graficar en este periodo.» when the notice is null. Those months are the twelve-month window the vista already builds.

«Impacto del descuento» is two bars when `descuentos.gtq` or `descuentos.saleGtq` is non-null: «Ventas con descuento» and «Descuento». A null side is dropped. When both are null, the notice is printed and no zero bar is drawn. The breakdown by tipo is the Descuentos control, not this chart.

**Desistimientos.** Two cards, always mounted. While the vista loads, each shows `StatusLine`. The sentence «N desistimientos · Q… valor del trato» and the caption are gone. When any motivo or project row has `gtq`, both charts use that amount and the series name «Valor». Otherwise they use units. A project click still focuses the detail table.

Reembolso and retención are not series. `buildDesistencias` says they are not in the base and must not be shown as zero. The payload rows are `motivos` and `byProject`. The bars use `gtq` when it is present. The builder was not changed.

**Controls.** A `vc-grid-2` of four cards. Captions are not printed. Notices still are. These sentences are gone:

- «N descuentos · monto · porcentaje del valor de esas ventas.»
- «N unidades · quetzales · dólares. Quetzales y dólares no se suman.»
- «Marcadas N · F&F N · especiales N · peso N.»
- «N ventas · N con promoción · monto.»

Descuentos: bars of `tipos`, quetzales when any tipo has `gtq`, otherwise units.

Subidas de precios: quetzal rows and dollar rows are separate charts. A project with only dollars is no longer dropped. The dollar chart passes `row.usd` through the `gtq` slot, formats it with `dollars`, series name «Dólares», fill blue. Ids are suffixed `:usd`.

F&F: the old guard `marked == null` hid the chart even when `tipos` contained «Ventas del periodo». The chart now draws whenever `tipos.length > 0`. The bar is units. `casoAmounts` may attach quetzales, and `showGtq` then prints `unidades · quetzales`. It does that only when `marked` is non-null, `traces.length === marked`, every trace of that tipo has `gtq`, and the trace count equals the tipo’s units. The «resto» row is left as the vista sent it. A trace list cut at 80 fails the length check and is not summed.

Promociones: when any tipo has `gtq`, the bar is quetzales. Otherwise the bar is units, and `showGtq` still appends money on a row that has it.

**Control Referidos.** Its own section, under the controls and above the detail table. Heading «Control Referidos». Body: «Referido, tipo de referido y nombre de referidor no vienen en esta vista.»

Those three fields are not on `VentasVista`. `SaleLine` has fuente, not a referidor. There is no `referidos` member of `VISTA_SECTIONS`. The section does not filter the canales chart and does not draw a zero. `/api/reservas/referidos` was not called. That route reads `v_rv_referrals_full` and requires `ADMIN_ROLES`. It has no tipo de referido, and it is the special-price register from migration 019, not the Pipedrive trail named in the checklist.

### Copy commented out, not deleted

`plainCaption` used to drop any caption containing «¿» and print the rest. It was removed. The definition sentences are JSX comments.

Under «Status contra la fecha de cierre»:

- «Fecha de cierre {closeOn}. {dayLabel}. Real {units} · ritmo {paceUnits} · {gap} unidades.»
- `status.caption`, which the vista sets to «El ritmo es la meta prorrateada a hoy. Un mes ya cerrado se compara contra la meta completa. La fecha de cierre es el último día del mes.»

`status.notice` and `totales.targetNote` still render.

Under «Tasa de conversión»:

- «Reservas, promesas firmadas, recibos publicados y ventas netas. El porcentaje compara cada etapa con la anterior. Si pasa de 100 %, entraron tratos que no venían de esa etapa.»
- The generated line `{etapa}: {source}, {grain}`.

Under inventario por proyecto, `inventario.caption`: «Inventario al {fecha}. El precio de lista de Santa Elena queda en dólares. No se suma con los quetzales.» `inventario.notice` still renders, including «El inventario no se parte por asesor.»

Under the project brecha, «Real menos ritmo a la fecha de cierre. Rojo: déficit. Azul: excedente.» is commented out. The color is still the bar fill. Under the asesor brecha, «El déficit más grande primero.» was removed rather than commented. The sort still comes from the vista.

The detail-table sentences were not touched.

## 2. Retired pages, and where the links go

The commit deletes `src/app/old/` (37 files) and the unused Ventas prototype. Changelog 103 has the line counts and the role-by-role allow-list. The paths are these.

Créditos and its pipeline:

- `src/app/old/creditos/page.tsx`
- `src/app/old/creditos/creditos-client.tsx`
- `src/app/old/creditos/pipeline/page.tsx`
- `src/app/old/creditos/pipeline/pipeline-client.tsx`
- `src/app/old/creditos/pipeline/expedientes-listado.tsx`
- `src/app/old/creditos/pipeline/nuevo-expediente.tsx`

Entregas:

- `src/app/old/entregas/page.tsx`
- `src/app/old/entregas/entregas-client.tsx`

Mercadeo:

- `src/app/old/mercadeo/page.tsx`

Ventas analytics, dashboard, and portal:

- `src/app/old/ventas/page.tsx`
- `src/app/old/ventas/ventas-client.tsx`
- `src/app/old/ventas/ventas-analitica.tsx`
- `src/app/old/ventas/cumulative-chart.tsx`
- `src/app/old/ventas/monthly-chart.tsx`
- `src/app/old/ventas/dashboard/page.tsx`
- `src/app/old/ventas/dashboard/ventas-dashboard-client.tsx`
- `src/app/old/ventas/dashboard/carta-autorizacion/[id]/page.tsx`
- `src/app/old/ventas/dashboard/carta-pago/[id]/page.tsx`
- `src/app/old/ventas/dashboard/pcv/[id]/page.tsx`
- `src/app/old/ventas/portal/page.tsx`
- `src/app/old/ventas/portal/layout.tsx`
- `src/app/old/ventas/portal/panel/page.tsx`
- `src/app/old/ventas/portal/panel/panel-client.tsx`
- `src/app/old/ventas/portal/reservas/page.tsx`
- `src/app/old/ventas/portal/reservas/reservas-client.tsx`
- `src/app/old/ventas/portal/reservas/ventas-reservation-detail.tsx`
- `src/app/old/ventas/portal/inventario/page.tsx`
- `src/app/old/ventas/portal/inventario/inventario-client.tsx`
- `src/app/old/ventas/portal/inventario/unit-detail-modal.tsx`
- `src/app/old/ventas/portal/clientes/page.tsx`
- `src/app/old/ventas/portal/clientes/clientes-client.tsx`
- `src/app/old/ventas/portal/rendimiento/page.tsx`
- `src/app/old/ventas/portal/rendimiento/rendimiento-client.tsx`
- `src/app/old/ventas/portal/rendimiento/velocity-chart.tsx`
- `src/app/old/ventas/portal/nueva-reserva/page.tsx`
- `src/app/old/ventas/portal/nueva-reserva/nueva-reserva-client.tsx`
- `src/app/old/ventas/portal/nueva-reserva/desktop-file-input.tsx`

No `next.config.js` redirect was added.

Also deleted, because nothing mounted them:

- `src/app/(panel)/ventas/page.prototype.tsx` (not a Next route; only `page.tsx` is)
- the thirteen files under `src/app/(panel)/ventas/_centro-de-mando/` (`centro.tsx`, `centro.module.css`, `model.ts`, `panels.tsx`, `hero-views.tsx`, `overlays.tsx`, `fixture.ts`, `bars.tsx`, `state.ts`, `motion.ts`, `format.ts`, `insights.ts`, `frame.tsx`)
- `scripts/centro-de-mando-insights.ts`, which imported the prototype’s fixture and would have failed `tsc` once those modules were gone
- `src/app/(panel)/mercadeo/board.tsx`, which exported `MercadeoBoard` and was imported by no page

Kept, because something still imports them: `glance-view.tsx`, `glance-control.tsx`, `glance-stock.tsx`, `totales-view.tsx`, `landing-blocks.tsx`, `src/app/(panel)/ventas/board.tsx`, and the Mercadeo `glance-view.tsx`. `src/app/pabi/mercadeo/mercadeo-client.tsx` is still in the tree and is not mounted.

`landing-blocks.module.css` was not part of the centro-de-mando deletion. Changelog 100’s project colors live there, not in the deleted `model.ts`.

### Homes

| Role | Before | After |
|---|---|---|
| `ventas`, leaving `/login`, or any path outside the allow-list | `/old/ventas/dashboard` | `/ventas` |
| `creditos`, leaving `/login`, or any path outside the allow-list | `/old/creditos/pipeline` | `/creditos` |
| `entregas_viewer` or `entregas_editor`, leaving `/login`, or any path outside the allow-list | `/old/entregas` | `/entregas` |
| `master`, `torredecontrol`, `gerencia`, `financiero`, `contabilidad`, `marketing` | `/` | `/` |

The ventas destination was updated in `src/proxy.ts`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/login/login-form.tsx`, `src/app/auth/set-password/page.tsx`, and `src/app/auth/confirm/route.ts` (only when the OTP user already has `password_set`). `src/app/page.tsx` also sends the two entregas roles from `/` to `/entregas`. The proxy already does that, because `/` is outside their allow-list.

Allow-list prefixes removed: `/old/ventas` for ventas, `/old/creditos` for creditos, `/old/entregas` for the entregas roles. Still allowed for ventas, and unchanged: `/reservar`, `/disponibilidad`, `/cotizador`, `/auth`, `/login`, and the five department prefixes. Creditos may still open `/auth/` and those five prefixes, including a section path such as `/creditos/armado`. Admin roles stay unrestricted. Marketing and the data-viewer roles keep the block list they had. `/old` was not added to that block list, so their old bookmarks 404.

### Both navbars

`src/components/nav-bar.tsx` is the rollback header (`NEXT_PUBLIC_NAV_VARIANT=navbar`). `src/app/pabi/nav-links.ts` holds the same labels for a panel that does not import `NON_VENTAS_CATEGORIES`, `VENTAS_CATEGORIES`, or `ENTREGAS_ONLY_CATEGORIES`. The live header is `src/app/pabi/panel.tsx`. It already linked to the five department pages and was not in the commit.

| Label | Before | After |
|---|---|---|
| Ventas | `/old/ventas` | `/ventas` |
| Créditos | `/old/creditos` | `/creditos` |
| Expedientes | `/old/creditos/pipeline` | removed |
| Mercadeo | `/old/mercadeo` | `/mercadeo` |
| Entregas | `/old/entregas` | `/entregas` |

For the ventas role, Mis Reservas, Inventario, Clientes, and Rendimiento (the four `/old/ventas/portal/...` links) were replaced by Ventas (`/ventas`) and Reservar (`/reservar`). Disponibilidad and Cotizador stayed. There is no replacement page for the old clientes list or the old rendimiento chart.

`VENTAS_SECTIONS` and `MERCADEO_SECTIONS` in `nav-links.ts` are in-page ids, not URLs. They were not retargeted. The comments above them no longer say those sections live at `/old/ventas` or `/old/mercadeo`. The live lists are `src/app/(panel)/ventas/sections.ts` and `src/app/(panel)/mercadeo/sections.ts`. Those files were not edited. `MERCADEO_SECTIONS` is still imported by the unmounted `mercadeo-client.tsx`.

### HUD and two comments

`src/app/hud/areas.ts`, 104 lines, half of them the old path and half the new one. Every `/old/mercadeo` became `/mercadeo`, every `/old/ventas` became `/ventas`, and every `/old/creditos/pipeline` became `/creditos`. Labels were not rewritten. Query strings and hashes were left in place, including `/creditos?etapa=Armado%20de%20Expediente#tratos`, `/ventas#objetivos`, `/ventas#canales`, and `/ventas#modelos`. The command centers do not read `etapa` and do not use those hashes. The link opens the department page. The sentence beside the link still describes the retired report.

`src/app/disponibilidad/disponibilidad-panel.tsx`: the `syncUrl` comment no longer cites an embed inside `/old/ventas`. The prop is unchanged. The only caller that passed `syncUrl={false}` was the deleted `ventas-client.tsx`.

`src/app/pabi/contable/contable-charts.tsx`: the comment above the PCV and expedientes summary now says the full view is `/creditos`. The component was not otherwise changed.

## 3. Documents and agent guidance

### Added to Git in this commit

These changelog files were untracked and are now in the commit:

- `changelog/100_2026-11-09_ventas-landing-project-colors.md`
- `changelog/101_2026-11-09_ventas-landing-reservas.md`
- `changelog/102_2026-11-10_command-center-doc-cleanup.md`
- `changelog/104_2026-11-10_ventas-command-center-zero-click.md`

`changelog/103_2026-11-10_remove-old-department-routes.md` is still untracked.

### Guidance that now names the five pages

`.cursorrules` and `CLAUDE.md` each gained a “Department command centers” section. Mercadeo, Ventas, Cobros, Créditos, and Entregas are each one vertically scrollable page. Operativo items are charts on that page. A left rail may scroll to a band. It does not open another URL. The three living documents win over older notes:

- `docs/SDD-Department-Command-Centers.md`
- `docs/General-Rules-and-Principles.md`
- `docs/Checklists-Authoritative.md`

The stack lines now say Recharts 3, D3.js 7, and Tailwind 4. `CLAUDE.md` no longer says the CSS is `globals.css` with no Tailwind utilities. `origin/SSOT/` is described as historical discovery, and the department checklist SSOT is `docs/Checklists-Authoritative.md`. `dashboard-client.tsx` is described as the older analytics client. The known `next build` failure on `documentKeyFrom` now says Next.js, not Next 15. `docs/METADATA_SPEC.md` says `NEXTJS_VERSION: 16.x`.

`ANATOMOS_SCAFFOLDING.md` (790 lines) was a tracked scaffold for a different product. It was deleted. Nothing in the app imported it.

### Tracked docs deleted by the commit

Changelog 102 explains why. These are the deletions Git recorded. `docs/ventas-secondary-menu.md` was the thirteen-URL menu. The rest are March–May 2026 gap reports, audits, cotizador plans, reconciliation logs, and role inventories. Two SOP cross-references that named `docs/reconciliation-phase2-plan.md` were retargeted: `docs/SOP-monthly-commission-etl.md` now points at `docs/SOP-monthly-cobros-reconciliation.md`, and both that SOP and `docs/manifest-CIERRE_COBROS_ABRIL.md` dropped the row for the deleted plan.

- `docs/Plan_Sobreprecio.md`
- `docs/_pre_Devoluciones_Negative_Payments.md`
- `docs/audit-unit-status-transitions-2026-05-22.md`
- `docs/bulletproof-auth-plan.md`
- `docs/categorias-c-d-blt-torre-b.md`
- `docs/commission-audit-2026-04.md`
- `docs/commission-audit-plan.md`
- `docs/cotizador-diff-report-2026-03-26.md`
- `docs/creditos-33-units-investigation.md`
- `docs/diag-blt-torre-b-all-vendido-2026-04-21.md`
- `docs/diff-08-isr-plan.md`
- `docs/diff-09-phase-proration-plan.md`
- `docs/ejecutivo-rate-solution.md`
- `docs/funcionalidades-pendientes-2026-04-20.md`
- `docs/gap-comprehensive-status-2026-03-21.md`
- `docs/gap-master-status-2026-03-20.md`
- `docs/gap-prioritization-2026-03-19.md`
- `docs/gap-status-report-2026-03-20.md`
- `docs/gap_master_status.html`
- `docs/orphaned-sales-investigation.md`
- `docs/otto-herrera-commission-audit-2026-04-20.md`
- `docs/plan-auth-deep-investigation.md`
- `docs/plan-cesion-derechos.md`
- `docs/plan-cotizador-image-compact-2026-05-19.md`
- `docs/plan-creditos-dashboard.md`
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
- `docs/reconciliation-blocking-log-2026-05.md`
- `docs/reconciliation-ce-2026-05.md`
- `docs/reconciliation-phase2-plan.md`
- `docs/remaining-features.md`
- `docs/roles-current-state.md`
- `docs/roles-gap-analysis.md`
- `docs/roles-industry-best-practices.md`
- `docs/sales-rep-commission-rates-investigation.md`
- `docs/sync-diff-proposal-2026-03-25.md`
- `docs/transcript-feature-extraction-2026-03-26.md`
- `docs/transcript-feature-extraction-2026-04-14.md`
- `docs/ventas-secondary-menu.md`

Changelog 102 also records files that were never tracked, so this commit has no deletion for them: the `wr420/` drafts, `Ideal-End-State-Ventas-Totales-Landing-Page.md`, `Proposed-Solution-for-badly-designed-Ventas-Ventas-Totales-page.md`, `Sitio-nuevo-estructura.md`, `Ventas-y-Mercadeo-paginas.md`, and other notes under `docs/redesign/` and `docs/` that were gitignored or untracked. Those removals are real on disk. They are not rows in `91f7c6a`.

## What the commit did not change

- No schema, migration, or loader source.
- No edit to the vista API or to `landing-blocks.tsx`.
- No edit to the live Cobros, Créditos, Entregas, or Mercadeo page components, other than deleting the unmounted Mercadeo `board.tsx`.
- The five `[section]/page.tsx` routes are still there.
- No redirect from `/old/...` to the new paths.
- `/reservar`, `/disponibilidad`, `/cotizador`, and `/admin/reservas` behave as before. Only a comment on disponibilidad changed.
- Referido, tipo de referido, nombre de referidor, reembolso, and retención were not added to a query. The page does not draw them as zero.
