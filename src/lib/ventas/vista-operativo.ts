import { createAdminClient } from "@/lib/supabase/admin";
import { projectKey } from "@/lib/projects";
import { odooTowerLabel, towerIdentity } from "./tower-label";
import { EMBUDO_PIPELINES, embudoFunnel, type EmbudoInput } from "./embudo";
import { resolveRange, windowLabel, guatemalaToday, type DateWindow } from "./period";
import { creditedAsesor, factComprobanteHasAsesor } from "./reserva-asesor";
import type { VistaFilters } from "./vista";
import { REFERIDO_TIPOS } from "./vista-types";
import type {
  AnalisisVista,
  CasoVista,
  Choice,
  ConversionVista,
  DescuentoVista,
  DesistenciaVista,
  InventarioVista,
  InventoryCounts,
  InventoryStatusKey,
  InventoryUnitRef,
  ModeloSplit,
  NamedBar,
  PrecioVista,
  PromoVista,
  ReferidosVista,
  SplitMove,
  SplitStatus,
  SplitUnit,
  ValorVista,
  VentasVista,
} from "./vista-types";

const PAGE = 1000;
const CAP = 5000;
const STOCK_MS = 60_000;
const NO_SALES = "Este periodo todavía no tiene ventas.";
const NO_STOCK = "Este inventario todavía no tiene filas.";

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

function bucket(status: string): "vendido" | "reservado" | "congelado" | "disponible" | "otro" {
  if (status === "Vendido") return "vendido";
  if (status === "Reservado") return "reservado";
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
  if (section === "inventario-general") {
    const [dims, units] = await Promise.all([loadDims(client), loadRvUnits()]);
    return buildInventory(range, dims, units, filters, today);
  }
  if (section === "valor-del-proyecto") {
    const dims = await loadDims(client);
    return buildValor(client, filters, range, dims);
  }
  const dims = await loadDims(client);
  const [stock, unitIds] = await Promise.all([stockAt(client, range.to), searchUnits(client, filters.buscar)]);
  const rows = filterStock(stock, filters, unitIds);
  return buildAnalisis(client, filters, range, dims, rows);
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
      byTower.push({
        modelId: model.id,
        towerId,
        projectId: dims.towerProjects.get(towerId) ?? "",
        tower: dims.torres.get(towerId) ?? "Sin dato",
        sold: value.sold,
        available: value.available,
      });
    }
  }
  const choices = emptyChoices();
  choices.modelo = countChoices([...ids], dims.models);
  choices.torre = countChoices(sold.rows.map((row) => String(row.tower_id)), dims.torres);
  choices.habitaciones = countChoices(sold.rows.map((row) => String(row.habitaciones_id)), dims.habitaciones);
  const leader = models.find((model) => model.sold > 0) ?? null;
  const available = models.reduce((sum, model) => sum + model.available, 0);
  const units = await loadRvUnits();
  const modelSales = saleRowsFromUnits(units, filters, dims);
  const split = await buildModeloSplit(client, filters, range, dims, units);
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
    modelSales,
    split,
  };
}

type AvailabilityUnit = {
  projectSlug: string;
  unitType: string;
  areaTotal: number | null;
  status: string;
  towerId: string;
  towerName: string;
  towerIsDefault: boolean;
  number: string;
  unitCode: string;
  code: string;
};

type ModelCount = keyof Pick<InventarioVista["byModel"][number], "vendido" | "reservado" | "congelado" | "disponible">;

const AVAILABILITY_SLUGS: { slug: string; name: string }[] = [
  { slug: "boulevard-5", name: "BOULEVARD 5" },
  { slug: "benestare", name: "BENESTARE" },
  { slug: "bosque-las-tapias", name: "BOSQUE LAS TAPIAS" },
  { slug: "santa-elena", name: "SANTA ELENA" },
];

async function loadRvUnits(): Promise<AvailabilityUnit[]> {
  const client = createAdminClient();
  const units: AvailabilityUnit[] = [];
  for (let offset = 0; offset < CAP; offset += PAGE) {
    const { data, error } = await client
      .from("v_rv_units_full")
      .select("project_slug, unit_type, area_total, status, tower_id, tower_name, tower_is_default, unit_number, unit_code")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of batch) {
      const area = row.area_total == null || row.area_total === "" ? null : Number(row.area_total);
      const number = String(row.unit_number ?? "");
      const unitCode = String(row.unit_code ?? "");
      units.push({
        projectSlug: String(row.project_slug ?? ""),
        unitType: String(row.unit_type ?? ""),
        areaTotal: area != null && Number.isFinite(area) ? area : null,
        status: String(row.status ?? ""),
        towerId: String(row.tower_id ?? ""),
        towerName: String(row.tower_name ?? ""),
        towerIsDefault: row.tower_is_default === true,
        number,
        unitCode,
        code: number.trim() || unitCode.trim(),
      });
    }
    if (batch.length < PAGE) return units;
  }
  throw new Error("v_rv_units_full excedió el límite de lectura.");
}

function slugForName(name: string): string | null {
  const key = projectKey(name);
  return AVAILABILITY_SLUGS.find((item) => projectKey(item.name) === key)?.slug ?? null;
}

function ventasProjectId(dims: Dims, slug: string): string {
  const name = AVAILABILITY_SLUGS.find((item) => item.slug === slug)?.name;
  if (!name) return "";
  const key = projectKey(name);
  return dims.projects.find((project) => projectKey(project.name) === key)?.id ?? "";
}

function allowedSlugs(filters: VistaFilters, dims: Dims): Set<string> | null {
  if (filters.projectIds === null) return null;
  const slugs = new Set<string>();
  for (const id of filters.projectIds) {
    const project = dims.projects.find((item) => item.id === id);
    const slug = project ? slugForName(project.name) : null;
    if (slug) slugs.add(slug);
  }
  return slugs;
}

function availabilityStatus(status: string): ModelCount | null {
  if (status === "AVAILABLE") return "disponible";
  if (status === "RESERVED") return "reservado";
  if (status === "FROZEN") return "congelado";
  if (status === "SOLD") return "vendido";
  return null;
}

function isCanonicalUnitType(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  const folded = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (
    folded === "sin dato" ||
    folded === "sin modelo" ||
    folded === "sin torre" ||
    folded === "cantidad" ||
    folded === "modelo" ||
    folded === "tipo" ||
    folded === "unit type" ||
    folded === "unit_type" ||
    folded === "tipologia" ||
    folded === "precio" ||
    folded === "price" ||
    folded === "header"
  ) {
    return false;
  }
  if (text.includes("$") || /\$s/i.test(text)) return false;
  if (/(?:^|[^a-z])m\s*[²2](?:[^a-z0-9]|$)/i.test(text)) return false;
  const compact = text.replace(/[\s,]/g, "");
  if (/\d+\.\d{3,}/.test(compact)) return false;
  if (/^\d{5,}(?:\.\d+)?$/.test(compact)) return false;
  if (/^\d{4,}\.\d+$/.test(compact)) return false;
  const stripped = compact.replace(/gtq|usd|q\.?/gi, "");
  if (stripped !== compact && /^\d{4,}(?:\.\d+)?$/.test(stripped)) return false;
  return true;
}

function modelCategory(unit: AvailabilityUnit): string | null {
  if (unit.projectSlug === "santa-elena") {
    return santaElenaModelo(unit.number, unit.unitCode, unit.code, unit.areaTotal);
  }
  if (!isCanonicalUnitType(unit.unitType)) return null;
  if (unit.projectSlug === "boulevard-5") {
    const letter = unit.unitType.trim().charAt(0).toUpperCase();
    return letter === "A" || letter === "B" || letter === "C" || letter === "D" || letter === "E" ? letter : null;
  }
  return unit.unitType.trim();
}

// Temporary until the Santa Elena modelo sync is fixed.
// A: Casa 1, 2, 5, 10, 11 (491.91 m²). B: Casa 3, 4, 6, 7, 8, 9 (581 m²).
const SANTA_ELENA_A = new Set([1, 2, 5, 10, 11]);
const SANTA_ELENA_B = new Set([3, 4, 6, 7, 8, 9]);

function santaElenaHouse(value: string): number | null {
  const text = value.trim();
  const casa = text.match(/casa\s*(\d+)/i);
  if (casa) return Number(casa[1]);
  if (/^\d+$/.test(text)) {
    const house = Number(text);
    if (house >= 1 && house <= 11) return house;
  }
  return null;
}

function santaElenaModelo(...marks: (string | number | null)[]): string | null {
  for (const mark of marks) {
    if (typeof mark === "number" && Number.isFinite(mark)) {
      if (Math.abs(mark - 491.91) <= 0.05) return "A";
      if (Math.abs(mark - 581) <= 0.05) return "B";
      continue;
    }
    if (typeof mark !== "string") continue;
    const house = santaElenaHouse(mark);
    if (house != null && SANTA_ELENA_A.has(house)) return "A";
    if (house != null && SANTA_ELENA_B.has(house)) return "B";
    if (Math.abs(Number(mark.replace(/m²|m2/gi, "").trim()) - 491.91) <= 0.05) return "A";
    if (Math.abs(Number(mark.replace(/m²|m2/gi, "").trim()) - 581) <= 0.05) return "B";
  }
  return null;
}


function hiddenSaleTower(unit: AvailabilityUnit): boolean {
  if (unit.projectSlug !== "santa-elena") return false;
  const name = unit.towerName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return unit.towerIsDefault || name === "principal" || name === "sin torre" || name === "sin dato" || name === "";
}

function saleRowsFromUnits(units: readonly AvailabilityUnit[], filters: VistaFilters, dims: Dims): AnalisisVista["modelSales"] {
  const allowed = allowedSlugs(filters, dims);
  const groups = new Map<string, AnalisisVista["modelSales"][number]>();
  for (const unit of units) {
    if (allowed && !allowed.has(unit.projectSlug)) continue;
    if (unit.status !== "RESERVED" && unit.status !== "SOLD") continue;
    const label = modelCategory(unit);
    if (!label) continue;
    const towerId = hiddenSaleTower(unit) ? "" : unit.towerId;
    const key = `${unit.projectSlug}|${towerId}|${label}`;
    const current = groups.get(key) ?? {
      projectSlug: unit.projectSlug,
      projectId: ventasProjectId(dims, unit.projectSlug),
      towerId,
      towerName: towerId ? unit.towerName : "",
      model: label,
      sold: 0,
    };
    current.sold += 1;
    groups.set(key, current);
  }
  return [...groups.values()];
}

const SPLIT_PROJECTS: { slug: string; label: string }[] = [
  { slug: "boulevard-5", label: "Boulevard 5" },
  { slug: "benestare", label: "Benestare" },
  { slug: "bosque-las-tapias", label: "Bosque Las Tapias" },
  { slug: "santa-elena", label: "Santa Elena" },
];

const SPLIT_READ = 20000;

function splitProjects(filters: VistaFilters, dims: Dims): { slug: string; label: string }[] {
  if (filters.projectIds && filters.projectIds.length === 0) return [];
  const allowed = allowedSlugs(filters, dims);
  return SPLIT_PROJECTS.filter((project) => !allowed || allowed.has(project.slug));
}

function dayOf(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function inPeriod(day: string, range: DateWindow): boolean {
  return day !== "" && day >= range.from && day <= range.to;
}

function unitToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[0-9]+$/.test(trimmed)) {
    const stripped = trimmed.replace(/^0+/, "");
    return stripped === "" ? "0" : stripped;
  }
  return trimmed;
}

function foldTower(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function missingName(label: string): boolean {
  const key = foldTower(label);
  return key === "" || key === "sin dato" || key === "sin torre" || key === "sin modelo";
}

function placementTower(unit: AvailabilityUnit): { id: string; name: string } {
  if (hiddenSaleTower(unit) || missingName(unit.towerName)) return { id: "", name: "" };
  return { id: unit.towerId, name: unit.towerName.trim() };
}

function modelFromDim(slug: string, modelName: string): string {
  const name = modelName.trim();
  if (!name || missingName(name) || !isCanonicalUnitType(name)) return "";
  if (slug === "boulevard-5") {
    const letter = name.charAt(0).toUpperCase();
    return letter === "A" || letter === "B" || letter === "C" || letter === "D" || letter === "E" ? letter : "";
  }
  return name;
}

type Placed = { model: string; towerId: string; towerName: string; code: string };

function putPlaced(map: Map<string, Placed | "many">, key: string, placed: Placed) {
  const current = map.get(key);
  if (!current) {
    map.set(key, placed);
    return;
  }
  if (current === "many") return;
  if (current.model !== placed.model || current.code !== placed.code || current.towerId !== placed.towerId) {
    map.set(key, "many");
  }
}

function indexAvailability(units: readonly AvailabilityUnit[]): {
  byTower: Map<string, Placed | "many">;
  byToken: Map<string, Placed | "many">;
} {
  const byTower = new Map<string, Placed | "many">();
  const byToken = new Map<string, Placed | "many">();
  for (const unit of units) {
    const model = modelCategory(unit);
    if (!model) continue;
    if (!SPLIT_PROJECTS.some((project) => project.slug === unit.projectSlug)) continue;
    const tower = placementTower(unit);
    const placed: Placed = { model, towerId: tower.id, towerName: tower.name, code: unit.code };
    const tokens = new Set<string>();
    const numberToken = unitToken(unit.number);
    const codeToken = unitToken(unit.unitCode);
    if (numberToken) tokens.add(numberToken);
    if (codeToken) tokens.add(codeToken);
    for (const token of tokens) {
      putPlaced(byToken, `${unit.projectSlug}|${token}`, placed);
      if (unit.towerName.trim()) putPlaced(byTower, `${unit.projectSlug}|${foldTower(unit.towerName)}|${token}`, placed);
    }
  }
  return { byTower, byToken };
}

function lookupPlaced(
  index: { byTower: Map<string, Placed | "many">; byToken: Map<string, Placed | "many"> },
  slug: string,
  towerName: string,
  tokens: readonly string[],
): Placed | null {
  for (const token of tokens) {
    if (!token) continue;
    const hit = index.byTower.get(`${slug}|${foldTower(towerName)}|${token}`);
    if (hit && hit !== "many") return hit;
  }
  for (const token of tokens) {
    if (!token) continue;
    const hit = index.byToken.get(`${slug}|${token}`);
    if (hit && hit !== "many") return hit;
  }
  return null;
}

type DealFact = { projectId: string; asesorId: string; unitId: string };

async function readPages(
  load: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<{ rows: Record<string, unknown>[]; capped: boolean }> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < SPLIT_READ; offset += PAGE) {
    const { data, error } = await load(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, capped: false };
  }
  return { rows, capped: true };
}

async function rowsByIds(
  client: Db,
  table: "dim_deal" | "dim_unit",
  column: string,
  ids: readonly string[],
  select: string,
): Promise<{ rows: Record<string, unknown>[]; capped: boolean }> {
  const rows: Record<string, unknown>[] = [];
  let capped = false;
  for (let index = 0; index < ids.length; index += 80) {
    const slice = ids.slice(index, index + 80);
    const page = await readPages((from, to) =>
      client.from(table).select(select).in(column, slice).order("id").range(from, to),
    );
    rows.push(...page.rows);
    if (page.capped) capped = true;
  }
  return { rows, capped };
}

function slugOf(dims: Dims, projectId: string): string | null {
  const project = dims.projects.find((item) => item.id === projectId);
  return project ? slugForName(project.name) : null;
}

async function buildModeloSplit(
  client: Db,
  filters: VistaFilters,
  range: DateWindow,
  dims: Dims,
  inventory: readonly AvailabilityUnit[],
): Promise<ModeloSplit> {
  const projects = splitProjects(filters, dims);
  const projectText = projects.length === 0
    ? "Ninguno"
    : filters.projectIds === null
      ? "Todos"
      : projects.map((project) => project.label).join(", ");
  const asesorName = filters.asesorId ? (dims.asesores.get(filters.asesorId)?.name ?? "Asesor") : "Todos";
  const scope = `Periodo ${range.label}: ${windowLabel(range)}. Proyectos: ${projectText}. Asesor: ${asesorName}.`;
  if (projects.length === 0) return { projects, units: [], moves: [], scope, notice: null };

  const allowed = new Set(projects.map((project) => project.slug));
  const notes: string[] = [];
  const [roles, pcvPage, reservaPage] = await Promise.all([
    client.from("asesor_role").select("asesor_id").eq("carries_target", false),
    readPages((from, to) => client.from("fact_pcv_issuance").select("id,deal_id,clock_on").order("id").range(from, to)),
    (async () => {
      const hasAsesor = await factComprobanteHasAsesor(() => client.from("fact_comprobante").select("asesor_id").limit(1));
      const columns = hasAsesor ? "id,deal_id,comprobante_on,asesor_id" : "id,deal_id,comprobante_on";
      const page = await readPages((from, to) =>
        client
          .from("fact_comprobante")
          .select(columns)
          .gte("comprobante_on", range.from)
          .lte("comprobante_on", range.to)
          .order("id")
          .range(from, to),
      );
      return { ...page, hasAsesor };
    })(),
  ]);
  if (roles.error) throw new Error(roles.error.message);
  if (pcvPage.capped) notes.push("La lectura de PCV se detuvo en 20000 filas.");
  if (reservaPage.capped) notes.push("La lectura de reservas se detuvo en 20000 filas.");
  const notRep = new Set(((roles.data ?? []) as unknown as { asesor_id: unknown }[]).map((row) => String(row.asesor_id)));

  const dealIds = new Set<string>();
  for (const row of pcvPage.rows) {
    const id = row.deal_id == null || row.deal_id === "" ? "" : String(row.deal_id);
    if (id) dealIds.add(id);
  }
  for (const row of reservaPage.rows) {
    const id = row.deal_id == null || row.deal_id === "" ? "" : String(row.deal_id);
    if (id) dealIds.add(id);
  }
  const dealPage = await rowsByIds(client, "dim_deal", "id", [...dealIds], "id,project_id,asesor_id,unit_id");
  if (dealPage.capped) notes.push("La lectura de tratos se detuvo en 20000 filas.");
  const deals = new Map<string, DealFact>();
  for (const row of dealPage.rows) {
    const id = row.id == null ? "" : String(row.id);
    if (!id) continue;
    deals.set(id, {
      projectId: row.project_id == null ? "" : String(row.project_id),
      asesorId: row.asesor_id == null ? "" : String(row.asesor_id),
      unitId: row.unit_id == null || row.unit_id === "" ? "" : String(row.unit_id),
    });
  }
  const unitIds = [...new Set([...deals.values()].flatMap((deal) => (deal.unitId ? [deal.unitId] : [])))];
  const unitPage = await rowsByIds(
    client,
    "dim_unit",
    "id",
    unitIds,
    "id,project_id,tower_id,model_id,canonical_unit,unit_token_2",
  );
  if (unitPage.capped) notes.push("La lectura de unidades de venta se detuvo en 20000 filas.");
  const saleUnits = new Map<string, { towerId: string; modelId: string; canonical: string; token2: string }>();
  for (const row of unitPage.rows) {
    const id = row.id == null ? "" : String(row.id);
    if (!id) continue;
    saleUnits.set(id, {
      towerId: row.tower_id == null ? "" : String(row.tower_id),
      modelId: row.model_id == null ? "" : String(row.model_id),
      canonical: row.canonical_unit == null ? "" : String(row.canonical_unit),
      token2: row.unit_token_2 == null ? "" : String(row.unit_token_2),
    });
  }
  const index = indexAvailability(inventory);

  function locate(deal: DealFact, slug: string): { model: string; towerId: string; towerName: string; unit: string } {
    const sale = deal.unitId ? saleUnits.get(deal.unitId) : undefined;
    const towerName = sale ? (dims.torres.get(sale.towerId) ?? "") : "";
    const tokens = sale ? [unitToken(sale.canonical), unitToken(sale.token2)].filter((token, index, list) => token && list.indexOf(token) === index) : [];
    const placed = lookupPlaced(index, slug, towerName, tokens);
    const hardcoded = slug === "santa-elena"
      ? santaElenaModelo(placed?.code ?? "", sale?.canonical ?? "", sale?.token2 ?? "")
      : null;
    if (placed) {
      return {
        model: hardcoded || placed.model,
        towerId: placed.towerId,
        towerName: placed.towerName,
        unit: placed.code || sale?.canonical || "",
      };
    }
    const namedTower = missingName(towerName) || (slug === "santa-elena" && foldTower(towerName) === "principal")
      ? { id: "", name: "" }
      : { id: sale?.towerId ?? "", name: towerName.trim() };
    const model = hardcoded || modelFromDim(slug, sale ? (dims.models.get(sale.modelId) ?? "") : "");
    return { model, towerId: namedTower.id, towerName: namedTower.name, unit: sale?.canonical.trim() || "" };
  }

  // Period. Reserva uses fact_comprobante.comprobante_on: the Guatemala day
  // of the Pipedrive due date (a due time is UTC; a date with no time stays
  // on that date). That is the day Pipedrive's Reserva report uses, so the
  // rule stays.
  // PCV used max(clock_on, earliest comprobante_on) and skipped a row with
  // no comprobante. Pipedrive's issuance day is clock_on alone (Envío de
  // documentación, or Envía PCV - Asesor when that activity is absent). The
  // later-comprobante rule moved rows into another period and dropped
  // issuances Pipedrive counts. The period day is now clock_on.
  const moves: SplitMove[] = [];
  for (const row of reservaPage.rows) {
    const id = row.id == null ? "" : String(row.id);
    const dealId = row.deal_id == null || row.deal_id === "" ? "" : String(row.deal_id);
    const day = dayOf(row.comprobante_on);
    if (!id || !dealId || !inPeriod(day, range)) continue;
    const deal = deals.get(dealId);
    if (!deal) continue;
    const activityAsesor = reservaPage.hasAsesor && typeof row.asesor_id === "string" && row.asesor_id !== "" ? row.asesor_id : null;
    const asesorId = creditedAsesor(deal.asesorId, activityAsesor, notRep);
    if (asesorId === null) continue;
    if (filters.asesorId && asesorId !== filters.asesorId) continue;
    const slug = slugOf(dims, deal.projectId);
    if (!slug || !allowed.has(slug)) continue;
    const place = locate(deal, slug);
    moves.push({ kind: "reserva", projectSlug: slug, towerId: place.towerId, towerName: place.towerName, model: place.model, unit: place.unit, day, id });
  }
  for (const row of pcvPage.rows) {
    const id = row.id == null ? "" : String(row.id);
    const dealId = row.deal_id == null || row.deal_id === "" ? "" : String(row.deal_id);
    if (!id || !dealId) continue;
    const day = dayOf(row.clock_on);
    if (!inPeriod(day, range)) continue;
    const deal = deals.get(dealId);
    if (!deal) continue;
    const asesorId = creditedAsesor(deal.asesorId, null, notRep);
    if (filters.asesorId && asesorId !== filters.asesorId) continue;
    const slug = slugOf(dims, deal.projectId);
    if (!slug || !allowed.has(slug)) continue;
    const place = locate(deal, slug);
    moves.push({ kind: "pcv", projectSlug: slug, towerId: place.towerId, towerName: place.towerName, model: place.model, unit: place.unit, day, id });
  }

  const units: SplitUnit[] = [];
  for (const unit of inventory) {
    if (!allowed.has(unit.projectSlug)) continue;
    const model = modelCategory(unit);
    const status = availabilityStatus(unit.status);
    if (!model || !status) continue;
    const tower = placementTower(unit);
    units.push({
      projectSlug: unit.projectSlug,
      towerId: tower.id,
      towerName: tower.name,
      model,
      code: unit.code,
      status: status satisfies SplitStatus,
    });
  }

  return { projects, units, moves, scope, notice: notes.length > 0 ? notes.join(" ") : null };
}

const INVENTORY_STATUS_KEYS = ["disponible", "revision", "reservado", "congelado", "vendido"] as const satisfies readonly InventoryStatusKey[];

function emptyInventoryCounts(): InventoryCounts {
  return { disponible: 0, revision: 0, reservado: 0, congelado: 0, vendido: 0, total: 0 };
}

function addInventoryCounts(target: InventoryCounts, source: InventoryCounts) {
  for (const key of INVENTORY_STATUS_KEYS) target[key] += source[key];
  target.total += source.total;
}

function inventoryStatus(status: string): InventoryStatusKey | null {
  if (status === "AVAILABLE") return "disponible";
  if (status === "SOFT_HOLD") return "revision";
  if (status === "RESERVED") return "reservado";
  if (status === "FROZEN") return "congelado";
  if (status === "SOLD") return "vendido";
  return null;
}

function inventoryTowerLabel(name: string): string {
  const identity = towerIdentity(name);
  if (identity === "Principal") return "Principal";
  if (identity) return `T${identity}`;
  const label = odooTowerLabel(name);
  return label.trim() ? label : "—";
}

function inventoryTowerKey(name: string): string {
  const identity = towerIdentity(name);
  if (identity) return identity;
  return `raw:${inventoryTowerLabel(name)}`;
}

function inventoryCode(unit: AvailabilityUnit): string {
  const code = unit.code.trim();
  return code || "sin número";
}

function inventoryScope(filters: VistaFilters, labels: readonly string[]): string {
  if (filters.projectIds === null) return "Proyectos: todos.";
  if (filters.projectIds.length === 0 || labels.length === 0) return "Proyectos: ninguno.";
  return `Proyectos: ${labels.join(", ")}.`;
}

function buildInventory(
  range: DateWindow,
  dims: Dims,
  units: readonly AvailabilityUnit[],
  filters: VistaFilters,
  today: string,
): InventarioVista {
  const allowed = allowedSlugs(filters, dims);
  const selected = SPLIT_PROJECTS.filter((project) => allowed === null || allowed.has(project.slug));
  const towersByProject = new Map<string, Map<string, { label: string; counts: InventoryCounts; units: InventoryUnitRef[] }>>();
  for (const project of selected) towersByProject.set(project.slug, new Map());
  let otros = 0;
  for (const unit of units) {
    const towers = towersByProject.get(unit.projectSlug);
    if (!towers) continue;
    const status = inventoryStatus(unit.status);
    if (!status) {
      otros += 1;
      continue;
    }
    const key = inventoryTowerKey(unit.towerName);
    const current = towers.get(key) ?? {
      label: inventoryTowerLabel(unit.towerName),
      counts: emptyInventoryCounts(),
      units: [],
    };
    current.counts[status] += 1;
    current.counts.total += 1;
    current.units.push({ code: inventoryCode(unit), status });
    towers.set(key, current);
  }
  const projects = selected.map((project) => {
    const towers = [...(towersByProject.get(project.slug)?.values() ?? [])]
      .map((tower) => ({
        label: tower.label,
        counts: tower.counts,
        units: [...tower.units].sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }) || a.status.localeCompare(b.status)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
    const counts = emptyInventoryCounts();
    for (const tower of towers) addInventoryCounts(counts, tower.counts);
    return {
      id: ventasProjectId(dims, project.slug),
      slug: project.slug,
      label: project.label,
      counts,
      towers,
    };
  });
  const counts = emptyInventoryCounts();
  for (const project of projects) addInventoryCounts(counts, project.counts);
  const framed = base(
    "¿Cuánto inventario está vendido, congelado y disponible?",
    range,
    "",
    null,
    dims,
    emptyChoices(),
  );
  return {
    ...framed,
    periodLabel: "Inventario vigente",
    rangeLabel: "sin periodo",
    section: "inventario-general",
    asOf: today,
    vendido: counts.vendido,
    reservado: counts.reservado,
    congelado: counts.congelado,
    disponible: counts.disponible,
    vendidoGtq: null,
    vendidoUsd: null,
    congeladoGtq: null,
    congeladoUsd: null,
    disponibleGtq: null,
    disponibleUsd: null,
    otros,
    byProject: projects.map((project) => ({
      id: project.id,
      label: project.label,
      vendido: project.counts.vendido,
      reservado: project.counts.reservado,
      congelado: project.counts.congelado,
      disponible: project.counts.disponible,
      disponibleGtq: null,
      disponibleUsd: null,
    })),
    byTower: projects.flatMap((project) => project.towers.map((tower) => ({
      projectId: project.id,
      tower: tower.label,
      vendido: tower.counts.vendido,
      reservado: tower.counts.reservado,
      congelado: tower.counts.congelado,
      disponible: tower.counts.disponible,
    }))),
    byModel: [],
    board: {
      counts,
      projects,
      scope: inventoryScope(filters, projects.map((project) => project.label)),
    },
  };
}

const NONE_PROJECT = "00000000-0000-0000-0000-000000000000";

function projectList(filters: VistaFilters): string[] | null {
  if (filters.projectIds === null) return null;
  if (filters.projectIds.length === 0) return [NONE_PROJECT];
  return filters.projectIds;
}

type ValorSourceUnit = {
  id: string;
  slug: string;
  towerName: string;
  number: string;
  unitCode: string;
  price: number | null;
};

function putValorUnit(map: Map<string, ValorSourceUnit | "many">, key: string, unit: ValorSourceUnit) {
  const current = map.get(key);
  if (!current) {
    map.set(key, unit);
    return;
  }
  if (current === "many" || current.id === unit.id) return;
  map.set(key, "many");
}

function valorTokens(number: string, code: string): string[] {
  const tokens = new Set<string>();
  const fromNumber = unitToken(number);
  const fromCode = unitToken(code);
  if (fromNumber) tokens.add(fromNumber);
  if (fromCode) tokens.add(fromCode);
  return [...tokens];
}

function dottedDay(iso: string): string {
  const day = iso.slice(0, 10);
  const [year, month, date] = day.split("-");
  if (!year || !month || !date) return day;
  return `${date}.${month}.${year}`;
}

async function loadValorUnits(): Promise<{ units: ValorSourceUnit[]; capped: boolean }> {
  const client = createAdminClient();
  const units: ValorSourceUnit[] = [];
  for (let offset = 0; offset < SPLIT_READ; offset += PAGE) {
    const { data, error } = await client
      .from("v_rv_units_full")
      .select("id, project_slug, tower_name, unit_number, unit_code, price_list")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of batch) {
      units.push({
        id: String(row.id ?? ""),
        slug: String(row.project_slug ?? ""),
        towerName: String(row.tower_name ?? ""),
        number: String(row.unit_number ?? ""),
        unitCode: String(row.unit_code ?? ""),
        price: num(row.price_list),
      });
    }
    if (batch.length < PAGE) return { units, capped: false };
  }
  return { units, capped: true };
}

async function loadProjectMoney(): Promise<{ currencyBySlug: Map<string, string>; idToSlug: Map<string, string> }> {
  const client = createAdminClient();
  const { data, error } = await client.from("projects").select("id, slug, currency");
  if (error) throw new Error(error.message);
  const currencyBySlug = new Map<string, string>();
  const idToSlug = new Map<string, string>();
  for (const row of data ?? []) {
    const slug = String(row.slug ?? "");
    if (!slug) continue;
    currencyBySlug.set(slug, String(row.currency ?? "GTQ"));
    idToSlug.set(String(row.id), slug);
  }
  return { currencyBySlug, idToSlug };
}

async function loadPriceHistory(): Promise<{ projectId: string; towerId: string; date: string; avg: number | null }[]> {
  const client = createAdminClient();
  const rows: { projectId: string; towerId: string; date: string; avg: number | null }[] = [];
  for (let offset = 0; offset < SPLIT_READ; offset += PAGE) {
    const { data, error } = await client
      .from("rv_price_history")
      .select("project_id, tower_id, effective_date, new_price_avg")
      .order("effective_date")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of batch) {
      const date = typeof row.effective_date === "string" ? row.effective_date.slice(0, 10) : "";
      if (!date) continue;
      rows.push({
        projectId: String(row.project_id ?? ""),
        towerId: row.tower_id == null ? "" : String(row.tower_id),
        date,
        avg: num(row.new_price_avg),
      });
    }
    if (batch.length < PAGE) return rows;
  }
  return rows;
}

async function discountByUnit(
  client: Db,
  dims: Dims,
  units: readonly ValorSourceUnit[],
): Promise<Map<string, number>> {
  const loaded = await readPages((from, to) =>
    client.from("fact_discount").select("deal_id, amount_gtq").order("id").range(from, to),
  );
  const totals = new Map<string, number>();
  if (loaded.rows.length === 0) return totals;
  const dealIds = [...new Set(loaded.rows.map((row) => String(row.deal_id ?? "")).filter((id) => id))];
  const deals = await rowsByIds(client, "dim_deal", "id", dealIds, "id, unit_id, project_id");
  const dealById = new Map(deals.rows.map((row) => [String(row.id), row]));
  const unitIds = [...new Set(deals.rows.map((row) => (row.unit_id == null ? "" : String(row.unit_id))).filter((id) => id))];
  const dimUnits = unitIds.length === 0
    ? { rows: [] as Record<string, unknown>[] }
    : await rowsByIds(client, "dim_unit", "id", unitIds, "id, project_id, tower_id, canonical_unit, unit_token_2");
  const dimById = new Map(dimUnits.rows.map((row) => [String(row.id), row]));
  const byTower = new Map<string, ValorSourceUnit | "many">();
  const byToken = new Map<string, ValorSourceUnit | "many">();
  for (const unit of units) {
    if (!SPLIT_PROJECTS.some((project) => project.slug === unit.slug)) continue;
    for (const token of valorTokens(unit.number, unit.unitCode)) {
      putValorUnit(byToken, `${unit.slug}|${token}`, unit);
      if (unit.towerName.trim()) putValorUnit(byTower, `${unit.slug}|${foldTower(unit.towerName)}|${token}`, unit);
    }
  }
  for (const row of loaded.rows) {
    const amount = num(row.amount_gtq);
    if (amount == null) continue;
    const deal = dealById.get(String(row.deal_id ?? ""));
    const dimId = deal?.unit_id == null ? "" : String(deal.unit_id);
    const dim = dimId ? dimById.get(dimId) : undefined;
    if (!dim) continue;
    const projectName = dims.projects.find((project) => project.id === String(dim.project_id ?? ""))?.name ?? "";
    const slug = slugForName(projectName);
    if (!slug) continue;
    const towerName = dims.torres.get(String(dim.tower_id ?? "")) ?? "";
    const tokens = valorTokens(String(dim.canonical_unit ?? ""), String(dim.unit_token_2 ?? ""));
    const towerKey = foldTower(towerName);
    let found: ValorSourceUnit | null = null;
    for (const token of tokens) {
      const hit = towerKey ? byTower.get(`${slug}|${towerKey}|${token}`) : undefined;
      if (hit && hit !== "many") {
        found = hit;
        break;
      }
    }
    if (!found) {
      for (const token of tokens) {
        const hit = byToken.get(`${slug}|${token}`);
        if (hit && hit !== "many") {
          found = hit;
          break;
        }
      }
    }
    if (!found) continue;
    totals.set(found.id, (totals.get(found.id) ?? 0) + amount);
  }
  return totals;
}

async function buildValor(
  client: Db,
  filters: VistaFilters,
  range: DateWindow,
  dims: Dims,
): Promise<ValorVista> {
  const selected = splitProjects(filters, dims);
  const choices = emptyChoices();
  const blank = {
    ...base("Valor de proyecto", range, "", null, dims, choices),
    section: "valor-del-proyecto" as const,
    listGtq: 0,
    listUsd: 0,
    lossUnits: 0,
    lossGtq: null,
    months: [] as { label: string; ventas: number; desistido: number }[],
    byProject: [] as ValorVista["byProject"],
    traces: [] as ValorVista["traces"],
    board: { listGtq: 0, discountGtq: 0, projects: [] as ValorVista["board"]["projects"] },
  };
  if (selected.length === 0) return blank;

  const [loaded, money, history] = await Promise.all([
    loadValorUnits(),
    loadProjectMoney(),
    loadPriceHistory(),
  ]);
  const discountsReady = await discountByUnit(client, dims, loaded.units);
  const allowed = new Set(selected.map((project) => project.slug));
  const historyBySlug = new Map<string, ValorVista["board"]["projects"][number]["history"]>();
  for (const row of history) {
    if (row.towerId || row.avg == null) continue;
    const slug = money.idToSlug.get(row.projectId);
    if (!slug || !allowed.has(slug)) continue;
    const list = historyBySlug.get(slug) ?? [];
    list.push({ date: row.date, label: dottedDay(row.date), gtq: row.avg });
    historyBySlug.set(slug, list);
  }
  for (const points of historyBySlug.values()) points.sort((a, b) => a.date.localeCompare(b.date));

  const projects = selected.map((project) => {
    const currency = (money.currencyBySlug.get(project.slug) ?? "GTQ").toUpperCase();
    const towers = new Map<string, { label: string; listGtq: number; units: ValorVista["board"]["projects"][number]["units"] }>();
    let listGtq = 0;
    let listUsd = 0;
    let discountGtq = 0;
    const units: ValorVista["board"]["projects"][number]["units"] = [];
    for (const unit of loaded.units) {
      if (unit.slug !== project.slug) continue;
      const label = inventoryTowerLabel(unit.towerName);
      const key = inventoryTowerKey(unit.towerName);
      const bucket = towers.get(key) ?? { label, listGtq: 0, units: [] };
      const gtq = currency === "GTQ" && unit.price != null ? unit.price : 0;
      const discount = discountsReady.get(unit.id) ?? 0;
      if (currency === "GTQ" && unit.price != null) listGtq += unit.price;
      if (currency === "USD" && unit.price != null) listUsd += unit.price;
      discountGtq += discount;
      bucket.listGtq += gtq;
      const line = {
        project: project.label,
        torre: label,
        code: unit.number.trim() || unit.unitCode.trim() || "sin número",
        amount: unit.price,
        currency,
        discountGtq: discount,
      };
      bucket.units.push(line);
      units.push(line);
      towers.set(key, bucket);
    }
    const towerRows = [...towers.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
    return {
      id: ventasProjectId(dims, project.slug),
      slug: project.slug,
      label: project.label,
      currency,
      listGtq,
      discountGtq,
      listUsd,
      towers: towerRows,
      history: historyBySlug.get(project.slug) ?? [],
      units,
    };
  });
  const listGtq = projects.reduce((sum, project) => sum + project.listGtq, 0);
  const discountGtq = projects.reduce((sum, project) => sum + project.discountGtq, 0);
  const listUsd = projects.reduce((sum, project) => sum + project.listUsd, 0);
  const notice = loaded.capped ? "La lectura de unidades se detuvo en 20000 filas." : null;
  return {
    ...base("Valor de proyecto", range, "", notice, dims, choices),
    section: "valor-del-proyecto",
    listGtq,
    listUsd,
    lossUnits: 0,
    lossGtq: null,
    months: [],
    byProject: projects.map((project) => ({
      id: project.id,
      label: project.label,
      disponibleGtq: project.listGtq,
      disponibleUsd: project.listUsd,
      desistidoGtq: null,
    })),
    traces: [],
    board: { listGtq, discountGtq, projects },
  };
}

function scopeProject(query: DatedQuery, filters: VistaFilters): DatedQuery {
  const ids = projectList(filters);
  if (ids) return query.in("project_id", ids);
  return query;
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

const EMBUDO_PAGE = 1000;
const EMBUDO_CAP = 200_000;

function pipelineSlugs(projectIds: string[] | null, dims: Dims): string[] {
  if (projectIds === null) return EMBUDO_PIPELINES.map((pipeline) => pipeline.slug);
  const wanted = new Set<string>();
  for (const id of projectIds) {
    const name = dims.projects.find((project) => project.id === id)?.name;
    if (!name) continue;
    const key = projectKey(name);
    const pipeline = EMBUDO_PIPELINES.find((item) => projectKey(item.label) === key);
    if (pipeline) wanted.add(pipeline.slug);
  }
  return EMBUDO_PIPELINES.map((pipeline) => pipeline.slug).filter((slug) => wanted.has(slug));
}

function visiblePerson(name: string): boolean {
  const key = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return key !== "" && key !== "sin dato" && key !== "sin asesor" && key !== "asesor pending";
}

function asOrder(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

async function loadEmbudoRows(
  client: Db,
  range: DateWindow,
  slugs: readonly string[],
  asesorId: string | null,
): Promise<{ id: string; pipeline: string; project: string; addOn: string; stageOrder: number; asesorId: string }[]> {
  if (slugs.length === 0) return [];
  const projectOf = new Map<string, string>(EMBUDO_PIPELINES.map((pipeline) => [pipeline.slug, pipeline.label]));
  const rows: { id: string; pipeline: string; project: string; addOn: string; stageOrder: number; asesorId: string }[] = [];
  for (let offset = 0; offset < EMBUDO_CAP; offset += EMBUDO_PAGE) {
    let query = client
      .from("embudo_deal")
      .select("pipedrive_deal_id,pipeline_slug,stage_order,add_on,asesor_id")
      .gte("add_on", range.from)
      .lte("add_on", range.to)
      .in("pipeline_slug", [...slugs])
      .order("pipedrive_deal_id");
    if (asesorId) query = query.eq("asesor_id", asesorId);
    const { data, error } = await query.range(offset, offset + EMBUDO_PAGE - 1);
    if (error) throw new Error("No se pudo leer la tasa de conversión.");
    const batch = (data ?? []) as {
      pipedrive_deal_id: unknown;
      pipeline_slug: unknown;
      stage_order: unknown;
      add_on: unknown;
      asesor_id: unknown;
    }[];
    for (const row of batch) {
      const pipeline = String(row.pipeline_slug);
      rows.push({
        id: String(row.pipedrive_deal_id ?? ""),
        pipeline,
        project: projectOf.get(pipeline) ?? "",
        addOn: typeof row.add_on === "string" ? row.add_on.slice(0, 10) : "",
        stageOrder: asOrder(row.stage_order),
        asesorId: String(row.asesor_id ?? ""),
      });
    }
    if (batch.length < EMBUDO_PAGE) return rows;
  }
  throw new Error("No se pudo leer la tasa de conversión.");
}

async function buildConversion(client: Db, filters: VistaFilters, range: DateWindow): Promise<ConversionVista> {
  const dims = await loadDims(client);
  const slugs = pipelineSlugs(filters.projectIds, dims);
  const loaded = await loadEmbudoRows(client, range, slugs, filters.asesorId);
  const deals: EmbudoInput[] = loaded.map((row) => ({
    id: row.id,
    project: row.project,
    addOn: row.addOn,
    stageOrder: row.stageOrder,
  }));
  const choices = emptyChoices();
  const asesorLabels = new Map<string, string>();
  for (const [id, asesor] of dims.asesores) {
    if (!asesor.sin && visiblePerson(asesor.name)) asesorLabels.set(id, asesor.name);
  }
  choices.asesor = countChoices(
    loaded.map((row) => row.asesorId).filter((id) => asesorLabels.has(id)),
    asesorLabels,
  );
  const slugSet = new Set(slugs);
  return {
    ...base("Tasa de conversión", range, "", null, dims, choices),
    section: "tasa-de-conversion",
    all: embudoFunnel("todos", "Todos los Proyectos", deals),
    funnels: EMBUDO_PIPELINES
      .filter((pipeline) => slugSet.has(pipeline.slug))
      .map((pipeline) => embudoFunnel(
        pipeline.slug,
        pipeline.label,
        loaded.filter((deal) => deal.pipeline === pipeline.slug),
      )),
  };
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

const CONTROL_SECTIONS = ["desistimientos", "descuentos", "subidas-de-precios", "ff-y-casos-especiales", "promociones", "control-referidos"] as const;
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
  if (section === "promociones") return buildPromos(client, filters, range, dims);
  return buildReferidos(filters, range, dims);
}

async function loadTowerRoster(): Promise<Map<string, { key: string; label: string }[]>> {
  const client = createAdminClient();
  const bySlug = new Map<string, Map<string, string>>();
  for (let offset = 0; offset < SPLIT_READ; offset += PAGE) {
    const { data, error } = await client
      .from("v_rv_units_full")
      .select("id, project_slug, tower_name")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of batch) {
      const slug = String(row.project_slug ?? "");
      const name = String(row.tower_name ?? "");
      if (!slug || missingName(name)) continue;
      const label = inventoryTowerLabel(name);
      const key = inventoryTowerKey(name);
      if (!label || label === "—") continue;
      const towers = bySlug.get(slug) ?? new Map<string, string>();
      if (!towers.has(key)) towers.set(key, label);
      bySlug.set(slug, towers);
    }
    if (batch.length < PAGE) break;
  }
  const roster = new Map<string, { key: string; label: string }[]>();
  for (const [slug, towers] of bySlug) {
    roster.set(slug, [...towers.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es")));
  }
  return roster;
}

async function buildDesistencias(client: Db, filters: VistaFilters, range: DateWindow, dims: Dims): Promise<DesistenciaVista> {
  const selected = splitProjects(filters, dims);
  const choices = emptyChoices();
  const blank = {
    ...base("Desistimientos", range, "", null, dims, choices),
    section: "desistimientos" as const,
    units: 0,
    gtq: 0,
    motivos: [] as DesistenciaVista["motivos"],
    byProject: [] as DesistenciaVista["byProject"],
    byAsesor: [] as DesistenciaVista["byAsesor"],
    traces: [] as DesistenciaVista["traces"],
    board: { units: 0, gtq: 0, projects: [] as DesistenciaVista["board"]["projects"] },
  };
  if (selected.length === 0) return blank;

  const [losses, roster] = await Promise.all([
    fetchDated(
      client,
      "v_desistimiento",
      "lost_on",
      "deal_id,unit_id,project_id,tower_id,asesor_id,lost_reason_id,lost_on,value_gtq",
      range.from,
      range.to,
      (query) => scopeProject(query, filters),
    ),
    loadTowerRoster(),
  ]);
  const rows = losses.rows;
  const names = await unitNames(client, rows.map((row) => String(row.unit_id ?? "")).filter((id) => id));
  const allowed = new Set(selected.map((project) => project.slug));
  const projects = selected.map((project) => {
    const towers = new Map<string, DesistenciaVista["board"]["projects"][number]["towers"][number]>();
    for (const tower of roster.get(project.slug) ?? []) {
      towers.set(tower.key, { label: tower.label, units: 0, gtq: 0, cases: [] });
    }
    return {
      id: ventasProjectId(dims, project.slug),
      slug: project.slug,
      label: project.label,
      units: 0,
      gtq: 0,
      towers,
      cases: [] as DesistenciaVista["board"]["projects"][number]["cases"],
    };
  });
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  for (const row of rows) {
    const projectName = dims.projects.find((project) => project.id === String(row.project_id ?? ""))?.name ?? "";
    const slug = slugForName(projectName);
    if (!slug || !allowed.has(slug)) continue;
    const project = bySlug.get(slug);
    if (!project) continue;
    const gtq = num(row.value_gtq);
    const towerName = dims.torres.get(String(row.tower_id ?? "")) ?? "";
    const named = !missingName(towerName);
    const torre = named ? inventoryTowerLabel(towerName) : "";
    const unitId = String(row.unit_id ?? "");
    const entry = {
      project: project.label,
      torre: torre && torre !== "—" ? torre : "sin torre",
      unit: names.get(unitId) || "sin unidad",
      lostOn: typeof row.lost_on === "string" ? row.lost_on.slice(0, 10) : "",
      gtq,
    };
    project.units += 1;
    if (gtq != null) project.gtq += gtq;
    project.cases.push(entry);
    if (!named || !torre || torre === "—") continue;
    const key = inventoryTowerKey(towerName);
    const tower = towersOf(project).get(key) ?? { label: torre, units: 0, gtq: 0, cases: [] };
    tower.units += 1;
    if (gtq != null) tower.gtq += gtq;
    tower.cases.push(entry);
    towersOf(project).set(key, tower);
  }
  const boardProjects = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    label: project.label,
    units: project.units,
    gtq: project.gtq,
    towers: [...towersOf(project).values()].sort((a, b) => a.label.localeCompare(b.label, "es")),
    cases: project.cases,
  }));
  const units = boardProjects.reduce((sum, project) => sum + project.units, 0);
  const gtq = boardProjects.reduce((sum, project) => sum + project.gtq, 0);
  const notice = losses.capped ? "La consulta del periodo llegó a 5.000 filas. Afina proyecto o periodo." : null;
  return {
    ...base("Desistimientos", range, "", notice, dims, choices),
    section: "desistimientos",
    units,
    gtq,
    motivos: barsFrom(rows, "lost_reason_id", (id) => dims.reasons.get(id) ?? "Sin dato"),
    byProject: boardProjects.map((project) => ({
      id: project.id,
      label: project.label,
      units: project.units,
      gtq: project.gtq,
    })),
    byAsesor: barsFrom(rows, "asesor_id", (id) => dims.asesores.get(id)?.name ?? "Sin dato"),
    traces: rows.slice(0, 80).map((row) => ({
      unit: names.get(String(row.unit_id ?? "")) ?? String(row.unit_id ?? ""),
      project: dims.projects.find((project) => project.id === String(row.project_id))?.name ?? "Sin dato",
      asesor: dims.asesores.get(String(row.asesor_id))?.name ?? "Sin dato",
      motivo: dims.reasons.get(String(row.lost_reason_id)) ?? "Sin dato",
      lostOn: String(row.lost_on).slice(0, 10),
      gtq: num(row.value_gtq),
    })),
    board: { units, gtq, projects: boardProjects },
  };
}

function towersOf(project: {
  towers: Map<string, DesistenciaVista["board"]["projects"][number]["towers"][number]>;
}): Map<string, DesistenciaVista["board"]["projects"][number]["towers"][number]> {
  return project.towers;
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
  const selected = splitProjects(filters, dims);
  const choices = emptyChoices();
  const emptyBoard = { units: 0, gtq: 0, projects: [] as DescuentoVista["board"]["projects"] };
  const blank = {
    ...base("Control de descuentos", range, "", null, dims, choices),
    section: "descuentos" as const,
    units: 0,
    gtq: 0,
    share: null,
    saleGtq: null,
    tipos: [] as DescuentoVista["tipos"],
    byAsesor: [] as DescuentoVista["byAsesor"],
    traces: [] as DescuentoVista["traces"],
    board: emptyBoard,
  };
  if (selected.length === 0) return blank;

  const roster = await loadTowerRoster();
  const projects = selected.map((project) => {
    const towers = new Map<string, DescuentoVista["board"]["projects"][number]["towers"][number]>();
    for (const tower of roster.get(project.slug) ?? []) {
      towers.set(tower.key, { label: tower.label, units: 0, gtq: 0, sales: [], lines: [] });
    }
    return {
      id: ventasProjectId(dims, project.slug),
      slug: project.slug,
      label: project.label,
      units: 0,
      gtq: 0,
      towers,
      sales: [] as DescuentoVista["board"]["projects"][number]["sales"],
      lines: [] as DescuentoVista["board"]["projects"][number]["lines"],
    };
  });
  const loaded = await tableCount(client, "fact_discount");
  if (loaded === 0) {
    return {
      ...blank,
      board: {
        units: 0,
        gtq: 0,
        projects: projects.map((project) => ({
          id: project.id,
          slug: project.slug,
          label: project.label,
          units: 0,
          gtq: 0,
          towers: [...project.towers.values()].sort((a, b) => a.label.localeCompare(b.label, "es")),
          sales: [],
          lines: [],
        })),
      },
    };
  }

  const sales = await fetchDated(
    client,
    "v_sale",
    "sale_on",
    "deal_id,unit_id,project_id,tower_id,sale_on",
    range.from,
    range.to,
    (query) => scopeProject(query, filters),
  );
  const dealIds = [...new Set(sales.rows.map((row) => String(row.deal_id ?? "")).filter((id) => id))];
  const discounts = dealIds.length === 0
    ? []
    : await rowsIn(client, "fact_discount", "deal_id,discount_type_id,amount_gtq", "deal_id", dealIds);
  const saleByDeal = new Map(sales.rows.map((row) => [String(row.deal_id), row]));
  const names = await unitNames(client, sales.rows.map((row) => String(row.unit_id ?? "")).filter((id) => id));
  const allowed = new Set(selected.map((project) => project.slug));
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  const byDeal = new Map<string, Record<string, unknown>[]>();
  for (const row of discounts) {
    const dealId = String(row.deal_id ?? "");
    if (!saleByDeal.has(dealId)) continue;
    const list = byDeal.get(dealId) ?? [];
    list.push(row);
    byDeal.set(dealId, list);
  }
  for (const [dealId, lines] of byDeal) {
    const sale = saleByDeal.get(dealId);
    if (!sale) continue;
    const projectName = dims.projects.find((project) => project.id === String(sale.project_id ?? ""))?.name ?? "";
    const slug = slugForName(projectName);
    if (!slug || !allowed.has(slug)) continue;
    const project = bySlug.get(slug);
    if (!project) continue;
    const towerName = dims.torres.get(String(sale.tower_id ?? "")) ?? "";
    const named = !missingName(towerName);
    const torre = named ? inventoryTowerLabel(towerName) : "";
    const torreLabel = torre && torre !== "—" ? torre : "sin torre";
    const unitId = String(sale.unit_id ?? "");
    const unit = names.get(unitId) || "sin unidad";
    const saleOn = typeof sale.sale_on === "string" ? sale.sale_on.slice(0, 10) : "";
    const detail: DescuentoVista["board"]["projects"][number]["lines"] = lines.map((row) => ({
      project: project.label,
      torre: torreLabel,
      unit,
      saleOn,
      amountGtq: num(row.amount_gtq),
    }));
    const gtq = detail.reduce((sum, line) => sum + (line.amountGtq ?? 0), 0);
    const entry = { dealId, project: project.label, torre: torreLabel, unit, saleOn, gtq, lines: detail };
    project.units += 1;
    project.gtq += gtq;
    project.sales.push(entry);
    project.lines.push(...detail);
    if (!named || !torre || torre === "—") continue;
    const key = inventoryTowerKey(towerName);
    const tower = project.towers.get(key) ?? { label: torre, units: 0, gtq: 0, sales: [], lines: [] };
    tower.units += 1;
    tower.gtq += gtq;
    tower.sales.push(entry);
    tower.lines.push(...detail);
    project.towers.set(key, tower);
  }
  const boardProjects = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    label: project.label,
    units: project.units,
    gtq: project.gtq,
    towers: [...project.towers.values()].sort((a, b) => a.label.localeCompare(b.label, "es")),
    sales: project.sales,
    lines: project.lines,
  }));
  const units = boardProjects.reduce((sum, project) => sum + project.units, 0);
  const gtq = boardProjects.reduce((sum, project) => sum + project.gtq, 0);
  const notice = sales.capped ? "La consulta del periodo llegó a 5.000 filas. Afina proyecto o periodo." : null;
  return {
    ...base("Control de descuentos", range, "", notice, dims, choices),
    section: "descuentos",
    units,
    gtq,
    share: null,
    saleGtq: null,
    tipos: [],
    byAsesor: [],
    traces: [],
    board: { units, gtq, projects: boardProjects },
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
  const selected = splitProjects(filters, dims);
  const choices = emptyChoices();
  const blank = {
    ...base("Control de subidas de precios", range, "", null, dims, choices),
    section: "subidas-de-precios" as const,
    units: 0,
    gtq: 0,
    usd: 0,
    byProject: [] as PrecioVista["byProject"],
    months: [] as PrecioVista["months"],
    traces: [] as PrecioVista["traces"],
    board: { units: 0, gtq: 0, projects: [] as PrecioVista["board"]["projects"] },
  };
  if (selected.length === 0) return blank;

  const roster = await loadTowerRoster();
  const projects = selected.map((project) => {
    const towers = new Map<string, PrecioVista["board"]["projects"][number]["towers"][number]>();
    for (const tower of roster.get(project.slug) ?? []) {
      towers.set(tower.key, { label: tower.label, units: 0, gtq: 0, events: [] });
    }
    return {
      id: ventasProjectId(dims, project.slug),
      slug: project.slug,
      label: project.label,
      units: 0,
      gtq: 0,
      usd: 0,
      towers,
      events: [] as PrecioVista["board"]["projects"][number]["events"],
    };
  });
  const loaded = await tableCount(client, "fact_price_rise");
  if (loaded === 0) {
    return {
      ...blank,
      board: {
        units: 0,
        gtq: 0,
        projects: projects.map((project) => ({
          id: project.id,
          slug: project.slug,
          label: project.label,
          units: 0,
          gtq: 0,
          towers: [...project.towers.values()].sort((a, b) => a.label.localeCompare(b.label, "es")),
          events: [],
        })),
      },
    };
  }

  const rises = await fetchDated(
    client,
    "fact_price_rise",
    "effective_on",
    "unit_id,tower_id,effective_on,difference_amount,currency",
    range.from,
    range.to,
  );
  const names = await unitNames(client, rises.rows.map((row) => String(row.unit_id ?? "")).filter((id) => id));
  const allowed = new Set(selected.map((project) => project.slug));
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  for (const row of rises.rows) {
    const projectId = projectOfTower(dims, String(row.tower_id ?? ""));
    const projectName = dims.projects.find((project) => project.id === projectId)?.name ?? "";
    const slug = slugForName(projectName);
    if (!slug || !allowed.has(slug)) continue;
    const project = bySlug.get(slug);
    if (!project) continue;
    const currency = String(row.currency ?? "").toUpperCase();
    const difference = num(row.difference_amount);
    const towerName = dims.torres.get(String(row.tower_id ?? "")) ?? "";
    const named = !missingName(towerName);
    const torre = named ? inventoryTowerLabel(towerName) : "";
    const torreLabel = torre && torre !== "—" ? torre : "sin torre";
    const unitId = String(row.unit_id ?? "");
    const event = {
      project: project.label,
      torre: torreLabel,
      unit: names.get(unitId) || "sin unidad",
      effectiveOn: typeof row.effective_on === "string" ? row.effective_on.slice(0, 10) : "",
      difference,
      currency,
    };
    project.units += 1;
    if (currency === "GTQ" && difference != null) project.gtq += difference;
    if (currency === "USD" && difference != null) project.usd += difference;
    project.events.push(event);
    if (!named || !torre || torre === "—") continue;
    const key = inventoryTowerKey(towerName);
    const tower = project.towers.get(key) ?? { label: torre, units: 0, gtq: 0, events: [] };
    tower.units += 1;
    if (currency === "GTQ" && difference != null) tower.gtq += difference;
    tower.events.push(event);
    project.towers.set(key, tower);
  }
  const boardProjects = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    label: project.label,
    units: project.units,
    gtq: project.gtq,
    towers: [...project.towers.values()].sort((a, b) => a.label.localeCompare(b.label, "es")),
    events: project.events,
  }));
  const units = boardProjects.reduce((sum, project) => sum + project.units, 0);
  const gtq = boardProjects.reduce((sum, project) => sum + project.gtq, 0);
  const usd = projects.reduce((sum, project) => sum + project.usd, 0);
  return {
    ...base("Control de subidas de precios", range, "", null, dims, choices),
    section: "subidas-de-precios",
    units,
    gtq,
    usd,
    byProject: boardProjects.map((project) => ({
      id: project.id,
      label: project.label,
      units: project.units,
      gtq: project.gtq,
      usd: projects.find((item) => item.slug === project.slug)?.usd ?? 0,
    })),
    months: [],
    traces: rises.rows.slice(0, 80).map((row) => ({
      unit: names.get(String(row.unit_id ?? "")) ?? String(row.unit_id ?? ""),
      tower: dims.torres.get(String(row.tower_id ?? "")) ?? "Sin dato",
      previous: 0,
      next: 0,
      difference: num(row.difference_amount) ?? 0,
      currency: String(row.currency ?? ""),
    })),
    board: { units, gtq, projects: boardProjects },
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
  const selected = splitProjects(filters, dims);
  const choices = emptyChoices();
  const blank = {
    ...base("F&F y casos especiales", range, "", null, dims, choices),
    section: "ff-y-casos-especiales" as const,
    marked: 0,
    ff: 0,
    especial: 0,
    sales: 0,
    share: null,
    tipos: [] as CasoVista["tipos"],
    byProject: [] as CasoVista["byProject"],
    traces: [] as CasoVista["traces"],
    board: { units: 0, projects: [] as CasoVista["board"]["projects"] },
  };
  if (selected.length === 0) return blank;

  const roster = await loadTowerRoster();
  const projects = selected.map((project) => {
    const towers = new Map<string, CasoVista["board"]["projects"][number]["towers"][number]>();
    for (const tower of roster.get(project.slug) ?? []) {
      towers.set(tower.key, { label: tower.label, units: 0, marks: [] });
    }
    return {
      id: ventasProjectId(dims, project.slug),
      slug: project.slug,
      label: project.label,
      units: 0,
      towers,
      marks: [] as CasoVista["board"]["projects"][number]["marks"],
    };
  });
  const loaded = await tableCount(client, "fact_case_mark");
  if (loaded === 0) {
    return {
      ...blank,
      board: {
        units: 0,
        projects: projects.map((project) => ({
          id: project.id,
          slug: project.slug,
          label: project.label,
          units: 0,
          towers: [...project.towers.values()].sort((a, b) => a.label.localeCompare(b.label, "es")),
          marks: [],
        })),
      },
    };
  }

  const sales = await fetchDated(
    client,
    "v_sale",
    "sale_on",
    "deal_id,unit_id,project_id,tower_id,sale_on,value_gtq",
    range.from,
    range.to,
    (query) => scopeProject(query, filters),
  );
  const dealIds = [...new Set(sales.rows.map((row) => String(row.deal_id ?? "")).filter((id) => id))];
  const marks = dealIds.length === 0
    ? []
    : await rowsIn(client, "fact_case_mark", "deal_id,case_type_id", "deal_id", dealIds);
  const saleByDeal = new Map(sales.rows.map((row) => [String(row.deal_id), row]));
  const names = await unitNames(client, sales.rows.map((row) => String(row.unit_id ?? "")).filter((id) => id));
  const allowed = new Set(selected.map((project) => project.slug));
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  let ff = 0;
  for (const row of marks) {
    const sale = saleByDeal.get(String(row.deal_id ?? ""));
    if (!sale) continue;
    const projectName = dims.projects.find((project) => project.id === String(sale.project_id ?? ""))?.name ?? "";
    const slug = slugForName(projectName);
    if (!slug || !allowed.has(slug)) continue;
    const project = bySlug.get(slug);
    if (!project) continue;
    const reason = dims.cases.get(String(row.case_type_id ?? ""))?.name ?? "Sin dato";
    if (/friend|familia/i.test(reason)) ff += 1;
    const towerName = dims.torres.get(String(sale.tower_id ?? "")) ?? "";
    const named = !missingName(towerName);
    const torre = named ? inventoryTowerLabel(towerName) : "";
    const torreLabel = torre && torre !== "—" ? torre : "sin torre";
    const unitId = String(sale.unit_id ?? "");
    const mark = {
      project: project.label,
      torre: torreLabel,
      unit: names.get(unitId) || "sin unidad",
      saleOn: typeof sale.sale_on === "string" ? sale.sale_on.slice(0, 10) : "",
      reason,
      gtq: num(sale.value_gtq),
    };
    project.units += 1;
    project.marks.push(mark);
    if (!named || !torre || torre === "—") continue;
    const key = inventoryTowerKey(towerName);
    const tower = project.towers.get(key) ?? { label: torre, units: 0, marks: [] };
    tower.units += 1;
    tower.marks.push(mark);
    project.towers.set(key, tower);
  }
  const boardProjects = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    label: project.label,
    units: project.units,
    towers: [...project.towers.values()].sort((a, b) => a.label.localeCompare(b.label, "es")),
    marks: project.marks,
  }));
  const units = boardProjects.reduce((sum, project) => sum + project.units, 0);
  const notice = sales.capped ? "La consulta del periodo llegó a 5.000 filas. Afina proyecto o periodo." : null;
  return {
    ...base("F&F y casos especiales", range, "", notice, dims, choices),
    section: "ff-y-casos-especiales",
    marked: units,
    ff,
    especial: units - ff,
    sales: sales.rows.length,
    share: null,
    tipos: [],
    byProject: boardProjects.map((project) => ({
      id: project.id,
      label: project.label,
      marked: project.units,
      sales: 0,
      share: null,
    })),
    traces: [],
    board: { units, projects: boardProjects },
  };
}

async function buildPromos(client: Db, filters: VistaFilters, range: DateWindow, dims: Dims): Promise<PromoVista> {
  const selected = splitProjects(filters, dims);
  const choices = emptyChoices();
  const emptyBoard = { units: 0, gtq: 0, projects: [] as PromoVista["board"]["projects"] };
  const blank = {
    ...base("Control de promociones", range, "", null, dims, choices),
    section: "promociones" as const,
    units: 0,
    promoted: 0,
    gtq: 0,
    leader: null,
    leaderShare: null,
    tipos: [] as PromoVista["tipos"],
    months: [] as PromoVista["months"],
    series: [] as PromoVista["series"],
    byAsesor: [] as PromoVista["byAsesor"],
    board: emptyBoard,
  };
  if (selected.length === 0) return blank;

  const roster = await loadTowerRoster();
  const projects = selected.map((project) => {
    const towers = new Map<string, PromoVista["board"]["projects"][number]["towers"][number]>();
    for (const tower of roster.get(project.slug) ?? []) {
      towers.set(tower.key, { label: tower.label, units: 0, gtq: 0, applications: [] });
    }
    return {
      id: ventasProjectId(dims, project.slug),
      slug: project.slug,
      label: project.label,
      units: 0,
      gtq: 0,
      towers,
      applications: [] as PromoVista["board"]["projects"][number]["applications"],
    };
  });

  const sales = await fetchDated(
    client,
    "v_sale",
    "sale_on",
    "deal_id,unit_id,project_id,tower_id,promotion_type_id,sale_on",
    range.from,
    range.to,
    (query) => scopeProject(query, filters),
  );
  const dealIds = [...new Set(sales.rows.map((row) => String(row.deal_id ?? "")).filter((id) => id))];
  const deals = dealIds.length === 0
    ? []
    : await rowsIn(client, "dim_deal", "id,valor_vale_gtq", "id", dealIds);
  const valeByDeal = new Map(deals.map((row) => [String(row.id), num(row.valor_vale_gtq)]));
  const names = await unitNames(client, sales.rows.map((row) => String(row.unit_id ?? "")).filter((id) => id));
  const allowed = new Set(selected.map((project) => project.slug));
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  for (const row of sales.rows) {
    const promo = dims.promotions.get(String(row.promotion_type_id ?? ""));
    if (!promo || promo.sin) continue;
    const projectName = dims.projects.find((project) => project.id === String(row.project_id ?? ""))?.name ?? "";
    const slug = slugForName(projectName);
    if (!slug || !allowed.has(slug)) continue;
    const project = bySlug.get(slug);
    if (!project) continue;
    const towerName = dims.torres.get(String(row.tower_id ?? "")) ?? "";
    const named = !missingName(towerName);
    const torre = named ? inventoryTowerLabel(towerName) : "";
    const torreLabel = torre && torre !== "—" ? torre : "sin torre";
    const vale = valeByDeal.get(String(row.deal_id ?? "")) ?? null;
    const application = {
      dealId: String(row.deal_id ?? ""),
      project: project.label,
      torre: torreLabel,
      unit: names.get(String(row.unit_id ?? "")) || "sin unidad",
      saleOn: typeof row.sale_on === "string" ? row.sale_on.slice(0, 10) : "",
      name: promo.name,
      valeGtq: vale,
    };
    project.units += 1;
    if (vale != null) project.gtq += vale;
    project.applications.push(application);
    if (!named || !torre || torre === "—") continue;
    const key = inventoryTowerKey(towerName);
    const tower = project.towers.get(key) ?? { label: torre, units: 0, gtq: 0, applications: [] };
    tower.units += 1;
    if (vale != null) tower.gtq += vale;
    tower.applications.push(application);
    project.towers.set(key, tower);
  }
  const boardProjects = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    label: project.label,
    units: project.units,
    gtq: project.gtq,
    towers: [...project.towers.values()].sort((a, b) => a.label.localeCompare(b.label, "es")),
    applications: project.applications,
  }));
  const units = boardProjects.reduce((sum, project) => sum + project.units, 0);
  const gtq = boardProjects.reduce((sum, project) => sum + project.gtq, 0);
  const notice = sales.capped ? "La consulta del periodo llegó a 5.000 filas. Afina proyecto o periodo." : null;
  return {
    ...base("Control de promociones", range, "", notice, dims, choices),
    section: "promociones",
    units,
    promoted: units,
    gtq,
    leader: null,
    leaderShare: null,
    tipos: [],
    months: [],
    series: [],
    byAsesor: [],
    board: { units, gtq, projects: boardProjects },
  };
}

const NAME_CAP = 12;

function referralText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function referralScopeNote(filters: VistaFilters): string {
  const parts = ["el periodo"];
  if (filters.asesorId) parts.push("el asesor");
  if (filters.torreId) parts.push("la torre");
  const limit = parts.length === 1 ? "El periodo no los parte." : `Ni ${parts.join(" ni ")} los parten.`;
  return `Estos tratos son los de créditos. ${limit}`;
}

function referidoRoster(filters: VistaFilters, dims: Dims): { id: string; label: string }[] {
  return splitProjects(filters, dims).map((project) => ({ id: project.slug, label: project.label }));
}

function sortedNames(names: ReadonlySet<string>): string[] {
  return [...names].sort((a, b) => a.localeCompare(b, "es"));
}

type ReferidoBucket = {
  units: number;
  nombres: Set<string>;
  tipos: Map<string, { units: number; nombres: Set<string> }>;
};

function referidoBucket(): ReferidoBucket {
  const tipos = new Map<string, { units: number; nombres: Set<string> }>();
  for (const label of REFERIDO_TIPOS) tipos.set(label, { units: 0, nombres: new Set() });
  return { units: 0, nombres: new Set(), tipos };
}

function referidoProjects(
  roster: readonly { id: string; label: string }[],
  buckets: ReadonlyMap<string, ReferidoBucket>,
): ReferidosVista["byProject"] {
  return roster.map((project) => {
    const bucket = buckets.get(project.id) ?? referidoBucket();
    return {
      id: project.id,
      label: project.label,
      units: bucket.units,
      nombres: sortedNames(bucket.nombres),
      tipos: REFERIDO_TIPOS.map((label) => {
        const bar = bucket.tipos.get(label);
        return {
          id: label,
          label,
          units: bar?.units ?? 0,
          nombres: bar ? sortedNames(bar.nombres) : [],
        };
      }),
    };
  });
}

async function creditosProjectIds(names: string[]): Promise<Set<string>> {
  const db = createAdminClient().schema("creditos");
  const { data, error } = await db.from("dim_project").select("id,name").in("name", names);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => String((row as { id: unknown }).id)));
}

async function creditosProjectSlugs(): Promise<Map<string, string>> {
  const db = createAdminClient().schema("creditos");
  const { data, error } = await db.from("dim_project").select("id,name");
  if (error) throw new Error(error.message);
  const slugs = new Map<string, string>();
  for (const row of data ?? []) {
    const id = String((row as { id: unknown }).id ?? "");
    const slug = slugForName(String((row as { name: unknown }).name ?? ""));
    if (id !== "" && slug) slugs.set(id, slug);
  }
  return slugs;
}

async function loadReferralDeals(): Promise<{ rows: Record<string, unknown>[]; capped: boolean }> {
  const db = createAdminClient().schema("creditos");
  const rows: Record<string, unknown>[] = [];
  for (let start = 0; start < CAP; start += PAGE) {
    const { data, error } = await db
      .from("fact_deal")
      .select("pipedrive_deal_id,project_id,referido,tipo_de_referido,nombre_de_referidor")
      .order("pipedrive_deal_id")
      .range(start, start + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, capped: false };
  }
  return { rows, capped: true };
}

async function buildReferidos(filters: VistaFilters, range: DateWindow, dims: Dims): Promise<ReferidosVista> {
  const choices = emptyChoices();
  const roster = referidoRoster(filters, dims);
  const names = filters.projectIds === null
    ? null
    : filters.projectIds
      .map((id) => dims.projects.find((project) => project.id === id)?.name)
      .filter((name): name is string => Boolean(name) && name !== "Sin dato");
  const projectIds = names === null ? null : names.length === 0 ? new Set<string>() : await creditosProjectIds(names);
  if (projectIds && projectIds.size === 0) {
    return {
      ...base(
        "¿Cuántos tratos de créditos son referidos, y quién los refirió?",
        range,
        "Referido, tipo de referido y nombre de referidor salen del trato de créditos. Un campo vacío no entra como cero.",
        `Ningún trato de créditos cae en este proyecto. ${referralScopeNote(filters)}`,
        dims,
        choices,
      ),
      section: "control-referidos",
      scopedDeals: 0,
      si: null,
      sinTipo: null,
      byTipo: [],
      nombres: [],
      nombresTotal: null,
      referidores: [],
      byProject: referidoProjects(roster, new Map()),
    };
  }
  const [loaded, slugOf] = await Promise.all([loadReferralDeals(), creditosProjectSlugs()]);
  const rows = projectIds ? loaded.rows.filter((row) => projectIds.has(String(row.project_id ?? ""))) : loaded.rows;
  const seen = new Set<string>();
  let sawReferido = false;
  let si = 0;
  let sinTipo = 0;
  const tipos = new Map<string, number>();
  const nombres = new Set<string>();
  const scopeNames = new Set<string>();
  const buckets = new Map<string, ReferidoBucket>();
  for (const project of roster) buckets.set(project.id, referidoBucket());
  for (const row of rows) {
    const id = String(row.pipedrive_deal_id ?? "");
    if (id === "" || seen.has(id)) continue;
    seen.add(id);
    const referido = referralText(row.referido);
    const tipo = referralText(row.tipo_de_referido);
    const nombre = referralText(row.nombre_de_referidor);
    if (referido != null) {
      sawReferido = true;
      if (referido === "Si") {
        si += 1;
        if (tipo == null) sinTipo += 1;
        else tipos.set(tipo, (tipos.get(tipo) ?? 0) + 1);
        if (nombre != null) scopeNames.add(nombre);
        const slug = slugOf.get(String(row.project_id ?? ""));
        const bucket = slug ? buckets.get(slug) : undefined;
        if (bucket) {
          bucket.units += 1;
          if (nombre != null) bucket.nombres.add(nombre);
          if (tipo != null) {
            const bar = bucket.tipos.get(tipo);
            if (bar) {
              bar.units += 1;
              if (nombre != null) bar.nombres.add(nombre);
            }
          }
        }
      }
    }
    if (nombre != null) nombres.add(nombre);
  }
  const listed = [...nombres].sort((a, b) => a.localeCompare(b, "es"));
  const notes = [
    loaded.rows.length === 0
      ? "Todavía no hay tratos de créditos."
      : seen.size === 0
        ? `Ningún trato de créditos cae en este proyecto. ${referralScopeNote(filters)}`
        : referralScopeNote(filters),
  ];
  if (loaded.capped) notes.push("La consulta llegó a 5.000 tratos. El recuento puede quedar corto.");
  return {
    ...base(
      "¿Cuántos tratos de créditos son referidos, y quién los refirió?",
      range,
      "Referido, tipo de referido y nombre de referidor salen del trato de créditos. Un campo vacío no entra como cero.",
      notes.filter((note) => note).join(" "),
      dims,
      choices,
    ),
    section: "control-referidos",
    scopedDeals: seen.size,
    si: sawReferido ? si : null,
    sinTipo: sawReferido ? sinTipo : null,
    byTipo: [...tipos.entries()]
      .map(([label, units]) => ({ id: label, label, units, gtq: null }))
      .sort((a, b) => b.units - a.units || a.label.localeCompare(b.label, "es")),
    nombres: listed.slice(0, NAME_CAP),
    nombresTotal: listed.length === 0 ? null : listed.length,
    referidores: sortedNames(scopeNames),
    byProject: referidoProjects(roster, buckets),
  };
}
