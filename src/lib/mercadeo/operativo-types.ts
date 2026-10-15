export type BudgetStatus = "sin-presupuesto" | "agotado" | "sobre-ritmo" | "en-ritmo" | "bajo-presupuesto";

export type BudgetSource = "ingresado" | "cargado" | "mixto" | "sin-presupuesto";

export type BudgetRow = {
  slug: string;
  label: string;
  building: boolean;
  actualGtq: number;
  targetGtq: number | null;
  paceGtq: number | null;
  ratio: number | null;
  paceRatio: number | null;
  source: BudgetSource;
  status: BudgetStatus;
};

export type CplPoint = {
  month: string;
  label: string;
  cpl: number | null;
  leads: number;
  spendGtq: number;
};

export type CplSeries = {
  slug: string;
  label: string;
  dashed: boolean;
  points: CplPoint[];
};

export type FuenteBar = {
  label: string;
  units: number;
  gtq: number | null;
  sinMonto: number;
  folded: string[];
};

export type FuenteProject = {
  fuente: string;
  slug: string;
  project: string;
  units: number;
  gtq: number | null;
  sinMonto: number;
};

export type CierreRow = {
  slug: string;
  label: string;
  building: boolean;
  ventas: number;
  pautaGtq: number;
  costo: number | null;
};

export type TargetCell = {
  slug: string;
  label: string;
  month: string;
  loadedGtq: number | null;
  enteredGtq: number | null;
  enteredAt: string | null;
};

export type TargetEvent = {
  slug: string;
  label: string;
  month: string;
  amountGtq: number;
  enteredAt: string;
};

export type LeadBand = {
  slug: string;
  label: string;
  min: number | null;
  max: number | null;
};

export type OperativoReport = {
  periodLabel: string;
  rangeLabel: string;
  partial: boolean;
  cplCaption: string;
  notice: string | null;
  targetTableReady: boolean;
  months: { month: string; label: string }[];
  projects: { slug: string; label: string; building: boolean }[];
  budget: BudgetRow[];
  budgetHeadline: {
    actualGtq: number;
    targetGtq: number | null;
    paceGtq: number | null;
    ratio: number | null;
    paceRatio: number | null;
    status: BudgetStatus;
    scope: string;
  };
  puertaBudget: BudgetRow | null;
  cpl: CplSeries[];
  fuentes: FuenteBar[];
  fuenteProjects: FuenteProject[];
  reservaUnits: number;
  cierre: CierreRow[];
  cierreHeadline: { costo: number | null; ventas: number; pautaGtq: number; scope: string };
  leadHeadline: { leads: number; cpl: number | null; min: number | null; max: number | null };
  ranges: LeadBand[];
  targets: TargetCell[];
  targetHistory: TargetEvent[];
};
