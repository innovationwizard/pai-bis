import { NextResponse } from "next/server";
import { requireRole, type Role } from "@/lib/auth";
import { parseVistaFilters } from "@/lib/ventas/vista";
import { buildUnitDetalle, isStockSection } from "@/lib/ventas/vista-operativo";

export const dynamic = "force-dynamic";

const READERS: Role[] = ["master", "torredecontrol", "gerencia"];

export async function GET(request: Request) {
  const auth = await requireRole(READERS);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "";
  if (!isStockSection(section) || section === "tasa-de-conversion") {
    return NextResponse.json({ error: "Esa lista no existe." }, { status: 404 });
  }
  try {
    const detalle = await buildUnitDetalle(section, parseVistaFilters(url));
    return NextResponse.json(detalle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer el inventario";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
