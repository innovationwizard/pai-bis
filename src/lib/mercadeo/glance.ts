import type { DateWindow } from "@/lib/ventas/period";
import { inclusiveDays, monthEnd, monthStart } from "@/lib/ventas/period";
import type { CampaignRow } from "./report";
import {
  loadMercadeoStore,
  storeCampaignsFor,
  storeChannels,
  storeDaySpend,
  storeMonthLines,
  storeMonthPlan,
  storePauta,
  type MercadeoStore,
} from "./report";
import { buildOperativo, operativoBounds, readTargetEvents, type OperativoFilters } from "./operativo";
import type { GlanceSection, MercadeoVista } from "./glance-types";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function monthName(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return `${MONTHS[index] ?? month} ${month.slice(0, 4)}`;
}

function monthsOf(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = monthStart(from);
  const end = monthStart(to);
  while (cursor <= end) {
    months.push(cursor);
    const [year, month] = cursor.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, 1));
    date.setUTCMonth(date.getUTCMonth() + 1);
    cursor = date.toISOString().slice(0, 10);
  }
  return months;
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to && days.length < 400) {
    days.push(cursor);
    const [year, month, day] = cursor.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + 1);
    cursor = date.toISOString().slice(0, 10);
  }
  return days;
}

function daysInMonth(month: string): number {
  return Number(monthEnd(month).slice(8, 10));
}

function clip(name: string): string {
  return name.length > 32 ? `${name.slice(0, 30)}…` : name;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const left = sorted[mid - 1];
  const right = sorted[mid];
  if (left == null || right == null) return null;
  return (left + right) / 2;
}

function activeOf(store: MercadeoStore, slugs: string[] | null) {
  const selected = store.centers.filter((center) => slugs === null || slugs.includes(center.slug));
  const buildings = selected.filter((center) => center.building);
  const puerta = selected.find((center) => !center.building) ?? null;
  const active = buildings.length > 0 ? buildings : puerta ? [puerta] : [];
  return { active, ids: new Set(active.map((center) => center.id)) };
}

function planOf(store: MercadeoStore, latest: Map<string, number>, centerId: string, month: string): number | null {
  const saved = latest.get(`${centerId}|${month}`);
  if (saved != null) return saved;
  const workbook = storeMonthPlan(store, new Set([centerId]), month);
  return workbook > 0 ? workbook : null;
}

function sliceMonth(month: string, rangeTo: string): { from: string; to: string; partial: boolean } {
  const end = monthEnd(month);
  const to = end > rangeTo ? rangeTo : end;
  return { from: month, to, partial: to < end };
}

export async function buildVista(section: GlanceSection, filters: OperativoFilters): Promise<MercadeoVista> {
  const bounds = operativoBounds(filters);
  const report = await buildOperativo(filters);
  const store = await loadMercadeoStore(bounds);
  const range = bounds.range;
  const { active, ids } = activeOf(store, filters.slugs);
  const base = {
    periodLabel: report.periodLabel,
    rangeLabel: report.rangeLabel,
    notice: report.notice,
    projects: report.projects,
  };

  if (section === "efectividad") {
    const grouped = storeCampaignsFor(store, range, filters.slugs);
    const rows = grouped.main.filter((row) => (row.spendGtq ?? 0) > 0 || row.reservas.units > 0 || row.ventas.units > 0);
    const cpls = rows.flatMap((row) => (row.cpl == null ? [] : [row.cpl]));
    const mid = median(cpls);
    const spendGtq = rows.reduce((sum, row) => sum + (row.spendGtq ?? 0), 0);
    const leads = rows.reduce((sum, row) => sum + (row.leads ?? 0), 0);
    const bySpend = [...rows]
      .filter((row) => (row.spendGtq ?? 0) > 0)
      .sort((a, b) => (b.spendGtq ?? 0) - (a.spendGtq ?? 0))
      .slice(0, 8)
      .map((row) => ({
        campaign: row.campaign,
        short: clip(row.campaign),
        spendGtq: row.spendGtq ?? 0,
        leads: row.leads ?? 0,
        cpl: row.cpl,
        tone: (row.leads ?? 0) <= 0 ? "sin-leads" as const : mid != null && row.cpl != null && row.cpl > mid ? "caro" as const : "en-linea" as const,
      }));
    const byReservas = [...rows]
      .filter((row) => row.reservas.units > 0)
      .sort((a, b) => b.reservas.units - a.reservas.units)
      .slice(0, 8)
      .map((row) => ({ campaign: row.campaign, short: clip(row.campaign), units: row.reservas.units }));
    const byCierre = rows
      .flatMap((row) => {
        const spend = row.spendGtq ?? 0;
        if (row.ventas.units <= 0 || spend <= 0) return [];
        return [{ campaign: row.campaign, short: clip(row.campaign), costo: spend / row.ventas.units, ventas: row.ventas.units }];
      })
      .sort((a, b) => b.costo - a.costo)
      .slice(0, 8);
    const puertaSpend = grouped.puerta.reduce((sum, row) => sum + (row.spendGtq ?? 0), 0);
    const puertaLeads = grouped.puerta.reduce((sum, row) => sum + (row.leads ?? 0), 0);
    return {
      ...base,
      section,
      question: "¿Qué campañas compran reservas y cuáles solo gastan?",
      caption: "Costo por lead de Meta en el corte. Ámbar es más caro que la mediana. Rojo es gasto sin leads. Puerta Abierta no se mezcla con los proyectos.",
      spendGtq,
      leads,
      medianCpl: mid,
      withSales: rows.filter((row) => row.ventas.units > 0).length,
      bySpend,
      byReservas,
      byCierre,
      rest: Math.max(0, rows.length - bySpend.length),
      puerta: grouped.puerta.length > 0 ? { spendGtq: puertaSpend, leads: puertaLeads } : null,
      detail: [...detailOf(rows, "proyecto"), ...detailOf(grouped.puerta, "puerta")],
    };
  }

  if (section === "costo-por-lead") {
    const series = report.cpl.filter((item) => !item.dashed);
    const drawn = series.length > 0 ? series : report.cpl;
    const last = drawn[0]?.points.length ? drawn[0].points.length - 1 : -1;
    const blend = (index: number): number | null => {
      if (index < 0) return null;
      let leads = 0;
      let spend = 0;
      for (const item of drawn) {
        const point = item.points[index];
        if (!point) continue;
        leads += point.leads;
        spend += point.spendGtq;
      }
      return leads > 0 ? spend / leads : null;
    };
    const latest = last >= 0 ? drawn[0]?.points[last] : undefined;
    const previous = last > 0 ? drawn[0]?.points[last - 1] : undefined;
    return {
      ...base,
      section,
      question: "¿El costo por lead de cada proyecto está subiendo?",
      caption: report.cplCaption,
      series: report.cpl,
      latestCpl: blend(last),
      previousCpl: blend(last - 1),
      latestLabel: latest?.label ?? report.periodLabel,
      previousLabel: previous?.label ?? null,
      monthRows: drawn.map((item) => {
        const point = last >= 0 ? item.points[last] : undefined;
        return {
          slug: item.slug,
          label: item.label,
          leads: point?.leads ?? 0,
          spendGtq: point?.spendGtq ?? 0,
          cpl: point?.cpl ?? null,
        };
      }),
    };
  }

  if (section === "inversion-acumulada") {
    const targets = await readTargetEvents(monthStart(bounds.adFrom), monthStart(range.to));
    const latest = new Map<string, number>();
    for (const event of targets.events) latest.set(`${event.centerId}|${event.month}`, event.amount);
    let cumulative = 0;
    let cumulativePlan = 0;
    let anyPlan = false;
    const months = monthsOf(bounds.adFrom, range.to).map((month) => {
      const slice = sliceMonth(month, range.to);
      const window: DateWindow = { from: slice.from, to: slice.to, label: monthName(month) };
      const pautaGtq = storePauta(store, window, ids);
      cumulative += pautaGtq;
      let monthPlan = 0;
      let monthAny = false;
      for (const center of active) {
        const plan = planOf(store, latest, center.id, month);
        if (plan == null) continue;
        monthAny = true;
        const portion = slice.partial ? plan * (inclusiveDays(slice.from, slice.to) / daysInMonth(month)) : plan;
        monthPlan += portion;
      }
      if (monthAny) {
        anyPlan = true;
        cumulativePlan += monthPlan;
      }
      return {
        month,
        label: monthName(month),
        pautaGtq,
        cumulativeGtq: cumulative,
        cumulativePlanGtq: anyPlan ? cumulativePlan : null,
      };
    });
    const gaps = active.map((center) => {
      let actualGtq = 0;
      let planGtq = 0;
      let any = false;
      for (const month of monthsOf(bounds.adFrom, range.to)) {
        const slice = sliceMonth(month, range.to);
        actualGtq += storePauta(store, { from: slice.from, to: slice.to, label: month }, new Set([center.id]));
        const plan = planOf(store, latest, center.id, month);
        if (plan == null) continue;
        any = true;
        planGtq += slice.partial ? plan * (inclusiveDays(slice.from, slice.to) / daysInMonth(month)) : plan;
      }
      return { slug: center.slug, label: center.name, actualGtq, planGtq: any ? planGtq : null };
    }).sort((a, b) => (b.actualGtq - (b.planGtq ?? b.actualGtq)) - (a.actualGtq - (a.planGtq ?? a.actualGtq)));
    const last = months[months.length - 1];
    return {
      ...base,
      section,
      question: "¿La pauta acumulada va por delante del presupuesto?",
      caption: "Desde enero hasta el fin del corte. En el mes abierto el presupuesto va repartido a los días corridos. Puerta Abierta no entra en el total de los proyectos.",
      cumulativeGtq: last?.cumulativeGtq ?? 0,
      planGtq: last?.cumulativePlanGtq ?? null,
      months,
      gaps,
      monthLines: months.map((month) => ({
        month: month.month,
        label: month.label,
        lines: storeMonthLines(store, month.month, range.to, ids),
      })),
    };
  }

  if (section === "canales") {
    const channels = storeChannels(store, range, ids);
    const activeCount = channels.filter((channel) => (channel.spendGtq ?? 0) > 0).length;
    return {
      ...base,
      section,
      question: "¿Qué canal estuvo encendido y cuál no ejecutó?",
      caption: "Meta y Google salen del gasto diario. TikTok, LinkedIn, Pauta digital y Wati salen del real del mes. Sin ejecución no es un cero.",
      active: activeCount,
      measured: channels.length,
      days: eachDay(range.from, range.to).length,
      channels,
    };
  }

  const days = eachDay(range.from, range.to);
  let running = 0;
  let pace = 0;
  const targets = await readTargetEvents(monthStart(range.from), monthStart(range.to));
  const latest = new Map<string, number>();
  for (const event of targets.events) latest.set(`${event.centerId}|${event.month}`, event.amount);
  const monthTarget = new Map<string, number | null>();
  for (const month of monthsOf(range.from, range.to)) {
    let total = 0;
    let any = false;
    for (const center of active) {
      const plan = planOf(store, latest, center.id, month);
      if (plan == null) continue;
      any = true;
      total += plan;
    }
    monthTarget.set(month, any ? total : null);
  }
  const daily = days.map((day) => {
    running += storeDaySpend(store, ids, day);
    const plan = monthTarget.get(monthStart(day));
    if (plan != null) pace += plan / daysInMonth(monthStart(day));
    return {
      day,
      label: day.slice(5),
      actualGtq: running,
      paceGtq: plan != null || pace > 0 ? pace : null,
    };
  });
  return {
    ...base,
    section: "gestion-de-pauta",
    question: "¿El ritmo de gasto cabe en el presupuesto que queda?",
    caption: report.partial
      ? "La línea punteada es el presupuesto repartido en los días del mes. El mes sigue abierto."
      : "Mes cerrado. La línea punteada es el presupuesto del mes repartido por día.",
    actualGtq: report.budgetHeadline.actualGtq,
    targetGtq: report.budgetHeadline.targetGtq,
    paceGtq: report.budgetHeadline.paceGtq,
    paceRatio: report.budgetHeadline.paceRatio,
    status: report.budgetHeadline.status,
    scope: report.budgetHeadline.scope,
    partial: report.partial,
    rows: report.budget,
    puerta: report.puertaBudget,
    daily,
    editor: {
      months: report.months,
      targets: report.targets,
      targetHistory: report.targetHistory,
      targetTableReady: report.targetTableReady,
    },
  };
}

function detailOf(
  rows: CampaignRow[],
  scope: "proyecto" | "puerta",
): { campaign: string; spendGtq: number | null; leads: number | null; cpl: number | null; reservas: number; ventas: number; scope: "proyecto" | "puerta" }[] {
  const seen = new Set<string>();
  const detail: { campaign: string; spendGtq: number | null; leads: number | null; cpl: number | null; reservas: number; ventas: number; scope: "proyecto" | "puerta" }[] = [];
  for (const row of rows) {
    if (seen.has(row.campaign)) continue;
    seen.add(row.campaign);
    detail.push({
      campaign: row.campaign,
      spendGtq: row.spendGtq,
      leads: row.leads,
      cpl: row.cpl,
      reservas: row.reservas.units,
      ventas: row.ventas.units,
      scope,
    });
  }
  return detail;
}
