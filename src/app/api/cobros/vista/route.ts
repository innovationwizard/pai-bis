import { NextResponse } from "next/server";
import { requireRole, type Role } from "@/lib/auth";
import { buildCobrosVista, parseCobrosFilters } from "@/lib/cobros/vista";
import { isCobrosSection } from "@/lib/cobros/types";

export const dynamic = "force-dynamic";

const READERS: Role[] = ["master", "torredecontrol", "gerencia", "financiero", "contabilidad"];

export async function GET(request: Request) {
  const auth = await requireRole(READERS);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "";
  if (!isCobrosSection(section)) {
    return NextResponse.json({ error: "Esa vista no existe." }, { status: 404 });
  }
  try {
    const vista = await buildCobrosVista(section, parseCobrosFilters(url));
    return NextResponse.json(vista);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer Cobros";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
