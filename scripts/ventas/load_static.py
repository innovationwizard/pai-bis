"""Load workbook facts that are already specified into schema ventas.

Targets: stable units per asesor per project, for each month from 2022-06
through 2026-10, for asesores who already own a deal in that project.
Quetzales targets are not in the source and stay null.

Benestare price rises: dated Incremento columns and Estrategia TD y TE on
towers D and E. Incremento 1 has no date and is not an event.
Benestare discounts: column Descuento (1 hab), stored on a sale when that
unit has exactly one sale.
Casa Elisa and Boulevard 5: initial price and the dated price-change columns
named for those workbooks. A change column with no date is applied to the
running price and is not its own event. Boulevard discount columns are stored
on a sale when that unit token has exactly one sale.
Inventory: header-name parse of the workbooks in this repo.
"""

from __future__ import annotations

import os
import sys
import time
import uuid
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))
from load import Api, canonical_unit, load_env, uuid7  # type: ignore

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
OBSERVED_ON = date.today().isoformat()
TARGET_UNITS = {
    "Benestare": 5,
    "Bosque Las Tapias": 5,
    "Boulevard 5": 3,
    "Casa Elisa": 0,
    "Santa Elena": 0,
}
STATUS_WORD = {
    "disponible": "Disponible",
    "liberado": "Disponible",
    "reservado": "Reservado",
    "reservada": "Reservado",
    "congelado": "Congelado",
    "congelado junta directiva": "Congelado",
    "pcv": "PCV",
    "promesa": "Promesa",
    "vendido": "Vendido en archivo",
}
BENE_RISES = [
    ("Incremento 2", date(2025, 8, 11)),
    ("Incremento 3", date(2025, 12, 1)),
    ("Incremento 4", date(2026, 1, 7)),
    ("Estrategia TD y TE", date(2026, 1, 20)),
    ("Incremento 5", date(2026, 2, 2)),
    ("Incremento 6", date(2026, 3, 1)),
]
CASA_CHANGE_DATES = {
    date(2022, 7, 7),
    date(2022, 9, 6),
    date(2022, 9, 8),
    date(2022, 9, 23),
    date(2022, 10, 26),
    date(2022, 11, 23),
    date(2023, 2, 3),
    date(2023, 4, 20),
    date(2023, 11, 20),
    date(2023, 12, 6),
    date(2024, 3, 6),
}
CASA_NAMED_CHANGES = {
    "Ajuste de precio locales. (Q18k x m2)",
    "Ajuste por 6 bodegas agregadas.(Actualizado 7/10/24)",
    "Liberación Aptos 307 y 505. Descuento 104.",
    "Reasignación de Bodegas e incremento 807.",
    "Liberación Aptos 1H.",
}
B5_RISE_HEADERS = [f"Ajuste {index}" for index in range(1, 10)] + ["Ajuste desistimiento"]
B5_DISCOUNT_HEADERS = [
    "Descuento 1",
    "Descuento 2",
    "Descuento Promoción últimas unidades",
]
SKIP_UNIT_TOKENS = {"reservado", "disponible", "total", "parqueos"}


def sheets(path: str) -> list[tuple[str, dict[int, dict[str, str]]]]:
    z = zipfile.ZipFile(path)
    shared: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall(f"{NS}si"):
            shared.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rid = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    out: list[tuple[str, dict[int, dict[str, str]]]] = []
    for sheet in workbook.findall(f"{NS}sheets/{NS}sheet"):
        target = rid[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        if target not in z.namelist():
            continue
        grid: dict[int, dict[str, str]] = {}
        node = ET.fromstring(z.read(target))
        for cell in node.iter(f"{NS}c"):
            ref = cell.attrib.get("r")
            if not ref:
                continue
            col = "".join(ch for ch in ref if ch.isalpha())
            row = int("".join(ch for ch in ref if ch.isdigit()) or 0)
            value = cell.find(f"{NS}v")
            if value is None or value.text is None:
                continue
            text = shared[int(value.text)] if cell.attrib.get("t") == "s" else value.text
            grid.setdefault(row, {})[col] = text
        out.append((sheet.attrib["name"], grid))
    return out


def find_col(grid: dict[int, dict[str, str]], header: str, max_row: int = 15) -> tuple[int, str] | None:
    exact = None
    stripped = None
    for row, cols in grid.items():
        if row > max_row:
            continue
        for col, value in cols.items():
            if value == header and exact is None:
                exact = (row, col)
            if value.strip() == header.strip() and stripped is None:
                stripped = (row, col)
    return exact or stripped


def data_rows(grid: dict[int, dict[str, str]], columns: dict[str, tuple[int, str]], start: int) -> list[dict[str, str]]:
    rows = []
    for row in sorted(grid):
        if row < start:
            continue
        item = {}
        present = False
        for key, (_, col) in columns.items():
            value = grid.get(row, {}).get(col, "")
            item[key] = value
            if str(value).strip():
                present = True
        if present:
            rows.append(item)
    return rows


def money(value: str) -> Decimal | None:
    text = (value or "").strip().replace(",", "")
    if text == "":
        return None
    try:
        return Decimal(text).quantize(Decimal("0.01"))
    except Exception:
        return None


def status_name(value: str) -> str | None:
    word = " ".join(value.replace("\xa0", " ").split()).lower()
    if word == "":
        return "Disponible"
    return STATUS_WORD.get(word)


def col_index(col: str) -> int:
    number = 0
    for char in col:
        number = number * 26 + (ord(char) - 64)
    return number


def excel_date(value: str | None) -> date | None:
    text = (value or "").strip()
    if text == "":
        return None
    try:
        serial = float(text)
    except ValueError:
        return None
    if serial < 30000 or serial > 70000:
        return None
    whole = int(serial)
    if abs(serial - whole) > 0.0001:
        return None
    return date(1899, 12, 30) + timedelta(days=whole)


def ordered_cells(grid: dict[int, dict[str, str]], row: int) -> list[tuple[str, str]]:
    return sorted(grid.get(row, {}).items(), key=lambda item: col_index(item[0]))


def header_row_with(grid: dict[int, dict[str, str]], required: set[str]) -> int:
    for row in sorted(grid):
        present = {value.strip() for value in grid[row].values()}
        if required <= present:
            return row
    raise RuntimeError(f"header row missing {sorted(required)}")


def columns_named(
    cells: list[tuple[str, str]],
    name: str,
    before: int | None = None,
    after: int | None = None,
) -> list[str]:
    found = []
    for col, value in cells:
        if value.strip() != name:
            continue
        index = col_index(col)
        if before is not None and index >= before:
            continue
        if after is not None and index <= after:
            continue
        found.append(col)
    return found


def unit_token_ok(token: str, locals_ok: bool) -> bool:
    if token.isdigit():
        return True
    return locals_ok and len(token) > 2 and token[0] == "L" and token[1] == "-" and token[2:].isdigit()


def hab_code(value: str | None) -> str | None:
    text = (value or "").strip()
    if text.endswith(".0"):
        text = text[:-2]
    if text in {"1", "2", "3"}:
        return f"{text}H"
    return None


def sheet_grid(path: str, name: str) -> dict[int, dict[str, str]]:
    found = dict(sheets(path))
    grid = found.get(name)
    if grid is None:
        raise RuntimeError(f"{name} is not a sheet in {path}. Sheets: {list(found)}")
    return grid


def main() -> None:
    env = load_env()
    base = env.get("SUPABASE_URL") or env["NEXT_PUBLIC_SUPABASE_URL"]
    api = Api(base, env["SUPABASE_SERVICE_ROLE_KEY"])
    projects = {str(row["name"]): str(row["id"]) for row in api.fetch_all("dim_project", "id,name")}
    towers = {
        (str(row["project_id"]), str(row["name"])): str(row["id"])
        for row in api.fetch_all("dim_tower", "id,project_id,name")
    }
    models = {
        (str(row["project_id"]), str(row["name"])): str(row["id"])
        for row in api.fetch_all("dim_model", "id,project_id,name")
    }
    habitaciones = {str(row["name"]): str(row["id"]) for row in api.fetch_all("dim_habitaciones", "id,name")}
    statuses = {str(row["name"]): str(row["id"]) for row in api.fetch_all("dim_unit_status", "id,name")}
    sin_model = next(row_id for (_project_id, name), row_id in models.items() if name == "Sin dato")
    sin_hab = habitaciones["Sin dato"]
    units = {
        (
            str(row["project_id"]),
            str(row["tower_id"]),
            str(row["canonical_unit"]),
            str(row["unit_token_2"]) if row.get("unit_token_2") else None,
            str(row["model_id"]),
        ): str(row["id"])
        for row in api.fetch_all(
            "dim_unit",
            "id,project_id,tower_id,canonical_unit,unit_token_2,model_id",
        )
    }
    unit_place = {
        row_id: (project_id, tower_id, token, token2)
        for (project_id, tower_id, token, token2, _model_id), row_id in units.items()
    }
    unit_dims: dict[str, tuple[str, str]] = {
        row_id: (tower_id, model_id)
        for (_project_id, tower_id, _token, _token2, model_id), row_id in units.items()
    }
    new_models: list[dict[str, object]] = []
    new_units: list[dict[str, object]] = []
    new_towers: list[dict[str, object]] = []

    def ensure_tower(project_id: str, name: str) -> str:
        key = (project_id, name)
        found = towers.get(key)
        if found:
            return found
        row_id = uuid7()
        towers[key] = row_id
        new_towers.append(
            {"id": row_id, "project_id": project_id, "name": name, "is_sin_dato": False}
        )
        return row_id

    def ensure_model(project_id: str, name: str | None) -> str:
        if not name:
            return sin_model
        key = (project_id, name)
        found = models.get(key)
        if found:
            return found
        row_id = uuid7()
        models[key] = row_id
        new_models.append({"id": row_id, "project_id": project_id, "name": name, "is_sin_dato": False})
        return row_id

    def ensure_unit(
        project_id: str,
        tower_id: str,
        token: str,
        model_id: str,
        hab_id: str,
        token2: str | None = None,
    ) -> str:
        if token2 is not None and token2 == token:
            token2 = None
        key = (project_id, tower_id, token, token2, model_id)
        found = units.get(key)
        if found:
            unit_place[found] = (project_id, tower_id, token, token2)
            unit_dims[found] = (tower_id, model_id)
            return found
        row_id = uuid7()
        units[key] = row_id
        unit_place[row_id] = (project_id, tower_id, token, token2)
        unit_dims[row_id] = (tower_id, model_id)
        new_units.append(
            {
                "id": row_id,
                "project_id": project_id,
                "tower_id": tower_id,
                "model_id": model_id,
                "habitaciones_id": hab_id,
                "canonical_unit": token,
                "unit_token_2": token2,
            }
        )
        return row_id

    observations: list[dict[str, object]] = []
    rises: list[dict[str, object]] = []
    discounts: list[dict[str, object]] = []
    unrecognized = 0
    undated_changes: dict[str, int] = defaultdict(int)
    price_gap = {"Casa Elisa": 0, "Boulevard 5": 0}
    b5_discount_units: list[tuple[str, str, str, str | None, Decimal, Decimal, str]] = []

    def add_observation(
        project: str,
        tower_name: str | None,
        token: str,
        model_name: str | None,
        hab: str | None,
        status: str | None,
        price: Decimal | None,
        currency: str | None,
        token2: str | None = None,
    ) -> str | None:
        nonlocal unrecognized
        if status is None:
            unrecognized += 1
            return None
        project_id = projects[project]
        if project == "Santa Elena":
            tower_id = next(row_id for (_project_id, name), row_id in towers.items() if name == "Sin dato")
        else:
            tower_id = ensure_tower(project_id, tower_name or "Principal")
        hab_id = habitaciones.get(hab or "", sin_hab)
        model_id = ensure_model(project_id, model_name)
        unit_id = ensure_unit(project_id, tower_id, token, model_id, hab_id, token2)
        observations.append(
            {
                "id": uuid7(),
                "unit_id": unit_id,
                "observed_on": OBSERVED_ON,
                "status_id": statuses[status],
                "list_price_amount": format(price, "f") if price is not None else None,
                "list_price_currency": currency if price is not None else None,
            }
        )
        return unit_id

    def add_rise(prefix: str, unit_id: str, when: date, previous: Decimal, new_amount: Decimal) -> None:
        difference = (new_amount - previous).quantize(Decimal("0.01"))
        if difference == 0:
            return
        tower_id, model_id = unit_dims[unit_id]
        rises.append(
            {
                "id": uuid7(),
                "source_natural_key": f"{prefix}:{unit_id}:{when.isoformat()}",
                "unit_id": unit_id,
                "tower_id": tower_id,
                "model_id": model_id,
                "effective_on": when.isoformat(),
                "previous_amount": format(previous, "f"),
                "new_amount": format(new_amount, "f"),
                "difference_amount": format(difference, "f"),
                "currency": "GTQ",
            }
        )

    def apply_dated_changes(
        prefix: str,
        unit_id: str,
        initial: Decimal,
        changes: list[tuple[date | None, Decimal, str]],
    ) -> Decimal:
        running = initial
        pending_on: date | None = None
        pending_sum = Decimal("0.00")

        def flush() -> None:
            nonlocal running, pending_on, pending_sum
            if pending_on is not None and pending_sum != 0:
                new_amount = (running + pending_sum).quantize(Decimal("0.01"))
                add_rise(prefix, unit_id, pending_on, running, new_amount)
                running = new_amount
            pending_on = None
            pending_sum = Decimal("0.00")

        for when, amount, label in changes:
            if amount == 0:
                continue
            if when is None:
                flush()
                running = (running + amount).quantize(Decimal("0.01"))
                undated_changes[f"{prefix}:{label}"] += 1
                continue
            if pending_on is not None and when != pending_on:
                flush()
            pending_on = when
            pending_sum = (pending_sum + amount).quantize(Decimal("0.01"))
        flush()
        return running

    # Benestare inventory and rises and discounts
    bene_path = os.path.join(ROOT, "docs/BENESTARE_2_Precios_y_Disponibilidad.xlsx")
    bene_grid = dict(sheets(bene_path))["Precios"]
    bene_cols = {
        "unit": find_col(bene_grid, "NÚMERO"),
        "tower": find_col(bene_grid, "Torre"),
        "model": find_col(bene_grid, "TIPO"),
        "hab": find_col(bene_grid, "HABITACIONES"),
        "status": find_col(bene_grid, "Estatus"),
        "price": find_col(bene_grid, "Precio de Venta"),
        "initial": find_col(bene_grid, "Precio de Inicial"),
        "discount": find_col(bene_grid, "Descuento (1 hab)"),
        "Incremento 1": find_col(bene_grid, "Incremento 1"),
    }
    for label, _date in BENE_RISES:
        bene_cols[label] = find_col(bene_grid, label)
    missing = [name for name, col in bene_cols.items() if col is None]
    if missing:
        raise RuntimeError(f"Benestare headers missing: {missing}")
    start = max(row for row, _col in bene_cols.values()) + 1
    bene_discount_units: list[tuple[str, Decimal, Decimal]] = []
    for item in data_rows(bene_grid, {k: v for k, v in bene_cols.items() if v}, start):
        token = canonical_unit(item.get("unit"))
        tower = (item.get("tower") or "").strip().upper()
        if not token or tower not in {"A", "B", "C", "D", "E"}:
            continue
        model = (item.get("model") or "").strip() or None
        hab_raw = (item.get("hab") or "").strip()
        hab = f"{hab_raw}H" if hab_raw in {"1", "2", "3"} else None
        price = money(item.get("price") or "")
        unit_id = add_observation(
            "Benestare", tower, token, model, hab, status_name(item.get("status") or ""), price, "GTQ"
        )
        if not unit_id:
            continue
        initial = money(item.get("initial") or "")
        running = initial
        inc1 = money(item.get("Incremento 1") or "")
        if running is not None and inc1:
            running += inc1
        for label, when in BENE_RISES:
            if label == "Estrategia TD y TE" and tower not in {"D", "E"}:
                continue
            amount = money(item.get(label) or "")
            if amount is None or amount == 0 or running is None:
                continue
            previous = running
            running = previous + amount
            rises.append(
                {
                    "id": uuid7(),
                    "source_natural_key": f"benestare:{unit_id}:{label}:{when.isoformat()}",
                    "unit_id": unit_id,
                    "tower_id": towers[(projects["Benestare"], tower)],
                    "model_id": models.get((projects["Benestare"], model or ""), sin_model) if model else sin_model,
                    "effective_on": when.isoformat(),
                    "previous_amount": format(previous, "f"),
                    "new_amount": format(running, "f"),
                    "difference_amount": format(amount, "f"),
                    "currency": "GTQ",
                }
            )
        discount = money(item.get("discount") or "")
        if discount is not None and discount != 0 and price and price > 0:
            bene_discount_units.append((unit_id, abs(discount), price))

    # Bosque Las Tapias inventory. No increments. List-price header is absent here.
    blt_path = os.path.join(ROOT, "docs/BOSQUE_LAS_TAPIAS_2_Precios_y_Disponibilidad.xlsx")
    for sheet_name, grid in sheets(blt_path):
        if "NUEVA" in sheet_name.upper():
            continue
        if "Torre C" in sheet_name:
            tower = "C"
        elif "Torre B" in sheet_name:
            tower = "B"
        else:
            continue
        cols = {
            "unit": find_col(grid, "Número "),
            "model": find_col(grid, "Tipo"),
            "status": find_col(grid, "Estatus"),
        }
        if not all(cols.values()):
            print(f"skip {sheet_name}: headers {cols}")
            continue
        start = max(pair[0] for pair in cols.values() if pair) + 1
        for item in data_rows(grid, cols, start):
            token = canonical_unit(item.get("unit"))
            if not token:
                continue
            model = (item.get("model") or "").strip() or None
            add_observation(
                "Bosque Las Tapias",
                tower,
                token,
                model,
                None,
                status_name(item.get("status") or ""),
                None,
                None,
            )

    # Santa Elena, header by name.
    se_path = os.path.join(ROOT, "Reservas/Santa Elena/Disponibilidad.xlsx")
    for sheet_name, grid in sheets(se_path):
        cols = {
            "unit": find_col(grid, "Unidad "),
            "model": find_col(grid, "Modelo "),
            "status": find_col(grid, "Estatus"),
            "price": find_col(grid, "PRECIO TOTAL"),
        }
        if cols["unit"] is None:
            cols["unit"] = find_col(grid, "Unidad")
        if not cols["unit"] or not cols["status"] or not cols["price"]:
            continue
        start = max(pair[0] for pair in cols.values() if pair) + 1
        for item in data_rows(grid, {k: v for k, v in cols.items() if v}, start):
            token = canonical_unit(item.get("unit"))
            if not token or token.lower() in {"unidad", "modelo"}:
                continue
            price = money(item.get("price") or "")
            add_observation(
                "Santa Elena",
                None,
                token,
                (item.get("model") or "").strip() or None,
                None,
                status_name(item.get("status") or ""),
                price,
                "USD",
            )

    # Casa Elisa. Initial price is Precio. Precio FINAL is the current list price.
    # Dated columns between them are price changes, including decreases.
    # SIN CORREO has no date. Aumento promo is a paid promotion. It has no date
    # in the sheet, so it is part of the price and not its own event.
    # Two Número columns that differ are both the unit.
    casa_path = os.path.join(ROOT, "docs/CASA_ELISA_2_Precios_y_Disponibilidad.xlsx")
    casa_grid = sheet_grid(casa_path, "Disponibilidad")
    casa_header = header_row_with(
        casa_grid, {"Número", "Precio", "Precio FINAL", "Estatus", "SIN CORREO"}
    )
    casa_cells = ordered_cells(casa_grid, casa_header)
    casa_precio = columns_named(casa_cells, "Precio")
    if len(casa_precio) != 1:
        raise RuntimeError(f"Casa Elisa Precio headers {casa_precio}")
    precio_at = col_index(casa_precio[0])
    casa_final = columns_named(casa_cells, "Precio FINAL", after=precio_at)
    if not casa_final:
        raise RuntimeError("Casa Elisa Precio FINAL header is missing")
    final_at = col_index(casa_final[0])
    casa_numbers = columns_named(casa_cells, "Número", before=precio_at)
    casa_tipo = columns_named(casa_cells, "Tipo", before=precio_at)
    casa_hab = columns_named(casa_cells, "Habitaciones", before=precio_at)
    casa_status = columns_named(casa_cells, "Estatus")
    if not casa_numbers or not casa_tipo or not casa_hab or len(casa_status) != 1:
        raise RuntimeError("Casa Elisa unit headers are incomplete")
    casa_changes: list[tuple[str, str, date | None]] = []
    seen_casa_dates: set[date] = set()
    seen_casa_named: set[str] = set()
    for col, value in casa_cells:
        index = col_index(col)
        if index <= precio_at or index >= final_at:
            continue
        label = value.strip()
        above = casa_grid.get(casa_header - 1, {}).get(col, "")
        if label == "SIN CORREO":
            casa_changes.append((col, above.strip() or label, None))
        elif label in CASA_NAMED_CHANGES:
            seen_casa_named.add(label)
            casa_changes.append((col, label, excel_date(above)))
        else:
            when = excel_date(label)
            if when in CASA_CHANGE_DATES:
                seen_casa_dates.add(when)
                casa_changes.append((col, when.isoformat(), when))
    promo_cols = [
        col
        for col, value in ordered_cells(casa_grid, casa_header - 1)
        if value.strip() == "Aumento promo" and precio_at < col_index(col) < final_at
    ]
    if len(promo_cols) != 1:
        raise RuntimeError(f"Casa Elisa Aumento promo columns {promo_cols}")
    promo_header = casa_grid.get(casa_header, {}).get(promo_cols[0], "")
    promo_above = casa_grid.get(casa_header - 2, {}).get(promo_cols[0], "")
    casa_changes.append((promo_cols[0], "Aumento promo", excel_date(promo_header) or excel_date(promo_above)))
    casa_changes.sort(key=lambda item: col_index(item[0]))
    missing_dates = CASA_CHANGE_DATES - seen_casa_dates
    missing_named = CASA_NAMED_CHANGES - seen_casa_named
    if missing_dates or missing_named or sum(1 for _col, label, when in casa_changes if when is None and label != "Aumento promo") < 2:
        raise RuntimeError(f"Casa Elisa change headers missing dates {missing_dates} named {missing_named}")
    print(
        "casa changes",
        [(label, when.isoformat() if when else None) for _col, label, when in casa_changes],
        flush=True,
    )
    for row in sorted(casa_grid):
        if row <= casa_header:
            continue
        token = canonical_unit(casa_grid.get(row, {}).get(casa_numbers[0]))
        if not token or token.lower() in SKIP_UNIT_TOKENS or not unit_token_ok(token, True):
            continue
        model = (casa_grid.get(row, {}).get(casa_tipo[0]) or "").strip() or None
        if model and "total" in model.lower():
            continue
        token2 = None
        if len(casa_numbers) > 1:
            second = canonical_unit(casa_grid.get(row, {}).get(casa_numbers[1]))
            if second and second != token and second.lower() not in SKIP_UNIT_TOKENS:
                token2 = second
        initial = money(casa_grid.get(row, {}).get(casa_precio[0]) or "")
        final_price = money(casa_grid.get(row, {}).get(casa_final[0]) or "")
        raw_status = casa_grid.get(row, {}).get(casa_status[0]) or ""
        if raw_status.strip() == "" and initial is None and final_price is None:
            continue
        unit_id = add_observation(
            "Casa Elisa",
            "Principal",
            token,
            model,
            hab_code(casa_grid.get(row, {}).get(casa_hab[0])),
            status_name(raw_status),
            final_price,
            "GTQ" if final_price is not None else None,
            token2,
        )
        if not unit_id or initial is None:
            continue
        applied: list[tuple[date | None, Decimal, str]] = []
        for col, label, when in casa_changes:
            amount = money(casa_grid.get(row, {}).get(col) or "")
            if amount is None or amount == 0:
                continue
            applied.append((when, amount, label))
        running = apply_dated_changes("casa-elisa", unit_id, initial, applied)
        if final_price is not None and abs(running - final_price) > Decimal("1.00"):
            price_gap["Casa Elisa"] += 1

    # Boulevard 5. Initial price is Aproximacion - FHA. Precio promesa is the
    # current list price. Ajuste columns are increases. Descuento columns are
    # discounts. Ajuste 1, Ajuste 2, and Ajuste desistimiento have no date.
    b5_path = os.path.join(ROOT, "docs/BOULEVARD_5_2_Precios_y_Disponibilidad.xlsx")
    b5_grid = sheet_grid(b5_path, "Matriz Precios A")
    b5_header = header_row_with(
        b5_grid,
        {"Número", "Aproximacion - FHA", "Ajuste 1", "Ajuste desistimiento", "Precio promesa", "Estatus"},
    )
    b5_cells = ordered_cells(b5_grid, b5_header)
    b5_initial_cols = columns_named(b5_cells, "Aproximacion - FHA")
    b5_list_cols = columns_named(b5_cells, "Precio promesa")
    if len(b5_initial_cols) != 1 or len(b5_list_cols) != 1:
        raise RuntimeError(f"Boulevard 5 price headers {b5_initial_cols} {b5_list_cols}")
    b5_initial_at = col_index(b5_initial_cols[0])
    b5_numbers = columns_named(b5_cells, "Número", before=b5_initial_at)
    b5_tipo = columns_named(b5_cells, "Tipo", before=b5_initial_at)
    b5_hab = columns_named(b5_cells, "Habitaciones", before=b5_initial_at)
    b5_status = columns_named(b5_cells, "Estatus")
    if not b5_numbers or not b5_tipo or not b5_hab or len(b5_status) != 1:
        raise RuntimeError("Boulevard 5 unit headers are incomplete")
    b5_rises: list[tuple[str, str, date | None]] = []
    b5_discounts: list[tuple[str, str, date | None]] = []
    for col, value in b5_cells:
        label = value.strip()
        when = excel_date(b5_grid.get(b5_header - 1, {}).get(col, ""))
        if label in B5_RISE_HEADERS:
            b5_rises.append((col, label, when))
        elif label in B5_DISCOUNT_HEADERS:
            b5_discounts.append((col, label, when))
    found_rises = {label for _col, label, _when in b5_rises}
    found_discounts = {label for _col, label, _when in b5_discounts}
    if found_rises != set(B5_RISE_HEADERS) or found_discounts != set(B5_DISCOUNT_HEADERS):
        raise RuntimeError(f"Boulevard 5 columns rises {found_rises} discounts {found_discounts}")
    if len(b5_rises) != len(B5_RISE_HEADERS) or len(b5_discounts) != len(B5_DISCOUNT_HEADERS):
        raise RuntimeError("Boulevard 5 price columns are duplicated")
    b5_rises.sort(key=lambda item: col_index(item[0]))
    print(
        "boulevard rises",
        [(label, when.isoformat() if when else None) for _col, label, when in b5_rises],
        "discounts",
        [(label, when.isoformat() if when else None) for _col, label, when in b5_discounts],
        flush=True,
    )
    for row in sorted(b5_grid):
        if row <= b5_header:
            continue
        token = canonical_unit(b5_grid.get(row, {}).get(b5_numbers[0]))
        if not token or token.lower() in SKIP_UNIT_TOKENS or not unit_token_ok(token, False):
            continue
        model = (b5_grid.get(row, {}).get(b5_tipo[0]) or "").strip() or None
        if model and "total" in model.lower():
            continue
        initial = money(b5_grid.get(row, {}).get(b5_initial_cols[0]) or "")
        list_price = money(b5_grid.get(row, {}).get(b5_list_cols[0]) or "")
        raw_status = b5_grid.get(row, {}).get(b5_status[0]) or ""
        if raw_status.strip() == "" and initial is None and list_price is None:
            continue
        unit_id = add_observation(
            "Boulevard 5",
            "Principal",
            token,
            model,
            hab_code(b5_grid.get(row, {}).get(b5_hab[0])),
            status_name(raw_status),
            list_price,
            "GTQ" if list_price is not None else None,
        )
        if not unit_id:
            continue
        place = unit_place[unit_id]
        if initial is not None:
            applied = []
            for col, label, when in b5_rises:
                amount = money(b5_grid.get(row, {}).get(col) or "")
                if amount is None or amount == 0:
                    continue
                applied.append((when, amount, label))
            running = apply_dated_changes("boulevard-5", unit_id, initial, applied)
            if list_price is not None and abs(running - list_price) > Decimal("1.00"):
                price_gap["Boulevard 5"] += 1
        base_price = list_price if list_price is not None and list_price > 0 else initial
        if base_price is None or base_price <= 0:
            continue
        for col, label, _when in b5_discounts:
            amount = money(b5_grid.get(row, {}).get(col) or "")
            if amount is None or amount == 0:
                continue
            b5_discount_units.append(
                (place[0], place[1], place[2], place[3], abs(amount), base_price, label)
            )

    if new_towers:
        api.upsert("dim_tower", new_towers, "project_id,name")
    if new_models:
        api.upsert("dim_model", new_models, "project_id,name")
    if new_units:
        api.upsert("dim_unit", new_units, "project_id,tower_id,canonical_unit,unit_token_2,model_id")
    # one observation per unit: last write wins in this list
    by_unit: dict[str, dict[str, object]] = {}
    for row in observations:
        by_unit[str(row["unit_id"])] = row
    rise_kept: dict[str, dict[str, object]] = {}
    for row in rises:
        rise_kept[str(row["source_natural_key"])] = row
    rises = list(rise_kept.values())
    print(
        f"observations {len(by_unit)} unrecognized_status {unrecognized} rises {len(rises)} "
        f"undated {dict(undated_changes)} price_gap {price_gap}",
        flush=True,
    )
    api.upsert("fact_inventory_observation", list(by_unit.values()), "unit_id,observed_on")
    api.upsert("fact_price_rise", rises, "source_natural_key")

    sales: list[dict[str, object]] = []
    start_row = 0
    while True:
        status, _, body = api.request(
            "GET",
            "/v_sale?select=deal_id,unit_id",
            range_header=f"{start_row}-{start_row + 999}",
            prefer="count=exact",
        )
        if status == 416 or not isinstance(body, list) or not body:
            break
        sales.extend(body)
        if len(body) < 1000:
            break
        start_row += 1000
    sales_by_unit: dict[str, list[str]] = defaultdict(list)
    deals_by_token: dict[tuple[str, str, str], set[str]] = defaultdict(set)
    for sale in sales:
        sales_by_unit[str(sale["unit_id"])].append(str(sale["deal_id"]))
        place = unit_place.get(str(sale["unit_id"]))
        if place is None:
            continue
        project_id, tower_id, token, token2 = place
        deals_by_token[(project_id, tower_id, token)].add(str(sale["deal_id"]))
        if token2:
            deals_by_token[(project_id, tower_id, token2)].add(str(sale["deal_id"]))
    discount_type = next(
        (row for row in api.fetch_all("dim_discount_type", "id,name") if row["name"] == "Descuento (1 hab)"),
        None,
    )
    if discount_type is None:
        type_id = uuid7()
        api.upsert(
            "dim_discount_type",
            [{"id": type_id, "name": "Descuento (1 hab)", "is_sin_dato": False}],
            "name",
        )
    else:
        type_id = str(discount_type["id"])
    skipped_discount = 0
    for unit_id, amount, price in bene_discount_units:
        deals = sales_by_unit.get(unit_id, [])
        if len(deals) != 1:
            skipped_discount += 1
            continue
        rate = (amount / price).quantize(Decimal("0.000001"))
        discounts.append(
            {
                "id": uuid7(),
                "source_natural_key": f"benestare:descuento-1hab:{deals[0]}",
                "deal_id": deals[0],
                "discount_type_id": type_id,
                "amount_gtq": format(amount, "f"),
                "rate": format(rate, "f"),
            }
        )
    known_types = {str(row["name"]): str(row["id"]) for row in api.fetch_all("dim_discount_type", "id,name")}
    for type_name in sorted({item[6] for item in b5_discount_units}):
        if type_name in known_types:
            continue
        type_row_id = uuid7()
        api.upsert(
            "dim_discount_type",
            [{"id": type_row_id, "name": type_name, "is_sin_dato": False}],
            "name",
        )
        known_types[type_name] = type_row_id
    skipped_b5 = 0
    for project_id, tower_id, token, token2, amount, price, type_name in b5_discount_units:
        deal_ids = set(deals_by_token.get((project_id, tower_id, token), set()))
        if token2:
            deal_ids |= deals_by_token.get((project_id, tower_id, token2), set())
        if len(deal_ids) != 1:
            skipped_b5 += 1
            continue
        deal_id = next(iter(deal_ids))
        rate = (amount / price).quantize(Decimal("0.000001"))
        discounts.append(
            {
                "id": uuid7(),
                "source_natural_key": f"boulevard-5:{type_name}:{deal_id}",
                "deal_id": deal_id,
                "discount_type_id": known_types[type_name],
                "amount_gtq": format(amount, "f"),
                "rate": format(rate, "f"),
            }
        )
    kept: dict[str, dict[str, object]] = {}
    poisoned: set[str] = set()
    for row in discounts:
        key = str(row["source_natural_key"])
        if key in poisoned:
            continue
        previous = kept.get(key)
        if previous is not None and (
            previous["amount_gtq"] != row["amount_gtq"] or previous["deal_id"] != row["deal_id"]
        ):
            kept.pop(key, None)
            poisoned.add(key)
            continue
        kept[key] = row
    discounts = list(kept.values())
    print(
        f"discounts {len(discounts)} skipped_benestare {skipped_discount} "
        f"skipped_boulevard {skipped_b5} conflicted {len(poisoned)}",
        flush=True,
    )
    api.upsert("fact_discount", discounts, "source_natural_key")

    # Targets
    pairs = set()
    start_row = 0
    while True:
        status, _, body = api.request(
            "GET",
            "/dim_deal?select=asesor_id,project_id&order=id.asc",
            range_header=f"{start_row}-{start_row + 999}",
            prefer="count=exact",
        )
        if status == 416 or not isinstance(body, list) or not body:
            break
        for row in body:
            pairs.add((str(row["asesor_id"]), str(row["project_id"])))
        if len(body) < 1000:
            break
        start_row += 1000
    months = []
    cursor = date(2022, 6, 1)
    while cursor <= date(2026, 10, 1):
        months.append(cursor.isoformat())
        year = cursor.year + (1 if cursor.month == 12 else 0)
        month = 1 if cursor.month == 12 else cursor.month + 1
        cursor = date(year, month, 1)
    project_name = {pid: name for name, pid in projects.items()}
    targets = []
    for asesor_id, project_id in pairs:
        name = project_name.get(project_id)
        if name not in TARGET_UNITS:
            continue
        for month in months:
            targets.append(
                {
                    "id": uuid7(),
                    "source_natural_key": f"target:{asesor_id}:{project_id}:{month}",
                    "asesor_id": asesor_id,
                    "project_id": project_id,
                    "month_start": month,
                    "target_units": TARGET_UNITS[name],
                    "target_gtq": None,
                }
            )
    print(f"targets {len(targets)}", flush=True)
    api.upsert("fact_target", targets, "source_natural_key")
    for table in ("fact_inventory_observation", "fact_price_rise", "fact_discount", "fact_target", "fact_case_mark"):
        print(f"  {table}: {api.count(table)}", flush=True)


if __name__ == "__main__":
    main()
