"""Load the Créditos read model from the Pipedrive raw extract.

Run from the repo root. Migration 089 has to be applied first, and the
creditos schema has to be exposed in the Data API:

    python3 scripts/creditos/load.py
    python3 scripts/creditos/load.py --check

The load stages the rows and replaces the live facts in one transaction
through creditos.swap_load(). --check parses and prints counts without
writing.

Reads output/raw JSONL, not the resolved CSV. The resolved deals.csv keeps
only one column named Tipo de Crédito and drops the other field.

Does not touch public.pai_credito_expediente, ventas, or mercadeo. Does not
invent a stage or an option label: an unknown stage id or option id fails
the load. The dimension seed from migration 082 still has to be loaded.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.environ.get(
    "CREDITOS_PIPEDRIVE_RAW",
    "/Users/orion-tech/go/singularity/extraction_pipedrive/output/raw",
)
GUATEMALA = ZoneInfo("America/Guatemala")
PIPELINES = {7, 8, 9, 10, 11, 18}
BATCH = 200
SCANNER = re.compile(r"(esc[aá]ner|escan|scanner|scaner)", re.IGNORECASE)

# API keys from the 2026-11-02 recon. The screen label is not unique.
FIELD = {
    "tipo_a": "4388f9408bee97892d7e815a8aea5578cc15db23",
    "tipo_b": "a5faa716153e778e295dab71a2bb4462bcc2389f",
    "monto": "1516a474554ae0b2e155f5c5c26f711c1f95a801",
    "valor_bien": "3ffbddabd1523b8592a86d23ce2bf7e6114be461",
    "enganche": "4e53ed5b7fb1244f98aa2650bc64056bedb778d8",
    "banco": "4b61271f6d436ee08ff792cd771bc4053d456753",
    "coordinadora": "67d0a55bcaf20e7e973f45e6dfa1aaa4be409d88",
    "caso": "d509057bfda9b8fb9552a7e3241010ef9943d191",
    "apartamento": "73045ac2bfc12bc9020797e200c92354b7378050",
    "papeleria": "ac1bd387053111fea23f28fd36a6bb1fac127788",
    "reserva": "9ca2acd17f92715febc0a101577cd36867424905",
    "armado": "9568a9d777a27747822682790e25fbf1c93e1d18",
    "armado_on": "093d453d59a4b987f30c7445caebd2f4ba792ce0",
    "ingreso": "942d8169c323f390480d8516ca4a25375a7b2899",
    "ingreso_on": "18492b3389a7a7d7d5c7d1d179c4566fc6b99fc3",
    "susp_fha": "493ee81c1c7aa8a78719b4a947c0da1d94e58154",
    "susp_banco": "d2c300fd3c827ca3d7c41b048fae507155732d03",
    "lift": "71590de955fd7558f5e409295704e63598164aa0",
    "aprob_fha": "b730ab421170bd024fe55e1a18c41ce5da92679f",
    "aprob_fha_on": "a888e0e8c76625232ced492085d5b977b3752015",
    "aprob_banco": "37842b89e49a1fabb48a4de60ff0549023d2e367",
    "aprob_banco_on": "5c3c31beb091f7f9c10047b417fc4f4ac335d948",
    "tecnica_on": "a21100d69dbe3be2786cb131a221ff55730d4a37",
    "fecha_pcv": "d4b106a562009efef109aee1944bcbbbbd0797c7",
    "envia_pcv": "a5b27df2a5306c04c5ea32fc7d3d642f29541ae5",
    "revision_pcv": "459ddcc313129c5a4cff448c5ed91bc3834d9c73",
    "fecha_promesa": "e7b3ab5f094694b2b493d2bc474ad74504013ca9",
    "legalizacion": "513ca755843b58564ee28b886cd59b1c6f743a82",
    "recepcion_legalizacion": "ecf50140d4fd16f80f49d57f70d297cf490281fc",
    "recepcion_compraventa": "297ac70629ee4328af41f1607c608c1c8d872c2e",
}


def uuid7() -> str:
    unix_ms = int(time.time() * 1000) & ((1 << 48) - 1)
    raw = unix_ms.to_bytes(6, "big") + os.urandom(10)
    data = bytearray(raw)
    data[6] = (data[6] & 0x0F) | 0x70
    data[8] = (data[8] & 0x3F) | 0x80
    return str(uuid.UUID(bytes=bytes(data)))


def load_env() -> dict[str, str]:
    found: dict[str, str] = {}
    with open(os.path.join(ROOT, ".env.local"), encoding="utf-8") as handle:
        for line in handle:
            text = line.strip()
            if not text or text.startswith("#") or "=" not in text:
                continue
            key, value = text.split("=", 1)
            found[key.strip()] = value.strip().strip('"').strip("'")
    return found


def as_timestamptz(value: object) -> str | None:
    if value is None or value is False:
        return None
    text = str(value).strip()
    if text == "" or text.lower() in {"false", "none", "null"}:
        return None
    if text.endswith("Z") or "+" in text[10:]:
        return text
    return text.replace(" ", "T") + "Z"


def as_date(value: object) -> str | None:
    if value is None or value is False:
        return None
    text = str(value).strip()
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    return None


def soft_int(value: object) -> int | None:
    try:
        return option_id(value)
    except RuntimeError:
        return None


def option_id(value: object) -> int | None:
    if value is None or value is False or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if not value.is_integer():
            raise RuntimeError(f"option id is not a whole number: {value}")
        return int(value)
    if isinstance(value, str):
        text = value.strip()
        if text == "":
            return None
        if text.isdigit():
            return int(text)
    if isinstance(value, dict) and "id" in value:
        return option_id(value.get("id"))
    raise RuntimeError(f"cannot read option id from {value!r}")


def decimal_text(value: object) -> str | None:
    if value is None or value is False or value == "":
        return None
    try:
        amount = Decimal(str(value).strip().replace(",", ""))
    except (InvalidOperation, ValueError):
        return None
    return format(amount.quantize(Decimal("0.01")), "f")


def money_pair(value: object) -> tuple[str | None, str | None]:
    if value is None or value is False or value == "":
        return None, None
    if isinstance(value, dict):
        amount = decimal_text(value.get("value"))
        currency = value.get("currency")
        code = str(currency).strip().upper() if currency else None
        if amount is None:
            return None, None
        return amount, code or None
    return decimal_text(value), None


def caso_text(value: object) -> str | None:
    if value is None or value is False or value == "":
        return None
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return format(Decimal(str(value)), "f")
    if isinstance(value, int):
        return str(value)
    text = str(value).strip()
    return text or None


def text_or_none(value: object, limit: int) -> str | None:
    if value is None or value is False:
        return None
    text = str(value).strip()
    if text == "":
        return None
    return text[:limit]


def custom(row: dict[str, object], name: str) -> object:
    fields = row.get("custom_fields")
    if not isinstance(fields, dict):
        return None
    return fields.get(FIELD[name])


def truthy_deleted(value: object) -> bool:
    return value is True or value == 1 or str(value).strip().lower() == "true"


class Api:
    def __init__(self, base_url: str, service_key: str) -> None:
        self.base = base_url.rstrip("/") + "/rest/v1"
        self.key = service_key

    def request(
        self,
        method: str,
        path: str,
        payload: object | None = None,
        range_header: str | None = None,
        prefer: str | None = None,
    ) -> tuple[int, dict[str, str], object]:
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Accept": "application/json",
            "Content-Profile": "creditos",
            "Accept-Profile": "creditos",
            "Prefer": prefer or "return=minimal",
        }
        if range_header:
            headers["Range"] = range_header
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        for attempt in range(6):
            try:
                with urllib.request.urlopen(request, timeout=180) as response:
                    raw = response.read()
                    body: object = json.loads(raw.decode("utf-8")) if raw else None
                    return response.status, dict(response.headers), body
            except urllib.error.HTTPError as error:
                detail = error.read().decode("utf-8", errors="replace")
                if error.code == 416:
                    return 416, dict(error.headers), []
                if error.code in (429, 500, 502, 503, 504) and attempt < 5:
                    time.sleep(2**attempt)
                    continue
                raise RuntimeError(f"{method} {path} failed ({error.code}): {detail[:800]}") from error
        raise RuntimeError(f"{method} {path} failed after retries")

    def fetch_all(self, table: str, select: str, order: str = "id.asc") -> list[dict[str, object]]:
        rows: list[dict[str, object]] = []
        start = 0
        size = 1000
        quoted = urllib.parse.quote(select, safe=",")
        order_q = urllib.parse.quote(order, safe=",.")
        while True:
            status, _, body = self.request(
                "GET",
                f"/{table}?select={quoted}&order={order_q}",
                range_header=f"{start}-{start + size - 1}",
                prefer="count=exact",
            )
            if status == 416 or not body:
                break
            if not isinstance(body, list):
                raise RuntimeError(f"expected a list from {table}")
            rows.extend(body)
            if len(body) < size:
                break
            start += size
        return rows

    def insert(self, table: str, rows: list[dict[str, object]]) -> None:
        for offset in range(0, len(rows), BATCH):
            chunk = rows[offset : offset + BATCH]
            self.request("POST", f"/{table}", chunk, prefer="return=minimal")
            done = min(offset + BATCH, len(rows))
            if done == len(rows) or done % (BATCH * 10) == 0:
                print(f"  {table}: {done}/{len(rows)}", flush=True)

    def delete_filtered(self, table: str, filt: str) -> None:
        self.request("DELETE", f"/{table}?{filt}", prefer="return=minimal")

    def swap_load(self) -> dict[str, object]:
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Content-Profile": "creditos",
            "Accept-Profile": "creditos",
        }
        call = urllib.request.Request(
            self.base + "/rpc/swap_load",
            data=b"{}",
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(call, timeout=600) as response:
                raw = response.read()
                body: object = json.loads(raw.decode("utf-8")) if raw else None
        except Exception as error:
            detail = str(error)
            if isinstance(error, urllib.error.HTTPError):
                body_text = error.read().decode("utf-8", errors="replace").strip()
                if body_text:
                    detail = body_text
            raise RuntimeError(
                "swap_load failed or timed out; check creditos.v_deal row count before rerunning: "
                f"{detail}"
            ) from error
        if not isinstance(body, dict):
            raise RuntimeError(
                "swap_load failed or timed out; check creditos.v_deal row count before rerunning: "
                f"response was {body!r}"
            )
        return body


def content_range_total(headers: dict[str, str], table: str) -> int:
    raw: str | None = None
    for key, value in headers.items():
        if key.lower() == "content-range":
            raw = str(value).strip()
            break
    total = ""
    if raw is not None and "/" in raw:
        total = raw.rsplit("/", 1)[1].strip()
    if not total.isdigit():
        raise RuntimeError(f"{table} count missing Content-Range total ({raw!r})")
    return int(total)


def stream_jsonl(name: str):
    path = os.path.join(RAW, name)
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def main() -> None:
    if not os.path.isdir(RAW):
        raise RuntimeError(f"Pipedrive raw extract not found at {RAW}")
    env = load_env()
    base_url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    api = Api(base_url, service_key)

    stages = {
        int(row["pipedrive_stage_id"]): str(row["id"])
        for row in api.fetch_all("dim_stage", "id,pipedrive_stage_id")
    }
    pipelines = {
        int(row["pipedrive_pipeline_id"]): {
            "id": str(row["id"]),
            "project_id": str(row["project_id"]),
        }
        for row in api.fetch_all("dim_pipeline", "id,pipedrive_pipeline_id,project_id")
    }
    if len(stages) != 71 or set(pipelines) != PIPELINES:
        raise RuntimeError(
            "creditos dimensions are not the 082 seed "
            f"(stages {len(stages)}, pipelines {sorted(pipelines)}). "
            "Run scripts/migrations/082_creditos_pipedrive.sql and expose the schema."
        )

    deals: list[dict[str, object]] = []
    deal_ids: dict[int, str] = {}
    skipped_deleted = 0
    skipped_status: dict[str, int] = {}
    for row in stream_jsonl("deals.jsonl"):
        pipeline_id = row.get("pipeline_id")
        try:
            pipeline_key = int(pipeline_id)
        except (TypeError, ValueError):
            continue
        if pipeline_key not in PIPELINES:
            continue
        if truthy_deleted(row.get("is_deleted")):
            skipped_deleted += 1
            continue
        status = str(row.get("status") or "").strip().lower()
        if status not in {"open", "lost", "won"}:
            skipped_status[status or "(vacío)"] = skipped_status.get(status or "(vacío)", 0) + 1
            continue
        stage_key = row.get("stage_id")
        try:
            stage_id = int(stage_key)
        except (TypeError, ValueError):
            raise RuntimeError(f"deal {row.get('id')} has no stage_id") from None
        if stage_id not in stages:
            raise RuntimeError(
                f"deal {row.get('id')} is in stage {stage_id}, which is not in the 082 seed. "
                "The load will not invent a lane."
            )
        pipedrive_id = int(row["id"])
        deal_uuid = uuid7()
        deal_ids[pipedrive_id] = deal_uuid
        value_amount, _ = money_pair(row.get("value"))
        monto_amount, monto_currency = money_pair(custom(row, "monto"))
        bien_amount, bien_currency = money_pair(custom(row, "valor_bien"))
        enganche_amount, enganche_currency = money_pair(custom(row, "enganche"))
        currency = text_or_none(row.get("currency"), 8)
        deals.append(
            {
                "id": deal_uuid,
                "pipedrive_deal_id": pipedrive_id,
                "project_id": pipelines[pipeline_key]["project_id"],
                "pipeline_id": pipelines[pipeline_key]["id"],
                "stage_id": stages[stage_id],
                "title": text_or_none(row.get("title"), 500),
                "status": status,
                "person_id": soft_int(row.get("person_id")),
                "currency": currency.upper() if currency else None,
                "value_amount": value_amount,
                "add_time": as_timestamptz(row.get("add_time")),
                "update_time": as_timestamptz(row.get("update_time")),
                "stage_change_time": as_timestamptz(row.get("stage_change_time")),
                "expected_close_on": as_date(row.get("expected_close_date")),
                "won_time": as_timestamptz(row.get("won_time")),
                "lost_time": as_timestamptz(row.get("lost_time")),
                "lost_reason": text_or_none(row.get("lost_reason"), 300),
                "apartamento": text_or_none(custom(row, "apartamento"), 80),
                "caso_fha": caso_text(custom(row, "caso")),
                "monto_prestamo": monto_amount,
                "monto_prestamo_currency": monto_currency,
                "valor_bien": bien_amount,
                "valor_bien_currency": bien_currency,
                "enganche_pactado": enganche_amount,
                "enganche_currency": enganche_currency,
                "tipo_a_option_id": option_id(custom(row, "tipo_a")),
                "tipo_b_option_id": option_id(custom(row, "tipo_b")),
                "banco_option_id": option_id(custom(row, "banco")),
                "coordinadora_option_id": option_id(custom(row, "coordinadora")),
                "papeleria_vencida_option_id": option_id(custom(row, "papeleria")),
                "reserva_completa_option_id": option_id(custom(row, "reserva")),
                "armado_option_id": option_id(custom(row, "armado")),
                "armado_on": as_date(custom(row, "armado_on")),
                "ingreso_analisis_option_id": option_id(custom(row, "ingreso")),
                "ingreso_analisis_on": as_date(custom(row, "ingreso_on")),
                "suspendido_fha_on": as_date(custom(row, "susp_fha")),
                "suspendido_banco_on": as_date(custom(row, "susp_banco")),
                "suspension_levantada_on": as_date(custom(row, "lift")),
                "aprobacion_fha_option_id": option_id(custom(row, "aprob_fha")),
                "aprobacion_fha_on": as_date(custom(row, "aprob_fha_on")),
                "aprobacion_banco_option_id": option_id(custom(row, "aprob_banco")),
                "aprobacion_banco_on": as_date(custom(row, "aprob_banco_on")),
                "aprobacion_tecnica_on": as_date(custom(row, "tecnica_on")),
                "fecha_pcv_on": as_date(custom(row, "fecha_pcv")),
                "envia_pcv_on": as_date(custom(row, "envia_pcv")),
                "revision_pcv_on": as_date(custom(row, "revision_pcv")),
                "fecha_promesa_on": as_date(custom(row, "fecha_promesa")),
                "fecha_legalizacion_on": as_date(custom(row, "legalizacion")),
                "recepcion_legalizacion_on": as_date(custom(row, "recepcion_legalizacion")),
                "recepcion_compraventa_on": as_date(custom(row, "recepcion_compraventa")),
            }
        )

    activities: list[dict[str, object]] = []
    for row in stream_jsonl("activities.jsonl"):
        if truthy_deleted(row.get("is_deleted")):
            continue
        deal_key = row.get("deal_id")
        try:
            deal_pipedrive = int(deal_key)
        except (TypeError, ValueError):
            continue
        deal_uuid = deal_ids.get(deal_pipedrive)
        if not deal_uuid:
            continue
        activity_type = text_or_none(row.get("type"), 80)
        if not activity_type:
            continue
        activities.append(
            {
                "id": uuid7(),
                "pipedrive_activity_id": int(row["id"]),
                "deal_id": deal_uuid,
                "type": activity_type,
                "subject": text_or_none(row.get("subject"), 300),
                "due_on": as_date(row.get("due_date")),
                "done": True if row.get("done") is True else False if row.get("done") is False else None,
                "marked_as_done_time": as_timestamptz(row.get("marked_as_done_time")),
                "note": text_or_none(row.get("note"), 2000),
                "add_time": as_timestamptz(row.get("add_time")),
            }
        )

    files: list[dict[str, object]] = []
    for row in stream_jsonl("files_metadata.jsonl"):
        if row.get("active_flag") is False:
            continue
        deal_key = row.get("deal_id")
        try:
            deal_pipedrive = int(deal_key)
        except (TypeError, ValueError):
            continue
        deal_uuid = deal_ids.get(deal_pipedrive)
        if not deal_uuid:
            continue
        files.append(
            {
                "id": uuid7(),
                "pipedrive_file_id": int(row["id"]),
                "deal_id": deal_uuid,
                "name": text_or_none(row.get("name"), 500),
                "file_type": text_or_none(row.get("file_type"), 40),
                "add_time": as_timestamptz(row.get("add_time")),
                "active": True,
            }
        )

    notes: list[dict[str, object]] = []
    for row in stream_jsonl("notes.jsonl"):
        if row.get("active_flag") is False:
            continue
        content = row.get("content")
        if not isinstance(content, str) or not SCANNER.search(content):
            continue
        deal_key = row.get("deal_id")
        try:
            deal_pipedrive = int(deal_key)
        except (TypeError, ValueError):
            continue
        deal_uuid = deal_ids.get(deal_pipedrive)
        if not deal_uuid:
            continue
        notes.append(
            {
                "id": uuid7(),
                "pipedrive_note_id": int(row["id"]),
                "deal_id": deal_uuid,
                "content": content[:8000],
                "add_time": as_timestamptz(row.get("add_time")),
            }
        )

    print(
        f"deals {len(deals)} (deleted skipped {skipped_deleted}, other status {skipped_status})",
        flush=True,
    )
    print(f"activities {len(activities)}, files {len(files)}, scanner notes {len(notes)}", flush=True)
    if "--check" in sys.argv:
        print("check only, nothing written", flush=True)
        sys.exit(0)
    print("clearing staging", flush=True)
    api.delete_filtered("load_fact_note", "pipedrive_note_id=gt.0")
    api.delete_filtered("load_fact_file", "pipedrive_file_id=gt.0")
    api.delete_filtered("load_fact_activity", "pipedrive_activity_id=gt.0")
    api.delete_filtered("load_fact_deal", "pipedrive_deal_id=gt.0")
    print("staging", flush=True)
    api.insert("load_fact_deal", deals)
    api.insert("load_fact_activity", activities)
    api.insert("load_fact_file", files)
    api.insert("load_fact_note", notes)
    staged = (
        ("load_fact_deal", len(deals)),
        ("load_fact_activity", len(activities)),
        ("load_fact_file", len(files)),
        ("load_fact_note", len(notes)),
    )
    for table, want in staged:
        _, headers, _ = api.request(
            "GET",
            f"/{table}?select=id",
            range_header="0-0",
            prefer="count=exact",
        )
        got = content_range_total(headers, table)
        if got != want:
            raise RuntimeError(f"{table} staged {got}, expected {want}")
    print("swapping", flush=True)
    swapped = api.swap_load()
    print(json.dumps(swapped, ensure_ascii=False), flush=True)
    live = (
        ("fact_deal", len(deals)),
        ("fact_activity", len(activities)),
        ("fact_file", len(files)),
        ("fact_note", len(notes)),
    )
    for key, want in live:
        got = swapped.get(key)
        if got != want:
            raise RuntimeError(f"{key} swapped {got}, expected {want}")

    open_rows = api.fetch_all(
        "v_open_stage",
        "project_name,stage_name,open_n,lost_n,won_n",
        order="project_sort.asc,stage_order.asc",
    )
    print("open queue (stages with a deal only):")
    for row in open_rows:
        open_n = int(row["open_n"] or 0)
        lost_n = int(row["lost_n"] or 0)
        won_n = int(row["won_n"] or 0)
        if open_n or lost_n or won_n:
            print(f"  {row['project_name']} | {row['stage_name']}: open {open_n}, lost {lost_n}, won {won_n}")
    print("done", datetime.now(GUATEMALA).isoformat(timespec="minutes"))


if __name__ == "__main__":
    main()
