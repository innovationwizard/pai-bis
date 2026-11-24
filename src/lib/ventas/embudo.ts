export const EMBUDO_STAGES = [
  "Ingreso",
  "Contactado",
  "En Perfilamiento",
  "Calificados",
  "Cita Programada",
  "Visita Efectiva",
  "En Decisión",
  "Reserva",
] as const;

export const EMBUDO_PIPELINES = [
  { slug: "boulevard-5", label: "Boulevard 5" },
  { slug: "benestare", label: "Benestare" },
  { slug: "bosque-las-tapias", label: "Bosque Las Tapias" },
  { slug: "santa-elena", label: "Santa Elena" },
] as const;

export type EmbudoInput = {
  id: string;
  project: string;
  addOn: string;
  stageOrder: number;
};

export type EmbudoDeal = {
  id: string;
  project: string;
  addOn: string;
  stageOrder: number;
  stage: string;
};

export type EmbudoBar = {
  label: string;
  count: number;
  hasNext: boolean;
  nextRate: number | null;
};

export type EmbudoFunnel = {
  slug: string;
  label: string;
  bars: EmbudoBar[];
  deals: EmbudoDeal[];
};

function stageName(order: number): string {
  return EMBUDO_STAGES[order - 1] ?? "";
}

function countsIn(deals: readonly EmbudoInput[]): number[] {
  const counts = EMBUDO_STAGES.map(() => 0);
  for (const deal of deals) {
    const reach = Math.min(EMBUDO_STAGES.length, deal.stageOrder);
    for (let index = 0; index < reach; index += 1) counts[index] += 1;
  }
  return counts;
}

/**
 * Current position and every earlier position. Position 8 is Reserva.
 * status is not an input. A stored won value does not fill the funnel.
 * The rate between two stages is the next count divided by this count.
 * A stage with a count of 0 has a rate of 0. Reserva has no rate after it.
 */
export function embudoFunnel(slug: string, label: string, deals: readonly EmbudoInput[]): EmbudoFunnel {
  const counted = deals.filter((deal) => Number.isInteger(deal.stageOrder) && deal.stageOrder >= 1 && deal.stageOrder <= EMBUDO_STAGES.length);
  const counts = countsIn(counted);
  const bars = EMBUDO_STAGES.map((stage, index) => {
    const count = counts[index] ?? 0;
    const hasNext = index + 1 < EMBUDO_STAGES.length;
    const next = hasNext ? counts[index + 1] ?? 0 : 0;
    return {
      label: stage,
      count,
      hasNext,
      nextRate: hasNext ? (count > 0 ? next / count : 0) : null,
    };
  });
  return {
    slug,
    label,
    bars,
    deals: counted.map((deal) => ({
      id: deal.id,
      project: deal.project,
      addOn: deal.addOn,
      stageOrder: deal.stageOrder,
      stage: stageName(deal.stageOrder),
    })),
  };
}

const LEAK_SIGNIFICANCE = -1.96;

export type LeakageTone = "green" | "amber" | "red" | "open";

export type Leakage = {
  stage: string | null;
  z: number;
  tone: LeakageTone;
};

function roundZ(z: number): number {
  if (!Number.isFinite(z)) return z;
  const rounded = Math.round(z * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

function toneOf(z: number): LeakageTone {
  if (!Number.isFinite(z)) return z < 0 ? "red" : "open";
  if (z > 0) return "open";
  if (z >= -2) return "green";
  if (z >= -3) return "amber";
  return "red";
}

function transitionZ(n: number, next: number, baseN: number, baseNext: number): number | null {
  if (n <= 0 || baseN <= 0) return null;
  const p = next / n;
  const pBar = baseNext / baseN;
  const variance = pBar * (1 - pBar);
  if (variance <= 0) {
    if (p === pBar) return 0;
    return p < pBar ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }
  return (p - pBar) / Math.sqrt(variance / n);
}

export function leakage(subject: EmbudoFunnel, portfolio: EmbudoFunnel): Leakage {
  let bestZ = Number.POSITIVE_INFINITY;
  let bestStage: string | null = null;
  let found = false;
  const steps = Math.min(subject.bars.length, portfolio.bars.length) - 1;
  for (let index = 0; index < steps; index += 1) {
    const from = subject.bars[index];
    const to = subject.bars[index + 1];
    const baseFrom = portfolio.bars[index];
    const baseTo = portfolio.bars[index + 1];
    if (!from || !to || !baseFrom || !baseTo) continue;
    const raw = transitionZ(from.count, to.count, baseFrom.count, baseTo.count);
    if (raw == null) continue;
    const z = roundZ(raw);
    if (!found || z < bestZ) {
      found = true;
      bestZ = z;
      bestStage = from.label;
    }
  }
  if (!found) return { stage: null, z: 0, tone: "green" };
  return {
    stage: bestZ < LEAK_SIGNIFICANCE ? bestStage : null,
    z: bestZ,
    tone: toneOf(bestZ),
  };
}
