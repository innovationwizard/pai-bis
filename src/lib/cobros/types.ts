export const COBROS_SECTIONS = [
  "cobros-por-proyecto",
  "cobros-acumulados",
  "cobros-del-mes",
  "deficit",
  "superavit",
  "reporte-deficit-superavit",
  "alertas",
  "decisiones-desistimientos",
  "casos-especiales",
  "reporte-recurrente",
  "alertas-desistimiento",
  "cierre-mensual-de-cobros",
] as const;

export type CobrosSection = (typeof COBROS_SECTIONS)[number];

export function isCobrosSection(slug: string): slug is CobrosSection {
  return (COBROS_SECTIONS as readonly string[]).includes(slug);
}

export type Choice = { id: string; label: string };

export type Kpi = { label: string; value: string; hint: string };

export type Bar = { id: string; label: string; value: number };

export type Series = { name: string; points: { id: string; label: string; value: number }[] };

export type Line = { id: string; drillId: string; values: string[] };

export type DraftBlock = {
  title: string;
  headers: string[];
  lines: Line[];
  total: number;
};

export type BakedKind = "resumen" | "alertas" | "cierre" | null;

export type CobrosVista = {
  section: CobrosSection;
  question: string;
  periodLabel: string;
  rangeLabel: string;
  caption: string;
  notices: string[];
  empty: string | null;
  projects: { id: string; label: string; ledger: "con_libro" | "sin_datos" }[];
  choices: {
    torre: Choice[];
    modelo: Choice[];
    banco: Choice[];
  };
  kpis: Kpi[];
  gtqBars: Bar[];
  usdBars: Bar[];
  bookedBars: Bar[];
  gtqSeries: Series[];
  usdSeries: Series[];
  bookedSeries: Series[];
  lineTitle: string;
  lineHeaders: string[];
  lines: Line[];
  listTotal: number;
  drafts: DraftBlock | null;
  compare: { label: string; detail: string }[];
  baked: BakedKind;
};

export const PLAN_FREEZE =
  "El plan de enganche está congelado al 1 de octubre de 2026. La expectativa es la cuota del enganche, no el precio de venta. Lo publicado después de esa fecha está en el libro y no en el confirmado del plan.";

export const SIN_DATOS =
  "Sin datos en Odoo 15. Santa Elena y Casa Elisa no tienen socios de unidad ni recibos. No se muestra un cero.";
