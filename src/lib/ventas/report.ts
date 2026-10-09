import { createAdminClient } from "@/lib/supabase/admin";
import {
  monthsTouched,
  monthName,
  previousWindows,
  resolveRange,
  type DateWindow,
  type PeriodPreset,
  windowLabel,
  yearAgoWindow,
} from "./period";

const GAP = "No hay datos en PipeDrive";
const NO_ROWS = "Este corte todavía no tiene filas.";
const NO_LOSSES = "No hay desistimientos en este corte.";
const VISIT_CAPTION =
  "Una visita de este período que se vuelve venta en un período siguiente no entra en el numerador.";

const POSITIONS: { code: string; label: string }[] = [
  { code: "desistida", label: "Desistida" },
  { code: "closed_without_sale", label: "Cerrada sin venta" },
  { code: "sale", label: "Ventas" },
  { code: "signed_receipt_pending", label: "Firma recibida, Recibo pendiente" },
  { code: "pcv_and_receipt_unsigned", label: "PCV y Recibo, sin firma" },
  { code: "receipt_without_pcv", label: "Recibo, sin PCV" },
  { code: "pcv_without_receipt", label: "PCV, sin Recibo" },
  { code: "comprobante_only", label: "Solo Comprobante" },
  { code: "sale_date_unknown", label: "Sin fecha de venta" },
  { code: "receipt_date_unknown", label: "Recibo sin fecha" },
];

export type Choice = { id: string; label: string; count: number };
export type Measure = { units: number; gtq: number | null; sinMonto: number };
export type NamedMeasure = Measure & { label: string };
export type VentasReport = {
  section: string;
  periodLabel: string;
  rangeLabel: string;
  gapNotice: string | null;
  emptyNotice: string | null;
  caption: string | null;
  tiles: NamedMeasure[];
  net: Measure | null;
  rows: NamedMeasure[];
  groups: { currency: string; rows: NamedMeasure[] }[];
  comparisons: { label: string; tiles: NamedMeasure[] }[];
  choices: Record<string, Choice[]>;
  list: { unit: string; tower: string; status: string; amount: number | null; currency: string | null; confirmado: number; reportado: number }[];
};

type Filters = {
  section: string;
  preset: PeriodPreset;
  customFrom: string | null;
  customTo: string | null;
  compareN: boolean;
  n: number;
  compareYear: boolean;
  projectId: string | null;
  asesorId: string | null;
  torreId: string | null;
  modeloId: string | null;
  habitacionesId: string | null;
  promocionId: string | null;
  fuenteId: string | null;
  motivoId: string | null;
  tipoDescuentoId: string | null;
  estado: string | null;
  estadoUnidad: string | null;
  buscar: string | null;
  gapFilter: boolean;
};

type Sale = {
  deal_id: string;
  unit_id: string;
  project_id: string;
  tower_id: string;
  model_id: string;
  habitaciones_id: string;
  asesor_id: string;
  fuente_id: string;
  promotion_type_id: string;
  lost_reason_id: string;
  sale_on: string | null;
  value_gtq: number | null;
  confirmado_gtq: number | null;
  lost_on: string | null;
};

type Dim = { id: string; name: string };

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inRange(day: string | null, range: DateWindow): boolean {
  return Boolean(day && day >= range.from && day <= range.to);
}

function sumGtq(values: Array<number | null>): { gtq: number | null; sinMonto: number } {
  let gtq = 0;
  let seen = false;
  let sinMonto = 0;
  for (const value of values) {
    if (value === null || value === 0) sinMonto += 1;
    if (value === null) continue;
    gtq += value;
    seen = true;
  }
  return { gtq: seen ? gtq : null, sinMonto };
}

function measure(units: number, values: Array<number | null>): Measure {
  const money = sumGtq(values);
  return { units, gtq: money.gtq, sinMonto: money.sinMonto };
}

async function fetchAll(
  db: ReturnType<ReturnType<typeof createAdminClient>["schema"]>,
  table: string,
  select: string,
) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 200000; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

function countBy(ids: string[], labels: Map<string, string>): Choice[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: labels.get(id) ?? "Sin dato", count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

export async function buildReport(filters: Filters): Promise<VentasReport> {
  const db = createAdminClient().schema("ventas");
  const range = resolveRange(filters.preset, filters.customFrom, filters.customTo);
  const windows = [range];
  if (filters.compareN) windows.push(...previousWindows(range, Math.min(12, Math.max(1, filters.n))));
  if (filters.compareYear) windows.push(yearAgoWindow(range));
  const span = {
    from: windows.reduce((min, item) => (item.from < min ? item.from : min), range.from),
    to: windows.reduce((max, item) => (item.to > max ? item.to : max), range.to),
  };

  const [projects, towers, models, habitaciones, asesores, fuentes, promotions, reasons, discountTypes, salesRaw, comprobantes, pcvs, visits, discounts, rises, targets, caseCount, recibos] =
    await Promise.all([
      fetchAll(db, "dim_project", "id,name"),
      fetchAll(db, "dim_tower", "id,name,project_id"),
      fetchAll(db, "dim_model", "id,name"),
      fetchAll(db, "dim_habitaciones", "id,name"),
      fetchAll(db, "dim_asesor", "id,name"),
      fetchAll(db, "dim_fuente", "id,name"),
      fetchAll(db, "dim_promotion_type", "id,name"),
      fetchAll(db, "dim_lost_reason", "id,name"),
      fetchAll(db, "dim_discount_type", "id,name"),
      fetchAll(db, "v_sale", "deal_id,unit_id,project_id,tower_id,model_id,habitaciones_id,asesor_id,fuente_id,promotion_type_id,lost_reason_id,sale_on,value_gtq,confirmado_gtq,lost_on"),
      fetchAll(db, "fact_comprobante", "id,deal_id,comprobante_on"),
      fetchAll(db, "fact_pcv_issuance", "deal_id,clock_on"),
      fetchAll(db, "fact_visit", "fuente_id,visit_on,deal_id"),
      fetchAll(db, "fact_discount", "deal_id,discount_type_id,amount_gtq,rate"),
      fetchAll(db, "fact_price_rise", "unit_id,tower_id,effective_on,previous_amount,new_amount,difference_amount,currency"),
      fetchAll(db, "fact_target", "asesor_id,project_id,month_start,target_units,target_gtq"),
      fetchAll(db, "fact_case_mark", "id"),
      fetchAll(db, "fact_recibo", "published_on,amount_gtq,project_id,move_state,payment_type,anulado,matched_deal_id"),
    ]);

  const nameOf = (rows: Record<string, unknown>[]) => new Map(rows.map((row) => [String(row.id), String(row.name)]));
  const projectName = nameOf(projects);
  const towerName = nameOf(towers);
  const modelName = nameOf(models);
  const habName = nameOf(habitaciones);
  const asesorName = nameOf(asesores);
  const fuenteName = nameOf(fuentes);
  const promoName = nameOf(promotions);
  const reasonName = nameOf(reasons);
  const discountName = nameOf(discountTypes);

  const sales: Sale[] = salesRaw.map((row) => ({
    deal_id: String(row.deal_id),
    unit_id: String(row.unit_id),
    project_id: String(row.project_id),
    tower_id: String(row.tower_id),
    model_id: String(row.model_id),
    habitaciones_id: String(row.habitaciones_id),
    asesor_id: String(row.asesor_id),
    fuente_id: String(row.fuente_id),
    promotion_type_id: String(row.promotion_type_id),
    lost_reason_id: String(row.lost_reason_id),
    sale_on: (row.sale_on as string | null) ?? null,
    value_gtq: num(row.value_gtq as number | string | null),
    confirmado_gtq: num(row.confirmado_gtq as number | string | null),
    lost_on: (row.lost_on as string | null) ?? null,
  }));
  const saleByDeal = new Map(sales.map((sale) => [sale.deal_id, sale]));
  const discountByDeal = new Map<string, { typeId: string; amount: number | null }[]>();
  for (const row of discounts) {
    const dealId = String(row.deal_id);
    const list = discountByDeal.get(dealId) ?? [];
    list.push({ typeId: String(row.discount_type_id), amount: num(row.amount_gtq as number | string | null) });
    discountByDeal.set(dealId, list);
  }

  const projectOk = (projectId: string) => !filters.projectId || projectId === filters.projectId;
  let gapNotice: string | null = filters.gapFilter ? GAP : null;

  function salePasses(sale: Sale, specific: boolean): boolean {
    if (!projectOk(sale.project_id)) return false;
    if (specific && filters.asesorId && sale.asesor_id !== filters.asesorId) return false;
    if (specific && filters.torreId && sale.tower_id !== filters.torreId) return false;
    if (specific && filters.modeloId && sale.model_id !== filters.modeloId) return false;
    if (specific && filters.habitacionesId && sale.habitaciones_id !== filters.habitacionesId) return false;
    if (specific && filters.promocionId && sale.promotion_type_id !== filters.promocionId) return false;
    if (specific && filters.fuenteId && sale.fuente_id !== filters.fuenteId) return false;
    if (specific && filters.motivoId && sale.lost_reason_id !== filters.motivoId) return false;
    if (specific && filters.tipoDescuentoId) {
      const types = discountByDeal.get(sale.deal_id) ?? [];
      if (!types.some((item) => item.typeId === filters.tipoDescuentoId)) return false;
    }
    return true;
  }

  function salesIn(window: DateWindow, specific: boolean): Sale[] {
    return sales.filter((sale) => inRange(sale.sale_on, window) && salePasses(sale, specific));
  }

  function lossesIn(window: DateWindow, specific: boolean): Sale[] {
    return sales.filter((sale) => inRange(sale.lost_on, window) && salePasses(sale, specific));
  }

  const selectedSales = salesIn(range, true);
  const gross = measure(selectedSales.length, selectedSales.map((sale) => sale.value_gtq));
  const selectedLosses = lossesIn(range, true);
  const lossMoney = measure(selectedLosses.length, selectedLosses.map((sale) => sale.value_gtq));
  const net: Measure = {
    units: gross.units - lossMoney.units,
    gtq: (gross.gtq ?? 0) - (lossMoney.gtq ?? 0),
    sinMonto: gross.sinMonto,
  };

  const dealIds = new Set<string>();
  for (const row of comprobantes) if (row.deal_id) dealIds.add(String(row.deal_id));
  for (const row of pcvs) dealIds.add(String(row.deal_id));
  const missing = [...dealIds].filter((id) => !saleByDeal.has(id));
  const extraDeals: Record<string, unknown>[] = [];
  for (let index = 0; index < missing.length; index += 200) {
    const chunk = missing.slice(index, index + 200);
    const { data, error } = await db
      .from("dim_deal")
      .select("id,project_id,asesor_id,fuente_id,promotion_type_id,value_gtq")
      .in("id", chunk);
    if (error) throw new Error(error.message);
    extraDeals.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  }
  const dealMeta = new Map<string, { project_id: string; asesor_id: string; fuente_id: string; promotion_type_id: string; value_gtq: number | null }>();
  for (const sale of sales) {
    dealMeta.set(sale.deal_id, {
      project_id: sale.project_id,
      asesor_id: sale.asesor_id,
      fuente_id: sale.fuente_id,
      promotion_type_id: sale.promotion_type_id,
      value_gtq: sale.value_gtq,
    });
  }
  for (const row of extraDeals) {
    dealMeta.set(String(row.id), {
      project_id: String(row.project_id),
      asesor_id: String(row.asesor_id),
      fuente_id: String(row.fuente_id),
      promotion_type_id: String(row.promotion_type_id),
      value_gtq: num(row.value_gtq as number | string | null),
    });
  }

  function flowTiles(window: DateWindow): NamedMeasure[] {
    const periodSales = salesIn(window, true);
    const venta = measure(periodSales.length, periodSales.map((sale) => sale.value_gtq));
    const comps = comprobantes.filter((row) => {
      if (!inRange(String(row.comprobante_on), window)) return false;
      if (!row.deal_id) return !filters.projectId;
      const meta = dealMeta.get(String(row.deal_id));
      return Boolean(meta && projectOk(meta.project_id));
    });
    const compValues = comps.map((row) => (row.deal_id ? dealMeta.get(String(row.deal_id))?.value_gtq ?? null : null));
    const pcvRows = pcvs.filter((row) => {
      if (!inRange(String(row.clock_on), window)) return false;
      const meta = dealMeta.get(String(row.deal_id));
      return Boolean(meta && projectOk(meta.project_id));
    });
    const pcvValues = pcvRows.map((row) => dealMeta.get(String(row.deal_id))?.value_gtq ?? null);
    const reciboRows = recibos.filter((row) => {
      if (String(row.payment_type) !== "inbound" || String(row.move_state) !== "posted" || row.anulado === true) return false;
      if (!inRange((row.published_on as string | null) ?? null, window)) return false;
      return !row.project_id || projectOk(String(row.project_id));
    });
    return [
      { label: "Ventas", ...venta },
      { label: "Comprobante", ...measure(comps.length, compValues) },
      { label: "Recibo", ...measure(reciboRows.length, reciboRows.map((row) => num(row.amount_gtq as number | string | null))) },
      { label: "PCV", ...measure(pcvRows.length, pcvValues) },
    ];
  }

  const choices: Record<string, Choice[]> = {};
  const baseSales = salesIn(range, false);
  choices.asesor = countBy(baseSales.map((sale) => sale.asesor_id), asesorName);
  choices.torre = countBy(baseSales.map((sale) => sale.tower_id), towerName);
  choices.modelo = countBy(baseSales.map((sale) => sale.model_id), modelName);
  choices.habitaciones = countBy(baseSales.map((sale) => sale.habitaciones_id), habName);
  choices.promocion = countBy(baseSales.map((sale) => sale.promotion_type_id), promoName);
  choices.fuente = countBy(baseSales.map((sale) => sale.fuente_id), fuenteName);
  choices.motivo = countBy(lossesIn(range, false).map((sale) => sale.lost_reason_id), reasonName);
  choices.tipoDescuento = countBy(
    discounts.map((row) => String(row.discount_type_id)),
    discountName,
  );
  choices.proyecto = countBy(sales.filter((sale) => inRange(sale.sale_on, range)).map((sale) => sale.project_id), projectName);

  const tiles = flowTiles(range);
  const comparisons = windows.slice(1).map((window) => ({ label: window.label, tiles: flowTiles(window) }));
  const rows: NamedMeasure[] = [];
  let emptyNotice: string | null = null;
  let caption: string | null = null;
  const groups: VentasReport["groups"] = [];

  if (filters.section === "ff-y-casos-especiales") {
    emptyNotice = caseCount.length === 0 ? GAP : null;
  }

  if (filters.section === "desistimientos") {
    if (selectedLosses.length === 0) emptyNotice = NO_LOSSES;
    else {
      const grouped = new Map<string, Sale[]>();
      for (const sale of selectedLosses) {
        const list = grouped.get(sale.lost_reason_id) ?? [];
        list.push(sale);
        grouped.set(sale.lost_reason_id, list);
      }
      for (const [id, list] of grouped) {
        rows.push({ label: reasonName.get(id) ?? "Sin dato", ...measure(list.length, list.map((sale) => sale.value_gtq)) });
      }
    }
  }

  if (filters.section === "ventas-por-canales" || filters.section === "promociones") {
    const key = filters.section === "promociones" ? "promotion_type_id" : "fuente_id";
    const labels = filters.section === "promociones" ? promoName : fuenteName;
    const grouped = new Map<string, Sale[]>();
    for (const sale of selectedSales) {
      const id = sale[key];
      const list = grouped.get(id) ?? [];
      list.push(sale);
      grouped.set(id, list);
    }
    for (const [id, list] of grouped) {
      rows.push({ label: labels.get(id) ?? "Sin dato", ...measure(list.length, list.map((sale) => sale.value_gtq)) });
    }
    if (rows.length === 0) emptyNotice = "No hay ventas en este corte.";
  }

  if (filters.section === "descuentos") {
    if (discounts.length === 0) emptyNotice = GAP;
    else {
      const inPeriod = discounts.filter((row) => {
        const sale = saleByDeal.get(String(row.deal_id));
        return Boolean(sale && inRange(sale.sale_on, range) && salePasses(sale, true));
      });
      if (inPeriod.length === 0) emptyNotice = "No hay descuentos en este corte.";
      else {
        const grouped = new Map<string, typeof inPeriod>();
        for (const row of inPeriod) {
          const id = String(row.discount_type_id);
          const list = grouped.get(id) ?? [];
          list.push(row);
          grouped.set(id, list);
        }
        for (const [id, list] of grouped) {
          rows.push({
            label: discountName.get(id) ?? "Sin dato",
            ...measure(list.length, list.map((row) => num(row.amount_gtq as number | string | null))),
          });
        }
      }
    }
  }

  if (filters.section === "subidas-de-precios") {
    const inPeriod = rises.filter((row) => inRange(String(row.effective_on), range) && (!filters.torreId || String(row.tower_id) === filters.torreId) && (!filters.projectId || towers.find((tower) => String(tower.id) === String(row.tower_id) && String(tower.project_id) === filters.projectId)));
    if (rises.length === 0) emptyNotice = GAP;
    else if (inPeriod.length === 0) emptyNotice = "No hay subidas en este corte.";
    else {
      rows.push({
        label: "Subidas",
        ...measure(inPeriod.length, inPeriod.map((row) => num(row.difference_amount as number | string | null))),
      });
    }
  }

  if (filters.section === "objetivos-de-ventas") {
    caption = "El real corre hasta el fin del período. La meta de un mes abierto es la meta del mes completo.";
    const months = monthsTouched(range.from, range.to);
    const targetRows = targets.filter((row) => projectOk(String(row.project_id)) && months.includes(String(row.month_start)) && (!filters.asesorId || String(row.asesor_id) === filters.asesorId));
    if (targetRows.length === 0) {
      emptyNotice = GAP;
    } else {
      caption = `${caption} Meses: ${months.map(monthName).join(", ")}. No hay meta en quetzales.`;
      const byAsesor = new Map<string, { actual: Sale[]; target: number }>();
      for (const row of targetRows) {
        const id = String(row.asesor_id);
        const bucket = byAsesor.get(id) ?? { actual: [], target: 0 };
        bucket.target += Number(row.target_units ?? 0);
        byAsesor.set(id, bucket);
      }
      for (const sale of selectedSales) {
        const bucket = byAsesor.get(sale.asesor_id) ?? { actual: [], target: 0 };
        bucket.actual.push(sale);
        byAsesor.set(sale.asesor_id, bucket);
      }
      for (const [id, bucket] of byAsesor) {
        const actual = measure(bucket.actual.length, bucket.actual.map((sale) => sale.value_gtq));
        rows.push({ label: asesorName.get(id) ?? "Sin dato", units: actual.units, gtq: bucket.target, sinMonto: actual.sinMonto });
      }
    }
  }

  let list: VentasReport["list"] = [];
  if (
    filters.section === "analisis-de-inventario" ||
    filters.section === "inventario-general" ||
    filters.section === "valor-del-proyecto"
  ) {
    const { data, error } = await db.rpc("stock_at", { p_as_of: range.to });
    if (error) throw new Error(error.message);
    const stock = ((data ?? []) as unknown as Record<string, unknown>[]).filter((row) => projectOk(String(row.project_id)));
    if (stock.length === 0) emptyNotice = NO_ROWS;
    else if (filters.section === "valor-del-proyecto") {
      const buckets = new Map<string, Map<string, { units: number; amount: number }>>();
      for (const row of stock) {
        const currency = String(row.list_price_currency ?? "GTQ");
        const status = String(row.page_status ?? row.status_name ?? "Sin dato");
        const byStatus = buckets.get(currency) ?? new Map();
        const current = byStatus.get(status) ?? { units: 0, amount: 0 };
        current.units += 1;
        current.amount += num(row.list_price_amount as number | string | null) ?? 0;
        byStatus.set(status, current);
        buckets.set(currency, byStatus);
      }
      for (const [currency, byStatus] of buckets) {
        groups.push({
          currency,
          rows: [...byStatus.entries()].map(([label, value]) => ({
            label,
            units: value.units,
            gtq: value.amount,
            sinMonto: 0,
          })),
        });
      }
    } else {
      const unitRows = await fetchAll(db, "dim_unit", "id,canonical_unit");
      const unitName = new Map(unitRows.map((row) => [String(row.id), String(row.canonical_unit)]));
      const filtered = stock.filter((row) => {
        if (filters.torreId && String(row.tower_id) !== filters.torreId) return false;
        if (filters.modeloId && String(row.model_id) !== filters.modeloId) return false;
        if (filters.habitacionesId && String(row.habitaciones_id) !== filters.habitacionesId) return false;
        if (filters.estadoUnidad && String(row.page_status) !== filters.estadoUnidad) return false;
        if (filters.buscar) {
          const name = unitName.get(String(row.unit_id)) ?? "";
          if (!name.toLowerCase().includes(filters.buscar.toLowerCase())) return false;
        }
        return true;
      });
      if (filters.section === "analisis-de-inventario") {
        const grouped = new Map<string, typeof filtered>();
        for (const row of filtered) {
          const label = `${towerName.get(String(row.tower_id)) ?? "Sin dato"} · ${modelName.get(String(row.model_id)) ?? "Sin dato"} · ${row.page_status}`;
          const list = grouped.get(label) ?? [];
          list.push(row);
          grouped.set(label, list);
        }
        for (const [label, list] of grouped) {
          rows.push({
            label,
            units: list.length,
            gtq: list.reduce((sum, row) => sum + (num(row.list_price_amount as number | string | null) ?? 0), 0),
            sinMonto: 0,
          });
        }
      } else {
        list = filtered.slice(0, 400).map((row) => ({
          unit: unitName.get(String(row.unit_id)) ?? String(row.unit_id),
          tower: towerName.get(String(row.tower_id)) ?? "Sin dato",
          status: String(row.page_status ?? ""),
          amount: num(row.list_price_amount as number | string | null),
          currency: (row.list_price_currency as string | null) ?? null,
          confirmado: 0,
          reportado: 0,
        }));
      }
    }
  }

  if (filters.section === "tasa-de-conversion") {
    caption = VISIT_CAPTION;
    const visitRows = visits.filter((row) => inRange(String(row.visit_on), range) && (!filters.fuenteId || String(row.fuente_id) === filters.fuenteId));
    const { count } = await db
      .from("dim_deal")
      .select("id", { count: "exact", head: true })
      .gte("add_on", range.from)
      .lte("add_on", range.to);
    const leads = count ?? 0;
    const ventas = selectedSales.length;
    rows.push({ label: "Visitas efectivas", units: visitRows.length, gtq: null, sinMonto: 0 });
    rows.push({ label: "Leads", units: leads, gtq: null, sinMonto: 0 });
    rows.push({
      label: "Tasa sobre visitas",
      units: visitRows.length ? Math.round((ventas / visitRows.length) * 1000) / 10 : 0,
      gtq: null,
      sinMonto: 0,
    });
    rows.push({
      label: "Tasa sobre leads",
      units: leads ? Math.round((ventas / leads) * 1000) / 10 : 0,
      gtq: null,
      sinMonto: 0,
    });
  }

  if (filters.section === "status-de-ventas") {
    const asOf = range.to;
    const openSales = sales.filter(
      (sale) => sale.sale_on && sale.sale_on <= asOf && (!sale.lost_on || sale.lost_on > asOf) && salePasses(sale, true),
    );
    const desistidas = sales.filter((sale) => sale.lost_on && sale.lost_on <= asOf && salePasses(sale, true));
    let lostQuery = db.from("dim_deal").select("id", { count: "exact", head: true }).not("lost_on", "is", null).lte("lost_on", asOf);
    if (filters.projectId) lostQuery = lostQuery.eq("project_id", filters.projectId);
    const lost = await lostQuery;
    const closed = Math.max(0, (lost.count ?? 0) - desistidas.length);
    const lines: NamedMeasure[] = [
      { label: "Desistida", ...measure(desistidas.length, desistidas.map((sale) => sale.value_gtq)) },
      { label: "Cerrada sin venta", units: closed, gtq: null, sinMonto: 0 },
      { label: "Ventas", ...measure(openSales.length, openSales.map((sale) => sale.value_gtq)) },
    ];
    for (const line of lines) {
      if (!filters.estado || line.label === filters.estado) rows.push(line);
    }
    caption = "Cerrada sin venta cuenta los tratos perdidos que no llegaron a las dos puertas. Su monto no está sumado.";
  }

  return {
    section: filters.section,
    periodLabel: range.label,
    rangeLabel: windowLabel(range),
    gapNotice,
    emptyNotice,
    caption,
    net: filters.section === "ventas-totales" ? net : null,
    rows,
    groups,
    comparisons: ["analisis-de-inventario", "inventario-general", "valor-del-proyecto", "subidas-de-precios", "descuentos", "ff-y-casos-especiales", "status-de-ventas"].includes(filters.section) ? [] : comparisons,
    tiles: ["analisis-de-inventario", "inventario-general", "valor-del-proyecto", "subidas-de-precios", "descuentos", "ff-y-casos-especiales", "desistimientos"].includes(filters.section) ? [] : tiles,
    choices,
    list,
  };
}

export function parseFilters(url: URL): Filters {
  const preset = (url.searchParams.get("periodo") ?? "este-mes") as PeriodPreset;
  const n = Number(url.searchParams.get("n") ?? "1");
  return {
    section: url.searchParams.get("section") ?? "ventas-totales",
    preset: ["este-mes", "mes-anterior", "este-trimestre", "este-ano", "custom"].includes(preset) ? preset : "este-mes",
    customFrom: url.searchParams.get("desde"),
    customTo: url.searchParams.get("hasta"),
    compareN: url.searchParams.get("comparar") === "1",
    n: Number.isFinite(n) ? Math.min(12, Math.max(1, n)) : 1,
    compareYear: url.searchParams.get("anio") === "1",
    projectId: url.searchParams.get("proyecto"),
    asesorId: url.searchParams.get("asesor"),
    torreId: url.searchParams.get("torre"),
    modeloId: url.searchParams.get("modelo"),
    habitacionesId: url.searchParams.get("habitaciones"),
    promocionId: url.searchParams.get("promocion"),
    fuenteId: url.searchParams.get("fuente"),
    motivoId: url.searchParams.get("motivo"),
    tipoDescuentoId: url.searchParams.get("descuento"),
    estado: url.searchParams.get("estado"),
    estadoUnidad: url.searchParams.get("estadoUnidad"),
    buscar: url.searchParams.get("buscar"),
    gapFilter: url.searchParams.get("caso") === "1" || url.searchParams.get("ff") === "1",
  };
}
