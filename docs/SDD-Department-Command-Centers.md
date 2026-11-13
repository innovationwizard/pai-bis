# SDD — Department Command Centers

**Software Design Document**  
**Scope:** All five fixed main sections — Mercadeo, Ventas, Cobros, Créditos, Entregas  
**Validation audience:** CEO and Managers  
**Goal:** Each department is a single, vertically scrollable command center of high-density Recharts and D3 visualizations that cover every required Operativo checklist item with 0 clicks.  
**Date:** 10 November 2026

---

## 1. Purpose and Architectural Pivot

The application previously treated checklist items as isolated sub-pages. This forced navigation and under-utilized visualizations.

The required lists are checklists of information that must appear as clear graphics or charts on the department page itself. Sub-page structure is eliminated for the main flows. What matters is that each required item is visible as a purposeful visualization with 0 clicks.

**Fixed constraints**
- Main sections and order remain unchanged: Mercadeo → Ventas → Cobros → Créditos → Entregas.
- Do not invent new top-level navigation.
- All existing sub-sections are re-thought: their content becomes modular visual components on the parent department page, not separate URLs.

**Core intent**
Strategically and densely use Recharts and D3 so that the required information becomes glanceable graphics. Prefer charts, funnels, bullets, stacked bars, and composed charts. Avoid sparse KPI cards or text-heavy layouts.

**Fundamental guiding principle**
Take what the CEO and Managers already have in mind and are already familiar with, and use that. Do not introduce, force, or display alternative definitions of metrics. The app must not attempt to feed them a different meaning for the numbers they already use.

---

## 2. Design Principles

1. **Graphics and charts first.** Every checklist item is expressed as a high-quality Recharts or D3 visualization. KPI cards are supporting context only when they add density without text.
2. **0-click rule.** Every item on the Operativo checklist appears on the default view of the department page. No navigation to another URL is required to see any required item.
3. **Single command center per department.** Each of the five main sections is one vertically scrollable page composed of visual bands. A left-rail secondary menu may remain; it navigates within the page (anchor / scroll-to) rather than to separate URLs. Prefer the icon when a single click reaches a section faster than scrolling.
4. **Progressive disclosure via visual hierarchy, not text.** Top of page = most important graphics. Middle = explanatory pipelines and comparisons. Lower = supporting detail that is still fully visible without a click. Interactions (click a chart element) may filter a table lower on the same page.
5. **Familiarity.** Use the labels, groupings, and mental models the users already recognize. Do not re-label or re-define.
6. **Semantic color and density.** Use color for meaning (compliance, deficit, blocked stages). Additionally, use dark, corporate shades of blue to visually identify different projects. Keep the current project colors for now. Future consideration: a configuration to assign or change project colors. Prefer compact, high-information-density charts.
7. **Single source of truth.** Same page for executive and operative users. Executives stop at the upper charts; operatives scroll.
8. **Anti-clutter.** Managers have consistently criticized “too cluttered” and “too much text.” Do not add explanatory captions, definition statements, or redundant labels. Every graphical element that represents an amount must still display its corresponding number (bars, columns, points, segments). Data labels on charts are required; surrounding prose is not.
9. **No conversational-question titles.** Chart titles are descriptive and concise, or omitted when the visual is self-evident.
10. **Freshness.** Freshness stamp is always visible, placed per the General Rules (same line as period description, same font weight, not bold, not its own row).
11. **Growth.** All design must support company growth without breaking. Example targets: 2× simultaneous projects, 10× sales reps.
12. **Project order.** Canonical project display order is BOULEVARD 5, BENESTARE, BOSQUE LAS TAPIAS, SANTA ELENA (by date of birth). It is defined in the shared constant `src/lib/projects.ts` so reordering is a config change.

### Inventory status colours

Status colours for inventory (Disponible, Congelado, Reservado, Vendido, etc.) must be identical to those already used on the unit availability grid (/disponibilidad). Do not introduce a new palette on the command centre. Source of truth: UNIT_STATUS_COLORS in src/lib/reservas/constants.ts (Disponible #22c55e, En revisión #f59e0b, Reservado #3b82f6, Congelado #a855f7, Vendido #6b7280).

### Visual density continuity

On every Command Center (Mercadeo, Ventas, Cobros, Créditos, Entregas) and inside every sub-section, adjacent bands must not produce an abrupt drop in visual density.

**Justification**

Research on dashboard density and visual hierarchy shows that a sudden change from high-ink, filled areas to large empty fields is perceived as a break in continuity, even when the data is correct. The first viewport of Ventas uses thick vertical bars that occupy most of the available height; the next band uses thin horizontal bars in large white fields. This contrast forces the eye to re-adjust and makes the second band feel unfinished. Consistent density keeps the page readable as one continuous surface.

**Operational rules**

1. **Bar weight.** Horizontal bars that follow a dense vertical-bar band must be thick enough to occupy a substantial fraction of their row height. Thin bars in large empty fields are not permitted.
2. **Row padding.** Vertical space between rows inside a band must be tight enough that the bars, not the gaps, dominate the visual weight. Generous padding is reserved for the dividers that separate distinct bands.
3. **Containment.** Each band that sits after a high-density section receives a subtle background tint or light card surface so it reads as a contained unit rather than floating elements in white space.
4. **Shared scale.** When a grid is used, it must be a regular, self-explanatory scale (for example, unitary when the maximum is small). Arbitrary or sparse lines that do not correspond to round values are not permitted.
5. **Growth.** These density rules apply regardless of the number of projects or asesores. Adding more rows must not re-introduce large empty fields or thin bars.

These rules apply to every department Command Center and to every sub-section within them.

### Abstraction order and visual hierarchy

The abstraction order is the stronger principle. Higher-level aggregates (project) appear before lower-level aggregates (asesor). This order is not reversed for layout convenience.

Visual weight communicates the same order without text. Elements that represent a higher level of abstraction use greater thickness or area than elements that represent a lower level. In the Objetivos bands, project bars are thicker than asesor bars so the hierarchy is readable at a glance. The same principle applies to every department Command Center and every sub-section: when two levels of the same measure appear together, the higher level occupies more visual mass.

---

## 3. Shared Layout Pattern (applied to every department page)

Each department page is a vertical stack of visual bands. Exact content varies by department; the pattern does not.

- **Band A — Primary graphics (0 clicks):** The most important visualizations that answer the department’s core question. Charts, not rows of KPI cards.
- **Band B — Analytical and control graphics (0 clicks):** Remaining checklist items as charts, small multiples, or compact visual summaries. Still fully visible without navigation.
- **Band C — Operative detail (optional filter target):** Tables or lists that can be filtered by clicking a chart element above. Not required for checklist coverage.

Optional lightweight filters (Periodo, Proyecto, Asesor) sit in a compact header. Default state already shows the useful view (current month / all projects). Freshness stamp is always visible, on the same line as the period description.

After the filter controls and the period + freshness line, mark the transition into page content with a line break and an elegant horizontal separator.

On single long-scroll Command Center pages the entire filter battery (project pills + Periodo / Asesor / Restablecer) must remain sticky at full height directly under the top navigation. No collapse or compact mode. Implemented first on Mercadeo and Ventas.

---

## 4. Ventas Command Center

**Replaces** the previous collection of sub-pages. Single vertically scrollable page. Primary language is the Reserva-level data and analytics the users already use.

All 14 Operativo checklist items are 0-click.

### 4.1 Band A — Primary graphics (0 clicks)

| # | Checklist item | Visualization |
|---|----------------|---------------|
| 1 | Ventas totales | Hero units (reservas) + project bars |
| 2 | Ventas versus objetivos de proyectos - totales y por asesor | Compact bullet charts or overlapping bars, one set per proyecto + ranked asesor view |
| 3 | Status de ventas - Déficit o excedente versus fecha de cierre, por proyecto y por asesor | Pace or bullet against expected trajectory, color-coded for deficit/surplus, by proyecto and by asesor |
| 6 | Inventario general: Vendido, congelado, disponible | Stacked horizontal bars by proyecto/torre. Status colors on the stacked bars match the availability-grid palette (Disponible #22c55e, Congelado #a855f7, Vendido #6b7280). |
| 9 | Tasa de conversión | Horizontal bar funnel of the stages currently tracked for the users’ familiar flow |

Santa Elena sales are paused for strategic reasons. Its meta for the current period is zero. It has no asesores assigned. Do not display “Sin meta”, “Sin asesor”, “Asesor pending”, or any equivalent placeholder text.

### 4.2 Band B — Analytical and control graphics (0 clicks)

| # | Checklist item | Visualization |
|---|----------------|---------------|
| 4 | Ventas por canales | Ranked horizontal bars or small multiples by Fuente |
| 5 | Análisis de inventario: Split de ventas por modelo | Horizontal bars (or small multiples) of ventas by modelo. Local filters that affect ONLY this band: Torre and Modelo. Default = all towers, all models. Zero-value or polluted model rows are suppressed or grouped as “Otros / sin clasificar” until the source field is cleaned (data-cleaning is out of scope for the current turn). Any status colors that appear must match the availability-grid palette (Disponible #22c55e, Congelado #a855f7, Vendido #6b7280, etc.). |
| 7 | Valor de proyecto - trazabilidad de precios por valorización y descuentos | Composed chart or small multiples showing price trajectory and discount impact |
| 8 | Desistimientos - Reembolsos, retención de reembolso y valorización de proyectos | Bars or small multiples for financial impact (reembolso / retención) |
| 10 | Control de descuentos | Compact visual summary (indicators or bars) with amounts shown |
| 11 | Control de subidas de precios | Compact visual summary (indicators or bars) with amounts shown |
| 12 | F&F y casos especiales | Compact visual summary (indicators or bars) with amounts shown |
| 13 | Control Referidos | Dedicated visual for the referral trail (Referido / Tipo de Referido / Nombre de Referidor): counts broken by proyecto or tipo, plus a short visible list of referidores. Not a filter on the canales chart |
| 14 | Control de promociones | Compact visual summary (indicators or bars) with amounts shown |

Chart interactions (click a bar, stage, or segment) may filter a detail table lower on the same page. No item requires navigation to another URL.

### 4.3 Deferred future option (not shown on screen, not designed today)

The dual-gate concept (recibo publicado + promesa firmada) is recorded only as a possible future improvement. It is to be considered only after all current items on both lists have been confirmed satisfactory by the CEO and Managers. The app must not display or force this definition.

---

## 5. Other Department Command Centers (high-level)

These follow the same pattern. All items from each department’s Operativo checklist are 0-click graphics on a single scrollable page. Detailed visual specs can be refined after Ventas is validated.

**Note on Créditos:** The SSOT received from the CEO mixes Créditos + Entregas + Legal (Internal) + Legal (External). For this SDD the entire mush is placed under Créditos. Untangling the workflows is deferred until after this SDD is designed and built.

### 5.1 Mercadeo
Operativo items (all 0-click):
- 1 Reporte maestro (with 1.1 Meta mensual de lead, 1.2 Meta diaria de lead, 1.3 Uso de presupuesto diario de pauta, 1.4 Uso de presupuesto mensual de pauta, 1.5 ROAS / ROI, 1.6 Costo por cierre / medio de venta)
- 2 Efectividad de campañas
- 3 Evolución de costos por lead de manera mensual
- 4 Evolución de inversiones en pauta acumulada mensual
- 5 Operatividad de todos los canales digitales en la aplicación
- 6 Gestión de pauta - Multiplataforma

### 5.2 Cobros
Operativo items (all 0-click):
- 1 Cobros por proyecto
- 2 Cobros acumulados: Monto y porcentaje
- 3 Cobros del mes: Monto y porcentaje
- 4 Déficit - mensual & acumulado
- 5 Superávit - mensual & acumulado
- 6 Reporte de deficit / superávit - mensual & acumulado
- 7 Reporte de alertas - en caso de deficit, mensual y acumulado
- 8 Analítica de decisiones de desistimientos
- 9 Casos especiales

### 5.3 Créditos
Operativo items (all 0-click; currently includes the mixed Créditos + Entregas + Legal items):
- 1 Control de expediente inicial - Check list de papelería
- 2 Control de scanners de expediente inicial
- 3 Control de Promesas de compra venta - físicos, digital, scanner
- 4 Armado de expediente (4.1 Solicitud, 4.2 Recolección, 4.3 Llenado, 4.4 Firma)
- 5 Autorización de ventas al contado
- 6 Envío a análisis (6.1 FHA, 6.2 Banco)
- 7 Suspendidos (7.1 FHA, 7.2 Banco)
- 8 Re análisis (8.1 FHA, 8.2 Banco)
- 9 Aprobación (9.1 FHA, 9.2 Banco)
- 10 Expediente técnico (10.1 FHA, 10.2 Avalúo Banco)
- 11 Aprobación final (11.1 Resguardo, 11.2 Resolución bancaria)
- 12 Escrituración (12.1 Facturación)
- 13 Entrega
- 14 Recaudación de firmas
- 15 Pago de impuestos
- 16 Ingreso al registro
- 17 Desembolso
- 18 Liquidación (18.1 Entrega de testimonio al cliente)
- 19 Archivado

### 5.4 Entregas
Checklist pending. Will follow the same 0-click single-page pattern once received.

---

## 6. Experience Requirements

- Default load of each department page shows every Operativo checklist item as a visualization without applying filters and without navigation.
- All graphical elements that represent an amount display their corresponding number.
- No explanatory definition statements, no redundant captions, no conversational titles.
- Chart interactions (click bar/stage) filter detail tables on the same page.
- Semantic color only for meaning.
- Desktop-first, basic responsive behavior.
- Same page for executive and operative roles.
- Freshness stamp per General Rules.
- Filter battery ends with a line break and elegant horizontal separator before content.
- On single long-scroll Command Center pages the entire filter battery (project pills + Periodo / Asesor / Restablecer) must remain sticky at full height directly under the top navigation. No collapse or compact mode. Implemented first on Mercadeo and Ventas.

---

## 7. Acceptance Criteria (Ventas first)

- [ ] Ventas is a single scrollable page; former sub-page content appears as visual bands, not separate URLs.
- [ ] All 14 Operativo checklist items are visible as charts or high-density visuals without clicking.
- [ ] Every graphical element representing an amount displays its corresponding number.
- [ ] No on-screen definition statements or forced alternative metrics.
- [ ] Control Referidos has its own visual treatment (not a canales filter).
- [ ] Recharts and/or D3 are used for the primary visualizations.
- [ ] No conversational-question titles.
- [ ] Page is not cluttered with explanatory text.
- [ ] Reviewers can check off every required information item by looking at the charts.

---

## 8. Out of Scope (this iteration)

- Changing the five main section names or order.
- Displaying or designing the dual-gate Venta neta concept.
- Full legal / PCV / expedientes modules beyond what already belongs under Créditos or Entregas.
- AI narrative generation.
- Real-time live streaming if the underlying extracts are still batch.
- Board-level (Directivo) presentation views.

---

## 9. Implementation Notes

- Prefer Recharts for standard bars, lines, composed charts, and funnels; use D3 for Sankeys, custom bullets, or highly custom density when Recharts is insufficient.
- Default period = current month, all projects, all asesores.
- Metas: all existing targets are available. Load and display them. “Meta pending” is not acceptable.
- De-emphasize (do not remove) left-rail secondary navigation; make it navigate within the single page.
- Keep the freshness stamp and filter-to-content separator.
- Data for all checklist items is considered available for design purposes (even if not yet fully loaded into the production database).
- Project identification colors: dark corporate blues; keep current palette for now.

---

## 10. Living Documents

This SDD is one of three living documents that guide future development:

- `docs/SDD-Department-Command-Centers.md` (this document)
- `docs/General-Rules-and-Principles.md` (merged General Rules + key principles + freshness/filter rules)
- `docs/Checklists-Authoritative.md` (verbatim original Operativo and Directivo lists, marked as SSOT)

Historical multi-page, secondary-menu, and outdated design documents are to be removed or rewritten so they no longer contradict the Command Center model.
