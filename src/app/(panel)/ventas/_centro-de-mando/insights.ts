import { FIXTURE, type Fixture } from "./fixture";
import { formatPct } from "./format";

/**
 * Lectura descriptiva del SSOT. Sin causa y sin cifras fuera del fixture
 * y de las participaciones que salen de él.
 */
export function insightLines(fixture: Fixture): readonly string[] {
  const lines: string[] = [];
  const top = [...fixture.projects].sort((a, b) => b.change - a.change || b.reservas - a.reservas)[0];
  if (top && fixture.total.change !== 0) {
    lines.push(
      `${top.label} aporta ${top.change} de las ${fixture.total.change} reservas adicionales (${formatPct(top.change, fixture.total.change)}).`,
    );
  }

  const advisors = fixture.projects.flatMap((project) => project.advisors);
  const leader = advisors.reduce<(typeof advisors)[number] | null>((best, advisor) => {
    if (!best || advisor.reservas > best.reservas) return advisor;
    return best;
  }, null);
  if (leader) {
    lines.push(
      `${leader.name} concentra ${leader.reservas} de ${fixture.total.reservas} reservas (${formatPct(leader.reservas, fixture.total.reservas)}).`,
    );
  }

  for (const project of fixture.projects) {
    if (project.change === 0) {
      lines.push(`${project.label} no cambió frente al mes anterior (0).`);
    }
  }

  for (const project of fixture.projects) {
    const lead = [...project.advisors].sort((a, b) => b.reservas - a.reservas)[0];
    if (!lead) continue;
    lines.push(
      `${lead.name} lidera ${project.label} con ${lead.reservas} de ${project.reservas} reservas (${formatPct(lead.reservas, project.reservas)}).`,
    );
  }

  return lines;
}

export const INSIGHTS: readonly string[] = insightLines(FIXTURE);
