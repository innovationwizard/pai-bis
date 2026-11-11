# 106 — Créditos loader writes the referral trail as text

**Date:** 2026-11-10
**Scope:** `scripts/creditos/load.py` and a new seed, `scripts/migrations/091_creditos_referido_enum.sql`. No application page, no API route, no change to `scripts/ventas/load.py` or any other loader.

The créditos deal load reads Pipedrive raw JSONL. Three referral fields on those deals were not copied into `creditos.load_fact_deal`. Referido and Tipo de Referido arrive as option ids. Nombre de Referidor arrives as free text. The live columns for all three are plain text. `creditos.apply_deal_labels()` fills the older `*_label` columns from `creditos.dim_enum` and does not write these three, so the loader now resolves the two enums in Python and sends the text itself.

`npx tsc --noEmit` passed after the edit. `npm run build` was not run. No dev server was started, no browser was opened, and the database was not queried or written. Migration 091 is on disk only. It has to be run by hand in the Supabase SQL editor.

## What a later load writes

Each crédito deal that the loader already keeps (pipelines 7, 8, 9, 10, 11, and 18; status `open`, `lost`, or `won`; not deleted) gains three keys on the object inserted into `creditos.load_fact_deal`:

| Column | Source custom field | What is stored |
|---|---|---|
| `referido` | `e8f4eef3e09ee54893d77a608d8d18187d649c3b` | `Si`, `No`, or null |
| `tipo_de_referido` | `828d235feeb4c426d7d58ce2e6fd8bd73b87c951` | One of the four labels below, or null |
| `nombre_de_referidor` | `9e81260c17a178dd0e92661ac19053e184133dcb` | Trimmed text, at most 200 characters, or null |

Option map used by the loader and seeded into `creditos.dim_enum`:

| field_key | option_id | label | api_key |
|---|---:|---|---|
| `referido` | 628 | Si | `e8f4eef3e09ee54893d77a608d8d18187d649c3b` |
| `referido` | 629 | No | `e8f4eef3e09ee54893d77a608d8d18187d649c3b` |
| `tipo_de_referido` | 630 | Referido Cartera | `828d235feeb4c426d7d58ce2e6fd8bd73b87c951` |
| `tipo_de_referido` | 631 | Referido entre Proyectos | `828d235feeb4c426d7d58ce2e6fd8bd73b87c951` |
| `tipo_de_referido` | 632 | Referido Corporación | `828d235feeb4c426d7d58ce2e6fd8bd73b87c951` |
| `tipo_de_referido` | 633 | Referido Corredor | `828d235feeb4c426d7d58ce2e6fd8bd73b87c951` |

`Si` and `No` are spelled the same way as the existing Armado, Ingreso a análisis, Aprobación, Papelería vencida, and Reserva completa rows in migration 082: no accent on `Si`. `Referido Corporación` keeps the accent. Nombre de Referidor has no option row. It is not an enum.

`field_key` follows the 082 slugs (`referido`, `tipo_de_referido`), the same shape as `papeleria_vencida` and `reserva_completa`. The Pipedrive screen names are Referido and Tipo de Referido. Those screen names are not stored in `field_key`. `family` is null on all six rows. `dim_enum_family` requires a family only for `tipo_a` and `tipo_b`.

An empty field stays null. An option id that is present and is not in the map fails the load. The loader does not invent a label and does not store the raw id in the text column.

## 1. `scripts/creditos/load.py`

The module docstring now says that Referido and Tipo de Referido are written from a local map, that those columns are plain text so the label trigger does not fill them, that Nombre de Referidor is free text, and that an option id outside the map fails the load. The rest of the contract is unchanged: raw JSONL, not the resolved CSV; no writes to `public.pai_credito_expediente`, ventas, or mercadeo; unknown stage ids still fail; the 082 dimension seed still has to be loaded before a write.

### Field keys

`FIELD` gained three entries at the end, after `recepcion_compraventa`. `custom(row, name)` still reads `row["custom_fields"][FIELD[name]]`. A missing `custom_fields` object, or a missing key inside it, still returns `None`.

```python
"referido": "e8f4eef3e09ee54893d77a608d8d18187d649c3b",
"tipo_de_referido": "828d235feeb4c426d7d58ce2e6fd8bd73b87c951",
"nombre_de_referidor": "9e81260c17a178dd0e92661ac19053e184133dcb",
```

### Local maps

Two dicts sit next to `FIELD`. They are the only place the loader turns these option ids into words. The load does not call `creditos.lookup_enum` for them.

```python
REFERIDO_LABEL = {
    628: "Si",
    629: "No",
}

TIPO_DE_REFERIDO_LABEL = {
    630: "Referido Cartera",
    631: "Referido entre Proyectos",
    632: "Referido Corporación",
    633: "Referido Corredor",
}
```

### `referral_label`

New function, immediately after `option_id`. It takes the raw custom-field value, the map, and the field name used in the error.

1. `option_id` parses the value.
2. `None` from that parse becomes a null column. That covers a missing field, `None`, `False`, `""`, a blank string, and boolean `True` (the existing parser treats `bool` as not an option id, so `True` does not become `1`).
3. A parsed id that is in the map becomes that label.
4. A parsed id that is not in the map raises `RuntimeError` with the field name and the id: `referido option 700 is not in the local map. The load will not invent a label.` The deal list stops. `--check` fails the same way, before any write. A real load fails before `load_fact_deal` is replaced.

`option_id` itself was not changed. The referral fields inherit its rules:

- `int` is kept.
- A whole `float` (`628.0`) becomes `int`. A fractional float raises.
- A string of digits (`"628"`) becomes `int`. Any other non-empty string raises, including a label that is already text (`"Si"`, `"Referido Cartera"`). The raw extract stores ids. A resolved export would fail this load on purpose.
- A dict with an `id` key is unwrapped and parsed again.
- Anything else that is present raises `cannot read option id from ...`.

### Deal object

Inside the deal loop in `main`, the dict appended for `load_fact_deal` gained three keys after `recepcion_compraventa_on`. Every earlier key is unchanged, including the option-id columns that the database trigger still labels (`tipo_a_option_id`, `banco_option_id`, and the rest).

```python
"referido": referral_label(custom(row, "referido"), REFERIDO_LABEL, "referido"),
"tipo_de_referido": referral_label(
    custom(row, "tipo_de_referido"), TIPO_DE_REFERIDO_LABEL, "tipo_de_referido"
),
"nombre_de_referidor": text_or_none(custom(row, "nombre_de_referidor"), 200),
```

`text_or_none` was not changed. For the referrer name it still does this: `None` and `False` become null; any other value is `str(...).strip()`; an empty string becomes null; a longer string is cut to the first 200 characters with no extra ellipsis. A numeric name would be stored as its decimal text. The field is free text in Pipedrive, so the normal value is a string.

Activities, files, and scanner notes are built from the same deal id map as before. They do not carry the three referral fields.

### What happens on a real load

The write path is the one migration 089 already installed. This change does not edit it.

1. `api.delete_filtered("load_fact_deal", "pipedrive_deal_id=gt.0")` clears the staging deals.
2. `api.insert("load_fact_deal", deals)` posts the dicts, including the three new text keys. PostgREST rejects a key that is not a column of `creditos.load_fact_deal`. The batch size is still 200.
3. `creditos.swap_load()` deletes `creditos.fact_deal` and inserts `SELECT *` from staging. Activity, file, and note follow. The `fact_deal_labels` trigger runs on that live insert and fills the older label columns from `dim_enum`. It assigns `tipo_a_label`, `tipo_b_label`, `tipo_a_family`, `tipo_b_family`, `tipo_bucket`, `banco_label`, `coordinadora_label`, `papeleria_vencida`, `reserva_completa`, `armado_label`, `ingreso_analisis_label`, `aprobacion_fha_label`, and `aprobacion_banco_label`. It does not assign `referido`, `tipo_de_referido`, or `nombre_de_referidor`, so the text from the staging row remains.

`--check` still prints counts and writes nothing. It still parses every deal, so a bad referral option id fails a check the same way it fails a load.

## 2. `scripts/migrations/091_creditos_referido_enum.sql`

New file. It does not create columns, alter `fact_deal` or `load_fact_deal`, replace `apply_deal_labels`, or change a view. It inserts the six option rows so a later `creditos.lookup_enum('referido', 628)` or `lookup_enum('tipo_de_referido', 630)` returns the same words the loader writes.

Header states that 082 has to be applied first, that the file is safe to run twice, and that this session does not apply it. A `DO` block raises if `to_regclass('creditos.dim_enum')` is null.

The insert matches the 082 statement shape:

```sql
INSERT INTO creditos.dim_enum (field_key, option_id, api_key, label, family)
VALUES
  ('referido', 628, 'e8f4eef3e09ee54893d77a608d8d18187d649c3b', 'Si', NULL),
  ('referido', 629, 'e8f4eef3e09ee54893d77a608d8d18187d649c3b', 'No', NULL),
  ('tipo_de_referido', 630, '828d235feeb4c426d7d58ce2e6fd8bd73b87c951', 'Referido Cartera', NULL),
  ('tipo_de_referido', 631, '828d235feeb4c426d7d58ce2e6fd8bd73b87c951', 'Referido entre Proyectos', NULL),
  ('tipo_de_referido', 632, '828d235feeb4c426d7d58ce2e6fd8bd73b87c951', 'Referido Corporación', NULL),
  ('tipo_de_referido', 633, '828d235feeb4c426d7d58ce2e6fd8bd73b87c951', 'Referido Corredor', NULL)
ON CONFLICT (field_key, option_id) DO UPDATE
SET api_key = EXCLUDED.api_key,
    label = EXCLUDED.label,
    family = EXCLUDED.family;
```

The primary key is `(field_key, option_id)`. A second run updates `api_key`, `label`, and `family` on those six pairs and leaves every other enum row alone. 082 seeded 36 rows. After this file the table has 42, provided none of these six pairs were already present. They are not in the 082 insert (the nearest existing ids are 611, 639, 640, 670, 673, and 674).

There is no `NOTIFY pgrst`. The table shape does not change.

## Left unchanged

- `scripts/ventas/load.py`. Ventas reads the resolved CSV. That file drops one of the two Tipo de Crédito columns and is not the source for these three fields.
- Every other loader under `scripts/`.
- `scripts/migrations/082_creditos_pipedrive.sql`, including `creditos.apply_deal_labels()`, `creditos.lookup_enum`, the `dim_enum` table, and the closing check that `creditos.dim_enum` has 36 rows.
- `scripts/migrations/089_creditos_load_staging.sql` and `creditos.swap_load()`.
- The Créditos page, its views, and any UI copy. Nothing on a screen was added, so the word "corte" was not introduced.
- `prod-db-schema.md`.

## Constraints the next run has to respect

**The three columns are not created here.** `082` defines `creditos.fact_deal` without `referido`, `tipo_de_referido`, or `nombre_de_referidor`. `089` builds `creditos.load_fact_deal` with `LIKE creditos.fact_deal INCLUDING DEFAULTS` and says a later `ALTER TABLE` on a live fact table needs the same `ALTER` on its staging table. `prod-db-schema.md` lists the 082 columns and does not list these three. This change assumes the three plain-text columns already exist on `creditos.load_fact_deal` and on `creditos.fact_deal`. If staging was created before the columns were added to the live table, the insert into `load_fact_deal` fails and `SELECT *` inside `swap_load()` fails on a column mismatch. No `ALTER` was added in this pass.

**Re-running 082 after 091 fails.** The verification block at the end of 082 raises when `creditos.dim_enum` does not have exactly 36 rows. After 091 that count is 42, so a second execution of 082 rolls back. 082 was not edited. Do not re-apply it to "refresh" the enum seed.

**The Python map and the seed can drift.** The loader does not read `dim_enum` while it builds deals. A label changed only in 091, or only in `REFERIDO_LABEL` / `TIPO_DE_REFERIDO_LABEL`, will not change the other side. They match today, including spelling.

**A new Pipedrive option stops the load.** Option 634, or any other id on these two fields, raises in `referral_label`. Add it to both the Python map and `dim_enum` before loading. Storing null, or storing the id as text, was rejected so an unknown choice cannot land as a blank.

**Migration 091 is not applied.** Run the whole file in the Supabase SQL editor on a database that already has 082. There is no `DATABASE_URL` and no `psql` on this machine, and this session did not execute it.
