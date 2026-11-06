import { privateJson } from "@/lib/api";
import { requireRole, type Role } from "@/lib/auth";
import { isGlanceSection } from "@/lib/mercadeo/glance-types";
import { buildVista } from "@/lib/mercadeo/glance";
import { parseOperativoFilters } from "@/lib/mercadeo/operativo";

export const dynamic = "force-dynamic";

const READERS: Role[] = ["master", "torredecontrol", "gerencia", "ventas", "marketing"];

export async function GET(request: Request) {
  const auth = await requireRole(READERS);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "";
  if (!isGlanceSection(section)) {
    return privateJson({ error: "Esa vista no existe." }, 404);
  }
  try {
    const vista = await buildVista(section, parseOperativoFilters(url));
    return privateJson(vista);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer Mercadeo";
    return privateJson({ error: message }, 500);
  }
}
