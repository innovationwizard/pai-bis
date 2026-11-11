# 111 — Sticky filter battery on Mercadeo and Ventas

**Date:** 2026-11-11
**Routes:** `/mercadeo` and `/ventas`. The same Mercadeo component also renders the reporte section view.
**Scope:** The command-center filter header on those two departments, the shared CSS that pins it, and the command-center SDD. No SQL, no loader, no vista builder, no write to the database. This chat did not commit.

`npx tsc --noEmit` passed after the edits (exit 0). The only console line was npm’s warning about an unknown `devdir` env config. `npm run build` was not run. No dev server was started, no browser was opened, and the database was not queried or written.

`.gitignore` ignores `docs/`, so the SDD paragraphs are on disk and are not a tracked file. Changelog 110 later records that commit `5d778a6` also contains the Ventas class and the `.cc-filter-battery` rule, and that Mercadeo’s operativo view was still uncommitted when that note was written. This chat did not make that commit and did not re-check the git history.

## What this does not change

Cobros, Créditos, and Entregas are untouched.

Ventas section pages, `glance-view.tsx`, and `board.tsx` are untouched. Their toolbars are not sticky.

Mercadeo `glance-view.tsx` and `directivo-view.tsx` are untouched. The directivo early return in `operativo-view.tsx` still renders `DirectivoView` and never reaches the new header. The empty `op-screen` shown while the home tier is loading is also unchanged.

Filter behavior is unchanged. Period presets, the custom Desde / Hasta pair, project selection, Asesor, Torre, Restablecer, the freshness line, and the separator are the same controls with the same handlers. Nothing was added to Mercadeo to make its toolbar match Ventas. Mercadeo still has no project pills, no Asesor, no Torre, and no Restablecer.

No collapsed state, compact bar, max-height, or overflow hidden was added on the battery itself. A custom period still inserts Desde and Hasta and the header grows to fit them.

Chart markup, card copy, and the lower Ventas bands are untouched. Those belong to other changelogs from the same day.

## Files

| File | Change |
|---|---|
| `docs/SDD-Department-Command-Centers.md` | The sticky-battery rule, twice: once in the shared layout, once in the experience list. |
| `src/app/globals.css` | New `.cc-filter-battery`, and `overflow: auto` on an `.op-screen` that contains it. |
| `src/app/(panel)/ventas/command-center.tsx` | The existing `vc-head` also carries `cc-filter-battery`. |
| `src/app/(panel)/mercadeo/operativo-view.tsx` | The existing toolbar and its rule are wrapped in that header. |

## The rule in the SDD

Section 3, after the sentence that places a line break and a horizontal separator under the filters:

> On single long-scroll Command Center pages the entire filter battery (project pills + Periodo / Asesor / Torre / Restablecer) must remain sticky at full height directly under the top navigation. No collapse or compact mode. Implemented first on Mercadeo and Ventas.

Section 6 repeats that sentence as an experience bullet, after “Filter battery ends with a line break and elegant horizontal separator before content.”

The older section 3 sentence is still there: optional filters “sit in a compact header.” The new rule forbids a compact mode. Both sentences are now in the same section. The older one was not rewritten.

## Why `top: 0` is already under the navigation

Department pages do not scroll the window. `main:has(.section-page)` is `height: 100dvh` and `overflow: hidden`. The top navigation is `SiteNav` → `Panel`, the `.section-header` sibling, and it is `flex: none`. The page body, `.section-page-body`, is the scrollport (`overflow: auto`).

`position: sticky; top: 0` therefore pins the battery to the top of that body. The navigation is outside the scrollport, so the stuck battery sits directly under it. No offset equal to the nav height was added.

## The shared class

```css
.cc-filter-battery {
  position: sticky;
  top: 0;
  z-index: 30;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-bg);
}

.op-screen:has(> .cc-filter-battery) {
  overflow: auto;
}
```

`flex: none` is `0 0 auto`. In a height-constrained column the battery keeps its content height. It does not shrink into a compact strip.

`display: flex`, `flex-direction: column`, and `gap: 8px` repeat what `.vc-head` already set, and they match `.op-screen`’s column gap. Putting the Mercadeo toolbar and rule inside the header does not add a second gap and does not remove the one the screen used to put between those two siblings. The rule’s own margin is still `8px 0 2px`, so the space above the stroke is still the 8px gap plus that top margin, and the space below it is still the 2px bottom margin plus the parent’s 8px gap.

`background` is `var(--color-bg)`, which `@theme` sets to `#f6f8fb`, the same color as `body`. The sticky box is opaque, so a chart scrolling underneath does not show through the pills, the toolbar, the gaps inside the header, or the rule.

`z-index: 30` puts that box above the charts. `.op-overlay` is `position: fixed` at `z-index: 40`, so Mercadeo drawers and the reservas modal still cover the battery. Those overlays were not edited.

There is no max-height and no overflow on `.cc-filter-battery`. The project menu can still drop out of the toolbar. The header grows when Desde and Hasta appear.

## Ventas

`/ventas` renders `CommandCenter` inside `SectionPage`. The filter header was already one element:

```tsx
<header className="vc-head cc-filter-battery">
```

Inside it, unchanged:

1. `ProjectPillRow` (TODOS and the project pills).
2. `.op-toolbar`: Periodo, Desde and Hasta when the period is `custom`, Asesor, Torre, Restablecer, and the period line with the freshness stamp.
3. The optional freshness note (`totales.freshness.note`).
4. `<hr className="op-filter-rule" />`.

Restablecer still clears the chart focus and restores `INITIAL`. Pill toggling, the multi-project query, and the block keys are untouched.

`.vc-command` is `flex: none`, so it is as tall as the bands. It does not set overflow. The scrollport stays `.section-page-body`. The sticky header’s parent is the full command, so the battery can remain stuck for the whole scroll of `/ventas`.

The new `overflow: auto` rule does not apply here. It matches only an `.op-screen` whose direct child is `.cc-filter-battery`. On Ventas the class sits on a header inside `.vc-command`.

At rest, `.vc-command` still has `padding: 8px clamp(16px, 2vw, 28px) 40px`, so the pills start 8px below the body. While scrolling, `top: 0` moves the header’s border box to the top of the scrollport. That 8px of parent padding scrolls away. The controls’ own gap, type, and the rule are unchanged. The side padding stays, because the header is still inside the padded command and the bands are inset by the same padding.

`.vc-head` still sets the column and the 8px gap. The shared class sets the same two properties again. They do not stack.

## Mercadeo

`/mercadeo` renders `OperativoView` with the default `variant` of `"home"`. The reporte section route renders the same component with `variant="reporte"`, so it receives the same wrapper. That was not a separate page edit.

The wrapper is only the toolbar and the rule:

```tsx
<header className="cc-filter-battery">
  <div className="op-toolbar">…</div>
  <hr className="op-filter-rule" />
</header>
```

The toolbar’s children were not rewritten. They are still Periodo, Desde and Hasta when the period is custom, the Proyecto checkbox menu, Presupuesto, Meta de leads when `variant` is `"reporte"`, and the period line. `DataAsOf` (“Datos al …”) and the “Tipo de cambio” line stay above the header. They are not part of the battery. They scroll away first. The toolbar then sticks.

Because this header is a direct child of `.op-screen`, the screen gains `overflow: auto` and becomes the scrollport. That is required for the stick to last. `.op-screen` is a flex child with `min-height: 0` and `flex: 1 1 auto`. On a wide window the desktop rule also sets its height to `auto`. A sticky box cannot leave its parent. If the screen were only as tall as the viewport and the overflow painted outside it, the header would travel with that short box and leave the page after about one screen. With the screen itself scrolling, `top: 0` is the top of `.op-screen`, which is the top of the page body, under the navigation.

The desktop chart fit is otherwise the same: the screen is still the flex child that fills the body, and the heroes still share that height when the content fits. When the content is taller than the screen (the mobile rule gives `.op-chart` a fixed 240px height and `flex: none`), the scroll is now inside `.op-screen` instead of spilling to `.section-page-body`. The battery stays at the top of that scroll.

`DataAsOf` and the exchange line remain flex items of `.op-screen`, above the header, still separated by the screen’s 8px gap. The wrapper’s own 8px column gap replaces the gap the screen used to place between the toolbar and the rule.

The Proyecto menu is `position: absolute` inside `.op-projects`. It is a descendant of the sticky header, so it paints with `z-index: 30` and can cover the charts. `.op-screen` now has `overflow: auto`, which clips overflow of that menu if the menu extends past the screen’s padding box. On a normal window the list is short and opens under the toolbar at the top of the screen, so it stays inside the visible area. That was not checked in a browser.

The inner toolbar was not re-indented. The new header tags sit at the same indent as the `div` they wrap.

## Checked

`npx tsc --noEmit` from the repo root, after the four edits. Exit 0.

Not checked: render, scroll, the Proyecto menu under the new overflow, a short viewport, or the reporte section route in a browser.
