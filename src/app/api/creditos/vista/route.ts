import { privateJson } from "@/lib/api";
import { requireRole, type Role } from "@/lib/auth";
import { buildCreditosVista, isCreditoSection } from "@/lib/creditos/pipedrive-vista";
import type { PeriodPreset } from "@/lib/ventas/period";

export const dynamic = "force-dynamic";

const READERS: Role[] = ["master", "torredecontrol", "gerencia", "ventas", "marketing", "creditos"];
const PRESETS = new Set<PeriodPreset>(["este-mes", "mes-anterior", "este-trimestre", "este-ano", "custom"]);

export async function GET(request: Request) {
  const auth = await requireRole(READERS);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "";
  if (!isCreditoSection(section)) {
    return privateJson({ error: "Esa vista no existe." }, 404);
  }
  const presetRaw = url.searchParams.get("periodo") ?? "este-mes";
  const preset = PRESETS.has(presetRaw as PeriodPreset) ? (presetRaw as PeriodPreset) : "este-mes";
  const project = url.searchParams.get("proyecto");
  try {
    const vista = await buildCreditosVista(
      section,
      preset,
      url.searchParams.get("desde"),
      url.searchParams.get("hasta"),
      project && project !== "todos" ? project : null,
    );
    return privateJson(vista);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer Créditos";
    return privateJson({ error: message }, 500);
  }
}
