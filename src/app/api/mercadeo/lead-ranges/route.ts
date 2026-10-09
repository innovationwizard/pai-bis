import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, type Role } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const READERS: Role[] = ["master", "torredecontrol", "gerencia", "ventas", "marketing"];
const SLUGS = ["benestare", "bosque-las-tapias", "boulevard-5", "casa-elisa", "santa-elena", "puerta-abierta"] as const;

const bodySchema = z.object({
  ranges: z.array(z.object({
    slug: z.enum(SLUGS),
    min: z.number().int().nonnegative().nullable(),
    max: z.number().int().nonnegative().nullable(),
  })).length(SLUGS.length),
});

export async function PATCH(request: Request) {
  const auth = await requireRole(READERS);
  if (auth.response) return auth.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "El rango mensual necesita un piso y un techo, o ninguno." }, { status: 400 });
  }
  const seen = new Set(parsed.data.ranges.map((range) => range.slug));
  if (seen.size !== SLUGS.length) {
    return NextResponse.json({ error: "Falta un centro de costo." }, { status: 400 });
  }
  for (const range of parsed.data.ranges) {
    const empty = range.min == null && range.max == null;
    const pair = range.min != null && range.max != null && range.min <= range.max;
    if (!empty && !pair) {
      return NextResponse.json({ error: "Cada meta lleva piso y techo, y el piso no puede pasar el techo." }, { status: 400 });
    }
  }

  const db = createAdminClient().schema("mercadeo");
  const { data, error } = await db.from("cost_center").select("id,slug");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = new Map((data ?? []).map((row) => [String(row.slug), String(row.id)]));
  for (const range of parsed.data.ranges) {
    const id = ids.get(range.slug);
    if (!id) return NextResponse.json({ error: "Falta un centro de costo en la base." }, { status: 500 });
    const update = await db.from("lead_range").update({
      min_leads: range.min,
      max_leads: range.max,
      updated_at: new Date().toISOString(),
    }).eq("cost_center_id", id);
    if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
