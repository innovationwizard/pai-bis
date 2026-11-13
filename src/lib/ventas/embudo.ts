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
  pipeline: string;
  status: string;
  stageOrder: number;
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
  winRate: number | null;
  bars: EmbudoBar[];
};

/**
 * Creation cohort. Current position and every earlier position.
 * A won deal counts in every position. The rate beside a bar is the next count
 * divided by this count. Win rate is won deals divided by deals that reached Ingreso.
 */
export function embudoFunnel(slug: string, label: string, deals: readonly EmbudoInput[]): EmbudoFunnel {
  const counts = EMBUDO_STAGES.map(() => 0);
  let won = 0;
  for (const deal of deals) {
    if (deal.status === "won") {
      won += 1;
      for (let index = 0; index < counts.length; index += 1) counts[index] += 1;
      continue;
    }
    if (deal.status !== "open" && deal.status !== "lost") continue;
    const order = deal.stageOrder;
    if (!Number.isInteger(order) || order < 1) continue;
    const reach = Math.min(counts.length, order);
    for (let index = 0; index < reach; index += 1) counts[index] += 1;
  }
  const ingreso = counts[0] ?? 0;
  const bars = EMBUDO_STAGES.map((stage, index) => {
    const count = counts[index] ?? 0;
    const hasNext = index + 1 < counts.length;
    const next = hasNext ? counts[index + 1] ?? 0 : 0;
    return {
      label: stage,
      count,
      hasNext,
      nextRate: hasNext && count > 0 ? next / count : null,
    };
  });
  return {
    slug,
    label,
    winRate: ingreso === 0 ? null : won / ingreso,
    bars,
  };
}
