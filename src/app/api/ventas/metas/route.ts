import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, type Role } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearVistaCache } from "@/lib/ventas/vista";
import { generateId } from "@/lib/uuid";

export const dynamic = "force-dynamic";

const READERS: Role[] = ["master", "torredecontrol", "gerencia"];

const bodySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/),
  entries: z
    .array(
      z
        .object({
          asesorId: z.string().uuid(),
          projectId: z.string().uuid(),
          units: z.number().int().nonnegative().optional(),
          gtq: z.number().nonnegative().finite().optional(),
        })
        .refine((entry) => entry.units !== undefined || entry.gtq !== undefined),
    )
    .min(1)
    .max(200),
});

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function same(left: number | null, right: number | null): boolean {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return Math.abs(left - right) < 0.001;
}

function missingTable(message: string): boolean {
  return /target_event|PGRST204|PGRST205|schema cache|does not exist|42P01/i.test(message);
}

export async function POST(request: Request) {
  const auth = await requireRole(READERS);
  if (auth.response) return auth.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "La meta necesita un mes, un asesor, un proyecto y una cifra." }, { status: 400 });
  }
  const keys = parsed.data.entries.map((entry) => `${entry.asesorId}|${entry.projectId}`);
  if (new Set(keys).size !== keys.length) {
    return NextResponse.json({ error: "Cada asesor va una sola vez en el proyecto." }, { status: 400 });
  }

  const db = createAdminClient().schema("ventas");
  const probe = await db.from("target_event").select("id").limit(1);
  if (probe.error) {
    if (missingTable(probe.error.message)) {
      return NextResponse.json(
        { error: "Hay que correr la migración 081 en el editor SQL de Supabase para guardar la meta y dejar el historial." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: probe.error.message }, { status: 500 });
  }

  const asesorIds = [...new Set(parsed.data.entries.map((entry) => entry.asesorId))];
  const projectIds = [...new Set(parsed.data.entries.map((entry) => entry.projectId))];
  const [asesores, projects, events, snapshot] = await Promise.all([
    db.from("dim_asesor").select("id,is_sin_dato").in("id", asesorIds),
    db.from("dim_project").select("id,is_sin_dato").in("id", projectIds),
    db
      .from("target_event")
      .select("asesor_id,project_id,target_units,target_gtq,created_at")
      .eq("month_start", parsed.data.month)
      .in("asesor_id", asesorIds)
      .order("created_at", { ascending: true }),
    db
      .from("fact_target")
      .select("id,asesor_id,project_id,target_units,target_gtq")
      .eq("month_start", parsed.data.month)
      .in("asesor_id", asesorIds),
  ]);
  for (const result of [asesores, projects, events, snapshot]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  const asesorOk = new Set((asesores.data ?? []).filter((row) => row.is_sin_dato !== true).map((row) => String(row.id)));
  const projectOk = new Set((projects.data ?? []).filter((row) => row.is_sin_dato !== true).map((row) => String(row.id)));
  if (asesorIds.some((id) => !asesorOk.has(id)) || projectIds.some((id) => !projectOk.has(id))) {
    return NextResponse.json({ error: "Ese asesor o proyecto no está en Ventas." }, { status: 400 });
  }

  const latest = new Map<string, { units: number | null; gtq: number | null }>();
  for (const row of snapshot.data ?? []) {
    latest.set(`${row.asesor_id}|${row.project_id}`, { units: num(row.target_units), gtq: num(row.target_gtq) });
  }
  for (const row of events.data ?? []) {
    latest.set(`${row.asesor_id}|${row.project_id}`, { units: num(row.target_units), gtq: num(row.target_gtq) });
  }

  const rows: {
    id: string;
    asesor_id: string;
    project_id: string;
    month_start: string;
    target_units: number | null;
    target_gtq: number | null;
    created_by: string | null;
  }[] = [];
  for (const entry of parsed.data.entries) {
    const key = `${entry.asesorId}|${entry.projectId}`;
    const previous = latest.get(key) ?? { units: null, gtq: null };
    const units = entry.units !== undefined ? entry.units : previous.units;
    const gtq = entry.gtq !== undefined ? round2(entry.gtq) : previous.gtq;
    if (units == null && gtq == null) continue;
    if (same(units, previous.units) && same(gtq, previous.gtq)) continue;
    rows.push({
      id: generateId(),
      asesor_id: entry.asesorId,
      project_id: entry.projectId,
      month_start: parsed.data.month,
      target_units: units,
      target_gtq: gtq,
      created_by: auth.user?.id ?? null,
    });
  }
  if (rows.length === 0) return NextResponse.json({ ok: true, inserted: 0, snapshot: true });

  const inserted = await db.from("target_event").insert(rows);
  if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 500 });
  clearVistaCache();

  const calendar = await db.from("dim_date").select("id").eq("calendar_day", parsed.data.month).maybeSingle();
  if (calendar.error) return NextResponse.json({ ok: true, inserted: rows.length, snapshot: false, error: calendar.error.message });
  const dateId = calendar.data?.id ? String(calendar.data.id) : null;
  const existing = new Map((snapshot.data ?? []).map((row) => [`${row.asesor_id}|${row.project_id}`, String(row.id)]));
  let snapshotOk = true;
  for (const row of rows) {
    const id = existing.get(`${row.asesor_id}|${row.project_id}`);
    const write = id
      ? await db.from("fact_target").update({ target_units: row.target_units, target_gtq: row.target_gtq }).eq("id", id)
      : dateId
        ? await db.from("fact_target").insert({
            id: generateId(),
            source_natural_key: `ui:${row.asesor_id}:${row.project_id}:${row.month_start}`,
            asesor_id: row.asesor_id,
            project_id: row.project_id,
            month_start: row.month_start,
            date_id: dateId,
            target_units: row.target_units,
            target_gtq: row.target_gtq,
          })
        : { error: { message: "sin calendario" } };
    if (write.error) snapshotOk = false;
  }
  return NextResponse.json({ ok: true, inserted: rows.length, snapshot: snapshotOk });
}
