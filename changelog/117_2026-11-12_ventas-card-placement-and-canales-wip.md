# 117 — Inventario and desistimientos back in the column, and Ventas por canales marked not ready

**Date:** 2026-11-12
**Route:** `/ventas` command center only.
**Scope:** Two presentation fixes on that page. No SQL, no loader, no vista builder, no API, no new request, no write to the database.

This file is the record of that work. It was written after both commits below and is not part of either commit.

| Commit | Time | Message |
|---|---|---|
| `a5c8e0e` | 2026-11-12 16:42 −0600 | Give the inventario and desistimientos groups their own class, so those cards stay full width in the Ventas column. |
| `9210d8a` | 2026-11-12 17:27 −0600 | Mark Ventas por canales as not ready, so the wrong channel counts read as a placeholder and cannot be clicked. |

`npx tsc --noEmit` was not run. `npm run build` was not run. No dev server was started, no browser was opened, and the database was not queried or written. After the class rename, the IDE reported no linter errors on `lower-bands.tsx` and `lower-bands.module.css`. Lints were not read again after the stripe.

`a5c8e0e` also contains `changelog/115_2026-11-12_ventas-por-canales.md` and `changelog/116_2026-11-12_ventas-bands-below-canales.md`. Both files were already staged when the class rename was committed, so they rode along. Their content records earlier chats. It is not this work. `84fca73` is the restyle those notes describe. This chat starts from the page that commit left behind.

## What was asked

Two separate requests, in this order.

1. The cards titled “Inventario general por proyecto”, “Desistimientos por motivo”, and “Desistimientos por proyecto” were covering the opening charts. A screenshot of `/ventas` showed those three titles, and the torre rows under the inventario card, painted over the left side of “Todos los Proyectos” and the asesor bars (Erwin Cardona, Ivan Castillo, Javier Soto). Counts such as `9 3 9` and `14 44` sat out to the right of the narrow cards. The request was to correct that placement, and to ask where they should sit before editing.

2. After that fix was committed, “Ventas por canales” was still showing the wrong counts. The request was to say so visually, on that subsection only, with a subdued diagonal stripe of the kind used for a placeholder that is not ready. The example was a 45-degree repeating gradient of `#f9fafb` and `#ffffff` in 10px bands, a dashed `#d1d5db` border, opacity `0.7`, and `pointer-events: none`.

## What was decided before the first edit

The mount order in `command-center.tsx` was already the order from `84fca73`. The cards were in the right place in the document. They were in the wrong place on the screen because CSS had taken the groups out of the column.

The question put to the page was where the three named cards should sit, and what to do with “Inventario general por torre”, which shares the inventario group and was covering the charts in the same screenshot. The choice was to put them back in the page flow, full width:

- Inventario general por proyecto, then Inventario general por torre, after Tasa de conversión.
- Desistimientos por motivo, then Desistimientos por proyecto, after Valor de proyecto.

No other order was chosen. No card was moved in `command-center.tsx`.

## What this does not change

Mercadeo, Cobros, Créditos, and Entregas are untouched. `src/app/(panel)/mercadeo/operativo-view.tsx` and `scripts/creditos/load.py` were already dirty in the work tree and are not in either commit.

On Ventas, the filter battery is untouched: project pills, Periodo, Asesor, Torre, Restablecer, the period line, the freshness stamp, and the rule under the battery. The sticky behavior is untouched.

The eight bands that `116` froze above the lower charts stay frozen, except the one named in the second request. “Ventas por canales” keeps its title, its dot plot, its sort, its scale, its colors, and the reserva counts it already draws. The stripe does not change a number. Tasa de conversión, both inventario cards, Ventas por modelo, Valor de proyecto, both desistimiento cards, the four control cards, Control Referidos, and the two detail tables keep the drawing `84fca73` gave them.

`command-center.tsx` is not in either commit. The hairlines stay where they were. A pair still has no hairline between its two cards. Brecha contra el ritmo stays inside the JSX comment.

The vista payloads are untouched. `byFuente` is untouched. `channelRows` is untouched. A channel name still calls `toggleFocus({ kind: "fuente", id, label })` when the button can receive the click. The stripe is what stops that click. Inventario still filters by proyecto and by torre. Desistimientos por proyecto still filters by proyecto. Desistimientos por motivo still has no click.

The older section page at `/ventas/ventas-por-canales` is untouched. `glance-view.tsx` still draws `vista.channels` as bars under the heading “Ventas por canal”, and `vista.series` as “Los cuatro canales, mes a mes”. That heading is the singular form. The band marked on the command center is the plural form, “Ventas por canales”.

## Files

| File | Commit | What changed |
|---|---|---|
| `src/app/(panel)/ventas/lower-bands.module.css` | `a5c8e0e` | The layout rule is renamed from `.stack` to `.pair`. The bar rules that were also named `.stack` stay `.stack`. |
| `src/app/(panel)/ventas/lower-bands.tsx` | `a5c8e0e` | The wrapper around the two inventario cards, and the wrapper around the two desistimiento cards, use `styles.pair`. The colored stack inside an inventario bar still uses `styles.stack`. |
| `src/app/(panel)/ventas/landing-blocks.module.css` | `9210d8a` | New `.channelWip`, placed after `.statusPlot` and before `.channelFrame`. |
| `src/app/(panel)/ventas/landing-blocks.tsx` | `9210d8a` | `CanalesBlock` adds `styles.channelWip` on the same `<section>` that already has `styles.block` and `styles.panel`. |

`a5c8e0e` is 343 insertions and 3 deletions only because the two older changelog files were in the index. The class rename itself is two lines in the stylesheet and one line in each of the two wrappers. `9210d8a` is 9 insertions and 1 deletion.

## 1. Why the cards covered the opening charts

`lower-bands.module.css` used the local name `stack` for two different things, and a CSS module hashes a local name once. Every rule written `.stack` in that file compiles to the same exported class. Both elements received every rule.

The layout rule, which is now `.pair`, was:

```css
.stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
```

The bar rules, which are still `.stack`, were and are:

```css
.bar,
.stack {
  position: absolute;
  top: 50%;
  left: 0;
  border-radius: 2px;
  transform: translateY(-50%);
}

.plotProject .stack { height: 44px; }
.plotRow .stack { height: 26px; }

.stack {
  display: flex;
  min-width: 2px;
  overflow: hidden;
}
```

Two wrappers used that class:

- `InventarioBands` returns `<div className={styles.stack}>` around “Inventario general por proyecto” and “Inventario general por torre”.
- `DesistimientosBands` returns `<div className={styles.stack}>` around “Desistimientos por motivo” and “Desistimientos por proyecto”.

A third use is the mark, and it is supposed to be absolute. Inside `StackChart`, a non-zero row draws a `span` with `styles.stack` and a width of `pct` percent, and puts one `.seg` in it per non-zero state. Disponible, congelado, and vendido stay in that span. A zero total still draws `.zeroTick` and the number 0, and does not use `.stack`.

Because the wrappers shared the class, each group was `position: absolute; top: 50%; left: 0; transform: translateY(-50%)`, with `overflow: hidden` and `min-width: 2px`. An absolute element is taken out of the column, so the groups no longer took a full-width slot under Tasa de conversión and under Valor de proyecto. Both groups used the same `left` and `top`, so they occupied one place and covered each other. The screenshot is that place: the left of the reservas and asesor charts, with the torre rows (Benestare · E, Bosque Las Tapias · B, Bosque Las Tapias · C, Santa Elena · Sin dato) still inside the inventario group.

The height rules did not apply to the wrappers. `.plotProject .stack` and `.plotRow .stack` match only a `.stack` that sits inside those plot classes. The wrappers do not.

The same coupling also reached the bar. The layout rule’s `flex-direction: column` and `gap: 8px` applied to the segment span. Segments are meant to sit in a row: each `.seg` is `flex: 1 1 0`. After the split, the span no longer receives the column direction or the 8px gap. It still receives `display: flex`, `min-width: 2px`, `overflow: hidden`, the absolute offsets, and the 44px or 26px height when it is inside `.plotProject` or `.plotRow`. That side effect was not given its own visual check.

## 2. The class split — `a5c8e0e`

The layout rule is renamed `.pair`. Its declarations are unchanged: a column, an 8px gap, `min-width: 0`.

`InventarioBands` and `DesistimientosBands` now render `<div className={styles.pair}>`. The pending state of each function is still a single `.band` with no pair wrapper. “Inventario general” and “Desistimientos”, the titles used while the vista is null, are unchanged.

`.vc-command` is a column flex with the default `align-items: stretch`. A `.pair` in that column stretches to the column width. The two cards inside a pair stay 8px apart. The page order is the order already mounted:

1. Ventas por canales (`CanalesBlock`)
2. Tasa de conversión
3. Inventario general por proyecto, then Inventario general por torre
4. Brecha contra el ritmo, still commented out
5. Ventas por modelo
6. Valor de proyecto
7. Desistimientos por motivo, then Desistimientos por proyecto
8. Descuentos, Subidas de precios, F&F y casos especiales, Promociones, still in `.vc-grid-2`
9. Control Referidos
10. Tratos que todavía no son venta, then Detalle de ventas

“Inventario general por torre” was not named in the request. It is the second card of the inventario pair, so the same class puts it back under the proyecto card. The user confirmed that.

The segment span at the non-zero branch of `StackChart` still uses `styles.stack`. `.bar` is untouched. Project hues, segment colors, the legend, the asesor sentence “El inventario no se parte por asesor.”, the empty sentence, and the notices are untouched.

## 3. The stripe on Ventas por canales — `9210d8a`

`CanalesBlock` is the only component that gained a class. The section is now:

```tsx
<section className={`${styles.block} ${styles.panel} ${styles.channelWip}`} aria-labelledby="vt-canales-title">
```

The title node is unchanged: `<h2 id="vt-canales-title" className={styles.panelTitle}>Ventas por canales</h2>`. There is still no caption under the title. The error line, the “Cargando…” line, and `ChannelPlot` are the same children. The stripe wraps all of them, because the class is on the section. An empty `byFuente` still renders the title and nothing else, and that title sits on the stripe.

`.channelWip` is:

```css
.channelWip {
  background: repeating-linear-gradient(45deg, #f9fafb, #f9fafb 10px, #ffffff 10px, #ffffff 20px);
  border: 1px dashed #d1d5db;
  opacity: 0.7;
  pointer-events: none;
}
```

`.panel` and `.channelWip` are each one class. `.channelWip` comes later in `landing-blocks.module.css`, so its background replaces `var(--color-card)` and its border replaces the solid `var(--color-border)` border. `.panel` still supplies the 8px padding and the 8px radius. `.channelWip` does not set a radius. Opacity `0.7` fades the stripe, the dashed border, the title, and the dot plot together.

`pointer-events: none` is on the section, so the section and the channel-name buttons inside it are not the event target. A click on a channel name does not call `onFuente`, and therefore does not call `toggleFocus({ kind: "fuente" })`. The handler is still passed into `ChannelPlot`. Removing `.channelWip` would let those buttons work again. The rest of the page is not under this rule. A name on inventario, desistimientos por proyecto, tasa, or a status chart still filters the detail.

No other band imports or uses `.channelWip`. Status de todos los proyectos, the goal bands, and the lower cards keep `.panel` or `.band` as they were.

The counts were not corrected in this chat. The stripe is only the signal that the band is not ready.
