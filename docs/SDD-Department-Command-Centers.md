# SDD — Department Command Centers

**Software Design Document**  
**Scope:** All five fixed main sections — Mercadeo, Ventas, Cobros, Créditos, Entregas  
**Validation audience:** CEO and Managers  
**Goal:** Each department is a single, vertically scrollable command center of high-density Recharts and D3 visualizations that cover every required Operativo checklist item with 0 clicks.  
**Date:** 10 November 2026  
**Checklist numbers:** Operativo items 1 through 14 keep their numbers. See §4.1.  
**27 November 2026:** `/ventas` and `/mercadeo` are described as the committed pages draw them. Checklist number is not scroll position. Item 3 follows §4.1.2. Item 7 follows §4.1.4. Mercadeo follows §5.1.  
**23 November 2026:** Item 3 stays per torre when the Torres filter is used. Item 7 follows §4.1.4. Item 8 follows §4.1.5. Item 9 follows §4.1.10. Item 10 follows §4.1.6. Item 11 follows §4.1.7. Item 12 follows §4.1.8. Item 14 follows §4.1.9. The Ventas project pills include NINGUNO.
**23 November 2026 (later):** Canonical three-level pattern was made mandatory for all 14 Ventas items, and the earlier exceptions for Items 3, 4, and 13 were removed. The 27 November page does not follow that for Items 3, 4, and 7. Item 3 is §4.1.2. Item 4 is not drawn. Item 7 is §4.1.4. Item 9 keeps the canonical three-level names. Its content is locked in §4.1.10.
**23 November 2026 (17:09 GT):** Items 5 and 6 are locked as reference examples of the canonical three-level names, density, and scroll budget. DO NOT BREAK Item 5 (§4.2.1) or Item 6 (§4.1.3). Item 5 is the reference for ordinary Project Summary Columns and ordinary Member Columns. Item 6’s chart geometry is §4.1.3. Items 3 and 7 do not match those columns (§4.1.2, §4.1.4). Item 4 is not drawn. Every other item matches Item 5’s ordinary columns. Item 9 is locked in §4.1.10. Item 9 hard rule persists: never read or display ‘Won’, ‘Ganado’, or ‘Tasa de ganados’; the last stage is always Reserva.
**24 November 2026:** These Item 9 rulings supersede the 23 November 2026 decision that the eight stages are ordinary Member Columns inside each Project Detail Card and that a nested visualization is not an option. Item 9 keeps the canonical three-level names (Compact Hero, Expanded Hero, Project KPI Cards, Project Detail Cards). The Compact Hero, always titled “Todos los Proyectos”, shows the Standardized Leakage KPI on the combined 8-stage funnel. The Expanded Hero shows that combined funnel. Each Project KPI Card shows that project’s Standardized Leakage KPI. The Z-score pill on the Compact Hero and on each Project KPI Card is green, amber, or red, per §4.1.10. The meaning of each color is not written on the screen. Each Project Detail Card shows that project’s 8-stage funnel, with the conversion percentage between the columns. The last stage is Reserva. The screen never shows “Won”, “Ganado”, or “Tasa de ganados”. The full lock is §4.1.10.
**24 November 2026 (later):** Item 6 is locked in §4.1.3. This supersedes every earlier description of Item 6’s Expanded Hero and Project Detail Cards, including one vertical status stack per torre, one status-row block per torre, a scale shared across Project Detail Cards, stacked columns per torre, and the cascade label placement. Item 6 keeps the ten official names. The Compact Hero and each Project KPI Card are horizontal waterfall bars. Bottom-to-top order is exactly: Congelado → Disponible → En revisión → Reservado → Vendido. No Total row. Numbers always visible, including zeros. The Expanded Hero is one card per project. Each card is five columns, left to right: Congelado, Disponible, En revisión, Reservado, Vendido. One column is that status summed across the project’s torres. The label under the column is the 25 November 2026 ruling. Each card’s ceiling is its own tallest column. Each Project Detail Card is five status blocks in that same left-to-right order. Inside a block, one column per torre that has units in the project. The status label sits under the row, per that same ruling. The torre short name sits under the column. The torre columns in a block add up to that status’s hero column. Zeros remain visible. A project with no such torre keeps the five blocks and draws no column. Columns are squeezed to fit: no wrap, no overflow, no internal scroll. Project Detail Cards do not share a scale. Each card’s scale is its tallest status-by-torre cell. Other items do not copy this geometry.
**25 November 2026 (later):** This corrects only the Item 6 status labels. It supersedes CONG, DISP, EN_R, RESE, and VEND. Those codes are not printed. On the Expanded Hero, the label under each column is exactly the first letter of the status name, and it is not shortened further: Congelado prints C, Disponible prints D, En revisión prints E, Reservado prints R, and Vendido prints V. On each Project Detail Card, the label under a status block is the longest prefix of that status’s full name that fits on one line inside the block. The names are Congelado, Disponible, En revisión, Reservado, and Vendido. The full name is printed when it fits. Letters drop from the end. When the block is narrower than the first letter, that label is blank. The label does not wrap, does not overflow the block, and does not add an ellipsis. The waterfall still prints the full status name. The bars, the scales, and the clicks are unchanged. §4.1.3 is the lock.

---

## 1. Purpose and Architectural Pivot

The application previously treated checklist items as isolated sub-pages. This forced navigation and under-utilized visualizations.

The required lists are checklists of information that must appear as clear graphics or charts on the department page itself. Sub-page structure is eliminated for the main flows. What matters is that each required item is visible as a purposeful visualization with 0 clicks.

**Fixed constraints**
- Main sections and order remain unchanged: Mercadeo → Ventas → Cobros → Créditos → Entregas.
- Do not invent new top-level navigation.
- All existing sub-sections are re-thought: their content becomes modular visual components on the parent department page. `/ventas` is that page. `/ventas/[section]` still opens GlanceView. `/mercadeo` is the scroll in §5.1, and its five section URLs redirect to anchors on that scroll.

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

**Note:** The project owner feels unsure about the purple. Exploring the replacement of purple with another non-traffic-light hue is not hard-out-of-scope. Item 6 does not use that exploration. Its five status colors stay as locked in §4.1.3, including purple for Congelado.
7. **Single source of truth.** Same page for executive and operative users. Executives stop at the upper charts; operatives scroll.
8. **Anti-clutter.** Managers have consistently criticized “too cluttered” and “too much text.” Do not add explanatory captions, definition statements, or redundant labels. Every graphical element that represents an amount must still display its corresponding number (bars, columns, points, segments). Data labels on charts are required; surrounding prose is not.
9. **No conversational-question titles.** Chart titles are descriptive and concise, or omitted when the visual is self-evident.
10. **Freshness.** Freshness stamp is always visible, placed per the General Rules (same line as period description, same font weight, not bold, not its own row).
11. **Provenance on click.** Every number displayed in the UI that represents a metric, amount, count, percentage, or ratio (including data labels on charts, hero values, and table cells) must display a tooltip with full provenance when the user clicks that number. Hover is not required. Full provenance includes: (a) source system and specific table/field (or equivalent), (b) exact calculation or aggregation formula/rule used, (c) active filters applied, and (d) when the number is a count or aggregate, the full list of contributing records (not a sample). The tooltip is the only place definitional or calculation detail appears; it does not add static text to the page. Numbers themselves are always visible on or directly above the graphical element; the tooltip is reserved exclusively for provenance. Item 6 is the exception on placement: each waterfall integer sits at the right of its row. On the Expanded Hero the status total sits above its column. On a Project Detail Card the status × torre count sits above its column (§4.1.3). On those two regions the column is the button. Those positions are the numbers. The tooltip still carries provenance only.

12. **HARD RULE — No static files as data sources.** It is forbidden to use CSV, XLSX, or any other static file as a source for a band, chart, or graph. Numbers come from the live database. Static files may sit in the repository as reference. They are not read to fill the UI.

`/mercadeo` is the current exception. It reads the four snapshots named in §5.1. Those files are compiled from `public/mercadeo/performance.html`. They are not a license to add another static source. `/ventas` is not part of this exception.

**Cursor agent prompt rules (reference)**  
Every prompt sent to a Cursor agent that operates on the repository must begin with the full block from `artifacts/Cursor-Agent-Repository-Boundary-and-Safety-Rules.md`. That file is the authoritative source for repository boundary, safety rules, and the prohibition on local tests, servers, and browsers. Do not use only the shortened “no local server” ending.


---

## 2.1 Mandatory Visual Nomenclature (locked)

**Why this exists and why it is mandatory**  
On 18–19 November 2026 we lost multiple hours because the same visual region was referred to by different names in prompts versus in the local agent’s interpretation. The resulting mis-edits forced repeated rework. To prevent that class of failure permanently, the following names are now the **only** official terms for these regions. They must be used in every future prompt, SDD update, and code comment that refers to layout. No synonyms, no “the left card”, no “the top section”, no quadrant labels. These ten names are required for the Ventas items that use a left/right Hero Band. Items 3 and 7 do not (§4.1.2, §4.1.4). Item 6 and Item 9 keep the names and fill them as locked. No other exception language is allowed. Item 9 keeps these names. On that item the Compact Hero and each Project KPI Card hold the Standardized Leakage KPI, and the Expanded Hero and each Project Detail Card hold the 8-stage funnel. Item 6 keeps these names. On that item the Compact Hero and each Project KPI Card hold the five horizontal waterfall bars. The Expanded Hero holds one card per project, five status columns left to right. Each Project Detail Card holds five status blocks left to right, with one torre column inside each block (§4.1.3).

Research basis (dashboard and data-visualization literature):
- “Hero” / “Hero Row” / “Hero KPI strip” is the established term for the top band that holds the primary number and its immediate breakdown.
- “KPI card” is the standard name for a card whose primary job is to display one or a very small set of key numbers.
- “Band” / “Row” is the common term for a horizontal grouping of related cards.
- “Small multiples” (Tufte) / facets / panels describe the repeated identical columns that appear inside both the Expanded Hero and the Project Detail Cards.
- “Compact Hero” is deliberately novel. Its lack of prior use in the literature or the codebase is the reason it was retained: it cannot be confused with any existing term.

**The ten mandatory names**

| Official name | What it is | Notes |
|---------------|------------|-------|
| **Item Title** | The heading of the checklist item (e.g. “Split de ventas por modelo y por torre”). | On `/ventas` this is the `h2` at the top of the item. Item 6’s heading is “Composición del inventario por estado y por torre”. Item 7’s heading is “Valorización del proyecto”. |
| **Page** | The entire vertically scrollable content area that belongs to one checklist item. | One Item per Page. |
| **Hero Band** | The top horizontal band of the Page. Contains the Compact Hero on the left and the Expanded Hero on the right. | Matches the widely used “Hero Row”. |
| **Compact Hero** | The single left-hand card inside the Hero Band. | Always titled “Todos los Proyectos”. Holds the overall number(s) for the current filter scope. Item 9 holds the Standardized Leakage KPI (§4.1.10). Item 6 holds five horizontal waterfall bars, with no Total row (§4.1.3). |
| **Expanded Hero** | The single right-hand card inside the Hero Band. | Contains the Project Summary Columns. Item 9 contains the combined 8-stage funnel (§4.1.10). Item 6 contains one project card per project. Each card is five status columns, left to right, one status summed across the project’s torres (§4.1.3). |
| **Project Summary Columns** | The individual project columns that live inside the Expanded Hero. | Canonical project order. Item 9 does not draw these; its Expanded Hero is the combined funnel (§4.1.10). Item 6 does not draw these. Its Expanded Hero is one project card per project, each with five status columns (§4.1.3). |
| **Project Bands** | The set of horizontal bands that appear below the Hero Band, one per project. | |
| **Project KPI Cards** | The left-hand cards inside each Project Band. | Each shows that project’s aggregate number. Item 9 shows that project’s Standardized Leakage KPI and does not show “X Reserva” (§4.1.10). Item 6 shows that project’s five horizontal waterfall bars, with no Total row (§4.1.3). |
| **Project Detail Cards** | The right-hand cards inside each Project Band. | Contain the Member Columns. Item 9 contains that project’s 8-stage funnel (§4.1.10). Item 6 contains five status blocks, left to right, with one torre column inside each block (§4.1.3). |
| **Member Columns** | The individual secondary/tertiary columns (asesor, modelo, torre, etc.) that live inside each Project Detail Card. | Asesores: sorted descending by the metric. Modelos: always alphabetical. Other members follow the item’s locked rule. Item 9’s Project Detail Card is that project’s 8-stage funnel (§4.1.10). Item 6’s Project Detail Card is five status blocks. Its torre columns sit inside each status block (§4.1.3). |

**Rules**
- These ten names are required for the Ventas items that use a left/right Hero Band. Items 3 and 7 do not use that band (§4.1.2, §4.1.4). Mercadeo does not use these names (§5.1). No synonyms. Exception language is not allowed, except those two items, the lock on Items 5 and 6, and the Item 9 lock in §4.1.10. Any prompt or specification that uses a different label for one of these regions is incorrect and must be rewritten before it is sent to an agent. Item 9 does not rename the regions. Its Compact Hero and each Project KPI Card hold the Standardized Leakage KPI. Its Expanded Hero and each Project Detail Card hold the 8-stage funnel. Item 6 does not rename the regions. Its Compact Hero and each Project KPI Card hold the five horizontal waterfall bars. Its Expanded Hero holds one card per project, five status columns left to right. Each Project Detail Card holds five status blocks left to right, with one torre column inside each block (§4.1.3).
- The title inside the Compact Hero is always “Todos los Proyectos”.
- The Ventas items that use a left/right Hero Band use these ten names. Items 3 and 7 do not (§4.1.2, §4.1.4). Synonyms are not allowed on the items that use the names. Item 6’s lock is §4.1.3. Item 9’s lock is §4.1.10.
- Canonical project order, never-hide-zeros rule, and all other existing principles continue to apply unchanged.
- When a new visual region appears that does not fit the table above, it must be added to this table before it is referenced in any prompt.

---

## 3. Canonical Three-Level Pattern (Ventas items that use a left/right Hero Band)

Every checklist item answers three successive questions with graphics, on a single page, with zero clicks in the default view:

1. **Compact Hero** — large number on the left, always titled “Todos los Proyectos”. Item 9’s Compact Hero is the Standardized Leakage KPI on the combined 8-stage funnel (§4.1.10). Item 6’s Compact Hero is five horizontal waterfall bars, with no Total row (§4.1.3).
2. **Expanded Hero** — graphical breakdown immediately to the right of the Compact Hero (Project Summary Columns for Ventas). Item 9’s Expanded Hero is the combined 8-stage funnel (§4.1.10). Item 6’s Expanded Hero is one project card per project, and each project card is five status columns, left to right, one status summed across the project’s torres (§4.1.3).
3. **Project Bands** — one band per member of the previous level (one per project), each containing a Project KPI Card on the left and a Project Detail Card on the right (Member Columns, e.g. asesor bars, inside the Project Detail Card). Item 9’s Project KPI Card is that project’s Standardized Leakage KPI. Item 9’s Project Detail Card is that project’s 8-stage funnel (§4.1.10). Item 6’s Project KPI Card is that project’s five horizontal waterfall bars. Item 6’s Project Detail Card is five status blocks, left to right, with one torre column inside each block (§4.1.3).

The pattern is mandatory for the Ventas Operativo items that still use a left/right Hero Band. Items 3 and 7 do not. Each of those two is one full-width container titled “Todos los Proyectos”, then one full-width band per project (§4.1.2, §4.1.4). Mercadeo does not use these names (§5.1). No item that uses the ten names may rename them. Item 9 keeps Compact Hero, Expanded Hero, Project KPI Cards, and Project Detail Cards. Its Expanded Hero is the combined 8-stage funnel, and its Project Detail Cards are per-project 8-stage funnels (§4.1.10). Item 6 keeps those same names. Its Compact Hero and each Project KPI Card are the waterfall. Its Expanded Hero is one card per project, five status columns left to right. Each Project Detail Card is five status blocks left to right, with one torre column inside each block (§4.1.3).

**Rules that lock this pattern**
- **The full item fits on the page.** Compact Hero + Expanded Hero + all Project Bands must be visible together without requiring scroll beyond what Items 1 and 2 currently require. Reduce band height and empty space as needed to achieve this. This is a hard constraint.
- **Vertical category labels when density requires it.** When a chart has many categories whose names are longer than the available column width, rotate the category labels to a fully vertical orientation (90 degrees). This is the only reliably truncation-free solution observed across multiple attempts. Horizontal or angled (e.g. 45°) labels truncate under realistic densities. Apply this technique wherever the same constraint appears. Item 9 is the exception. Its stage names sit horizontally under the bars and are not rotated (§4.1.10). Item 6 is the exception. Its torre labels sit horizontally under the columns and are not rotated (§4.1.3).


- Numbers are always visible on or directly above every bar / column / segment. Never rely on a tooltip for the value itself. Tooltips are reserved exclusively for provenance (click only). Item 6 keeps every number visible. On its waterfall, the integer sits at the right of the row. On the Expanded Hero and on each Project Detail Card, the integer sits above the column (§4.1.3).
- Projects are always shown in the canonical order: Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena (order by project Date of Birth). This order is fixed and is not sorted by the metric.
- **Default ordering rule (when a specific order has not been locked for an item):** Respect canonical order for projects. Then order towers alphabetically. Then order modelos alphabetically. This applies wherever a specific order for a specific item has not been ruled.
- Member Columns of asesores are always sorted descending by the metric value so the eye lands on the largest contributors first. Modelos are always alphabetical. Other member types follow the item’s locked rule.
- The Project Detail Card that holds the Member Columns (asesor bars, etc.) has a fixed size. Columns are squeezed as necessary so that every member fits in a single row with no wrap, no overflow, and no internal scroll.
- A selected project, torre, modelo, or asesor with a zero metric stays visible. Do not hide empty rows or zero values inside the current selection. Hiding zeros creates stark visual inconsistencies between periods and damages transparency (a core value of the project). Managers need to see the absence.
- Visual separation is provided by the existing card structure. No extra headings or explanatory text. If the page grows long, a very light background or slightly tighter grouping under the total block is sufficient. Item 6 has no Total row and no total block (§4.1.3).
- The legacy “Total › Proyecto › Asesor” breadcrumb/label is dead weight and must be removed.
- Project filter pills sit above the content: TODOS + the four projects in canonical order + a NINGUNO pill on the right. Selecting NINGUNO deselects all projects. NINGUNO is pressed whenever the selection is empty, including after the last project pill is turned off. A project with a zero metric stays on screen only while that project is selected. With NINGUNO, project cards are not drawn, and any hero that remains shows zero. The page must remain stable and not crash or go blank. Default state is TODOS. TODOS is the only all-projects state. This row is on `/ventas`. `/mercadeo` uses the same pill component and does not pass NINGUNO (§5.1).

This pattern is mandatory for the Ventas items that use a left/right Hero Band. Items 3 and 7 do not (§4.1.2, §4.1.4). Item 4 is not drawn. Mercadeo does not use it (§5.1). Items 5 and 6 are locked. Do not break Item 5 (§4.2.1) or Item 6 (§4.1.3). Item 5 is the reference for ordinary Project Summary Columns and ordinary Member Columns. Item 6 is the reference for the ten official names, the density, and the scroll budget. Item 6’s chart geometry is the waterfall, the Expanded Hero’s five status columns, and the Project Detail Card’s five status blocks, in §4.1.3. Other items do not copy that geometry. Items other than Items 3, 6, 7, and 9 each use the Hero Band (Compact Hero on the left, always titled “Todos los Proyectos”, and Expanded Hero on the right with Project Summary Columns) and the Project Bands (one band per project in canonical order, each with a Project KPI Card on the left and a Project Detail Card on the right containing Member Columns). Items 3 and 7 are the full-width bands in §4.1.2 and §4.1.4. Item 6 uses those same region names. Its Compact Hero and each Project KPI Card are five horizontal waterfall bars, with no Total row. Its Expanded Hero is one project card per project, and each project card is five status columns, left to right. Each Project Detail Card is five status blocks, left to right, with one torre column inside each block (§4.1.3). Item 9 uses those same region names. Its Compact Hero and each Project KPI Card show the Standardized Leakage KPI, and its Expanded Hero and each Project Detail Card show the 8-stage funnel (§4.1.10). The ten official names in §2.1 are required on every item. No synonym is allowed.

Items 5 and 6 stay locked (§4.2.1 and §4.1.3). Every item other than Items 3, 6, 7, and 9 matches Item 5: Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing ordinary Member Columns. Item 3 is the lifetime pace in §4.1.2. Item 7 is the value trajectory in §4.1.4. Item 8 keeps the U | Q toggle on its own row under the title (§4.1.5). Item 10 keeps that toggle and a case-list drawer in §4.1.6. Item 11 keeps that toggle in §4.1.7, with no drawer. Item 12 keeps a case-list drawer in §4.1.8, with no toggle. Item 14 keeps that toggle and an application-list drawer in §4.1.9. Item 3 is not ordinary torre columns (§4.1.2). Item 4 is not drawn; §4.1.11 describes the held component. Item 13 uses tipo de referido as ordinary Member Columns (§4.1.12). Item 6 places the waterfall on the Compact Hero and on each Project KPI Card, five status columns on each Expanded Hero project card, and five status blocks with torre columns on each Project Detail Card (§4.1.3). Item 9 places the combined 8-stage funnel in the Expanded Hero and that project’s 8-stage funnel in each Project Detail Card, and the Standardized Leakage KPI on the Compact Hero and on each Project KPI Card (§4.1.10). Other departments follow the same three-level graphics-first cadence adapted to their own hierarchy.

---

## 4. Shared Layout Pattern (applied to every department page)

Each department page is a vertical stack of visual bands. Exact content varies by department; the pattern does not.

- **Band A — Primary graphics (0 clicks):** The most important visualizations that answer the department’s core question. Charts, not rows of KPI cards.
- **Band B — Analytical and control graphics (0 clicks):** Remaining checklist items as charts, small multiples, or compact visual summaries. Still fully visible without navigation.
- **Band C — Operative detail (optional filter target):** Tables or lists that can be filtered by clicking a chart element above. Not required for checklist coverage.

A locked scroll order is the stack. Band A and Band B do not move an item once that order is locked. On `/ventas` the stack is the visual order in §4.1, not the checklist numbers.

Optional lightweight filters (Periodo, Proyecto, Asesor, Torre) sit in a compact header. Default state already shows the useful view (current month / all projects). Freshness stamp is always visible, on the same line as the period description.

After the filter controls and the period + freshness line, mark the transition into page content with a line break and an elegant horizontal separator.

---

## 4. Ventas Command Center

`/ventas` is one vertically scrollable page. Primary language is the Reserva-level data and analytics the users already use. `/ventas/[section]` still opens `GlanceView`. That screen is not this scroll.

The side menu is not drawn on `/ventas`. The operativo icon list for Ventas is empty, so the sidebar renders nothing.

The freshness stamp on this page reads `Datos al` plus the Guatemala calendar day of the latest `ventas.load_run.finished_at` whose `script` is `scripts/ventas/load.py`. When that row is missing, the stamp reads “Sin datos cargados”. It shares the line with the period text. The page default is Este mes, TODOS, and Asesor Todos.

Items 3 and 7 do not use the left/right Hero Band (§4.1.2, §4.1.4). Item 6’s regions are filled as locked in §4.1.3. Item 9’s regions are filled as locked in §4.1.10. Item 4 is not drawn.

### 4.1 Scroll order

Checklist numbers stay 1 through 14. They are not the top-to-bottom order of `/ventas`.

Top to bottom, as `command-center.tsx` renders it:

1. Ventas totales  
2. Objetivos de ventas  
5. Split de ventas por modelo y por torre  
6. Composición del inventario por estado y por torre  
3. Status de ventas  
7. Valorización del proyecto  
8. Desistimientos  
9. Tasa de conversión  
10. Control de descuentos  
11. Control de subidas de precios  
12. F&F y casos especiales  
13. Control Referidos  
14. Control de promociones  

Item 4, Ventas por canales, is commented out in that file and is not requested. The component remains in source.

The checklist table below keeps the numbers. The visualization column says what `/ventas` draws.

| # | Checklist item | Visualization |
|---|----------------|---------------|
| 1 | Ventas totales | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). No horizontal rule between the Hero Band and the Project Bands. The gap between the Hero Band and the Project Bands is 12px, the same as Item 2. Each Project Band is 156px, the Item 2 band height. The bands do not stretch to fill the viewport. |
| 2 | Objetivos de ventas | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.1). |
| 3 | Status de ventas - Déficit o excedente versus fecha de cierre, por proyecto y por torre | Not the left/right Hero Band. One full-width lifetime pace chart for “Todos los Proyectos”, then one full-width chart per project. Torres filter and the torre-dates button share the title row. See §4.1.2. |
| 4 | Ventas por canales | Not drawn on `/ventas`. The block is commented out. The spec in §4.1.11 describes that held component. It is not on the scroll. |
| 5 | Split de ventas por modelo y por torre | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.2.1). Project Summary Columns: one column per torre; Santa Elena one column per modelo. Single series at a time via the Reserva/PCV toggle. |
| 6 | Inventario general: Vendido, congelado, disponible | Visible heading: “Composición del inventario por estado y por torre”. On the scroll it sits after Item 5 and before Item 3. Canonical three-level names. See §4.1.3. That section is the only description of this item’s chart. Compact Hero waterfall tracks are 14px. Each Project KPI Card’s tracks are 8px. Compact Hero and each Project KPI Card: horizontal waterfall bars. Bottom-to-top order is exactly Congelado → Disponible → En revisión → Reservado → Vendido. No Total row. Numbers always visible, including zeros. Expanded Hero: one card per project. Each card is five columns, left to right: Congelado, Disponible, En revisión, Reservado, Vendido. One column is that status summed across the project’s torres. The label under the column is exactly the first letter of the status name: C, D, E, R, or V. It is not shortened further. Each card’s ceiling is its own tallest column. Each Project Detail Card: five status blocks in that same left-to-right order. Inside a block, one column per torre that has units in the project. The label under the row is the longest prefix of the full status name that fits on one line in the block. The full name is printed when it fits. Letters drop from the end. The label does not wrap and does not add an ellipsis. CONG, DISP, EN_R, RESE, and VEND are not printed. The torre short name sits under the column. The torre columns in a block add up to that status’s hero column. Zeros remain visible. A project with no such torre keeps the five blocks and draws no column. Columns are squeezed to fit: no wrap, no overflow, no internal scroll. Project Detail Cards do not share a scale. Each card’s scale is its tallest status-by-torre cell. |
| 7 | Valor de proyecto - trazabilidad de precios por valorización y descuentos | Visible heading: “Valorización del proyecto”. On the scroll it sits immediately after Item 3. Not the left/right Hero Band and not a list-price snapshot. One full-width value line for “Todos los Proyectos”, then one full-width line per project. Torres filter and the torre-dates button share the title row. See §4.1.4. |
| 8 | Desistimientos - Reembolsos, retención de reembolso y valorización de proyectos | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.5). One series at a time, U or Q, by project and by torre. |
| 9 | Tasa de conversión | Canonical three-level names (Compact Hero + Expanded Hero + Project Bands with Project KPI Cards + Project Detail Cards). See precise spec below (§4.1.10). Compact Hero: Standardized Leakage KPI on the combined 8-stage funnel of all active and selected projects. Expanded Hero: that combined funnel, numbers on or above the columns, percentages between the columns. Each Project KPI Card: that project’s Standardized Leakage KPI (bottleneck stage and a colored Z-score pill; do not show “X Reserva”). The pill color is green, amber, or red (§4.1.10). The color’s meaning is not written on the screen. Each Project Detail Card: that project’s 8-stage funnel, conversion percentage between the columns, stage names horizontal under the bars, no rotation and no truncation. Asesor changes the Compact Hero, the Expanded Hero funnel, and every Project Band. The last stage is Reserva. The screen never shows “Won”, “Ganado”, or “Tasa de ganados”. |
| 10 | Control de descuentos | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.6). One series at a time, U or Q, by project and by torre. A click on an Expanded Hero project column opens that project’s discounted sales in a drawer. |
| 11 | Control de subidas de precios | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.7). One series at a time, U or Q, by project and by torre. |
| 12 | F&F y casos especiales | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.8). Count of marked sales by project and by torre. A click on an Expanded Hero project column opens that project’s cases in a drawer. |
| 13 | Control Referidos | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing ordinary Member Columns by tipo de referido. See precise spec below (§4.1.12). This item is not a filter on the canales chart. |
| 14 | Control de promociones | Canonical three-level pattern (Compact Hero + Expanded Hero with Project Summary Columns + Project Bands with Project KPI Cards + Project Detail Cards containing Member Columns). See precise spec below (§4.1.9). One series at a time, U or Q, by project and by torre. A click on an Expanded Hero project column opens that project’s promotions in a drawer. |

**Items on the scroll (27 November 2026).** Items other than 3, 6, 7, and 9 use the canonical three-level names. Item 6 is locked in §4.1.3. Item 9 is locked in §4.1.10. Item 3 is the pace charts in §4.1.2. Item 7 is the value lines in §4.1.4. Item 4 is not on the scroll; §4.1.11 describes the held component. Items 8, 10, 11, 12, and 14 follow §4.1.5, §4.1.6, §4.1.7, §4.1.8, and §4.1.9. Item 13 follows §4.1.12.

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
25 November 2026. This item does not draw a Compact Hero or an Expanded Hero. Each Project Band is one single full-width container with no left/right split. “Todos los Proyectos” is also one single full-width container. The Item Title “Status de ventas” shares its row with the Torres filter and the torre-dates button.

**On the scroll**  
It is the fifth band, after Composición del inventario and before Valorización del proyecto. Anchor: `#status-de-ventas`.

**Critical correction**  
The concept is the life of the project, not a monthly or period view. The chart is a lifetime cumulative pace chart. It is not a column chart and not a bar chart.

**Reconfirmed 23 November 2026.** The secondary level stays per torre when the Torres filter is used. The Operativo checklist row still says “por asesor”. That wording stays as written.

**Start date**  
The first day of the earliest month that has a reserva or a PCV for that project in the live read. `public.towers.initial_date` is not this date. No CSV is read.

**Fecha de cierre**  
The expected line runs to 24 months after that start month. `public.towers.final_date` is not this date. A torre chart uses its project’s start and close. The chart does not print the word “placeholder”.

**Unit total**  
The expected line ends at the live unit count of that scope from `v_rv_units_full`. The page does not keep a fixed total per project in source.  

**What is shown**  
- One full-width unified container titled “Todos los Proyectos”. It holds the statistically correct aggregate pace chart of all projects in the current project-pill scope. This container is the Hero Band for this item. Its height is exactly Item 1’s Hero Band height: `18dvh`, minimum `calc(168px * 18 / 22)`. Overflow is hidden.  
- One full-width unified Project Band per project, in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena). There is no Project KPI Card and no Project Detail Card. The band holds that project’s pace chart. Each Project Band height is exactly Item 1’s Project Band height: `156px` (min-height 156px, max-height 156px). Overflow is hidden.  
- The gap between the Hero Band and the first Project Band is 12px. The gap between Project Bands is 8px. These are the same gaps Item 1 uses.  

**Torres filter**  
The closed control reads “Torres”. An empty choice means every torre. Choosing a torre replaces only that project’s band with that torre’s pace chart. “Todos los Proyectos” stays the sum of the projects in the pill scope. The other project bands stay on the project. Periodo and Asesor do not change this item. NINGUNO leaves the item empty. The page stays up.

**Torre-dates button**  
The same button as on Item 7 sits immediately to the right of this filter. See the control under §4.1.4. Saving a date does not move this chart. This chart does not read `initial_date` or `final_date`.

**Chart geometry (Option A locked)**  
Every chart (the “Todos los Proyectos” container and every Project Band) draws exactly these marks and no others:  
- Solid line = cumulative Reservas over time.  
- Dashed line = cumulative PCV over time.  
- Thin solid line = expected cumulative (linear to the unit total at the close date).  
- The area between the Reservas line and the expected line is filled green when Reservas is above the expected line and red when Reservas is below the expected line.  
- The current variance number sits at the right end of the chart in the same semantic color (red deficit, green surplus). There is no fourth line for variance.  

X-axis = months from the project’s start month to the close date. Default tick labels = first of each quarter. A Recharts Brush is present so the user can zoom and pan.  

The current cumulative Reserva count and the current cumulative PCV count are drawn on the last point of those lines. Zero series remain visible. When the selected torre is Torre B of Bosque Las Tapias, the band shows a button whose label is “Congelado”. A click opens “Congelada. No está en venta normal. Lo que aparece vendido son excepciones F&F.” Other torres do not show that button.

**Explicit rules**  
- No Compact Hero. No Expanded Hero. No left/right split inside any Project Band.  
- The “Todos los Proyectos” container height is exactly Item 1’s Hero Band height: `18dvh`, minimum `calc(168px * 18 / 22)`.  
- Each Project Band height is exactly Item 1’s Project Band height: `156px` (min-height 156px, max-height 156px).  
- Gaps are exactly Item 1’s gaps: 12px after the Hero Band, 8px between Project Bands.  
- “Todos los Proyectos” is one full-width container.  
- Each Project Band is one full-width container.  
- The Torres filter is on this item and on Item 7. It does not change any other item.  
- Both series (Reservas solid, PCV dashed) and the thin expected line are always shown together. No toggle.  
- Variance is the filled area plus the number at the right end. No variance line.  
- Ignore the negative “Ritmo de Ventas” numbers. They are never displayed.  
- Numbers are always visible on the chart.  
- Tooltips are reserved exclusively for provenance and open on click only. Hover does nothing.  
- Zero series remain visible.  
- The chart does not print the word “placeholder”.  
- No static file (CSV, XLSX, or any other) is a source of any displayed number, series, or count. All numbers from the live database.  
- Reuse existing card spacing and typography. Do not invent new layout primitives. Do not copy Item 6’s waterfall geometry or Item 9’s funnel geometry.

This item is a lifetime pace view. “Todos los Proyectos” is one full-width container. Each Project Band is one full-width container. The chart is three lines plus a filled variance area.

#### 4.1.3 Precise visual spec — Item 6: Inventario general

**EXEMPLARY — DO NOT BREAK**  
This is the reference implementation of the canonical three-level pattern. Do not change layout, hierarchy, labels, or measurement rules unless a new decision is recorded here.  
(23 November 2026, 17:09 GT)  
(24 November 2026, later) This section is the only chart description for Item 6. It supersedes every earlier description of the Expanded Hero and the Project Detail Cards on this item, including one vertical status stack per torre, one status-row block per torre, a scale shared across Project Detail Cards, stacked columns per torre, and the cascade label placement. (25 November 2026) The Expanded Hero and the Project Detail Cards in this section replace the 24 November reading of those two regions. That reading had both regions on one layout, blocks stacked bottom to top, and a hero column that was a status × torre count. (25 November 2026, later) CONG, DISP, EN_R, RESE, and VEND are not printed. The Expanded Hero prints the first letter of the status name. Each Project Detail Card prints the longest prefix of the full status name that fits on one line in the block. The bars are unchanged. The Compact Hero and the Project KPI Cards are horizontal waterfall bars. Summaries elsewhere in this SDD point here. They do not add a second geometry.

**Item Title**  
The visible heading is “Composición del inventario por estado y por torre”. The checklist name remains Inventario general.

**Data source**  
Current unit status counts from `v_rv_units_full`. Same view and the same status enum the Disponibilidad page uses. No period filter. No sales-event tables. No static files.

**Statuses**  
Exactly these five, with the Disponibilidad labels and `UNIT_STATUS_COLORS`:  
Congelado (`FROZEN`), Disponible (`AVAILABLE`), En revisión (`SOFT_HOLD`), Reservado (`RESERVED`), Vendido (`SOLD`).  
That sequence is the locked order. On the waterfall it runs bottom to top: Congelado is the bottom, Vendido is the top. On the Expanded Hero and on each Project Detail Card it runs left to right: Congelado is first, Vendido is last. A status with a count of zero is still drawn. There is no Total row, no sixth figure, and no navy total bar. The sum of the five counts is the waterfall denominator only. That sum is not printed. The scroll-order label “Vendido, congelado, disponible” is the checklist name. It does not drop En revisión or Reservado. The chart draws all five.

**Color**  
Taken from `UNIT_STATUS_COLORS`, the same mapping as the Disponibilidad legend. Status colors stay as locked. The §2 note about exploring a replacement for purple does not apply to this item. This list is the mapping, not a left-to-right order:  
green = Disponible,  
orange = En revisión,  
blue = Reservado,  
purple = Congelado,  
gray = Vendido.  
Every waterfall bar uses its status color. Every Expanded Hero bar uses that column’s status color: Congelado `#a855f7`, Disponible `#22c55e`, En revisión `#f59e0b`, Reservado `#3b82f6`, Vendido `#6b7280`. Every bar inside a status block uses that block’s status color, the same five. A bar is one solid color. It is not divided into the five statuses. Counts on the Expanded Hero and on a Project Detail Card are `#0d2041`.

**Filters**  
Project pills only. A change to Periodo, asesor, or modelo leaves every count, bar, column, label, and card on this item as it was. NINGUNO leaves the Compact Hero at five zeros and draws no project cards. The page stays up.

**Structure**  
The ten official names in §2.1 name the regions. On the Ventas page the item is `#inventario-general`. On the scroll it is after Split de ventas por modelo y por torre and before Status de ventas. Projects in canonical order (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena), limited to the pills that are on. A selected project with no units stays visible, with zeros. The Compact Hero waterfall track is 14px tall. Each Project KPI Card waterfall track is 8px tall.

The Hero Band uses Item 1’s height: `18dvh`, minimum `calc(168px * 18 / 22)`. Each Project Band is fixed at 156px, the Item 2 band height. The Compact Hero card uses the Item 1 / Item 2 card chrome: 8px radius, 1px border, padding 12px 14px, title `calc(26px * 0.75)` at weight 700. Project KPI cards use the Item 1 project-row padding, 10px 12px. The sum is shorter than Item 2’s hero plus four bands. The full item fits within the scroll budget of Items 1 and 2. A Project Detail Card has no internal scroll. Its columns are squeezed to fit inside the fixed band.

**Compact Hero and Project KPI Cards**  
Horizontal waterfall bars. Bottom-to-top order is exactly: Congelado → Disponible → En revisión → Reservado → Vendido. No Total row. Numbers always visible, including zeros.

The Compact Hero is titled “Todos los Proyectos”. It shows the five status counts for the current project-pill scope. Each Project KPI Card shows the project name and the same five rows for that project. Each row is the status name on the left, a gray track, a colored bar, and the integer at the right in that status color. The integer is the number. It sits at the right of the row. It does not sit on the bar, inside the bar, or above the bar. The bar never carries a number.

Each bar’s length is that status count divided by the sum of the five counts on that same card. When that sum is zero, every bar has length zero and every row prints 0. Congelado is the bottom row. Its bar starts at the left of its track. Each row above starts its bar where the bar of the row below ended. A zero count keeps the row, draws a bar of length zero, and prints 0 at the right.

**Expanded Hero**  
The Expanded Hero is the right-hand side of the Hero Band. Inside it, one project card per project in scope, in canonical project order: Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena. Those project cards are not Project Detail Cards. The cards are one horizontal row, 8px apart, equal width. Each card stretches to the hero row. A card is the project name, then a column chart that fills the rest. The card has an 8px corner radius, a 1px border in `rgba(13, 32, 65, 0.12)`, and 6px of padding on top, 4px on the sides, and 4px on the bottom. Nothing scrolls inside it. The name is 13px, weight 700, color `#0d2041`, left-aligned, and it wraps. The only heading in the card is the project name.

The chart is vertical columns only. There is no Y axis, no grid, and no legend. The baseline is a hairline, `rgba(13, 32, 65, 0.28)`. Each card draws five columns, left to right: Congelado, Disponible, En revisión, Reservado, Vendido. One column is that status, summed across the project’s torres. The initial letter of the status sits horizontally under the baseline, 11px, weight 700, `#0d2041`, centered on the column: Congelado prints C, Disponible prints D, En revisión prints E, Reservado prints R, and Vendido prints V. That label is exactly one character. It is not a measured prefix, and it is not shortened further. CONG, DISP, EN_R, RESE, and VEND are not printed. The count sits 4px above the bar, 11px, weight 700, `#0d2041`, centered. A zero prints `0` and draws no rectangle.

Bars are square-ended and capped at 22px wide, centered in the column, with 12% of the column width left as gap. The four cards do not share one vertical scale. Each card’s ceiling is its own tallest column. The Expanded Hero does not draw one column per project, and it does not draw one column per torre.

**Project Detail Cards**  
One card per project, in the same project order, top to bottom. One card fills the right column of its band. The card stretches to the 156px row. The outer shell matches the Expanded Hero cards, with two differences. There is no title inside the card. The padding is 2px on the top and sides and 0 on the bottom, so the labels sit on the bottom edge. Nothing scrolls inside it. Columns are squeezed to fit.

The card is a status-by-torre cross. It is a horizontal row of five equal-width status blocks, 8px apart, left to right: Congelado, Disponible, En revisión, Reservado, Vendido. Every block except the last has a hairline on its right, 1px `rgba(13, 32, 65, 0.12)`, inset 4px from the block’s content. The card does not draw one column per torre that stacks the five statuses, and it does not draw one status-row block per torre.

Inside a block, top to bottom:

1. A row of the project’s torre columns, equal width, 1px apart, left to right in alphabetical order of the short name. Every torre that has units in the project is in this row, including where this block’s count is zero. This row grows to fill the block above the status name.
2. That block’s status name, centered under the whole row, 11px, weight 700, `rgba(13, 32, 65, 0.75)`, one line. The printed text is the longest prefix of Congelado, Disponible, En revisión, Reservado, or Vendido that fits inside the block. The full name is printed when it fits. Letters drop from the end. When the block is narrower than the first letter, the label is blank. The label does not wrap, does not overflow the block, and does not add an ellipsis. CONG, DISP, EN_R, RESE, and VEND are not printed. The torre short name is not cut by this rule.

Inside each torre column, top to bottom:

1. A plot with 12px of headroom. Its floor is an inset hairline, the same gray as the Expanded Hero baseline.
2. That torre’s short name, 10px, weight 700, `#0d2041`, centered, 2px under the plot. A bare letter from A to E, and a name Torre plus that letter, are the same torre, written as T plus the letter, with no space: A and Torre A are one column, TA. Any other name, such as Principal, stays as written. The short name is horizontal. It is not rotated, not truncated, and not wrapped. The §3 vertical-label rule does not move these labels.

The bar grows up from that floor. It is 76% of the column width, inset 12% on each side, square-ended, filled with that status’s color. The count is 10px, weight 700, `#0d2041`, centered, and it sits 2px above the bar. A zero prints `0` two pixels above the floor and draws no bar.

These four cards do not share one scale. Each card’s scale is the tallest single status-by-torre cell. A card does not share its scale with the Expanded Hero. The sum of the five statuses is not the scale.

**Boulevard 5.** Five blocks, one per status. Each block is a single column labeled Principal, and the prefix of the status name sits under the row. The bar uses that block’s status color. Congelado, Disponible, En revisión, Reservado, and Vendido each show Principal.

**Benestare.** Five blocks, one per status. Each block is five columns, TA TB TC TD TE, and the prefix of the status name sits under the row. The bar uses that block’s status color. Each status shows TA, TB, TC, TD, TE.

**Bosque Las Tapias.** Five blocks, one per status. Each block is two columns, TB and TC, and the prefix of the status name sits under the row. The bar uses that block’s status color. Each status shows TB, TC.

**Santa Elena.** Five blocks, one per status. Each block is one column for every torre that has units in the project, left to right in alphabetical order of the short name, including where this block’s count is zero, and the prefix of the status name sits under the row. The bar uses that block’s status color. If the project has no such torre, each block has no column, the prefix of the status name still sits under the row, and the block draws no bar. Item 5’s one-column-per-modelo rule stays on Item 5.

The torre columns inside one status block add up to that status’s hero column.

**Project Bands**  
One band per project in scope, in canonical project order. Band height stays 156px. The band does not grow.  
- Project KPI Card: the horizontal waterfall specified above. No Total row.  
- Project Detail Card: the status-by-torre cross specified above.

**Cascade label placement**  
Removed. On the waterfall, the status name stays at the left of its row and the integer stays at the right. No label sits on the waterfall offset. On the Expanded Hero, the first letter of the status sits under the column and the count sits above the bar. On each Project Detail Card, the longest prefix of the status name that fits on one line sits under the row, and the torre short name sits under the column. Labels are not stepped beside or between the columns.

**Where this item differs from §3**  
This section is the chart for Item 6. It wins over §3, over §2 principle 11’s “on or directly above” placement, and over every shorter summary in this SDD. The item still uses the ten official names, the Hero Band, and the Project Bands. The Compact Hero and each Project KPI Card are the five-row waterfall, with the integer at the right of the row. The Expanded Hero is one project card per project, and each card is five status columns. Each Project Detail Card is five status blocks with one torre column inside each block. Other items do not copy this geometry. Item 5 remains their reference for ordinary columns.

**Explicit rules**  
- Status colors stay as locked: green = Disponible, orange = En revisión, blue = Reservado, purple = Congelado, gray = Vendido. On the Expanded Hero and on a Project Detail Card the hexes are Congelado `#a855f7`, Disponible `#22c55e`, En revisión `#f59e0b`, Reservado `#3b82f6`, Vendido `#6b7280`.  
- A click on a waterfall number opens provenance and nothing else. On the Expanded Hero and on a Project Detail Card, the column is the button. A click opens the list of the rows in that count and nothing else: `v_rv_units_full` (`status`, `project_slug`, `tower_name`, `unit_number`), the status counted, the active project pills, and the units in that count. Hover does not open it. The tooltip is not where the number is read.  
- No percentages. No connectors. No explanatory text. Headings are the Item Title, “Todos los Proyectos”, the project names, the status names on the waterfall, the first letter of each status on the Expanded Hero, the prefix of each status name on the Project Detail Cards, and the torre labels. CONG, DISP, EN_R, RESE, and VEND are not printed.  
- No period, asesor, or modelo effect on this item.  
- Numbers always visible, including zeros. Tooltips only for provenance (click).  
- Projects in canonical order. Torres in a Project Detail Card are alphabetical by the short name.  
- No static files as data sources.  
- The cascade label placement is removed.  
- The full item fits within the scroll budget of Items 1 and 2.

#### 4.1.4 Precise visual spec — Item 7: Valorización del proyecto

**Item Title**  
The visible heading is “Valorización del proyecto”. The checklist name remains Valor de proyecto. The heading uses the same type as Items 1, 2, 3, and 9: margin 0, color `rgba(13, 32, 65, 0.75)`, font-size `calc(26px * 0.75)`, font-weight 700, line-height 1.25. The Torres filter and the torre-dates button sit on that same row, to the right.

**On the scroll**  
It is the sixth band, immediately after Status de ventas. Anchor: `#valor-del-proyecto`.

**Decision**  
27 November 2026. This item does not draw a Compact Hero, an Expanded Hero, a list-price total, a discount, or a trajectory drawer. “Todos los Proyectos” is one full-width card. Each project is one full-width card. There is no left/right split.

The vista still loads `rv_units.price_list` and `ventas.fact_discount.amount_gtq`. The page does not draw those figures.

**What is shown**  
- One card titled “Todos los Proyectos”. Its line is the sum, on each date, of each project’s latest total up to that date. A project with no history adds 0.  
- One card per project in the pill scope, in canonical order. The card’s name is the project. Its line is that project’s running total.  
- No Project KPI Card and no Project Detail Card.

**The line**  
Each step is one row of `public.rv_price_history`. The value is `appreciation_total` when that value is present and differs from `increment_amount`. Otherwise it is `increment_amount`. The first point sets the total. Each later point adds to it. A point with no `tower_id` belongs to the project line. A point with a `tower_id` belongs to that torre and is not added to the project line.

Santa Elena’s own card keeps the stored currency. In “Todos los Proyectos” each of its values is multiplied by 7.8 before the sum. No other project is converted.

**A project or torre with fewer than two steps**  
The card draws a flat line at the current total. The left date is the earliest of the single history date, and, for a torre, `public.towers.initial_date`, the project’s first reserva day, and the project’s first PCV day. The right date is today in Guatemala, or the start date when today is earlier. A project-level flat line does not read `initial_date`.

**Torres filter**  
The closed control reads “Torres”. An empty choice draws every project from its own history. Choosing a torre replaces only that project’s line with that torre’s line. “Todos los Proyectos” does not change. The other project cards do not change. Periodo, Asesor, and modelo do not change this item. NINGUNO leaves the cards undrawn. The page stays up.

**Chart geometry**  
Each card has its own vertical scale, with 8 percent of pad above and below the series. The scale is not shared. The line is solid navy, 2px, with a dot on each step. There is no Brush and no column chart.

The horizontal axis marks the first day of January, April, July, and October as `ene 26`, `abr 26`, `jul 26`, and `oct 26`. Ticks that would collide are dropped. The first and the last stay.

The opening amount sits at the left of the line. The current amount sits at the right, and the appreciation percent sits on the line under it. The percent is `(current − opening) / |opening|`. When the opening is 0 and the current is not, the percent is omitted. When the opening amount and the current amount would meet, the opening amount is lifted.

Moving the pointer along the line shows the date and the value at that point. Leaving the line clears it. A click on the current amount opens the provenance dialog. The close control reads “Cerrar”. Escape closes that dialog. It does not close the torre-dates modal.

**Heights**  
“Todos los Proyectos” is `18dvh`, minimum `calc(168px * 18 / 22)`. Each project card is 156px. The gap under “Todos los Proyectos” is 12px. The gap between project cards is 8px.

**Torre-dates button**  
One instance of this control sits on Item 3 and one sits on Item 7, immediately to the right of that item’s Torres filter.

The button is 32 by 32 pixels, the same height as the filter. The border is the same border token as the filter. The icon is Lucide `sliders-horizontal` in `#DB2777`. The accessible name is “Fechas de las torres”.

It is drawn only when the signed-in role is `master` or `torredecontrol`. Either instance opens the same modal, titled “Fechas de las torres”. The table is one row per torre of Boulevard 5, Benestare, Bosque Las Tapias, and Santa Elena, in canonical project order and then by torre name. The columns are Proyecto, Torre, Fecha inicial, and Fecha final. Proyecto and Torre are read only. A date may be empty. “Guardar cambios” writes the pending rows to `public.towers.initial_date` and `public.towers.final_date`. “Salir sin guardar” closes without writing. Escape does not close the modal, and a click on the dimmed page does not close it.

`initial_date` is read only by this item, and only as one candidate for the left end of a torre flat line. `final_date` is stored and is not read by Item 3 or Item 7. Migration 094 adds the two columns and does not seed them. The column comment that calls `initial_date` day 1 of Status de ventas is not what the Status chart does.

**Explicit rules**  
- No Compact Hero, no Expanded Hero, no list-price number, no discount, no drawer.  
- No Brush.  
- Each card keeps its own scale, including a flat line.  
- Zeros stay on the line.  
- The provenance dialog opens on click of the current amount. The hover readout is the value under the pointer, not the provenance.

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
The only control on this item besides the project pills. It sits on its own row under the Item Title and above the Compact Hero. Item 5’s toggle shares the title row. This one does not. The options read U | Q. The default is U.  
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
The only control on this item besides the project pills. It sits on its own row under the Item Title and above the Compact Hero. Item 5’s toggle shares the title row. This one does not. The options read U | Q. The default is U.  
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
The only control on this item besides the project pills. It sits on its own row under the Item Title and above the Compact Hero. Item 5’s toggle shares the title row. This one does not. The options read U | Q. The default is U.  
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
The only control on this item besides the project pills. It sits on its own row under the Item Title and above the Compact Hero. Item 5’s toggle shares the title row. This one does not. The options read U | Q. The default is U.  
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
Show, at a glance, how the period’s Reservas and PCVs are distributed by modelo. Units only. No monetary values. Inventory status is Item 6 (§4.1.3). This item does not draw it.

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
- The toggle is the only control on this item. It shares the title row with the Item Title “Split de ventas por modelo y por torre”, on the right of that heading.  
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

Cobros, Créditos, and Entregas follow the same pattern. All items from each of those Operativo checklists are 0-click graphics on a single scrollable page. Their visual specs can be refined after Ventas is validated. Mercadeo is the scroll in §5.1. It is not the Operativo checklist and it does not use the Ventas three-level names.

**Note on Créditos:** The SSOT received from the CEO mixes Créditos + Entregas + Legal (Internal) + Legal (External). For this SDD the entire mush is placed under Créditos. Untangling the workflows is deferred until after this SDD is designed and built.

### 5.1 Mercadeo

**Status**  
The page on screen as of 27 November 2026 is one scroll: Performance Ads, Performance S, Reporte Reservas, Integración de Inventarios, and Presupuesto Mercadeo. It does not follow the Ventas three-level names (Compact Hero, Expanded Hero, Project Bands, Member Columns). It does not yet draw the Operativo checklist in `docs/Checklists-Authoritative.md`. Those checklist rows stay the CEO’s list. They are not bands on this page.

**What the page is**  
One scroll. The side menu is not drawn: `DepartmentSectionSidebar` returns nothing on `/mercadeo`. The five bands are anchors on this page (`#performance-ads`, `#performance-s`, `#reporte-reservas`, `#integracion-de-inventarios`, `#presupuesto-mercadeo`). A URL `/mercadeo/[those slugs]` redirects to that anchor. Performance Ads ends at the Campañas band. Página 1 is not on the page.

**Filters**  
Project pills: TODOS, Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena. There is no NINGUNO pill.  
TODOS includes every account in the ads grain, including Puerta Abierta and Casa Elisa. Those two are not pills. A chosen pill includes only the account mapped from that pill.  
Periodo: Este mes, Mes anterior, Este trimestre, Este año, Personalizado. The stored default is Personalizado, 1 January 2026 through 31 July 2026.  
Asesor is on the bar and offers only Todos. It does not change the report.  
The period filters Performance Ads, Performance S, and Reporte Reservas. It does not filter Integración de Inventarios or the presupuesto plan.  
Restablecer returns the stored default. The period text and the freshness stamp share one line. The stamp is `Datos al` plus the ads grain’s `loadedThrough` day, 04.08.2026.

**Column rule**  
Every split row uses the same two columns. The left column is the width of the three KPI cards. The right column takes the remaining width. A card that is alone takes the full width.

**Bands, top to bottom**

1. **KPI cards and Detalle de Pauta.** Three stacked cards on the left: Alcance, Importe gastado, Clientes potenciales. Each card shows a compact figure and the exact figure under it. Importe gastado is United States dollars. On the right, Detalle de Pauta is a table: Cuenta, Alcance, Impresiones, Clientes potenciales, Frecuencia, plus a Total row. Accounts are ordered by alcance, largest first. Frecuencia is blank on the total.

2. **Costo por lead, then Tendencia del costo por cliente potencial.** Left: vertical columns, one per account that has a cost, ordered by that cost, largest first. The number sits on the column, in dollars and cents. Account names are turned 90 degrees. Long names are shortened only here: Bosque Las Tapias reads “Bosque”, Puerta Abierta reads “P. Abierta”. Right: one line of the daily cost and a dashed straight trend. The horizontal axis marks the first of each month with its short name. Both cards are 210px tall.

3. **Clientes potenciales por día, then Clientes potenciales por proyecto.** Left: vertical columns, one per weekday that has leads in the period, ordered by leads, largest first. Day names are turned 90 degrees. The chart is 220px tall, a quarter more than the 176px chart it replaced, so those names fit. Right: a pie of leads by account, in the project colors, with the count and the share beside it. The pie fills the remaining width.

4. **Inversión en pauta, then Gestión de presupuesto.** Left: vertical columns of dollars spent, ordered by spend, largest first. The full account name is turned 90 degrees. The column keeps the same narrow width as the KPI cards. Right: one line of spend by month. Month names are written out. The line fills the remaining width. The card title stays “Gestión de presupuesto”.

5. **Campañas.** One card, full width. A treemap of campaigns by leads. A campaign with no leads in the period is omitted. The tile shows the short campaign name and the lead count when the tile is large enough. Tile color is the account color.

**Sections below Campañas**

6. **Performance S.** Four cards: Reservas, Inversión, Costo por reserva, Meses con ambos. The chart is titled “Inversión en pauta vs. reservas mensuales”: reservas as columns and inversión as a line, one point per month in the period. Then Detalle mensual. Spend and leads are the Performance Ads grain for the same period and accounts. Reservation counts are the snapshot in `src/lib/mercadeo/reservation-grain.ts`.

7. **Reporte Reservas.** Four cards: Reservas, Costo por cierre, the last month in the period, and Variación mensual against the month before it. Then Reservas por fuente beside Reservas por proyecto, Reservas por mes beside Reservas por asesor, and a second Reservas por fuente table. The inversión on that table is a proportional slice of the period’s spend, not an attribution by fuente. The same reservation snapshot supplies the counts.

8. **Integración de Inventarios.** The period does not filter it. The project pills do. The note under the title says the period does not change this view and the projects do. Four cards: Unidades, Disponibles, Valor de inventario, Valor disponible. Then Estatus de unidades beside Tipología × estatus, Unidades por proyecto beside Habitaciones, and Detalle de unidades (the first 200 rows by price; the total is every unit in the filter). The inventory grain names Benestare, Bosque Las Tapias, and Boulevard5. Santa Elena is not in it, so the Santa Elena pill shows no units. With TODOS the snapshot is 814 units: PCV 497, Disponible 195, Congelado 66, Reservado 47, CD 5, Congelado Junta Directiva 2, Liberado 2, and Q620,526,600. Prices are quetzales. Source: `src/lib/mercadeo/inventory-grain.ts`, from the snapshot in `public/mercadeo/performance.html` (refreshed 4 August 2026).

9. **Presupuesto Mercadeo.** The period does not filter the plan. The project pills do. Four cards: Presupuesto cargado, Meses presupuestados, Gasto real, Diferencia. Meses presupuestados is the fixed text “4” and “nov 25 – feb 26”. It is not a count of the filtered lines. Then Presupuesto por proyecto beside Presupuesto por concepto, and Líneas de presupuesto. With TODOS the plan is 67,880.79: Benestare 20,562.62, Bosque Las Tapias 16,388.17, Boulevard5 30,930.00. Gasto real is Meta spend for November 2025 through February 2026 from the Performance Ads grain, 46,191.77 with every account. Diferencia is that gasto minus the plan. The plan file has no currency column. The cards still print both figures as dollars. A date written `31/11` is shown in red. Source: `src/lib/mercadeo/budget-grain.ts`, from the same snapshot.

**Account colors**  
Benestare `#0d2041`, Boulevard 5 `#3d6f8f`, Bosque Las Tapias `#0573b0`, Santa Elena `#1a4a68`, Puerta Abierta `#94a3b8`. The pie and the treemap use these colors. Costo por lead, Clientes potenciales por día, and Inversión en pauta are drawn in navy.

**Numbers**  
The figures on Performance Ads, Performance S, Reporte Reservas, and the gasto real are United States dollars, as the Meta export states them. This page does not convert those dollars to quetzales. Inventory prices are quetzales.  
Performance Ads, the spend on Performance S and Reporte Reservas, and the gasto real are summed from `src/lib/mercadeo/performance-ads-grain.ts` (loaded through 4 August 2026). Reservation counts are `src/lib/mercadeo/reservation-grain.ts`. Inventory is `src/lib/mercadeo/inventory-grain.ts`. The plan is `src/lib/mercadeo/budget-grain.ts`. Each file is a snapshot carried in the repository, taken from `public/mercadeo/performance.html`. None of them is `mercadeo.ad_day`, and none of them is a live query. They are the exception named in §2 principle 12. A new Mercadeo chart does not get that exception.

**Empty period**  
When the selected pills and dates contain no ads accounts, the page says “Sin pauta en el periodo.” The five bands still render. An inventory filter with no units says “Sin unidades para estos proyectos.”

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

- `/ventas` shows the bands in §4.1 on load. Item 4 is not among them. `/mercadeo` shows the five bands in §5.1. It does not show the Operativo checklist.
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

- [ ] `/ventas` is the scroll in §4.1. `/ventas/[section]` still opens GlanceView.
- [ ] The bands follow the visual order in §4.1. Checklist numbers are not that order. The side menu is not drawn.
- [ ] Items 1, 2, 3, and 5 through 14 are on the scroll. Item 4 is not.
- [ ] Items other than 3, 4, 6, 7, and 9 use the left/right pattern in §3. Item 6 follows §4.1.3. Item 9 follows §4.1.10. Items 3 and 7 follow §4.1.2 and §4.1.4.
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
- Ventas defaults to Este mes, TODOS, and Asesor Todos. Mercadeo defaults to the window in §5.1.
- Metas: all existing targets are available. Load and display them. “Meta pending” is not acceptable.
- On `/ventas` and `/mercadeo` the side menu is not drawn. Other departments keep theirs. Where a rail exists, it scrolls inside the page.
- Keep the freshness stamp and filter-to-content separator.
- Data for all checklist items is considered available for design purposes (even if not yet fully loaded into the production database).
- Project identification colors: dark corporate blues; keep current palette for now.
- Canonical three-level names apply to the Ventas items that still use a left/right Hero Band (see section 3 and §2.1). Items 3 and 7 are the full-width bands in §4.1.2 and §4.1.4. Item 4 is not drawn. Item 6 is locked in §4.1.3. Item 9 is locked in §4.1.10. Projects in fixed canonical order. Asesores descending by value; modelos alphabetical. Fixed-size Project Detail Card (squeeze to fit, no wrap/scroll) on the items that have one. Numbers always visible; tooltips for provenance. `/ventas` has the NINGUNO pill. `/mercadeo` does not. Remove legacy Total › Proyecto › Asesor breadcrumb.

---

## 10. Living Documents

This SDD is one of three living documents that guide future development:

- `docs/SDD-Department-Command-Centers.md` (this document)
- `docs/General-Rules-and-Principles.md` (merged General Rules + key principles + freshness/filter rules)
- `docs/Checklists-Authoritative.md` (verbatim original Operativo and Directivo lists, marked as SSOT)

Historical multi-page, secondary-menu, and outdated design documents are to be removed or rewritten so they no longer contradict the Command Center model.

The 26 November notes on visual order, the Torres filter, and the torre-dates button are the specs in §4.1, §4.1.2, and §4.1.4. They are not a second description.

**Recorded, not on these pages.** The site is expected to take a new project without a broken layout. `/ventas` and `/mercadeo` still name the four current projects in source. That expectation is not a behavior of the committed pages.
