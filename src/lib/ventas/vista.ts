import { createAdminClient } from "@/lib/supabase/admin";
import { eachDay, mergeWindows, monthFactor, round1, sumNullable } from "./pace";
import {
  guatemalaToday,
  inclusiveDays,
  monthEnd,
  monthName,
  monthStart,
  monthsTouched,
  previousWindows,
  resolveRange,
  windowLabel,
  yearAgoWindow,
  type DateWindow,
  type PeriodPreset,
} from "./period";
import type {
  CanalesVista,
  Choice,
  DailyPoint,
  MeasureRow,
  ObjetivosVista,
  RhythmPoint,
  SaleLine,
  StatusRow,
  StatusVista,
  TargetCell,
  TargetEditor,
  TotalesVista,
  VentasVista,
  VistaSection,
} from "./vista-types";
import { buildControlVista, isControlSection } from "./vista-operativo";
import { buildStockVista, isStockSection } from "./vista-operativo";

const PAGE = 1000;
const CAP = 5000;
const LIST_CAP = 300;
const CACHE_MS = 30_000;
const DIM_MS = 5 * 60_000;
const NO_SALES = "Este periodo todavía no tiene ventas.";
const QUESTIONS: Record<VistaSection, string> = {
  "ventas-totales": "¿Cuánto vendimos en el periodo, ya netos los desistimientos?",
  "objetivos-de-ventas": "¿El periodo va sobre la meta, por proyecto y por asesor?",
  "status-de-ventas": "A la fecha de cierre, ¿hay déficit o excedente, por proyecto y por asesor?",
  "ventas-por-canales": "¿Qué canales están produciendo las ventas del periodo?",
  "analisis-de-inventario": "¿Qué modelos se están vendiendo y cuáles siguen en inventario?",
  "inventario-general": "¿Cuánto inventario está vendido, congelado y disponible?",
  "valor-del-proyecto": "¿Cuánto vale el proyecto hoy, y cuánto valor salió por desistimientos?",
  "tasa-de-conversion": "De los leads del periodo, ¿cuántos llegan a visita, a venta y a PCV?",
  desistimientos: "¿Cuánto se desistió, y qué valor sale del proyecto?",
  descuentos: "¿Cuánto descuento se está otorgando, y quién lo concentra?",
  "subidas-de-precios": "¿Cuánto subió el precio de lista, y en qué proyectos?",
  "ff-y-casos-especiales": "¿Cuántas ventas del periodo son Friends & Family o caso especial, y qué peso tienen?",
  promociones: "¿Qué promociones están cerrando ventas, y qué peso tienen?",
};

const SALE_COLUMNS = "deal_id,project_id,tower_id,asesor_id,fuente_id,sale_on,value_gtq,lost_on";

export type VistaFilters = {
  preset: PeriodPreset;
  customFrom: string | null;
  customTo: string | null;
  compareN: boolean;
  n: number;
  compareYear: boolean;
  projectIds: string[] | null;
  asesorId: string | null;
  torreId: string | null;
  fuenteId: string | null;
  modeloId: string | null;
  habitacionesId: string | null;
  estadoUnidad: string | null;
  buscar: string | null;
  motivoId: string | null;
  descuentoId: string | null;
  promocionId: string | null;
  casoId: string | null;
};

type Filters = VistaFilters;

type Sale = {
  dealId: string;
  projectId: string;
  towerId: string;
  asesorId: string;
  fuenteId: string;
  saleOn: string | null;
  lostOn: string | null;
  valueGtq: number | null;
};

type Named = { id: string; name: string; sin: boolean };
type Dims = {
  projects: Named[];
  asesores: Map<string, Named>;
  fuentes: Map<string, Named>;
  torres: Map<string, string>;
};

type Money = { units: number; gtq: number | null; sin: number };
type TargetBook = { cells: TargetCell[]; editor: TargetEditor };

const payloadCache = new Map<string, { at: number; body: VentasVista }>();
let dimCache: { at: number; dims: Dims } | null = null;
let eventTableReady: boolean | null = null;

export function clearVistaCache(): void {
  payloadCache.clear();
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function db() {
  return createAdminClient().schema("ventas");
}

type Db = ReturnType<typeof db>;

function inWindow(day: string | null, window: DateWindow): boolean {
  return Boolean(day && day >= window.from && day <= window.to);
}

function projectOk(projectId: string, filters: Filters): boolean {
  return filters.projectIds === null || filters.projectIds.includes(projectId);
}

function moneyOf(sales: Sale[]): Money {
  let gtq = 0;
  let seen = false;
  let sin = 0;
  for (const sale of sales) {
    if (sale.valueGtq === null || sale.valueGtq === 0) sin += 1;
    if (sale.valueGtq === null) continue;
    gtq += sale.valueGtq;
    seen = true;
  }
  return { units: sales.length, gtq: seen ? gtq : null, sin };
}

function subtract(gross: Money, loss: Money): number | null {
  if (gross.gtq === null && loss.gtq === null) return null;
  return (gross.gtq ?? 0) - (loss.gtq ?? 0);
}

async function loadDims(client: Db): Promise<Dims> {
  if (dimCache && Date.now() - dimCache.at < DIM_MS) return dimCache.dims;
  const [projects, asesores, fuentes, torres] = await Promise.all([
    client.from("dim_project").select("id,name,is_sin_dato"),
    client.from("dim_asesor").select("id,name,is_sin_dato"),
    client.from("dim_fuente").select("id,name,is_sin_dato"),
    client.from("dim_tower").select("id,name"),
  ]);
  for (const result of [projects, asesores, fuentes, torres]) {
    if (result.error) throw new Error(result.error.message);
  }
  const named = (rows: Record<string, unknown>[] | null, sinKey: string): Named[] =>
    (rows ?? []).map((row) => ({ id: String(row.id), name: String(row.name), sin: row[sinKey] === true }));
  const dims: Dims = {
    projects: named(projects.data as Record<string, unknown>[] | null, "is_sin_dato"),
    asesores: new Map(named(asesores.data as Record<string, unknown>[] | null, "is_sin_dato").map((row) => [row.id, row])),
    fuentes: new Map(named(fuentes.data as Record<string, unknown>[] | null, "is_sin_dato").map((row) => [row.id, row])),
    torres: new Map((torres.data ?? []).map((row) => [String(row.id), String(row.name)])),
  };
  dimCache = { at: Date.now(), dims };
  return dims;
}

function mapSale(row: Record<string, unknown>): Sale {
  return {
    dealId: String(row.deal_id),
    projectId: String(row.project_id),
    towerId: String(row.tower_id),
    asesorId: String(row.asesor_id),
    fuenteId: String(row.fuente_id),
    saleOn: (row.sale_on as string | null) ?? null,
    lostOn: (row.lost_on as string | null) ?? null,
    valueGtq: num(row.value_gtq),
  };
}

async function fetchBounded(
  client: Db,
  column: "sale_on" | "lost_on",
  window: { from: string; to: string },
  projectIds: string[] | null,
): Promise<{ rows: Sale[]; capped: boolean }> {
  if (projectIds && projectIds.length === 0) return { rows: [], capped: false };
  const rows: Sale[] = [];
  for (let offset = 0; offset < CAP; offset += PAGE) {
    let query = client
      .from("v_sale")
      .select(SALE_COLUMNS)
      .gte(column, window.from)
      .lte(column, window.to)
      .range(offset, offset + PAGE - 1);
    if (projectIds) query = query.in("project_id", projectIds);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch.map(mapSale));
    if (batch.length < PAGE) return { rows, capped: false };
  }
  return { rows, capped: true };
}

async function fetchIslands(
  client: Db,
  column: "sale_on" | "lost_on",
  windows: { from: string; to: string }[],
  projectIds: string[] | null,
): Promise<{ rows: Sale[]; capped: boolean }> {
  const islands = mergeWindows(windows);
  const batches = await Promise.all(islands.map((island) => fetchBounded(client, column, island, projectIds)));
  const seen = new Set<string>();
  const rows: Sale[] = [];
  for (const batch of batches) {
    for (const sale of batch.rows) {
      if (seen.has(sale.dealId)) continue;
      seen.add(sale.dealId);
      rows.push(sale);
    }
  }
  return { rows, capped: batches.some((batch) => batch.capped) };
}

function missingTable(message: string): boolean {
  return /target_event|PGRST204|PGRST205|schema cache|does not exist|42P01/i.test(message);
}

async function eventsReady(client: Db): Promise<boolean> {
  if (eventTableReady === true) return true;
  const probe = await client.from("target_event").select("id").limit(1);
  if (!probe.error) {
    eventTableReady = true;
    return true;
  }
  if (missingTable(probe.error.message)) return false;
  throw new Error(probe.error.message);
}

async function loadTargets(client: Db, dims: Dims, months: string[]): Promise<TargetBook> {
  const projects = dims.projects
    .filter((project) => !project.sin)
    .map((project) => ({ id: project.id, label: project.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const asesores = [...dims.asesores.values()]
    .filter((asesor) => !asesor.sin)
    .map((asesor) => ({ id: asesor.id, label: asesor.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const editorMonths = months.map((month) => ({ month, label: monthName(month) }));
  const empty: TargetBook = {
    cells: [],
    editor: { tableReady: false, months: editorMonths, projects, asesores, cells: [], history: [] },
  };
  if (months.length === 0) return empty;

  const from = months[0];
  const to = months[months.length - 1];
  const ready = await eventsReady(client);
  const [snapshot, events] = await Promise.all([
    client
      .from("fact_target")
      .select("asesor_id,project_id,month_start,target_units,target_gtq")
      .gte("month_start", from)
      .lte("month_start", to),
    ready
      ? client
          .from("target_event")
          .select("asesor_id,project_id,month_start,target_units,target_gtq,created_at")
          .gte("month_start", from)
          .lte("month_start", to)
          .order("created_at", { ascending: true })
          .limit(CAP)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (snapshot.error) throw new Error(snapshot.error.message);
  if (events.error) throw new Error(events.error.message);

  const cells = new Map<string, TargetCell>();
  for (const row of snapshot.data ?? []) {
    const cell = cellFrom(row as unknown as Record<string, unknown>);
    cells.set(grain(cell), cell);
  }
  const historyRows = [...(events.data ?? [])].reverse();
  for (const row of events.data ?? []) {
    const cell = cellFrom(row as unknown as Record<string, unknown>);
    cells.set(grain(cell), cell);
  }
  const list = [...cells.values()];
  const history = historyRows.slice(0, 12).map((row) => {
    const record = row as unknown as Record<string, unknown>;
    const cell = cellFrom(record);
    return {
      asesor: dims.asesores.get(cell.asesorId)?.name ?? "Sin dato",
      project: dims.projects.find((project) => project.id === cell.projectId)?.name ?? "Sin dato",
      month: cell.month,
      units: cell.units,
      gtq: cell.gtq,
      enteredAt: String(record.created_at ?? ""),
    };
  });
  return {
    cells: list,
    editor: { tableReady: ready, months: editorMonths, projects, asesores, cells: list, history },
  };
}

function cellFrom(row: Record<string, unknown>): TargetCell {
  return {
    asesorId: String(row.asesor_id),
    projectId: String(row.project_id),
    month: String(row.month_start).slice(0, 10),
    units: num(row.target_units),
    gtq: num(row.target_gtq),
  };
}

function grain(cell: TargetCell): string {
  return `${cell.asesorId}|${cell.projectId}|${cell.month}`;
}

function applySpecific(sales: Sale[], filters: Filters, section: VistaSection): Sale[] {
  return sales.filter((sale) => {
    if (filters.asesorId && sale.asesorId !== filters.asesorId) return false;
    if (section === "ventas-totales" && filters.torreId && sale.towerId !== filters.torreId) return false;
    if (section === "ventas-por-canales" && filters.fuenteId && sale.fuenteId !== filters.fuenteId) return false;
    return true;
  });
}

function countChoices(ids: string[], labels: Map<string, string>): Choice[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: labels.get(id) ?? "Sin dato", count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"))
    .map(({ id, label }) => ({ id, label }));
}

function nameMap(rows: Iterable<Named>): Map<string, string> {
  return new Map([...rows].map((row) => [row.id, row.name]));
}

function projectChoices(dims: Dims): Choice[] {
  return dims.projects
    .filter((project) => !project.sin)
    .map((project) => ({ id: project.id, label: project.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function scopedProjects(dims: Dims, filters: Filters, sales: Sale[]): string[] {
  const ids = new Set<string>();
  if (filters.projectIds) {
    for (const id of filters.projectIds) ids.add(id);
  } else {
    for (const project of dims.projects) if (!project.sin) ids.add(project.id);
  }
  for (const sale of sales) ids.add(sale.projectId);
  return [...ids];
}

function toLine(sale: Sale, kind: SaleLine["kind"], day: string, dims: Dims): SaleLine {
  return {
    dealId: sale.dealId,
    kind,
    day,
    projectId: sale.projectId,
    project: dims.projects.find((project) => project.id === sale.projectId)?.name ?? "Sin dato",
    asesorId: sale.asesorId,
    asesor: dims.asesores.get(sale.asesorId)?.name ?? "Sin dato",
    fuenteId: sale.fuenteId,
    fuente: dims.fuentes.get(sale.fuenteId)?.name ?? "Sin dato",
    torre: dims.torres.get(sale.towerId) ?? "Sin dato",
    gtq: sale.valueGtq,
  };
}

function linesOf(sales: Sale[], losses: Sale[], dims: Dims): { lines: SaleLine[]; total: number } {
  const rows: SaleLine[] = [
    ...sales.flatMap((sale) => (sale.saleOn ? [toLine(sale, "venta", sale.saleOn, dims)] : [])),
    ...losses.flatMap((sale) => (sale.lostOn ? [toLine(sale, "desistimiento", sale.lostOn, dims)] : [])),
  ];
  rows.sort((a, b) => b.day.localeCompare(a.day) || a.project.localeCompare(b.project, "es"));
  return { lines: rows.slice(0, LIST_CAP), total: rows.length };
}

function scopedCells(cells: TargetCell[], filters: Filters, months: string[]): TargetCell[] {
  const allowed = new Set(months);
  return cells.filter(
    (cell) => allowed.has(cell.month) && projectOk(cell.projectId, filters) && (!filters.asesorId || cell.asesorId === filters.asesorId),
  );
}

function gap(actual: number, target: number | null): number | null {
  if (target == null) return null;
  return round1(actual - target);
}

function shortMonth(iso: string): string {
  const names = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${names[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;
}

function bucketIndex(day: string, buckets: string[]): number {
  return buckets.indexOf(monthStart(day));
}

function accumulate(sales: Sale[], losses: Sale[], buckets: string[] | null, from: string, to: string): { units: number[]; gtq: number[] } {
  const length = buckets ? buckets.length : inclusiveDays(from, to);
  const units = Array.from({ length }, () => 0);
  const gtq = Array.from({ length }, () => 0);
  const add = (day: string | null, sign: 1 | -1, value: number | null) => {
    if (!day || day < from || day > to) return;
    const index = buckets ? bucketIndex(day, buckets) : inclusiveDays(from, day) - 1;
    if (index < 0 || index >= length) return;
    units[index] += sign;
    if (value !== null) gtq[index] += sign * value;
  };
  for (const sale of sales) add(sale.saleOn, 1, sale.valueGtq);
  for (const sale of losses) add(sale.lostOn, -1, sale.valueGtq);
  let runUnits = 0;
  let runGtq = 0;
  return {
    units: units.map((value) => (runUnits += value)),
    gtq: gtq.map((value) => (runGtq += value)),
  };
}

function dailyBars(sales: Sale[], losses: Sale[], from: string, to: string): number[] {
  const length = inclusiveDays(from, to);
  const bars = Array.from({ length }, () => 0);
  const add = (day: string | null, sign: 1 | -1) => {
    if (!day || day < from || day > to) return;
    const index = inclusiveDays(from, day) - 1;
    if (index >= 0 && index < length) bars[index] += sign;
  };
  for (const sale of sales) add(sale.saleOn, 1);
  for (const sale of losses) add(sale.lostOn, -1);
  return bars;
}

function noticeFor(units: number, sinMonto: number, capped: boolean): string | null {
  if (capped) return "La consulta del periodo llegó a 5.000 filas. Afina proyecto o periodo.";
  if (units === 0) return NO_SALES;
  if (sinMonto > 0) return `${sinMonto} ventas sin monto. Entran en las unidades y no en los quetzales.`;
  return null;
}

function joinNotice(parts: Array<string | null>): string | null {
  const unique = parts.filter((item): item is string => Boolean(item)).filter((item, index, all) => all.indexOf(item) === index);
  return unique.length ? unique.join(" ") : null;
}

function buildTotales(
  filters: Filters,
  range: DateWindow,
  dims: Dims,
  sales: Sale[],
  losses: Sale[],
  spanSales: Sale[],
  spanLosses: Sale[],
  capped: boolean,
  choices: VentasVista["choices"],
): TotalesVista {
  const gross = moneyOf(sales);
  const loss = moneyOf(losses);
  const months = monthsTouched(range.from, range.to);
  const monthly = months.length > 1 || inclusiveDays(range.from, range.to) > 45;
  const buckets = monthly ? months : null;
  const current = accumulate(sales, losses, buckets, range.from, range.to);
  const bars = monthly ? null : dailyBars(sales, losses, range.from, range.to);
  const priorCount = filters.compareN ? filters.n : months.length === 1 ? 1 : 0;
  const priors = priorCount > 0 ? previousWindows(range, priorCount) : [];
  const priorSeries = priors.map((window) =>
    accumulate(
      spanSales.filter((sale) => inWindow(sale.saleOn, window)),
      spanLosses.filter((sale) => inWindow(sale.lostOn, window)),
      null,
      window.from,
      window.to,
    ),
  );
  const yearWindow = filters.compareYear ? yearAgoWindow(range) : null;
  const yearSeries = yearWindow
    ? accumulate(
        spanSales.filter((sale) => inWindow(sale.saleOn, yearWindow)),
        spanLosses.filter((sale) => inWindow(sale.lostOn, yearWindow)),
        monthly ? monthsTouched(yearWindow.from, yearWindow.to) : null,
        yearWindow.from,
        yearWindow.to,
      )
    : null;
  const daily: DailyPoint[] = current.units.map((neto, index) => {
    const anteriorValues = priorSeries
      .map((series) => series.units[index])
      .filter((value): value is number => value != null);
    const anterior = anteriorValues.length
      ? round1(anteriorValues.reduce((sum, value) => sum + value, 0) / anteriorValues.length)
      : null;
    return {
      label: monthly ? shortMonth(months[index]) : String(index + 1),
      dia: bars ? bars[index] : neto - (index > 0 ? current.units[index - 1] : 0),
      neto,
      netoGtq: current.gtq[index],
      anterior: monthly ? null : anterior,
      anio: yearSeries?.units[index] ?? null,
    };
  });
  const byProject = scopedProjects(dims, filters, [...sales, ...losses])
    .map((id) => {
      const grossProject = moneyOf(sales.filter((sale) => sale.projectId === id));
      const lossProject = moneyOf(losses.filter((sale) => sale.projectId === id));
      return {
        id,
        label: dims.projects.find((project) => project.id === id)?.name ?? "Sin dato",
        units: grossProject.units - lossProject.units,
        gtq: subtract(grossProject, lossProject),
      };
    })
    .sort((a, b) => b.units - a.units || a.label.localeCompare(b.label, "es"));
  const list = linesOf(sales, losses, dims);
  const priorNet = priorSeries[0] ? priorSeries[0].units[priorSeries[0].units.length - 1] ?? null : null;
  return {
    section: "ventas-totales",
    question: QUESTIONS["ventas-totales"],
    periodLabel: range.label,
    rangeLabel: windowLabel(range),
    caption: monthly
      ? "Cada barra es el neto del mes. La línea es el neto acumulado. Una venta entra el día en que se cumplen las dos puertas."
      : "Cada barra es el neto del día. La línea es el neto acumulado. La punteada es el mismo tramo del periodo anterior.",
    notice: noticeFor(gross.units, gross.sin, capped),
    projects: projectChoices(dims),
    choices,
    lines: list.lines,
    listShown: list.lines.length,
    listTotal: list.total,
    grossUnits: gross.units,
    grossGtq: gross.gtq,
    lossUnits: loss.units,
    lossGtq: loss.gtq,
    netUnits: gross.units - loss.units,
    netGtq: subtract(gross, loss),
    sinMonto: gross.sin,
    priorLabel: priors[0] ? (priorCount > 1 ? `Promedio de ${priorCount} periodos` : "Periodo anterior") : null,
    priorNetUnits: priorNet,
    yearLabel: yearWindow ? "Año anterior" : null,
    yearNetUnits: yearSeries ? yearSeries.units[yearSeries.units.length - 1] ?? null : null,
    daily,
    byProject,
  };
}

function measureRows(
  ids: string[],
  labelOf: (id: string) => string,
  sales: Sale[],
  cells: TargetCell[],
  keyOfSale: (sale: Sale) => string,
  keyOfCell: (cell: TargetCell) => string,
): MeasureRow[] {
  return ids
    .map((id) => {
      const group = sales.filter((sale) => keyOfSale(sale) === id);
      const money = moneyOf(group);
      const mine = cells.filter((cell) => keyOfCell(cell) === id);
      const targetUnits = sumNullable(mine.map((cell) => cell.units));
      const targetGtq = sumNullable(mine.map((cell) => cell.gtq));
      return {
        id,
        label: labelOf(id),
        units: money.units,
        targetUnits,
        gtq: money.gtq,
        targetGtq,
        gapUnits: gap(money.units, targetUnits),
        gapGtq: money.gtq == null || targetGtq == null ? null : round1(money.gtq - targetGtq),
      };
    })
    .sort((a, b) => {
      if (a.gapUnits == null && b.gapUnits == null) return b.units - a.units;
      if (a.gapUnits == null) return 1;
      if (b.gapUnits == null) return -1;
      return a.gapUnits - b.gapUnits;
    });
}

function buildObjetivos(
  filters: Filters,
  range: DateWindow,
  dims: Dims,
  sales: Sale[],
  book: TargetBook,
  capped: boolean,
  choices: VentasVista["choices"],
): ObjetivosVista {
  const months = monthsTouched(range.from, range.to);
  const cells = scopedCells(book.cells, filters, months);
  const gross = moneyOf(sales);
  const targetUnits = sumNullable(cells.map((cell) => cell.units));
  const targetGtq = sumNullable(cells.map((cell) => cell.gtq));
  const projectIds = scopedProjects(dims, filters, sales);
  for (const cell of cells) if (!projectIds.includes(cell.projectId)) projectIds.push(cell.projectId);
  const asesorIds = [...new Set([...sales.map((sale) => sale.asesorId), ...cells.map((cell) => cell.asesorId)])];
  const list = linesOf(sales, [], dims);
  const baseNotice = noticeFor(gross.units, gross.sin, capped);
  const metaNotice = targetUnits == null ? "Este periodo no tiene meta. Entra las unidades y los quetzales del mes." : null;
  return {
    section: "objetivos-de-ventas",
    question: QUESTIONS["objetivos-de-ventas"],
    periodLabel: range.label,
    rangeLabel: windowLabel(range),
    caption: `La meta de un mes abierto es la del mes completo. El real corre hasta ${windowLabel(range)}. Meses: ${months.map(monthName).join(", ")}.`,
    notice: joinNotice([metaNotice, baseNotice]),
    projects: projectChoices(dims),
    choices,
    lines: list.lines,
    listShown: list.lines.length,
    listTotal: list.total,
    units: gross.units,
    targetUnits,
    gtq: gross.gtq,
    targetGtq,
    ratio: targetUnits ? gross.units / targetUnits : null,
    gapUnits: gap(gross.units, targetUnits),
    byProject: measureRows(
      projectIds,
      (id) => dims.projects.find((project) => project.id === id)?.name ?? "Sin dato",
      sales,
      cells,
      (sale) => sale.projectId,
      (cell) => cell.projectId,
    ),
    byAsesor: measureRows(
      asesorIds,
      (id) => dims.asesores.get(id)?.name ?? "Sin dato",
      sales,
      cells,
      (sale) => sale.asesorId,
      (cell) => cell.asesorId,
    ),
    editor: book.editor,
  };
}

function paceValue(value: number | null, factor: number): number | null {
  if (value == null) return null;
  return value * factor;
}

function statusRows(
  ids: string[],
  labelOf: (id: string) => string,
  sales: Sale[],
  cells: TargetCell[],
  keyOfSale: (sale: Sale) => string,
  keyOfCell: (cell: TargetCell) => string,
  range: DateWindow,
  today: string,
): StatusRow[] {
  return ids
    .map((id) => {
      const money = moneyOf(sales.filter((sale) => keyOfSale(sale) === id));
      const mine = cells.filter((cell) => keyOfCell(cell) === id);
      const targetUnits = sumNullable(mine.map((cell) => cell.units));
      const targetGtq = sumNullable(mine.map((cell) => cell.gtq));
      const paceUnits = sumNullable(mine.map((cell) => paceValue(cell.units, monthFactor(cell.month, range, today))));
      const paceGtq = sumNullable(mine.map((cell) => paceValue(cell.gtq, monthFactor(cell.month, range, today))));
      return {
        id,
        label: labelOf(id),
        units: money.units,
        paceUnits: paceUnits == null ? null : round1(paceUnits),
        targetUnits,
        gapUnits: gap(money.units, paceUnits),
        gtq: money.gtq,
        paceGtq: paceGtq == null ? null : round1(paceGtq),
        targetGtq,
        gapGtq: money.gtq == null || paceGtq == null ? null : round1(money.gtq - paceGtq),
      };
    })
    .sort((a, b) => {
      if (a.gapUnits == null && b.gapUnits == null) return b.units - a.units;
      if (a.gapUnits == null) return 1;
      if (b.gapUnits == null) return -1;
      return a.gapUnits - b.gapUnits;
    });
}

function toneOf(gapUnits: number | null): StatusVista["tone"] {
  if (gapUnits == null) return "sin-meta";
  if (gapUnits < -0.05) return "deficit";
  if (gapUnits > 0.05) return "excedente";
  return "en-linea";
}

function salesByDay(sales: Sale[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const sale of sales) {
    if (!sale.saleOn) continue;
    counts.set(sale.saleOn, (counts.get(sale.saleOn) ?? 0) + 1);
  }
  return counts;
}

function buildRhythm(range: DateWindow, sales: Sale[], cells: TargetCell[], today: string): RhythmPoint[] {
  const months = monthsTouched(range.from, range.to);
  const hasUnits = cells.some((cell) => cell.units != null);
  if (months.length === 1 && inclusiveDays(range.from, range.to) <= 45) {
    const aligned = range.from === monthStart(range.from);
    const start = range.from;
    const end = aligned ? monthEnd(range.from) : range.to;
    const target = sumNullable(cells.map((cell) => cell.units));
    const pace = sumNullable(cells.map((cell) => paceValue(cell.units, monthFactor(cell.month, range, today))));
    const monthDays = inclusiveDays(monthStart(range.from), monthEnd(range.from));
    const domain = eachDay(start, end);
    const byDay = salesByDay(sales);
    let real = 0;
    return domain.map((day, index) => {
      if (day >= range.from && day <= range.to && day <= today) real += byDay.get(day) ?? 0;
      let ritmo: number | null = null;
      if (hasUnits && aligned && target != null && monthDays > 0) {
        ritmo = round1((target * inclusiveDays(monthStart(range.from), day)) / monthDays);
      } else if (hasUnits && pace != null && domain.length > 0) {
        ritmo = round1((pace * (index + 1)) / domain.length);
      }
      return {
        label: String(Number(day.slice(8, 10))),
        real: day <= today && day <= range.to ? real : null,
        ritmo,
      };
    });
  }
  let real = 0;
  let ritmo = 0;
  const points: RhythmPoint[] = [];
  for (const month of months) {
    const end = monthEnd(month);
    const sliceTo = range.to < end ? range.to : end;
    real += sales.filter((sale) => sale.saleOn != null && sale.saleOn >= month && sale.saleOn <= sliceTo).length;
    const monthTarget = sumNullable(cells.filter((cell) => cell.month === month).map((cell) => cell.units));
    if (monthTarget != null) ritmo += monthTarget * monthFactor(month, range, today);
    points.push({
      label: shortMonth(month),
      real: month <= today ? real : null,
      ritmo: hasUnits ? round1(ritmo) : null,
    });
  }
  const full = sumNullable(cells.map((cell) => cell.units));
  const lastFactor = monthFactor(months[months.length - 1], range, today);
  if (full != null && lastFactor < 0.999) points.push({ label: "Cierre", real: null, ritmo: round1(full) });
  return points;
}

function dayLabel(range: DateWindow, today: string): { closeOn: string; dayLabel: string } {
  const closeOn = monthEnd(range.to);
  if (today >= closeOn) return { closeOn, dayLabel: "Mes cerrado" };
  const start = monthStart(today);
  const elapsed = inclusiveDays(start, today);
  const total = inclusiveDays(start, closeOn);
  const left = inclusiveDays(today, closeOn) - 1;
  return { closeOn, dayLabel: `Día ${elapsed} de ${total} · faltan ${left}` };
}

function buildStatus(
  filters: Filters,
  range: DateWindow,
  today: string,
  dims: Dims,
  sales: Sale[],
  book: TargetBook,
  capped: boolean,
  choices: VentasVista["choices"],
): StatusVista {
  const months = monthsTouched(range.from, range.to);
  const cells = scopedCells(book.cells, filters, months);
  const gross = moneyOf(sales);
  const targetUnits = sumNullable(cells.map((cell) => cell.units));
  const targetGtq = sumNullable(cells.map((cell) => cell.gtq));
  const paceUnitsRaw = sumNullable(cells.map((cell) => paceValue(cell.units, monthFactor(cell.month, range, today))));
  const paceGtqRaw = sumNullable(cells.map((cell) => paceValue(cell.gtq, monthFactor(cell.month, range, today))));
  const paceUnits = paceUnitsRaw == null ? null : round1(paceUnitsRaw);
  const paceGtq = paceGtqRaw == null ? null : round1(paceGtqRaw);
  const projectIds = scopedProjects(dims, filters, sales);
  for (const cell of cells) if (!projectIds.includes(cell.projectId)) projectIds.push(cell.projectId);
  const asesorIds = [...new Set([...sales.map((sale) => sale.asesorId), ...cells.map((cell) => cell.asesorId)])];
  const list = linesOf(sales, [], dims);
  const dates = dayLabel(range, today);
  const baseNotice = noticeFor(gross.units, gross.sin, capped);
  const metaNotice = targetUnits == null ? "Este periodo no tiene meta. El ritmo aparece cuando entra la meta del mes." : null;
  return {
    section: "status-de-ventas",
    question: QUESTIONS["status-de-ventas"],
    periodLabel: range.label,
    rangeLabel: windowLabel(range),
    caption: "El ritmo es la meta prorrateada a hoy. Un mes ya cerrado se compara contra la meta completa. La fecha de cierre es el último día del mes.",
    notice: joinNotice([metaNotice, baseNotice]),
    projects: projectChoices(dims),
    choices,
    lines: list.lines,
    listShown: list.lines.length,
    listTotal: list.total,
    tone: toneOf(gap(gross.units, paceUnitsRaw)),
    units: gross.units,
    paceUnits,
    targetUnits,
    gapUnits: gap(gross.units, paceUnitsRaw),
    gtq: gross.gtq,
    paceGtq,
    targetGtq,
    gapGtq: gross.gtq == null || paceGtqRaw == null ? null : round1(gross.gtq - paceGtqRaw),
    closeOn: dates.closeOn,
    dayLabel: dates.dayLabel,
    rhythm: buildRhythm(range, sales, cells, today),
    byProject: statusRows(
      projectIds,
      (id) => dims.projects.find((project) => project.id === id)?.name ?? "Sin dato",
      sales,
      cells,
      (sale) => sale.projectId,
      (cell) => cell.projectId,
      range,
      today,
    ),
    byAsesor: statusRows(
      asesorIds,
      (id) => dims.asesores.get(id)?.name ?? "Sin dato",
      sales,
      cells,
      (sale) => sale.asesorId,
      (cell) => cell.asesorId,
      range,
      today,
    ),
    editor: book.editor,
  };
}

function buildCanales(
  filters: Filters,
  range: DateWindow,
  dims: Dims,
  sales: Sale[],
  trail: Sale[],
  capped: boolean,
  choices: VentasVista["choices"],
): CanalesVista {
  const gross = moneyOf(sales);
  const grouped = new Map<string, Sale[]>();
  for (const sale of sales) {
    const list = grouped.get(sale.fuenteId) ?? [];
    list.push(sale);
    grouped.set(sale.fuenteId, list);
  }
  const ranked = [...grouped.entries()]
    .map(([id, list]) => ({ id, money: moneyOf(list) }))
    .sort((a, b) => b.money.units - a.money.units || (dims.fuentes.get(a.id)?.name ?? "").localeCompare(dims.fuentes.get(b.id)?.name ?? "", "es"));
  const top = ranked.slice(0, 8);
  const rest = ranked.slice(8);
  const channels = top.map((row) => ({
    id: row.id,
    label: dims.fuentes.get(row.id)?.name ?? "Sin dato",
    units: row.money.units,
    gtq: row.money.gtq,
    share: gross.units ? row.money.units / gross.units : 0,
  }));
  if (rest.length > 0) {
    const restSales = rest.flatMap((row) => grouped.get(row.id) ?? []);
    const restMoney = moneyOf(restSales);
    channels.push({
      id: "otras",
      label: "Otras fuentes",
      units: restMoney.units,
      gtq: restMoney.gtq,
      share: gross.units ? restMoney.units / gross.units : 0,
    });
  }
  const months = seriesMonths(range);
  const leaders = top.slice(0, 4).map((row) => row.id);
  const series = leaders.map((id) => ({
    id,
    label: dims.fuentes.get(id)?.name ?? "Sin dato",
    units: months.map((month) => unitsInMonth(trail, id, month, range.to)),
  }));
  const list = linesOf(sales, [], dims);
  return {
    section: "ventas-por-canales",
    question: QUESTIONS["ventas-por-canales"],
    periodLabel: range.label,
    rangeLabel: windowLabel(range),
    caption: "Cada barra es una fuente del periodo. Las líneas son los cuatro canales con más ventas, mes a mes.",
    notice: noticeFor(gross.units, gross.sin, capped),
    projects: projectChoices(dims),
    choices,
    lines: list.lines,
    listShown: list.lines.length,
    listTotal: list.total,
    units: gross.units,
    gtq: gross.gtq,
    leader: channels[0]?.id === "otras" ? null : channels[0]?.label ?? null,
    leaderShare: channels[0]?.id === "otras" ? null : channels[0]?.share ?? null,
    channels,
    months: months.map(shortMonth),
    series,
  };
}

function unitsInMonth(rows: Sale[], fuenteId: string, month: string, limit: string): number {
  const end = monthEnd(month) < limit ? monthEnd(month) : limit;
  let count = 0;
  for (const sale of rows) {
    if (sale.fuenteId !== fuenteId || !sale.saleOn) continue;
    if (sale.saleOn >= month && sale.saleOn <= end) count += 1;
  }
  return count;
}

function seriesMonths(range: DateWindow): string[] {
  const inRange = monthsTouched(range.from, range.to);
  if (inRange.length > 1) return inRange.slice(-12);
  return monthsTouched(trailStart(range), range.to);
}

function trailStart(range: DateWindow): string {
  const cursor = monthStart(range.to);
  const [year, month] = cursor.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - 5, 1));
  const start = date.toISOString().slice(0, 10);
  return range.from < start ? range.from : start;
}

export async function buildVista(section: VistaSection, filters: Filters): Promise<VentasVista> {
  const key = JSON.stringify({ section, filters });
  const hit = payloadCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  if (isStockSection(section)) {
    const body = await buildStockVista(section, filters);
    payloadCache.set(key, { at: Date.now(), body });
    if (payloadCache.size > 40) {
      const oldest = [...payloadCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) payloadCache.delete(oldest[0]);
    }
    return body;
  }
  if (isControlSection(section)) {
    const body = await buildControlVista(section, filters);
    payloadCache.set(key, { at: Date.now(), body });
    if (payloadCache.size > 40) {
      const oldest = [...payloadCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) payloadCache.delete(oldest[0]);
    }
    return body;
  }
  const today = guatemalaToday();
  const range = resolveRange(filters.preset, filters.customFrom, filters.customTo, today);
  const client = db();
  const compare = section === "ventas-totales";
  const months = monthsTouched(range.from, range.to);
  const priorCount = compare ? (filters.compareN ? filters.n : months.length === 1 ? 1 : 0) : 0;
  const windows: DateWindow[] = [range];
  if (priorCount > 0) windows.push(...previousWindows(range, priorCount));
  if (compare && filters.compareYear) windows.push(yearAgoWindow(range));
  if (section === "ventas-por-canales") windows.push({ from: trailStart(range), to: range.to, label: "" });

  const needsLoss = section === "ventas-totales";
  const needsTarget = section === "objetivos-de-ventas" || section === "status-de-ventas";
  const dims = await loadDims(client);
  const [sold, lost, book] = await Promise.all([
    fetchIslands(client, "sale_on", windows, filters.projectIds),
    needsLoss ? fetchIslands(client, "lost_on", windows, filters.projectIds) : Promise.resolve({ rows: [] as Sale[], capped: false }),
    needsTarget ? loadTargets(client, dims, months) : Promise.resolve(null),
  ]);
  const targetBook = book ?? (await loadTargets(client, dims, []));

  const choiceSales = sold.rows.filter((sale) => inWindow(sale.saleOn, range));
  const choices = {
    asesor: countChoices(choiceSales.map((sale) => sale.asesorId), nameMap(dims.asesores.values())),
    torre: countChoices(choiceSales.map((sale) => sale.towerId), dims.torres),
    fuente: countChoices(choiceSales.map((sale) => sale.fuenteId), nameMap(dims.fuentes.values())),
    modelo: [],
    habitaciones: [],
    motivo: [],
    descuento: [],
    promocion: [],
    caso: [],
    estadoUnidad: [],
  };
  const sales = applySpecific(choiceSales, filters, section);
  const losses = applySpecific(
    lost.rows.filter((sale) => inWindow(sale.lostOn, range)),
    filters,
    section,
  );
  const scopedSpan = applySpecific(sold.rows, filters, section);
  const scopedLossSpan = applySpecific(lost.rows, filters, section);
  const capped = sold.capped || lost.capped;

  let body: VentasVista;
  if (section === "ventas-totales") {
    body = buildTotales(filters, range, dims, sales, losses, scopedSpan, scopedLossSpan, capped, choices);
  } else if (section === "objetivos-de-ventas") {
    body = buildObjetivos(filters, range, dims, sales, targetBook, capped, choices);
  } else if (section === "status-de-ventas") {
    body = buildStatus(filters, range, today, dims, sales, targetBook, capped, choices);
  } else {
    const trail = applySpecific(sold.rows, filters, section);
    body = buildCanales(filters, range, dims, sales, trail, capped, choices);
  }

  payloadCache.set(key, { at: Date.now(), body });
  if (payloadCache.size > 40) {
    const oldest = [...payloadCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) payloadCache.delete(oldest[0]);
  }
  return body;
}

export function parseVistaFilters(url: URL): Filters {
  const preset = (url.searchParams.get("periodo") ?? "este-mes") as PeriodPreset;
  const n = Number(url.searchParams.get("n") ?? "1");
  const blank = (value: string | null) => (value && value.trim() ? value : null);
  return {
    preset: ["este-mes", "mes-anterior", "este-trimestre", "este-ano", "custom"].includes(preset) ? preset : "este-mes",
    customFrom: blank(url.searchParams.get("desde")),
    customTo: blank(url.searchParams.get("hasta")),
    compareN: url.searchParams.get("comparar") === "1",
    n: Number.isFinite(n) ? Math.min(12, Math.max(1, Math.round(n))) : 1,
    compareYear: url.searchParams.get("anio") === "1",
    projectIds: (() => {
      const ids = url.searchParams.getAll("proyecto").filter((id) => id !== "");
      if (ids.length === 0) return null;
      if (ids.includes("ninguno")) return [];
      return ids;
    })(),
    asesorId: blank(url.searchParams.get("asesor")),
    torreId: blank(url.searchParams.get("torre")),
    fuenteId: blank(url.searchParams.get("fuente")),
    modeloId: blank(url.searchParams.get("modelo")),
    habitacionesId: blank(url.searchParams.get("habitaciones")),
    estadoUnidad: blank(url.searchParams.get("estadoUnidad")),
    buscar: blank(url.searchParams.get("buscar")),
    motivoId: blank(url.searchParams.get("motivo")),
    descuentoId: blank(url.searchParams.get("descuento")),
    promocionId: blank(url.searchParams.get("promocion")),
    casoId: blank(url.searchParams.get("caso")),
  };
}
