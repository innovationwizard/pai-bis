import { createAdminClient } from "@/lib/supabase/admin";
import {
  inclusiveDays,
  monthEnd,
  monthStart,
  resolveRange,
  type DateWindow,
  type PeriodPreset,
} from "@/lib/ventas/period";
import {
  loadMercadeoStore,
  storeMetaLeads,
  storeMetaSpend,
  storeMonthPlan,
  storePauta,
  storePair,
  type MercadeoBounds,
  type MercadeoStore,
} from "./report";
import type {
  BudgetRow,
  BudgetSource,
  BudgetStatus,
  CierreRow,
  CplSeries,
  FuenteBar,
  FuenteProject,
  OperativoReport,
  TargetCell,
  TargetEvent,
} from "./operativo-types";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export type OperativoFilters = {
  preset: PeriodPreset;
  customFrom: string | null;
  customTo: string | null;
  slugs: string[] | null;
};

type Entered = { amount: number; at: string };

function monthLabel(month: string, long = false): string {
  const index = Number(month.slice(5, 7)) - 1;
  const names = long ? MONTHS_LONG : MONTHS;
  return `${names[index] ?? month} ${month.slice(0, 4)}`;
}

function daysInMonth(month: string): number {
  return Number(monthEnd(month).slice(8, 10));
}

function nextMonth(month: string): string {
  return monthStart(addDay(monthEnd(month)));
}

function addDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function monthsTouched(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = monthStart(from);
  const end = monthStart(to);
  while (cursor <= end) {
    months.push(cursor);
    cursor = nextMonth(cursor);
  }
  return months;
}

function evolutionMonths(range: DateWindow): string[] {
  const end = monthStart(range.to);
  let cursor = `${range.from.slice(0, 4)}-01-01`;
  const months: string[] = [];
  while (cursor <= end) {
    months.push(cursor);
    cursor = nextMonth(cursor);
  }
  return months.slice(-12);
}

function windowForMonth(month: string, range: DateWindow): DateWindow {
  const end = monthEnd(month);
  const to = end > range.to ? range.to : end;
  return { from: month, to, label: monthLabel(month) };
}

export function parseOperativoFilters(url: URL): OperativoFilters {
  const preset = url.searchParams.get("periodo");
  const allowed: PeriodPreset[] = ["este-mes", "mes-anterior", "este-trimestre", "este-ano", "custom"];
  const slugs = url.searchParams.getAll("proyecto");
  return {
    preset: allowed.includes(preset as PeriodPreset) ? (preset as PeriodPreset) : "este-mes",
    customFrom: url.searchParams.get("desde"),
    customTo: url.searchParams.get("hasta"),
    slugs: slugs.length === 0 ? null : slugs.includes("ninguno") ? [] : slugs,
  };
}

function missingTargetTable(message: string): boolean {
  return /pauta_target|PGRST204|PGRST205|schema cache|does not exist|42P01/i.test(message);
}

export type TargetRead = {
  ready: boolean;
  events: { centerId: string; month: string; amount: number; at: string }[];
};

const targetCache = new Map<string, { at: number; value: TargetRead }>();

export function clearTargetCache(): void {
  targetCache.clear();
}

export function operativoBounds(filters: OperativoFilters): MercadeoBounds & { range: DateWindow } {
  const range = resolveRange(filters.preset, filters.customFrom, filters.customTo);
  const evo = evolutionMonths(range);
  return {
    range,
    adFrom: evo[0] ?? range.from,
    adTo: range.to,
    dealFrom: range.from,
    dealTo: range.to,
  };
}

export async function readTargetEvents(fromMonth: string, toMonth: string): Promise<TargetRead> {
  const key = `${fromMonth}|${toMonth}`;
  const hit = targetCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const db = createAdminClient().schema("mercadeo");
  const counted = await db
    .from("pauta_target")
    .select("id", { count: "exact", head: true })
    .gte("month_start", fromMonth)
    .lte("month_start", toMonth);
  if (counted.error) {
    if (missingTargetTable(counted.error.message)) return { ready: false, events: [] };
    throw new Error(counted.error.message);
  }
  const total = counted.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / 1000));
  const batches = total === 0
    ? []
    : await Promise.all(Array.from({ length: pages }, (_, index) => {
      const from = index * 1000;
      return db
        .from("pauta_target")
        .select("cost_center_id,month_start,amount_gtq,created_at")
        .gte("month_start", fromMonth)
        .lte("month_start", toMonth)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + 999);
    }));
  const events: TargetRead["events"] = [];
  for (const batch of batches) {
    if (batch.error) {
      if (missingTargetTable(batch.error.message)) return { ready: false, events: [] };
      throw new Error(batch.error.message);
    }
    for (const row of batch.data ?? []) {
      const amount = Number(row.amount_gtq);
      events.push({
        centerId: String(row.cost_center_id),
        month: String(row.month_start).slice(0, 10),
        amount: Number.isFinite(amount) ? amount : 0,
        at: String(row.created_at),
      });
    }
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  const value = { ready: true, events };
  targetCache.set(key, { at: Date.now(), value });
  return value;
}

function latestEntered(events: { centerId: string; month: string; amount: number; at: string }[]): Map<string, Entered> {
  const map = new Map<string, Entered>();
  for (const event of events) {
    map.set(`${event.centerId}|${event.month}`, { amount: event.amount, at: event.at });
  }
  return map;
}

function budgetStatus(actual: number, target: number | null, partial: boolean, paceRatio: number | null): BudgetStatus {
  if (target == null || target <= 0) return "sin-presupuesto";
  if (actual >= target) return "agotado";
  if (partial && paceRatio != null && paceRatio > 1) return "sobre-ritmo";
  if (partial) return "en-ritmo";
  return "bajo-presupuesto";
}

function budgetFor(
  store: MercadeoStore,
  range: DateWindow,
  center: MercadeoStore["centers"][number],
  latest: Map<string, Entered>,
  partial: boolean,
): BudgetRow {
  const ids = new Set([center.id]);
  const actual = storePauta(store, range, ids);
  let target = 0;
  let pace = 0;
  let any = false;
  let entered = false;
  let loaded = false;
  for (const month of monthsTouched(range.from, range.to)) {
    const saved = latest.get(`${center.id}|${month}`);
    const workbook = storeMonthPlan(store, ids, month);
    const monthTarget = saved ? saved.amount : workbook > 0 ? workbook : null;
    if (monthTarget == null) continue;
    any = true;
    if (saved) entered = true;
    else loaded = true;
    target += monthTarget;
    const from = month < range.from ? range.from : month;
    const end = monthEnd(month);
    const to = end > range.to ? range.to : end;
    pace += monthTarget * (inclusiveDays(from, to) / daysInMonth(month));
  }
  const targetGtq = any ? target : null;
  const paceGtq = any ? pace : null;
  const ratio = targetGtq != null && targetGtq > 0 ? actual / targetGtq : null;
  const paceRatio = paceGtq != null && paceGtq > 0 ? actual / paceGtq : null;
  const source: BudgetSource = !any ? "sin-presupuesto" : entered && loaded ? "mixto" : entered ? "ingresado" : "cargado";
  return {
    slug: center.slug,
    label: center.name,
    building: center.building,
    actualGtq: actual,
    targetGtq,
    paceGtq,
    ratio,
    paceRatio,
    source,
    status: budgetStatus(actual, targetGtq, partial, paceRatio),
  };
}

function sumBudget(rows: BudgetRow[], partial: boolean, scope: string): OperativoReport["budgetHeadline"] {
  const actualGtq = rows.reduce((sum, row) => sum + row.actualGtq, 0);
  const withTarget = rows.filter((row) => row.targetGtq != null);
  const targetGtq = withTarget.length > 0 ? withTarget.reduce((sum, row) => sum + (row.targetGtq ?? 0), 0) : null;
  const paceGtq = withTarget.length > 0 ? withTarget.reduce((sum, row) => sum + (row.paceGtq ?? 0), 0) : null;
  const ratio = targetGtq != null && targetGtq > 0 ? actualGtq / targetGtq : null;
  const paceRatio = paceGtq != null && paceGtq > 0 ? actualGtq / paceGtq : null;
  return {
    actualGtq,
    targetGtq,
    paceGtq,
    ratio,
    paceRatio,
    status: budgetStatus(actualGtq, targetGtq, partial, paceRatio),
    scope,
  };
}

function fuenteBars(projects: FuenteProject[]): FuenteBar[] {
  const totals = new Map<string, FuenteBar>();
  for (const row of projects) {
    const current = totals.get(row.fuente) ?? { label: row.fuente, units: 0, gtq: null, sinMonto: 0, folded: [] };
    current.units += row.units;
    current.sinMonto += row.sinMonto;
    if (row.gtq != null) current.gtq = (current.gtq ?? 0) + row.gtq;
    totals.set(row.fuente, current);
  }
  const sinDato = totals.get("Sin dato") ?? null;
  totals.delete("Sin dato");
  const named = [...totals.values()].sort((a, b) => b.units - a.units || a.label.localeCompare(b.label, "es"));
  const head = named.slice(0, 7);
  const rest = named.slice(7);
  if (rest.length > 0) {
    head.push({
      label: "Otras fuentes",
      units: rest.reduce((sum, row) => sum + row.units, 0),
      gtq: rest.some((row) => row.gtq != null) ? rest.reduce((sum, row) => sum + (row.gtq ?? 0), 0) : null,
      sinMonto: rest.reduce((sum, row) => sum + row.sinMonto, 0),
      folded: rest.map((row) => row.label),
    });
  }
  if (sinDato && sinDato.units > 0) head.push(sinDato);
  return head.sort((a, b) => b.units - a.units || a.label.localeCompare(b.label, "es"));
}

export async function buildOperativo(filters: OperativoFilters): Promise<OperativoReport> {
  const bounds = operativoBounds(filters);
  let targetError: unknown = null;
  const targetsPromise = readTargetEvents(monthStart(bounds.adFrom), monthStart(bounds.range.to)).catch((error: unknown) => {
    targetError = error;
    return { ready: false, events: [] };
  });
  const store = await loadMercadeoStore(bounds);
  const range = bounds.range;
  const selected = filters.slugs;
  const centers = store.centers.filter((center) => selected === null || selected.includes(center.slug));
  const buildings = centers.filter((center) => center.building);
  const puerta = centers.find((center) => !center.building) ?? null;
  const partial = monthsTouched(range.from, range.to).some((month) => month < range.from || monthEnd(month) > range.to);
  const targets = await targetsPromise;
  if (targetError) throw targetError;
  const latest = latestEntered(targets.events);
  const buildingRows = buildings
    .map((center) => budgetFor(store, range, center, latest, partial))
    .sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1) || a.label.localeCompare(b.label, "es"));
  const puertaBudget = puerta ? budgetFor(store, range, puerta, latest, partial) : null;
  const headlineRows = buildings.length > 0 ? buildingRows : puertaBudget ? [puertaBudget] : [];
  const scope = buildings.length > 0 ? "Proyectos" : puerta ? "Puerta Abierta" : "Sin proyecto";

  const lineCenters = [...buildings, ...(puerta ? [puerta] : [])];
  const evo = evolutionMonths(range);
  const cpl: CplSeries[] = lineCenters.map((center) => ({
    slug: center.slug,
    label: center.name,
    dashed: !center.building,
    points: evo.map((month) => {
      const slice = windowForMonth(month, range);
      const ids = new Set([center.id]);
      const leads = storeMetaLeads(store, slice, ids);
      const spendGtq = storeMetaSpend(store, slice, ids);
      return {
        month,
        label: monthLabel(month),
        cpl: leads > 0 ? spendGtq / leads : null,
        leads,
        spendGtq,
      };
    }),
  }));

  const buildingSlugs = new Set((buildings.length > 0 ? buildings : []).map((center) => center.slug));
  const fuenteProjects: FuenteProject[] = [];
  const byKey = new Map<string, FuenteProject>();
  if (buildingSlugs.size > 0) {
    for (const [dealId, days] of store.reservaDays) {
      if (!days.some((day) => day >= range.from && day <= range.to)) continue;
      const deal = store.deals.get(dealId);
      if (!deal?.slug || !buildingSlugs.has(deal.slug)) continue;
      const fuente = deal.fuente || "Sin dato";
      const key = `${fuente}|${deal.slug}`;
      const current = byKey.get(key) ?? {
        fuente,
        slug: deal.slug,
        project: buildings.find((center) => center.slug === deal.slug)?.name ?? deal.slug,
        units: 0,
        gtq: null,
        sinMonto: 0,
      };
      current.units += 1;
      if (deal.value == null) current.sinMonto += 1;
      else current.gtq = (current.gtq ?? 0) + deal.value;
      byKey.set(key, current);
    }
  }
  fuenteProjects.push(...byKey.values());
  const fuentes = fuenteBars(fuenteProjects);
  const reservaUnits = fuenteProjects.reduce((sum, row) => sum + row.units, 0);

  const cierreCenters = buildings.length > 0 ? buildings : puerta ? [puerta] : [];
  const cierre: CierreRow[] = cierreCenters
    .map((center) => {
      const ventas = storePair(store, range, new Set([center.slug]), "venta");
      const pautaGtq = storePauta(store, range, new Set([center.id]));
      return {
        slug: center.slug,
        label: center.name,
        building: center.building,
        ventas: ventas.units,
        pautaGtq,
        costo: ventas.units > 0 && pautaGtq > 0 ? pautaGtq / ventas.units : null,
      };
    })
    .sort((a, b) => (b.costo ?? -1) - (a.costo ?? -1) || a.label.localeCompare(b.label, "es"));
  const cierreBuildings = cierre.filter((row) => row.building);
  const cierreScopeRows = cierreBuildings.length > 0 ? cierreBuildings : cierre;
  const cierreVentas = cierreScopeRows.reduce((sum, row) => sum + row.ventas, 0);
  const cierrePauta = cierreScopeRows.reduce((sum, row) => sum + row.pautaGtq, 0);

  const cutMonths = monthsTouched(range.from, range.to);
  const nameOf = new Map(store.centers.map((center) => [center.id, center]));
  const cells: TargetCell[] = [];
  for (const month of cutMonths) {
    for (const center of store.centers) {
      const saved = latest.get(`${center.id}|${month}`);
      const workbook = storeMonthPlan(store, new Set([center.id]), month);
      cells.push({
        slug: center.slug,
        label: center.name,
        month,
        loadedGtq: workbook > 0 ? workbook : null,
        enteredGtq: saved?.amount ?? null,
        enteredAt: saved?.at ?? null,
      });
    }
  }
  const history: TargetEvent[] = targets.events
    .filter((event) => cutMonths.includes(event.month))
    .map((event) => ({
      slug: nameOf.get(event.centerId)?.slug ?? event.centerId,
      label: nameOf.get(event.centerId)?.name ?? event.centerId,
      month: event.month,
      amountGtq: event.amount,
      enteredAt: event.at,
    }))
    .reverse();

  const leadCenters = buildings.length > 0 ? buildings : puerta ? [puerta] : [];
  const leadIds = new Set(leadCenters.map((center) => center.id));
  let leadMin = 0;
  let leadMax = 0;
  let anyBand = false;
  for (const center of leadCenters) {
    const band = store.ranges.get(center.id);
    if (band?.min == null || band.max == null) continue;
    anyBand = true;
    leadMin += band.min;
    leadMax += band.max;
  }
  const leadMonths = monthsTouched(range.from, range.to).length;
  const leadCount = storeMetaLeads(store, range, leadIds);
  const leadSpend = storeMetaSpend(store, range, leadIds);
  const last = evo[evo.length - 1];
  return {
    periodLabel: range.label,
    rangeLabel: `${range.from} – ${range.to}`,
    partial,
    cplCaption: last
      ? `Costo por lead de Meta, de enero a ${monthLabel(last, true)}. El último mes llega hasta el fin del periodo. Un mes sin leads no se dibuja en cero.`
      : "Costo por lead de Meta.",
    notice: centers.length === 0 ? "Ningún proyecto está seleccionado." : store.notice,
    targetTableReady: targets.ready,
    months: cutMonths.map((month) => ({ month, label: monthLabel(month, true) })),
    projects: store.centers.map((center) => ({ slug: center.slug, label: center.name, building: center.building })),
    budget: buildingRows,
    budgetHeadline: sumBudget(headlineRows, partial, scope),
    puertaBudget: buildings.length > 0 ? puertaBudget : null,
    cpl,
    fuentes,
    fuenteProjects,
    reservaUnits,
    cierre,
    cierreHeadline: {
      costo: cierreVentas > 0 && cierrePauta > 0 ? cierrePauta / cierreVentas : null,
      ventas: cierreVentas,
      pautaGtq: cierrePauta,
      scope,
    },
    leadHeadline: {
      leads: leadCount,
      cpl: leadCount > 0 ? leadSpend / leadCount : null,
      min: anyBand ? leadMin * leadMonths : null,
      max: anyBand ? leadMax * leadMonths : null,
    },
    ranges: store.centers.map((center) => {
      const band = store.ranges.get(center.id);
      return { slug: center.slug, label: center.name, min: band?.min ?? null, max: band?.max ?? null };
    }),
    targets: cells,
    targetHistory: history,
  };
}
