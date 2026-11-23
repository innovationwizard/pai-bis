# Ventas Command Center — Systematic Diagnostic & Corrections Roadmap

**Date:** 21 November 2026  
**Basis:** Screenshots of the live Ventas page (taken ~11:08–11:17 GT) compared against `SDD-Department-Command-Centers.md` (10–19 Nov 2026) and the authoritative Operativo checklist.  
**Scope:** Presence, order, and structural / hierarchical compliance with the locked SDD. Data correctness and provenance-tooltip behavior are not fully assessable from static screenshots.

**Decision, 21 November 2026.** The scroll order is the Operativo checklist, top to bottom: 1 Ventas totales, 2 Objetivos de ventas, 3 Status de ventas, 4 Ventas por canales, 5 Split de ventas por modelo, 6 Inventario general, 7 Valor de proyecto, 8 Desistimientos, 9 Tasa de conversión, 10 Descuentos, 11 Subidas de precios, 12 F&F y casos especiales, 13 Control Referidos, 14 Promociones. The earlier Band A list (1, 2, 3, 6, 9) is not a page position. The SDD, the checklist note, and the general rules record this order. The command center was reordered to this sequence the same day. Items 10–12 stay in one two-column block, read left to right, then top to bottom. Items 13 and 14 are full-width bands after that block.

---

## Executive Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| Items present | 14 / 14 | All checklist items have a visual presence. Several lower items are sparse, empty, or minimal. |
| Correct sequential order | Yes, as of the reorder | Locked order is checklist 1–14. The command center now follows it. The rows below that say an item was out of order describe the screenshots from the morning, before that reorder. |
| Structural compliance with SDD | Partial | Items 1–3, 5, and 6 closely follow their locked three-level (or adapted) specs. Lower items are present but under-specified or incomplete. |
| Filter compliance | Partial | Project pills lack the required **NINGUNO** pill. Periodo + Asesor + Restablecer + freshness stamp are present. |
| Anti-clutter / density | Mixed | Top items are dense and number-rich. Several lower cards are empty or near-empty. |

**Highest-priority corrections**
1. Reorder the page to the locked scroll order: Operativo items 1 through 14, top to bottom. Done in the command center on 21 November 2026.
2. Add the **NINGUNO** project pill.
3. Complete and densify Items 7–14 to the same standard as Items 1–3, 5, and 6.
4. Confirm Item 3 secondary dimension (torre vs original checklist “asesor”) remains the locked SDD decision.

---

## Global Observations

- **Canonical three-level pattern** (Compact Hero → Expanded Hero → Project Bands) is correctly applied to Items 1, 2, 5, and 6.
- **Numbers are visible** on or above bars/columns in the well-implemented items.
- **Zeros are kept** (Santa Elena, empty asesores, zero modelos, etc.).
- **Project order** is canonical (Boulevard 5 → Benestare → Bosque Las Tapias → Santa Elena).
- **Asesores** are sorted descending where shown.
- **Modelos** appear alphabetical.
- **Semantic color** is used for variance (red deficit) and inventory status.
- **Missing NINGUNO pill** — SDD §3 requires `TODOS + projects in canonical order + NINGUNO` on the right. Current pills stop at Santa Elena.
- **Tasa de conversión** appears as vertical columns rather than the “horizontal bar funnel” specified in SDD §4.1.
- Several lower items show empty or near-empty cards, violating the anti-clutter and density principles when the data exists (or should exist).

---

## Item-by-Item Assessment

### 1. Ventas totales
- **Present?** Yes
- **In correct order?** Yes (first)
- **Compliant with SDD structure?** **Yes**
  - Compact Hero titled “Todos los Proyectos” with large number (15 reservas).
  - Expanded Hero: Project Summary Columns in canonical order with numbers on bars, zeros shown.
  - Project Bands: Project KPI Card (left) + Project Detail Card with Member Columns (asesores, descending).
  - Fixed-size cards, numbers visible, zeros retained.
- **Issues / proposed fixes:** None structural. Verify click-provenance tooltips and that the full item fits without excessive scroll (SDD hard constraint).

### 2. Ventas versus objetivos de proyectos – totales y por asesor
(SDD title: Objetivos de ventas)
- **Present?** Yes
- **In correct order?** Yes
- **Compliant with SDD structure?** **Yes** (§4.1.1)
  - Compact Hero shows actual / objetivo with variance (units + %) and semantic color.
  - Expanded Hero: Project Summary Columns with objetivo lines and variances.
  - Project Bands: only that project’s asesores, descending, fixed card, squeeze-to-fit.
  - Zeros and negative variances handled correctly.
- **Issues / proposed fixes:** None structural. Confirm variance position matches the “same visual position as current charts” rule.

### 3. Status de ventas – Déficit o excedente versus fecha de cierre, por proyecto y por asesor
(SDD: por proyecto y por torre; no per-asesor band)
- **Present?** Yes (lifetime cumulative pace charts)
- **In correct order?** Yes
- **Compliant with SDD structure?** **Yes** (§4.1.2)
  - No all-projects band.
  - One band per project with cumulative Reservas + PCV + variance vs expected.
  - Solid Reservas, dashed PCV, thin expected line on the same chart.
  - Per-torre bands below, inheriting start / placeholder cierre.
  - Single-tower rule applied (Boulevard 5 has no duplicate per-torre band).
  - Congelado torres flagged.
  - Numbers visible on lines.
- **Issues / proposed fixes:**  
  - Original checklist wording said “por asesor”; SDD explicitly changed this to “por torre” and forbade the per-asesor band. Implementation follows the SDD. **Confirm this remains the intended locked decision.**  
  - Placeholder fecha de cierre should remain clearly labeled as temporary.  
  - Verify unit totals match live availability (298 / 282 / 234 / 11).

### 4. Ventas por canales
- **Present?** Yes (Meta Ads 11, Señaletica 1)
- **In correct order?** Yes (after Item 3)
- **Compliant with SDD structure?** **Mostly**
  - Ranked horizontal bars by Fuente, as specified.
- **Issues / proposed fixes:**  
  - Increase density if more fuentes exist.  
  - Ensure numbers are always visible and zeros (if any) are not hidden.  
  - Consider small-multiples by project if the SDD “or small multiples” option is desired for higher density.

### 5. Análisis de inventario: Split de ventas por modelo
(SDD title: Split de ventas por modelo y por torre)
- **Present?** Yes
- **In correct order?** The morning screenshot had it after Tasa de conversión. The command center now places it after Item 4 and before Item 6.
- **Compliant with SDD structure?** **Yes** (§4.2.1 locked 19 Nov)
  - Compact Hero “Todos los Proyectos” with single series number.
  - Expanded Hero: one column per torre (Odoo short form: TA, Principal, etc.), shared scale, zeros visible.
  - Project Bands: Project KPI Card = compact alphabetical modelo list; Project Detail Card = modelo × torre cross.
  - Reserva / PCV toggle on its own row; solid vs dashed.
  - Alphabetical modelos, never hide zeros, no percentages.
- **Issues / proposed fixes:**  
  - Confirm Santa Elena uses one column per modelo (A/B) in both Expanded Hero and Project Detail Card.  
  - Verify shared y-scale and that the full item fits within the scroll budget of Items 1–2.

### 6. Inventario general: Vendido, congelado, disponible
- **Present?** Yes
- **In correct order?** Yes. It sits after Item 5 and before Item 7.
- **Compliant with SDD structure?** **Yes** (§4.1.3)
  - Compact Hero: five status rows (waterfall) + Total (navy).
  - Expanded Hero: vertical stacked columns per torre, per-project scale, Odoo short labels, zeros as zero-height segments.
  - Project Bands: Project KPI Card = status waterfall (no Total); Project Detail Card = status-row blocks per torre on shared scale.
  - Status order and colors match `UNIT_STATUS_COLORS` (green Disponible, blue Reservado, purple Congelado, gray Vendido, orange En revisión).
  - No period/asesor/modelo effect (as specified).
- **Issues / proposed fixes:**  
  - Minor: confirm internal card scroll (if any) does not count as page scroll.  
  - Ensure numbers appear inside segments only when space allows, otherwise omitted (per spec).

### 7. Valor de proyecto – trazabilidad de precios por valorización y descuentos
- **Present?** Yes (Trayectoria de precios line + Impacto del descuento bar)
- **In correct order?** Yes
- **Compliant with SDD structure?** **Partial**
  - SDD calls for a composed chart or small multiples showing price trajectory and discount impact.
  - Current implementation is two separate simple charts.
- **Issues / proposed fixes:**  
  - Combine into a denser composed chart or small multiples by project / modelo.  
  - Add more trajectory points or breakdowns if data exists.  
  - Ensure every amount has its number visible.  
  - Align with three-level cadence where it adds value (or explicitly document the exception).

### 8. Desistimientos – Reembolsos, retención de reembolso y valorización de proyectos
- **Present?** Partially (por motivo empty; por proyecto shows zeros)
- **In correct order?** Yes
- **Compliant with SDD structure?** **No**
  - SDD: “Bars or small multiples for financial impact (reembolso / retención)”.
  - Current cards are largely empty.
- **Issues / proposed fixes:**  
  - Populate with actual reembolso, retención, and valorización amounts.  
  - Use bars or small multiples by motivo and by project.  
  - Keep zeros visible rather than empty space.  
  - Add the financial figures the checklist requires.

### 9. Tasa de conversión
- **Present?** Yes (stage funnel with counts and conversion % under bars)
- **In correct order?** The morning screenshot had it between Item 4 and Item 5. The command center now places it after Item 8 and before Item 10.
- **Compliant with SDD structure?** **Partial**
  - SDD specifies a “Horizontal bar funnel of the stages currently tracked”.
  - Implementation uses vertical columns.
  - Shows “Tasa de ganados 0%” which may be misleading or incomplete.
- **Issues / proposed fixes:**  
  - Convert to horizontal bar funnel.  
  - Clarify or remove the “Tasa de ganados” label if it is not part of the familiar flow.  
  - Ensure all stages of the users’ familiar flow are present and numbers are visible.

### 10. Control de descuentos
- **Present?** Yes (single bar “Descuento (1 hab)” Q 17,400)
- **In correct order?** Yes
- **Compliant with SDD structure?** **Partial**
  - Compact visual summary with amount shown — meets the minimum.
- **Issues / proposed fixes:**  
  - Increase density: breakdown by project, asesor, or type of discount.  
  - Follow three-level pattern if multiple dimensions exist.  
  - Keep numbers visible.

### 11. Control de subidas de precios
- **Present?** Yes (all zeros)
- **In correct order?** Yes
- **Compliant with SDD structure?** **Partial**
  - Compact visual with amounts (zeros) shown.
- **Issues / proposed fixes:**  
  - Confirm data source; if real subidas exist, populate them.  
  - Densify with project or period breakdowns.  
  - Never hide zeros (already correct).

### 12. F&F y casos especiales
- **Present?** Yes (empty card)
- **In correct order?** Yes
- **Compliant with SDD structure?** **No**
  - Empty card does not meet “compact visual summary with amounts shown”.
- **Issues / proposed fixes:**  
  - Populate with actual F&F and special-case counts/amounts.  
  - Use indicators or bars.  
  - Flag Congelado / F&F exceptions consistently with Item 3 and Item 6.

### 13. Control Referidos
- **Present?** Yes (bars by tipo + list of referidores)
- **In correct order?** The morning screenshot had it last. The command center now places it before Item 14.
- **Compliant with SDD structure?** **Mostly**
  - Dedicated visual (not a canales filter).  
  - Counts broken by tipo + short visible list of referidores — matches SDD §4.1.
- **Issues / proposed fixes:**  
  - Consider adding project breakdown if useful.  
  - Ensure the list remains short and scannable (anti-clutter).

### 14. Control de promociones
- **Present?** Yes (bar “Vale” Q 2,068,300)
- **In correct order?** The morning screenshot had it before Item 13. The command center now places it after Item 13.
- **Compliant with SDD structure?** **Partial**
  - Compact visual with amount shown.
- **Issues / proposed fixes:**  
  - Densify with breakdown by promotion type or project.  
  - Keep numbers visible.

---

## Recommended Correction Sequence

1. **Filters** — Add NINGUNO pill; verify NINGUNO + zero-project state does not crash.
2. **Reorder** — Done. The command center follows 1–14. Item 5 sits after Item 4 and before Item 6. Item 9 sits after Item 8 and before Item 10. Item 13 sits before Item 14.
3. **Item 3 confirmation** — Explicitly re-confirm with stakeholders that “por torre” (not “por asesor”) remains the locked secondary dimension.
4. **Densify Items 7–12 and 14** — Bring them to the same visual standard as Items 1–3, 5, and 6. Replace empty cards with real data or intentional zero-state graphics.
5. **Item 9 geometry** — Convert to horizontal funnel.
6. **Provenance & polish** — Verify click-only provenance tooltips on every number; confirm freshness stamp placement; ensure full items fit within the scroll budget of Items 1–2.
7. **Data alignment** — Continue the meta-mission of matching Pipedrive SSOT for all counting and classification logic.

---

## Open Questions for Stakeholder Confirmation

- Is the SDD’s change of Item 3 from “por asesor” to “por torre” still locked?
- Scroll order is resolved: Operativo items 1 through 14, top to bottom (21 November 2026).
- For sparse items (8, 10–12, 14), is the data simply not yet loaded, or should the visuals be redesigned even with current data?

---

*End of diagnostic. Use this document as the living corrections roadmap.*
