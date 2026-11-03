#!/usr/bin/env python3
"""Emit the Cobros load SQL from the Odoo 15 archive.

The grammar matches cobros.parse_partner in
scripts/migrations/082_cobros_schema.sql. This script does not apply SQL.
It writes paste files under scripts/migrations/ and refuses to write them
when the posted-receipt totals disagree with the mapping.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ARCHIVE = Path("/Users/orion-tech/go/singularity/extraction_odoo15")
RAW = ARCHIVE / "output" / "raw"
REPORTS = ARCHIVE / "reports"
OUT_DIR = Path(__file__).resolve().parents[2] / "scripts" / "migrations"

CENT = Decimal("0.01")
RATE = Decimal("0.000001")

# Mapping, five-project and whole-book posted cobros.
EXPECT_ALL = {
    "GTQ": (8822, Decimal("73380489.37")),
    "USD": (67, Decimal("1284690.47")),
}
EXPECT_PROJECT_GTQ = {
    "boulevard-5": (5829, Decimal("66352535.79")),
    "benestare": (2303, Decimal("3481746.52")),
    "bosque-las-tapias": (666, Decimal("1393418.96")),
}
EXPECT_PROJECT_USD = {
    "boulevard-5": (43, Decimal("504470.47"), Decimal("3858110.03")),
    "benestare": (1, Decimal("425.00"), Decimal("3200.00")),
    "bosque-las-tapias": (0, Decimal("0.00"), Decimal("0.00")),
}
EXPECT_FIVE_GTQ = (8798, Decimal("71227701.27"))
EXPECT_FIVE_USD = (44, Decimal("504895.47"), Decimal("3861310.03"))
EXPECT_DS_GTQ = (883, Decimal("3277785.18"))
EXPECT_COBROS = 8889


def money(value: object) -> Decimal | None:
    if value is None or value is False or value == "":
        return None
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def money_sum(value: object) -> Decimal:
    parsed = money(value)
    return parsed if parsed is not None else Decimal("0.00")


def sql_text(value: str | None) -> str:
    if value is None:
        return "NULL"
    cleaned = value.replace("\x00", " ").replace("\r", " ").replace("\n", " ")
    return "'" + cleaned.replace("'", "''") + "'"


def sql_num(value: Decimal | None, scale: str = "0.01") -> str:
    if value is None:
        return "NULL"
    quant = Decimal(scale)
    return format(value.quantize(quant, rounding=ROUND_HALF_UP), "f")


def sql_int(value: int | None) -> str:
    if value is None:
        return "NULL"
    return str(int(value))


def sql_bool(value: bool) -> str:
    return "true" if value else "false"


def sql_date(value: str | None) -> str:
    if not value:
        return "NULL"
    day = value[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        return "NULL"
    return f"DATE '{day}'"


def sql_ts(value: str | None) -> str:
    if not value:
        return "NULL"
    stamp = value.strip().replace("T", " ")
    if len(stamp) == 10:
        stamp += " 00:00:00"
    stamp = stamp[:19]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", stamp):
        return "NULL"
    return f"timestamptz '{stamp}+00'"


def m2o_id(value: object) -> int | None:
    # bool is a subclass of int. Odoo uses false for an empty many2one.
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, list) and value and isinstance(value[0], int) and not isinstance(value[0], bool):
        return value[0]
    if isinstance(value, int):
        return value
    return None


def m2o_name(value: object) -> str | None:
    if isinstance(value, list) and len(value) > 1 and value[1]:
        return str(value[1])
    return None


def text_or_none(value: object) -> str | None:
    if value is None or value is False or value == "":
        return None
    return str(value)


def parse_partner(name: str) -> dict[str, object]:
    raw = (name or "").strip()
    is_ds = raw.startswith("DS-") or "02-DS-" in raw or "02-04DS-" in raw
    co_buyer = "/" in raw
    gv1 = "GV1" in raw
    body = raw[3:] if raw.startswith("DS-") else raw
    prefix = "none"
    project = "sin-asignar"
    rest = body
    tower = None
    modelo = None
    apt = None
    buyer = None

    if body.startswith("CD-02-"):
        prefix, project, rest = "cd-02", "boulevard-5", body[3:]
    elif body.startswith("02-"):
        prefix, project = "02", "boulevard-5"
    elif body.startswith("BNT-"):
        prefix, project = "bnt", "benestare"
    elif body.startswith("03-"):
        prefix, project = "03", "benestare"
    elif re.match(r"^C-[0-9]+-[0-9]+", body):
        prefix, project = "c", "bosque-las-tapias"
    elif body.startswith("BLT-"):
        prefix, project = "blt", "bosque-las-tapias"
    elif body.startswith("01-"):
        prefix, project = "01", "antigua-panorama"

    if prefix in ("02", "cd-02"):
        match = re.match(r"^02-([0-9]{4})-([^-]+)(?:-(.*))?$", rest)
        if match:
            apt = match.group(1)
            modelo = match.group(2)
            tail = match.group(3)
            if tail is not None:
                if re.match(r"^[0-9]+-", tail):
                    buyer = re.sub(r"^[0-9]+-", "", tail).strip() or None
                elif re.fullmatch(r"[0-9]+", tail):
                    buyer = None
                else:
                    buyer = tail.strip() or None
    elif prefix == "bnt":
        match = re.match(r"^BNT-([^-]+)-([^-]+)-(TA|TB|TC|TD)[- ]?(.*)$", body)
        if match:
            apt = match.group(1)
            modelo = match.group(2)
            tower = {"TA": "Torre A", "TB": "Torre B", "TC": "Torre C", "TD": "Torre D"}[match.group(3)]
            if match.group(4).strip():
                buyer = match.group(4).strip()
    elif prefix == "03":
        match = re.match(r"^03-(TA|TB|TC|TD)-([^-]+)-([^-]*)(?:-(.*))?$", body)
        if match:
            tower = {"TA": "Torre A", "TB": "Torre B", "TC": "Torre C", "TD": "Torre D"}[match.group(1)]
            apt = match.group(2)
            if match.group(3).strip():
                modelo = match.group(3).strip()
            tail = match.group(4)
            if tail and tail.strip() and not re.fullmatch(r"[0-9]+", tail.strip()):
                buyer = tail.strip()
    elif prefix == "c":
        match = re.match(r"^C-([0-9]+)-([0-9]+)-(.*)$", body)
        if match:
            tower = "Torre C"
            apt = match.group(2)
            if match.group(3).strip():
                modelo = match.group(3).strip()
    elif prefix == "blt":
        match = re.match(r"^BLT-\s*([0-9]+)-([^-]+)-TB\s*-?\s*(.*)$", body)
        if match:
            tower = "Torre B"
            apt = match.group(1)
            modelo = match.group(2)
            if match.group(3).strip():
                buyer = match.group(3).strip()

    return {
        "project_slug": project,
        "prefix_family": prefix,
        "tower": tower,
        "modelo": modelo,
        "apt": apt,
        "buyer_name": buyer,
        "is_desistimiento": is_ds,
        "co_buyer": co_buyer,
        "gv1": gv1,
    }


def check_samples() -> None:
    samples = {
        "02-0101-A7.1-04-Karla Michelle Abril Valencia de Galicia": ("boulevard-5", "02", "0101", "A7.1", None, False),
        "CD-02-1701-E6-José Odilio de Paz Vasquez": ("boulevard-5", "cd-02", "1701", "E6", None, False),
        "DS-CD-02-1706-B4-David Salomon Chup": ("boulevard-5", "cd-02", "1706", "B4", None, True),
        "02-04DS-05-B7-05-LESLIE CAROLINA GIL MORALES": ("boulevard-5", "02", None, None, None, True),
        "BNT-101-MB-TA-11 Wendy Azucena Barrientos Salazar": ("benestare", "bnt", "101", "MB", "Torre A", False),
        "03-TA-0101-B-10": ("benestare", "03", "0101", "B", "Torre A", False),
        "C-1-101-A PLUS": ("bosque-las-tapias", "c", "101", "A PLUS", "Torre C", False),
        "C-IMPRIME, S.A.": ("sin-asignar", "none", None, None, None, False),
        "BLT- 101-MB-TB - Braham Arnoldo Chután López": ("bosque-las-tapias", "blt", "101", "MB", "Torre B", False),
        "01-101-B1-Prueba": ("antigua-panorama", "01", None, None, None, False),
        "DS-José Ignacio Rámirez Soto": ("sin-asignar", "none", None, None, None, True),
    }
    for name, expected in samples.items():
        parsed = parse_partner(name)
        got = (
            parsed["project_slug"],
            parsed["prefix_family"],
            parsed["apt"],
            parsed["modelo"],
            parsed["tower"],
            parsed["is_desistimiento"],
        )
        if got != expected:
            raise SystemExit(f"parse sample failed for {name}: {got} != {expected}")


def load_jsonl(path: Path):
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def is_cesion(record: dict) -> bool:
    text = text_or_none(record.get("descripcion")) or ""
    return (
        record.get("payment_type") == "outbound"
        and record.get("partner_type") == "supplier"
        and "CESION DE DERECHO" in text.upper()
    )


def is_cobro(record: dict, move: dict | None) -> bool:
    if record.get("lane") != "customer":
        return False
    if record.get("payment_type") != "inbound":
        return False
    if record.get("partner_type") != "customer":
        return False
    if record.get("anulado"):
        return False
    if record.get("is_internal_transfer"):
        return False
    if not move or move.get("state") != "posted":
        return False
    return True


def chunked(rows: list[str], size: int) -> list[list[str]]:
    return [rows[index : index + size] for index in range(0, len(rows), size)]


def write_inserts(path: Path, header: str, table: str, columns: str, tuples: list[str], per_statement: int = 400) -> None:
    parts = [header.rstrip() + "\n"]
    for group in chunked(tuples, per_statement):
        parts.append(f"INSERT INTO {table} ({columns}) VALUES\n")
        parts.append(",\n".join(group))
        parts.append(";\n\n")
    path.write_text("".join(parts), encoding="utf-8")


def main() -> None:
    check_samples()
    if not RAW.exists():
        raise SystemExit(f"archive not found: {RAW}")

    print("reading partners", flush=True)
    partners: dict[int, dict[str, str | None]] = {}
    with (RAW / "res.partner.jsonl").open(encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            partners[int(record["id"])] = {
                "name": str(record.get("name") or ""),
                "write": text_or_none(record.get("write_date")),
            }

    print("reading payments", flush=True)
    payments: list[dict] = []
    cesion_count = 0
    move_ids: set[int] = set()
    with (RAW / "account.payment.jsonl").open(encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            cesion = is_cesion(record)
            if cesion:
                cesion_count += 1
            if record.get("partner_type") != "customer" and not cesion:
                continue
            move_id = m2o_id(record.get("move_id"))
            if move_id is not None:
                move_ids.add(move_id)
            record["lane"] = "cesion_proveedor" if cesion else "customer"
            payments.append(record)

    if cesion_count != 2:
        raise SystemExit(f"expected 2 cesión vendor payments, found {cesion_count}")

    print(f"kept payments {len(payments)}; reading moves", flush=True)
    moves: dict[int, dict] = {}
    with (RAW / "account.move.jsonl").open(encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            move_id = int(record["id"])
            if move_id in move_ids:
                moves[move_id] = record

    print("summing move-line debits", flush=True)
    debits: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    debit_seen: set[int] = set()
    with (RAW / "account.move.line.jsonl").open(encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            move_id = m2o_id(record.get("move_id"))
            if move_id not in move_ids:
                continue
            debit_seen.add(move_id)
            debits[move_id] += Decimal(str(record.get("debit") or 0))
    for move_id in debit_seen:
        debits[move_id] = debits[move_id].quantize(CENT, rounding=ROUND_HALF_UP)

    prepared: list[dict] = []
    for record in payments:
        partner_id = m2o_id(record.get("partner_id"))
        stored = partners.get(partner_id) if partner_id is not None else None
        name = (stored or {}).get("name") or m2o_name(record.get("partner_id")) or ""
        if not str(name).strip():
            name = "sin nombre"
        move_id = m2o_id(record.get("move_id"))
        move = moves.get(move_id) if move_id is not None else None
        currency = (m2o_name(record.get("currency_id")) or "").upper()
        if not re.fullmatch(r"[A-Z]{3}", currency):
            raise SystemExit(f"payment {record.get('id')} has no currency")
        company_id = m2o_id(move.get("company_id")) if move else None
        journal_id = m2o_id(move.get("journal_id")) if move else None
        prepared.append(
            {
                "payment_id": int(record["id"]),
                "move_id": move_id,
                "partner_id": partner_id,
                "partner_name": str(name),
                "lane": record["lane"],
                "payment_type": str(record.get("payment_type") or ""),
                "partner_type": str(record.get("partner_type") or ""),
                "anulado": bool(record.get("anulado")),
                "is_internal_transfer": bool(record.get("is_internal_transfer")),
                "is_matched": None if record.get("is_matched") is None else bool(record.get("is_matched")),
                "is_reconciled": None if record.get("is_reconciled") is None else bool(record.get("is_reconciled")),
                "amount": money(record.get("amount")) or Decimal("0.00"),
                "currency": currency,
                "debit_gtq": debits.get(move_id) if move_id in debit_seen else None,
                "move_date": text_or_none(move.get("date")) if move else None,
                "move_state": text_or_none(move.get("state")) if move else None,
                "move_type": text_or_none(move.get("move_type")) if move else None,
                "company_id": company_id,
                "company_name": m2o_name(move.get("company_id")) if move else None,
                "journal_id": journal_id,
                "journal_name": m2o_name(move.get("journal_id")) if move else None,
                "descripcion": text_or_none(record.get("descripcion")),
                "x_no_recibo": text_or_none(record.get("x_no_recibo")),
                "fecha_anulacion": text_or_none(record.get("fecha_anulacion")),
                "parts": parse_partner(str(name)),
                "move": move,
            }
        )

    cobros = [row for row in prepared if is_cobro(row, row["move"])]
    if len(cobros) != EXPECT_COBROS:
        raise SystemExit(f"cobro count {len(cobros)} != {EXPECT_COBROS}")

    def totals(rows: list[dict], currency: str) -> tuple[int, Decimal]:
        picked = [row for row in rows if row["currency"] == currency]
        return len(picked), sum((row["amount"] for row in picked), Decimal("0.00"))

    for currency, expected in EXPECT_ALL.items():
        got = totals(cobros, currency)
        if got != expected:
            raise SystemExit(f"all {currency} {got} != {expected}")

    five = [row for row in cobros if row["parts"]["project_slug"] in EXPECT_PROJECT_GTQ]
    gtq_five = totals(five, "GTQ")
    if gtq_five != EXPECT_FIVE_GTQ:
        raise SystemExit(f"five GTQ {gtq_five} != {EXPECT_FIVE_GTQ}")

    for slug, expected in EXPECT_PROJECT_GTQ.items():
        got = totals([row for row in cobros if row["parts"]["project_slug"] == slug], "GTQ")
        if got != expected:
            raise SystemExit(f"{slug} GTQ {got} != {expected}")

    usd_five_amount = Decimal("0.00")
    usd_five_debit = Decimal("0.00")
    usd_five_count = 0
    for slug, (count, amount, debit) in EXPECT_PROJECT_USD.items():
        rows = [row for row in cobros if row["parts"]["project_slug"] == slug and row["currency"] == "USD"]
        got_amount = sum((row["amount"] for row in rows), Decimal("0.00"))
        got_debit = sum(((row["debit_gtq"] or Decimal("0.00")) for row in rows), Decimal("0.00"))
        if (len(rows), got_amount, got_debit) != (count, amount, debit):
            raise SystemExit(f"{slug} USD {(len(rows), got_amount, got_debit)} != {(count, amount, debit)}")
        usd_five_count += len(rows)
        usd_five_amount += got_amount
        usd_five_debit += got_debit
    if (usd_five_count, usd_five_amount, usd_five_debit) != EXPECT_FIVE_USD:
        raise SystemExit("five USD total drifted")

    ds_rows = [row for row in cobros if row["parts"]["is_desistimiento"] and row["currency"] == "GTQ"]
    ds_total = (len(ds_rows), sum((row["amount"] for row in ds_rows), Decimal("0.00")))
    if ds_total != EXPECT_DS_GTQ:
        raise SystemExit(f"DS GTQ {ds_total} != {EXPECT_DS_GTQ}")

    gtq_mismatch = [
        row["payment_id"]
        for row in cobros
        if row["currency"] == "GTQ" and row["debit_gtq"] != row["amount"]
    ]
    if gtq_mismatch:
        raise SystemExit(f"{len(gtq_mismatch)} GTQ cobros whose debit sum is not the amount")

    empty = [row for row in cobros if row["parts"]["project_slug"] in ("santa-elena", "casa-elisa")]
    if empty:
        raise SystemExit("Santa Elena or Casa Elisa received a cobro")

    print(
        f"checks passed: {len(cobros)} cobros, "
        f"GTQ {EXPECT_ALL['GTQ'][1]}, USD {EXPECT_ALL['USD'][1]}",
        flush=True,
    )

    plan_ids: set[int] = set()
    plan_units: list[tuple[str, dict]] = []
    for slug, filename in (
        ("boulevard-5", "plan_vs_actual_b5.json"),
        ("benestare", "plan_vs_actual_benestare.json"),
        ("bosque-las-tapias", "plan_vs_actual_tapias.json"),
    ):
        document = json.loads((REPORTS / filename).read_text(encoding="utf-8"))
        seen: set[int] = set()
        for unit in document["units"]:
            partner_id = int(unit["partner_id"])
            if partner_id in seen:
                raise SystemExit(f"duplicate plan partner {partner_id} in {slug}")
            seen.add(partner_id)
            plan_ids.add(partner_id)
            plan_units.append((slug, unit))

    needed_partners: set[int] = set(plan_ids)
    for row in prepared:
        if row["partner_id"] is not None:
            needed_partners.add(row["partner_id"])
    for partner_id, stored in partners.items():
        parsed = parse_partner(stored["name"] or "")
        if parsed["project_slug"] != "sin-asignar" or parsed["is_desistimiento"]:
            needed_partners.add(partner_id)

    missing_names = needed_partners - partners.keys()
    if missing_names:
        print(f"plan or receipt partners missing from res.partner: {len(missing_names)}", flush=True)

    plan_names = {
        int(unit["partner_id"]): str(unit.get("raw_name") or "").strip()
        for _slug, unit in plan_units
        if str(unit.get("raw_name") or "").strip()
    }
    partner_rows: list[str] = []
    for partner_id in sorted(needed_partners):
        stored = partners.get(partner_id)
        write_at = stored["write"] if stored else None
        name = ""
        if stored and stored["name"] and str(stored["name"]).strip():
            name = str(stored["name"]).strip()
        if not name:
            name = next(
                (
                    row["partner_name"]
                    for row in prepared
                    if row["partner_id"] == partner_id and row["partner_name"] != "sin nombre"
                ),
                "",
            )
        if not name:
            name = plan_names.get(partner_id, "")
        # One canceled receipt points at partner 7018, whose name is false
        # in the archive. Keep the row so the foreign key holds. This is not
        # a buyer we invented.
        if not name:
            name = "sin nombre"
        partner_rows.append(
            f"  ({sql_int(partner_id)}, {sql_text(name)}, {sql_ts(write_at)})"
        )

    receipt_rows: list[str] = []
    for row in prepared:
        matched = "NULL" if row["is_matched"] is None else sql_bool(bool(row["is_matched"]))
        reconciled = "NULL" if row["is_reconciled"] is None else sql_bool(bool(row["is_reconciled"]))
        receipt_rows.append(
            "  ("
            + ", ".join(
                [
                    sql_int(row["payment_id"]),
                    sql_int(row["move_id"]),
                    sql_int(row["partner_id"]),
                    sql_text(row["partner_name"]),
                    sql_text(row["lane"]),
                    sql_text(row["payment_type"]),
                    sql_text(row["partner_type"]),
                    sql_bool(row["anulado"]),
                    sql_bool(row["is_internal_transfer"]),
                    matched,
                    reconciled,
                    sql_num(row["amount"]),
                    sql_text(row["currency"]),
                    sql_num(row["debit_gtq"]),
                    sql_date(row["move_date"]),
                    sql_text(row["move_state"]),
                    sql_text(row["move_type"]),
                    sql_int(row["company_id"]),
                    sql_text(row["company_name"]),
                    sql_int(row["journal_id"]),
                    sql_text(row["journal_name"]),
                    sql_text(row["descripcion"]),
                    sql_text(row["x_no_recibo"]),
                    sql_date(row["fecha_anulacion"]),
                ]
            )
            + ")"
        )

    unit_rows: list[str] = []
    month_rows: list[str] = []
    coverage_updates: list[str] = []
    for slug, filename in (
        ("boulevard-5", "plan_vs_actual_b5.json"),
        ("benestare", "plan_vs_actual_benestare.json"),
        ("bosque-las-tapias", "plan_vs_actual_tapias.json"),
    ):
        document = json.loads((REPORTS / filename).read_text(encoding="utf-8"))
        coverage = document.get("coverage") or {}
        coverage_updates.append(
            "UPDATE cobros.plan_file SET "
            + ", ".join(
                [
                    f"expected_to_date_total = {sql_num(money(coverage.get('expected_to_date_total')))}",
                    f"confirmed_to_date_total = {sql_num(money(coverage.get('confirmed_to_date_total')))}",
                    f"collection_rate = {sql_num(Decimal(str(coverage['collection_rate'])), '0.000001') if coverage.get('collection_rate') is not None else 'NULL'}",
                    f"reportado_total = {sql_num(money(coverage.get('reportado_total'))) if 'reportado_total' in coverage else 'NULL'}",
                    f"cash_without_plan = {sql_num(money(coverage.get('confirmed_cash_without_plan'))) if 'confirmed_cash_without_plan' in coverage else 'NULL'}",
                    f"n_units = {sql_int(coverage.get('n_partner_records', coverage.get('n_units')))}",
                    f"n_with_plan = {sql_int(coverage.get('n_with_plan'))}",
                ]
            )
            + f" WHERE project_slug = {sql_text(slug)};"
        )
        for unit in document["units"]:
            flags = unit.get("flags") or []
            if not isinstance(flags, list):
                flags = [str(flags)]
            flag_sql = "ARRAY[" + ", ".join(sql_text(str(flag)) for flag in flags) + "]::text[]" if flags else "'{}'::text[]"
            last_receipt = None
            for item in unit.get("receipts") or []:
                if item.get("estado") == "publicado" and item.get("date"):
                    day = str(item["date"])[:10]
                    if last_receipt is None or day > last_receipt:
                        last_receipt = day
            rate = unit.get("collection_rate")
            rate_sql = "NULL" if rate is None else sql_num(Decimal(str(rate)), "0.000001")
            behind = unit.get("months_behind")
            behind_sql = "NULL" if behind is None else sql_num(Decimal(str(behind)), "0.0001")
            unit_rows.append(
                "  ("
                + ", ".join(
                    [
                        sql_text(slug),
                        sql_int(int(unit["partner_id"])),
                        sql_text(str(unit.get("raw_name") or "")),
                        sql_text(text_or_none(unit.get("apt"))),
                        sql_text(text_or_none(unit.get("modelo"))),
                        sql_text(text_or_none(unit.get("tower"))),
                        sql_text(text_or_none(unit.get("buyer_name"))),
                        sql_text(text_or_none(unit.get("population"))),
                        sql_text(text_or_none(unit.get("status"))),
                        sql_text(text_or_none(unit.get("commercial_state"))),
                        sql_bool(bool(unit.get("has_plan"))),
                        sql_text(text_or_none(unit.get("plan_confidence"))),
                        sql_int(unit.get("n_cuotas")),
                        sql_num(money(unit.get("cuota_typical"))),
                        sql_num(money(unit.get("expected_to_date"))),
                        sql_num(money(unit.get("confirmed_to_date"))),
                        sql_num(money(unit.get("reported_to_date"))),
                        sql_num(money(unit.get("balance"))),
                        rate_sql,
                        behind_sql,
                        sql_int(unit.get("n_payments")),
                        sql_date(last_receipt),
                        flag_sql,
                    ]
                )
                + ")"
            )
            for month in unit.get("monthly") or []:
                month_name = str(month.get("month") or "")
                if not re.fullmatch(r"\d{4}-\d{2}", month_name):
                    raise SystemExit(f"bad plan month {month_name} on {unit.get('partner_id')}")
                garbage = month_name < "2020-01"
                month_rows.append(
                    "  ("
                    + ", ".join(
                        [
                            sql_text(slug),
                            sql_int(int(unit["partner_id"])),
                            sql_date(month_name + "-01"),
                            sql_num(money_sum(month.get("expected"))),
                            sql_num(money_sum(month.get("reported"))),
                            sql_num(money_sum(month.get("confirmed"))),
                            sql_num(money_sum(month.get("cum_expected"))),
                            sql_num(money_sum(month.get("cum_reported"))),
                            sql_num(money_sum(month.get("cum_confirmed"))),
                            sql_bool(garbage),
                        ]
                    )
                    + ")"
                )

    header_common = """-- Generated by scripts/cobros/emit_load_sql.py from the Odoo 15 archive
-- run 20261102T184027Z. Do not edit by hand. Re-run the script to regenerate.
-- Paste after 082_cobros_schema.sql. Run every 083–086 file, in order.
-- 083 truncates the fact tables, so a re-load starts there and continues
-- through 086. Do not paste the rollback from 082 in the middle of this load.
"""

    partner_header = header_common + """
-- 083 partners. Truncates facts so this file is the start of a re-load.
TRUNCATE cobros.plan_month, cobros.plan_unit, cobros.receipt, cobros.partner;
"""
    receipt_columns = """odoo_payment_id, odoo_move_id, odoo_partner_id, partner_name, lane,
  payment_type, partner_type, anulado, is_internal_transfer, is_matched, is_reconciled,
  amount, currency, debit_gtq, move_date, move_state, move_type,
  company_odoo_id, company_name, journal_odoo_id, journal_name,
  descripcion, x_no_recibo, fecha_anulacion"""
    unit_columns = """project_slug, odoo_partner_id, raw_name, apt, modelo, tower, buyer_name,
  population, status, commercial_state, has_plan, plan_confidence, n_cuotas, cuota_typical,
  expected_to_date, confirmed_to_date, reported_to_date, balance, collection_rate,
  months_behind, n_payments, last_receipt_on, flags"""
    month_columns = """project_slug, odoo_partner_id, month_on, expected, reported, confirmed,
  cum_expected, cum_reported, cum_confirmed, ocr_garbage"""

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob("08[3-9]_cobros_load_*.sql"):
        stale.unlink()

    write_inserts(
        OUT_DIR / "083_cobros_load_partners.sql",
        partner_header,
        "cobros.partner",
        "odoo_partner_id, name, write_at",
        partner_rows,
    )

    receipt_groups = chunked(receipt_rows, 2500)
    for index, group in enumerate(receipt_groups, start=1):
        write_inserts(
            OUT_DIR / f"084_cobros_load_receipts_{index:02d}.sql",
            header_common + f"\n-- 084 receipts, part {index} of {len(receipt_groups)}.\n",
            "cobros.receipt",
            receipt_columns,
            group,
        )

    plan_header = header_common + "\n-- 085 plan units, coverage totals, and months.\n" + "\n".join(coverage_updates) + "\n"
    # Units first, then months, in one file if it stays under ~2.5 MB, else split months.
    unit_sql = []
    # Build via write_inserts into memory by writing units then months.
    unit_path = OUT_DIR / "085_cobros_load_01_units.sql"
    write_inserts(unit_path, plan_header, "cobros.plan_unit", unit_columns, unit_rows)

    month_groups = chunked(month_rows, 4000)
    for index, group in enumerate(month_groups, start=1):
        write_inserts(
            OUT_DIR / f"085_cobros_load_02_months_{index:02d}.sql",
            header_common + f"\n-- 085 plan months, part {index} of {len(month_groups)}. Run after 085_cobros_load_01_units.sql.\n",
            "cobros.plan_month",
            month_columns,
            group,
        )

    check = f"""{header_common}
-- 086 acceptance check against the mapping. Raises and leaves the loaded
-- rows in place if a total disagrees; it does not delete them.

DO $check$
DECLARE
  v_cobros integer;
  v_gtq_n integer;
  v_gtq numeric;
  v_usd_n integer;
  v_usd numeric;
  v_five_gtq_n integer;
  v_five_gtq numeric;
  v_ds_n integer;
  v_ds numeric;
  v_debit_mismatch integer;
  v_empty integer;
  v_b5_gtq_n integer;
  v_b5_gtq numeric;
  v_bnt_gtq_n integer;
  v_bnt_gtq numeric;
  v_tap_gtq_n integer;
  v_tap_gtq numeric;
  v_b5_usd_n integer;
  v_b5_usd numeric;
  v_b5_debit numeric;
  v_garbage integer;
BEGIN
  SELECT count(*) INTO v_cobros FROM cobros.v_cobro;
  SELECT count(*), COALESCE(sum(amount), 0) INTO v_gtq_n, v_gtq
  FROM cobros.v_cobro WHERE currency = 'GTQ';
  SELECT count(*), COALESCE(sum(amount), 0) INTO v_usd_n, v_usd
  FROM cobros.v_cobro WHERE currency = 'USD';
  SELECT count(*), COALESCE(sum(amount), 0) INTO v_five_gtq_n, v_five_gtq
  FROM cobros.v_cobro WHERE in_five AND currency = 'GTQ';
  SELECT count(*), COALESCE(sum(amount), 0) INTO v_ds_n, v_ds
  FROM cobros.v_cobro WHERE is_desistimiento AND currency = 'GTQ';
  SELECT count(*) INTO v_debit_mismatch
  FROM cobros.v_cobro WHERE currency = 'GTQ' AND debit_gtq IS DISTINCT FROM amount;
  SELECT count(*) INTO v_empty
  FROM cobros.v_cobro WHERE project_slug IN ('santa-elena', 'casa-elisa');
  SELECT count(*), COALESCE(sum(amount), 0) INTO v_b5_gtq_n, v_b5_gtq
  FROM cobros.v_cobro WHERE project_slug = 'boulevard-5' AND currency = 'GTQ';
  SELECT count(*), COALESCE(sum(amount), 0) INTO v_bnt_gtq_n, v_bnt_gtq
  FROM cobros.v_cobro WHERE project_slug = 'benestare' AND currency = 'GTQ';
  SELECT count(*), COALESCE(sum(amount), 0) INTO v_tap_gtq_n, v_tap_gtq
  FROM cobros.v_cobro WHERE project_slug = 'bosque-las-tapias' AND currency = 'GTQ';
  SELECT count(*), COALESCE(sum(amount), 0), COALESCE(sum(debit_gtq), 0)
  INTO v_b5_usd_n, v_b5_usd, v_b5_debit
  FROM cobros.v_cobro WHERE project_slug = 'boulevard-5' AND currency = 'USD';
  SELECT count(*) INTO v_garbage FROM cobros.plan_month WHERE ocr_garbage;

  IF v_cobros <> {EXPECT_COBROS}
     OR v_gtq_n <> {EXPECT_ALL['GTQ'][0]} OR v_gtq <> {EXPECT_ALL['GTQ'][1]}
     OR v_usd_n <> {EXPECT_ALL['USD'][0]} OR v_usd <> {EXPECT_ALL['USD'][1]}
     OR v_five_gtq_n <> {EXPECT_FIVE_GTQ[0]} OR v_five_gtq <> {EXPECT_FIVE_GTQ[1]}
     OR v_ds_n <> {EXPECT_DS_GTQ[0]} OR v_ds <> {EXPECT_DS_GTQ[1]}
     OR v_debit_mismatch <> 0
     OR v_empty <> 0
     OR v_b5_gtq_n <> {EXPECT_PROJECT_GTQ['boulevard-5'][0]} OR v_b5_gtq <> {EXPECT_PROJECT_GTQ['boulevard-5'][1]}
     OR v_bnt_gtq_n <> {EXPECT_PROJECT_GTQ['benestare'][0]} OR v_bnt_gtq <> {EXPECT_PROJECT_GTQ['benestare'][1]}
     OR v_tap_gtq_n <> {EXPECT_PROJECT_GTQ['bosque-las-tapias'][0]} OR v_tap_gtq <> {EXPECT_PROJECT_GTQ['bosque-las-tapias'][1]}
     OR v_b5_usd_n <> {EXPECT_PROJECT_USD['boulevard-5'][0]}
     OR v_b5_usd <> {EXPECT_PROJECT_USD['boulevard-5'][1]}
     OR v_b5_debit <> {EXPECT_PROJECT_USD['boulevard-5'][2]}
     OR v_garbage < 1
  THEN
    RAISE EXCEPTION
      'cobros load check failed: cobros %, gtq %/%, usd %/%, five %, ds %/%, debit mismatches %, empty %, b5 %, benestare %, tapias %, b5 usd %/%/%, garbage months %',
      v_cobros, v_gtq_n, v_gtq, v_usd_n, v_usd, v_five_gtq, v_ds_n, v_ds,
      v_debit_mismatch, v_empty, v_b5_gtq, v_bnt_gtq, v_tap_gtq,
      v_b5_usd_n, v_b5_usd, v_b5_debit, v_garbage;
  END IF;
END
$check$;

SELECT 'cobros load check passed' AS result,
  (SELECT count(*) FROM cobros.v_cobro) AS cobros,
  (SELECT count(*) FROM cobros.partner) AS partners,
  (SELECT count(*) FROM cobros.plan_unit) AS plan_units,
  (SELECT count(*) FROM cobros.v_plan_mes) AS plan_months_kept,
  (SELECT count(*) FROM cobros.v_caso_revision) AS casos,
  (SELECT count(*) FROM cobros.v_desistimiento) AS desistimientos,
  (SELECT count(*) FROM cobros.v_alerta) AS alertas_archivo;
"""
    (OUT_DIR / "086_cobros_load_check.sql").write_text(check, encoding="utf-8")
    written = sorted(OUT_DIR.glob("08[3-6]_cobros_load_*.sql"))
    for path in written:
        print(f"{path.name} {path.stat().st_size // 1024} KB")
    print(f"partners {len(partner_rows)} receipts {len(receipt_rows)} units {len(unit_rows)} months {len(month_rows)}")


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
