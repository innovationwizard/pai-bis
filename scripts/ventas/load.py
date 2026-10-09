"""Load the Ventas store from the latest Pipedrive and Odoo 15 extracts.

Run from the repo root:

    python3 scripts/ventas/load.py

Writes with the service role. Does not drop reservation, créditos, entregas,
or the old sales-feed tables. Does not load Torre Cobán. Does not load
inventory workbook rows. Does not seed discount types or case types.

When a deal has several envio_de_documentacion activities, the earliest
marked_as_done_time is the clock. The documents do not choose among them.
The two issuance recordings are not averaged.
"""

from __future__ import annotations

import csv
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
from decimal import Decimal
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(__file__))
from partner_parse import canonical_unit, parse_partner_name, self_check

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PIPEDRIVE = (
    "/Users/orion-tech/go/singularity/_ Agents_Extract_PipeDrive/"
    "repo-orion-odoo19-etl-pipedrive/output/resolved"
)
ODOO_RAW = "/Users/orion-tech/go/singularity/_ Agents_Extract_Odoo15/output/raw"
ODOO_MESSAGES = (
    "/Users/orion-tech/go/singularity/orion_pa+p_extraccion_odoo15/"
    "output/messages/account.move.jsonl"
)
GUATEMALA = ZoneInfo("America/Guatemala")
SKIP_PIPELINES = {"Torre Coban", "Torre Cobán", "Créditos TCA"}
BUILDING_PIPELINES = {
    "Benestare": "Benestare",
    "Créditos Benestare": "Benestare",
    "Bosque Las Tapias": "Bosque Las Tapias",
    "Créditos BLT": "Bosque Las Tapias",
    "Boulevard5": "Boulevard 5",
    "Créditos BLV5": "Boulevard 5",
    "Santa Elena": "Santa Elena",
    "Créditos Santa Elena": "Santa Elena",
    "Casa Elisa": "Casa Elisa",
    "Créditos Casa Elisa": "Casa Elisa",
}
NOT_BUILDINGS = {
    "Marketing & Sales PAI",
    "Eventos",
    "Eventos BLT",
    "Eventos Benestare",
    "Eventos BLV5",
}
SINGLE_TOWER = {"Boulevard 5", "Casa Elisa"}
RECEPTION_SUBJECT = "Recepción de Promesa Firmada"
BATCH = 80


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


def guatemala_day(stamp: str) -> str:
    moment = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=ZoneInfo("UTC"))
    return moment.astimezone(GUATEMALA).date().isoformat()


def as_timestamptz(value: object) -> str | None:
    if value is None or value is False:
        return None
    text = str(value).strip()
    if text == "" or text.lower() == "false":
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


def money(value: object, currency: str | None = None) -> str | None:
    if value is None or value is False:
        return None
    text = str(value).strip()
    if text == "" or text.lower() == "false":
        return None
    code = (currency or "").strip().upper()
    if code not in ("", "GTQ"):
        return None
    cleaned = text.replace(",", "")
    try:
        amount = Decimal(cleaned)
    except Exception:
        match = re.search(r"Q\s*([0-9]+(?:\.[0-9]+)?)", cleaned)
        if not match:
            return None
        amount = Decimal(match.group(1))
    return format(amount.quantize(Decimal("0.01")), "f")


def parse_label(value: str | None) -> str | None:
    text = (value or "").strip()
    if text == "":
        return None
    if text.startswith("["):
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return text
        if isinstance(parsed, list):
            parts = [str(item).strip() for item in parsed if str(item).strip()]
            return ", ".join(parts) or None
    return text


def text_or_none(value: object) -> str | None:
    if value is None or value is False:
        return None
    text = str(value).strip()
    if text == "" or text.lower() == "false":
        return None
    return text


def deal_tower(project_name: str, raw: str | None) -> str | None:
    if project_name == "Santa Elena":
        return None
    if project_name in SINGLE_TOWER:
        return "Principal"
    text = (raw or "").strip()
    if text == "":
        return None
    match = re.fullmatch(r"Torre\s+([A-E])", text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    if re.fullmatch(r"[A-E]", text, re.IGNORECASE):
        return text.upper()
    return None


def empty_message(body: object) -> bool:
    if body in (False, None, ""):
        return True
    plain = re.sub(r"<[^>]+>", " ", str(body)).replace("&nbsp;", " ")
    return plain.strip() == ""


def many2one_id(value: object) -> int | None:
    if isinstance(value, list) and value:
        return int(value[0])
    if isinstance(value, int):
        return value
    return None


def many2one_name(value: object) -> str | None:
    if isinstance(value, list) and len(value) > 1:
        return text_or_none(value[1])
    return None


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
            "Content-Profile": "ventas",
            "Accept-Profile": "ventas",
            "Prefer": prefer or "return=minimal",
        }
        if range_header:
            headers["Range"] = range_header
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            self.base + path, data=data, headers=headers, method=method
        )
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
                raise RuntimeError(
                    f"{method} {path} failed ({error.code}): {detail[:800]}"
                ) from error
        raise RuntimeError(f"{method} {path} failed after retries")

    def fetch_all(self, table: str, select: str) -> list[dict[str, object]]:
        rows: list[dict[str, object]] = []
        start = 0
        size = 1000
        quoted = urllib.parse.quote(select, safe=",")
        while True:
            status, _, body = self.request(
                "GET",
                f"/{table}?select={quoted}&order=id.asc",
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

    def upsert(self, table: str, rows: list[dict[str, object]], on_conflict: str) -> None:
        if not rows:
            return
        conflict = urllib.parse.quote(on_conflict, safe=",")
        for offset in range(0, len(rows), BATCH):
            chunk = rows[offset : offset + BATCH]
            self.request(
                "POST",
                f"/{table}?on_conflict={conflict}",
                chunk,
                prefer="resolution=merge-duplicates,return=minimal",
            )
            done = min(offset + BATCH, len(rows))
            if done == len(rows) or done % (BATCH * 10) == 0:
                print(f"  {table}: {done}/{len(rows)}", flush=True)

    def count(self, table: str, filt: str = "") -> int:
        _, headers, _ = self.request(
            "GET",
            f"/{table}?select=id{filt}",
            range_header="0-0",
            prefer="count=exact",
        )
        content = headers.get("Content-Range") or headers.get("content-range") or ""
        if "/" not in content:
            return 0
        total = content.rsplit("/", 1)[1]
        return 0 if total == "*" else int(total)


def pipeline_project(name: str) -> str | None:
    if name in BUILDING_PIPELINES:
        return BUILDING_PIPELINES[name]
    return None


def main() -> None:
    self_check()
    env = load_env()
    base_url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    api = Api(base_url, service_key)

    projects = {str(row["name"]): str(row["id"]) for row in api.fetch_all("dim_project", "id,name")}
    expected = {"Sin dato", "Benestare", "Bosque Las Tapias", "Boulevard 5", "Santa Elena", "Casa Elisa"}
    if set(projects) != expected:
        raise RuntimeError(f"dim_project is {sorted(projects)}")
    sin_project = projects["Sin dato"]

    pipelines: dict[str, dict[str, object]] = {
        str(row["name"]): row for row in api.fetch_all("dim_source_pipeline", "id,name,project_id")
    }
    towers = {
        (str(row["project_id"]), str(row["name"])): str(row["id"])
        for row in api.fetch_all("dim_tower", "id,project_id,name")
    }
    models = {
        (str(row["project_id"]), str(row["name"])): str(row["id"])
        for row in api.fetch_all("dim_model", "id,project_id,name")
    }
    habitaciones = {str(row["name"]): str(row["id"]) for row in api.fetch_all("dim_habitaciones", "id,name")}
    asesores = {
        str(row["source_user_id"]): str(row["id"])
        for row in api.fetch_all("dim_asesor", "id,source_user_id")
    }
    fuentes = {str(row["name"]): str(row["id"]) for row in api.fetch_all("dim_fuente", "id,name")}
    promotions = {str(row["name"]): str(row["id"]) for row in api.fetch_all("dim_promotion_type", "id,name")}
    reasons = {str(row["name"]): str(row["id"]) for row in api.fetch_all("dim_lost_reason", "id,name")}
    existing_deals = {
        str(row["pipedrive_deal_id"]): str(row["id"])
        for row in api.fetch_all("dim_deal", "id,pipedrive_deal_id")
    }
    existing_units = {
        (
            str(row["project_id"]),
            str(row["tower_id"]),
            str(row["canonical_unit"]),
            str(row["model_id"]),
        ): str(row["id"])
        for row in api.fetch_all("dim_unit", "id,project_id,tower_id,canonical_unit,model_id")
    }
    sin_tower = towers[(sin_project, "Sin dato")]
    sin_model = models[(sin_project, "Sin dato")]
    sin_habitaciones = habitaciones["Sin dato"]
    sin_asesor = asesores["sin_dato"]
    sin_fuente = fuentes["Sin dato"]
    sin_promotion = promotions["Sin dato"]
    sin_reason = reasons["Sin dato"]

    new_pipelines: list[dict[str, object]] = []

    def ensure_pipeline(name: str) -> str | None:
        if name in SKIP_PIPELINES or "cobán" in name.casefold() or "coban" in name.casefold():
            return None
        existing = pipelines.get(name)
        if existing:
            return str(existing["id"])
        project_name = pipeline_project(name)
        project_id = projects[project_name] if project_name else None
        if project_name is None and name not in NOT_BUILDINGS:
            print(f"pipeline {name} is not a building; its deals take Sin dato")
        row_id = uuid7()
        new_pipelines.append(
            {"id": row_id, "name": name, "project_id": project_id, "is_sin_dato": False}
        )
        pipelines[name] = {"id": row_id, "name": name, "project_id": project_id}
        return row_id

    pipeline_by_source: dict[str, str] = {}
    with open(os.path.join(PIPEDRIVE, "pipelines.csv"), newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            pipeline_id = ensure_pipeline(row["name"])
            if pipeline_id:
                pipeline_by_source[row["id"]] = row["name"]
            else:
                pipeline_by_source[row["id"]] = row["name"]

    if new_pipelines:
        print(f"pipelines to add: {len(new_pipelines)}", flush=True)
        api.upsert("dim_source_pipeline", new_pipelines, "name")

    users: dict[str, str] = {}
    with open(os.path.join(PIPEDRIVE, "users.csv"), newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            users[row["id"]] = (row.get("name") or "").strip() or row["id"]

    new_asesores: list[dict[str, object]] = []
    new_fuentes: list[dict[str, object]] = []
    new_promotions: list[dict[str, object]] = []
    new_reasons: list[dict[str, object]] = []
    new_towers: list[dict[str, object]] = []
    new_models: list[dict[str, object]] = []

    def ensure_asesor(source_id: str) -> str:
        found = asesores.get(source_id)
        if found:
            return found
        row_id = uuid7()
        asesores[source_id] = row_id
        new_asesores.append(
            {
                "id": row_id,
                "source_user_id": source_id,
                "name": users.get(source_id, source_id),
                "is_sin_dato": False,
            }
        )
        return row_id

    def ensure_label(
        cache: dict[str, str],
        pending: list[dict[str, object]],
        name: str | None,
        sin_id: str,
    ) -> str:
        if not name or name == "Sin dato":
            return sin_id
        found = cache.get(name)
        if found:
            return found
        row_id = uuid7()
        cache[name] = row_id
        pending.append({"id": row_id, "name": name, "is_sin_dato": False})
        return row_id

    def ensure_tower(project_id: str, name: str | None) -> str:
        if not name:
            return sin_tower
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
        if not name or name == "Sin dato":
            return sin_model
        key = (project_id, name)
        found = models.get(key)
        if found:
            return found
        row_id = uuid7()
        models[key] = row_id
        new_models.append(
            {"id": row_id, "project_id": project_id, "name": name, "is_sin_dato": False}
        )
        return row_id

    print("reading deals", flush=True)
    skipped_coban = 0
    usd_values = 0
    habitacion_conflicts = 0
    deal_rows: list[dict[str, object]] = []
    deal_ids: dict[str, str] = dict(existing_deals)
    unit_habitaciones: dict[tuple[str, str, str, str], str] = {}
    units_full: dict[tuple[str, str, str, str], str] = {}
    units_no_model: dict[tuple[str, str, str], list[str]] = {}
    units_santa: dict[tuple[str, str], list[str]] = {}
    deal_unit: dict[str, str | None] = {}

    def remember_unit(project_id: str, tower_id: str, token: str, model_id: str, unit_id: str) -> None:
        units_full[(project_id, tower_id, token, model_id)] = unit_id
        units_no_model.setdefault((project_id, tower_id, token), [])
        if unit_id not in units_no_model[(project_id, tower_id, token)]:
            units_no_model[(project_id, tower_id, token)].append(unit_id)
        if project_id == projects["Santa Elena"]:
            units_santa.setdefault((project_id, token), [])
            if unit_id not in units_santa[(project_id, token)]:
                units_santa[(project_id, token)].append(unit_id)

    for key, unit_id in existing_units.items():
        remember_unit(key[0], key[1], key[2], key[3], unit_id)

    with open(os.path.join(PIPEDRIVE, "deals.csv"), newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            pipeline_name = pipeline_by_source.get(row["pipeline_id"], "")
            if pipeline_name in SKIP_PIPELINES or "coban" in pipeline_name.casefold() or "cobán" in pipeline_name.casefold():
                skipped_coban += 1
                continue
            pipeline_id = pipelines[pipeline_name]["id"]
            project_name = pipeline_project(pipeline_name)
            project_id = projects[project_name] if project_name else sin_project
            bedrooms = (row.get("Tipo de Apartamento") or "").strip()
            if bedrooms == "":
                habitaciones_id = sin_habitaciones
            elif bedrooms in habitaciones:
                habitaciones_id = habitaciones[bedrooms]
            else:
                raise RuntimeError(f"Tipo de Apartamento {bedrooms!r} is not 1H, 2H, 3H, or blank")
            token = canonical_unit(text_or_none(row.get("# Apartamento")))
            tower_name = deal_tower(project_name or "Sin dato", text_or_none(row.get("Torre Apartamento")))
            model_name = text_or_none(row.get("Modelo"))
            tower_id = ensure_tower(project_id, tower_name) if project_name != "Santa Elena" else sin_tower
            if project_name == "Santa Elena":
                tower_id = sin_tower
            model_id = ensure_model(project_id, model_name)
            unit_id: str | None = None
            if token:
                identity = (project_id, tower_id, token, model_id)
                unit_id = units_full.get(identity) or existing_units.get(identity)
                if unit_id is None:
                    unit_id = uuid7()
                    units_full[identity] = unit_id
                    remember_unit(project_id, tower_id, token, model_id, unit_id)
                    unit_habitaciones[identity] = habitaciones_id
                else:
                    previous = unit_habitaciones.get(identity)
                    if previous and previous != habitaciones_id and previous != sin_habitaciones and habitaciones_id != sin_habitaciones:
                        unit_habitaciones[identity] = sin_habitaciones
                        habitacion_conflicts += 1
                    elif previous in (None, sin_habitaciones) and habitaciones_id != sin_habitaciones:
                        unit_habitaciones[identity] = habitaciones_id
            pd_id = row["id"]
            deal_id = deal_ids.get(pd_id) or uuid7()
            deal_ids[pd_id] = deal_id
            deal_unit[pd_id] = unit_id
            value_currency = (row.get("currency") or "").strip().upper()
            if value_currency not in ("", "GTQ"):
                usd_values += 1
            deal_rows.append(
                {
                    "id": deal_id,
                    "pipedrive_deal_id": pd_id,
                    "project_id": project_id,
                    "pipeline_id": str(pipeline_id),
                    "asesor_id": ensure_asesor(row["owner_id"]),
                    "fuente_id": ensure_label(fuentes, new_fuentes, parse_label(row.get("Fuente")), sin_fuente),
                    "habitaciones_id": habitaciones_id,
                    "unit_id": unit_id,
                    "promotion_type_id": ensure_label(
                        promotions, new_promotions, parse_label(row.get("Tipo de Promoción")), sin_promotion
                    ),
                    "lost_reason_id": ensure_label(
                        reasons, new_reasons, text_or_none(row.get("lost_reason")), sin_reason
                    ),
                    "add_time": as_timestamptz(row["add_time"]),
                    "value_gtq": None if value_currency not in ("", "GTQ") else money(row.get("value")),
                    "valor_del_bien_gtq": money(row.get("Valor del Bien"), row.get("Valor del Bien__currency")),
                    "valor_promocion_gtq": money(row.get("Valor Promoción")),
                    "valor_vale_gtq": money(row.get("Valor Vale"), row.get("Valor Vale__currency")),
                    "envia_pcv_on": as_date(row.get("Envía PCV - Asesor")),
                    "lost_time": as_timestamptz(row.get("lost_time")),
                    "pipedrive_status": row["status"],
                    "_fuente_name": parse_label(row.get("Fuente")),
                }
            )

    print(
        f"deals {len(deal_rows)} skipped_coban {skipped_coban} usd_values {usd_values} "
        f"habitacion_conflicts {habitacion_conflicts}",
        flush=True,
    )

    unit_rows: list[dict[str, object]] = []
    for identity, unit_id in units_full.items():
        if identity in existing_units:
            continue
        project_id, tower_id, token, model_id = identity
        unit_rows.append(
            {
                "id": unit_id,
                "project_id": project_id,
                "tower_id": tower_id,
                "model_id": model_id,
                "habitaciones_id": unit_habitaciones.get(identity, sin_habitaciones),
                "canonical_unit": token,
                "unit_token_2": None,
            }
        )

    print("writing dimensions", flush=True)
    api.upsert("dim_asesor", new_asesores, "source_user_id")
    api.upsert("dim_fuente", new_fuentes, "name")
    api.upsert("dim_promotion_type", new_promotions, "name")
    api.upsert("dim_lost_reason", new_reasons, "name")
    api.upsert("dim_tower", new_towers, "project_id,name")
    api.upsert("dim_model", new_models, "project_id,name")
    print(f"units {len(unit_rows)}", flush=True)
    api.upsert("dim_unit", unit_rows, "project_id,tower_id,canonical_unit,unit_token_2,model_id")
    print(f"deals {len(deal_rows)}", flush=True)
    api.upsert(
        "dim_deal",
        [{key: value for key, value in row.items() if key != "_fuente_name"} for row in deal_rows],
        "pipedrive_deal_id",
    )

    fuente_by_deal = {str(row["pipedrive_deal_id"]): str(row["fuente_id"]) for row in deal_rows}
    envia_by_deal = {str(row["pipedrive_deal_id"]): row["envia_pcv_on"] for row in deal_rows}
    loaded_deal_ids = set(deal_ids)

    print("reading activities", flush=True)
    comprobantes: list[dict[str, object]] = []
    receptions: list[dict[str, object]] = []
    visits: list[dict[str, object]] = []
    pcv_activity: dict[str, tuple[str, str]] = {}
    comprobante_days: dict[str, set[str]] = {}
    skipped_activity_deals = 0
    with open(os.path.join(PIPEDRIVE, "activities.csv"), newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row.get("is_deleted") == "true":
                continue
            activity_type = row.get("type") or ""
            if activity_type not in {"reserva", "envio_de_documentacion", "promesa_firmada", "visita_efectiva"}:
                continue
            if row.get("done") != "true":
                continue
            stamp = as_timestamptz(row.get("marked_as_done_time"))
            source_deal = (row.get("deal_id") or "").strip()
            if source_deal and source_deal not in loaded_deal_ids:
                skipped_activity_deals += 1
                continue
            deal_uuid = deal_ids.get(source_deal) if source_deal else None
            if activity_type == "reserva" and stamp:
                comprobantes.append(
                    {
                        "id": uuid7(),
                        "pipedrive_activity_id": row["id"],
                        "deal_id": deal_uuid,
                        "marked_as_done_time": stamp,
                    }
                )
                if source_deal:
                    comprobante_days.setdefault(source_deal, set()).add(guatemala_day(stamp))
            elif activity_type == "promesa_firmada" and stamp and row.get("subject") == RECEPTION_SUBJECT:
                receptions.append(
                    {
                        "id": uuid7(),
                        "pipedrive_activity_id": row["id"],
                        "deal_id": deal_uuid,
                        "marked_as_done_time": stamp,
                        "subject": RECEPTION_SUBJECT,
                    }
                )
            elif activity_type == "visita_efectiva" and stamp:
                visits.append(
                    {
                        "id": uuid7(),
                        "pipedrive_activity_id": row["id"],
                        "deal_id": deal_uuid,
                        "fuente_id": fuente_by_deal.get(source_deal, sin_fuente) if source_deal else sin_fuente,
                        "marked_as_done_time": stamp,
                    }
                )
            elif activity_type == "envio_de_documentacion" and stamp and source_deal:
                current = pcv_activity.get(source_deal)
                activity_key = (stamp, int(row["id"]))
                if current is None or activity_key < (current[0], int(current[1])):
                    pcv_activity[source_deal] = (stamp, row["id"])

    pcv_rows: list[dict[str, object]] = []
    for pd_id, deal_uuid in deal_ids.items():
        activity = pcv_activity.get(pd_id)
        envia = envia_by_deal.get(pd_id)
        if activity is None and not envia:
            continue
        if activity:
            pcv_rows.append(
                {
                    "id": uuid7(),
                    "deal_id": deal_uuid,
                    "pipedrive_activity_id": activity[1],
                    "activity_marked_as_done_time": activity[0],
                    "envia_pcv_on": envia,
                    "clock_at": activity[0],
                    "clock_is_date_only": False,
                }
            )
        else:
            pcv_rows.append(
                {
                    "id": uuid7(),
                    "deal_id": deal_uuid,
                    "pipedrive_activity_id": None,
                    "activity_marked_as_done_time": None,
                    "envia_pcv_on": envia,
                    "clock_at": None,
                    "clock_is_date_only": True,
                }
            )

    deals_for_unit_day: dict[tuple[str, str], list[str]] = {}
    for pd_id, days in comprobante_days.items():
        unit_id = deal_unit.get(pd_id)
        deal_uuid = deal_ids.get(pd_id)
        if not unit_id or not deal_uuid:
            continue
        for day in days:
            deals_for_unit_day.setdefault((unit_id, day), []).append(deal_uuid)

    print(
        f"comprobantes {len(comprobantes)} receptions {len(receptions)} "
        f"visits {len(visits)} pcv {len(pcv_rows)} skipped_activity_deals {skipped_activity_deals}",
        flush=True,
    )
    api.upsert("fact_comprobante", comprobantes, "pipedrive_activity_id")
    api.upsert("fact_reception", receptions, "pipedrive_activity_id")
    api.upsert("fact_visit", visits, "pipedrive_activity_id")
    api.upsert("fact_pcv_issuance", pcv_rows, "deal_id")

    print("reading Odoo partners, moves, and publication notes", flush=True)
    partner_names: dict[int, str] = {}
    with open(os.path.join(ODOO_RAW, "res.partner.jsonl"), encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            partner_names[int(record["id"])] = str(record.get("name") or "")

    move_ids: set[int] = set()
    payment_records: list[dict[str, object]] = []
    with open(os.path.join(ODOO_RAW, "account.payment.jsonl"), encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            move_id = many2one_id(record.get("move_id"))
            if move_id is not None:
                move_ids.add(move_id)
            payment_records.append(record)
    print(f"payments {len(payment_records)}", flush=True)

    moves: dict[int, dict[str, object]] = {}
    with open(os.path.join(ODOO_RAW, "account.move.jsonl"), encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            move_id = int(record["id"])
            if move_id in move_ids:
                moves[move_id] = record

    published: dict[int, tuple[str, int]] = {}
    with open(ODOO_MESSAGES, encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            if record.get("model") != "account.move":
                continue
            move_id = record.get("res_id")
            if not isinstance(move_id, int) or move_id not in move_ids:
                continue
            if not empty_message(record.get("body")):
                continue
            stamp = as_timestamptz(record.get("date"))
            if not stamp:
                continue
            current = published.get(move_id)
            message_id = int(record["id"])
            if current is None or (stamp, message_id) < current:
                published[move_id] = (stamp, message_id)

    print("matching recibos", flush=True)
    partner_rows: dict[str, dict[str, object]] = {}
    payment_rows: list[dict[str, object]] = []
    matched = 0
    unresolved = 0
    non_gtq = 0

    def tower_for_parse(project_name: str | None, tower_name: str | None) -> str | None:
        if not project_name or not tower_name:
            return None
        if project_name == "Santa Elena":
            return None
        return towers.get((projects[project_name], tower_name))

    def model_for_parse(project_name: str | None, model_name: str | None) -> str | None:
        if not project_name or not model_name:
            return None
        return models.get((projects[project_name], model_name))

    for record in payment_records:
        partner_odoo = many2one_id(record.get("partner_id"))
        raw_name = partner_names.get(partner_odoo, "") if partner_odoo is not None else ""
        if not raw_name:
            raw_name = many2one_name(record.get("partner_id")) or ""
        parsed = parse_partner_name(raw_name)
        project_id = projects.get(parsed.project_name) if parsed.project_name else None
        tower_id = tower_for_parse(parsed.project_name, parsed.tower_name)
        model_id = model_for_parse(parsed.project_name, parsed.model_name)
        move_id = many2one_id(record.get("move_id"))
        move = moves.get(move_id) if move_id is not None else None
        fecha = as_date(move.get("date")) if move else None
        currency_name = ""
        currency = record.get("currency_id")
        if isinstance(currency, list) and len(currency) > 1:
            currency_name = str(currency[1]).upper()
        amount = money(record.get("amount"), currency_name or "GTQ")
        if currency_name and currency_name != "GTQ":
            non_gtq += 1
            amount = None
        publication = published.get(move_id) if move_id is not None else None
        matched_deal: str | None = None
        matched_unit: str | None = None
        is_unresolved = False
        if fecha and parsed.canonical_unit and project_id:
            if parsed.project_name == "Santa Elena":
                found_units = units_santa.get((project_id, parsed.canonical_unit), [])
            elif parsed.model_name:
                one = (
                    units_full.get((project_id, tower_id, parsed.canonical_unit, model_id))
                    if model_id and tower_id
                    else None
                )
                found_units = [one] if one else []
            elif tower_id:
                found_units = units_no_model.get((project_id, tower_id, parsed.canonical_unit), [])
            else:
                found_units = []
            if len(found_units) > 1:
                is_unresolved = True
            elif len(found_units) == 1:
                candidates = deals_for_unit_day.get((found_units[0], fecha), [])
                unique = list(dict.fromkeys(candidates))
                if len(unique) > 1:
                    is_unresolved = True
                elif len(unique) == 1:
                    matched_deal = unique[0]
                    matched_unit = found_units[0]
        if is_unresolved:
            unresolved += 1
            matched_deal = None
            matched_unit = None
        elif matched_deal:
            matched += 1
        partner_uuid = None
        if partner_odoo is not None:
            key = str(partner_odoo)
            if key not in partner_rows:
                partner_uuid = uuid7()
                partner_rows[key] = {
                    "id": partner_uuid,
                    "odoo_partner_id": key,
                    "name_raw": raw_name or key,
                    "project_id": project_id,
                    "tower_id": tower_id,
                    "model_id": model_id,
                    "canonical_unit": parsed.canonical_unit,
                    "buyer_name": parsed.buyer_name,
                    "desistimiento_prefix": parsed.desistimiento_prefix,
                    "cd_prefix": parsed.cd_prefix,
                    "unproven_token": parsed.unproven_token,
                }
            partner_uuid = str(partner_rows[key]["id"])
        state = text_or_none(move.get("state")) if move else None
        payment_rows.append(
            {
                "id": uuid7(),
                "odoo_payment_id": str(record["id"]),
                "odoo_move_id": str(move_id) if move_id is not None else None,
                "partner_id": partner_uuid,
                "move_state": state.lower() if state else None,
                "payment_type": record.get("payment_type"),
                "anulado": bool(record.get("anulado")),
                "fecha": fecha,
                "created_at": as_timestamptz(record.get("create_date")),
                "written_at": as_timestamptz(record.get("write_date")),
                "published_at": publication[0] if publication else None,
                "amount_gtq": amount,
                "partner_name_raw": raw_name or None,
                "printed_name": text_or_none(record.get("nombre_impreso")),
                "buyer_name": parsed.buyer_name,
                "desistimiento_prefix": parsed.desistimiento_prefix,
                "project_id": project_id,
                "tower_id": tower_id,
                "model_id": model_id,
                "canonical_unit": parsed.canonical_unit,
                "matched_deal_id": matched_deal,
                "matched_unit_id": matched_unit,
                "match_unresolved": is_unresolved,
            }
        )

    print(
        f"partners {len(partner_rows)} payments {len(payment_rows)} "
        f"matched {matched} unresolved {unresolved} non_gtq {non_gtq}",
        flush=True,
    )
    api.upsert("odoo_partner", list(partner_rows.values()), "odoo_partner_id")
    api.upsert("fact_recibo", payment_rows, "odoo_payment_id")

    print("counts", flush=True)
    for table in (
        "dim_deal",
        "dim_unit",
        "fact_comprobante",
        "fact_pcv_issuance",
        "fact_reception",
        "fact_visit",
        "fact_recibo",
        "fact_inventory_observation",
        "fact_discount",
        "fact_case_mark",
        "fact_price_rise",
        "fact_target",
    ):
        print(f"  {table}: {api.count(table)}", flush=True)
    print(f"  match_unresolved: {api.count('fact_recibo', '&match_unresolved=eq.true')}", flush=True)
    _, sale_headers, _ = api.request(
        "GET",
        "/v_sale?select=deal_id",
        range_header="0-0",
        prefer="count=exact",
    )
    sale_range = sale_headers.get("Content-Range") or sale_headers.get("content-range") or "0"
    print(f"  v_sale: {sale_range.rsplit('/', 1)[-1]}", flush=True)


if __name__ == "__main__":
    main()
