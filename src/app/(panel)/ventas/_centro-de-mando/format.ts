import { FIXTURE, type Advisor, type Project } from "./fixture";
import type { Target } from "./state";

/** Mes anterior = reservas − cambio. Derivado. */
export function previousOf(reservas: number, change: number): number {
  return reservas - change;
}

/** Una cifra decimal, punto, como en el SSOT (37.0%). */
export function formatPct(part: number, whole: number): string {
  if (whole === 0) return "n/d";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export function projectById(id: string): Project | null {
  return FIXTURE.projects.find((project) => project.id === id) ?? null;
}

export function findAdvisor(id: string): { project: Project; advisor: Advisor } | null {
  for (const project of FIXTURE.projects) {
    const advisor = project.advisors.find((item) => item.id === id);
    if (advisor) return { project, advisor };
  }
  return null;
}

export function readoutFor(target: Target | null): string {
  if (!target || target.kind === "total") {
    return `Total: ${FIXTURE.total.reservas} reservas, ${FIXTURE.total.changeLabel} frente al mes anterior.`;
  }
  if (target.kind === "project") {
    const project = projectById(target.projectId);
    if (!project) return `${FIXTURE.total.reservas} reservas.`;
    return `${project.label}: ${project.reservas} reservas, ${formatPct(project.reservas, FIXTURE.total.reservas)} del total, ${project.changeLabel} frente al mes anterior.`;
  }
  const found = findAdvisor(target.advisorId);
  if (!found) return `${FIXTURE.total.reservas} reservas.`;
  const { project, advisor } = found;
  return `${project.label} · ${advisor.name}: ${advisor.reservas} reservas, ${formatPct(advisor.reservas, FIXTURE.total.reservas)} del total, ${formatPct(advisor.reservas, project.reservas)} de ${project.label}.`;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

/** Tabla del SSOT, una fila por proyecto más el total. */
export function fixtureCsv(): string {
  const header = ["Proyecto", "Etiqueta SSOT", "Reservas", "Cambio frente al mes anterior", "Asesores"];
  const rows = FIXTURE.projects.map((project) => [
    project.label,
    project.ssotLabel,
    String(project.reservas),
    project.changeLabel,
    project.advisors.map((advisor) => `${advisor.name} ${advisor.reservas}`).join("; "),
  ]);
  rows.push(["Total", "General", String(FIXTURE.total.reservas), FIXTURE.total.changeLabel, ""]);
  return [header, ...rows].map((cells) => cells.map(csvCell).join(",")).join("\n");
}

export function chartSummary(): string {
  const projects = FIXTURE.projects
    .map((project) => {
      const people = project.advisors.map((advisor) => `${advisor.name} ${advisor.reservas}`).join(", ");
      return `${project.label} ${project.reservas} (${people})`;
    })
    .join(". ");
  return `6 nov 2026. ${FIXTURE.metric}, tipo ${FIXTURE.activity}, estado ${FIXTURE.status}, ${FIXTURE.month}. Total ${FIXTURE.total.reservas}, ${FIXTURE.total.changeLabel} frente al mes anterior. ${projects}.`;
}
