import { adsGrain } from "./performance-ads-grain";
import { reservationGrain } from "./reservation-grain";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

const ADS_EPOCH_MS = Date.parse(`${adsGrain.epoch}T00:00:00Z`);
const RES_EPOCH_MS = Date.parse(`${reservationGrain.epoch}T00:00:00Z`);

export type MonthRow = {
  key: string;
  label: string;
  spendUsd: number;
  leads: number;
  reservas: number;
  costoPorReserva: number | null;
  leadToReserva: number | null;
};

export type CountRow = {
  name: string;
  count: number;
};

export type FuenteRow = {
  name: string;
  count: number;
  share: number;
  spendUsd: number;
};

export type PerformanceSReport = {
  reservas: number;
  spendUsd: number;
  leads: number;
  costoPorReserva: number | null;
  monthsWithBoth: number;
  monthCount: number;
  months: MonthRow[];
};

export type ReporteReservasReport = {
  reservas: number;
  spendUsd: number;
  costoPorCierre: number | null;
  last: { label: string; count: number } | null;
  previous: { label: string; count: number } | null;
  variation: number | null;
  byFuente: CountRow[];
  byProyecto: CountRow[];
  byAsesor: CountRow[];
  months: { label: string; count: number }[];
  fuentes: FuenteRow[];
};

export type MercadeoReservasReport = {
  refreshed: string;
  performanceS: PerformanceSReport;
  reporte: ReporteReservasReport;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isoFrom(epochMs: number, offset: number): string {
  return new Date(epochMs + offset * 86_400_000).toISOString().slice(0, 10);
}

function monthsInRange(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return [];
  const out: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endYear = Number(to.slice(0, 4));
  const endMonth = Number(to.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${String(year)}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

function monthLabel(key: string, spanYears: boolean): string {
  const name = MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
  return spanYears ? `${name} ${key.slice(0, 4)}` : name;
}

function ratio(part: number, total: number): number | null {
  if (total === 0) return null;
  return part / total;
}

function countsDesc(map: Map<string, number>): CountRow[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}

export function buildMercadeoReservas(
  from: string,
  to: string,
  accounts: readonly string[] | null,
): MercadeoReservasReport {
  const monthKeys = monthsInRange(from, to);
  const spanYears = new Set(monthKeys.map((key) => key.slice(0, 4))).size > 1;
  const labelOf = (key: string) => monthLabel(key, spanYears);
  const allowedProjects = accounts == null ? null : new Set(accounts);
  const allowedAccounts = accounts == null ? null : new Set(
    accounts.map((name) => adsGrain.accounts.indexOf(name)).filter((index) => index >= 0),
  );

  const spendCents = new Map<string, number>();
  const leads = new Map<string, number>();
  let totalCents = 0;
  let totalLeads = 0;
  for (const row of adsGrain.daily) {
    const offset = row[0] ?? 0;
    const account = row[1] ?? 0;
    const date = isoFrom(ADS_EPOCH_MS, offset);
    if (date < from || date > to) continue;
    if (allowedAccounts && !allowedAccounts.has(account)) continue;
    const key = date.slice(0, 7);
    const cents = row[5] ?? 0;
    const leadCount = row[4] ?? 0;
    spendCents.set(key, (spendCents.get(key) ?? 0) + cents);
    leads.set(key, (leads.get(key) ?? 0) + leadCount);
    totalCents += cents;
    totalLeads += leadCount;
  }

  const reservasByMonth = new Map<string, number>();
  const byFuente = new Map<string, number>();
  const byProyecto = new Map<string, number>();
  const byAsesor = new Map<string, number>();
  let reservas = 0;
  for (const row of reservationGrain.rows) {
    const offset = row[0];
    if (offset == null) continue;
    const date = isoFrom(RES_EPOCH_MS, offset);
    if (date < from || date > to) continue;
    const project = reservationGrain.projects[row[1] ?? -1];
    const fuente = reservationGrain.fuentes[row[2] ?? -1];
    const userIndex = row[3] ?? -1;
    const user = userIndex < 0 ? "(sin asignar)" : reservationGrain.users[userIndex];
    if (!project || !fuente || !user) continue;
    if (allowedProjects && !allowedProjects.has(project)) continue;
    reservas += 1;
    const key = date.slice(0, 7);
    reservasByMonth.set(key, (reservasByMonth.get(key) ?? 0) + 1);
    byFuente.set(fuente, (byFuente.get(fuente) ?? 0) + 1);
    byProyecto.set(project, (byProyecto.get(project) ?? 0) + 1);
    byAsesor.set(user, (byAsesor.get(user) ?? 0) + 1);
  }

  const spendUsd = round2(totalCents / 100);
  const months: MonthRow[] = monthKeys.map((key) => {
    const monthReservas = reservasByMonth.get(key) ?? 0;
    const monthLeads = leads.get(key) ?? 0;
    const monthSpend = round2((spendCents.get(key) ?? 0) / 100);
    return {
      key,
      label: labelOf(key),
      spendUsd: monthSpend,
      leads: monthLeads,
      reservas: monthReservas,
      costoPorReserva: ratio(monthSpend, monthReservas) == null ? null : round2(monthSpend / monthReservas),
      leadToReserva: ratio(monthReservas, monthLeads),
    };
  });
  const monthsWithBoth = months.filter((month) => month.reservas > 0 && month.spendUsd > 0).length;
  const lastMonth = months.length === 0 ? null : months[months.length - 1] ?? null;
  const previousMonth = months.length < 2 ? null : months[months.length - 2] ?? null;
  const variation = lastMonth && previousMonth && previousMonth.reservas > 0
    ? lastMonth.reservas / previousMonth.reservas - 1
    : null;
  const fuentes = countsDesc(byFuente).map((row) => ({
    name: row.name,
    count: row.count,
    share: reservas === 0 ? 0 : row.count / reservas,
    spendUsd: reservas === 0 ? 0 : round2((spendUsd * row.count) / reservas),
  }));
  const head = fuentes[0];
  if (head && reservas > 0) {
    const assigned = round2(fuentes.reduce((sum, row) => sum + row.spendUsd, 0));
    head.spendUsd = round2(head.spendUsd + round2(spendUsd - assigned));
  }

  return {
    refreshed: reservationGrain.refreshed,
    performanceS: {
      reservas,
      spendUsd,
      leads: totalLeads,
      costoPorReserva: reservas === 0 ? null : round2(spendUsd / reservas),
      monthsWithBoth,
      monthCount: months.length,
      months,
    },
    reporte: {
      reservas,
      spendUsd,
      costoPorCierre: reservas === 0 ? null : round2(spendUsd / reservas),
      last: lastMonth ? { label: lastMonth.label, count: lastMonth.reservas } : null,
      previous: previousMonth ? { label: previousMonth.label, count: previousMonth.reservas } : null,
      variation,
      byFuente: countsDesc(byFuente),
      byProyecto: countsDesc(byProyecto),
      byAsesor: countsDesc(byAsesor),
      months: months.map((month) => ({ label: month.label, count: month.reservas })),
      fuentes,
    },
  };
}
