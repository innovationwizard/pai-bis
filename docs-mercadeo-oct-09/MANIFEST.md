# Manifest: `docs-mercadeo-oct-09`

Working inventory for the Marketing Manager report reproduction. Read on 2026-11-19 from the files in this directory. Update this file when a source is replaced or a visual is matched.

Two plans live here:

- `performance-dashboard-puerta-abierta-pbix-Reverse-Engineering-Plan-GR.md` (15,017 bytes). A page-by-page hypothesis. It treats formulas as likely, and it ends on ten open questions.
- `performance-dashboard-puerta-abierta-pbix-Reverse-Engineering-Plan-GE.md` (186,964 bytes). Lines 1–1602 are a lab log (directory listing, PBIX zip listing, failed text decode of `DiagramLayout`, then probes against the Excel files). The plan itself starts at line 1604. It claims exact visual bindings and reconciled numbers, then splits a forensic copy (Track A) from a corrected rebuild (Track B).

Comparison notes written with this manifest:

- `01-agreed-actions.md`
- `02-conflicting-actions.md`
- `03-agreed-open-questions.md`

Screenshot set for the mission (the six report pages, in the order the PBIX stores them): Performance Ads, Performance S, Reporte Reservas, Integración de Inventarios, Presupuesto Mercadeo, Página 1.

## What feeds the report, and what does not

Power Query in `ARTIFACT/power_query.m` loads four workbooks from `C:\Users\Sebastian Carrillo\OneDrive - Grupo Orion\Documentos\Business Intelligence\`:

| Model table | Power Query file and sheet | Present in this directory |
| --- | --- | --- |
| `Performance - Data Base PA` | `Performance-Report-Puerta-Abierta.xlsx` / `Performance - Data Base PA` | Yes, inside the PBIX folder |
| `insights list` | `Reservas Totales PA - Report.xlsx` / `insights list`. Renames `Hora de añadición` to `Fecha de añadición` | Yes, inside the PBIX folder |
| `Inventarios` | `Análisis de Inventarios.xlsx` / `Inventarios` | Yes, inside the PBIX folder |
| `Presupuesto` | `Presupuestos - Puerta Abierta.xlsx` / `Presupuesto` | No. That filename is not in this directory |

`Calendario` is in the model schema and is not in the M script. `relationships.csv` contains one relationship only: `Performance - Data Base PA[Nombre de la cuenta]` to `insights list[Proyecto]`, many-to-many, both directions, active. Date relationships are not in that extract.

The files at the root of this directory (`Performance-Report-Puerta-Abierta (27).xlsx`, `activities-insights-25046793-274.xlsx`, `02  08.26 Ejecución Presupuesto Mercadeo PAI.xlsx`, `GA - Performance Analytics PA.csv`, `Linkedin_campaign_478626024_creative_performance_report.csv`) are later or extra extracts. Neither plan uses them. Screenshot parity has to use the PBIX-folder extracts named above. The later Meta file has a different date span and a different row count.

## Directory tree

```
docs-mercadeo-oct-09/
  02  08.26 Ejecución Presupuesto Mercadeo PAI.xlsx          64,737
  GA - Performance Analytics PA.csv                          413,124
  Linkedin_campaign_478626024_creative_performance_report.csv 11,648
  Performance-Report-Puerta-Abierta (27).xlsx              1,007,405
  activities-insights-25046793-274.xlsx                       67,490
  performance-dashboard-puerta-abierta-pbix-Reverse-Engineering-Plan-GE.md
  performance-dashboard-puerta-abierta-pbix-Reverse-Engineering-Plan-GR.md
  performance-dashboard-puerta-abierta-pbix_2026-08-06/
    2026 - Presupuesto Mercadeo PAI (2).xlsx                  59,956
    Análisis de Inventarios.xlsx                             112,189
    DSC03508.jpg                                             848,241
    DSC03530.jpg                                             866,088
    GA - Performance Report Puerta Abierta (4).csv               431
    Performance Dashboard - Puerta Abierta.pbix            1,453,972
    Performance-Report-Puerta-Abierta.xlsx                 1,265,319
    Reservas Totales PA - Report.xlsx                         46,959
    ARTIFACT.zip                                             110,460
    ARTIFACT/
      Performance_Dashboard_Puerta_Abierta.html              290,515
      build_data.py                                            5,328
      dax_measures.csv                                           658
      power_query.m                                            4,415
      relationships.csv                                          234
      schema.csv                                               5,483
```

`.DS_Store` files in this folder and in the PBIX subfolder are Finder metadata, not report content.

## PBIX

`performance-dashboard-puerta-abierta-pbix_2026-08-06/Performance Dashboard - Puerta Abierta.pbix`

PBIR layout. `Report/definition/pages/pages.json` page order, which is also the active-page order:

1. `5d6d81e0375b8ea8d01b` — Performance Ads
2. `996af8c70b1cb2ba8a34` — Performance S
3. `88d2553681fdfd969634` — Reporte Reservas
4. `95d5f5380edad5998092` — Integración de Inventarios
5. `4db4b529687205d2e044` — Presupuesto Mercadeo
6. `53143b63d080c5dbc0bc` — Página 1

Active page stored in the file: Performance Ads. Each `page.json` also has `height`, `width`, and, on Performance Ads, `filterConfig`. GE records the canvases as 1900×900 (Ads), 1800×900 (Reservas), and 1280×720 for the other four. This pass confirmed the display names and did not re-copy every `visual.json`.

GE’s zip listing also includes `DataModel` (1,306,515 bytes, Xpress9), `DiagramLayout`, `SecurityBindings`, a logo PNG, and one other registered PNG. The model tables named in `schema.csv` are `Calendario`, `Performance - Data Base PA`, `insights list`, `Inventarios`, `Presupuesto`, plus auto date tables (`DateTableTemplate_…`, several `LocalDateTable_…`).

### DAX measures (`ARTIFACT/dax_measures.csv`)

All five sit on `insights list`:

| Measure | Expression |
| --- | --- |
| Med Importe Gastado | `SUM('Performance - Data Base PA'[Importe gastado (USD)])` |
| Med Recuento Fuente | `COUNT('insights list'[Fuente - Trato])` |
| Costo por Cierre | `DIVIDE([Med Importe Gastado],[Med Recuento Fuente])` |
| Med Recuento Trato | `COUNT('insights list'[Trato])` |
| Reservas Mes Anterior | `CALCULATE(CALCULATE([Med Recuento Trato], DATEADD(FILTER(DATESMTD(Calendario[Date]), Calendario[Date] <= TODAY()), -1, MONTH), Calendario[Date] <= TODAY()))` |
| % Variación Mensual | `DIVIDE([Med Recuento Trato],[Reservas Mes Anterior])-1` |

GE’s prose simplifies `Reservas Mes Anterior` to `PREVIOUSMONTH`. The expression above is the one in the extract. It uses `TODAY()` and `DATESMTD`.

### Schema columns that the visuals bind

`Performance - Data Base PA`: Fecha, Nombre de la cuenta, Nombre de la campaña, Alcance, Impresiones, Clientes potenciales, Divisa, Costo por cliente potencial, CTR (todos), Frecuencia, Clics (todos), CPC (todos), Importe gastado (USD), Configuración de atribución, Presupuesto de la campaña, Tipo de presupuesto de la campaña, Presupuesto del conjunto de anuncios, Tipo de presupuesto del conjunto de anuncios, Inicio del informe, Fin del informe.

`insights list`: Asunto, Tipo, Asignado al usuario, Estado, Fecha de añadición, Fecha de vencimiento, Trato, Proyecto, Fuente - Trato, Fuente - Persona, [Meta] Campaign Name, [Meta] Ad Name, Etapa.

`Inventarios`: Proyecto, Nivel, `Número ` (trailing space), Tipo, `M² `, Habitaciones, bodega and parking columns, price columns through Precio de Venta, Estatus, Fecha de reserva, plus Column28–Column31.

`Presupuesto`: Fecha, Mes, Proyecto, Concepto, Proveedor, Inversión, Tipología, Frecuencia, Responsable. This shape does not match either budget workbook in this directory. Those workbooks are month-by-month matrices (Presupuestado / Real Ejecutado), not a row-per-line `Inversión` table.

`Calendario`: Año, Mes, Dia, Semestre, Cuatrimestre, Trimestre, Bimestre, Semana, NombreDía.

## Source workbooks inside the PBIX folder

These are the files the plans examine, and the files Power Query names, except the missing presupuesto workbook.

### `Performance-Report-Puerta-Abierta.xlsx` (1,265,319 bytes)

One sheet, `Performance - Data Base PA`. 9,329 data rows, 20 columns. `Fecha` from 2024-07-05 to 2026-08-04. Accounts: Bosque Las Tapias 1,868; Boulevard5 2,402; Benestare 1,939; Puerta Abierta 1,072; Santa Elena 1,133; Casa Elisa 915. 137 campaigns. `Divisa`: GTQ 6,012; USD 3,317. GE states that `Importe gastado (USD)` and `Costo por cliente potencial` are already in USD on this sheet. That claim is GE’s, from a diff check in the plan, not re-run in this pass.

Header uses `Fecha` and `Costo por cliente potencial`. This is the sheet the model loads.

### `Reservas Totales PA - Report.xlsx` (46,959 bytes)

`insights list`: 379 data rows, 13 columns. `Fecha de vencimiento` 2023-03-03 to 2026-08-03. `Hora de añadición` 2024-02-29 to 2026-08-03. Proyecto counts: Créditos BLV5 191, Créditos Benestare 97, Créditos BLT 57, Benestare 17, Bosque Las Tapias 9, Boulevard5 6, Créditos Casa Elisa 1, Créditos Santa Elena 1. Estado: Finalizada 377, Tareas pendientes 2. Sample rows show `Fuente - Trato` holding combined values such as `Meta Ads, Formulario Meta` while `Fuente - Persona` holds a single label, sometimes blank.

`Hoja1`: a small manual allocation, not a reservation list.

| Project | Lines | Figures in column D |
| --- | --- | --- |
| Bosque Las Tapias | META Leads BackUp 1000, Leads Generation 2000, Whatsapp 500, Website 500; Tik Tok Interacción 50, Leads 150 | `=SUM(D5:D10)` |
| Benestare | META Interacción 100, Whatsapp 200, Leads Generation 1500 | `=SUM(D14:D16)` |
| Boulevard 5 | META Website 500, Whatsapp 500, Leads Generation 2500, Leads Back Up 1000 | `=SUM(D20:D23)` |

GE reads those sums as 4,200 / 1,800 / 4,500. They are not the Presupuesto Mercadeo screenshot (20,562.62 / 16,388.17 / 30,930.00).

### `Análisis de Inventarios.xlsx` (112,189 bytes)

`Inventarios`: 814 data rows, 31 columns. `Hoja1` is empty. Projects: Boulevard5 298, Benestare 282, Bosque Las Tapias 234. Several headers carry a trailing space (`Número `, `M² `, `Parqueos `, `Precio sin imp `). `Bodega` / `NUEVA UBICACIÓN` is split across a line break inside the header.

`Estatus` raw counts, before any trim: PCV 486, `PCV ` 11, Disponible 194, `Disponible ` 1, Congelado 66, Reservado 46, `Reservado ` 1, CD 5, Liberado 2, Congelado Junta Directiva 1, `Congelado Junta Directiva ` 1. Trimmed, that is PCV 497, Disponible 195, Congelado 66, Reservado 47, CD 5, Liberado 2, Congelado Junta Directiva 2. That matches the funnel in the screenshot and in GE.

### `2026 - Presupuesto Mercadeo PAI (2).xlsx` (59,956 bytes)

Sheets: Puerta Abierta, Hoja1 (hidden), Boulevard 5, Benestare, Bosque Las Tapias, Santa Elena, TOTAL, DASHBOARD, GUIA DE USO (hidden). Exchange rate cell: `Tipo de cambio Q/USD` = 7.8. Each project sheet is a month matrix, ENERO through the later months, with Presupuestado and Real Ejecutado in quetzales. DASHBOARD row reads `TOTAL PRESUPUESTADO 6M` as `=TOTAL!Z10`, `TOTAL EJECUTADO 6M` as `=TOTAL!AA10`, and `% EJECUCIÓN GLOBAL` as `=IFERROR(TOTAL!AA10/TOTAL!Z10,0)`. `Hoja1` is broken external lookups: `=VLOOKUP(A1,'[1]P&L'!$F:$H,2,0)` and the same pattern for Impresiones, Artes, Social Media Admón.

Partidas on this older copy (column A below the month header):

- Puerta Abierta: Zapier Inc, Meta (facebook), TikTok publicidad, Wati (Whatsapp Busines), Impresiones, WEB Site, Pauta Digital, Otros Medios Tradicionales, Lanzamiento y Promoción, CRM y Venta (Pipedrive OU), TOTAL GASTOS DE MERCADEO.
- Boulevard 5 adds Artes, Social Media Admón., Lanzamiento y Eventos, Market Scan, CRM / Pipedrive, Meta Ads, video, Wati, Amazon Music, Ortto, Google Ads, brochure, vallas, Freepik, Envato, Adobe, LinkedIn Ads, Tik Tok Ads, relaciones públicas, Runway, Midjourney, Higgsfield, LiiD Oy, Inteligencia Artificial.
- Benestare, Bosque Las Tapias, and Santa Elena use the same family of partidas. Bosque Las Tapias spells one row `Integencia Artificial`. Santa Elena has both `Estrategia digital` and `Inteligencia Artificial`. Several rows are labeled `Google Ads / no tenía presupuesto` or `Producción Video / no tenía presupuesto`.

This workbook is not the `Presupuesto` sheet the M script loads. Both plans already say the screenshot totals 20,562.62 / 16,388.17 / 30,930.00 are not the obvious totals of this file.

### `GA - Performance Report Puerta Abierta (4).csv` (431 bytes)

Three lines, no data rows. Title, the range “1 de noviembre de 2025 - 6 de agosto de 2026”, and a Google Ads header (cuenta, cliente, mes, día, campaña, grupo de anuncios, clics, impresiones, CTR, moneda, CPC, costo, impression share, conversiones, CPM, costo/conversión). Both plans treat it as unused. The model’s M script does not load it.

### Photographs

`DSC03508.jpg` and `DSC03530.jpg` are studio portraits of a man in a navy suit. They are not pages of the report. They contain no table, chart, or metric.

## Files at the directory root that the plans do not use

### `Performance-Report-Puerta-Abierta (27).xlsx` (1,007,405 bytes)

One sheet, `Raw Data Report`. 9,306 data rows. `Día` from 2024-09-10 to 2026-10-09. Accounts: Boulevard5 2,540; Bosque Las Tapias 2,147; Benestare 1,932; Santa Elena 1,010; Puerta Abierta 896; Casa Elisa 781. 141 campaigns. Divisa GTQ 5,985, USD 3,321. Same metric set as the model sheet, with two renames: `Día` instead of `Fecha`, `Coste por cliente potencial` instead of `Costo por cliente potencial`. A later snapshot, not the table the PBIX loaded.

### `activities-insights-25046793-274.xlsx` (67,490 bytes)

One sheet, `insights list`. 407 data rows, all `Actividad - Tipo` = Reserva. `Actividad - Fecha de vencimiento` 2023-03-03 to 2026-10-07. `Actividad - Hora de añadición` 2024-02-29 to 2026-10-06. Embudo: Créditos BLV5 198, Créditos Benestare 115, Créditos BLT 74, Benestare 11, Bosque Las Tapias 5, Boulevard5 2, Créditos Casa Elisa 1, Créditos Santa Elena 1. Columns are prefixed (`Actividad -`, `Trato -`, `Persona -`) and add fields the PBIX table does not have: Valor del trato, Zona/Lugar de Vivienda, Zona de interés, Edad, Profesión, Ingreso Real, Ingreso Aproximado, Estado Civil, Número de Hijos. Later and wider than `Reservas Totales PA - Report.xlsx`.

### `02  08.26 Ejecución Presupuesto Mercadeo PAI.xlsx` (64,737 bytes)

Same sheet set as `2026 - Presupuesto Mercadeo PAI (2).xlsx`, still at FX 7.8, still a month matrix. Slightly larger. Puerta Abierta gains `Social Media Admon.` and `Estrategia Digital`. The other project sheets gain `Estrategia Digital` (Santa Elena already had a similarly named row). Bosque Las Tapias spells the AI row `Inteligencia Artificial` here. `Hoja1` still points at `'[1]P&L'`. Same conclusion: this is not the `Presupuesto[Inversión]` table behind the screenshot.

### `GA - Performance Analytics PA.csv` (413,124 bytes)

UTF-16 LE with BOM. Despite the `.csv` extension, fields are tab-separated. Title `GA - Performance Analytics PA`. Range on line 2: 1 de enero de 2025 – 9 de octubre de 2026. 1,046 data lines. Accounts: Santa Elena 312, Bosque Las Tapias | Apartamentos Zona 18 308, Benestare Zona 6 187, Boulevard 5 GA 121, Casa Elisa 118. Campaigns seen: `SEM`, `Lead-a`, `Leads-Search-1`, `Leads-es`, `Campaign #1`, `cons_guat__kpa_GoogleLeadsStElena_ga_lds_cpl_AO`. Header includes cuenta, cliente, mes, día, campaña, clics, impresiones, interacciones, CTR, moneda, CPC, costo, conversiones, impression share, CPM. Neither plan read this file. The empty GA file next to the PBIX is a different export. This file does not, by itself, prove that any PBIX visual uses Google Ads. The M script does not load a GA source.

### `Linkedin_campaign_478626024_creative_performance_report.csv` (11,648 bytes)

UTF-16. Report window 1 Nov 2025 00:00 through 9 Oct 2026 23:59, created 9 Oct 2026 22:59. One campaign: `cons_guat__kpa_LinkedInLeadGenSTEL_ink_lds_cpa_AO`, id 881306834, account Puerta Abierta Inmobiliaria, currency USD, status En pausa, campaign start 30 Jan 2026. Ad set `kpa_LinkedInLeadGenSTEL_AO_abierta`, id 478626024, objective Generación de contactos. Four creatives are visible in the file (`…Estatico`, `…Estatico3`, `Duplicar_…Estatico3`, `…Estatico2`), landing on `https://santaelena.gt/`. 79-field LinkedIn creative export. Quoted cells contain line breaks, so a raw line count overstates the row count. Not in the PBIX model. Neither plan mentions it.

## Prior HTML rebuild (not the source of truth)

`ARTIFACT/Performance_Dashboard_Puerta_Abierta.html` is a single-page Spanish reconstruction. `ARTIFACT.zip` contains that HTML plus `power_query.m`, `dax_measures.csv`, `schema.csv`, `relationships.csv`, and `build_data.py`. No `data.json` is in the folder. The HTML inlines the payload as `window.__PA_DATA__` with `epoch` 2024-07-05, `refreshed` 2026-08-04, and `perfSourceRows` 9329. Accounts in the payload: Benestare, Bosque Las Tapias, Boulevard5, Casa Elisa, Puerta Abierta, Santa Elena.

`build_data.py` rebuilds that payload with `pbixray` from a PBIX path that is not this directory (`/mnt/user-data/uploads/…`). It aggregates daily ads to (fecha, cuenta), campaigns to (mes, cuenta, campaña), and keeps reservations, inventory, and presupuesto at row level. It preserves unweighted averages as (sum, n) pairs. It separates the campaign `cons_guat__kpa_LeadsWebsiteBoulevard_fb_lds_cpa_11noval20nov` into `exclDaily` instead of dropping it silently.

The HTML’s own page list is Performance Ads, Inversión / Reservas (source page Performance S), Reporte Reservas, Inventarios, Presupuesto. On the reservas page the code comment says spend is not attributed by source in the model and that the split shown there is proportional. That is a rewrite, not the PBIX measure. Do not copy numbers or attribution from this HTML when the mission is to reproduce the Power BI pages. Use it as a hint that someone already tried a partial rebuild, and as a carrier of the extracted model metadata.

## Visual inventory the plans assign to each page

Confirmed page names are from the PBIX. The visual list below is the union of what GR describes from the screenshots and what GE binds to `visual.json`. Where they disagree, the conflict is in `02-conflicting-actions.md`, not repeated as fact here.

### Performance Ads

Slicers: account pills (Benestare, Bosque Las Tapias, Boulevard5, Puerta Abierta, Santa Elena), date between on `Fecha`. Screenshot range both plans use: 2026-01-01 to 2026-07-31. GE says the file was saved with 2026-06-01 to 2026-07-31, and that a page filter excludes `cons_guat__kpa_LeadsWebsiteBoulevard_fb_lds_cpa_11noval20nov`.

Visuals both name: three cards (Sum of Alcance, Sum of Importe gastado, Sum of Clientes potenciales), table Detalle de Pauta, pie Clientes potenciales por proyecto, columns Clientes Potenciales por Día, columns Promedio de Costo por Lead (CPL) / Proyecto, line Tendencia Costo por Cliente Potencial, bar Inversión en Pauta, treemap Top Campañas, line Gestión de Presupuesto. Logo and title are static.

Headline figures both cite for that date range: Alcance shown as 22M, spend shown as $81.67K, leads shown as 24K. GE’s exact card values are 22,082,106 / $81,665.83 / 24,360, and the table total row repeats alcance 22,082,106, impresiones 28,026,414, leads 24,360.

### Performance S

One combo, Inversión en Pauta vs. Reservas Mensuales. Columns are a reservation count by month. The line is Sum of Importe gastado (USD). Both read Jan–Jul as 21, 10, 19, 15, 15, 16, 23 reservations and the spend labels $11.2K, $10.5K, $11.3K, $13.2K, $13.5K, $10.9K, $11.1K. The screenshot also shows agosto as 1 reservation and $1.3K. Slicers: date hierarchy Año / Trimestre / Mes / Día, and Proyecto.

### Reporte Reservas

Both name: column chart of fuente, card Count of Trato = 119, a month matrix with Med Recuento Trato and Reservas Mes Anterior (enero 21 and 13, febrero 10 and 21, total 119 and 16), a fuente table with count, spend, and Costo por Cierre (total spend $81,665.83 and total costo 686.27), a line of deals by month, and a bar of etapa by asesor. Slicers: proyecto pills including the Créditos pipelines, and a date range 2026-01-01 to 2026-07-31. They disagree on the fuente bar labels and on the per-row spend assignment. See the conflict note.

### Integración de Inventarios

Both name: status funnel (PCV 497, Disponible 195, Congelado 66, Reservado 47, CD 5, Congelado Junta Directiva 2, Liberado 2), treemap of estatus by tipo, a unit detail table, typology cards (A 91, A PLUS 3, A1 6), and a card labeled Utilidad Bruta showing Q620.5M. Proyecto control and a date hierarchy on Fecha de reserva. GE says the proyecto control is a table, not a slicer, and that the treemap is filtered to Disponible, Congelado, and Congelado Junta Directiva.

### Presupuesto Mercadeo

One table. Proyecto and Sum of Inversión: Benestare 20,562.62, Bosque Las Tapias 16,388.17, Boulevard 5 30,930.00, total 67,880.79. Both plans say these figures are not the obvious totals of the supplied budget workbook.

### Página 1

A campaign table (Nombre de la campaña, Sum of Clientes potenciales) and a date slicer. The screenshot shows 2026-01-01 to 2026-04-07 and a total of 1, with most campaign rows blank or 1. Both plans call the page unfinished. GE calls it a scratchpad used to isolate the excluded campaign.

## Model defects GE records, which GR describes as open questions

These are not yet agreed actions. They matter because a literal copy will reproduce them.

- CPL visuals use `AVERAGE` of `Costo por cliente potencial`, which skips nulls and weights each row equally. GE’s weighted alternative (`SUM(spend) / SUM(leads)`) moves Puerta Abierta from $1.55 to $6.29.
- `Costo por Cierre` divides account-level spend by deal count through the many-to-many on project name. `Créditos …` values do not match `Nombre de la cuenta`, so some fuentes get a blank cost and others share the same spend. Row spend in GE’s reconciliation adds to more than the $81,665.83 total.
- The card labeled Utilidad Bruta is `SUM(Precio de Venta)` across all 814 units, sold and unsold. GE’s figure is Q620,526,600.00.
- Alcance summed across days is not deduplicated reach. Frecuencia on the detail table is an unweighted average.
- Empty `Fuente - Trato` values arrive as `""`. DAX `COUNT` / `COUNTA` counts them. A SQL null does not.

## Practical rule for the next build

Reproduce Performance Ads sums first, from `Performance-Report-Puerta-Abierta.xlsx` inside the PBIX folder, for 2026-01-01 through 2026-07-31, with the rogue campaign excluded the way the page filter excludes it. Do not start from the October Meta file, the October activities file, the HTML’s proportional fuente split, or either budget matrix. The presupuesto table stays blocked until `Presupuestos - Puerta Abierta.xlsx`, or an equivalent `Inversión` table, is in the directory.
