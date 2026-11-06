import { hierarchy, partition } from "d3-hierarchy";
import { line } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { FIXTURE, type Project } from "./fixture";
import { previousOf } from "./format";
import type { Target } from "./state";

/**
 * Hues de proyecto ya usados por los gráficos del panel
 * (PROJECT_COLOR en mercadeo/glance-view y operativo-view).
 * El asesor hereda el hue del proyecto, mezclado con blanco.
 */
export const PROJECT_HUE: Record<string, string> = {
  benestare: "#0d2041",
  "bosque-las-tapias": "#0573b0",
  "boulevard-5": "#3d6f8f",
};

const ADVISOR_MIX = [0.18, 0.5] as const;

export function mixWhite(hex: string, amount: number): string {
  const raw = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const value = (raw >> shift) & 255;
    return Math.round(value + (255 - value) * amount);
  };
  const hexByte = (value: number) => value.toString(16).padStart(2, "0");
  return `#${hexByte(channel(16))}${hexByte(channel(8))}${hexByte(channel(0))}`;
}

export function advisorFill(projectId: string, index: number): string {
  const hue = PROJECT_HUE[projectId] ?? "#0d2041";
  return mixWhite(hue, ADVISOR_MIX[index] ?? 0.5);
}

export function textOn(hex: string): string {
  const raw = Number.parseInt(hex.slice(1), 16);
  const r = (raw >> 16) & 255;
  const g = (raw >> 8) & 255;
  const b = raw & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#0d2041" : "#ffffff";
}

export type Geom = { x0: number; x1: number; y0: number; y1: number };

export type SunArc = Geom & {
  id: string;
  name: string;
  kind: "project" | "advisor";
  projectId: string;
  advisorId: string | null;
  reservas: number;
  fill: string;
};

type HNode = {
  id: string;
  name: string;
  kind: "total" | "project" | "advisor";
  projectId: string | null;
  advisorId: string | null;
  reservas: number;
  fill: string;
  children?: HNode[];
};

/** Partition fijo: ángulos en radianes, radio en profundidades 0–3. */
export function sunburstArcs(): SunArc[] {
  const data: HNode = {
    id: "total",
    name: "Total",
    kind: "total",
    projectId: null,
    advisorId: null,
    reservas: 0,
    fill: "#0d2041",
    children: FIXTURE.projects.map((project) => ({
      id: project.id,
      name: project.label,
      kind: "project" as const,
      projectId: project.id,
      advisorId: null,
      reservas: 0,
      fill: PROJECT_HUE[project.id] ?? "#0d2041",
      children: project.advisors.map((advisor, index) => ({
        id: advisor.id,
        name: advisor.name,
        kind: "advisor" as const,
        projectId: project.id,
        advisorId: advisor.id,
        reservas: advisor.reservas,
        fill: advisorFill(project.id, index),
      })),
    })),
  };

  const root = hierarchy(data)
    .sum((node) => (node.kind === "advisor" ? node.reservas : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const laid = partition<HNode>().size([Math.PI * 2, 3])(root);
  const arcs: SunArc[] = [];
  laid.each((node) => {
    if (node.data.kind === "total" || node.data.projectId == null) return;
    arcs.push({
      id: node.data.id,
      name: node.data.name,
      kind: node.data.kind,
      projectId: node.data.projectId,
      advisorId: node.data.advisorId,
      reservas: node.value ?? 0,
      fill: node.data.fill,
      x0: node.x0,
      x1: node.x1,
      y0: node.y0,
      y1: node.y1,
    });
  });
  return arcs;
}

export function place(base: Geom, focus: Geom | null): Geom {
  if (!focus) return { x0: base.x0, x1: base.x1, y0: base.y0, y1: base.y1 };
  const span = focus.x1 - focus.x0;
  if (span <= 0) return { x0: base.x0, x1: base.x1, y0: base.y0, y1: base.y1 };
  return {
    x0: ((base.x0 - focus.x0) / span) * Math.PI * 2,
    x1: ((base.x1 - focus.x0) / span) * Math.PI * 2,
    y0: base.y0 - focus.y0,
    y1: base.y1 - focus.y0,
  };
}

export function targetsFor(arcs: readonly SunArc[], focusId: string | null): Map<string, Geom> {
  const focus = focusId == null ? null : arcs.find((arc) => arc.id === focusId) ?? null;
  const focusGeom = focus ? { x0: focus.x0, x1: focus.x1, y0: focus.y0, y1: focus.y1 } : null;
  const map = new Map<string, Geom>();
  for (const arc of arcs) map.set(arc.id, place(arc, focusGeom));
  return map;
}

export function shownTarget(geom: Geom): boolean {
  const span = geom.x1 - geom.x0;
  return geom.y1 > 1.05 && geom.y0 < 2.98 && span > 0.02 && geom.x0 < Math.PI * 2 - 0.01 && geom.x1 > 0.01;
}

export function drawable(geom: Geom): boolean {
  const span = geom.x1 - geom.x0;
  if (span < 0.008) return false;
  if (geom.x1 <= 0.01 || geom.x0 >= Math.PI * 2 - 0.01) return false;
  if (geom.y1 <= 0.2 || geom.y0 >= 3.05) return false;
  return true;
}

export type Mark = {
  kind: "total" | "project" | "advisor";
  projectId: string | null;
  advisorId: string | null;
};

export function markOpacity(
  mark: Mark,
  spotlight: Target | null,
  focusProjectId: string | null,
  selected: readonly string[],
): number {
  if (spotlight) {
    if (spotlight.kind === "total") return mark.kind === "total" ? 1 : 0.35;
    if (spotlight.kind === "advisor") {
      return mark.kind === "advisor" && mark.advisorId === spotlight.advisorId ? 1 : 0.35;
    }
    return mark.projectId === spotlight.projectId ? 1 : 0.35;
  }
  if (focusProjectId) {
    if (mark.kind === "total") return 1;
    return mark.projectId === focusProjectId ? 1 : 0.35;
  }
  if (selected.length > 0) {
    if (mark.kind === "total") return 1;
    return mark.projectId != null && selected.includes(mark.projectId) ? 1 : 0.35;
  }
  return 1;
}

export function visibleProjects(focusProjectId: string | null, selected: readonly string[]): readonly Project[] {
  if (focusProjectId) {
    const one = FIXTURE.projects.find((project) => project.id === focusProjectId);
    return one ? [one] : FIXTURE.projects;
  }
  if (selected.length > 0) return FIXTURE.projects.filter((project) => selected.includes(project.id));
  return FIXTURE.projects;
}

export type RankRow = {
  advisorId: string;
  name: string;
  reservas: number;
  projectId: string;
  projectLabel: string;
  projectReservas: number;
  fill: string;
};

export function rankRows(projects: readonly Project[]): RankRow[] {
  const order = new Map(FIXTURE.projects.map((project, index) => [project.id, index]));
  const rows: RankRow[] = projects.flatMap((project) =>
    project.advisors.map((advisor, index) => ({
      advisorId: advisor.id,
      name: advisor.name,
      reservas: advisor.reservas,
      projectId: project.id,
      projectLabel: project.label,
      projectReservas: project.reservas,
      fill: advisorFill(project.id, index),
    })),
  );
  rows.sort(
    (a, b) =>
      b.reservas - a.reservas ||
      (order.get(a.projectId) ?? 0) - (order.get(b.projectId) ?? 0) ||
      a.name.localeCompare(b.name, "es"),
  );
  return rows;
}

export function rankMax(rows: readonly RankRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.reservas), 1);
}

export type BridgeStep = {
  id: string;
  kind: "total" | "project";
  projectId: string | null;
  name: string;
  valueLabel: string;
  derived: boolean;
  bottomPct: number;
  heightPct: number;
  fill: string;
  flat: boolean;
};

export type BridgeLayout = {
  steps: BridgeStep[];
  links: string[];
};

const linkLine = line<{ x: number; y: number }>()
  .x((point) => point.x)
  .y((point) => point.y);

export function bridgeLayout(): BridgeLayout {
  const total = FIXTURE.total.reservas;
  const previous = previousOf(total, FIXTURE.total.change);
  const steps: BridgeStep[] = [];
  let cursor = previous;

  steps.push({
    id: "mes-anterior",
    kind: "total",
    projectId: null,
    name: "Mes anterior",
    valueLabel: String(previous),
    derived: true,
    bottomPct: 0,
    heightPct: (previous / total) * 100,
    fill: "#94a3b8",
    flat: false,
  });

  for (const project of FIXTURE.projects) {
    const start = cursor;
    cursor += project.change;
    const height = total === 0 ? 0 : ((cursor - start) / total) * 100;
    steps.push({
      id: project.id,
      kind: "project",
      projectId: project.id,
      name: project.label,
      valueLabel: project.change > 0 ? `+${project.change}` : project.change < 0 ? String(project.change) : "+0",
      derived: false,
      bottomPct: (start / total) * 100,
      heightPct: height,
      fill: PROJECT_HUE[project.id] ?? "#0d2041",
      flat: project.change === 0,
    });
  }

  steps.push({
    id: "mes-pasado",
    kind: "total",
    projectId: null,
    name: "Mes pasado",
    valueLabel: String(total),
    derived: false,
    bottomPct: 0,
    heightPct: 100,
    fill: "#0d2041",
    flat: false,
  });

  const n = steps.length;
  const col = 100 / n;
  const links: string[] = [];
  steps.forEach((step, index) => {
    if (index === steps.length - 1) return;
    const y = Math.min(99, Math.max(1, 100 - (step.bottomPct + step.heightPct)));
    const inset = col * 0.18;
    const path = linkLine([
      { x: (index + 1) * col - inset, y },
      { x: (index + 1) * col + inset, y },
    ]);
    if (path) links.push(path);
  });

  return { steps, links };
}

export const BRIDGE: BridgeLayout = bridgeLayout();

export type CompareCol = {
  projectId: string;
  name: string;
  reservas: number;
  previous: number;
  currentPct: number;
  previousPct: number;
  fill: string;
};

export function compareColumns(): CompareCol[] {
  const peak = Math.max(
    ...FIXTURE.projects.flatMap((project) => [project.reservas, previousOf(project.reservas, project.change)]),
  );
  const scale = scaleLinear().domain([0, peak]).range([0, 100]);
  return FIXTURE.projects.map((project) => {
    const previous = previousOf(project.reservas, project.change);
    return {
      projectId: project.id,
      name: project.label,
      reservas: project.reservas,
      previous,
      currentPct: scale(project.reservas),
      previousPct: scale(previous),
      fill: PROJECT_HUE[project.id] ?? "#0d2041",
    };
  });
}

export const COMPARE: readonly CompareCol[] = compareColumns();

export type TreeCell = {
  name: string;
  value: number;
  fill: string;
  kind: "project" | "advisor";
  projectId: string;
  advisorId: string | null;
};

export function treemapCells(focusId: string | null, selected: readonly string[]): TreeCell[] {
  const projects = visibleProjects(focusId, selected);
  if (focusId) {
    return projects.flatMap((project) =>
      project.advisors.map((advisor, index) => ({
        name: advisor.name,
        value: advisor.reservas,
        fill: advisorFill(project.id, index),
        kind: "advisor" as const,
        projectId: project.id,
        advisorId: advisor.id,
      })),
    );
  }
  return projects.map((project) => ({
    name: project.label,
    value: project.reservas,
    fill: PROJECT_HUE[project.id] ?? "#0d2041",
    kind: "project" as const,
    projectId: project.id,
    advisorId: null,
  }));
}

export type FlowNodeDatum = {
  name: string;
  fill: string;
  kind: "total" | "project" | "advisor";
  projectId: string | null;
  advisorId: string | null;
};

export function flowData(focusId: string | null, selected: readonly string[]): {
  nodes: FlowNodeDatum[];
  links: Array<{ source: number; target: number; value: number }>;
} {
  const projects = visibleProjects(focusId, selected);
  const nodes: FlowNodeDatum[] = [];
  const links: Array<{ source: number; target: number; value: number }> = [];
  const includeTotal = focusId == null;
  if (includeTotal) {
    nodes.push({ name: "Total", fill: "#0d2041", kind: "total", projectId: null, advisorId: null });
  }
  const projectIndex = new Map<string, number>();
  for (const project of projects) {
    projectIndex.set(project.id, nodes.length);
    nodes.push({
      name: project.label,
      fill: PROJECT_HUE[project.id] ?? "#0d2041",
      kind: "project",
      projectId: project.id,
      advisorId: null,
    });
    if (includeTotal) links.push({ source: 0, target: nodes.length - 1, value: project.reservas });
  }
  for (const project of projects) {
    const from = projectIndex.get(project.id);
    if (from == null) continue;
    project.advisors.forEach((advisor, index) => {
      nodes.push({
        name: advisor.name,
        fill: advisorFill(project.id, index),
        kind: "advisor",
        projectId: project.id,
        advisorId: advisor.id,
      });
      links.push({ source: from, target: nodes.length - 1, value: advisor.reservas });
    });
  }
  return { nodes, links };
}
