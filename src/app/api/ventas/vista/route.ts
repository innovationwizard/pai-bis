import { privateJson } from "@/lib/api";
import { requireRole, type Role } from "@/lib/auth";
import { buildVista, parseVistaFilters } from "@/lib/ventas/vista";
import { isVistaSection } from "@/lib/ventas/vista-types";

export const dynamic = "force-dynamic";

const READERS: Role[] = ["master", "torredecontrol", "gerencia"];

export async function GET(request: Request) {
  const auth = await requireRole(READERS);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "";
  if (!isVistaSection(section)) {
    return privateJson({ error: "Esa vista no existe." }, 404);
  }
  try {
    const vista = await buildVista(section, parseVistaFilters(url));
    return privateJson(vista);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer Ventas";
    return privateJson({ error: message }, 500);
  }
}
