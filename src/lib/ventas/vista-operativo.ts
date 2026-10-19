import { createAdminClient } from "@/lib/supabase/admin";
import { monthEnd, monthStart, monthsTouched, resolveRange, windowLabel, guatemalaToday, type DateWindow } from "./period";
import type { VistaFilters } from "./vista";
import type {
  AnalisisVista,
  CasoVista,
  Choice,
  ConversionVista,
  DescuentoVista,
  DesistenciaVista,
  InventarioVista,
  NamedBar,
  PrecioVista,
  PromoVista,
  RateRow,
  ValorVista,
  VentasVista,
} from "./vista-types";

const PAGE = 1000;
const CAP = 5000;
const STOCK_MS = 60_000;
const NO_SALES = "Este periodo todavía no tiene ventas.";
const NO_STOCK = "Este inventario todavía no tiene filas.";
const VISIT_CAPTION = "Una visita de este periodo que se vuelve venta en un periodo siguiente no entra en el numerador.";

const STOCK_SECTIONS = ["analisis-de-inventario", "inventario-general", "valor-del-proyecto", "tasa-de-conversion"] as const;
type StockSection = (typeof STOCK_SECTIONS)[number];

export function isStockSection(section: string): section is StockSection {
  return (STOCK_SECTIONS as readonly string[]).includes(section);
}

type StockRow = {
  unitId: string;
  projectId: string;
  towerId: string;
  modelId: string;
  habitacionesId: string;
  pageStatus: string;
  amount: number | null;
  currency: string | null;
};

type Named = { id: string; name: string; sin: boolean };

type Dims = {
  projects: Named[];
  models: Map<string, string>;
  habitaciones: Map<string, string>;
  fuentes: Map<string, Named>;
  asesores: Map<string, Named>;
  torres: Map<string, string>;
  towerProjects: Map<string, string>;
  reasons: Map<string, string>;
  discounts: Map<string, Named>;
  promotions: Map<string, Named>;
  cases: Map<string, Named>;
};

type DealStamp = { projectId: string; asesorId: string; fuenteId: string };

const stockCache = new Map<string, { at: number; rows: StockRow[] }>();
let dimCache: { at: number; dims: Dims } | null = null;

function db() {
  return createAdminClient().schema("ventas");
}

type Db = ReturnType<typeof db>;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function projectOk(projectId: string, filters: VistaFilters): boolean {
  return filters.projectIds === null || filters.projectIds.includes(projectId);
}

function shortMonth(iso: string): string {
  const names = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${names[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;
}

function monthsBack(to: string, count: number): string {
  const start = monthStart(to);
  const [year, month] = start.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - (count - 1), 1));
  return date.toISOString().slice(0, 10);
}

function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return part / whole;
}

function emptyChoices(): AnalisisVista["choices"] {
  return {
    asesor: [],
    torre: [],
    fuente: [],
    modelo: [],
    habitaciones: [],
    motivo: [],
    descuento: [],
    promocion: [],
    caso: [],
    estadoUnidad: [],
  };
}

function countChoices(ids: string[], labels: Map<string, string>): Choice[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: labels.get(id) ?? "Sin dato", count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"))
    .map(({ id, label }) => ({ id, label }));
}

function projectsOf(dims: Dims): Choice[] {
  return dims.projects
    .filter((project) => !project.sin)
    .map((project) => ({ id: project.id, label: project.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function bucket(status: string): "vendido" | "congelado" | "disponible" | "otro" {
  if (status === "Vendido") return "vendido";
  if (status === "Congelado") return "congelado";
  if (status === "Disponible") return "disponible";
  return "otro";
}

function prices(rows: StockRow[]): { gtq: number | null; usd: number | null } {
  let gtq = 0;
  let usd = 0;
  let seenGtq = false;
  let seenUsd = false;
  for (const row of rows) {
    if (row.amount == null) continue;
    if (row.currency === "USD") {
      usd += row.amount;
      seenUsd = true;
    } else if (row.currency === "GTQ") {
      gtq += row.amount;
      seenGtq = true;
    }
  }
  return { gtq: seenGtq ? gtq : null, usd: seenUsd ? usd : null };
}

async function loadDims(client: Db): Promise<Dims> {
  if (dimCache && Date.now() - dimCache.at < 5 * 60_000) return dimCache.dims;
  const [projects, models, habitaciones, fuentes, asesores, torres, reasons, discounts, promotions, cases] = await Promise.all([
    client.from("dim_project").select("id,name,is_sin_dato"),
    client.from("dim_model").select("id,name"),
    client.from("dim_habitaciones").select("id,name"),
    client.from("dim_fuente").select("id,name,is_sin_dato"),
    client.from("dim_asesor").select("id,name,is_sin_dato"),
    client.from("dim_tower").select("id,name,project_id"),
    client.from("dim_lost_reason").select("id,name"),
    client.from("dim_discount_type").select("id,name,is_sin_dato"),
    client.from("dim_promotion_type").select("id,name,is_sin_dato"),
    client.from("dim_case_type").select("id,name,is_sin_dato"),
  ]);
  for (const result of [projects, models, habitaciones, fuentes, asesores, torres, reasons, discounts, promotions, cases]) {
    if (result.error) throw new Error(result.error.message);
  }
  const named = (rows: Record<string, unknown>[] | null): Named[] =>
    (rows ?? []).map((row) => ({ id: String(row.id), name: String(row.name), sin: row.is_sin_dato === true }));
  const dims: Dims = {
    projects: named(projects.data as Record<string, unknown>[] | null),
    models: new Map((models.data ?? []).map((row) => [String(row.id), String(row.name)])),
    habitaciones: new Map((habitaciones.data ?? []).map((row) => [String(row.id), String(row.name)])),
    fuentes: new Map(named(fuentes.data as Record<string, unknown>[] | null).map((row) => [row.id, row])),
    asesores: new Map(named(asesores.data as Record<string, unknown>[] | null).map((row) => [row.id, row])),
    torres: new Map((torres.data ?? []).map((row) => [String(row.id), String(row.name)])),
    towerProjects: new Map((torres.data ?? []).map((row) => [String(row.id), String(row.project_id)])),
    reasons: new Map((reasons.data ?? []).map((row) => [String(row.id), String(row.name)])),
    discounts: new Map(named(discounts.data as Record<string, unknown>[] | null).map((row) => [row.id, row])),
    promotions: new Map(named(promotions.data as Record<string, unknown>[] | null).map((row) => [row.id, row])),
    cases: new Map(named(cases.data as Record<string, unknown>[] | null).map((row) => [row.id, row])),
  };
  dimCache = { at: Date.now(), dims };
  return dims;
}

async function stockAt(client: Db, asOf: string): Promise<StockRow[]> {
  const hit = stockCache.get(asOf);
  if (hit && Date.now() - hit.at < STOCK_MS) return hit.rows;
  const { data, error } = await client.rpc("stock_at", { p_as_of: asOf });
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    unitId: String(row.unit_id),
    projectId: String(row.project_id),
    towerId: String(row.tower_id),
    modelId: String(row.model_id),
    habitacionesId: String(row.habitaciones_id),
    pageStatus: String(row.page_status ?? row.status_name ?? "Sin dato"),
    amount: num(row.list_price_amount),
    currency: (row.list_price_currency as string | null) ?? null,
  }));
  stockCache.set(asOf, { at: Date.now(), rows });
  return rows;
}

function filterStock(rows: StockRow[], filters: VistaFilters, unitIds: Set<string> | null): StockRow[] {
  return rows.filter((row) => {
    if (!projectOk(row.projectId, filters)) return false;
    if (filters.torreId && row.towerId !== filters.torreId) return false;
    if (filters.modeloId && row.modelId !== filters.modeloId) return false;
    if (filters.habitacionesId && row.habitacionesId !== filters.habitacionesId) return false;
    if (filters.estadoUnidad && row.pageStatus !== filters.estadoUnidad) return false;
    if (unitIds && !unitIds.has(row.unitId)) return false;
    return true;
  });
}

async function searchUnits(client: Db, buscar: string | null): Promise<Set<string> | null> {
  if (!buscar) return null;
  const safe = buscar.replace(/[%_]/g, "").trim();
  if (!safe) return new Set();
  const { data, error } = await client.from("dim_unit").select("id").ilike("canonical_unit", `%${safe}%`).limit(200);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => String(row.id)));
}

type DatedQuery = {
  in(column: string, values: string[]): DatedQuery;
  eq(column: string, value: string): DatedQuery;
  range(from: number, to: number): Promise<{ data: unknown; error: { message: string } | null }>;
};

async function fetchDated(
  client: Db,
  table: string,
  column: string,
  select: string,
  from: string,
  to: string,
  refine?: (query: DatedQuery) => DatedQuery,
): Promise<{ rows: Record<string, unknown>[]; capped: boolean }> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < CAP; offset += PAGE) {
    let query = client.from(table).select(select).gte(column, from).lte(column, to) as unknown as DatedQuery;
    if (refine) query = refine(query);
    const { data, error } = await query.range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, capped: false };
  }
  return { rows, capped: true };
}

function base(question: string, range: DateWindow, caption: string, notice: string | null, dims: Dims, choices: AnalisisVista["choices"]) {
  return {
    question,
    periodLabel: range.label,
    rangeLabel: windowLabel(range),
    caption,
    notice,
    projects: projectsOf(dims),
    choices,
    lines: [],
    listShown: 0,
    listTotal: 0,
  };
}

export async function buildStockVista(section: StockSection, filters: VistaFilters): Promise<VentasVista> {
  const today = guatemalaToday();
  const range = resolveRange(filters.preset, filters.customFrom, filters.customTo, today);
  const client = db();
  if (section === "tasa-de-conversion") return buildConversion(client, filters, range);
  const dims = await loadDims(client);
  const [stock, unitIds] = await Promise.all([stockAt(client, range.to), searchUnits(client, filters.buscar)]);
  const rows = filterStock(stock, filters, unitIds);
  if (section === "analisis-de-inventario") return buildAnalisis(client, filters, range, dims, rows);
  if (section === "inventario-general") return buildGeneral(range, dims, rows, stock.length === 0);
  return buildValor(client, filters, range, dims, rows, stock.length === 0);
}

async function buildAnalisis(
  client: Db,
  filters: VistaFilters,
  range: DateWindow,
  dims: Dims,
  stock: StockRow[],
): Promise<AnalisisVista> {
  const sold = await fetchDated(
    client,
    "v_sale",
    "sale_on",
    "deal_id,project_id,tower_id,model_id,habitaciones_id,sale_on",
    range.from,
    range.to,
    (query) => {
      let next = query;
      const ids = projectList(filters);
      if (ids) next = next.in("project_id", ids);
      if (filters.torreId) next = next.eq("tower_id", filters.torreId);
      if (filters.modeloId) next = next.eq("model_id", filters.modeloId);
      if (filters.habitacionesId) next = next.eq("habitaciones_id", filters.habitacionesId);
      return next;
    },
  );
  if (filters.projectIds && filters.projectIds.length === 0) sold.rows = [];
  const salesByModel = new Map<string, { units: number; towers: Map<string, number> }>();
  for (const row of sold.rows) {
    const modelId = String(row.model_id);
    const bucket = salesByModel.get(modelId) ?? { units: 0, towers: new Map() };
    bucket.units += 1;
    const towerId = String(row.tower_id);
    bucket.towers.set(towerId, (bucket.towers.get(towerId) ?? 0) + 1);
    salesByModel.set(modelId, bucket);
  }
  const availableByModel = new Map<string, StockRow[]>();
  for (const row of stock) {
    if (bucket(row.pageStatus) !== "disponible") continue;
    const list = availableByModel.get(row.modelId) ?? [];
    list.push(row);
    availableByModel.set(row.modelId, list);
  }
  const ids = new Set<string>([...salesByModel.keys(), ...availableByModel.keys()]);
  const totalSold = [...salesByModel.values()].reduce((sum, row) => sum + row.units, 0);
  const models = [...ids]
    .map((id) => {
      const sales = salesByModel.get(id);
      const available = availableByModel.get(id) ?? [];
      const list = prices(available);
      return {
        id,
        label: dims.models.get(id) ?? "Sin dato",
        sold: sales?.units ?? 0,
        available: available.length,
        listGtq: list.gtq,
        listUsd: list.usd,
        share: totalSold ? (sales?.units ?? 0) / totalSold : 0,
      };
    })
    .sort((a, b) => b.sold - a.sold || b.available - a.available || a.label.localeCompare(b.label, "es"));
  const byTower: AnalisisVista["byTower"] = [];
  for (const model of models) {
    const towers = new Map<string, { sold: number; available: number }>();
    const sales = salesByModel.get(model.id);
    if (sales) {
      for (const [towerId, units] of sales.towers) {
        const current = towers.get(towerId) ?? { sold: 0, available: 0 };
        current.sold += units;
        towers.set(towerId, current);
      }
    }
    for (const row of availableByModel.get(model.id) ?? []) {
      const current = towers.get(row.towerId) ?? { sold: 0, available: 0 };
      current.available += 1;
      towers.set(row.towerId, current);
    }
    for (const [towerId, value] of towers) {
      byTower.push({ modelId: model.id, tower: dims.torres.get(towerId) ?? "Sin dato", sold: value.sold, available: value.available });
    }
  }
  const choices = emptyChoices();
  choices.modelo = countChoices([...ids], dims.models);
  choices.torre = countChoices(sold.rows.map((row) => String(row.tower_id)), dims.torres);
  choices.habitaciones = countChoices(sold.rows.map((row) => String(row.habitaciones_id)), dims.habitaciones);
  const leader = models.find((model) => model.sold > 0) ?? null;
  const available = models.reduce((sum, model) => sum + model.available, 0);
  const notice = sold.capped
    ? "La consulta del periodo llegó a 5.000 filas. Afina proyecto o periodo."
    : stock.length === 0 && totalSold === 0
      ? NO_STOCK
      : totalSold === 0
        ? NO_SALES
        : null;
  return {
    ...base(
      "¿Qué modelos se están vendiendo y cuáles siguen en inventario?",
      range,
      "La barra de vendidas es el periodo. Disponible es el inventario que sigue en venta, al fin del periodo. El precio de lista no se suma entre quetzales y dólares.",
      notice,
      dims,
      choices,
    ),
    section: "analisis-de-inventario",
    leader: leader?.label ?? null,
    leaderShare: leader?.share ?? null,
    sold: totalSold,
    available,
    models,
    byTower,
  };
}

function buildGeneral(range: DateWindow, dims: Dims, stock: StockRow[], empty: boolean): InventarioVista {
  const groups = {
    vendido: stock.filter((row) => bucket(row.pageStatus) === "vendido"),
    congelado: stock.filter((row) => bucket(row.pageStatus) === "congelado"),
    disponible: stock.filter((row) => bucket(row.pageStatus) === "disponible"),
  };
  const otros = stock.filter((row) => bucket(row.pageStatus) === "otro").length;
  const projectIds = new Set<string>(stock.map((row) => row.projectId));
  if (empty) {
    for (const project of dims.projects) if (!project.sin) projectIds.add(project.id);
  }
  const byProject = [...projectIds]
    .map((id) => {
      const mine = stock.filter((row) => row.projectId === id);
      const disponible = mine.filter((row) => bucket(row.pageStatus) === "disponible");
      const list = prices(disponible);
      return {
        id,
        label: dims.projects.find((project) => project.id === id)?.name ?? "Sin dato",
        vendido: mine.filter((row) => bucket(row.pageStatus) === "vendido").length,
        congelado: mine.filter((row) => bucket(row.pageStatus) === "congelado").length,
        disponible: disponible.length,
        disponibleGtq: list.gtq,
        disponibleUsd: list.usd,
      };
    })
    .sort((a, b) => b.disponible - a.disponible || a.label.localeCompare(b.label, "es"));
  const towers = new Map<string, InventarioVista["byTower"][number]>();
  for (const row of stock) {
    const key = `${row.projectId}|${row.towerId}`;
    const current = towers.get(key) ?? {
      projectId: row.projectId,
      tower: dims.torres.get(row.towerId) ?? "Sin dato",
      vendido: 0,
      congelado: 0,
      disponible: 0,
    };
    const kind = bucket(row.pageStatus);
    if (kind !== "otro") current[kind] += 1;
    towers.set(key, current);
  }
  const vendidoPrice = prices(groups.vendido);
  const congeladoPrice = prices(groups.congelado);
  const disponiblePrice = prices(groups.disponible);
  const choices = emptyChoices();
  choices.torre = countChoices(stock.map((row) => row.towerId), dims.torres);
  choices.estadoUnidad = [...new Set(stock.map((row) => row.pageStatus))]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((status) => ({ id: status, label: status }));
  const dotted = range.to.split("-").reverse().join(".");
  return {
    ...base(
      "¿Cuánto inventario está vendido, congelado y disponible?",
      range,
      `Inventario al ${dotted}. El precio de lista de Santa Elena queda en dólares. No se suma con los quetzales.`,
      empty ? NO_STOCK : otros > 0 ? `${otros} unidades están en otro estado.` : null,
      dims,
      choices,
    ),
    section: "inventario-general",
    asOf: range.to,
    vendido: groups.vendido.length,
    congelado: groups.congelado.length,
    disponible: groups.disponible.length,
    vendidoGtq: vendidoPrice.gtq,
    vendidoUsd: vendidoPrice.usd,
    congeladoGtq: congeladoPrice.gtq,
    congeladoUsd: congeladoPrice.usd,
    disponibleGtq: disponiblePrice.gtq,
    disponibleUsd: disponiblePrice.usd,
    otros,
    byProject,
    byTower: [...towers.values()],
  };
}

const NONE_PROJECT = "00000000-0000-0000-0000-000000000000";

function projectList(filters: VistaFilters): string[] | null {
  if (filters.projectIds === null) return null;
  if (filters.projectIds.length === 0) return [NONE_PROJECT];
  return filters.projectIds;
}

async function buildValor(
  client: Db,
  filters: VistaFilters,
  range: DateWindow,
  dims: Dims,
  stock: StockRow[],
  emptyStock: boolean,
): Promise<ValorVista> {
  const from = monthsBack(range.to, 12);
  const window = { from, to: range.to };
  const [sales, losses] = await Promise.all([
    fetchDated(client, "v_sale", "sale_on", "deal_id,unit_id,project_id,tower_id,sale_on,value_gtq", window.from, window.to, (query) =>
      scopeProject(query, filters),
    ),
    fetchDated(client, "v_sale", "lost_on", "deal_id,unit_id,project_id,tower_id,sale_on,lost_on,value_gtq", window.from, window.to, (query) =>
      scopeProject(query, filters),
    ),
  ]);
  const inPeriod = (day: unknown) => {
    const value = typeof day === "string" ? day.slice(0, 10) : "";
    return value >= range.from && value <= range.to;
  };
  if (filters.torreId) {
    sales.rows = sales.rows.filter((row) => String(row.tower_id) === filters.torreId);
    losses.rows = losses.rows.filter((row) => String(row.tower_id) === filters.torreId);
  }
  const periodLosses = losses.rows.filter((row) => inPeriod(row.lost_on));
  const months = monthsTouched(from, range.to);
  const points = months.map((month) => {
    const end = monthEnd(month);
    const saleValue = sumGtq(sales.rows.filter((row) => inMonth(row.sale_on, month, end)));
    const lossValue = sumGtq(losses.rows.filter((row) => inMonth(row.lost_on, month, end)));
    return { label: shortMonth(month), ventas: saleValue ?? 0, desistido: lossValue ?? 0 };
  });
  const disponible = stock.filter((row) => bucket(row.pageStatus) === "disponible");
  const list = prices(stock);
  const lossGtq = sumGtq(periodLosses);
  const projectIds = new Set<string>([
    ...disponible.map((row) => row.projectId),
    ...periodLosses.map((row) => String(row.project_id)),
  ]);
  const byProject = [...projectIds]
    .map((id) => {
      const listPrice = prices(disponible.filter((row) => row.projectId === id));
      return {
        id,
        label: dims.projects.find((project) => project.id === id)?.name ?? "Sin dato",
        disponibleGtq: listPrice.gtq,
        disponibleUsd: listPrice.usd,
        desistidoGtq: sumGtq(periodLosses.filter((row) => String(row.project_id) === id)),
      };
    })
    .sort((a, b) => (b.desistidoGtq ?? 0) - (a.desistidoGtq ?? 0) || a.label.localeCompare(b.label, "es"));
  const traces = await lossTraces(client, periodLosses.slice(0, 80), dims, stock);
  const choices = emptyChoices();
  choices.torre = countChoices(
    [...sales.rows, ...losses.rows].map((row) => String(row.tower_id)),
    dims.torres,
  );
  const notice = [emptyStock ? NO_STOCK : null, sales.capped || losses.capped ? "La consulta del año llegó a 5.000 filas. Afina el proyecto." : null]
    .filter(Boolean)
    .join(" ") || null;
  return {
    ...base(
      "¿Cuánto vale el proyecto hoy, y cuánto valor salió por desistimientos?",
      range,
      "La línea cubre doce meses. El valor desistido del recuadro es solo el periodo. No hay reembolso en la base: no se inventa.",
      notice,
      dims,
      choices,
    ),
    section: "valor-del-proyecto",
    listGtq: list.gtq,
    listUsd: list.usd,
    lossUnits: periodLosses.length,
    lossGtq,
    months: points,
    byProject,
    traces,
  };
}

function scopeProject(query: DatedQuery, filters: VistaFilters): DatedQuery {
  const ids = projectList(filters);
  if (ids) return query.in("project_id", ids);
  return query;
}

function inMonth(value: unknown, month: string, end: string): boolean {
  const day = typeof value === "string" ? value.slice(0, 10) : "";
  return day >= month && day <= end;
}

function sumGtq(rows: Record<string, unknown>[]): number | null {
  let total = 0;
  let seen = false;
  for (const row of rows) {
    const value = num(row.value_gtq);
    if (value == null) continue;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

async function lossTraces(
  client: Db,
  rows: Record<string, unknown>[],
  dims: Dims,
  stock: StockRow[],
): Promise<ValorVista["traces"]> {
  const ids = [...new Set(rows.map((row) => String(row.unit_id)))];
  const names = await unitNames(client, ids);
  const status = new Map(stock.map((row) => [row.unitId, row.pageStatus]));
  return rows.map((row) => {
    const unitId = String(row.unit_id);
    return {
      unit: names.get(unitId) ?? unitId,
      project: dims.projects.find((project) => project.id === String(row.project_id))?.name ?? "Sin dato",
      tower: dims.torres.get(String(row.tower_id)) ?? "Sin dato",
      saleOn: typeof row.sale_on === "string" ? row.sale_on.slice(0, 10) : null,
      lostOn: String(row.lost_on).slice(0, 10),
      gtq: num(row.value_gtq),
      status: status.get(unitId) ?? "Sin inventario",
    };
  });
}

async function unitNames(client: Db, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (let index = 0; index < ids.length && index < 800; index += 200) {
    const chunk = ids.slice(index, index + 200);
    if (chunk.length === 0) break;
    const { data, error } = await client.from("dim_unit").select("id,canonical_unit").in("id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) names.set(String(row.id), String(row.canonical_unit));
  }
  return names;
}

async function countRows(client: Db, table: string, column: string, from: string, to: string, filters: VistaFilters): Promise<number> {
  let query = client.from(table).select("*", { count: "exact", head: true }).gte(column, from).lte(column, to);
  const ids = projectList(filters);
  if (ids) query = query.in("project_id", ids);
  if (filters.asesorId) query = query.eq("asesor_id", filters.asesorId);
  if (filters.fuenteId) query = query.eq("fuente_id", filters.fuenteId);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function buildConversion(client: Db, filters: VistaFilters, range: DateWindow): Promise<ConversionVista> {
  const from = monthsBack(range.to, 6);
  const dims = await loadDims(client);
  const projectScope = (query: DatedQuery): DatedQuery => {
    let scoped = query;
    const ids = projectList(filters);
    if (ids) scoped = query.in("project_id", ids);
    if (filters.asesorId) scoped = scoped.eq("asesor_id", filters.asesorId);
    if (filters.fuenteId) scoped = scoped.eq("fuente_id", filters.fuenteId);
    return scoped;
  };
  const monthStarts = monthsTouched(from, range.to);
  const [leadTotal, saleTotal, monthSeries, leads, sales, visits, pcvs] = await Promise.all([
    countRows(client, "dim_deal", "add_on", range.from, range.to, filters),
    countRows(client, "v_sale", "sale_on", range.from, range.to, filters),
    Promise.all(monthStarts.map(async (month) => {
      const end = monthEnd(month) < range.to ? monthEnd(month) : range.to;
      const [leadCount, saleCount] = await Promise.all([
        countRows(client, "dim_deal", "add_on", month, end, filters),
        countRows(client, "v_sale", "sale_on", month, end, filters),
      ]);
      return { label: shortMonth(month), leads: leadCount, sales: saleCount, rate: rate(saleCount, leadCount) };
    })),
    fetchDated(client, "dim_deal", "add_on", "id,add_on,project_id,asesor_id,fuente_id", range.from, range.to, projectScope),
    fetchDated(client, "v_sale", "sale_on", "deal_id,sale_on,project_id,asesor_id,fuente_id", range.from, range.to, projectScope),
    fetchDated(client, "fact_visit", "visit_on", "deal_id,fuente_id,visit_on", range.from, range.to, (query) =>
      filters.fuenteId ? query.eq("fuente_id", filters.fuenteId) : query,
    ),
    fetchDated(client, "fact_pcv_issuance", "clock_on", "deal_id,clock_on", range.from, range.to),
  ]);
  const dealIds = [...new Set([
    ...visits.rows.map((row) => (row.deal_id ? String(row.deal_id) : "")),
    ...pcvs.rows.map((row) => String(row.deal_id)),
  ].filter(Boolean))];
  const deals = await dealStamps(client, dealIds);
  const visitRows = visits.rows.filter((row) => passDeal(row.deal_id ? String(row.deal_id) : null, deals, filters));
  const pcvRows = pcvs.rows.filter((row) => passDeal(String(row.deal_id), deals, filters));
  const periodLeads = leads.rows;
  const periodSales = sales.rows;
  const byFuente = rateRows(
    uniqueIds(periodLeads, "fuente_id", visitRows, "fuente_id", periodSales, "fuente_id"),
    (id) => dims.fuentes.get(id)?.name ?? "Sin dato",
    periodLeads,
    visitRows,
    periodSales,
    pcvRows,
    deals,
    "fuente_id",
  );
  const byAsesor = rateRows(
    uniqueIds(periodLeads, "asesor_id", periodSales, "asesor_id"),
    (id) => dims.asesores.get(id)?.name ?? "Sin dato",
    periodLeads,
    visitRows,
    periodSales,
    pcvRows,
    deals,
    "asesor_id",
  );
  const choices = emptyChoices();
  choices.fuente = countChoices(periodLeads.map((row) => String(row.fuente_id)), new Map([...dims.fuentes].map(([id, row]) => [id, row.name])));
  choices.asesor = countChoices(periodLeads.map((row) => String(row.asesor_id)), new Map([...dims.asesores].map(([id, row]) => [id, row.name])));
  const capped = leads.capped || sales.capped || visits.capped || pcvs.capped;
  return {
    ...base(
      "De los leads del periodo, ¿cuántos llegan a visita, a venta y a PCV?",
      range,
      VISIT_CAPTION,
      capped ? "El detalle por fuente llegó al tope de filas. Las tasas usan el conteo completo del periodo." : leadTotal === 0 ? "Este periodo todavía no tiene leads." : null,
      dims,
      choices,
    ),
    section: "tasa-de-conversion",
    leads: leadTotal,
    visits: visitRows.length,
    sales: saleTotal,
    pcv: pcvRows.length,
    saleRate: rate(saleTotal, leadTotal),
    pcvRate: rate(pcvRows.length, leadTotal),
    funnel: [
      { label: "Leads", units: leadTotal },
      { label: "Visitas", units: visitRows.length },
      { label: "Ventas", units: saleTotal },
      { label: "PCV", units: pcvRows.length },
    ],
    months: monthSeries,
    byFuente,
    byAsesor,
  };
}

function passDeal(dealId: string | null, deals: Map<string, DealStamp>, filters: VistaFilters): boolean {
  if (!filters.projectIds && !filters.asesorId) return true;
  if (!dealId) return filters.projectIds === null && !filters.asesorId;
  const deal = deals.get(dealId);
  if (!deal) return false;
  if (!projectOk(deal.projectId, filters)) return false;
  if (filters.asesorId && deal.asesorId !== filters.asesorId) return false;
  return true;
}

async function dealStamps(client: Db, ids: string[]): Promise<Map<string, DealStamp>> {
  const stamps = new Map<string, DealStamp>();
  for (let index = 0; index < ids.length && index < CAP; index += 200) {
    const chunk = ids.slice(index, index + 200);
    if (chunk.length === 0) break;
    const { data, error } = await client.from("dim_deal").select("id,project_id,asesor_id,fuente_id").in("id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      stamps.set(String(row.id), {
        projectId: String(row.project_id),
        asesorId: String(row.asesor_id),
        fuenteId: String(row.fuente_id),
      });
    }
  }
  return stamps;
}

function uniqueIds(...groups: (Record<string, unknown>[] | string)[]): string[] {
  const ids = new Set<string>();
  for (let index = 0; index < groups.length; index += 2) {
    const rows = groups[index] as Record<string, unknown>[];
    const key = groups[index + 1] as string;
    for (const row of rows) if (row[key]) ids.add(String(row[key]));
  }
  return [...ids];
}

function rateRows(
  ids: string[],
  labelOf: (id: string) => string,
  leads: Record<string, unknown>[],
  visits: Record<string, unknown>[],
  sales: Record<string, unknown>[],
  pcvs: Record<string, unknown>[],
  deals: Map<string, DealStamp>,
  key: "fuente_id" | "asesor_id",
): RateRow[] {
  return ids
    .map((id) => {
      const leadCount = leads.filter((row) => String(row[key]) === id).length;
      const visitCount = visits.filter((row) => stampKey(row, deals, key) === id).length;
      const saleCount = sales.filter((row) => String(row[key]) === id).length;
      const pcvCount = pcvs.filter((row) => stampKey(row, deals, key) === id).length;
      return { id, label: labelOf(id), leads: leadCount, visits: visitCount, sales: saleCount, pcv: pcvCount, saleRate: rate(saleCount, leadCount) };
    })
    .filter((row) => row.leads + row.visits + row.sales + row.pcv > 0)
    .sort((a, b) => b.sales - a.sales || b.leads - a.leads || a.label.localeCompare(b.label, "es"))
    .slice(0, 20);
}

function stampKey(row: Record<string, unknown>, deals: Map<string, DealStamp>, key: "fuente_id" | "asesor_id"): string {
  if (row[key]) return String(row[key]);
  const dealId = row.deal_id ? String(row.deal_id) : "";
  const deal = deals.get(dealId);
  if (!deal) return "";
  return key === "fuente_id" ? deal.fuenteId : deal.asesorId;
}

export type UnitDetalle = {
  title: string;
  note: string | null;
  units: { unit: string; tower: string; model: string; status: string; amount: number | null; currency: string | null }[];
};

export async function buildUnitDetalle(section: StockSection, filters: VistaFilters): Promise<UnitDetalle> {
  const today = guatemalaToday();
  const range = resolveRange(filters.preset, filters.customFrom, filters.customTo, today);
  const client = db();
  const dims = await loadDims(client);
  const stock = filterStock(await stockAt(client, range.to), filters, await searchUnits(client, filters.buscar));
  const ids = stock.map((row) => row.unitId).slice(0, 400);
  const names = await unitNames(client, ids);
  return {
    title: filters.modeloId ? (dims.models.get(filters.modeloId) ?? "Modelo") : "Unidades",
    note: stock.length > 400 ? "La lista muestra 400 unidades." : null,
    units: stock.slice(0, 400).map((row) => ({
      unit: names.get(row.unitId) ?? row.unitId,
      tower: dims.torres.get(row.towerId) ?? "Sin dato",
      model: dims.models.get(row.modelId) ?? "Sin dato",
      status: row.pageStatus,
      amount: row.amount,
      currency: row.currency,
    })),
  };
}

const CONTROL_SECTIONS = ["desistimientos", "descuentos", "subidas-de-precios", "ff-y-casos-especiales", "promociones"] as const;
type ControlSection = (typeof CONTROL_SECTIONS)[number];

export function isControlSection(section: string): section is ControlSection {
  return (CONTROL_SECTIONS as readonly string[]).includes(section);
}

const NO_PIPEDRIVE = "No hay datos en PipeDrive.";

async function tableCount(client: Db, table: string): Promise<number> {
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function barsFrom(rows: Record<string, unknown>[], key: string, labelOf: (id: string) => string): NamedBar[] {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const id = String(row[key] ?? "");
    const list = groups.get(id) ?? [];
    list.push(row);
    groups.set(id, list);
  }
  return [...groups.entries()]
    .map(([id, list]) => ({ id, label: labelOf(id), units: list.length, gtq: sumGtq(list) }))
    .sort((a, b) => b.units - a.units || a.label.localeCompare(b.label, "es"));
}

export async function buildControlVista(section: ControlSection, filters: VistaFilters): Promise<VentasVista> {
  const today = guatemalaToday();
  const range = resolveRange(filters.preset, filters.customFrom, filters.customTo, today);
  const client = db();
  const dims = await loadDims(client);
  if (section === "desistimientos") return buildDesistencias(client, filters, range, dims);
  if (section === "descuentos") return buildDescuentos(client, filters, range, dims);
  if (section === "subidas-de-precios") return buildPrecios(client, filters, range, dims);
  if (section === "ff-y-casos-especiales") return buildCasos(client, filters, range, dims);
  return buildPromos(client, filters, range, dims);
}

async function buildDesistencias(client: Db, filters: VistaFilters, range: DateWindow, dims: Dims): Promise<DesistenciaVista> {
  const losses = await fetchDated(
    client,
    "v_sale",
    "lost_on",
    "deal_id,unit_id,project_id,tower_id,asesor_id,lost_reason_id,sale_on,lost_on,value_gtq",
    range.from,
    range.to,
    (query) => {
      let next = scopeProject(query, filters);
      if (filters.asesorId) next = next.eq("asesor_id", filters.asesorId);
      if (filters.motivoId) next = next.eq("lost_reason_id", filters.motivoId);
      return next;
    },
  );
  const rows = losses.rows;
  const names = await unitNames(client, rows.map((row) => String(row.unit_id)).slice(0, 80));
  const choices = emptyChoices();
  choices.motivo = countChoices(rows.map((row) => String(row.lost_reason_id)), dims.reasons);
  choices.asesor = countChoices(rows.map((row) => String(row.asesor_id)), new Map([...dims.asesores].map(([id, row]) => [id, row.name])));
  return {
    ...base(
      "¿Cuánto se desistió, y qué valor sale del proyecto?",
      range,
      "El valor es el del trato. Retención y reembolso no están en la base: no se muestran en cero.",
      losses.capped ? "La consulta del periodo llegó a 5.000 filas. Afina proyecto o periodo." : rows.length === 0 ? "No hay desistimientos en este periodo." : null,
      dims,
      choices,
    ),
    section: "desistimientos",
    units: rows.length,
    gtq: sumGtq(rows),
    motivos: barsFrom(rows, "lost_reason_id", (id) => dims.reasons.get(id) ?? "Sin dato"),
    byProject: barsFrom(rows, "project_id", (id) => dims.projects.find((project) => project.id === id)?.name ?? "Sin dato"),
    byAsesor: barsFrom(rows, "asesor_id", (id) => dims.asesores.get(id)?.name ?? "Sin dato"),
    traces: rows.slice(0, 80).map((row) => ({
      unit: names.get(String(row.unit_id)) ?? String(row.unit_id),
      project: dims.projects.find((project) => project.id === String(row.project_id))?.name ?? "Sin dato",
      asesor: dims.asesores.get(String(row.asesor_id))?.name ?? "Sin dato",
      motivo: dims.reasons.get(String(row.lost_reason_id)) ?? "Sin dato",
      lostOn: String(row.lost_on).slice(0, 10),
      gtq: num(row.value_gtq),
    })),
  };
}

async function periodSales(client: Db, filters: VistaFilters, range: DateWindow, columns: string) {
  return fetchDated(client, "v_sale", "sale_on", columns, range.from, range.to, (query) => {
    let next = scopeProject(query, filters);
    if (filters.asesorId) next = next.eq("asesor_id", filters.asesorId);
    if (filters.promocionId) next = next.eq("promotion_type_id", filters.promocionId);
    return next;
  });
}

async function buildDescuentos(client: Db, filters: VistaFilters, range: DateWindow, dims: Dims): Promise<DescuentoVista> {
  const loaded = await tableCount(client, "fact_discount");
  const choices = emptyChoices();
  if (loaded === 0) {
    return {
      ...base("¿Cuánto descuento se está otorgando, y quién lo concentra?", range, "El descuento entra con Odoo. Hasta entonces no hay cifra.", NO_PIPEDRIVE, dims, choices),
      section: "descuentos",
      units: 0,
      gtq: null,
      share: null,
      saleGtq: null,
      tipos: [],
      byAsesor: [],
      traces: [],
    };
  }
  const sales = await periodSales(client, filters, range, "deal_id,project_id,asesor_id,value_gtq,sale_on");
  const dealIds = sales.rows.map((row) => String(row.deal_id));
  const discounts = await rowsIn(client, "fact_discount", "deal_id,discount_type_id,amount_gtq,rate", "deal_id", dealIds);
  const filtered = filters.descuentoId ? discounts.filter((row) => String(row.discount_type_id) === filters.descuentoId) : discounts;
  const saleByDeal = new Map(sales.rows.map((row) => [String(row.deal_id), row]));
  const withSale: Record<string, unknown>[] = filtered.map((row) => ({
    ...row,
    asesor_id: saleByDeal.get(String(row.deal_id))?.asesor_id,
    value_gtq: row.amount_gtq,
  }));
  const saleGtq = sumGtq(sales.rows.filter((row) => filtered.some((item) => String(item.deal_id) === String(row.deal_id))));
  const discountGtq = sumGtq(withSale);
  choices.descuento = countChoices(filtered.map((row) => String(row.discount_type_id)), new Map([...dims.discounts].map(([id, row]) => [id, row.name])));
  choices.asesor = countChoices(withSale.map((row) => String(row.asesor_id ?? "")), new Map([...dims.asesores].map(([id, row]) => [id, row.name])));
  return {
    ...base(
      "¿Cuánto descuento se está otorgando, y quién lo concentra?",
      range,
      "La participación es el descuento sobre el valor de las ventas que lo traen.",
      filtered.length === 0 ? "No hay descuentos en este periodo." : null,
      dims,
      choices,
    ),
    section: "descuentos",
    units: filtered.length,
    gtq: discountGtq ?? 0,
    share: saleGtq ? (discountGtq ?? 0) / saleGtq : null,
    saleGtq,
    tipos: barsFrom(withSale, "discount_type_id", (id) => dims.discounts.get(id)?.name ?? "Sin dato"),
    byAsesor: barsFrom(withSale, "asesor_id", (id) => dims.asesores.get(id)?.name ?? "Sin dato"),
    traces: withSale.slice(0, 80).map((row) => ({
      asesor: dims.asesores.get(String(row.asesor_id ?? ""))?.name ?? "Sin dato",
      tipo: dims.discounts.get(String(row.discount_type_id))?.name ?? "Sin dato",
      gtq: num(row.amount_gtq) ?? 0,
      rate: num(row.rate),
    })),
  };
}

async function rowsIn(client: Db, table: string, select: string, column: string, ids: string[]): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let index = 0; index < ids.length && index < CAP; index += 200) {
    const chunk = ids.slice(index, index + 200);
    if (chunk.length === 0) break;
    const { data, error } = await client.from(table).select(select).in(column, chunk);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  }
  return rows;
}

async function buildPrecios(client: Db, filters: VistaFilters, range: DateWindow, dims: Dims): Promise<PrecioVista> {
  const loaded = await tableCount(client, "fact_price_rise");
  const choices = emptyChoices();
  choices.torre = [...dims.torres.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  if (loaded === 0) {
    return {
      ...base("¿Cuánto subió el precio de lista, y en qué proyectos?", range, "La subida entra con Odoo. Quetzales y dólares no se suman.", NO_PIPEDRIVE, dims, choices),
      section: "subidas-de-precios",
      units: 0,
      gtq: null,
      usd: null,
      byProject: [],
      months: [],
      traces: [],
    };
  }
  const from = monthsBack(range.to, 12);
  const rises = await fetchDated(
    client,
    "fact_price_rise",
    "effective_on",
    "unit_id,tower_id,effective_on,previous_amount,new_amount,difference_amount,currency",
    from,
    range.to,
    (query) => (filters.torreId ? query.eq("tower_id", filters.torreId) : query),
  );
  const scoped = rises.rows.filter((row) => {
    const towerId = String(row.tower_id);
    const projectId = projectOfTower(dims, towerId);
    return projectOk(projectId, filters);
  });
  const period = scoped.filter((row) => {
    const day = String(row.effective_on).slice(0, 10);
    return day >= range.from && day <= range.to;
  });
  const gtqRows = period.filter((row) => row.currency === "GTQ");
  const usdRows = period.filter((row) => row.currency === "USD");
  const months = monthsTouched(from, range.to).map((month) => {
    const end = monthEnd(month);
    const slice = scoped.filter((row) => inMonth(row.effective_on, month, end));
    return {
      label: shortMonth(month),
      gtq: sumAmount(slice.filter((row) => row.currency === "GTQ"), "difference_amount") ?? 0,
      usd: sumAmount(slice.filter((row) => row.currency === "USD"), "difference_amount") ?? 0,
    };
  });
  const projectIds = new Set(period.map((row) => projectOfTower(dims, String(row.tower_id))));
  const names = await unitNames(client, period.map((row) => String(row.unit_id)).slice(0, 80));
  return {
    ...base(
      "¿Cuánto subió el precio de lista, y en qué proyectos?",
      range,
      "La línea cubre doce meses. El recuadro es el periodo. Dólares y quetzales van aparte.",
      rises.capped ? "La consulta llegó a 5.000 filas." : period.length === 0 ? "No hay subidas en este periodo." : null,
      dims,
      choices,
    ),
    section: "subidas-de-precios",
    units: period.length,
    gtq: sumAmount(gtqRows, "difference_amount") ?? 0,
    usd: sumAmount(usdRows, "difference_amount") ?? 0,
    byProject: [...projectIds].map((id) => {
      const mine = period.filter((row) => projectOfTower(dims, String(row.tower_id)) === id);
      return {
        id,
        label: dims.projects.find((project) => project.id === id)?.name ?? "Sin dato",
        units: mine.length,
        gtq: sumAmount(mine.filter((row) => row.currency === "GTQ"), "difference_amount"),
        usd: sumAmount(mine.filter((row) => row.currency === "USD"), "difference_amount"),
      };
    }).sort((a, b) => (b.gtq ?? 0) - (a.gtq ?? 0) || a.label.localeCompare(b.label, "es")),
    months,
    traces: period.slice(0, 80).map((row) => ({
      unit: names.get(String(row.unit_id)) ?? String(row.unit_id),
      tower: dims.torres.get(String(row.tower_id)) ?? "Sin dato",
      previous: num(row.previous_amount) ?? 0,
      next: num(row.new_amount) ?? 0,
      difference: num(row.difference_amount) ?? 0,
      currency: String(row.currency),
    })),
  };
}

function projectOfTower(dims: Dims, towerId: string): string {
  return dims.towerProjects.get(towerId) ?? "";
}

function sumAmount(rows: Record<string, unknown>[], key: string): number | null {
  let total = 0;
  let seen = false;
  for (const row of rows) {
    const value = num(row[key]);
    if (value == null) continue;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

async function buildCasos(client: Db, filters: VistaFilters, range: DateWindow, dims: Dims): Promise<CasoVista> {
  const loaded = await tableCount(client, "fact_case_mark");
  const sales = await periodSales(client, filters, range, "deal_id,unit_id,project_id,asesor_id,value_gtq,sale_on");
  const choices = emptyChoices();
  choices.asesor = countChoices(sales.rows.map((row) => String(row.asesor_id)), new Map([...dims.asesores].map(([id, row]) => [id, row.name])));
  if (loaded === 0) {
    return {
      ...base(
        "¿Cuántas ventas del periodo son Friends & Family o caso especial, y qué peso tienen?",
        range,
        "Estas ventas siguen dentro de Ventas totales. La marca entra con Odoo.",
        NO_PIPEDRIVE,
        dims,
        choices,
      ),
      section: "ff-y-casos-especiales",
      marked: null,
      ff: null,
      especial: null,
      sales: sales.rows.length,
      share: null,
      tipos: sales.rows.length ? [{ id: "resto", label: "Ventas del periodo", units: sales.rows.length, gtq: sumGtq(sales.rows) }] : [],
      byProject: barsFrom(sales.rows, "project_id", (id) => dims.projects.find((project) => project.id === id)?.name ?? "Sin dato").map((row) => ({
        id: row.id,
        label: row.label,
        marked: 0,
        sales: row.units,
        share: null,
      })),
      traces: [],
    };
  }
  const marks = await rowsIn(client, "fact_case_mark", "deal_id,case_type_id", "deal_id", sales.rows.map((row) => String(row.deal_id)));
  const filtered = filters.casoId ? marks.filter((row) => String(row.case_type_id) === filters.casoId) : marks;
  const markedDeals = new Set(filtered.map((row) => String(row.deal_id)));
  const ff = filtered.filter((row) => /friend|familia/i.test(dims.cases.get(String(row.case_type_id))?.name ?? "")).length;
  const especial = filtered.length - ff;
  const tipos = barsFrom(filtered.map((row) => ({ ...row, value_gtq: null })), "case_type_id", (id) => dims.cases.get(id)?.name ?? "Sin dato");
  const resto = sales.rows.filter((row) => !markedDeals.has(String(row.deal_id)));
  if (resto.length) tipos.push({ id: "resto", label: "Resto de ventas", units: resto.length, gtq: sumGtq(resto) });
  const names = await unitNames(client, sales.rows.filter((row) => markedDeals.has(String(row.deal_id))).map((row) => String(row.unit_id)).slice(0, 80));
  const saleByDeal = new Map(sales.rows.map((row) => [String(row.deal_id), row]));
  choices.caso = countChoices(filtered.map((row) => String(row.case_type_id)), new Map([...dims.cases].map(([id, row]) => [id, row.name])));
  const projectIds = new Set(sales.rows.map((row) => String(row.project_id)));
  return {
    ...base(
      "¿Cuántas ventas del periodo son Friends & Family o caso especial, y qué peso tienen?",
      range,
      "Estas ventas siguen dentro de Ventas totales.",
      filtered.length === 0 ? "No hay casos en este periodo." : null,
      dims,
      choices,
    ),
    section: "ff-y-casos-especiales",
    marked: filtered.length,
    ff,
    especial,
    sales: sales.rows.length,
    share: sales.rows.length ? filtered.length / sales.rows.length : null,
    tipos,
    byProject: [...projectIds].map((id) => {
      const mine = sales.rows.filter((row) => String(row.project_id) === id);
      const marked = mine.filter((row) => markedDeals.has(String(row.deal_id))).length;
      return {
        id,
        label: dims.projects.find((project) => project.id === id)?.name ?? "Sin dato",
        marked,
        sales: mine.length,
        share: mine.length ? marked / mine.length : null,
      };
    }).sort((a, b) => b.marked - a.marked || a.label.localeCompare(b.label, "es")),
    traces: filtered.slice(0, 80).map((row) => {
      const sale = saleByDeal.get(String(row.deal_id));
      return {
        unit: names.get(String(sale?.unit_id ?? "")) ?? "Sin unidad",
        project: dims.projects.find((project) => project.id === String(sale?.project_id ?? ""))?.name ?? "Sin dato",
        asesor: dims.asesores.get(String(sale?.asesor_id ?? ""))?.name ?? "Sin dato",
        tipo: dims.cases.get(String(row.case_type_id))?.name ?? "Sin dato",
        gtq: num(sale?.value_gtq),
      };
    }),
  };
}

async function buildPromos(client: Db, filters: VistaFilters, range: DateWindow, dims: Dims): Promise<PromoVista> {
  const from = monthsBack(range.to, 6);
  const trail = await fetchDated(
    client,
    "v_sale",
    "sale_on",
    "deal_id,project_id,asesor_id,promotion_type_id,sale_on,value_gtq",
    from,
    range.to,
    (query) => {
      let next = scopeProject(query, filters);
      if (filters.asesorId) next = next.eq("asesor_id", filters.asesorId);
      return next;
    },
  );
  const period = trail.rows.filter((row) => {
    const day = String(row.sale_on).slice(0, 10);
    return day >= range.from && day <= range.to && (!filters.promocionId || String(row.promotion_type_id) === filters.promocionId);
  });
  const named = period.filter((row) => dims.promotions.get(String(row.promotion_type_id))?.sin !== true);
  const tipos = barsFrom(period, "promotion_type_id", (id) => dims.promotions.get(id)?.name ?? "Sin dato");
  const ranked = tipos.filter((row) => dims.promotions.get(row.id)?.sin !== true);
  const leader = ranked[0] ?? null;
  const months = monthsTouched(from, range.to);
  const series = ranked.slice(0, 4).map((row) => ({
    id: row.id,
    label: row.label,
    units: months.map((month) => trail.rows.filter((sale) => String(sale.promotion_type_id) === row.id && inMonth(sale.sale_on, month, monthEnd(month) < range.to ? monthEnd(month) : range.to)).length),
  }));
  const asesorGroups = new Map<string, Record<string, unknown>[]>();
  for (const row of named) {
    const key = `${row.asesor_id}|${row.promotion_type_id}`;
    const list = asesorGroups.get(key) ?? [];
    list.push(row);
    asesorGroups.set(key, list);
  }
  const choices = emptyChoices();
  choices.promocion = countChoices(period.map((row) => String(row.promotion_type_id)), new Map([...dims.promotions].map(([id, row]) => [id, row.name])));
  choices.asesor = countChoices(period.map((row) => String(row.asesor_id)), new Map([...dims.asesores].map(([id, row]) => [id, row.name])));
  return {
    ...base(
      "¿Qué promociones están cerrando ventas, y qué peso tienen?",
      range,
      "Sin promoción queda en su propia barra. La línea son las cuatro promociones con más ventas.",
      trail.capped ? "La consulta llegó a 5.000 filas. Afina el proyecto." : period.length === 0 ? NO_SALES : null,
      dims,
      choices,
    ),
    section: "promociones",
    units: period.length,
    promoted: named.length,
    gtq: sumGtq(named),
    leader: leader?.label ?? null,
    leaderShare: period.length && leader ? leader.units / period.length : null,
    tipos,
    months: months.map(shortMonth),
    series,
    byAsesor: [...asesorGroups.entries()].map(([key, list]) => {
      const [asesorId, promoId] = key.split("|");
      return {
        asesor: dims.asesores.get(asesorId)?.name ?? "Sin dato",
        promocion: dims.promotions.get(promoId)?.name ?? "Sin dato",
        units: list.length,
        gtq: sumGtq(list),
      };
    }).sort((a, b) => b.units - a.units).slice(0, 20),
  };
}
