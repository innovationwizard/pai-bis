# Actions the two plans disagree on

Sources: GR (the whole file) and GE from line 1604. Written 2026-11-19. “Disagree” here includes a direct conflict and a guideline only one plan states.

The reproduction mission follows the shared Track A actions in `01-agreed-actions.md`. Where this file conflicts with that one, do not change a screenshot number until Track A matches.

## 1. Copy the report, or correct it

GR’s deliverable is parity: cleaned datasets, notebooks that reproduce the screenshot numbers, a visual-to-column-to-aggregation map, and a list of blockers.

GE splits the work:

- Track A copies the report, including measures GE calls wrong.
- Track B then changes them: weighted CPL, frequency as impressions/reach, weekdays in calendar order, the spend chart renamed, a real budget-versus-actual overlay, reservations split so `Suspendido` is visible, Costo por Cierre replaced by blended CAC and paid Meta CAC, Utilidad Bruta renamed and split into list-price buckets, and Presupuesto Mercadeo rebuilt from the five project tabs of the budget workbook.

They agree Track A comes first. They disagree on whether the job includes Track B. GR never specifies those replacements.

## 2. How settled the formulas are

GR writes “likely” and tells the builder to test alternatives. GE writes visual ids, aggregation codes (`0` = SUM, `1` = AVERAGE, `5` = COUNTNONNULL), sort, extra filters, and cents, and says every headline figure on the four main screenshots has already been reconciled.

Treat GE’s bindings as claims to verify against `visual.json` and the Excel files, not as a second source of truth, until the first Ads sums match. The conflict is the working method: GR explores; GE asserts.

## 3. Readings of the same screenshots

These change what “match the picture” means.

| Visual | GR | GE |
| --- | --- | --- |
| Detalle de Pauta, last columns | The cut-off “Average” header is average costo por cliente potencial. | The fourth value column is `AVG(Frecuencia)`, and `SUM(Importe gastado (USD))` is also on the table. Example row Bosque Las Tapias: alcance 8,640,094, impresiones 10,604,756, leads 7,144, frecuencia 1.25, spend $25,931.58. |
| Pie, small slices | Santa Elena 51 (0.21%). Puerta Abierta is the remainder. Both plans put Boulevard5 at 4,627 (18.99%). | Puerta Abierta 51 (0.21%). Santa Elena 715 (2.94%). GE’s five slices sum to 24,360. |
| CPL by project | Santa Elena $10.36, Boulevard5 $7.44, Benestare $5.17, Bosque Las Tapias $2.56, Puerta Abierta $1.55. | Santa Elena $10.36, Boulevard5 $7.44, Bosque Las Tapias $5.17, Benestare $2.56, Puerta Abierta $1.55. GE also prints a weighted CPL beside each one. |
| Fuente bars | Meta Ads 43, Wati WhatsApp 36, Página web 23, Referido 5, Señaletica 3, Llamada inbound 3, Showroom 2, Inbox Meta 2, Lead Distelsa 1. Those counts add to 121, not to the 119 card. | Meta Ads 43, (Blank) 36, Wati WhatsApp 23, Página web 5, Referido 3, Señaletica 3, Llamada inbound 2, Showroom 2, Inbox Meta 1, Lead Distelsa 1. Those add to 119. |
| Fuente table, who gets the spend | GR does not assign the dollar cells row by row. The screenshot crop is easy to mis-pair. | (Blank) $44,164.18 and 1,226.78; Meta Ads $74,433.71 and 1,731.02; Página web $30,269.53 and 6,053.91; Wati WhatsApp $74,433.71 and 3,236.25; Referido $25,931.58 and 8,643.86. Several fuentes are blank. Total $81,665.83 and 686.27. |
| Asesores | Approximate bar lengths: Rony Ramirez ~32, Erwin Cardona ~28, Ivan Castillo ~22, Paula Hernandez ~18, Pablo Marroquin ~12. | Exact Top 5 on `COUNTNONNULL(Etapa)`: 33, 25, 23, 16, 10, with a hidden Top N filter. |
| Weekday columns | Group leads by weekday. Sorting left open. | Same sum, sorted by leads descending (domingo 3,924 first), not Monday-to-Sunday. |
| Inventory treemap | Estatus by tipo, no extra filter stated. | Visual filter keeps only Disponible, Congelado, and Congelado Junta Directiva. |
| Proyecto control on inventory | Described with the other slicers. | It is a table (`tableEx`), not a slicer. Highlighting Bosque Las Tapias does not filter the Q620.5M card. |

Until the Ads sums match, do not pick a winner on the pie or the CPL order from the plans alone. The fuente conflict has an internal check: the card is 119, and only GE’s bar counts add to 119.

## 4. Reservation date and what counts

GR leaves the date open: `Hora de añadición`, `Fecha de vencimiento`, or another field. GR also leaves open whether Count of Estado is every row, `Estado = Finalizada`, or a stage filter.

GE says the report is already solved: `Fecha de vencimiento` plus `Calendario` produces 119 deals in January–July 2026 and the monthly series 21, 10, 19, 15, 15, 16, 23. `Hora de añadición` produces 121 and a different series. Count of Estado is `COUNTNONNULL(Estado)` with no status filter, so the two `Tareas pendientes` rows stay in. GE still asks, as a Track B question, whether the business wants that date and whether `Suspendido` should be excluded.

Conflict for the copy: GR says discover the date; GE says use `Fecha de vencimiento` and count every non-null Estado. The extracted measure for the 119 card is `COUNT('insights list'[Trato])`, which is a related but different column from Estado.

## 5. Costo por Cierre

GR: unknown. It might be a campaign join, a proportional split, or a column that is not in the Excel extract.

GE: the measure is `DIVIDE(SUM(Importe gastado (USD)), COUNT(Fuente - Trato))`, evaluated under a many-to-many filter from `insights list[Proyecto]` to `Performance - Data Base PA[Nombre de la cuenta]`. `Créditos BLV5` does not match `Boulevard5`, so those deals contribute count and no spend. GE gives the cent match for (Blank), Meta Ads, and Página web.

`dax_measures.csv` supports GE’s formula text: `Costo por Cierre = DIVIDE([Med Importe Gastado],[Med Recuento Fuente])`, and `Med Importe Gastado` is the Meta USD sum. The relationship file supports the many-to-many. The per-row cents are GE’s reconciliation, not re-run for this note.

GR’s proportional reading matches the HTML rebuild’s comment, not the DAX extract. For a copy of the PBIX, GE’s measure is the one in the model. GR’s “test proportional allocation” would reproduce the HTML, not the report.

## 6. Currency

GR asks whether `Importe gastado (USD)` is already dollars for every row, and whether the budget rate 7.80 is also applied inside the Ads visuals.

GE says the USD column and `Costo por cliente potencial` are already normalized (maximum difference under 5e-9) and that Ads visuals do not apply a second conversion. The 7.80 rate belongs to the budget workbook. Track B still has to reconcile Meta dollars to the GTQ `Meta (facebook)` / `Meta Ads` lines.

## 7. Presupuesto Mercadeo

GR: find the month, the partidas, or the Real Ejecutado column inside the budget workbook that produces 20,562.62 / 16,388.17 / 30,930.00 / 67,880.79. Cross-check the Ads spend line against that workbook.

GE: the Ads line titled Gestión de Presupuesto is Meta spend, not the budget. The presupuesto page is one unfinished table on `Presupuesto[Proyecto]` and `SUM(Presupuesto[Inversión])`. The budget workbook is not connected to pages 1–4. GE’s phase 1 still asks whether `Presupuesto` came from `Reservas Totales PA - Report.xlsx[Hoja1]` or from `2026 - Presupuesto Mercadeo PAI (2).xlsx`.

The M script is more specific than either conclusion: it loads `Presupuestos - Puerta Abierta.xlsx`, sheet `Presupuesto`, with columns Fecha, Mes, Proyecto, Concepto, Proveedor, Inversión, Tipología, Frecuencia, Responsable. That file is not in this directory. `Hoja1` of the reservations workbook is a different, smaller allocation (GE reads 4,200 / 1,800 / 4,500). The two budget workbooks that are here are month matrices, not that `Inversión` table. So GR’s search inside the matrix workbook and GE’s Hoja1-versus-matrix question are both aimed at files that do not have the shape the model loads.

## 8. Página 1

GR: a partial campaign list. Reproduce it by listing Meta campaigns under the slicer dates.

GE: a debug scratchpad. Saved slicer 2026-01-01 to 2026-04-07, 17 campaigns, 13,764 leads, with inverted selection filters, used to isolate the 104,290-lead campaign `cons_guat__kpa_LeadsWebsiteBoulevard_fb_lds_cpa_11noval20nov`.

The screenshot dates (01/01/2026 to 07/04/2026) match the range GE names. The purpose and the 13,764 figure are GE-only.

## 9. Campaign exclusion and saved slicers

Only GE states these, and they change the Ads totals:

- Page filter, duplicated on several visuals: drop `cons_guat__kpa_LeadsWebsiteBoulevard_fb_lds_cpa_11noval20nov` (12 rows, 11–22 Nov 2025, 104,290 leads, $323.49). Those rows sit outside January–July 2026, so they do not move the 2026 headline cards. They do move any visual that uses the full Meta history.
- The PBIX was saved with different slicers than the screenshots. Ads saved as June–July 2026. Reservas saved from 2025-06-07 through 2026-07-31. Performance S saved as January–July while the screenshot includes 1–4 August. Build to the screenshot, not to the saved slicer.

GR never mentions the exclusion or the saved-versus-screenshot difference. Both still say to use the dates printed on the screenshots.

## 10. Inventory and the utilidad card

GR: count estatus, sum Precio de Venta, and confirm how status variants collapse.

GE: Power BI trims trailing spaces on its own, so `PCV` plus `PCV ` is 497. No further collapsing. The card is the sum of list price for all 814 units, Q620,526,600.00, and the label Utilidad Bruta is wrong for Track B. Track B also wants bedroom counts repaired for Bosque Las Tapias (GE says all 234 rows are 0) and a true proyecto slicer.

## 11. CPL

GR: test a simple average and a spend/leads ratio, and keep the one that matches.

GE: the visual is already the simple `AVERAGE`. Matching the screenshot means $10.36, $7.44, $5.17, $2.56, $1.55 in GE’s project order. The ratio is the Track B correction, not the way to win the match. GE’s weighted figures are Santa Elena $9.67, Boulevard5 $6.54, Bosque Las Tapias $3.63, Benestare $1.54, Puerta Abierta $6.29.

The project order of $5.17 versus $2.56 is still the conflict in section 3.

## 12. What to build, and in what system

GR’s artifacts are datasets and Python or Pandas notebooks, plus a mapping document. It allows the check to be done in Power BI or in Python.

GE’s artifacts are a `model_forensics.json` dump, a star schema (`dim_date`, `dim_project`, `dim_channel`, four fact tables) in PostgreSQL, DuckDB, or an Odoo mart, a parity test suite, and then a five-page executive rebuild in Next.js/Recharts/D3 or Odoo, with a variance bridge.

GE phase 1 says to run `pbixray` because the DataModel was still compressed. `ARTIFACT/` already contains `power_query.m`, `dax_measures.csv`, `schema.csv`, and `relationships.csv`. That phase is partly done. `relationships.csv` has only the one many-to-many. It does not list the `Calendario` relationships GE’s diagram assumes.

GE also asks whether the destination is a clean Power BI file, an Odoo plus React module, or both. GR does not ask. This conversation’s destination is the Mercadeo page of this app. That answers GE’s stack question for the UI. It does not adopt GE’s Track B metric changes.

## 13. Name map

Both say the labels differ. Only GE writes the arrows, and only for Track B:

- `Créditos BLV5` and `Boulevard 5` → Boulevard5
- `Créditos Benestare` → Benestare
- `Créditos BLT` → Bosque Las Tapias
- `Créditos Santa Elena` → Santa Elena
- `Créditos Casa Elisa` → Casa Elisa

For Track A, GE says to keep the raw strings, because the broken join is what produces the screenshot. Applying this map before Costo por Cierre will miss the screenshot on purpose. That is a Track B action.

## 14. Files only one plan, or neither plan, accounts for

GE names a rogue campaign, `Hoja1` of the reservations file, formula errors on TOTAL and DASHBOARD, and the empty-string behavior of Pipedrive. GR names none of those as facts.

Neither plan uses the later files at the root of this directory: the October Meta extract, the 407-row activities extract, the August ejecución budget, the non-empty UTF-16 Google Ads file, or the LinkedIn creative export. GE’s “Google Ads file is empty” statement is true of the 431-byte file next to the PBIX and false of `GA - Performance Analytics PA.csv`. Using the October extracts to hit the August screenshots will miss the targets both plans set.
