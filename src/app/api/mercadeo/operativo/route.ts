import { NextResponse } from "next/server";
import { requireRole, type Role } from "@/lib/auth";
import { buildOperativo, parseOperativoFilters } from "@/lib/mercadeo/operativo";

export const dynamic = "force-dynamic";

const READERS: Role[] = ["master", "torredecontrol", "gerencia", "ventas", "marketing"];

export async function GET(request: Request) {
  const auth = await requireRole(READERS);
  if (auth.response) return auth.response;
  try {
    const report = await buildOperativo(parseOperativoFilters(new URL(request.url)));
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer Mercadeo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
