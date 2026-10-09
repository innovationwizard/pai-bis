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
  "ROAS = valor de las ventas del corte ÷ pauta del corte.",
  "ROI = (valor de las ventas − pauta) ÷ pauta.",
  "Costo por cierre = pauta ÷ cantidad de ventas.",
  "La pauta suma Meta y Google en los días del corte. TikTok, LinkedIn, Pauta Digital y Wati entran solo cuando el corte cubre el mes completo. Un real vacío es sin ejecución.",
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

async function fetchAll(db: Db, table: string, select: string, orderBy = ["id"]): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 200000; from += 1000) {
    let query = db.from(table).select(select);
    for (const column of orderBy) query = query.order(column);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
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
  const admin = createAdminClient();
  const mercadeo = admin.schema("mercadeo");
  const ventas = admin.schema("ventas");
  const loaded = await load(mercadeo, ventas);
  const range = resolveRange(filters.preset, filters.customFrom, filters.customTo);
  const windows = [range];
  if (filters.compareN) windows.push(...previousWindows(range, Math.min(12, Math.max(1, filters.n))));
  if (filters.compareYear) windows.push(yearAgoWindow(range));

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
    caption: "La meta de leads y el presupuesto mensual son del mes completo. Meta y Google corren hasta el fin del corte.",
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

async function load(mercadeo: Db, ventas: Db): Promise<Loaded> {
  let centerRows: Record<string, unknown>[];
  let rangeRows: Record<string, unknown>[];
  let adRows: Record<string, unknown>[];
  let budgetRows: Record<string, unknown>[];
  let attrRows: Record<string, unknown>[];
  try {
    [centerRows, rangeRows, adRows, budgetRows, attrRows] = await Promise.all([
      fetchAll(mercadeo, "cost_center", "id,slug,name,is_building,sort_order"),
      fetchAll(mercadeo, "lead_range", "cost_center_id,min_leads,max_leads", ["cost_center_id"]),
      fetchAll(mercadeo, "ad_day", "id,cost_center_id,platform,campaign_name,day,currency,spend,impressions,reach,leads"),
      fetchAll(mercadeo, "budget_month", "id,cost_center_id,line_code,month_start,presupuestado,real_gtq"),
      fetchAll(mercadeo, "deal_attribution", "id,pipedrive_deal_id,platform,campaign_name"),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/schema|mercadeo|PGRST106/i.test(message)) {
      throw new Error("Hay que correr la migración 079 en el editor SQL de Supabase y exponer el esquema mercadeo.");
    }
    throw error;
  }

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

  const [projectRows, fuenteRowsRaw, dealRows, saleRows, comprobanteRows] = await Promise.all([
    fetchAll(ventas, "dim_project", "id,name"),
    fetchAll(ventas, "dim_fuente", "id,name"),
    fetchAll(ventas, "dim_deal", "id,pipedrive_deal_id,project_id,value_gtq,fuente_id"),
    fetchAll(ventas, "v_sale", "deal_id,unit_id,sale_on", ["deal_id", "unit_id"]),
    fetchAll(ventas, "fact_comprobante", "id,deal_id,comprobante_on"),
  ]);
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
  const notice = ads.length === 0
    ? "La carga de Mercadeo todavía no tiene filas. Después de la migración 079 hay que correr python3 scripts/mercadeo/load.py."
    : null;
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
    ? "Sin meta en este corte."
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
      detail: "Gasto Meta del corte ÷ ventas con campaña Meta.",
    },
    {
      label: "TikTok",
      ventas: tiktok,
      costo: fullMonths.length > 0 && tiktok.units > 0 ? tiktokSpend / tiktok.units : null,
      detail: fullMonths.length > 0 ? "Real de TikTok de los meses completos ÷ ventas con campaña TikTok." : "Este corte no cubre un mes completo, así que el real de TikTok no entra.",
    },
  ];
}
