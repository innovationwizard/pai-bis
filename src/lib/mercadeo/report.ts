import { createAdminClient } from "@/lib/supabase/admin";
import {
  previousWindows,
  resolveRange,
  yearAgoWindow,
  type DateWindow,
  type PeriodPreset,
} from "@/lib/ventas/period";

const FX = 7.8;
const EXCLUDED = "cons_guat__kpa_LeadsWebsiteBoulevard_fb_lds_cpa_11noval20nov";
const LINES = ["meta", "google", "tiktok", "linkedin", "pauta_digital", "wati"] as const;
const WORKBOOK_LINES = ["tiktok", "linkedin", "pauta_digital", "wati"] as const;
const PROJECT_SLUG: Record<string, string> = {
  Benestare: "benestare",
  "Bosque Las Tapias": "bosque-las-tapias",
  "Boulevard 5": "boulevard-5",
  "Santa Elena": "santa-elena",
  "Casa Elisa": "casa-elisa",
};

const FORMULAS = [
  "ROAS = valor de las ventas del periodo ÷ pauta del periodo.",
  "ROI = (valor de las ventas − pauta) ÷ pauta.",
  "Costo por cierre = pauta ÷ cantidad de ventas.",
  "La pauta suma Meta y Google en los días del periodo. TikTok, LinkedIn, Pauta Digital y Wati entran solo cuando el periodo cubre el mes completo. Un real vacío es sin ejecución.",
  "El uso diario compara Meta y Google de cada día con el presupuesto de las seis líneas repartido entre los días del mes.",
  "Una reserva es un trato con actividad Reserva hecha, contado una vez. Una venta es una venta de las dos puertas. Las dos van en unidades y en quetzales del valor del trato.",
];

export type Pair = { units: number; gtq: number | null; sinMonto: number };
export type Tile = { label: string; value: string; detail: string };
export type CampaignRow = {
  campaign: string;
  spendGtq: number | null;
  leads: number | null;
  reach: number | null;
  impressions: number | null;
  cpl: number | null;
  reservas: Pair;
  ventas: Pair;
};
export type MonthPoint = {
  month: string;
  label: string;
  leads: number;
  cpl: number | null;
  metaSpendGtq: number;
  pautaGtq: number;
  cumulativeGtq: number;
  planGtq: number | null;
  note: string | null;
};
export type ProjectRow = {
  label: string;
  leads: number;
  pautaGtq: number;
  roas: number | null;
  reservas: Pair;
  ventas: Pair;
};
export type FuenteRow = { label: string; reservas: Pair; ventas: Pair };
export type PlatformCost = { label: string; ventas: Pair; costo: number | null; detail: string };
export type RangeRow = { slug: string; label: string; min: number | null; max: number | null };
export type Insight = { tone: "info" | "good" | "warn" | "bad"; text: string };
export type CenterChoice = { slug: string; label: string };

export type MercadeoReport = {
  section: string;
  periodLabel: string;
  rangeLabel: string;
  caption: string;
  formulas: string[];
  insights: Insight[];
  tiles: Tile[];
  projects: CenterChoice[];
  byProject: ProjectRow[];
  puertaAbierta: ProjectRow | null;
  campaigns: CampaignRow[];
  puertaCampaigns: CampaignRow[];
  months: MonthPoint[];
  fuentes: FuenteRow[];
  platforms: PlatformCost[];
  ranges: RangeRow[];
  comparisons: { label: string; tiles: Tile[] }[];
  notice: string | null;
};

type Filters = {
  section: string;
  preset: PeriodPreset;
  customFrom: string | null;
  customTo: string | null;
  compareN: boolean;
  n: number;
  compareYear: boolean;
  slugs: string[] | null;
};

type Center = { id: string; slug: string; name: string; building: boolean; sort: number };
type Ad = {
  centerId: string;
  platform: string;
  campaign: string;
  day: string;
  currency: string;
  spend: number;
  impressions: number;
  reach: number;
  leads: number;
  forms: number;
};
type Budget = { centerId: string; line: string; month: string; plan: number | null; real: number | null };
type Range = { min: number | null; max: number | null };
type DealInfo = { pipedriveId: string; slug: string | null; value: number | null; fuente: string };
type Attr = { meta: string | null; tiktok: string | null };

const moneyFormat = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 });
const numberFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 });
const MONTH_LABEL = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function amount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyPair(): Pair {
  return { units: 0, gtq: null, sinMonto: 0 };
}

function addPair(pair: Pair, value: number | null): Pair {
  if (value == null) return { units: pair.units + 1, gtq: pair.gtq, sinMonto: pair.sinMonto + 1 };
  return { units: pair.units + 1, gtq: (pair.gtq ?? 0) + value, sinMonto: pair.sinMonto };
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthEnd(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

function daysInMonth(monthStart: string): number {
  return Number(monthEnd(monthStart).slice(8, 10));
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) days.push(cursor);
  return days;
}

function monthsTouched(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = `${from.slice(0, 7)}-01`;
  const end = `${to.slice(0, 7)}-01`;
  while (cursor <= end) {
    months.push(cursor);
    cursor = addDays(monthEnd(cursor), 1);
  }
  return months;
}

function monthLabel(monthStart: string): string {
  const month = Number(monthStart.slice(5, 7));
  return `${MONTH_LABEL[month - 1]} ${monthStart.slice(0, 4)}`;
}

function gtq(value: number | null): string {
  if (value == null) return "sin monto";
  return moneyFormat.format(value);
}

function num(value: number | null): string {
  if (value == null) return "—";
  return numberFormat.format(value);
}

function percent(part: number, whole: number): string {
  if (whole <= 0) return "sin presupuesto";
  return `${numberFormat.format((part / whole) * 100)}%`;
}

function pairText(pair: Pair): string {
  const monto = pair.sinMonto > 0 && pair.gtq == null ? "sin monto" : gtq(pair.gtq);
  return `${num(pair.units)} · ${monto}`;
}

function toGtq(row: Ad): number {
  return row.currency === "USD" ? row.spend * FX : row.spend;
}

type Db = ReturnType<ReturnType<typeof createAdminClient>["schema"]>;
type Row = Record<string, unknown>;

const PAGE = 1000;
const MAX_WINDOW_ROWS = 12000;
const STORE_TTL_MS = 60_000;

export type MercadeoBounds = {
  adFrom: string;
  adTo: string;
  dealFrom: string;
  dealTo: string;
};

const storeCache = new Map<string, { at: number; store: Loaded }>();

export function clearMercadeoCache(): void {
  storeCache.clear();
}

function asRows(data: unknown): Row[] {
  return (data ?? []) as Row[];
}

async function fetchSmall(db: Db, table: string, select: string): Promise<Row[]> {
  const { data, error } = await db.from(table).select(select).limit(PAGE);
  if (error) throw new Error(error.message);
  return asRows(data);
}

async function fetchFiltered(
  count: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
  page: (from: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Row[]> {
  const counted = await count();
  if (counted.error) throw new Error(counted.error.message);
  if (counted.count == null) throw new Error("No se pudo contar el periodo de Mercadeo.");
  if (counted.count > MAX_WINDOW_ROWS) {
    throw new Error("Ese periodo es demasiado ancho para la vista principal. Elige uno más corto.");
  }
  if (counted.count === 0) return [];
  const pages = Math.ceil(counted.count / PAGE);
  const batches = await Promise.all(Array.from({ length: pages }, (_, index) => page(index * PAGE)));
  const rows: Row[] = [];
  for (const batch of batches) {
    if (batch.error) throw new Error(batch.error.message);
    rows.push(...asRows(batch.data));
  }
  return rows;
}

async function fetchByIds(db: Db, table: string, column: string, ids: string[], select: string): Promise<Row[]> {
  const unique = [...new Set(ids)].filter((id) => id.length > 0);
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += 80) chunks.push(unique.slice(index, index + 80));
  const batches = await Promise.all(chunks.map(async (chunk) => {
    const { data, error } = await db.from(table).select(select).in(column, chunk);
    if (error) throw new Error(error.message);
    return asRows(data);
  }));
  return batches.flat();
}

export function parseFilters(url: URL): Filters {
  const preset = url.searchParams.get("periodo");
  const allowed: PeriodPreset[] = ["este-mes", "mes-anterior", "este-trimestre", "este-ano", "custom"];
  const slugs = url.searchParams.getAll("proyecto");
  return {
    section: url.searchParams.get("section") ?? "reporte-maestro",
    preset: allowed.includes(preset as PeriodPreset) ? (preset as PeriodPreset) : "este-mes",
    customFrom: url.searchParams.get("desde"),
    customTo: url.searchParams.get("hasta"),
    compareN: url.searchParams.get("comparar") === "1",
    n: Number(url.searchParams.get("n") ?? "1"),
    compareYear: url.searchParams.get("anio") === "1",
    slugs: slugs.length === 0 ? null : slugs.includes("ninguno") ? [] : slugs,
  };
}

type Loaded = {
  centers: Center[];
  ranges: Map<string, Range>;
  ads: Ad[];
  budgets: Budget[];
  budgetKey: Map<string, Budget>;
  deals: Map<string, DealInfo>;
  attrs: Map<string, Attr>;
  reservaDays: Map<string, string[]>;
  sales: { dealId: string; saleOn: string | null }[];
  notice: string | null;
};

function campaignOf(attr: Attr | undefined): string {
  if (attr?.meta) return attr.meta;
  if (attr?.tiktok) return attr.tiktok;
  return "Sin campaña";
}

export async function buildReport(filters: Filters): Promise<MercadeoReport> {
  const range = resolveRange(filters.preset, filters.customFrom, filters.customTo);
  const windows = [range];
  if (filters.compareN) windows.push(...previousWindows(range, Math.min(12, Math.max(1, filters.n))));
  if (filters.compareYear) windows.push(yearAgoWindow(range));
  let from = range.from;
  let to = range.to;
  for (const window of windows) {
    if (window.from < from) from = window.from;
    if (window.to > to) to = window.to;
  }
  const loaded = await loadMercadeoStore({ adFrom: from, adTo: to, dealFrom: from, dealTo: to });

  const selected = filters.slugs;
  const centers = loaded.centers.filter((center) => selected === null || selected.includes(center.slug));
  const buildings = centers.filter((center) => center.building);
  const puerta = centers.find((center) => !center.building) ?? null;
  const active = buildings.length > 0 ? buildings : puerta ? [puerta] : [];
  const measured = measure(loaded, range, active);

  return {
    section: filters.section,
    periodLabel: range.label,
    rangeLabel: `${range.from} – ${range.to}`,
    caption: "La meta de leads y el presupuesto mensual son del mes completo. Meta y Google corren hasta el fin del periodo.",
    formulas: FORMULAS,
    insights: insights(measured),
    tiles: tiles(measured),
    projects: loaded.centers.map((center) => ({ slug: center.slug, label: center.name })),
    byProject: buildings.length > 1 ? buildings.map((center) => projectRow(loaded, range, center)) : [],
    puertaAbierta: puerta && buildings.length > 0 ? projectRow(loaded, range, puerta) : null,
    campaigns: campaignRows(loaded, range, buildings),
    puertaCampaigns: puerta ? campaignRows(loaded, range, [puerta]) : [],
    months: monthPoints(loaded, range, active),
    fuentes: fuenteRows(loaded, range, buildings),
    platforms: platformRows(loaded, range, buildings.length > 0 ? buildings : active),
    ranges: loaded.centers.map((center) => {
      const band = loaded.ranges.get(center.id);
      return { slug: center.slug, label: center.name, min: band?.min ?? null, max: band?.max ?? null };
    }),
    comparisons: windows.slice(1).map((window) => ({
      label: window.label,
      tiles: tiles(measure(loaded, window, active)),
    })),
    notice: active.length === 0 ? "Ningún proyecto está seleccionado." : loaded.notice,
  };
}

async function load(mercadeo: Db, ventas: Db, bounds: MercadeoBounds): Promise<Loaded> {
  if (bounds.adFrom > bounds.adTo || bounds.dealFrom > bounds.dealTo) {
    throw new Error("El periodo no tiene días.");
  }
  const adMonthFrom = `${bounds.adFrom.slice(0, 7)}-01`;
  const adMonthTo = `${bounds.adTo.slice(0, 7)}-01`;
  let centerRows: Row[];
  let rangeRows: Row[];
  let adRows: Row[];
  let budgetRows: Row[];
  let projectRows: Row[];
  let fuenteRowsRaw: Row[];
  let comprobanteRows: Row[];
  let saleRows: Row[];
  try {
    [centerRows, rangeRows, adRows, budgetRows, projectRows, fuenteRowsRaw, comprobanteRows, saleRows] = await Promise.all([
      fetchSmall(mercadeo, "cost_center", "id,slug,name,is_building,sort_order"),
      fetchSmall(mercadeo, "lead_range", "cost_center_id,min_leads,max_leads"),
      fetchFiltered(
        () => mercadeo.from("ad_day").select("id", { count: "exact", head: true }).gte("day", bounds.adFrom).lte("day", bounds.adTo),
        (from) => mercadeo.from("ad_day").select("cost_center_id,platform,campaign_name,day,currency,spend,impressions,reach,leads,lead_forms").gte("day", bounds.adFrom).lte("day", bounds.adTo).order("id").range(from, from + PAGE - 1),
      ),
      fetchFiltered(
        () => mercadeo.from("budget_month").select("id", { count: "exact", head: true }).gte("month_start", adMonthFrom).lte("month_start", adMonthTo),
        (from) => mercadeo.from("budget_month").select("cost_center_id,line_code,month_start,presupuestado,real_gtq").gte("month_start", adMonthFrom).lte("month_start", adMonthTo).order("id").range(from, from + PAGE - 1),
      ),
      fetchSmall(ventas, "dim_project", "id,name"),
      fetchSmall(ventas, "dim_fuente", "id,name"),
      fetchFiltered(
        () => ventas.from("fact_comprobante").select("id", { count: "exact", head: true }).gte("comprobante_on", bounds.dealFrom).lte("comprobante_on", bounds.dealTo),
        (from) => ventas.from("fact_comprobante").select("deal_id,comprobante_on").gte("comprobante_on", bounds.dealFrom).lte("comprobante_on", bounds.dealTo).order("id").range(from, from + PAGE - 1),
      ),
      fetchFiltered(
        () => ventas.from("v_sale").select("deal_id", { count: "exact", head: true }).gte("sale_on", bounds.dealFrom).lte("sale_on", bounds.dealTo),
        (from) => ventas.from("v_sale").select("deal_id,unit_id,sale_on").gte("sale_on", bounds.dealFrom).lte("sale_on", bounds.dealTo).order("deal_id").order("unit_id").range(from, from + PAGE - 1),
      ),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/schema|mercadeo|PGRST106/i.test(message)) {
      throw new Error("Hay que correr la migración 079 en el editor SQL de Supabase y exponer el esquema mercadeo.");
    }
    throw error;
  }
  const dealIds = [
    ...comprobanteRows.map((row) => text(row.deal_id)),
    ...saleRows.map((row) => text(row.deal_id)),
  ];
  const dealRows = await fetchByIds(ventas, "dim_deal", "id", dealIds, "id,pipedrive_deal_id,project_id,value_gtq,fuente_id");
  const pipedriveIds = dealRows.map((row) => text(row.pipedrive_deal_id));
  const attrRows = await fetchByIds(mercadeo, "deal_attribution", "pipedrive_deal_id", pipedriveIds, "pipedrive_deal_id,platform,campaign_name");

  const centers: Center[] = centerRows
    .map((row) => ({
      id: text(row.id),
      slug: text(row.slug),
      name: text(row.name),
      building: row.is_building === true,
      sort: Number(row.sort_order ?? 0),
    }))
    .sort((a, b) => a.sort - b.sort);
  const ranges = new Map<string, Range>();
  for (const row of rangeRows) {
    ranges.set(text(row.cost_center_id), { min: amount(row.min_leads), max: amount(row.max_leads) });
  }
  const ads: Ad[] = adRows.map((row) => ({
    centerId: text(row.cost_center_id),
    platform: text(row.platform),
    campaign: text(row.campaign_name),
    day: text(row.day).slice(0, 10),
    currency: text(row.currency),
    spend: amount(row.spend) ?? 0,
    impressions: amount(row.impressions) ?? 0,
    reach: amount(row.reach) ?? 0,
    leads: amount(row.leads) ?? 0,
    forms: amount(row.lead_forms) ?? 0,
  }));
  const budgets: Budget[] = budgetRows.map((row) => ({
    centerId: text(row.cost_center_id),
    line: text(row.line_code),
    month: text(row.month_start).slice(0, 10),
    plan: amount(row.presupuestado),
    real: amount(row.real_gtq),
  }));
  const budgetKey = new Map<string, Budget>();
  for (const row of budgets) budgetKey.set(`${row.centerId}|${row.line}|${row.month}`, row);
  const attrs = new Map<string, Attr>();
  for (const row of attrRows) {
    const id = text(row.pipedrive_deal_id);
    const current = attrs.get(id) ?? { meta: null, tiktok: null };
    const name = text(row.campaign_name);
    if (text(row.platform) === "tiktok") current.tiktok = name || current.tiktok;
    else current.meta = name || current.meta;
    attrs.set(id, current);
  }

  const projectSlug = new Map<string, string>();
  for (const row of projectRows) {
    const slug = PROJECT_SLUG[text(row.name)];
    if (slug) projectSlug.set(text(row.id), slug);
  }
  const fuenteName = new Map<string, string>();
  for (const row of fuenteRowsRaw) fuenteName.set(text(row.id), text(row.name) || "Sin dato");
  const deals = new Map<string, DealInfo>();
  for (const row of dealRows) {
    deals.set(text(row.id), {
      pipedriveId: text(row.pipedrive_deal_id),
      slug: projectSlug.get(text(row.project_id)) ?? null,
      value: amount(row.value_gtq),
      fuente: fuenteName.get(text(row.fuente_id)) ?? "Sin dato",
    });
  }
  const reservaDays = new Map<string, string[]>();
  for (const row of comprobanteRows) {
    const dealId = text(row.deal_id);
    const day = text(row.comprobante_on).slice(0, 10);
    if (!dealId || day.length !== 10) continue;
    const days = reservaDays.get(dealId) ?? [];
    days.push(day);
    reservaDays.set(dealId, days);
  }
  const sales = saleRows.map((row) => ({
    dealId: text(row.deal_id),
    saleOn: text(row.sale_on).slice(0, 10) || null,
  }));
  const notice = ads.length === 0 ? "No hay pauta en este periodo." : null;
  return { centers, ranges, ads, budgets, budgetKey, deals, attrs, reservaDays, sales, notice };
}

type Cut = {
  leads: number;
  leadMin: number | null;
  leadMax: number | null;
  dailyActual: number | null;
  dailyMin: number | null;
  dailyMax: number | null;
  dailyActualGtq: number;
  dailyPlanGtq: number;
  monthActualGtq: number;
  monthPlanGtq: number;
  pautaGtq: number;
  ventas: Pair;
  reservas: Pair;
  roas: number | null;
  roi: number | null;
  costo: number | null;
  partial: boolean;
};

function measure(loaded: Loaded, window: DateWindow, centers: Center[]): Cut {
  const ids = new Set(centers.map((center) => center.id));
  const slugs = new Set(centers.map((center) => center.slug));
  const leads = metaLeads(loaded, window, ids);
  const monthly = summedRange(loaded, centers);
  const monthCount = monthsTouched(window.from, window.to).length;
  const days = eachDay(window.from, window.to);
  let dailyActualGtq = 0;
  let dailyPlanGtq = 0;
  let minAccumulator = 0;
  let maxAccumulator = 0;
  let rangedDays = 0;
  for (const day of days) {
    const month = `${day.slice(0, 7)}-01`;
    const width = daysInMonth(month);
    dailyPlanGtq += monthPlan(loaded, ids, month) / width;
    dailyActualGtq += daySpend(loaded, ids, day);
    if (monthly.min == null || monthly.max == null) continue;
    minAccumulator += monthly.min / width;
    maxAccumulator += monthly.max / width;
    rangedDays += 1;
  }
  const monthActualGtq = pautaOf(loaded, window, ids);
  const monthPlanGtq = monthsTouched(window.from, window.to).reduce((sum, month) => sum + monthPlan(loaded, ids, month), 0);
  const ventas = pairFor(loaded, window, slugs, "venta");
  const reservas = pairFor(loaded, window, slugs, "reserva");
  const value = ventas.gtq;
  const roas = monthActualGtq > 0 && value != null ? value / monthActualGtq : null;
  const roi = roas == null ? null : roas - 1;
  const costo = ventas.units > 0 && monthActualGtq > 0 ? monthActualGtq / ventas.units : null;
  const partial = monthsTouched(window.from, window.to).some((month) => month < window.from || monthEnd(month) > window.to);
  return {
    leads,
    leadMin: monthly.min == null ? null : monthly.min * monthCount,
    leadMax: monthly.max == null ? null : monthly.max * monthCount,
    dailyActual: days.length > 0 ? leads / days.length : null,
    dailyMin: rangedDays > 0 ? minAccumulator / rangedDays : null,
    dailyMax: rangedDays > 0 ? maxAccumulator / rangedDays : null,
    dailyActualGtq,
    dailyPlanGtq,
    monthActualGtq,
    monthPlanGtq,
    pautaGtq: monthActualGtq,
    ventas,
    reservas,
    roas,
    roi,
    costo,
    partial,
  };
}

function summedRange(loaded: Loaded, centers: Center[]): Range {
  let min = 0;
  let max = 0;
  let any = false;
  for (const center of centers) {
    const band = loaded.ranges.get(center.id);
    if (band?.min == null || band.max == null) continue;
    any = true;
    min += band.min;
    max += band.max;
  }
  return any ? { min, max } : { min: null, max: null };
}

function metaLeads(loaded: Loaded, window: DateWindow, ids: Set<string>): number {
  let total = 0;
  for (const row of loaded.ads) {
    if (row.platform !== "meta" || !ids.has(row.centerId) || row.campaign === EXCLUDED) continue;
    if (row.day < window.from || row.day > window.to) continue;
    total += row.leads;
  }
  return total;
}

function metaSpend(loaded: Loaded, window: DateWindow, ids: Set<string>): number {
  let total = 0;
  for (const row of loaded.ads) {
    if (row.platform !== "meta" || !ids.has(row.centerId) || row.campaign === EXCLUDED) continue;
    if (row.day < window.from || row.day > window.to) continue;
    total += toGtq(row);
  }
  return total;
}

function daySpend(loaded: Loaded, ids: Set<string>, day: string): number {
  let total = 0;
  for (const row of loaded.ads) {
    if (row.day !== day || !ids.has(row.centerId) || row.campaign === EXCLUDED) continue;
    if (row.platform !== "meta" && row.platform !== "google") continue;
    total += toGtq(row);
  }
  return total;
}

function monthPlan(loaded: Loaded, ids: Set<string>, month: string): number {
  let total = 0;
  for (const centerId of ids) {
    for (const line of LINES) {
      const row = loaded.budgetKey.get(`${centerId}|${line}|${month}`);
      if (row?.plan != null) total += row.plan;
    }
  }
  return total;
}

function pautaOf(loaded: Loaded, window: DateWindow, ids: Set<string>): number {
  let total = 0;
  for (const row of loaded.ads) {
    if (!ids.has(row.centerId) || row.campaign === EXCLUDED) continue;
    if (row.day < window.from || row.day > window.to) continue;
    if (row.platform !== "meta" && row.platform !== "google") continue;
    total += toGtq(row);
  }
  for (const month of monthsTouched(window.from, window.to)) {
    if (month < window.from || monthEnd(month) > window.to) continue;
    for (const centerId of ids) {
      for (const line of WORKBOOK_LINES) {
        const row = loaded.budgetKey.get(`${centerId}|${line}|${month}`);
        if (row?.real != null) total += row.real;
      }
    }
  }
  return total;
}

function pairFor(loaded: Loaded, window: DateWindow, slugs: Set<string>, kind: "venta" | "reserva"): Pair {
  let pair = emptyPair();
  if (kind === "venta") {
    for (const sale of loaded.sales) {
      if (!sale.saleOn || sale.saleOn < window.from || sale.saleOn > window.to) continue;
      const deal = loaded.deals.get(sale.dealId);
      if (!deal?.slug || !slugs.has(deal.slug)) continue;
      pair = addPair(pair, deal.value);
    }
    return pair;
  }
  for (const [dealId, days] of loaded.reservaDays) {
    if (!days.some((day) => day >= window.from && day <= window.to)) continue;
    const deal = loaded.deals.get(dealId);
    if (!deal?.slug || !slugs.has(deal.slug)) continue;
    pair = addPair(pair, deal.value);
  }
  return pair;
}

function tiles(cut: Cut): Tile[] {
  const rangeText = cut.leadMin == null || cut.leadMax == null
    ? "Sin meta en este periodo."
    : `Meta ${num(cut.leadMin)}–${num(cut.leadMax)}${cut.partial ? ". La meta es del mes completo." : "."}`;
  return [
    { label: "Meta mensual de lead", value: `${num(cut.leads)} leads`, detail: rangeText },
    {
      label: "Meta diaria de lead",
      value: `${num(cut.dailyActual)} / día`,
      detail: cut.dailyMin == null ? "Sin meta diaria." : `Meta ${num(cut.dailyMin)}–${num(cut.dailyMax)} por día.`,
    },
    {
      label: "Uso de presupuesto diario",
      value: percent(cut.dailyActualGtq, cut.dailyPlanGtq),
      detail: `${gtq(cut.dailyActualGtq)} de ${gtq(cut.dailyPlanGtq)} repartidos.`,
    },
    {
      label: "Uso de presupuesto mensual",
      value: percent(cut.monthActualGtq, cut.monthPlanGtq),
      detail: `${gtq(cut.monthActualGtq)} de ${gtq(cut.monthPlanGtq)}.`,
    },
    {
      label: "ROAS / ROI",
      value: cut.roas == null ? "sin pauta o sin monto" : num(cut.roas),
      detail: cut.roi == null ? "Falta la pauta o el monto de las ventas." : `ROI ${num(cut.roi)}. Ventas ${gtq(cut.ventas.gtq)} / pauta ${gtq(cut.pautaGtq)}.`,
    },
    {
      label: "Costo por cierre",
      value: cut.costo == null ? "sin ventas" : gtq(cut.costo),
      detail: `${num(cut.ventas.units)} ventas.`,
    },
    { label: "Reservas", value: pairText(cut.reservas), detail: "Unidades y quetzales del valor del trato." },
    { label: "Ventas", value: pairText(cut.ventas), detail: "Unidades y quetzales del valor del trato." },
  ];
}

function insights(cut: Cut): Insight[] {
  const lines: Insight[] = [];
  if (cut.partial && cut.dailyActual != null && cut.dailyMin != null && cut.dailyMax != null) {
    if (cut.dailyActual < cut.dailyMin) {
      lines.push({ tone: "bad", text: `El ritmo va en ${num(cut.dailyActual)} leads por día, debajo de la meta diaria de ${num(cut.dailyMin)}.` });
    } else if (cut.dailyActual > cut.dailyMax) {
      lines.push({ tone: "good", text: `El ritmo va en ${num(cut.dailyActual)} leads por día, sobre la meta diaria.` });
    } else {
      lines.push({ tone: "info", text: `El ritmo diario va dentro de la meta.` });
    }
  } else if (cut.leadMin != null && cut.leads < cut.leadMin) {
    lines.push({ tone: "bad", text: `Los leads van en ${num(cut.leads)}, debajo del piso de ${num(cut.leadMin)}.` });
  } else if (cut.leadMax != null && cut.leads > cut.leadMax) {
    lines.push({ tone: "good", text: `Los leads superan el techo de ${num(cut.leadMax)}.` });
  } else if (cut.leadMin != null) {
    lines.push({ tone: "info", text: `Los leads van dentro de la meta ${num(cut.leadMin)}–${num(cut.leadMax)}.` });
  }
  if (cut.dailyPlanGtq > 0 && cut.dailyActualGtq > cut.dailyPlanGtq) {
    lines.push({ tone: "warn", text: `La pauta diaria ya usa ${percent(cut.dailyActualGtq, cut.dailyPlanGtq)} del presupuesto repartido.` });
  }
  if (cut.roas != null && cut.roas < 1) {
    lines.push({ tone: "bad", text: `El ROAS es ${num(cut.roas)}. El valor de las ventas no cubre la pauta.` });
  } else if (cut.roas != null) {
    lines.push({ tone: "good", text: `El ROAS es ${num(cut.roas)}. Cada quetzal de pauta devolvió ${num(cut.roas)} en valor de venta.` });
  }
  return lines.slice(0, 3);
}

function projectRow(loaded: Loaded, window: DateWindow, center: Center): ProjectRow {
  const cut = measure(loaded, window, [center]);
  return {
    label: center.name,
    leads: cut.leads,
    pautaGtq: cut.pautaGtq,
    roas: cut.roas,
    reservas: cut.reservas,
    ventas: cut.ventas,
  };
}

function campaignRows(loaded: Loaded, window: DateWindow, centers: Center[]): CampaignRow[] {
  if (centers.length === 0) return [];
  const ids = new Set(centers.map((center) => center.id));
  const slugs = new Set(centers.map((center) => center.slug));
  const rows = new Map<string, CampaignRow>();
  const ensure = (name: string): CampaignRow => {
    const found = rows.get(name);
    if (found) return found;
    const created: CampaignRow = {
      campaign: name,
      spendGtq: name === "Sin campaña" ? null : 0,
      leads: name === "Sin campaña" ? null : 0,
      reach: name === "Sin campaña" ? null : 0,
      impressions: name === "Sin campaña" ? null : 0,
      cpl: null,
      reservas: emptyPair(),
      ventas: emptyPair(),
    };
    rows.set(name, created);
    return created;
  };
  for (const ad of loaded.ads) {
    if (ad.platform !== "meta" || !ids.has(ad.centerId) || ad.campaign === EXCLUDED) continue;
    if (ad.day < window.from || ad.day > window.to) continue;
    const row = ensure(ad.campaign);
    row.spendGtq = (row.spendGtq ?? 0) + toGtq(ad);
    row.leads = (row.leads ?? 0) + ad.leads;
    row.reach = (row.reach ?? 0) + ad.reach;
    row.impressions = (row.impressions ?? 0) + ad.impressions;
  }
  for (const [dealId, days] of loaded.reservaDays) {
    if (!days.some((day) => day >= window.from && day <= window.to)) continue;
    const deal = loaded.deals.get(dealId);
    if (!deal?.slug || !slugs.has(deal.slug)) continue;
    const row = ensure(campaignOf(loaded.attrs.get(deal.pipedriveId)));
    row.reservas = addPair(row.reservas, deal.value);
  }
  for (const sale of loaded.sales) {
    if (!sale.saleOn || sale.saleOn < window.from || sale.saleOn > window.to) continue;
    const deal = loaded.deals.get(sale.dealId);
    if (!deal?.slug || !slugs.has(deal.slug)) continue;
    const row = ensure(campaignOf(loaded.attrs.get(deal.pipedriveId)));
    row.ventas = addPair(row.ventas, deal.value);
  }
  for (const row of rows.values()) {
    if (row.spendGtq != null && row.leads != null && row.leads > 0) row.cpl = row.spendGtq / row.leads;
  }
  return [...rows.values()]
    .filter((row) => (row.spendGtq ?? 0) > 0 || row.reservas.units > 0 || row.ventas.units > 0 || (row.leads ?? 0) > 0)
    .sort((a, b) => (b.spendGtq ?? 0) - (a.spendGtq ?? 0) || b.ventas.units - a.ventas.units || a.campaign.localeCompare(b.campaign, "es"));
}

function monthPoints(loaded: Loaded, window: DateWindow, centers: Center[]): MonthPoint[] {
  const points: MonthPoint[] = [];
  let cumulative = 0;
  for (const month of monthsTouched(window.from, window.to)) {
    const from = month < window.from ? window.from : month;
    const end = monthEnd(month);
    const to = end > window.to ? window.to : end;
    const slice = { from, to, label: monthLabel(month) };
    const cut = measure(loaded, slice, centers);
    const spend = metaSpend(loaded, slice, new Set(centers.map((center) => center.id)));
    const full = month >= window.from && end <= window.to;
    cumulative += cut.pautaGtq;
    points.push({
      month,
      label: monthLabel(month),
      leads: cut.leads,
      cpl: cut.leads > 0 ? spend / cut.leads : null,
      metaSpendGtq: spend,
      pautaGtq: cut.pautaGtq,
      cumulativeGtq: cumulative,
      planGtq: monthPlan(loaded, new Set(centers.map((center) => center.id)), month) || null,
      note: full ? null : "Mes parcial. El presupuesto es del mes completo.",
    });
  }
  return points;
}

function fuenteRows(loaded: Loaded, window: DateWindow, centers: Center[]): FuenteRow[] {
  const slugs = new Set(centers.map((center) => center.slug));
  const rows = new Map<string, FuenteRow>();
  const ensure = (label: string): FuenteRow => {
    const found = rows.get(label);
    if (found) return found;
    const created = { label, reservas: emptyPair(), ventas: emptyPair() };
    rows.set(label, created);
    return created;
  };
  for (const [dealId, days] of loaded.reservaDays) {
    if (!days.some((day) => day >= window.from && day <= window.to)) continue;
    const deal = loaded.deals.get(dealId);
    if (!deal?.slug || !slugs.has(deal.slug)) continue;
    const row = ensure(deal.fuente);
    row.reservas = addPair(row.reservas, deal.value);
  }
  for (const sale of loaded.sales) {
    if (!sale.saleOn || sale.saleOn < window.from || sale.saleOn > window.to) continue;
    const deal = loaded.deals.get(sale.dealId);
    if (!deal?.slug || !slugs.has(deal.slug)) continue;
    const row = ensure(deal.fuente);
    row.ventas = addPair(row.ventas, deal.value);
  }
  return [...rows.values()].sort((a, b) => b.ventas.units - a.ventas.units || a.label.localeCompare(b.label, "es"));
}

function platformRows(loaded: Loaded, window: DateWindow, centers: Center[]): PlatformCost[] {
  const ids = new Set(centers.map((center) => center.id));
  const slugs = new Set(centers.map((center) => center.slug));
  let meta = emptyPair();
  let tiktok = emptyPair();
  let metaSpend = 0;
  for (const ad of loaded.ads) {
    if (ad.platform !== "meta" || !ids.has(ad.centerId) || ad.campaign === EXCLUDED) continue;
    if (ad.day < window.from || ad.day > window.to) continue;
    metaSpend += toGtq(ad);
  }
  let tiktokSpend = 0;
  const fullMonths = monthsTouched(window.from, window.to).filter((month) => month >= window.from && monthEnd(month) <= window.to);
  for (const month of fullMonths) {
    for (const centerId of ids) {
      const row = loaded.budgetKey.get(`${centerId}|tiktok|${month}`);
      if (row?.real != null) tiktokSpend += row.real;
    }
  }
  for (const sale of loaded.sales) {
    if (!sale.saleOn || sale.saleOn < window.from || sale.saleOn > window.to) continue;
    const deal = loaded.deals.get(sale.dealId);
    if (!deal?.slug || !slugs.has(deal.slug)) continue;
    const attr = loaded.attrs.get(deal.pipedriveId);
    if (attr?.meta) meta = addPair(meta, deal.value);
    else if (attr?.tiktok) tiktok = addPair(tiktok, deal.value);
  }
  return [
    {
      label: "Meta",
      ventas: meta,
      costo: meta.units > 0 ? metaSpend / meta.units : null,
      detail: "Gasto Meta del periodo ÷ ventas con campaña Meta.",
    },
    {
      label: "TikTok",
      ventas: tiktok,
      costo: fullMonths.length > 0 && tiktok.units > 0 ? tiktokSpend / tiktok.units : null,
      detail: fullMonths.length > 0 ? "Real de TikTok de los meses completos ÷ ventas con campaña TikTok." : "Este periodo no cubre un mes completo, así que el real de TikTok no entra.",
    },
  ];
}

export type MercadeoStore = Loaded;

export async function loadMercadeoStore(bounds: MercadeoBounds): Promise<MercadeoStore> {
  const key = `${bounds.adFrom}|${bounds.adTo}|${bounds.dealFrom}|${bounds.dealTo}`;
  const hit = storeCache.get(key);
  if (hit && Date.now() - hit.at < STORE_TTL_MS) return hit.store;
  const admin = createAdminClient();
  const store = await load(admin.schema("mercadeo"), admin.schema("ventas"), bounds);
  storeCache.set(key, { at: Date.now(), store });
  if (storeCache.size > 8) {
    const oldest = [...storeCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) storeCache.delete(oldest[0]);
  }
  return store;
}

export function storeCampaignsFor(
  store: MercadeoStore,
  window: DateWindow,
  slugs: string[] | null,
): { main: CampaignRow[]; puerta: CampaignRow[] } {
  const selected = store.centers.filter((center) => slugs === null || slugs.includes(center.slug));
  const buildings = selected.filter((center) => center.building);
  const puerta = selected.find((center) => !center.building) ?? null;
  return {
    main: campaignRows(store, window, buildings.length > 0 ? buildings : puerta ? [puerta] : []),
    puerta: buildings.length > 0 && puerta ? campaignRows(store, window, [puerta]) : [],
  };
}

export type ChannelPoint = {
  label: string;
  spendGtq: number | null;
  activeDays: number | null;
  days: number;
  leads: number | null;
  forms: number | null;
};

export function storeChannels(store: MercadeoStore, window: DateWindow, centerIds: Set<string>): ChannelPoint[] {
  const days = eachDay(window.from, window.to);
  const metaDays = new Set<string>();
  const googleDays = new Set<string>();
  let metaSpend = 0;
  let googleSpend = 0;
  let metaLeadTotal = 0;
  let googleForms = 0;
  for (const row of store.ads) {
    if (!centerIds.has(row.centerId) || row.campaign === EXCLUDED) continue;
    if (row.day < window.from || row.day > window.to) continue;
    if (row.platform === "meta") {
      const spend = toGtq(row);
      metaSpend += spend;
      metaLeadTotal += row.leads;
      if (spend > 0) metaDays.add(row.day);
    } else if (row.platform === "google") {
      const spend = toGtq(row);
      googleSpend += spend;
      googleForms += row.forms;
      if (spend > 0) googleDays.add(row.day);
    }
  }
  const months = monthsTouched(window.from, window.to);
  function workbook(line: string): number | null {
    let total = 0;
    let any = false;
    for (const month of months) {
      for (const centerId of centerIds) {
        const row = store.budgetKey.get(`${centerId}|${line}|${month}`);
        if (row?.real == null) continue;
        any = true;
        total += row.real;
      }
    }
    return any ? total : null;
  }
  return [
    { label: "Meta", spendGtq: metaSpend, activeDays: metaDays.size, days: days.length, leads: metaLeadTotal, forms: null },
    { label: "Google", spendGtq: googleSpend, activeDays: googleDays.size, days: days.length, leads: null, forms: googleForms },
    { label: "TikTok", spendGtq: workbook("tiktok"), activeDays: null, days: days.length, leads: null, forms: null },
    { label: "LinkedIn", spendGtq: workbook("linkedin"), activeDays: null, days: days.length, leads: null, forms: null },
    { label: "Pauta digital", spendGtq: workbook("pauta_digital"), activeDays: null, days: days.length, leads: null, forms: null },
    { label: "Wati", spendGtq: workbook("wati"), activeDays: null, days: days.length, leads: null, forms: null },
  ];
}

export type LinePoint = { label: string; gtq: number | null };

export function storeMonthLines(store: MercadeoStore, month: string, to: string, centerIds: Set<string>): LinePoint[] {
  const end = monthEnd(month);
  const sliceTo = end < to ? end : to;
  const window = { from: month, to: sliceTo, label: month };
  let meta = 0;
  let google = 0;
  for (const row of store.ads) {
    if (!centerIds.has(row.centerId) || row.campaign === EXCLUDED) continue;
    if (row.day < window.from || row.day > window.to) continue;
    if (row.platform === "meta") meta += toGtq(row);
    else if (row.platform === "google") google += toGtq(row);
  }
  function workbook(line: string): number | null {
    let total = 0;
    let any = false;
    for (const centerId of centerIds) {
      const row = store.budgetKey.get(`${centerId}|${line}|${month}`);
      if (row?.real == null) continue;
      any = true;
      total += row.real;
    }
    return any ? total : null;
  }
  return [
    { label: "Meta", gtq: meta },
    { label: "Google", gtq: google },
    { label: "TikTok", gtq: workbook("tiktok") },
    { label: "LinkedIn", gtq: workbook("linkedin") },
    { label: "Pauta digital", gtq: workbook("pauta_digital") },
    { label: "Wati", gtq: workbook("wati") },
  ];
}

export function storePauta(store: MercadeoStore, window: DateWindow, centerIds: Set<string>): number {
  return pautaOf(store, window, centerIds);
}

export function storeMonthPlan(store: MercadeoStore, centerIds: Set<string>, month: string): number {
  return monthPlan(store, centerIds, month);
}

export function storeMetaSpend(store: MercadeoStore, window: DateWindow, centerIds: Set<string>): number {
  return metaSpend(store, window, centerIds);
}

export function storeMetaLeads(store: MercadeoStore, window: DateWindow, centerIds: Set<string>): number {
  return metaLeads(store, window, centerIds);
}

export function storeDaySpend(store: MercadeoStore, centerIds: Set<string>, day: string): number {
  return daySpend(store, centerIds, day);
}

export function storePair(
  store: MercadeoStore,
  window: DateWindow,
  slugs: Set<string>,
  kind: "venta" | "reserva",
): Pair {
  return pairFor(store, window, slugs, kind);
}
