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

**Inventory status color mapping (research-backed)**  
What the research shows  
There is no single industry-standard color set for real-estate inventory status in internal operational dashboards. Buyer-facing portals (Zillow, RPR, MLS systems) use inconsistent schemes (red for active/under contract, yellow for sold, blue for pending, gray for closed, etc.). Internal tools vary even more.  
What does exist is a well-established semantic vocabulary for status in operational and monitoring dashboards (IBM Carbon, ColorFYI, RAG systems, enterprise UI patterns):  
Green = available / active / operational / good  
Blue = in progress / reserved / processing / pending  
Purple (or a distinct non-traffic-light hue) = special / blocked / frozen / outlier  
Gray = completed / inactive / closed / sold  
Your current mapping matches this vocabulary almost exactly.  

**Note:** The project owner feels unsure about the purple. Exploring the replacement of purple with another non-traffic-light hue is not hard-out-of-scope.
7. **Single source of truth.** Same page for executive and operative users. Executives stop at the upper charts; operatives scroll.
8. **Anti-clutter.** Managers have consistently criticized “too cluttered” and “too much text.” Do not add explanatory captions, definition statements, or redundant labels. Every graphical element that represents an amount must still display its corresponding number (bars, columns, points, segments). Data labels on charts are required; surrounding prose is not.
9. **No conversational-question titles.** Chart titles are descriptive and concise, or omitted when the visual is self-evident.
10. **Freshness.** Freshness stamp is always visible, placed per the General Rules (same line as period description, same font weight, not bold, not its own row).
11. **Provenance on click.** Every number displayed in the UI that represents a metric, amount, count, percentage, or ratio (including data labels on charts, hero values, and table cells) must display a tooltip with full provenance when the user clicks that number. Hover is not required. Full provenance includes: (a) source system and specific table/field (or equivalent), (b) exact calculation or aggregation formula/rule used, (c) active filters applied, and (d) when the number is a count or aggregate, the full list of contributing records (not a sample). The tooltip is the only place definitional or calculation detail appears; it does not add static text to the page. Numbers themselves are always visible on or directly above the graphical element; the tooltip is reserved exclusively for provenance.

12. **HARD RULE — No static files as data sources.** It is absolutely forbidden to use CSV, XLSX, or any other kind of static file as a source of information for any section, any sub-section, any band, any chart, or any graph of this whole project. All numbers and series must come from the live application database or its connected sources. Static files may exist in the repository only as historical reference or documentation; they must never be read or parsed to populate UI elements.

**Cursor agent prompt rules (reference)**  
Every prompt sent to a Cursor agent that operates on the repository must begin with the full block from `artifacts/Cursor-Agent-Repository-Boundary-and-Safety-Rules.md`. That file is the authoritative source for repository boundary, safety rules, and the prohibition on local tests, servers, and browsers. Do not use only the shortened “no local server” ending.


---

## 2.1 Mandatory Visual Nomenclature (locked)

**Why this exists and why it is mandatory**  
On 18–19 November 2026 we lost multiple hours because the same visual region was referred to by different names in prompts versus in the local agent’s interpretation. The resulting mis-edits forced repeated rework. To prevent that class of failure permanently, the following names are now the **only** official terms for these regions. They must be used in every future prompt, SDD update, and code comment that refers to layout. No synonyms, no “the left card”, no “the top section”, no quadrant labels.

Research basis (dashboard and data-visualization literature):
- “Hero” / “Hero Row” / “Hero KPI strip” is the established term for the top band that holds the primary number and its immediate breakdown.
- “KPI card” is the standard name for a card whose primary job is to display one or a very small set of key numbers.
- “Band” / “Row” is the common term for a horizontal grouping of related cards.
- “Small multiples” (Tufte) / facets / panels describe the repeated identical columns that appear inside both the Expanded Hero and the Project Detail Cards.
- “Compact Hero” is deliberately novel. Its lack of prior use in the literature or the codebase is the reason it was retained: it cannot be confused with any existing term.

**The ten mandatory names**

| Official name | What it is | Notes |
|---------------|------------|-------|
| **Item Title** | The heading of the checklist item (e.g. “Split de ventas por modelo y por torre”). | Does not yet exist as a named element in the codebase; must be treated as a first-class region. |
| **Page** | The entire vertically scrollable content area that belongs to one checklist item. | One Item per Page. |
| **Hero Band** | The top horizontal band of the Page. Contains the Compact Hero on the left and the Expanded Hero on the right. | Matches the widely used “Hero Row”. |
| **Compact Hero** | The single left-hand card inside the Hero Band. | Always titled “Todos los Proyectos”. Holds the overall number(s) for the current filter scope. |
| **Expanded Hero** | The single right-hand card inside the Hero Band. | Contains the Project Summary Columns. |
| **Project Summary Columns** | The individual project columns that live inside the Expanded Hero. | Canonical project order. |
| **Project Bands** | The set of horizontal bands that appear below the Hero Band, one per project. | |
| **Project KPI Cards** | The left-hand cards inside each Project Band. | Each shows that project’s aggregate number. |
| **Project Detail Cards** | The right-hand cards inside each Project Band. | Contain the Member Columns. |
| **Member Columns** | The individual secondary/tertiary columns (asesor, modelo, torre, etc.) that live inside each Project Detail Card. | Asesores: sorted descending by the metric. Modelos: always alphabetical. Other members follow the item’s locked rule. |

**Rules**
- These names are mandatory. Any prompt or specification that uses a different label for one of these regions is incorrect and must be rewritten before it is sent to an agent.
- The title inside the Compact Hero is always “Todos los Proyectos” unless a future locked exception is explicitly recorded here.
- Canonical project order, never-hide-zeros rule, and all other existing principles continue to apply unchanged.
- When a new visual region appears that does not fit the table above, it must be added to this table before it is referenced in any prompt.

---

## 3. Canonical Three-Level Pattern (locked for all 14 Ventas items and the same cadence for other departments)

Every checklist item answers three successive questions with graphics, on a single page, with zero clicks in the default view:

1. **Compact Hero** — large number on the left, always titled “Todos los Proyectos”.
2. **Expanded Hero** — graphical breakdown immediately to the right of the Compact Hero (Project Summary Columns for Ventas).
3. **Project Bands** — one band per member of the previous level (one per project), each containing a Project KPI Card on the left and a Project Detail Card on the right (Member Columns, e.g. asesor bars, inside the Project Detail Card).

**Rules that lock this pattern**
- **The full item fits on the page.** Compact Hero + Expanded Hero + all Project Bands must be visible together without requiring scroll beyond what Items 1 and 2 currently require. Reduce band height and empty space as needed to achieve this. This is a hard constraint.
- **Vertical category labels when density requires it.** When a chart has many categories whose names are longer than the available column width, rotate the category labels to a fully vertical orientation (90 degrees). This is the only reliably truncation-free solution observed across multiple attempts. Horizontal or angled (e.g. 45°) labels truncate under realistic densities. Apply this technique wherever the same constraint appears.


- Numbers are always visible on or directly above every bar / column / segment. Never rely on a tooltip for the value itself. Tooltips are reserved exclusively for provenance (click only).
- Projects are always shown in the canonical order: Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena (order by project Date of Birth). This order is fixed and is not sorted by the metric.
- **Default ordering rule (when a specific order has not been locked for an item):** Respect canonical order for projects. Then order towers alphabetically. Then order modelos alphabetically. This applies wherever a specific order for a specific item has not been ruled.
- Member Columns of asesores are always sorted descending by the metric value so the eye lands on the largest contributors first. Modelos are always alphabetical. Other member types follow the item’s locked rule.
- The Project Detail Card that holds the Member Columns (asesor bars, etc.) has a fixed size. Columns are squeezed as necessary so that every member fits in a single row with no wrap, no overflow, and no internal scroll.
- Zero projects (or zero members) remain visible. Do not hide empty rows or zero values. Hiding zeros creates stark visual inconsistencies between periods and damages transparency (a core value of the project). Managers need to see the absence.
- Visual separation is provided by the existing card structure. No extra headings or explanatory text. If the page grows long, a very light background or slightly tighter grouping under the total block is sufficient.
- The legacy “Total › Proyecto › Asesor” breadcrumb/label is dead weight and must be removed.
- Project filter pills sit above the content: TODOS + the four projects in canonical order + a NINGUNO pill on the right. Selecting NINGUNO deselects all projects. The page must remain stable and not crash or go blank when zero projects are selected. Default state is TODOS (full three-level view, 0-click).

This pattern is the canon. All 14 Ventas Operativo items follow it. Other departments follow the same three-level graphics-first cadence adapted to their own hierarchy.

---

## 4. Shared Layout Pattern (applied to every department page)

Each department page is a vertical stack of visual bands. Exact content varies by department; the pattern does not.

- **Band A — Primary graphics (0 clicks):** The most important visualizations that answer the department’s core question. Charts, not rows of KPI cards.
- **Band B — Analytical and control graphics (0 clicks):** Remaining checklist items as charts, small multiples, or compact visual summaries. Still fully visible without navigation.
- **Band C — Operative detail (optional filter target):** Tables or lists that can be filtered by clicking a chart element above. Not required for checklist coverage.

Optional lightweight filters (Periodo, Proyecto, Asesor, Torre) sit in a compact header. Default state already shows the useful view (current month / all projects). Freshness stamp is always visible, on the same line as the period description.

After the filter controls and the period + freshness line, mark the transition into page content with a line break and an elegant horizontal separator.

---

## 4. Ventas Command Center

**Replaces** the previous collection of sub-pages. Single vertically scrollable page. Primary language is the Reserva-level data and analytics the users already use.

All 14 Operativo checklist items are 0-click.

### 4.1 Band A — Primary graphics (0 clicks)

| # | Checklist item | Visualization |
|---|----------------|---------------|
| 1 | Ventas totales | Canonical three-level pattern: Compact Hero + Expanded Hero (Project Summary Columns) + Project Bands (Project KPI Cards + Project Detail Cards with Member Columns). |
| 2 | Objetivos de ventas | Canonical three-level pattern (see precise spec below). |
| 3 | Status de ventas - Déficit o excedente versus fecha de cierre, por proyecto y por torre | Lifetime cumulative pace per project (and per torre). See precise spec below. No all-projects band. No per-asesor band. |
| 6 | Inventario general: Vendido, congelado, disponible | Stacked horizontal bars by proyecto/torre |
| 9 | Tasa de conversión | Horizontal bar funnel of the stages currently tracked for the users’ familiar flow |

#### 4.1.1 Precise visual spec — Item 2: Objetivos de ventas

Follows the locked canonical three-level pattern exactly.

**Compact Hero**  
One large number showing overall actual ventas versus the total objetivo for “Todos los Proyectos”, with variance (units and %) displayed next to it. Semantic color: red for deficit, green for surplus.

**Expanded Hero**  
Project Summary Columns in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
Each column shows actual against the objetivo line. The number is always visible on or directly above the column. Variance (units and %) remains in the same visual position as the current charts (to the right of each column). Zero projects remain visible.

**Project Bands**  
One Project Band per project.  
- Project KPI Card (left): that project’s actual-vs-objetivo number (with variance).  
- Project Detail Card (right): fixed-size card containing **only the asesores who belong to that project** (Member Columns). Asesores are sorted descending by the metric. Columns are squeezed as necessary so every asesor fits in a single row (no wrap, no overflow, no scroll). Same actual-vs-objetivo treatment (column + objetivo line + visible number + variance in the same position).

**Explicit rules for this item**
- Numbers always visible on or above every column. Tooltips reserved exclusively for provenance (click).
- Projects always in canonical order. Asesores always sorted descending by the metric.
- Fixed-size card for the asesor columns; squeeze to fit.
- Keep zero projects visible.
- Semantic color for variance only (red deficit / green surplus).
- Remove the current separate flat “Objetivos por asesor” list that mixes all projects.
- No extra titles beyond the minimum needed to label the total.

This replaces the previous two stacked flat charts with the single hierarchical three-level cadence.

#### 4.1.2 Precise visual spec — Item 3: Status de ventas (lifetime vs fecha de cierre)

**Critical correction:** The concept is the life of the project, not a monthly or period view. There is no all-projects band and no per-asesor band. The secondary level is per torre.

**Start date**  
First month that appears in each project’s Ritmo de Ventas CSV.

**Fecha de cierre (placeholder)**  
Linear expected trajectory to a date 24 months after each project’s first CSV month. Replace with the real fecha de cierre when provided. Per-torre bands inherit the project’s start and placeholder close for now.

**Unit totals (live availability)**  
- Boulevard 5: 298  
- Benestare: 282  
- Bosque Las Tapias: 234 (Torre B is 100 % Congelado / not available for normal sale; the 7 sold units are F&F exceptions)  
- Santa Elena: 11  

**What is shown**  
One band per project.  
- Left: project name + current cumulative Reservas and cumulative PCV (both numbers visible) + variance versus the expected cumulative as of today.  
- Right: lifetime cumulative chart from the project’s start month to the placeholder fecha de cierre.  
  - Solid line = cumulative Reservas  
  - Dashed line = cumulative PCV  
  - Thin gray line = expected linear trajectory  
  Both series and the expected line appear on the **same chart** (Option A). Numbers visible on the lines or at key points. Semantic color only for the variance (deficit/surplus).  

Below the project bands: one band per torre (same structure, inheriting start and placeholder close). Torre B of Bosque Las Tapias is shown but flagged as Congelado (F&F only).

**Single-tower rule:** If a project has only one torre, do not draw a separate per-torre band. The project band already represents the complete picture; drawing it twice is redundant. Boulevard 5 has only one torre — its per-torre band is omitted.

**Explicit rules**  
- Skip the all-projects band.  
- Skip the per-asesor band; use per-torre instead.  
- Single-tower rule: if a project has only one torre, omit the per-torre band (Boulevard 5).  
- Both series (Reservas and PCV) are shown.  
- Ignore the negative “Ritmo de Ventas” numbers in the CSVs until someone explains them.  
- Numbers always visible. Tooltips only for provenance.  
- Zero or fully Congelado torres remain visible.  
- Placeholder fecha de cierre is clearly labeled as temporary.

This item does not follow the three-level Total → Project → Asesor pattern used by items 1 and 2. It is a lifetime pace view per project and per torre.

### 4.2 Band B — Analytical and control graphics (0 clicks)

| # | Checklist item | Visualization |
|---|----------------|---------------|
| 4 | Ventas por canales | Ranked horizontal bars or small multiples by Fuente |
| 5 | Split de ventas por modelo y por torre | See precise spec below (4.2.1). Compact Hero + Expanded Hero (one column per torre; Santa Elena one column per modelo) + Project Bands. Single series at a time via the Reserva/PCV toggle. |
| 7 | Valor de proyecto - trazabilidad de precios por valorización y descuentos | Composed chart or small multiples showing price trajectory and discount impact |
| 8 | Desistimientos - Reembolsos, retención de reembolso y valorización de proyectos | Bars or small multiples for financial impact (reembolso / retención) |
| 10 | Control de descuentos | Compact visual summary (indicators or bars) with amounts shown |
| 11 | Control de subidas de precios | Compact visual summary (indicators or bars) with amounts shown |
| 12 | F&F y casos especiales | Compact visual summary (indicators or bars) with amounts shown |
| 13 | Control Referidos | Dedicated visual for the referral trail (Referido / Tipo de Referido / Nombre de Referidor): counts broken by proyecto or tipo, plus a short visible list of referidores. Not a filter on the canales chart |
| 14 | Control de promociones | Compact visual summary (indicators or bars) with amounts shown |

#### 4.2.1 Precise visual spec — Item 5: Análisis de inventario: Split de ventas por modelo

**Item Title**  
Split de ventas por modelo y por torre

**Status**  
Design is complete and correct as of 19 November 2026. Do not reopen the layout, the hierarchy, or the labels of this item unless a new decision is recorded here.  
The data underneath is not complete and is not correct. Fixing the sync, the modelo field, and the torre names is a separate mission.

**Counts**  
Every number is a count of the period’s sales events, classified by modelo and by torre the way Pipedrive classifies them. No inventory rewrites.

**Purpose**  
Show, at a glance, how the period’s Reservas and PCVs are distributed by modelo. Units only. No monetary values. No inventory-status composition (that is Item 6).

**Time and filters**  
- Counts respect the period filter, the project pills, and the asesor filter.  
- This item has no Torre filter and no Modelo filter.  
- Zero modelos are always shown. Never hide zeros.

**Ordering**  
- Projects: canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
- Modelos: always alphabetical. (The descending-by-value rule applies only to asesores, not to modelos.)  
- No per-torre bands on this item. Project Bands are by project only.

**Structure (three-level)**

**Compact Hero**  
Must use the exact same size, card style, typography, spacing, and visual weight as the Compact Hero in Items 1 and 2.  
Title: always “Todos los Proyectos”.  
One large number for the currently selected series (Reserva or PCV, controlled by the existing toggle). Do not show both series at once.  
No dual titles. No percentages. No ratios.

**Expanded Hero**  
The four project cards to the right of the Compact Hero. Height matches the Compact Hero.  
Each card is one vertical column per torre, the total for the selected series across modelos. This is the only place the torre total appears. Torre names sit horizontally under the columns. A bare letter and a “Torre …” name show as T plus that letter, with no space: “A” and “Torre A” both display as “TA”. A name that is not a torre letter, such as Principal, stays as written. Shared y-scale across the four cards. Zeros remain visible. Numbers stay on or above every column.  
Santa Elena does not use a column per house. Its Expanded Hero is one column per modelo, A and B, including a zero when that modelo has no sale in the selected series.

**Project Bands**  
One Project Band per project, in canonical order.  
- Left: Project KPI Card. Project name + a compact alphabetical list of that project’s modelos, each with its unit count for the selected series. Zeros remain visible. No percentages. Do not show both series at once. Do not show only the aggregate total.  
- Right: Project Detail Card. Each block is one modelo. Inside it, one vertical column per torre, including zeros. Benestare’s modelo B therefore shows five columns, TA through TE, and those columns sum to that modelo’s total. The torre total itself is not repeated here; it is the Expanded Hero column. Modelo names under the blocks use the same “A+” spelling as before. Numbers stay on or above every column. Shared y-scale across all Project Detail Cards. Zeros remain visible.  
  A torre is one building even when the two source tables spell it differently. `v_rv_units_full.tower_name` says “Torre A”. `ventas.dim_tower.name` often says “A”. Those are the same torre, and the sale is counted on that one column.  
  Display follows the Odoo 19 convention. A bare letter and a “Torre …” name show as T plus that letter, with no space: “A” and “Torre A” both display as “TA”. A name that is not a torre letter, such as Principal, stays as written.  
  Santa Elena’s Project Detail Card stays one column per modelo, A and B. It does not repeat the Expanded Hero.  
- Fixed, consistent band height; no large empty gaps.  
- **The full item fits on the page.** Compact Hero + Expanded Hero + all Project Bands must be visible together without requiring scroll beyond what Items 1 and 2 currently require. Reduce band height as needed.

**Single series at a time** (Reserva / PCV toggle)  
- The toggle is the only control on this item. It sits on its own row above the Compact Hero.  
- Toggle options: Reserva | PCV.  
- When Reserva is selected: solid columns.  
- When PCV is selected: dashed-outline columns.  
- Only one series visible at a time.  

**Category label orientation**  
Expanded Hero torre labels are horizontal, in the Odoo 19 form (“TA”, “Principal”).  
Project Detail Card modelo labels are horizontal. “PLUS” is written as “+” with no space, so “A PLUS” is shown as “A+”. Torre names inside a modelo block use the same Odoo 19 form.

**Explicit rules**  
- Numbers always visible on or above every bar. Tooltips reserved exclusively for provenance (click only; full list of contributing records).  
- Never hide zero modelos.  
- No percentages, ratios, or secondary labels under bars, next to bars, or anywhere else in this item. Only the raw counts.  
- Only one series is visible at a time, controlled by the Reserva | PCV toggle.  
- Reserva columns are solid. PCV columns use a dashed outline.  
- Orientation is vertical columns only.  
- No extra titles or explanatory text beyond the minimum section label.  
- No Torre filter. No Modelo filter.  
- No static files as data sources. All numbers from the live database.  
- Anti-clutter: readable numbers, no truncated labels, consistent bar height. Denser than Items 1–2 is acceptable; the current wall of mini-charts is not.

This replaces the previous incorrect “stacked inventory composition” language. Inventory status stacks belong exclusively to Item 6.

Chart interactions (click a bar) may filter a detail table lower on the same page. No item requires navigation to another URL.

### 4.3 Deferred future option (not shown on screen, not designed today)

The dual-gate concept (recibo publicado + promesa firmada) is recorded only as a possible future improvement. It is to be considered only after all current items on both lists have been confirmed satisfactory by the CEO and Managers. The app must not display or force this definition.

---

## 5. Other Department Command Centers (high-level)

Cobros, Créditos, and Entregas follow the same pattern. All items from each of those Operativo checklists are 0-click graphics on a single scrollable page. Their visual specs can be refined after Ventas is validated. Mercadeo is specified as built in §5.1. It is the Performance Ads page, not the Operativo checklist.

**Note on Créditos:** The SSOT received from the CEO mixes Créditos + Entregas + Legal (Internal) + Legal (External). For this SDD the entire mush is placed under Créditos. Untangling the workflows is deferred until after this SDD is designed and built.

### 5.1 Mercadeo

**Status**  
The page on screen as of 20 November 2026 is the Marketing Manager’s Performance Ads report. It does not follow the Ventas three-level names (Compact Hero, Expanded Hero, Project Bands, Member Columns). It does not yet draw the Operativo checklist in `docs/Checklists-Authoritative.md`. Those checklist rows stay the CEO’s list. They are not bands on this page.

**What the page is**  
One scroll. The Item Title is “Performance Ads”. The left rail has that one item and scrolls to it. The page ends at the Campañas band. Performance S, Reporte Reservas, Integración de Inventarios, Presupuesto Mercadeo, and Página 1 are not on the page and are not in the rail.

**Filters**  
Project pills: Todos, Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena. Puerta Abierta is an account in the report, not a pill.  
Periodo: Este mes, Mes anterior, Este trimestre, Este año, Personalizado. The stored default is Personalizado, 1 January 2026 through 31 July 2026.  
Asesor is on the bar and offers only Todos. It does not change the report.  
Restablecer returns the stored default. The period text and the freshness stamp share one line. Freshness reads the grain’s loaded-through date.

**Column rule**  
Every split row uses the same two columns. The left column is the width of the three KPI cards. The right column takes the remaining width. A card that is alone takes the full width.

**Bands, top to bottom**

1. **KPI cards and Detalle de Pauta.** Three stacked cards on the left: Alcance, Importe gastado, Clientes potenciales. Each card shows a compact figure and the exact figure under it. Importe gastado is United States dollars. On the right, Detalle de Pauta is a table: Cuenta, Alcance, Impresiones, Clientes potenciales, Frecuencia, plus a Total row. Accounts are ordered by alcance, largest first. Frecuencia is blank on the total.

2. **Costo por lead, then Tendencia del costo por cliente potencial.** Left: vertical columns, one per account that has a cost, ordered by that cost, largest first. The number sits on the column, in dollars and cents. Account names are turned 90 degrees. Long names are shortened only here: Bosque Las Tapias reads “Bosque”, Puerta Abierta reads “P. Abierta”. Right: one line of the daily cost and a dashed straight trend. The horizontal axis marks the first of each month with its short name. Both cards are 210px tall.

3. **Clientes potenciales por día, then Clientes potenciales por proyecto.** Left: vertical columns, one per weekday that has leads in the period, ordered by leads, largest first. Day names are turned 90 degrees. The chart is 220px tall, a quarter more than the 176px chart it replaced, so those names fit. Right: a pie of leads by account, in the project colors, with the count and the share beside it. The pie fills the remaining width.

4. **Inversión en pauta, then Gestión de presupuesto.** Left: vertical columns of dollars spent, ordered by spend, largest first. The full account name is turned 90 degrees. The column keeps the same narrow width as the KPI cards. Right: one line of spend by month. Month names are written out. The line fills the remaining width. The card title stays “Gestión de presupuesto”.

5. **Campañas.** One card, full width. A treemap of campaigns by leads. A campaign with no leads in the period is omitted. The tile shows the short campaign name and the lead count when the tile is large enough. Tile color is the account color.

**Account colors**  
Benestare `#0d2041`, Boulevard 5 `#3d6f8f`, Bosque Las Tapias `#0573b0`, Santa Elena `#1a4a68`, Puerta Abierta `#94a3b8`. The pie and the treemap use these colors. Costo por lead, Clientes potenciales por día, and Inversión en pauta are drawn in navy.

**Numbers**  
The report is United States dollars, as the Meta export states them. This page does not convert those dollars to quetzales.  
The figures are summed from the compiled grain in `src/lib/mercadeo/performance-ads-grain.ts` (loaded through 4 August 2026). That grain is a snapshot carried in the repository. It is not `mercadeo.ad_day`, and it is not a live query. This conflicts with the hard rule in §2 until the page reads the database. Do not treat the grain as the allowed source for any new chart.

**Empty period**  
When the selected pills and dates contain no accounts, the page says “Sin pauta en el periodo.”

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
- Canonical three-level pattern locked (see section 3): Compact Hero → Expanded Hero (Project Summary Columns) → Project Bands (each with Project KPI Card + Project Detail Card containing Member Columns). Projects in fixed canonical order. Asesores descending by value; modelos alphabetical. Fixed-size Project Detail Card for Member Columns (squeeze to fit, no wrap/scroll). Numbers always visible; tooltips only for provenance. NINGUNO pill added to project filters. Remove legacy Total › Proyecto › Asesor breadcrumb.

---

## 10. Living Documents

This SDD is one of three living documents that guide future development:

- `docs/SDD-Department-Command-Centers.md` (this document)
- `docs/General-Rules-and-Principles.md` (merged General Rules + key principles + freshness/filter rules)
- `docs/Checklists-Authoritative.md` (verbatim original Operativo and Directivo lists, marked as SSOT)

Historical multi-page, secondary-menu, and outdated design documents are to be removed or rewritten so they no longer contradict the Command Center model.
