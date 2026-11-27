import { z } from "zod";
import { privateJson } from "@/lib/api";
import { hasRole, requireAuth } from "@/lib/auth";
import { compareProjectLabels, isDisplayProject, projectKey } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ACTIVE_SLUGS = new Set(["boulevard-5", "benestare", "bosque-las-tapias", "santa-elena"]);

const DISPLAY_NAME: Record<string, string> = {
  [projectKey("BOULEVARD 5")]: "Boulevard 5",
  [projectKey("BENESTARE")]: "Benestare",
  [projectKey("BOSQUE LAS TAPIAS")]: "Bosque Las Tapias",
  [projectKey("SANTA ELENA")]: "Santa Elena",
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const bodySchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.string().uuid(),
        initialDate: dateSchema,
        finalDate: dateSchema,
      }),
    )
    .max(100),
});

type ProjectRecord = {
  id: string;
  name: string | null;
  slug: string | null;
};

type TowerRecord = {
  id: string;
  project_id: string;
  name: string | null;
  initial_date: string | null;
  final_date: string | null;
};

type TowerRow = {
  id: string;
  projectName: string;
  towerName: string;
  initialDate: string | null;
  finalDate: string | null;
};

function projectLabel(name: string): string {
  const trimmed = name.trim();
  return DISPLAY_NAME[projectKey(trimmed)] ?? trimmed;
}

function activeProject(name: string, slug: string): boolean {
  return isDisplayProject(name) || ACTIVE_SLUGS.has(slug);
}

function dateOnly(value: unknown): string | null {
  if (value == null || value === "") return null;
  const day = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function realDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function missingColumn(message: string): boolean {
  return /initial_date|final_date|PGRST204|schema cache|does not exist|42703/i.test(message);
}

async function requireEditors() {
  const auth = await requireAuth();
  if (auth.response) return auth;
  if (!hasRole(auth.user ?? null, ["master", "torredecontrol"])) {
    return { response: privateJson({ error: "No autorizado" }, 403) };
  }
  return auth;
}

async function loadRows(): Promise<{ rows: TowerRow[] } | { error: string; status: number }> {
  const admin = createAdminClient();
  const [projects, towers] = await Promise.all([
    admin.from("projects").select("id, name, slug"),
    admin.from("towers").select("id, project_id, name, initial_date, final_date"),
  ]);
  if (projects.error) return { error: "No se pudieron leer las torres.", status: 500 };
  if (towers.error) {
    if (missingColumn(towers.error.message)) {
      return { error: "Faltan las fechas en las torres. Hay que correr la migración 094.", status: 503 };
    }
    return { error: "No se pudieron leer las torres.", status: 500 };
  }

  const projectById = new Map<string, { name: string; slug: string }>();
  for (const row of (projects.data ?? []) as ProjectRecord[]) {
    const name = String(row.name ?? "");
    const slug = String(row.slug ?? "");
    if (!activeProject(name, slug)) continue;
    projectById.set(String(row.id), { name, slug });
  }

  const rows: TowerRow[] = [];
  for (const row of (towers.data ?? []) as TowerRecord[]) {
    const project = projectById.get(String(row.project_id));
    if (!project) continue;
    const towerName = String(row.name ?? "").trim();
    if (!towerName) continue;
    rows.push({
      id: String(row.id),
      projectName: projectLabel(project.name),
      towerName,
      initialDate: dateOnly(row.initial_date),
      finalDate: dateOnly(row.final_date),
    });
  }
  rows.sort(
    (left, right) =>
      compareProjectLabels(left.projectName, right.projectName) ||
      left.towerName.localeCompare(right.towerName, "es") ||
      left.id.localeCompare(right.id),
  );
  return { rows };
}

export async function GET() {
  const auth = await requireEditors();
  if (auth.response) return auth.response;
  try {
    const loaded = await loadRows();
    if ("error" in loaded) return privateJson({ error: loaded.error }, loaded.status);
    return privateJson({ rows: loaded.rows });
  } catch {
    return privateJson({ error: "No se pudieron leer las torres." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireEditors();
  if (auth.response) return auth.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return privateJson({ error: "Cada torre necesita una fecha válida o vacía." }, 400);
  }
  for (const row of parsed.data.rows) {
    if ((row.initialDate !== null && !realDate(row.initialDate)) || (row.finalDate !== null && !realDate(row.finalDate))) {
      return privateJson({ error: "Cada torre necesita una fecha válida o vacía." }, 400);
    }
  }
  const ids = parsed.data.rows.map((row) => row.id);
  if (new Set(ids).size !== ids.length) {
    return privateJson({ error: "Cada torre va una sola vez." }, 400);
  }

  try {
    const loaded = await loadRows();
    if ("error" in loaded) return privateJson({ error: loaded.error }, loaded.status);
    const allowed = new Set(loaded.rows.map((row) => row.id));
    if (parsed.data.rows.some((row) => !allowed.has(row.id))) {
      return privateJson({ error: "Esa torre no está en un proyecto activo." }, 400);
    }
    if (parsed.data.rows.length === 0) return privateJson({ ok: true, updated: 0 });

    const admin = createAdminClient();
    for (const row of parsed.data.rows) {
      const write = await admin
        .from("towers")
        .update({ initial_date: row.initialDate, final_date: row.finalDate })
        .eq("id", row.id);
      if (write.error) {
        if (missingColumn(write.error.message)) {
          return privateJson({ error: "Faltan las fechas en las torres. Hay que correr la migración 094." }, 503);
        }
        return privateJson({ error: "No se pudieron guardar los cambios." }, 500);
      }
    }
    return privateJson({ ok: true, updated: parsed.data.rows.length });
  } catch {
    return privateJson({ error: "No se pudieron guardar los cambios." }, 500);
  }
}
