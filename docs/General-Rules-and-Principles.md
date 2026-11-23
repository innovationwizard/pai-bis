# General Rules and Principles — Puerta Abierta Business Intelligence Suite

**Persistent design and content rules.** Apply across all departments (Mercadeo, Ventas, Cobros, Créditos, Entregas).  
**Date:** 10 November 2026

---

## Fundamental Guiding Principle

Take what the CEO and Managers already have in mind and are already familiar with, and use that. Do not introduce, force, or display alternative definitions of metrics. The app must not attempt to feed them a different meaning for the numbers they already use.

---

## Data Sources

All users know the data comes from Pipedrive and Odoo 15.  
Do **not** state “Fuentes: Pipedrive + Odoo” (or any equivalent) in general places on the page.

Disputes about figures have always been about **specific numbers** that differ from a Pipedrive report or an Odoo 15 report. Nobody has ever disputed the origin of the data itself.

---

## Freshness Stamp

The freshness stamp (“Datos al [timestamp]”) is important and must remain visible.  
It does **not** deserve its own row, and it must not be bold.

Place it on the same line as the selected period description, to the right of it, using the **exact same font treatment** as the period description.

---

## Period Label Grammar (Spanish)

Incorrect: `Mes anterior. octubre 2026.`  
Correct: `Mes anterior: octubre 2026.`

In Spanish:
- A period indicates **division** — the concept before the period is one thing; the concept after is a different, distinct thing.
- A colon indicates a **relationship** — what is said before the colon is related to what is said after it.

Use the colon for period labels.

---

## Explanatory Notes

Notes such as “Cómo calculamos…” (and their on-click content) are important in principle.  
Placing them in the primary scan path creates visual noise and drives attention away from the actual content.

Until an ideal location is decided, comment them out. Do not delete the underlying content. Do not display definition statements on screen.

---

## Filter Battery → Content Boundary

After the filter controls and the period + freshness line, mark the transition into page content with:
1. A line break
2. An elegant horizontal separator

This signals that the filter battery has ended and the content of the page begins.

---

## Visual Hierarchy and Anti-Clutter

Hero metrics must be the largest and most prominent elements.  
Interrupting small text, hard-to-read secondary labels, and large empty regions that convey no information all increase crowding and reduce clarity.

Empty space that dominates a region must either carry a clear message or be reduced.  
Secondary and tertiary text must not compete with the primary numbers for attention.

Managers have consistently criticized “too cluttered” and “too much text.”  
Do not add explanatory captions, definition statements, or redundant labels.

**Mandatory counter-rule:** Every graphical element that represents an amount must display its corresponding number (bars, columns, points, segments). Data labels on charts are required; surrounding prose is not.

---

## Color

- Use color for meaning (compliance, deficit, blocked stages).
- Use dark, corporate shades of blue to visually identify different projects. Keep the current project colors for now.
- Future consideration: a configuration to assign or change project colors.

---

## Navigation

A left-rail secondary menu may remain. Because each department is a single scrollable page, the left-rail navigates within the page (anchor / scroll-to) rather than to separate URLs. Prefer the icon when a single click reaches a section faster than scrolling. De-emphasize rather than remove.

## Ventas page order

The Ventas command center scrolls in Operativo checklist order, items 1 through 14, top to bottom. Confirmed 21 November 2026. The list and the wording live in `docs/Checklists-Authoritative.md`. The visual spec lives in `docs/SDD-Department-Command-Centers.md` §4.1. The left rail uses that same order. An item’s importance does not move it to another position on that page.

---

## Metas

All existing targets are available. Load and display them. “Meta pending” is not acceptable.
