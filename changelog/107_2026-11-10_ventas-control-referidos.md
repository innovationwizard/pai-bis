# 107 — Ventas Control Referidos reads the crédito referral trail

**Date:** 2026-11-10
**Route:** `/ventas`, card «Control Referidos». The data request is `GET /api/ventas/vista?section=control-referidos` with the same period, project, asesor, and torre query the command center already sends.
**Files:** `src/lib/ventas/vista-types.ts`, `src/lib/ventas/vista.ts`, `src/lib/ventas/vista-operativo.ts`, `src/app/(panel)/ventas/command-center.tsx`, `src/app/(panel)/ventas/glance-view.tsx`, `src/app/globals.css`.

Changelog 104 left this card as a sentence: the three referral fields were not on `VentasVista`. Changelog 106 taught `scripts/creditos/load.py` to write those fields as text on `creditos.fact_deal`. This entry is the read side. The command center now asks the vista for them and draws the card from that payload.

`npx tsc --noEmit` passed after the edit. `npm run build` was not run. No dev server was started, no browser was opened, and the database was not queried or written. No loader and no migration was edited. The three columns are assumed to already exist on `creditos.fact_deal`. This change does not create them.

## What the card shows

The heading stays «Control Referidos». It still sits under the four control cards and above «Tratos que todavía no son venta». No other band on the command center was rewritten.

While the section is in flight, the card uses the same `StatusLine` as the other bands: «Cargando…», or the error string in `.op-note.op-warn` when that section’s request fails. A failure here does not blank the other bands. Each section is still its own fetch.

Once the payload arrives, the old sentence is gone:

> Referido, tipo de referido y nombre de referidor no vienen en esta vista.

What replaces it depends on the rows that came back.

| State | What is drawn |
|---|---|
| No crédito deals loaded | Notice: «Todavía no hay tratos de créditos.» No count, no bars, no name list. |
| A project is selected and no crédito deal belongs to it | Notice: «Ningún trato de créditos cae en este proyecto.» plus the scope sentence below. No count. |
| Deals are in scope, and every `referido` and every `nombre_de_referidor` is null | «Estos tratos no traen referido, tipo de referido ni nombre de referidor.» |
| At least one deal has `referido` filled, and none of those values is `Si` | «Ningún trato está marcado como referido.» The digit 0 is not printed. No bar is drawn. |
| One or more deals have `referido` = `Si` | «1 referido.» or «N referidos.» Then one horizontal bar per non-null `tipo_de_referido`, length = number of those `Si` deals. |
| Some of those `Si` deals have a null tipo | An extra line, only when that remainder is greater than zero: «N sin tipo de referido.» There is no bar labeled for the blank tipo, and no zero-length bar. |
| At least one non-null `nombre_de_referidor` | A heading «Referidores» and a list of the distinct names, up to 12, in Spanish alphabetical order. |

The name list is the distinct trimmed values, not one line per deal. Two deals that name the same person produce one line. When more than 12 distinct names exist, the card adds «La lista trae 12 de N.» When every name fits, that line is omitted. When there are no names, `nombresTotal` is null and the card does not say 0.

A name is listed even when that deal’s `referido` is `No` or null. The bars count only `Si`.

The chart is the existing `NamedBars`: vertical layout, series name «Referidos», fill `#0d2041`, unit counts, no quetzales. `gtq` on each bar is null, so the chart does not print a money zero. The chart is mounted only when at least one tipo has a count. An empty tipo list does not fall through to «Nada que graficar en este periodo.»

Above the counts, a scope sentence is always present once deals exist:

- No asesor and no torre: «Estos tratos son los de créditos. El periodo no los parte.»
- Asesor set: «Estos tratos son los de créditos. Ni el periodo ni el asesor los parten.»
- Torre set: «Estos tratos son los de créditos. Ni el periodo ni la torre los parten.»
- Asesor and torre both set: «Estos tratos son los de créditos. Ni el periodo ni el asesor ni la torre los parten.»

If the read hits the 5,000-row cap, one more sentence is appended: «La consulta llegó a 5.000 tratos. El recuento puede quedar corto.»

The payload also carries a question and a caption. The card does not print them. The question is «¿Cuántos tratos de créditos son referidos, y quién los refirió?» The caption is «Referido, tipo de referido y nombre de referidor salen del trato de créditos. Un campo vacío no entra como cero.»

## Where the rows come from

`buildReferidos` in `src/lib/ventas/vista-operativo.ts` reads `creditos.fact_deal` with the service-role client, schema `creditos`. The select list is:

`pipedrive_deal_id, project_id, referido, tipo_de_referido, nombre_de_referidor`

Pages are 1,000 rows, ordered by `pipedrive_deal_id`, and stop at 5,000 (`PAGE` and `CAP`, the same limits the other control builders use). A duplicate `pipedrive_deal_id` is counted once. A blank id is skipped.

This is the crédito extract: pipelines 7, 8, 9, 10, 11, and 18, as loaded into `creditos.fact_deal`. It is not `ventas.v_sale`, not `ventas.dim_deal`, and not `v_rv_referrals_full`. `/api/reservas/referidos` is still not called. That route is the special-price register from migration 019. It has `referido_por` and `precio_referido`, and it has no tipo de referido.

`referido` is compared to the exact text `Si` after trim. `No` is a real value: it proves the column was filled, and it does not increment the count and does not get its own bar. `si`, `Sí`, and an empty string do not count as `Si`. An empty string is treated as null. The loader in changelog 106 writes `Si` and `No` with no accent, so the comparison matches what that load stores.

`tipo_de_referido` is not remapped. The bar label is the text already on the row (Referido Cartera, Referido entre Proyectos, Referido Corporación, Referido Corredor, or any other non-empty text that is actually present). A null tipo on a `Si` deal is the `sinTipo` remainder. No tipo is inserted at zero to complete the four known labels.

`nombre_de_referidor` is trimmed. Blank becomes null and is left off the list.

`si` and `sinTipo` stay null when every in-scope deal has a null `referido`. They become numbers only after at least one deal has a non-null `referido`. A real zero of `Si` is then possible, and the card states it in a sentence instead of printing 0. `sinTipo` of 0 is not printed.

## What the command-center filters do to this card

The card is fetched inside the existing loop. `control-referidos` was appended to `SECTIONS` in `command-center.tsx`. Changing Periodo, Proyecto, Asesor, or Torre refetches it with the same `buildParams` as the other sections. `readVista` still rejects a body whose `section` is not `control-referidos`.

Only the project filter changes which deals are counted.

The selected ventas project id is turned into a name with the ventas dimensions the control builder already loads (`ventas.dim_project.name`). `Sin dato` is dropped. The remaining names are looked up on `creditos.dim_project.name`. The six crédito names match the ventas building names: Benestare, Bosque Las Tapias, Boulevard 5, Santa Elena, Casa Elisa. Torre Cobán exists only on the crédito side and never comes from the ventas project list. Deals whose `project_id` is outside that set are left out. `scopedDeals` is the number of distinct Pipedrive ids that remain, including deals whose three referral fields are null.

A project filter that resolves to no crédito project (including the empty «ninguno» project list) returns immediately with `scopedDeals: 0` and does not read `fact_deal`.

The period does not filter `add_time`, `won_time`, or `lost_time`. The default command-center period is the current month. The referral columns are a current attribute of the loaded crédito deals, and most of those deals were not created this month. Filtering the snapshot by the month would hide the trail the loader just wrote. The card says the period does not split the list.

Asesor and torre are not columns on `creditos.fact_deal`. Setting them changes the notice text and does not change the rows. The project filter does change the rows, and the notice does not claim otherwise.

`periodLabel` and `rangeLabel` are still filled by `base()` from the requested window, so the payload knows which period was on the bar. The card does not print them as if the count were for that window.

## Request path

`GET /api/ventas/vista` is unchanged as a file. `isVistaSection` now accepts `control-referidos` because that slug was added to `VISTA_SECTIONS`. The same roles can read it: `master`, `torredecontrol`, `gerencia`.

`buildVista` already sends every control section to `buildControlVista` before the sales-island path. `control-referidos` is now a member of `CONTROL_SECTIONS`, so it takes that branch and is cached for 30 seconds under the same `{ section, filters }` key as the other vistas. The cache entry includes the notice, so two bars that differ only by asesor do not share a body.

Inside `buildControlVista`, `promociones` used to be the final `return`. It is now an explicit branch that still calls `buildPromos`. The final `return` is `buildReferidos`. Promociones’ query and payload are unchanged. `buildReferidos` does not use the ventas client. It opens its own service-role client on schema `creditos`.

`QUESTIONS` in `src/lib/ventas/vista.ts` gained the same question string, because that map is `Record<VistaSection, string>`. The control builder does not read `QUESTIONS`. It passes the question into `base()` itself, the same way the other control sections do.

The payload type is `ReferidosVista`, added to the `VentasVista` union:

| Field | Meaning |
|---|---|
| `section` | `"control-referidos"` |
| `scopedDeals` | Distinct Pipedrive ids after the project filter. Includes deals with null referral fields. |
| `si` | Count of those deals with `referido` = `Si`, or null when no in-scope deal has `referido` filled. |
| `sinTipo` | How many of those `Si` deals have a null tipo, or null in the same empty case. |
| `byTipo` | `NamedBar` rows, one per non-null tipo among the `Si` deals. `id` and `label` are that text. `units` is the count. `gtq` is null. Sorted by units descending, then label. |
| `nombres` | Up to 12 distinct non-null names, Spanish sort. |
| `nombresTotal` | Full distinct-name count, or null when there are none. |

`VistaBase` still supplies `question`, `periodLabel`, `rangeLabel`, `caption`, `notice`, `projects`, `choices`, `lines`, `listShown`, and `listTotal`. `lines` is empty, and both list counts are 0. `choices` is the empty choice object. `projects` is the ventas project list from `base()`. The card does not read those.

## Other files, and what was left alone

`src/app/(panel)/ventas/glance-view.tsx` gained one key on `SPECIFIC`, which is `Record<VistaSection, FilterKey[]>` and would not typecheck without it: `"control-referidos": ["asesor", "torre"]`. No glance screen renders this section. `VENTAS_SECTIONS` in `src/app/(panel)/ventas/sections.ts` was not extended, so `generateStaticParams` does not add `/ventas/control-referidos`. The per-section glance page is unchanged for every slug it already serves.

`src/app/globals.css` gained `.vc-referidos`: no bullets, navy `#0d2041`, 13px, 1.45 line height, 2px between items. No other command-center rule was edited.

Not changed:

- `scripts/creditos/load.py`, `scripts/ventas/load.py`, and every file under `scripts/migrations/`.
- `SaleLine`, `StageDeal`, and the payloads of the other twelve vistas.
- The JSX of every command-center band other than Control Referidos. The fetch list and the `ReferidosBand` call site are the only edits in that component outside the new card.
- `/api/reservas/referidos` and the `/referidos` pages.
- `src/app/api/ventas/vista/route.ts`. The new slug is accepted because `isVistaSection` follows `VISTA_SECTIONS`.

If `creditos` is not in the exposed schemas, or if `referido`, `tipo_de_referido`, or `nombre_de_referidor` is missing from `fact_deal`, that section’s request returns 500 and the card shows the PostgREST message. The other vistas keep loading.
