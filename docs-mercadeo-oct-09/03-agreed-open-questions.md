# Open questions both plans share

Sources: the “Open Questions” list at the end of GR, and section 6 of GE (line 2276 onward), plus the gaps both plans describe in the page sections. Written 2026-11-19.

A question GE claims to have closed is not listed here. Those closures are in `02-conflicting-actions.md` (reservation date used by the report, unweighted CPL as the visual’s formula, the DAX text of Costo por Cierre, trailing-space trim, treemap Top N). This file is only what both plans still leave unresolved, and the file gaps that sit under those questions.

## 1. What produces the Presupuesto Mercadeo table

Both leave this open.

The screenshot is:

| Proyecto | Sum of Inversión |
| --- | ---: |
| Benestare | 20,562.62 |
| Bosque Las Tapias | 16,388.17 |
| Boulevard 5 | 30,930.00 |
| Total | 67,880.79 |

GR: these are not the half-year or full-year totals of the budget workbook. Which month, which partidas, or which Real Ejecutado column produces them is unknown.

GE: the page is one unfinished table on `SUM(Presupuesto[Inversión])`. GE still asks whether that table came from reservations `Hoja1` or from `2026 - Presupuesto Mercadeo PAI (2).xlsx`, which workbook is the official 2026 budget, and whether Puerta Abierta corporate spend (GE cites Q58,530.35 for January–June, with no budget on that line) is overhead or gets allocated to the projects.

Directory fact, not a conclusion of either plan: Power Query loads `Presupuestos - Puerta Abierta.xlsx`, sheet `Presupuesto`, with columns Fecha, Mes, Proyecto, Concepto, Proveedor, Inversión, Tipología, Frecuencia, Responsable. That file is not in `docs-mercadeo-oct-09`. The two budget workbooks that are here are month matrices at Q7.80 per USD. Reservations `Hoja1` is a different allocation (META and TikTok lines whose sums GE reads as 4,200 / 1,800 / 4,500). None of the files on disk has been shown to produce 20,562.62 / 16,388.17 / 30,930.00.

This blocks the presupuesto page. It does not block the Performance Ads sums. Gestión de Presupuesto on the Ads page is Meta spend; both plans describe that line with the $11.2K … $11.1K labels, and GE says it is not this table.

## 2. Whether another advertising source is missing

Both leave this open.

GR asks whether a live connection, a calculated table, or a full Google Ads extract is required for some measures. GE asks whether Google Ads was inactive from November 2025 through August 2026, or whether the manager exported an empty filter. GE also notes a Meta campaign whose name contains `_ga_` (`cons_guat__kpa_LeadsVolumenBNT_ga_lds_cpl_AO`, 621 leads in GE’s note) and asks whether Google Ads rows were mixed into the Meta workbook.

What the directory shows now:

- `GA - Performance Report Puerta Abierta (4).csv`, next to the PBIX, is the empty file both plans read. The M script does not load it.
- `GA - Performance Analytics PA.csv`, at the root of this folder, is a different export. UTF-16, tab-separated, 1 Jan 2025–9 Oct 2026, 1,046 data lines, five accounts, six campaigns. Neither plan read it. It is not wired into the PBIX.
- `Linkedin_campaign_478626024_creative_performance_report.csv` is a paused Santa Elena LinkedIn campaign with four creatives, 1 Nov 2025–9 Oct 2026. Neither plan mentions it. The M script does not load it.

So “the GA file next to the PBIX is empty” is still true, and “this directory has no Google Ads rows” is no longer true. What stays open, and what both plans actually ask, is whether any visual in the PBIX needs Google Ads. Nothing in the extracted M script says it does. The newer GA file and the LinkedIn file are extra sources for a later Track B, not inputs to the screenshot match, until someone shows a visual that uses them.

## 3. The official reservation rule

Both still ask a version of this, at different layers.

GR does not know which date the report uses, and does not know whether the monthly counts are all rows, `Finalizada` only, or a stage filter.

GE says the report uses `Fecha de vencimiento` and counts rows without a status filter (119 deals, including `Tareas pendientes`). GE then leaves the business rule open: should the official date stay `Fecha de vencimiento` (119) or move to `Hora de añadición` (121), and should `Etapa = Suspendido` or `Estado = Tareas pendientes` be excluded.

The shared gap is the official rule. The forensic behavior is GE’s claim, disputed by GR’s decision to leave it open, and it is tracked in the conflict note. Do not block the Ads page on this. It blocks Performance S and Reporte Reservas only if the builder refuses GE’s claim. The acceptance numbers both plans already print (119, and the month series 21, 10, 19, 15, 15, 16, 23, plus August = 1) are enough to test the claim without a new business rule.

## 4. The correct cost per close

Both say the fuente table’s Costo por Cierre is not a clean, documented attribution.

GR: the method is unknown (campaign join, proportional allocation, or a field that is not in the extract).

GE: the PBIX method is known and wrong. `DIVIDE` of account spend by `COUNT(Fuente - Trato)`, filtered through the many-to-many on project name, so blank and Meta and WhatsApp rows do not partition the $81,665.83. They overlap, and `Créditos …` deals get a blank cost. GE then leaves Track B open: whether to recover the 36 blank `Fuente - Persona` rows (GE says 32 of those 36 have `Fuente - Trato`, and some have `[Meta] Campaign Name`) with a waterfall of campaign name, then persona, then trato.

The shared open question is the rule a production page should use once the screenshot has been matched. Both refuse to treat the current per-fuente costs as a real cost per close. The total 686.27 is just $81,665.83 / 119, and both the card math and GE’s total row agree on that. The row-level picture is the part they do not share a rule for.

This does not block the three Ads cards.

## 5. How dollars and quetzales sit on one page

Both record mixed currency and the budget rate of 7.80. Both say the rate has to be stated per visual.

GR still asks whether the Ads visuals apply 7.80 on top of `Importe gastado (USD)`. GE says they do not, and still asks how January–July Meta spend ($81.67K) should be reconciled to the GTQ Meta lines in the budget workbook when Presupuesto is rebuilt.

The shared gap is the reconciliation rule between Meta USD and budget GTQ. The Ads cards themselves display the USD column. Building those cards does not require the 7.80 rule. Building a budget-versus-actual chart does. Neither plan has a confirmed rule for that chart beyond “the workbook says 7.80”.

## 6. Questions only one plan still asks

Listed so they are not mistaken for shared blockers.

Only GE:

- Destination stack. For this app the UI destination is `/mercadeo`. GE also offered a clean PBIX or Odoo.
- A `Tipo` → `Habitaciones` lookup for Bosque Las Tapias, or a pull from the unit master. GE says those 234 bedroom counts are 0.
- Whether Utilidad Bruta should be renamed to inventory list value, or whether a cost table exists so the card can be gross margin. No cost column is in `Análisis de Inventarios.xlsx`. The screenshot figure is the sum of Precio de Venta.
- Whether Puerta Abierta’s corporate budget line is overhead or an allocation. Tied to question 1 above.

Only GR, and closed or contradicted by GE (see the conflict note before treating them as still open):

- Treemap Top N versus all campaigns.
- Whether inventory statuses collapse beyond a trim.
- Whether the Ads USD column needs another conversion.
- Which date field the existing report uses.

## What this leaves as the first build

Both plans’ open questions sit on presupuesto, on Google Ads, on the official reservation rule, on a correct cost per close, and on USD-to-GTQ reconciliation.

None of those five block the first agreed achievement: Performance Ads, 2026-01-01 through 2026-07-31, three sum cards (22,082,106 alcance, $81,665.83, 24,360 leads), then the sum columns of Detalle de Pauta, the spend-by-account bar, and the monthly spend line. The Average column, the small pie slices, and the CPL column order stay on the conflict list until those sums match.
