# Ventas secondary menu

How to show the 13 Ventas sections without giving them a second row or a side column.

Written 2026-10-02 for the `/ventas` reorganization. This is a recommendation, not an implementation.

## The list

These items belong only to Ventas, in this order:

1. Ventas totales
2. Objetivos de ventas
3. Status de ventas
4. Ventas por canales
5. Análisis de inventario
6. Inventario general
7. Valor del proyecto
8. Tasa de conversión
9. Desistimientos
10. Descuentos
11. Subidas de precios
12. F&F y Casos especiales
13. Promociones

The primary bar already owns the five areas (Ventas, Mercadeo, Cobros, Créditos, Entregas). This list is local navigation inside Ventas.

## Sources that loaded

- Evan Sunwall, [Tabs, Used Right](https://www.nngroup.com/articles/tabs-used-right/), Nielsen Norman Group, 2 August 2024, last reviewed 2 September 2026.
- Page Laubheimer, [Menu-Design Checklist: 17 UX Guidelines](https://www.nngroup.com/articles/menu-design/), Nielsen Norman Group, 7 June 2024.
- Kara Pernice and Raluca Budiu, [Hamburger Menus and Hidden Navigation Hurt UX Metrics](https://www.nngroup.com/articles/hamburger-menus/), Nielsen Norman Group, 26 June 2016. The study covered 179 people on 6 live sites, desktop and phone.

Two fetches did not yield usable text, so they are not cited as evidence: Apple’s tab-bar guideline page returned an empty document, and `https://baymard.com/blog/secondary-navigation-ux` returned a 404.

## What the research says

**A tab list has to stay short, on one row, with short labels.** When the list overflows, it becomes a carousel. The hidden tabs are harder to discover, and reaching them costs an extra gesture. Stacking tabs onto a second row is worse: the selection mark sits between two labels, and moving the selected tab next to its panel destroys the user’s memory of where things were. Labels should be one or two words, in sentence or title case, not all caps. The selected item needs at least two visual cues, not a slight color change. Unselected items still have to be readable. (Sunwall.)

**Local navigation should be visible, and it should say where you are.** On a desktop site, local navigation for a cluster of related pages is expected along the left. Hiding a whole menu on a large screen is the wrong default: out of sight means out of mind, and an open menu must not cover the page. Submenus open on click, not hover. The current location has to be marked. Long pages should keep the menu reachable, which is the case for a sticky bar. (Laubheimer.)

**Hiding every item is measurably worse, and hiding only the overflow is close to showing everything.** On desktop, people used a fully hidden menu in 27% of tasks and a visible or partly visible menu in about 50%. Content discoverability dropped more than 20% when the menu was hidden. Task time on desktop was at least 39% longer. A combination — some links visible, the rest behind a control — was used about as often as a fully visible menu. On a phone the penalty is smaller, and more than four top-level links is the point where hiding some of them is the reasonable trade. An icon alone has weak information scent: it does not say what is inside. (Pernice and Budiu.)

The left-rail advice and the “don’t spend the width” constraint pull in opposite directions. For a chart-and-table workspace, width is the content. A persistent column of 13 labels spends that width on every visit. The research still forbids hiding the whole list on desktop.

## What not to do here

- **A second wrapped row of all 13.** Several labels are three or four words. They will wrap. That is the stacked-tab problem, and it spends the vertical space this menu is supposed to save.
- **A horizontal carousel of all 13.** The items past the fold are the ones people stop finding.
- **A left sidebar.** Correct for a long document site. Expensive here, because every Ventas view is a report.
- **One chevron that hides all 13, with no label.** That is the desktop hamburger result: used less, used later, and the icon does not say “Ventas sections.” The account chevron can stay rare. This list is the work.
- **An accordion of 13 dashboards.** Accordions fit short blocks such as questions and answers. They do not fit thirteen reports.
- **All caps, to match the primary bar.** Fine for five short area names. Harmful for these longer labels.

## Recommendation

One sticky row under the primary bar, and nowhere else. About 40 pixels tall. It never wraps.

On a wide screen the row shows the current section, then as many of the following items as fit at a readable size, in the order above. Whatever does not fit goes behind a control labeled **Más**, with a caret, on the same row. Opening it shows the remaining items in a glass panel anchored to that control. The panel does not cover the page. It opens on click, including on a keyboard. The current item stays visible in the row even when it lives in that panel.

On a phone, where more than four links is the researched cutoff, the row shows only the current section name and **Más**. Same panel.

Mark the current item with two cues: weight, and the same lens already used on the primary bar. Keep this row visually quieter than the primary capsule so the two levels are not one control. Use sentence case.

Give each item its own path under `/ventas`, so the row is navigation rather than an in-page switch, and a link can be shared. Do not mix “stay on this page” and “go to another page” inside the same control.

Do not regroup or reorder the 13 until someone has used them. The order above is the order to ship.
