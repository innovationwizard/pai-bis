# Actions both plans agree on

Sources: `performance-dashboard-puerta-abierta-pbix-Reverse-Engineering-Plan-GR.md` and the plan section of `performance-dashboard-puerta-abierta-pbix-Reverse-Engineering-Plan-GE.md` (from the heading at line 1604). Written 2026-11-19. This is a working note. When a visual is matched on `/mercadeo`, record the match here.

The mission both plans accept is the same: reproduce every chart, table, and KPI on the Marketing Manager’s Power BI report, page by page, from the supplied files and the screenshots. GR says to match within about 1% after rounding and filter scope. GE says Track A must match the screenshot integers and cents before any business rule is changed. For this reproduction, Track A is the shared job.

## Pages in scope

Both plans cover the same six pages, in the PBIX order:

1. Performance Ads
2. Performance S
3. Reporte Reservas
4. Integración de Inventarios
5. Presupuesto Mercadeo
6. Página 1

Both treat Página 1 as unfinished, and both treat Presupuesto Mercadeo as a single table whose numbers are not the obvious totals of the budget workbook. Neither plan starts there.

## Where each page’s numbers come from

| Page | Shared source |
| --- | --- |
| Performance Ads | Meta export loaded as `Performance - Data Base PA`. One date filter and the account filter. No reservation join and no budget join for the sums. |
| Performance S | That same Meta spend, by month, beside a monthly reservation count. |
| Reporte Reservas | `insights list` from the reservations workbook. Spend on the fuente table comes from the Meta table through the project relationship. |
| Integración de Inventarios | `Análisis de Inventarios.xlsx`, sheet `Inventarios`. Standalone. |
| Presupuesto Mercadeo | A presupuesto table of `Inversión` by proyecto. Both say the supplied budget workbook’s headline totals do not explain the screenshot. |
| Página 1 | The Meta campaign column, under the date slicer shown on that page. |

Both say the Google Ads file they examined (`GA - Performance Report Puerta Abierta (4).csv`, next to the PBIX) has headers and no data rows, and that it does not feed the visible pages.

Both say the budget workbook’s exchange rate is Q7.80 per USD, and that Meta rows mix `Divisa` GTQ and USD. Both say the rate has to be written down per visual. Both say `Importe gastado (USD)` is the spend column the Ads pages show with a dollar sign.

## Shared filter and naming rules

- Ads screenshot window for the headline numbers: 2026-01-01 through 2026-07-31.
- Performance S shows January through a partial August 2026.
- Reporte Reservas screenshot window: 2026-01-01 through 2026-07-31. The card is 119.
- Account / project labels are not one vocabulary. Both lists include Benestare, Bosque Las Tapias, Boulevard5 and Boulevard 5, Santa Elena, Puerta Abierta, Casa Elisa, and the reservation pipelines Créditos BLT, Créditos Benestare, Créditos BLV5, plus the Créditos variants of Casa Elisa and Santa Elena. Any visual that crosses Meta, reservations, inventory, and budget needs an explicit name map. A silent string join will drop or double-count.
- Inventory `Estatus` and `Tipo` values carry trailing spaces (`PCV `, `Reservado `, `A `). Both say those strings have to be cleaned before a count will match the funnel.
- Reservation `Fuente - Trato` is sometimes a combined value. The fuente chart is driven by `Fuente - Persona`. Blank fuente values need an explicit rule, because an empty string and a null do not count the same way.

## Shared build order

Both workflows say the same sequence:

1. Clean names, dates, and currency, and write the rule down.
2. Rebuild each page’s filtered set using the dates and project selections visible on the screenshot.
3. Match one visual at a time. Sums and counts first. Grouped charts next. Ratios last.
4. Write the measure next to the visual (GR: the DAX equivalent; GE: the binding already taken from `visual.json`).
5. Check the result against the screenshot.
6. If the files cannot produce the number, record the missing source instead of forcing a match.

Ratios both put last: CPL (simple average versus spend divided by leads) and Costo por Cierre.

## Where they agree to start

They agree on the first page and the first visuals.

Start on Performance Ads. It is one Meta table, one date window (2026-01-01 to 2026-07-31), and no join. GR’s closing line names the first deliverable: the three KPI cards and the Detalle de Pauta table. GE’s parity suite starts with the same page and the same three cards, then the rest of that page’s sums.

The cards both cite:

- Sum of Alcance, shown as 22M. GE’s exact target is 22,082,106.
- Sum of Importe gastado, shown as $81.67K. GE’s exact target is $81,665.83.
- Sum of Clientes potenciales, shown as 24K. GE’s exact target is 24,360.

After those cards, the same sums fall out of the same filtered table. Both describe these as the easy visuals on that page:

- Detalle de Pauta grouped by `Nombre de la cuenta`: Sum of Alcance, Sum of Impresiones, Sum of Clientes potenciales. GE also gives the total impresiones as 28,026,414. The Average column is not agreed. See the conflict note before building that column.
- Pie of Sum of Clientes potenciales by account. Both see Benestare as the largest slice (11,823, about 48.53%) and Bosque Las Tapias next (7,144, about 29.33%). The small slices are not agreed. See the conflict note.
- Bar Inversión en Pauta: Sum of Importe gastado (USD) by account. Both read Boulevard5 about $30K, Bosque Las Tapias about $26K, Benestare about $18K, Santa Elena about $7K, Puerta Abierta about $0K.
- Line Gestión de Presupuesto: that same spend by month. Both read Jan $11.2K, Feb $10.5K, Mar $11.3K, Apr $13.2K, May $13.5K, Jun $10.9K, Jul $11.1K. Both say this line is Meta spend. It is not the budget workbook.

Those six pieces (three cards, the sum columns of the table, the pie, the spend bar, the monthly spend line) are the shared low-hanging fruit. They are one filter and `SUM`. They do not need the reservation date, the presupuesto file, or an attribution rule.

The next easy counts, after Ads, are also sums or counts both describe without a ratio:

- Performance S monthly spend is the same Meta monthly sum, extended through the partial August bar ($1.3K, 1 reservation) that the screenshot shows.
- Reporte Reservas card Count of Trato = 119, and the month counts both read (enero 21, febrero 10, and the total row 119 / 16).
- Inventory funnel counts after trim: PCV 497, Disponible 195, Congelado 66, Reservado 47, CD 5, Congelado Junta Directiva 2, Liberado 2. Typology cards A 91, A PLUS 3, A1 6. Utilidad Bruta card Q620.5M as `SUM(Precio de Venta)`.

GR does not say to start on inventory or reservas. GE’s parity list puts Page 1 first and only then pages 2, 3, and 4. So the agreed start remains the Ads sums. Inventory and the 119 card are the next straightforward counts, not the first build.

## What they agree to postpone

- CPL by project and the daily CPL line, until the average (row-level versus spend/leads) is chosen and checked. Both say the screenshot can be an unweighted average, and both say that average is the wrong cost per lead if the question is spend divided by leads.
- Costo por Cierre. Both call it the hard visual. The total on the screenshot is 686.27 on $81,665.83 and 119 deals. The per-fuente rows are not a clean campaign join.
- Presupuesto Mercadeo’s three project figures and the 67,880.79 total.
- Página 1, until the Ads page that uses the same Meta table is already matching.
- Any rename or replacement of a visual (weighted CPL, a real gross margin, a blended CAC). GR never asks for those replacements. GE asks for them only after Track A matches. The shared action is the match.

## Checks both plans want on the first page

For 2026-01-01 through 2026-07-31, from the Meta sheet that the PBIX loads:

- Alcance 22,082,106, displayed 22M.
- Importe gastado (USD) 81,665.83, displayed $81.67K.
- Clientes potenciales 24,360, displayed 24K.
- Impresiones 28,026,414 on the detail total.
- Monthly spend labels as listed above.
- Account spend order Boulevard5, Bosque Las Tapias, Benestare, Santa Elena, Puerta Abierta.

GE adds exact cents per account and a campaign exclusion. GR does not yet name that exclusion. The sums above are still the shared acceptance check. If the exclusion is required to hit 24,360, it belongs in the reproduction, because both plans require the screenshot numbers.
