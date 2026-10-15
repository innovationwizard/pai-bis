import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, type Role } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearTargetCache } from "@/lib/mercadeo/operativo";
import { generateId } from "@/lib/uuid";

export const dynamic = "force-dynamic";

const READERS: Role[] = ["master", "torredecontrol", "gerencia", "ventas", "marketing"];
const SLUGS = ["benestare", "bosque-las-tapias", "boulevard-5", "casa-elisa", "santa-elena", "puerta-abierta"] as const;

const bodySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/),
  entries: z.array(z.object({
    slug: z.enum(SLUGS),
    amountGtq: z.number().nonnegative().finite(),
  })).min(1).max(SLUGS.length),
});

export async function POST(request: Request) {
  const auth = await requireRole(READERS);
  if (auth.response) return auth.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "El presupuesto necesita un mes y un monto en quetzales por centro." }, { status: 400 });
  }
  const slugs = parsed.data.entries.map((entry) => entry.slug);
  if (new Set(slugs).size !== slugs.length) {
    return NextResponse.json({ error: "Cada centro va una sola vez." }, { status: 400 });
  }

  const db = createAdminClient().schema("mercadeo");
  const centers = await db.from("cost_center").select("id,slug");
  if (centers.error) return NextResponse.json({ error: centers.error.message }, { status: 500 });
  const ids = new Map((centers.data ?? []).map((row) => [String(row.slug), String(row.id)]));

  const existing = await db
    .from("pauta_target")
    .select("cost_center_id,amount_gtq,created_at")
    .eq("month_start", parsed.data.month)
    .order("created_at", { ascending: true });
  if (existing.error) {
    const missing = /pauta_target|PGRST204|PGRST205|schema cache|does not exist|42P01/i.test(existing.error.message);
    if (missing) {
      return NextResponse.json(
        { error: "Hay que correr la migración 080 en el editor SQL de Supabase para guardar el presupuesto por mes." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }
  const latest = new Map<string, number>();
  for (const row of existing.data ?? []) {
    latest.set(String(row.cost_center_id), Number(row.amount_gtq));
  }

  const rows = [];
  for (const entry of parsed.data.entries) {
    const id = ids.get(entry.slug);
    if (!id) return NextResponse.json({ error: "Falta un centro de costo en la base." }, { status: 500 });
    const previous = latest.get(id);
    if (previous != null && previous === entry.amountGtq) continue;
    rows.push({
      id: generateId(),
      cost_center_id: id,
      month_start: parsed.data.month,
      amount_gtq: entry.amountGtq,
      created_by: auth.user?.id ?? null,
    });
  }
  if (rows.length === 0) return NextResponse.json({ ok: true, inserted: 0 });
  clearTargetCache();
  const insert = await db.from("pauta_target").insert(rows);
  if (insert.error) return NextResponse.json({ error: insert.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, inserted: rows.length });
}
