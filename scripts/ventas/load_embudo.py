"""Load ventas.embudo_deal from the Pipedrive extract.

Run from the repo root, after migration 092:

    python3 scripts/ventas/load_embudo.py

Reads stage_id, status, add_time, and pipeline_id. Does not request stage
history. Does not write to Odoo. Does not change dim_deal. Replaces the
embudo rows with the current commercial deals.
"""

from __future__ import annotations

import csv
import os
import sys
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(__file__))
from load import Api, PIPEDRIVE, load_env, uuid7

GUATEMALA = ZoneInfo("America/Guatemala")
BATCH = 400
COMMERCIAL = {
    "Benestare": "benestare",
    "Bosque Las Tapias": "bosque-las-tapias",
    "Boulevard5": "boulevard-5",
    "Santa Elena": "santa-elena",
}


def on_hold(name: str) -> bool:
    folded = name.casefold().replace("á", "a").replace("à", "a")
    return "coban" in folded


def guatemala_day(stamp: str) -> str:
    moment = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=ZoneInfo("UTC"))
    return moment.astimezone(GUATEMALA).date().isoformat()


def as_timestamptz(value: str) -> str:
    text = value.strip()
    if text.endswith("Z") or "+" in text[10:]:
        return text
    return text.replace(" ", "T") + "Z"


def content_count(headers: dict[str, str]) -> int:
    content = headers.get("Content-Range") or headers.get("content-range") or ""
    if "/" not in content:
        raise RuntimeError(f"count missing: {content}")
    total = content.rsplit("/", 1)[1].strip()
    if total == "*":
        raise RuntimeError("count was unknown")
    return int(total)


def main() -> None:
    env = load_env()
    base_url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    api = Api(base_url, service_key)

    pipelines: dict[str, str] = {}
    with open(os.path.join(PIPEDRIVE, "pipelines.csv"), newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if on_hold(row["name"]):
                continue
            slug = COMMERCIAL.get(row["name"])
            if slug:
                pipelines[row["id"]] = slug

    stages: dict[str, tuple[int, str]] = {}
    with open(os.path.join(PIPEDRIVE, "stages.csv"), newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            stages[row["id"]] = (int(row["order_nr"]), row["pipeline_id"])

    users: dict[str, str] = {}
    with open(os.path.join(PIPEDRIVE, "users.csv"), newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            users[row["id"]] = (row.get("name") or "").strip() or row["id"]

    asesores = {
        str(row["source_user_id"]): str(row["id"])
        for row in api.fetch_all("dim_asesor", "id,source_user_id")
    }
    new_asesores: list[dict[str, object]] = []

    def asesor_id(source_id: str) -> str:
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

    load_id = str(uuid.uuid4())
    deals: dict[str, dict[str, object]] = {}
    skipped = 0
    brenda_id = ""
    for source, name in users.items():
        if name == "Brenda Pérez":
            brenda_id = source
            break
    brenda_deals = 0
    brenda_won = 0

    with open(os.path.join(PIPEDRIVE, "deals.csv"), newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            slug = pipelines.get(row["pipeline_id"])
            if not slug:
                continue
            if (row.get("is_deleted") or "").lower() == "true":
                skipped += 1
                continue
            status = row.get("status") or ""
            if status not in ("open", "won", "lost"):
                skipped += 1
                continue
            stage = stages.get(row.get("stage_id") or "")
            if not stage or stage[1] != row["pipeline_id"] or stage[0] < 1 or stage[0] > 8:
                skipped += 1
                continue
            owner = (row.get("owner_id") or "").strip()
            stamp = (row.get("add_time") or "").strip()
            if owner == "" or stamp == "":
                skipped += 1
                continue
            try:
                add_time = as_timestamptz(stamp)
                add_on = guatemala_day(add_time)
            except ValueError:
                skipped += 1
                continue
            deal_id = row["id"].strip()
            if deal_id == "":
                skipped += 1
                continue
            deals[deal_id] = {
                "pipedrive_deal_id": deal_id,
                "pipeline_slug": slug,
                "asesor_id": asesor_id(owner),
                "stage_order": stage[0],
                "status": status,
                "add_time": add_time,
                "add_on": add_on,
                "load_id": load_id,
            }
            if owner == brenda_id and slug == "boulevard-5" and "2026-09-14" <= add_on <= "2026-09-20":
                brenda_deals += 1
                if status == "won":
                    brenda_won += 1

    print(
        f"embudo deals {len(deals)} skipped {skipped} new_asesores {len(new_asesores)} "
        f"brenda_blv5_2026-09-14_20 {brenda_deals} won {brenda_won}",
        flush=True,
    )
    if not deals:
        raise RuntimeError("no commercial deals")

    if new_asesores:
        api.upsert("dim_asesor", new_asesores, "source_user_id")
    rows = list(deals.values())
    for offset in range(0, len(rows), BATCH):
        api.upsert("embudo_deal", rows[offset : offset + BATCH], "pipedrive_deal_id")
        done = min(offset + BATCH, len(rows))
        if done == len(rows) or done % (BATCH * 10) == 0:
            print(f"  embudo_deal: {done}/{len(rows)}", flush=True)

    api.request(
        "DELETE",
        f"/embudo_deal?load_id=neq.{load_id}",
        prefer="return=minimal",
    )

    brenda = asesores.get(brenda_id)
    if not brenda:
        raise RuntimeError("Brenda Pérez has no asesor row after the load")
    _, headers, _ = api.request(
        "GET",
        "/embudo_deal?select=pipedrive_deal_id"
        f"&pipeline_slug=eq.boulevard-5&asesor_id=eq.{brenda}"
        "&add_on=gte.2026-09-14&add_on=lte.2026-09-20",
        range_header="0-0",
        prefer="count=exact",
    )
    stored = content_count(headers)
    _, won_headers, _ = api.request(
        "GET",
        "/embudo_deal?select=pipedrive_deal_id"
        f"&pipeline_slug=eq.boulevard-5&asesor_id=eq.{brenda}"
        "&add_on=gte.2026-09-14&add_on=lte.2026-09-20&status=eq.won",
        range_header="0-0",
        prefer="count=exact",
    )
    stored_won = content_count(won_headers)
    print(f"stored brenda_blv5 {stored} won {stored_won}", flush=True)


if __name__ == "__main__":
    main()
