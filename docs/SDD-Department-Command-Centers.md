# SDD — Department Command Centers

**Software Design Document**  
**Scope:** All five fixed main sections — Mercadeo, Ventas, Cobros, Créditos, Entregas  
**Validation audience:** CEO and Managers  
**Goal:** Each department is a single, vertically scrollable command center of high-density Recharts and D3 visualizations that cover every required Operativo checklist item with 0 clicks.  
**Date:** 10 November 2026  
**Ventas scroll order locked:** 21 November 2026. Operativo items 1 through 14, top to bottom. See §4.1.  
**23 November 2026:** Item 3 stays per torre. Item 7 follows §4.1.4. Item 8 follows §4.1.5. Item 9 follows §4.1.10. Item 10 follows §4.1.6. Item 11 follows §4.1.7. Item 12 follows §4.1.8. Item 14 follows §4.1.9. The Ventas project pills include NINGUNO.
**23 November 2026 (later):** Canonical three-level pattern is now mandatory for all 14 Ventas items. Previous exceptions for Items 3, 4, and 13 are removed. Item 9 keeps the canonical three-level names. Its content is locked in §4.1.10.
**23 November 2026 (17:09 GT):** Items 5 and 6 are locked as the reference examples of the canonical three-level pattern. DO NOT BREAK their layout, hierarchy, labels, or measurement rules. Every item other than Item 9 must eventually match this reference. Residual flexibility is removed. Item 9 is locked in §4.1.10. Item 9 hard rule persists: never read or display ‘Won’, ‘Ganado’, or ‘Tasa de ganados’; the last stage is always Reserva.
**24 November 2026:** These Item 9 rulings supersede the 23 November 2026 decision that the eight stages are ordinary Member Columns inside each Project Detail Card and that a nested visualization is not an option. Item 9 keeps the canonical three-level names (Compact Hero, Expanded Hero, Project KPI Cards, Project Detail Cards). The Compact Hero, always titled “Todos los Proyectos”, shows the Standardized Leakage KPI on the combined 8-stage funnel. The Expanded Hero shows that combined funnel. Each Project KPI Card shows that project’s Standardized Leakage KPI. The Z-score pill on the Compact Hero and on each Project KPI Card is green, amber, or red, per §4.1.10. The meaning of each color is not written on the screen. Each Project Detail Card shows that project’s 8-stage funnel, with the conversion percentage between the columns. The last stage is Reserva. The screen never shows “Won”, “Ganado”, or “Tasa de ganados”. The full lock is §4.1.10.

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
4. **Progressive disclosure via visual hierarchy, not text.** Top of page = most important graphics. Middle = explanatory pipelines and comparisons. Lower = supporting detail that is still fully visible without a click. Interactions (click a chart element) may filter a table lower on the same page. On the Ventas page this principle does not move an item. Positions are the locked scroll order in §4.1.
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
On 18–19 November 2026 we lost multiple hours because the same visual region was referred to by different names in prompts versus in the local agent’s interpretation. The resulting mis-edits forced repeated rework. To prevent that class of failure permanently, the following names are now the **only** official terms for these regions. They must be used in every future prompt, SDD update, and code comment that refers to layout. No synonyms, no “the left card”, no “the top section”, no quadrant labels. These ten names are required for every one of the 14 Ventas items. No exception language is allowed, except the explicit lock on Items 5 and 6 and the Item 9 lock in §4.1.10. Item 9 keeps these names. On that item the Compact Hero and each Project KPI Card hold the Standardized Leakage KPI, and the Expanded Hero and each Project Detail Card hold the 8-stage funnel.

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
| **Compact Hero** | The single left-hand card inside the Hero Band. | Always titled “Todos los Proyectos”. Holds the overall number(s) for the current filter scope. Item 9 holds the Standardized Leakage KPI (§4.1.10). |
| **Expanded Hero** | The single right-hand card inside the Hero Band. | Contains the Project Summary Columns. Item 9 contains the combined 8-stage funnel (§4.1.10). |
| **Project Summary Columns** | The individual project columns that live inside the Expanded Hero. | Canonical project order. Item 9 does not draw these; its Expanded Hero is the combined funnel (§4.1.10). |
| **Project Bands** | The set of horizontal bands that appear below the Hero Band, one per project. | |
| **Project KPI Cards** | The left-hand cards inside each Project Band. | Each shows that project’s aggregate number. Item 9 shows that project’s Standardized Leakage KPI and does not show “X Reserva” (§4.1.10). |
| **Project Detail Cards** | The right-hand cards inside each Project Band. | Contain the Member Columns. Item 9 contains that project’s 8-stage funnel (§4.1.10). |
| **Member Columns** | The individual secondary/tertiary columns (asesor, modelo, torre, etc.) that live inside each Project Detail Card. | Asesores: sorted descending by the metric. Modelos: always alphabetical. Other members follow the item’s locked rule. Item 9’s Project Detail Card is that project’s 8-stage funnel (§4.1.10). |

**Rules**
- These ten names are required for every one of the 14 Ventas items and for every other department item on this cadence. No synonyms. Exception language is not allowed, except the explicit lock on Items 5 and 6 and the Item 9 lock in §4.1.10. Any prompt or specification that uses a different label for one of these regions is incorrect and must be rewritten before it is sent to an agent. Item 9 does not rename the regions. Its Compact Hero and each Project KPI Card hold the Standardized Leakage KPI. Its Expanded Hero and each Project Detail Card hold the 8-stage funnel.
- The title inside the Compact Hero is always “Todos los Proyectos”.
- Every Ventas item uses these ten names. Synonyms are not allowed. Exception language is not allowed, except the explicit lock on Items 5 and 6 and the Item 9 lock in §4.1.10.
- Canonical project order, never-hide-zeros rule, and all other existing principles continue to apply unchanged.
- When a new visual region appears that does not fit the table above, it must be added to this table before it is referenced in any prompt.

---

## 3. Canonical Three-Level Pattern (locked for all 14 Ventas items and the same cadence for other departments)

Every checklist item answers three successive questions with graphics, on a single page, with zero clicks in the default view:

1. **Compact Hero** — large number on the left, always titled “Todos los Proyectos”. Item 9’s Compact Hero is the Standardized Leakage KPI on the combined 8-stage funnel (§4.1.10).
2. **Expanded Hero** — graphical breakdown immediately to the right of the Compact Hero (Project Summary Columns for Ventas). Item 9’s Expanded Hero is the combined 8-stage funnel (§4.1.10).
3. **Project Bands** — one band per member of the previous level (one per project), each containing a Project KPI Card on the left and a Project Detail Card on the right (Member Columns, e.g. asesor bars, inside the Project Detail Card). Item 9’s Project KPI Card is that project’s Standardized Leakage KPI. Item 9’s Project Detail Card is that project’s 8-stage funnel (§4.1.10).

The pattern is mandatory for all 14 Ventas Operativo items. The same three-level cadence is mandatory for the other departments. No Ventas item may omit the Hero Band or the Project Bands. No item may rename the ten official names. Item 9 keeps Compact Hero, Expanded Hero, Project KPI Cards, and Project Detail Cards. Its Expanded Hero is the combined 8-stage funnel, and its Project Detail Cards are per-project 8-stage funnels (§4.1.10).

**Rules that lock this pattern**
- **The full item fits on the page.** Compact Hero + Expanded Hero + all Project Bands must be visible together without requiring scroll beyond what Items 1 and 2 currently require. Reduce band height and empty space as needed to achieve this. This is a hard constraint.
- **Vertical category labels when density requires it.** When a chart has many categories whose names are longer than the available column width, rotate the category labels to a fully vertical orientation (90 degrees). This is the only reliably truncation-free solution observed across multiple attempts. Horizontal or angled (e.g. 45°) labels truncate under realistic densities. Apply this technique wherever the same constraint appears. Item 9 is the exception. Its stage names sit horizontally under the bars and are not rotated (§4.1.10).


- Numbers are always visible on or directly above every bar / column / segment. Never rely on a tooltip for the value itself. Tooltips are reserved exclusively for provenance (click only).
- Projects are always shown in the canonical order: Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena (order by project Date of Birth). This order is fixed and is not sorted by the metric.
- **Default ordering rule (when a specific order has not been locked for an item):** Respect canonical order for projects. Then order towers alphabetically. Then order modelos alphabetically. This applies wherever a specific order for a specific item has not been ruled.
- Member Columns of asesores are always sorted descending by the metric value so the eye lands on the largest contributors first. Modelos are always alphabetical. Other member types follow the item’s locked rule.
- The Project Detail Card that holds the Member Columns (asesor bars, etc.) has a fixed size. Columns are squeezed as necessary so that every member fits in a single row with no wrap, no overflow, and no internal scroll.
- A selected project, torre, modelo, or asesor with a zero metric stays visible. Do not hide empty rows or zero values inside the current selection. Hiding zeros creates stark visual inconsistencies between periods and damages transparency (a core value of the project). Managers need to see the absence.
- Visual separation is provided by the existing card structure. No extra headings or explanatory text. If the page grows long, a very light background or slightly tighter grouping under the total block is sufficient.
- The legacy “Total › Proyecto › Asesor” breadcrumb/label is dead weight and must be removed.
- Project filter pills sit above the content: TODOS + the four projects in canonical order + a NINGUNO pill on the right. Selecting NINGUNO deselects all projects. NINGUNO is pressed whenever the selection is empty, including after the last project pill is turned off. A project with a zero metric stays on screen only while that project is selected. With NINGUNO, project cards are not drawn, and any hero that remains shows zero. The page must remain stable and not crash or go blank. Default state is TODOS (full three-level view, 0-click). TODOS is the only all-projects state. This row is live on the Ventas command center as of 23 November 2026. Another department page that uses the same pills gets NINGUNO when that page is the work in front of us.

This pattern is mandatory for all 14 Ventas Operativo items. Items 5 and 6 are the locked reference examples of this pattern. Every other item except Item 9 must eventually match their structure, density, and use of the ten official names. Do not break Items 5 and 6. Items 1 through 14, other than Item 9, each use the Hero Band (Compact Hero on the left, always titled “Todos los Proyectos”, and Expanded Hero on the right with Project Summary Columns) and the Project Bands (one band per project in canonical order, each with a Project KPI Card on the left and a Project Detail Card on the right containing Member Columns). Item 9 uses those same region names. Its Compact Hero and each Project KPI Card show the Standardized Leakage KPI, and its Expanded Hero and each Project Detail Card show the 8-stage funnel (§4.1.10). The ten official names in §2.1 are required on every item. No synonym is allowed.

Items 5 and 6 are the locked reference examples (§4.2.1 and §4.1.3). Every other item except Item 9 must match their structure: Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing ordinary Member Columns. Item 7 keeps the trajectory drawer in §4.1.4. Item 8 keeps the U | Q toggle in §4.1.5, on the same row Item 5 uses. Item 10 keeps that same toggle and a case-list drawer in §4.1.6. Item 11 keeps that same toggle in §4.1.7, with no drawer. Item 12 keeps a case-list drawer in §4.1.8, with no toggle. Item 14 keeps that same toggle and an application-list drawer in §4.1.9. Item 3 uses torre as ordinary Member Columns (§4.1.2). Item 4 uses Fuente as ordinary Member Columns (§4.1.11). Item 13 uses tipo de referido as ordinary Member Columns (§4.1.12). Item 9 places the combined 8-stage funnel in the Expanded Hero and that project’s 8-stage funnel in each Project Detail Card, and the Standardized Leakage KPI on the Compact Hero and on each Project KPI Card (§4.1.10). Other departments follow the same three-level graphics-first cadence adapted to their own hierarchy.

---

## 4. Shared Layout Pattern (applied to every department page)

Each department page is a vertical stack of visual bands. Exact content varies by department; the pattern does not.

- **Band A — Primary graphics (0 clicks):** The most important visualizations that answer the department’s core question. Charts, not rows of KPI cards.
- **Band B — Analytical and control graphics (0 clicks):** Remaining checklist items as charts, small multiples, or compact visual summaries. Still fully visible without navigation.
- **Band C — Operative detail (optional filter target):** Tables or lists that can be filtered by clicking a chart element above. Not required for checklist coverage.

A locked scroll order is the stack. Band A and Band B do not move an item once that order is locked. Ventas is locked to Operativo items 1 through 14, top to bottom (§4.1, 21 November 2026).

Optional lightweight filters (Periodo, Proyecto, Asesor, Torre) sit in a compact header. Default state already shows the useful view (current month / all projects). Freshness stamp is always visible, on the same line as the period description.

After the filter controls and the period + freshness line, mark the transition into page content with a line break and an elegant horizontal separator.

---

## 4. Ventas Command Center

**Replaces** the previous collection of sub-pages. Single vertically scrollable page. Primary language is the Reserva-level data and analytics the users already use.

All 14 Operativo checklist items are 0-click. Every one of them must use the canonical three-level pattern in §3 and the ten official names in §2.1. Item 9’s regions are filled as locked in §4.1.10.

### 4.1 Scroll order (locked 21 November 2026)

The Ventas page is one vertical stack. Top to bottom, the order is the Operativo checklist. Confirmed 21 November 2026. This list is the page. An item stays in its numbered position. Every item in this list must use the canonical three-level pattern. Item 9 follows §4.1.10.

The left rail scrolls to these same items in this same order.

| # | Checklist item | Visualization |
|---|----------------|---------------|
| 1 | Ventas totales | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). No horizontal rule between the Hero Band and the Project Bands. The gap between the Hero Band and the Project Bands is 12px, the same as Item 2. Each Project Band is 156px, the Item 2 band height. The bands do not stretch to fill the viewport. |
| 2 | Objetivos de ventas | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.1). |
| 3 | Status de ventas - Déficit o excedente versus fecha de cierre, por proyecto y por torre | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). Lifetime cumulative pace. Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing ordinary Member Columns by torre. See precise spec below (§4.1.2). |
| 4 | Ventas por canales | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing ordinary Member Columns by Fuente. See precise spec below (§4.1.11). |
| 5 | Split de ventas por modelo y por torre | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.2.1). Project Summary Columns: one column per torre; Santa Elena one column per modelo. Single series at a time via the Reserva/PCV toggle. |
| 6 | Inventario general: Vendido, congelado, disponible | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.3). Status rows on the left. Expanded Hero: one vertical status stack per torre, scaled inside each project. Project Detail Card: one status-row block per torre, all of those bars on one shared scale. |
| 7 | Valor de proyecto - trazabilidad de precios por valorización y descuentos | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.4). Snapshot of current list value and discount. A click on an Expanded Hero project column opens that project’s price trajectory in a drawer. |
| 8 | Desistimientos - Reembolsos, retención de reembolso y valorización de proyectos | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.5). One series at a time, U or Q, by project and by torre. |
| 9 | Tasa de conversión | Canonical three-level names (Compact Hero + Expanded Hero + Project Bands with Project KPI Cards + Project Detail Cards). See precise spec below (§4.1.10). Compact Hero: Standardized Leakage KPI on the combined 8-stage funnel of all active and selected projects. Expanded Hero: that combined funnel, numbers on or above the columns, percentages between the columns. Each Project KPI Card: that project’s Standardized Leakage KPI (bottleneck stage and a colored Z-score pill; do not show “X Reserva”). The pill color is green, amber, or red (§4.1.10). The color’s meaning is not written on the screen. Each Project Detail Card: that project’s 8-stage funnel, conversion percentage between the columns, stage names horizontal under the bars, no rotation and no truncation. Asesor changes the Compact Hero, the Expanded Hero funnel, and every Project Band. The last stage is Reserva. The screen never shows “Won”, “Ganado”, or “Tasa de ganados”. |
| 10 | Control de descuentos | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.6). One series at a time, U or Q, by project and by torre. A click on an Expanded Hero project column opens that project’s discounted sales in a drawer. |
| 11 | Control de subidas de precios | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.7). One series at a time, U or Q, by project and by torre. |
| 12 | F&F y casos especiales | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.8). Count of marked sales by project and by torre. A click on an Expanded Hero project column opens that project’s cases in a drawer. |
| 13 | Control Referidos | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing ordinary Member Columns by tipo de referido. See precise spec below (§4.1.12). This item is not a filter on the canales chart. |
| 14 | Control de promociones | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.9). One series at a time, U or Q, by project and by torre. A click on an Expanded Hero project column opens that project’s promotions in a drawer. |

**All 14 items (23 November 2026, later; Item 9 superseded 24 November 2026).** Every item in the scroll-order table uses the canonical three-level names (Compact Hero, Expanded Hero, Project Bands, Project KPI Cards, Project Detail Cards). Items other than Item 9 place Project Summary Columns in the Expanded Hero and Member Columns in the Project Detail Cards. Item 9 is locked in §4.1.10: the Compact Hero and each Project KPI Card show the Standardized Leakage KPI, and the Expanded Hero and each Project Detail Card show the 8-stage funnel. Item 14 is specified in §4.1.9 and the page follows that spec. Items 7, 8, 10, 11, and 12 are specified and the page follows those specs. Item 3 is specified in §4.1.2. Item 4 is specified in §4.1.11. Item 13 is specified in §4.1.12.

The precise specs below keep their existing subsection numbers (§4.1.1, §4.1.2, §4.1.3, §4.1.4, §4.1.5, §4.1.6, §4.1.7, §4.1.8, §4.1.9, §4.1.10, §4.1.11, §4.1.12, §4.2.1). Those numbers are not a second order. §4.1.11 is Item 4. §4.1.12 is Item 13.

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

**Decision**  
23 November 2026 (later). This item must use the canonical three-level pattern. The Hero Band is required: Compact Hero on the left, always titled “Todos los Proyectos”, and Expanded Hero on the right with Project Summary Columns. One Project Band per project is required: Project KPI Card on the left and Project Detail Card on the right containing ordinary Member Columns by torre.

**Critical correction:** The concept is the life of the project, not a monthly or period view. The Hero Band is required. The secondary dimension is per torre, drawn as ordinary Member Columns inside each Project Detail Card.

**Reconfirmed 23 November 2026.** The secondary level stays per torre. The Operativo checklist row still says “por asesor”. That wording stays as written. Torre stays the ordinary Member Columns dimension. This spec is the requirement.

**Start date**  
First month that appears in each project’s Ritmo de Ventas CSV.

**Fecha de cierre (placeholder)**  
Linear expected trajectory to a date 24 months after each project’s first CSV month. Replace with the real fecha de cierre when provided. Per-torre Member Columns inherit the project’s start and placeholder close for now.

**Unit totals (live availability)**  
- Boulevard 5: 298  
- Benestare: 282  
- Bosque Las Tapias: 234 (Torre B is 100 % Congelado / not available for normal sale; the 7 sold units are F&F exceptions)  
- Santa Elena: 11  

**What is shown**  
Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing ordinary Member Columns. One Project Band per project, in canonical order.

**Compact Hero**  
Title: always “Todos los Proyectos”.  
Cumulative Reservas and cumulative PCV for the current project-pill scope, and the variance versus the expected cumulative as of today. Both numbers are visible. Semantic color only for the variance (deficit/surplus).

**Expanded Hero**  
Project Summary Columns in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
Each column is that project’s lifetime pace: cumulative Reservas, cumulative PCV, and the variance versus the expected cumulative as of today. The numbers are always visible on or directly above the column. A project at zero stays visible.

**Project Bands**  
One Project Band per project.  
- Project KPI Card (left): project name, current cumulative Reservas, current cumulative PCV, and variance versus the expected cumulative as of today.  
- Project Detail Card (right): ordinary Member Columns by torre. Each column is that torre’s cumulative Reservas, with cumulative PCV and the variance versus the expected cumulative as of today on or above the column. Per-torre columns inherit the project’s start and placeholder close. A torre at zero stays visible. Torre B of Bosque Las Tapias is shown and flagged as Congelado (F&F only). Columns are squeezed to fit: no wrap, no overflow, no internal scroll.

**Single-tower rule:** If a project has only one torre, that torre is the one Member Column inside its Project Detail Card. Do not draw a second Project Band for that torre. Boulevard 5 has only one torre: one Member Column.

**Explicit rules**  
- The Hero Band is required for all projects in scope. The Compact Hero title is “Todos los Proyectos”.  
- Project Detail Cards contain ordinary Member Columns by torre.  
- Single-tower rule: one Member Column inside the Project Detail Card (Boulevard 5).  
- Both series (Reservas and PCV) are shown.  
- Ignore the negative “Ritmo de Ventas” numbers in the CSVs until someone explains them.  
- Numbers always visible. Tooltips only for provenance.  
- Zero or fully Congelado torres remain visible.  
- Placeholder fecha de cierre is clearly labeled as temporary.

This item uses the canonical three-level pattern. It is a lifetime pace view: Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing ordinary Member Columns by torre.

#### 4.1.3 Precise visual spec — Item 6: Inventario general

**EXEMPLARY — DO NOT BREAK**  
This is the reference implementation of the canonical three-level pattern. Do not change layout, hierarchy, labels, or measurement rules unless a new decision is recorded here.  
(23 November 2026, 17:09 GT)  
(24 November 2026) Locked ruling for the Project Detail Cards on this item. This supersedes any prior description of those cards, including status-row blocks, a scale shared across every Project Detail Card, and scroll inside the card. The Hero Band is unchanged.

**Item Title**  
Inventario general

**Data source**  
Current unit status counts from `v_rv_units_full`. Same view and the same status enum the Disponibilidad page uses. No period filter. No sales-event tables. No static files.

**Statuses**  
Exactly these five, with the Disponibilidad labels and `UNIT_STATUS_COLORS`:  
Congelado (`FROZEN`), Disponible (`AVAILABLE`), En revisión (`SOFT_HOLD`), Reservado (`RESERVED`), Vendido (`SOLD`).  
That is the order on every row list and the order of a stack from bottom to top. A status with a count of zero is still drawn. The total is the sum of the five. It is a sixth figure only on the Compact Hero. It is not a sixth status, and it is not a segment in any stack.

**Color**  
Taken from `UNIT_STATUS_COLORS`, the same mapping as the Disponibilidad legend and §2. This list is the mapping, not the display order:  
green = Disponible,  
orange = En revisión,  
blue = Reservado,  
purple = Congelado,  
gray = Vendido.  
Total uses navy `#0d2041`.

**Filters**  
Project pills only. Periodo, asesor, and modelo do not change this item. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up.

**Structure**  
Full canonical three-level pattern. On the Ventas page the item is `#inventario-general`. Locked scroll order (§4.1, 21 November 2026): sixth, after Split de ventas por modelo y por torre and before Valor de proyecto. Projects in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena), limited to the pills that are on. A selected project with no units stays visible.

The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. Each Project Band is fixed at 156px, the Item 2 band height. The Compact Hero card uses the Item 1 / Item 2 card chrome: 8px radius, 1px border, padding 12px 14px, title `calc(26px * 0.75)` at weight 700. Project KPI cards use the Item 1 project-row padding, 10px 12px. The sum is shorter than Item 2’s hero plus four bands, so the item does not ask for more page scroll than Items 1 and 2. A Project Detail Card has no internal scroll. Its columns are squeezed to fit inside the fixed band.

**Row language**  
The Compact Hero and each Project KPI Card use the same row: status name on the left, a horizontal track, a colored bar, and the integer at the right in that status color. The track is the gray ground. The bar never carries a number inside it. A zero count keeps the row, draws a bar of length zero, and prints 0. The Project Detail Card does not use these rows.

On the Compact Hero and on each Project KPI Card the five bars are a waterfall. Each bar’s length is that status count divided by that card’s own total, and each bar starts where the previous status ended. The Compact Hero then adds Total: a navy bar that fills the track when the total is above zero. A Project KPI Card does not add Total.

**Compact Hero**  
Title: always “Todos los Proyectos”.  
The five status counts and the total, for the current project-pill scope. The six figures replace the single hero number of Items 1 and 2; the card box does not.

**Expanded Hero**  
The right-hand side of the Hero Band. Inside it, one card per project in scope, in canonical project order. The card height matches the Compact Hero. The only heading in the card is the project name.

Each card is one vertical stacked column per torre. The stack runs bottom to top in the status order above. A zero count stays in that stack as a segment of height zero, so the color order does not change. Torre labels use the Odoo short form from §4.2.1 (“TA”, “Principal”) and sit centered under the column. Torres are alphabetical by that label (`es`). Santa Elena uses the same rule: one column per its torre.

Each project card has its own vertical scale. The tallest torre in that card, measured by the sum of the five statuses, fills the plot. The other torres in the same card use that scale. Cards do not share a scale with each other.

A count is drawn inside its segment only when the segment is tall enough and wide enough to hold the digits. A segment that cannot hold them omits that number and keeps the colored segment. There is no number column beside the stacks, no legend, no percentages, and no horizontal bar in this card.

**Project Bands**  
One band per project in scope, in canonical project order. Band height stays 156px.  
- Project KPI Card: project name and the five status rows, on that project’s own waterfall. No total row.  
- Project Detail Card: must display one stacked column per torre, exactly as the Expanded Hero does. One vertical stacked column per torre of that project, with status segments. The stack runs bottom to top in the status order above. Numbers are visible on or above the segments when space allows. Zeros are zero-height segments. Torre labels use the Odoo short form (“TA”, “Principal”, and the same labels as the Expanded Hero). Columns are squeezed to fit: no wrap, no overflow, no internal scroll. The scale is shared within the card. The band does not grow.

**Where this item differs from §3**  
This section wins for Item 6 on measurement only. The item uses the canonical three-level pattern and the ten official names. The Expanded Hero does not put a number on or above every segment. Its scale is per project. Each Member Column in the Project Detail Card is one vertical stacked column for one torre, the same treatment as the Expanded Hero. A number is visible on or above a segment when space allows. A zero is a zero-height segment. Columns are squeezed to fit: no wrap, no overflow, no internal scroll. The scale is shared within the card.

**Explicit rules**  
- A click opens provenance and nothing else: `v_rv_units_full` (`status`, `project_slug`, `tower_name`, `unit_number`), the status counted, the active project pills, and the units in that count. Hover does not open it.  
- No percentages. No connectors. No explanatory text. Headings are the Item Title, “Todos los Proyectos”, the project names, and the torre labels.  
- No period, asesor, or modelo filter on this item.  
- The total is a sixth figure on the Compact Hero only.

#### 4.1.4 Precise visual spec — Item 7: Valor de proyecto

**Item Title**  
Valor de proyecto

**Decision**  
23 November 2026. This item follows the canonical three-level pattern. The page implements this spec.

**The number**  
The snapshot sums the current list price of every unit in scope. The amount is `rv_units.price_list`, the same quetzal amount the stock read exposes as `list_price_amount` when `list_price_currency` is GTQ. `valor_inmueble` is a different column and is not added. A list price in dollars is not converted and is not added. A unit with no quetzal list price adds nothing. When the scope has no quetzal list price, the figure is 0.

Every status is in the sum. The snapshot is the current stock, not the units sold in the period.

**Discount**  
The discount is the sum of applied discount amounts in quetzales for units in the same scope: `ventas.fact_discount.amount_gtq`, joined through the deal to the unit. No period. A missing row adds nothing. When the scope has no discount rows, the figure is 0. The percent is that sum divided by the quetzal list-price sum of the same scope. When the list-price sum is 0, the percent is omitted. The percent is an annotation under the amount. It is not the primary label.

**Data source**  
Live rows only. List price from `rv_units`. Discounts from `ventas.fact_discount`. The trajectory from `rv_price_history` (`effective_date`, `new_price_avg`) for the clicked project. No static files. `ventas.fact_price_rise` belongs to Item 11 and is not this trajectory. The current sales-and-desistimiento line is not this trajectory.

**Filters**  
Project pills only. Periodo, asesor, and modelo do not change this item. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up.

**Structure**  
Full canonical three-level pattern. The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. The gap between the Hero Band and the Project Bands is 12px. Each Project Band is 156px. The gap between Project Bands is 8px. The sum stays inside the scroll of Items 1 and 2.

**Compact Hero**  
Title: always “Todos los Proyectos”.  
One large number: the quetzal list-price sum for the current project-pill scope.  
Under it: the discount amount in quetzales, and the percent when the list-price sum is above zero. That pill is centered on the horizontal axis of the card. The project name stays at the start of the card. Semantic color only on the discount. Above zero uses the deficit color. Zero uses the muted color.  
No second title. Both numbers are visible.

**Expanded Hero**  
Project Summary Columns in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
Each column is that project’s quetzal list-price sum. The number is always visible on or directly above the column.  
One shared y-scale for the four columns. A project with a zero sum stays visible.

**Trajectory drawer**  
A click on a project column in the Expanded Hero opens one right-side drawer over the page. The drawer holds the price-trajectory line for that project and nothing else. The heading is the project name. The close control reads “Cerrar”. Closing it returns to the same snapshot, unmoved and unshifted. A click on another project column replaces the open drawer. A second drawer is never open.  
The line is `rv_price_history.new_price_avg` by `effective_date` for the clicked project. A row that names a torre does not add a second line. The number is visible on the line. Quetzales. No conversion. When the project has no history rows, the drawer still opens and the line has no points.  
The trajectory is not on the page until that click.

**Project Bands**  
One band per project in scope, canonical order.  
- Project KPI Card (left): project name, that project’s quetzal list-price sum, and its discount under the sum. The discount pill is centered on the horizontal axis of the card, the same way as the Compact Hero. The color rule matches the Compact Hero.  
- Project Detail Card (right): fixed-size card of Member Columns by torre. Torres are alphabetical by the Odoo short label (“TA”, “Principal”, and the same labels Item 6 uses). Each column is that torre’s quetzal list-price sum, number on or above the column. One shared y-scale across every Project Detail Card. A torre with a zero sum stays visible. Columns are squeezed to fit: no wrap, no overflow, no internal scroll.

**Explicit rules**  
- Numbers are always visible on or above every column.  
- A click on a number opens provenance and nothing else: the units in that sum, each with project, torre, unit number, amount, and currency. Hover does not open it. A click on the Expanded Hero project column opens the trajectory drawer and does not open provenance.  
- Projects stay in canonical order. Torres stay alphabetical by short label.  
- Zeros stay visible.  
- The list-price sum is the primary label. The discount percent is only the annotation inside the discount pill. On the Compact Hero and on every Project KPI Card, that pill is horizontally centered.  
- Headings are the Item Title, “Todos los Proyectos”, the project names, the torre labels, and, inside the drawer, the project name and “Cerrar”.  
- No period, asesor, or modelo filter on the snapshot.  
- The default view is the hierarchical snapshot. The drawer is one click away and one click to close.

#### 4.1.5 Precise visual spec — Item 8: Desistimientos

**Item Title**  
Desistimientos

**Decision**  
23 November 2026. This item follows the canonical three-level pattern. The page implements this spec.

**The series**  
One series is visible at a time.  
- U is the count of cases.  
- Q is the sum of `value_gtq` on those cases, in quetzales. A null value adds nothing. When the scope has no quetzal value, Q is 0.  
A non-quetzal deal value is not converted and is not added.  
Retención and reembolso are not columns on these rows. They are not a second series, and they are not drawn as zero beside Q.

**A case**  
A row of `ventas.v_desistimiento`: a sale whose `lost_time` is set. The case is in the snapshot when `lost_on` falls inside the Periodo. No static files.

**Filters**  
Project pills apply. Periodo applies. Asesor, modelo, and motivo do not change this item. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up.

**Toggle**  
The only control on this item besides the project pills. It sits on its own row above the Compact Hero, the same placement as Item 5. The options read U | Q. The default is U.  
U draws solid columns. Q draws dashed-outline columns. Only the selected series is visible.

**Structure**  
Full canonical three-level pattern. The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. The gap between the Hero Band and the Project Bands is 12px. Each Project Band is 156px. The gap between Project Bands is 8px. The sum stays inside the scroll of Items 1 and 2.

**Compact Hero**  
Title: always “Todos los Proyectos”.  
One large number: the selected series for the current project-pill scope. U is an integer. Q is quetzales.  
No second title. No percentages. The number is visible.

**Expanded Hero**  
Project Summary Columns in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
Each column is that project’s total for the selected series. The number is always visible on or directly above the column.  
One shared y-scale for the four columns. A project with a zero total stays visible.

**Project Bands**  
One band per project in scope, canonical order.  
- Project KPI Card (left): project name and that project’s total for the selected series.  
- Project Detail Card (right): fixed-size card of Member Columns by torre. Torres are alphabetical by the Odoo short label (“TA”, “Principal”, and the same labels Item 6 uses). Each column is that torre’s value for the selected series, number on or above the column. One shared y-scale across every Project Detail Card. A torre with a zero value stays visible. Columns are squeezed to fit: no wrap, no overflow, no internal scroll.  
A case that names no torre stays in the project total and in the hero. It does not open a torre column.

**Explicit rules**  
- Numbers are always visible on or above every column.  
- A click on a number opens provenance and nothing else: the cases in that figure, each with project, torre, unit, `lost_on`, and `value_gtq`. Hover does not open it.  
- Projects stay in canonical order. Torres stay alphabetical by short label.  
- Zeros stay visible.  
- No percentages.  
- Headings are the Item Title, “Todos los Proyectos”, the project names, the torre labels, and the toggle labels U and Q.  
- The default view is the hierarchical snapshot on U.

#### 4.1.6 Precise visual spec — Item 10: Control de descuentos

**Item Title**  
Control de descuentos

**Decision**  
23 November 2026. This item follows the canonical three-level pattern. The page implements this spec.

**The series**  
One series is visible at a time.  
- U is the count of discounted sales.  
- Q is the sum of `ventas.fact_discount.amount_gtq` on those sales, in quetzales. A null amount adds nothing. When the scope has no quetzal amount, Q is 0.  
A non-quetzal amount is not converted and is not added. The rate is not a label.

**A discounted sale**  
A row of `ventas.v_sale` whose `sale_on` falls inside the Periodo and that has at least one `ventas.fact_discount` row on the same deal. U counts the deal once. Q sums every discount line on that deal. Two lines on one sale are one U and one summed amount. `fact_discount` has no date. The Periodo applies through `sale_on`. No static files.

**Filters**  
Project pills apply. Periodo applies. Asesor, modelo, and discount type do not change this item. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up.

**Toggle**  
The only control on this item besides the project pills. It sits on its own row above the Compact Hero, the same placement as Items 5 and 8. The options read U | Q. The default is U.  
U draws solid columns. Q draws dashed-outline columns. Only the selected series is visible.

**Structure**  
Full canonical three-level pattern. The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. The gap between the Hero Band and the Project Bands is 12px. Each Project Band is 156px. The gap between Project Bands is 8px. The sum stays inside the scroll of Items 1 and 2.

**Compact Hero**  
Title: always “Todos los Proyectos”.  
One large number: the selected series for the current project-pill scope. U is an integer. Q is quetzales.  
No second title. No percentage as the primary label. The number is visible.

**Expanded Hero**  
Project Summary Columns in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
Each column is that project’s total for the selected series. The number is always visible on or directly above the column.  
One shared y-scale for the four columns. A project with a zero total stays visible.

**Drawer**  
A click on a project column in the Expanded Hero opens one right-side drawer over the page. The drawer lists the discounted sales that make up that project’s total. Each row shows the unit, `sale_on`, and the summed quetzales. The heading is the project name. The close control reads “Cerrar”. Closing it returns to the same snapshot, unmoved and unshifted. A click on another project column replaces the open drawer. A second drawer is never open.  
A sale that names no unit still appears in the list.  
This drawer follows the Item 7 pattern. The list is not on the page until that click.

**Project Bands**  
One band per project in scope, canonical order.  
- Project KPI Card (left): project name and that project’s total for the selected series.  
- Project Detail Card (right): fixed-size card of Member Columns by torre. Torres are alphabetical by the Odoo short label (“TA”, “Principal”, and the same labels Item 6 uses). Each column is that torre’s value for the selected series, number on or above the column. One shared y-scale across every Project Detail Card. A torre with a zero value stays visible. Columns are squeezed to fit: no wrap, no overflow, no internal scroll.  
A sale that names no torre stays in the project total, in the hero, and in the drawer. It does not open a torre column.

**Explicit rules**  
- Numbers are always visible on or above every column.  
- A click on a number opens provenance and nothing else: the discount lines in that figure, each with project, torre, unit, `sale_on`, and `amount_gtq`. Hover does not open it. A click on the Expanded Hero project column opens the drawer and does not open provenance.  
- Projects stay in canonical order. Torres stay alphabetical by short label.  
- Zeros stay visible.  
- No percentage is a primary label.  
- Headings are the Item Title, “Todos los Proyectos”, the project names, the torre labels, the toggle labels U and Q, and, inside the drawer, the project name and “Cerrar”.  
- The default view is the hierarchical snapshot on U.

#### 4.1.7 Precise visual spec — Item 11: Control de subidas de precios

**Item Title**  
Control de subidas de precios

**Decision**  
23 November 2026. This item follows the canonical three-level pattern. The page implements this spec.

**The series**  
One series is visible at a time.  
- U is the count of price-rise events.  
- Q is the sum of `difference_amount` on the events whose `currency` is GTQ. A null amount adds nothing. When the scope has no quetzal increase, Q is 0.  
A dollar increase is not converted and is not added to Q. The event still counts in U.  

**An event**  
One row of `ventas.fact_price_rise`. The grain is one unit on one `effective_on`, so a unit that rose twice in the Periodo counts twice. The event is in the snapshot when `effective_on` falls inside the Periodo. No static files.

**Filters**  
Project pills apply, through the torre’s project. Periodo applies. Asesor and modelo do not change this item. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up.

**Toggle**  
The only control on this item besides the project pills. It sits on its own row above the Compact Hero, the same placement as Items 5, 8, and 10. The options read U | Q. The default is U.  
U draws solid columns. Q draws dashed-outline columns. Only the selected series is visible.

**Structure**  
Full canonical three-level pattern. The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. The gap between the Hero Band and the Project Bands is 12px. Each Project Band is 156px. The gap between Project Bands is 8px. The sum stays inside the scroll of Items 1 and 2.

**Compact Hero**  
Title: always “Todos los Proyectos”.  
One large number: the selected series for the current project-pill scope. U is an integer. Q is quetzales.  
No second title. No percentage as the primary label. The number is visible.

**Expanded Hero**  
Project Summary Columns in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
Each column is that project’s total for the selected series. The number is always visible on or directly above the column.  
One shared y-scale for the four columns. A project with a zero total stays visible.

**Project Bands**  
One band per project in scope, canonical order.  
- Project KPI Card (left): project name and that project’s total for the selected series.  
- Project Detail Card (right): fixed-size card of Member Columns by torre. Torres are alphabetical by the Odoo short label (“TA”, “Principal”, and the same labels Item 6 uses). Each column is that torre’s value for the selected series, number on or above the column. One shared y-scale across every Project Detail Card. A torre with a zero value stays visible. Columns are squeezed to fit: no wrap, no overflow, no internal scroll.  
An event whose torre name is missing stays in the project total and in the hero. It does not open a torre column.

**Explicit rules**  
- Numbers are always visible on or above every column.  
- A click on a number opens provenance and nothing else: the events in that figure, each with project, torre, unit, `effective_on`, `difference_amount`, and `currency`. Hover does not open it.  
- Projects stay in canonical order. Torres stay alphabetical by short label.  
- Zeros stay visible.  
- No percentage is a primary label.  
- Headings are the Item Title, “Todos los Proyectos”, the project names, the torre labels, and the toggle labels U and Q.  
- The default view is the hierarchical snapshot on U.

#### 4.1.8 Precise visual spec — Item 12: F&F y casos especiales

**Item Title**  
F&F y casos especiales

**Decision**  
23 November 2026. This item follows the canonical three-level pattern. The page implements this spec.

**The number**  
One series: the count of cases. There is no toggle and no second series. A null amount is not a count. No percentage.

**A case**  
One row of `ventas.fact_case_mark` on a sale in `ventas.v_sale` whose `sale_on` falls inside the Periodo. The grain is one deal and one case type, so a sale with two marks counts twice. The mark has no date of its own. The Periodo applies through `sale_on`. The reason is the case-type name. The amount, when the sale has `value_gtq`, is that quetzal value. It is shown on the case. It is not a second total. No static files.

**Filters**  
Project pills apply. Periodo applies. Asesor, modelo, and case type do not change this item. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up. Unmarked sales are not drawn.

**Structure**  
Full canonical three-level pattern. The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. The gap between the Hero Band and the Project Bands is 12px. Each Project Band is 156px. The gap between Project Bands is 8px. The sum stays inside the scroll of Items 1 and 2.

**Compact Hero**  
Title: always “Todos los Proyectos”.  
One large number: the count of cases for the current project-pill scope.  
No second title. No percentage. The number is visible.

**Expanded Hero**  
Project Summary Columns in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
Each column is that project’s count. The number is always visible on or directly above the column.  
One shared y-scale for the four columns. A project with a zero count stays visible.

**Drawer**  
A click on a project column in the Expanded Hero opens one right-side drawer over the page. The drawer lists the cases that make up that project’s count. Each row shows the unit, `sale_on`, the case-type name, and `value_gtq` when the sale has one. The heading is the project name. The close control reads “Cerrar”. Closing it returns to the same snapshot, unmoved and unshifted. A click on another project column replaces the open drawer. A second drawer is never open.  
A case that names no unit still appears in the list.  
This drawer follows the Item 10 pattern. The list is not on the page until that click.

**Project Bands**  
One band per project in scope, canonical order.  
- Project KPI Card (left): project name and that project’s count.  
- Project Detail Card (right): fixed-size card of Member Columns by torre. Torres are alphabetical by the Odoo short label (“TA”, “Principal”, and the same labels Item 6 uses). Each column is that torre’s count, number on or above the column. One shared y-scale across every Project Detail Card. A torre with a zero count stays visible. Columns are squeezed to fit: no wrap, no overflow, no internal scroll.  
A case that names no torre stays in the project count, in the hero, and in the drawer. It does not open a torre column.

**Explicit rules**  
- Numbers are always visible on or above every column.  
- A click on a number opens provenance and nothing else: the cases in that count, each with project, torre, unit, `sale_on`, the case-type name, and `value_gtq` when present. Hover does not open it. A click on the Expanded Hero project column opens the drawer and does not open provenance.  
- Projects stay in canonical order. Torres stay alphabetical by short label.  
- Zeros stay visible.  
- No percentage is a label.  
- Headings are the Item Title, “Todos los Proyectos”, the project names, the torre labels, and, inside the drawer, the project name and “Cerrar”.  
- The default view is the hierarchical snapshot.

#### 4.1.9 Precise visual spec — Item 14: Control de promociones

**Item Title**  
Control de promociones

**Decision**  
23 November 2026. This item follows the canonical three-level pattern. The page implements this spec.

**The series**  
One series is visible at a time.  
- U is the count of promotion applications.  
- Q is the sum of `ventas.dim_deal.valor_vale_gtq` on those applications. A null vale adds nothing. When the scope has no vale, Q is 0.  
`valor_promocion_gtq` is not added. Pipedrive `Valor Promoción` is an enum of currency strings, not the amount. `v_sale.value_gtq` is the sale, not the promotion, and is not added. A non-quetzal vale is stored as null and is not converted.

**An application**  
One row of `ventas.v_sale` whose `sale_on` falls inside the Periodo and whose `promotion_type_id` is not the Sin dato row of `ventas.dim_promotion_type`. A sale has one promotion type, so it counts once. The name is that type’s name. The date is `sale_on`. The promotion columns have no date of their own. The amount on the application is `valor_vale_gtq` when the deal has one. A sale marked Sin dato is not drawn, including one that carries a vale. No static files. Workbook paid promotions (`Promos`, `Promoción `, `Aumento promo`) are not this item.

**Filters**  
Project pills apply. Periodo applies. Asesor, modelo, and promotion type do not change this item. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up.

**Toggle**  
The only control on this item besides the project pills. It sits on its own row above the Compact Hero, the same placement as Items 5, 8, 10, and 11. The options read U | Q. The default is U.  
U draws solid columns. Q draws dashed-outline columns. Only the selected series is visible.

**Structure**  
Full canonical three-level pattern. The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. The gap between the Hero Band and the Project Bands is 12px. Each Project Band is 156px. The gap between Project Bands is 8px. The sum stays inside the scroll of Items 1 and 2.

**Compact Hero**  
Title: always “Todos los Proyectos”.  
One large number: the selected series for the current project-pill scope. U is an integer. Q is quetzales.  
No second title. No percentage as the primary label. The number is visible.

**Expanded Hero**  
Project Summary Columns in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
Each column is that project’s total for the selected series. The number is always visible on or directly above the column.  
One shared y-scale for the four columns. A project with a zero total stays visible.

**Drawer**  
A click on a project column in the Expanded Hero opens one right-side drawer over the page. The drawer lists the applications that make up that project’s total. Each row shows the promotion-type name, `sale_on`, the unit, and `valor_vale_gtq` when the deal has one. The list is the same on U and on Q. The heading is the project name. The close control reads “Cerrar”. Closing it returns to the same snapshot, unmoved and unshifted. A click on another project column replaces the open drawer. A second drawer is never open.  
An application that names no unit still appears in the list.  
This drawer follows the Item 10 pattern. The list is not on the page until that click.

**Project Bands**  
One band per project in scope, canonical order.  
- Project KPI Card (left): project name and that project’s total for the selected series.  
- Project Detail Card (right): fixed-size card of Member Columns by torre. Torres are alphabetical by the Odoo short label (“TA”, “Principal”, and the same labels Item 6 uses). Each column is that torre’s value for the selected series, number on or above the column. One shared y-scale across every Project Detail Card. A torre with a zero value stays visible. Columns are squeezed to fit: no wrap, no overflow, no internal scroll.  
An application that names no torre stays in the project total, in the hero, and in the drawer. It does not open a torre column.

**Explicit rules**  
- Numbers are always visible on or above every column.  
- A click on a number opens provenance and nothing else: the applications in that figure, each with project, torre, unit, `sale_on`, the promotion-type name, and `valor_vale_gtq` when present. Hover does not open it. A click on the Expanded Hero project column opens the drawer and does not open provenance.  
- Projects stay in canonical order. Torres stay alphabetical by short label.  
- Zeros stay visible.  
- No percentage is a primary label.  
- Headings are the Item Title, “Todos los Proyectos”, the project names, the torre labels, the toggle labels U and Q, and, inside the drawer, the project name and “Cerrar”.  
- The default view is the hierarchical snapshot on U.

#### 4.1.10 Precise visual spec — Item 9: Tasa de conversión

**Item Title**  
Tasa de conversión

**Decision**  
24 November 2026. These rulings supersede every earlier Item 9 decision, including the 23 November 2026 ruling that the eight stages are ordinary Member Columns inside each Project Detail Card and that a nested visualization is not an option. The canonical three-level names remain: Compact Hero, Expanded Hero, Project KPI Cards, Project Detail Cards. The CEO, the Sales Manager, and the Sales Supervisor follow this item per asesor, every day, often more than once.

**Hard rules that remain**  
- The last stage is always Reserva.  
- The screen never shows “Won”, “Ganado”, or “Tasa de ganados”.  
- Never read or display those terms.  
- The eight stages are: Ingreso → Contactado → En Perfilamiento → Calificados → Cita Programada → Visita Efectiva → En Decisión → Reserva.

These are real images from the current SSOT report (Pipedrive live). Do not read or use “Won” from Pipedrive. Read and use “Reserva”. “Won” is incorrectly configured in Pipedrive, has always been incorrectly configured, and has never been used. `status` is not an input. A stored value of `won` does not add the deal to every stage and does not produce a rate. A project prefix on the SSOT report (“[BN]”, “[BLT]”, “[BLV5]”) is not part of the label. “Visita Efectiva” is that label on every project.

**A deal**  
One row of `ventas.embudo_deal` whose `add_on` falls inside the Periodo. `add_on` is the Guatemala day the deal was created. Stage history is not stored. No static files.

**Reached**  
`stage_order` is the deal’s current position, 1 through 8. The deal counts in that position and in every earlier position. It does not count in a later position. Position 1 is Ingreso. Position 8 is Reserva. The eight labels above are those eight positions.

**The percent**  
Between a stage and the next stage: the next count divided by this count, rounded to the nearest whole percent. When this count is 0, the percent is 0%. Reserva has no percent after it. The percentage sits between the vertical columns, not under them.

**Filters**  
Project pills apply. Periodo applies. Asesor applies. The asesor filter changes the Compact Hero, the Expanded Hero funnel, and every Project Band. A selected asesor limits those three to that asesor’s deals. Modelo does not change this item. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up.

**Structure**  
The canonical three-level names remain. The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. The gap between the Hero Band and the Project Bands is 12px. Each Project Band is 156px. The gap between Project Bands is 8px. The sum stays inside the scroll of Items 1 and 2.

**Hero Band**  
- Compact Hero (left, always titled “Todos los Proyectos”): displays the Standardized Leakage KPI calculated on the combined 8-stage funnel of all active and selected projects (the funnel shown in the Expanded Hero to its right).  
  Two rows, matching the second-row pill style of Item 2:  
  - Row 1: the bottleneck stage name (or “Saludable” / “Healthy / No acute bleed” when no stage crosses the significance threshold).  
  - Row 2: the Z-score in a pill, e.g. “(Z = -7.60)”. The pill is colored by the Z-score color scale below. The pill text is the Z-score only.  
- Expanded Hero (right): displays the single 8-stage funnel using the combined numbers of all active and selected projects. Numbers are always visible on or above the columns. Percentages sit between the vertical columns (not under them). Each stage name sits horizontally under its bar. The name is not rotated and it is not truncated. A name may break onto a second line. The full name stays visible.

**Project Bands**  
One Project Band per project, canonical order.  
- Project KPI Card (left): displays the Standardized Leakage KPI for that project’s own funnel. Two rows, matching the second-row pill style of Item 2:  
  - Row 1: the bottleneck stage name (e.g. “Ingreso”) or “Saludable” when no stage crosses the significance threshold.  
  - Row 2: the Z-score in a pill, e.g. “(Z = -7.60)”. The pill is colored by the Z-score color scale below. The pill text is the Z-score only.  
  Do not show “X Reserva”.  
- Project Detail Card (right): the 8-stage funnel for that project only. Numbers are always visible on or above the columns. The conversion percentage is placed between the vertical columns (exactly as the arrows sit between bars in the current Pipedrive SSOT report), not under the columns. Each stage name sits horizontally under its bar. The name is not rotated and it is not truncated. A name may break onto a second line. The full name stays visible. Zeros stay visible. A count of 0 keeps the column, draws a length of zero, and prints 0. Each card scales to its own largest count. Columns are squeezed to fit: no wrap, no overflow, no internal scroll.

One series. No legend.

**Standardized Leakage (Z-Score Bottleneck)**  
Instead of a single float, the executive shorthand KPI is a Bottleneck Tag: `[Stage Name] ([Conversion %] vs. [Portfolio Avg %])`.

Compute the one-sided Binomial Z-score for every transition \(k\) in project \(i\) against the portfolio baseline \(\bar{p}_k\):

\[
Z_{i,k} = \frac{p_{i,k} - \bar{p}_k}{\sqrt{\frac{\bar{p}_k(1 - \bar{p}_k)}{N_{i,k}}}}
\]

Selection Rule: \(\arg\min_k Z_{i,k}\) (the most negative Z-score).

Why it works: The denominator scales by \(\sqrt{N_{i,k}}\). A −10% miss on 1,449 leads is a statistical catastrophe (Z = −7.6), whereas a −44% miss on 2 leads is just noise (Z = −1.26).

Significance threshold: e.g. Z < −1.96. If no stage crosses it, the card displays “Saludable” / “Healthy / No acute bleed” rather than forcing a false alarm. The color scale does not replace this rule. Row 1 still follows the threshold. Row 2’s color follows the selected Z.

**Z-score pill color**  
The pill is colored in the UI. The sentence after each color is the meaning of that color. That sentence is not displayed: not as copy, not as a caption, not in a tooltip, and not as an accessible name. The pill’s only text is the Z-score, e.g. “(Z = -7.60)”.

A value sits in one band. The shared edges belong to the milder color. −2 is green. −3 is amber.

- Green (`#16a34a`, the same green as a surplus on this page). From 0 through −2, including both (−2 ≤ Z ≤ 0): Everyday noise. Ignore it.
- Amber (`#b45309`, the amber already used on Ventas). Below −2 through −3, including −3 (−3 ≤ Z < −2): Statistically unlikely to be luck. Investigate.
- Red (`#b91c1c`, the same red as a deficit on this page). Worse than −3 (Z < −3): Confirmed structural bleed. Fix immediately.

A Z above 0 is outside these three bands. This ruling does not assign it a color. The pill still shows the number.

Principal Note: Calculating \(\bar{p}_k\) dynamically across active projects creates a moving goalpost (if all projects degrade together, Z stays near 0). Once 1–2 quarters of clean data exist, lock \(\bar{p}_k\) to a static Target SLA or a Rolling 90-Day Historical Baseline so the card catches systemic portfolio-wide degradation, not just relative underperformance.

The Compact Hero runs this calculation on the combined 8-stage funnel of all active and selected projects. Each Project KPI Card runs it on that project’s own funnel.

**Provenance**  
A click on a count opens the deals in that count and nothing else. A click on a percent opens the deals in the next stage and nothing else. Each row shows the project, the stage, `add_on`, and the Pipedrive deal id. Hover does not open it. The close control reads “Cerrar”. There is no drawer. Tooltips only for provenance (click).

**Explicit rules**  
- The canonical three-level names remain (Compact Hero, Expanded Hero, Project KPI Cards, Project Detail Cards, etc.).  
- Project pills apply. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up.  
- Numbers always visible on or above every column. Tooltips only for provenance (click).  
- Projects stay in canonical order.  
- Zeros stay visible.  
- No static files as data sources.  
- The asesor filter changes the Compact Hero, the Expanded Hero funnel, and every Project Band.  
- Counts and percents are always visible.  
- Headings are the Item Title, “Todos los Proyectos”, the project names, and the stage labels.  
- Stage names sit horizontally under the bars. They are not rotated. They are not truncated. A name may break onto a second line. The full name stays visible.  
- No percentage is a stage name. The percent is the mark between two stages.  
- The final stage is Reserva.  
- The screen never shows “Won”, “Ganado”, or “Tasa de ganados”. Never read or display those terms.  
- The Z-score pill is green, amber, or red, per the color scale in this section. The screen shows the color and the Z-score. It does not show the meaning of the color.

#### 4.1.11 Precise visual spec — Item 4: Ventas por canales

**Item Title**  
Ventas por canales

**Decision**  
23 November 2026 (later). This item must use the canonical three-level pattern: Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing ordinary Member Columns by Fuente. The ten official names in §2.1 are required.

**Structure**  
Full canonical three-level pattern. The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. The gap between the Hero Band and the Project Bands is 12px. Each Project Band is 156px. The gap between Project Bands is 8px. The sum stays inside the scroll of Items 1 and 2.

**Compact Hero**  
Title: always “Todos los Proyectos”.  
One large number: ventas for the current scope. The number is visible.

**Expanded Hero**  
Project Summary Columns in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
Each column is that project’s ventas. The number is always visible on or directly above the column. A project at zero stays visible.

**Project Bands**  
One Project Band per project, canonical order.  
- Project KPI Card (left): project name and that project’s ventas.  
- Project Detail Card (right): ordinary Member Columns by Fuente, sorted descending by the metric. Each column is that fuente’s count. The number is on or above the column. A fuente at zero stays visible. Columns are squeezed to fit: no wrap, no overflow, no internal scroll.

**Explicit rules**  
- The canonical three-level pattern is mandatory on this item.  
- Project pills apply. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up.  
- Numbers always visible on or above every column. Tooltips only for provenance (click).  
- Projects stay in canonical order.  
- Zeros stay visible.  
- No static files as data sources.

#### 4.1.12 Precise visual spec — Item 13: Control Referidos

**Item Title**  
Control Referidos

**Decision**  
23 November 2026 (later). This item must use the canonical three-level pattern: Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing ordinary Member Columns by tipo de referido. The ten official names in §2.1 are required. This item is not a filter on the canales chart (Item 4).

**Structure**  
Full canonical three-level pattern. The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. The gap between the Hero Band and the Project Bands is 12px. Each Project Band is 156px. The gap between Project Bands is 8px. The sum stays inside the scroll of Items 1 and 2.

**Compact Hero**  
Title: always “Todos los Proyectos”.  
One large number: the referral count for the current scope. The number is visible.

**Expanded Hero**  
Project Summary Columns in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).  
Each column is that project’s referral count. The number is always visible on or directly above the column. A project at zero stays visible.

**Project Bands**  
One Project Band per project, canonical order.  
- Project KPI Card (left): project name and that project’s referral count.  
- Project Detail Card (right): ordinary Member Columns by tipo de referido, alphabetical. Each column is that tipo and its count, on or above the column. A tipo at zero stays visible. Columns are squeezed to fit: no wrap, no overflow, no internal scroll.

**Explicit rules**  
- The canonical three-level pattern is mandatory on this item.  
- This item is not a filter on Ventas por canales.  
- Project pills apply. NINGUNO leaves the Compact Hero at zero and draws no project cards. The page stays up.  
- Numbers always visible on or above every column. Tooltips only for provenance (click).  
- Projects stay in canonical order.  
- Zeros stay visible.  
- No static files as data sources.

#### 4.2.1 Precise visual spec — Item 5: Análisis de inventario: Split de ventas por modelo

**EXEMPLARY — DO NOT BREAK**  
This is the reference implementation of the canonical three-level pattern. Do not change layout, hierarchy, labels, or measurement rules unless a new decision is recorded here.  
(23 November 2026, 17:09 GT)

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

This replaces the previous incorrect “stacked inventory composition” language.

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
- [ ] Ventas items appear in the locked scroll order in §4.1: Operativo checklist 1 through 14, top to bottom. The left rail follows that order.
- [ ] All 14 Operativo checklist items are visible as charts or high-density visuals without clicking.
- [ ] All 14 Ventas Operativo items use the canonical three-level names in §2.1 and the pattern in §3. Item 9’s Compact Hero and Project KPI Cards show the Standardized Leakage KPI. Item 9’s Expanded Hero and Project Detail Cards show the 8-stage funnel (§4.1.10).
- [ ] Exception language is not allowed, except the explicit lock on Items 5 and 6 and the Item 9 lock in §4.1.10.
- [ ] Every graphical element representing an amount displays its corresponding number.
- [ ] No on-screen definition statements or forced alternative metrics.
- [ ] Control Referidos uses the canonical three-level pattern. It is its own item and is not a canales filter.
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
- Canonical three-level names are mandatory for all 14 Ventas items (see section 3 and §2.1). Items other than Item 9 use Compact Hero → Expanded Hero (Project Summary Columns) → Project Bands (each with Project KPI Card + Project Detail Card containing Member Columns). Item 9 is locked in §4.1.10: Standardized Leakage on the Compact Hero and each Project KPI Card, and the 8-stage funnel on the Expanded Hero and each Project Detail Card, with the conversion percentage between the columns. Projects in fixed canonical order. Asesores descending by value; modelos alphabetical. Fixed-size Project Detail Card (squeeze to fit, no wrap/scroll). Numbers always visible; tooltips only for provenance. NINGUNO pill added to project filters. Remove legacy Total › Proyecto › Asesor breadcrumb.

---

## 10. Living Documents

This SDD is one of three living documents that guide future development:

- `docs/SDD-Department-Command-Centers.md` (this document)
- `docs/General-Rules-and-Principles.md` (merged General Rules + key principles + freshness/filter rules)
- `docs/Checklists-Authoritative.md` (verbatim original Operativo and Directivo lists, marked as SSOT)

Historical multi-page, secondary-menu, and outdated design documents are to be removed or rewritten so they no longer contradict the Command Center model.
