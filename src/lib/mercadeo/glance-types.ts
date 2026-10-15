import type { BudgetRow, BudgetStatus, CplSeries, TargetCell, TargetEvent } from "./operativo-types";

export const GLANCE_SECTIONS = [
  "efectividad",
  "costo-por-lead",
  "inversion-acumulada",
  "canales",
  "gestion-de-pauta",
] as const;

export type GlanceSection = (typeof GLANCE_SECTIONS)[number];

export function isGlanceSection(slug: string): slug is GlanceSection {
  return (GLANCE_SECTIONS as readonly string[]).includes(slug);
}

type ProjectChoice = { slug: string; label: string; building: boolean };

type VistaBase = {
  question: string;
  periodLabel: string;
  rangeLabel: string;
  caption: string;
  notice: string | null;
  projects: ProjectChoice[];
};

export type CampaignBar = {
  campaign: string;
  short: string;
  spendGtq: number;
  leads: number;
  cpl: number | null;
  tone: "sin-leads" | "caro" | "en-linea";
};

export type EfectividadVista = VistaBase & {
  section: "efectividad";
  spendGtq: number;
  leads: number;
  medianCpl: number | null;
  withSales: number;
  bySpend: CampaignBar[];
  byReservas: { campaign: string; short: string; units: number }[];
  byCierre: { campaign: string; short: string; costo: number; ventas: number }[];
  rest: number;
  puerta: { spendGtq: number; leads: number } | null;
  detail: { campaign: string; spendGtq: number | null; leads: number | null; cpl: number | null; reservas: number; ventas: number; scope: "proyecto" | "puerta" }[];
};

export type CplVista = VistaBase & {
  section: "costo-por-lead";
  series: CplSeries[];
  latestCpl: number | null;
  previousCpl: number | null;
  latestLabel: string;
  previousLabel: string | null;
  monthRows: { slug: string; label: string; leads: number; spendGtq: number; cpl: number | null }[];
};

export type InversionVista = VistaBase & {
  section: "inversion-acumulada";
  cumulativeGtq: number;
  planGtq: number | null;
  months: { month: string; label: string; pautaGtq: number; cumulativeGtq: number; cumulativePlanGtq: number | null }[];
  gaps: { slug: string; label: string; actualGtq: number; planGtq: number | null }[];
  monthLines: { month: string; label: string; lines: { label: string; gtq: number | null }[] }[];
};

export type CanalesVista = VistaBase & {
  section: "canales";
  active: number;
  measured: number;
  days: number;
  channels: { label: string; spendGtq: number | null; activeDays: number | null; days: number; leads: number | null; forms: number | null }[];
};

export type GestionVista = VistaBase & {
  section: "gestion-de-pauta";
  actualGtq: number;
  targetGtq: number | null;
  paceGtq: number | null;
  paceRatio: number | null;
  status: BudgetStatus;
  scope: string;
  partial: boolean;
  rows: BudgetRow[];
  puerta: BudgetRow | null;
  daily: { day: string; label: string; actualGtq: number; paceGtq: number | null }[];
  editor: {
    months: { month: string; label: string }[];
    targets: TargetCell[];
    targetHistory: TargetEvent[];
    targetTableReady: boolean;
  };
};

export type MercadeoVista = EfectividadVista | CplVista | InversionVista | CanalesVista | GestionVista;
