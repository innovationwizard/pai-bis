import { createAdminClient } from "@/lib/supabase/admin";
import { addDays } from "./pace";
import { inclusiveDays, type DateWindow } from "./period";
import type { BlockerRow, Freshness, FunnelStage, StageDeal } from "./vista-types";

const PAGE = 1000;
const CAP = 8000;
const CHUNK = 80;
const DEAL_CAP = 200;
const BLOCK_CAP = 400;

export type BridgeSale = {
  dealId: string;
  unitId: string;
  projectId: string;
  asesorId: string;
  valueGtq: number | null;
  saleOn: string;
};

export type TotalesBridge = {
  freshness: Freshness;
  funnel: FunnelStage[];
  blockers: BlockerRow[];
  blockerTotal: number;
  notice: string | null;
};

type Scope = {
  projectIds: string[] | null;
  asesorId: string | null;
  torreId: string | null;
};

type DealInfo = {
  id: string;
  pipedriveId: string;
  projectId: string;
  asesorId: string;
  unitId: string | null;
  valueGtq: number | null;
  lostOn: string | null;
};

type UnitInfo = {
  id: string;
  projectId: string;
  towerId: string;
  modelId: string;
  canonical: string;
  token2: string | null;
};

type Activity = { id: string; dealId: string | null; day: string };
type Reception = { dealId: string; day: string; at: string };

type ReceiptRow = {
  id: string;
  dealId: string | null;
  unitId: string | null;
  projectId: string | null;
  towerId: string | null;
  modelId: string | null;
  canonical: string | null;
  fecha: string | null;
  publishedOn: string | null;
  posted: boolean;
  draft: boolean;
  unresolved: boolean;
};

type Names = {
  project: (id: string) => string;
  asesor: (id: string) => string;
};

type PageResult = { data: unknown; error: { message: string } | null };

export type StuckFacts = {
  hasDeal: boolean;
  hasUnit: boolean;
  reservaDay: string | null;
  receptionDay: string | null;
  receiptDay: string | null;
  undated: boolean;
  draft: boolean;
  mismatch: { fecha: string; reservaDay: string; oneDay: boolean } | null;
  unresolved: boolean;
  periodFrom: string;
  periodTo: string;
};

export type StuckGap = {
  stage: string;
  missing: string;
  severity: "alta" | "media";
  lastDay: string | null;
};

function db() {
  return createAdminClient().schema("ventas");
}

type Db = ReturnType<typeof db>;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value == null || value === "") return null;
  return String(value);
}

function dayOf(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function rowsOf(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function dotted(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

function laterDay(a: string, b: string): string {
  return a > b ? a : b;
}

function latestDay(days: Array<string | null>): string | null {
  const real = days.filter((day): day is string => Boolean(day));
  real.sort();
  return real.at(-1) ?? null;
}

function inSpan(day: string | null, window: DateWindow | null): boolean {
  return Boolean(window && day && day >= window.from && day <= window.to);
}

function daysSince(day: string | null, today: string): number | null {
  if (!day || day > today) return null;
  return inclusiveDays(day, today) - 1;
}

function guatemalaDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala" }).format(date);
}

function laterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  if (Number.isNaN(left) || Number.isNaN(right)) return a > b ? a : b;
  return left >= right ? a : b;
}

function stampText(iso: string): string {
  const hasTime = iso.includes("T");
  const date = hasTime ? new Date(iso) : new Date(`${iso.slice(0, 10)}T12:00:00-06:00`);
  if (Number.isNaN(date.getTime())) return dotted(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Guatemala",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(hasTime ? { hour: "2-digit" as const, minute: "2-digit" as const, hourCycle: "h23" as const } : {}),
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const day = `${pick("day")}.${pick("month")}.${pick("year")}`;
  return hasTime ? `${day} ${pick("hour")}:${pick("minute")}` : day;
}

function sumGtq(values: Array<number | null>): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    if (value == null) continue;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

function conversion(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return current / previous;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function explainStuck(facts: StuckFacts): StuckGap | null {
  const last = latestDay([facts.reservaDay, facts.receptionDay, facts.receiptDay, facts.mismatch?.fecha ?? null]);
  if (!facts.hasDeal) {
    return { stage: "Reserva", missing: "La reserva no tiene trato.", severity: "alta", lastDay: facts.reservaDay };
  }
  if (facts.draft && !facts.receiptDay) {
    return { stage: "Recibo en borrador", missing: "El recibo en Odoo sigue en borrador.", severity: "alta", lastDay: last };
  }
  if (facts.mismatch && !facts.receiptDay) {
    const fecha = dotted(facts.mismatch.fecha);
    const reserva = dotted(facts.mismatch.reservaDay);
    const missing = facts.mismatch.oneDay
      ? `La fecha contable del recibo (${fecha}) es un día antes de la reserva (${reserva}). El cruce exige el mismo día.`
      : `La fecha contable del recibo (${fecha}) no coincide con la reserva del ${reserva}. El cruce exige el mismo día.`;
    return { stage: "Fecha contable distinta", missing, severity: "alta", lastDay: last };
  }
  if (facts.unresolved && !facts.receiptDay) {
    return {
      stage: "Recibo sin cruce",
      missing: "Hay más de un trato para la unidad en el día del recibo. No quedó cruzado.",
      severity: "alta",
      lastDay: last,
    };
  }
  if (facts.undated && !facts.receiptDay) {
    return {
      stage: "Recibo publicado",
      missing: "El recibo está publicado y no tiene fecha de publicación.",
      severity: "alta",
      lastDay: last,
    };
  }
  if (!facts.hasUnit && !facts.receiptDay) {
    return {
      stage: "Reserva",
      missing: "La reserva no nombra unidad. El recibo no se puede cruzar.",
      severity: "alta",
      lastDay: last,
    };
  }

  const saleDay = facts.receiptDay && facts.receptionDay ? laterDay(facts.receiptDay, facts.receptionDay) : null;
  if (saleDay && saleDay < facts.periodFrom) return null;
  if (facts.receiptDay && facts.receptionDay && saleDay) {
    if (saleDay >= facts.periodFrom && saleDay <= facts.periodTo) {
      return {
        stage: "Puertas completas",
        missing: "Las dos puertas caen en el periodo y esta venta no está en el neto.",
        severity: "alta",
        lastDay: saleDay,
      };
    }
    if (facts.receptionDay > facts.periodTo && facts.receiptDay <= facts.periodTo) {
      return {
        stage: "Fuera del periodo",
        missing: `La promesa se recibió el ${dotted(facts.receptionDay)}, fuera del periodo.`,
        severity: "media",
        lastDay: facts.receptionDay,
      };
    }
    if (facts.receiptDay > facts.periodTo && facts.receptionDay <= facts.periodTo) {
      return {
        stage: "Fuera del periodo",
        missing: `El recibo se publicó el ${dotted(facts.receiptDay)}, fuera del periodo.`,
        severity: "media",
        lastDay: facts.receiptDay,
      };
    }
    return {
      stage: "Fuera del periodo",
      missing: `Las dos puertas cierran el ${dotted(saleDay)}, fuera del periodo.`,
      severity: "media",
      lastDay: saleDay,
    };
  }
  if (facts.receiptDay && !facts.receptionDay) {
    const outside = facts.receiptDay > facts.periodTo ? ` El recibo se publicó el ${dotted(facts.receiptDay)}, fuera del periodo.` : "";
    return {
      stage: "Recibo publicado",
      missing: `Falta la actividad con asunto exacto «Recepción de Promesa Firmada».${outside}`,
      severity: "alta",
      lastDay: last,
    };
  }
  if (facts.receptionDay && !facts.receiptDay) {
    const outside = facts.receptionDay > facts.periodTo ? ` La promesa se recibió el ${dotted(facts.receptionDay)}, fuera del periodo.` : "";
    return {
      stage: "Promesa firmada",
      missing: `Falta el recibo publicado en Odoo.${outside}`,
      severity: "alta",
      lastDay: last,
    };
  }
  return {
    stage: "Reserva",
    missing: "Falta la actividad con asunto exacto «Recepción de Promesa Firmada» y el recibo publicado en Odoo.",
    severity: "alta",
    lastDay: last,
  };
}

async function pages(run: (from: number, to: number) => PromiseLike<PageResult>): Promise<{ rows: Record<string, unknown>[]; capped: boolean }> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < CAP; offset += PAGE) {
    const { data, error } = await run(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = rowsOf(data);
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, capped: false };
  }
  return { rows, capped: true };
}

async function pagedIn(
  ids: string[],
  run: (slice: string[], from: number, to: number) => PromiseLike<PageResult>,
): Promise<{ rows: Record<string, unknown>[]; capped: boolean }> {
  if (ids.length === 0) return { rows: [], capped: false };
  const rows: Record<string, unknown>[] = [];
  let capped = false;
  for (let index = 0; index < ids.length; index += CHUNK) {
    const slice = ids.slice(index, index + CHUNK);
    const batch = await pages((from, to) => run(slice, from, to));
    rows.push(...batch.rows);
    if (batch.capped) capped = true;
  }
  return { rows, capped };
}

async function latestStamp(client: Db, table: string, column: string): Promise<string | null> {
  const { data, error } = await client.from(table).select(column).not(column, "is", null).order(column, { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const row = rowsOf(data)[0];
  if (!row || row[column] == null) return null;
  return String(row[column]);
}

function unitLabel(unit: UnitInfo | null): string {
  if (!unit) return "Sin unidad";
  return unit.token2 ? `${unit.canonical} / ${unit.token2}` : unit.canonical;
}

function sameUnit(unit: UnitInfo, receipt: ReceiptRow): boolean {
  if (!receipt.projectId || !receipt.canonical) return false;
  if (receipt.projectId !== unit.projectId || receipt.canonical !== unit.canonical) return false;
  if (receipt.modelId && receipt.modelId !== unit.modelId) return false;
  if (receipt.towerId && receipt.towerId !== unit.towerId) return false;
  return true;
}

function mapReceipt(row: Record<string, unknown>): ReceiptRow | null {
  const id = str(row, "odoo_payment_id");
  if (!id) return null;
  if (row.anulado === true) return null;
  const payment = str(row, "payment_type");
  if (payment && payment !== "inbound") return null;
  const state = (str(row, "move_state") ?? "").toLowerCase().trim();
  if (state === "cancel" || state === "cancelled" || state === "cancelado") return null;
  return {
    id,
    dealId: str(row, "matched_deal_id"),
    unitId: str(row, "matched_unit_id"),
    projectId: str(row, "project_id"),
    towerId: str(row, "tower_id"),
    modelId: str(row, "model_id"),
    canonical: str(row, "canonical_unit"),
    fecha: dayOf(str(row, "fecha")),
    publishedOn: dayOf(str(row, "published_on")),
    posted: state === "posted",
    draft: state === "draft",
    unresolved: row.match_unresolved === true,
  };
}

function emptyStage(
  id: FunnelStage["id"],
  label: string,
  source: string,
  grain: string,
): FunnelStage {
  return {
    id,
    label,
    source,
    grain,
    count: 0,
    gtq: null,
    priorCount: null,
    priorGtq: null,
    conversion: null,
    deals: [],
    dropped: [],
    entered: [],
    droppedTitle: "",
    enteredTitle: "",
    footnote: null,
    listTotal: 0,
    droppedTotal: 0,
    enteredTotal: 0,
  };
}

function pack(rows: StageDeal[]): { rows: StageDeal[]; total: number } {
  return { rows: rows.slice(0, DEAL_CAP), total: rows.length };
}

export async function loadTotalesBridge(input: {
  range: DateWindow;
  prior: DateWindow | null;
  projectIds: string[] | null;
  asesorId: string | null;
  torreId: string | null;
  projectName: (id: string) => string;
  asesorName: (id: string) => string;
  sales: BridgeSale[];
  netUnits: number;
  netGtq: number | null;
  lossCount: number;
  today: string;
}): Promise<TotalesBridge> {
  const client = db();
  const scope: Scope = { projectIds: input.projectIds, asesorId: input.asesorId, torreId: input.torreId };
  const names: Names = { project: input.projectName, asesor: input.asesorName };
  const [pipedriveReserva, pipedrivePromesa, odooWritten, odooPublished, reciboCount] = await Promise.all([
    latestStamp(client, "fact_comprobante", "marked_as_done_time"),
    latestStamp(client, "fact_reception", "marked_as_done_time"),
    latestStamp(client, "fact_recibo", "written_at"),
    latestStamp(client, "fact_recibo", "published_at"),
    client.from("fact_recibo").select("id", { count: "exact", head: true }),
  ]);
  if (reciboCount.error) throw new Error(reciboCount.error.message);
  const freshness = freshnessOf({
    pipedrive: laterIso(pipedriveReserva, pipedrivePromesa),
    odoo: laterIso(odooWritten, odooPublished),
    odooRows: reciboCount.count ?? 0,
    today: input.today,
  });

  const blank = [
    emptyStage("reservas", "Reservas", "Pipedrive", "actividades"),
    emptyStage("promesas", "Promesas firmadas", "Pipedrive", "tratos"),
    emptyStage("recibos", "Recibos publicados", "Odoo", "recibos"),
    emptyStage("netas", "Ventas netas", "Pipedrive + Odoo", "tratos"),
  ];
  if (scope.projectIds && scope.projectIds.length === 0) {
    return { freshness, funnel: blank, blockers: [], blockerTotal: 0, notice: null };
  }

  const spanFrom = input.prior && input.prior.from < input.range.from ? input.prior.from : input.range.from;
  const spanTo = input.range.to;
  const notices: string[] = [];

  const [comprobantes, receptionsInSpan, confirmadosInSpan] = await Promise.all([
    pages((from, to) =>
      client
        .from("fact_comprobante")
        .select("id,deal_id,comprobante_on")
        .gte("comprobante_on", spanFrom)
        .lte("comprobante_on", spanTo)
        .order("id")
        .range(from, to),
    ),
    pages((from, to) =>
      client
        .from("fact_reception")
        .select("deal_id,reception_on,marked_as_done_time")
        .gte("reception_on", spanFrom)
        .lte("reception_on", spanTo)
        .not("deal_id", "is", null)
        .order("pipedrive_activity_id")
        .range(from, to),
    ),
    pages((from, to) =>
      client
        .from("v_recibo_confirmado")
        .select("odoo_payment_id,matched_deal_id,matched_unit_id,published_on,fecha,move_state,payment_type,anulado,match_unresolved,project_id,tower_id,model_id,canonical_unit")
        .eq("match_unresolved", false)
        .not("matched_deal_id", "is", null)
        .gte("published_on", spanFrom)
        .lte("published_on", spanTo)
        .order("odoo_payment_id")
        .range(from, to),
    ),
  ]);
  if (comprobantes.capped || receptionsInSpan.capped || confirmadosInSpan.capped) {
    notices.push("La lectura del periodo llegó a 8.000 filas. Afina proyecto o periodo.");
  }

  const activities: Activity[] = comprobantes.rows.flatMap((row) => {
    const id = str(row, "id");
    const day = dayOf(str(row, "comprobante_on"));
    if (!id || !day) return [];
    return [{ id, dealId: str(row, "deal_id"), day }];
  });

  const discovered = new Set<string>();
  for (const activity of activities) if (activity.dealId) discovered.add(activity.dealId);
  for (const row of receptionsInSpan.rows) {
    const id = str(row, "deal_id");
    if (id) discovered.add(id);
  }
  for (const row of confirmadosInSpan.rows) {
    const id = str(row, "matched_deal_id");
    if (id) discovered.add(id);
  }
  for (const sale of input.sales) discovered.add(sale.dealId);

  const dealIds = [...discovered];
  const [dealRows, receptionRows, receiptRows] = await Promise.all([
    pagedIn(dealIds, (slice, from, to) =>
      client
        .from("dim_deal")
        .select("id,pipedrive_deal_id,project_id,asesor_id,unit_id,value_gtq,lost_on")
        .in("id", slice)
        .order("id")
        .range(from, to),
    ),
    pagedIn(dealIds, (slice, from, to) =>
      client
        .from("fact_reception")
        .select("deal_id,reception_on,marked_as_done_time")
        .in("deal_id", slice)
        .order("pipedrive_activity_id")
        .range(from, to),
    ),
    pagedIn(dealIds, (slice, from, to) =>
      client
        .from("fact_recibo")
        .select("odoo_payment_id,matched_deal_id,matched_unit_id,project_id,tower_id,model_id,canonical_unit,fecha,published_on,move_state,payment_type,anulado,match_unresolved")
        .in("matched_deal_id", slice)
        .eq("payment_type", "inbound")
        .eq("anulado", false)
        .order("odoo_payment_id")
        .range(from, to),
    ),
  ]);
  if (dealRows.capped || receptionRows.capped || receiptRows.capped) {
    notices.push("Algunos tratos del periodo no cupieron en la lectura. Afina el periodo.");
  }

  const deals = new Map<string, DealInfo>();
  for (const row of dealRows.rows) {
    const id = str(row, "id");
    if (!id) continue;
    deals.set(id, {
      id,
      pipedriveId: str(row, "pipedrive_deal_id") ?? "",
      projectId: str(row, "project_id") ?? "",
      asesorId: str(row, "asesor_id") ?? "",
      unitId: str(row, "unit_id"),
      valueGtq: num(row.value_gtq),
      lostOn: dayOf(str(row, "lost_on")),
    });
  }

  const unitIds = new Set<string>();
  for (const deal of deals.values()) if (deal.unitId) unitIds.add(deal.unitId);
  for (const sale of input.sales) if (sale.unitId) unitIds.add(sale.unitId);
  const unitRows = await pagedIn([...unitIds], (slice, from, to) =>
    client
      .from("dim_unit")
      .select("id,project_id,tower_id,model_id,canonical_unit,unit_token_2")
      .in("id", slice)
      .order("id")
      .range(from, to),
  );
  if (unitRows.capped) notices.push("Algunas unidades del periodo no cupieron en la lectura.");
  const units = new Map<string, UnitInfo>();
  for (const row of unitRows.rows) {
    const id = str(row, "id");
    const canonical = str(row, "canonical_unit");
    const projectId = str(row, "project_id");
    const towerId = str(row, "tower_id");
    const modelId = str(row, "model_id");
    if (!id || !canonical || !projectId || !towerId || !modelId) continue;
    units.set(id, { id, canonical, projectId, towerId, modelId, token2: str(row, "unit_token_2") });
  }

  const neighborhood = await unmatchedReceipts(client, units, input.range, scope.projectIds);
  if (neighborhood.capped) notices.push("La lectura de recibos sin cruce llegó al tope. Puede faltar alguno.");

  const receipts = dedupeReceipts([
    ...receiptRows.rows.flatMap((row) => {
      const mapped = mapReceipt(row);
      return mapped ? [mapped] : [];
    }),
    ...confirmadosInSpan.rows.flatMap((row) => {
      const mapped = mapReceipt(row);
      return mapped ? [mapped] : [];
    }),
    ...neighborhood.rows,
  ]);

  const latest = new Map<string, Reception>();
  for (const row of receptionRows.rows) {
    const dealId = str(row, "deal_id");
    const day = dayOf(str(row, "reception_on"));
    if (!dealId || !day) continue;
    const next: Reception = { dealId, day, at: str(row, "marked_as_done_time") ?? "" };
    const current = latest.get(dealId);
    if (!current || next.day > current.day || (next.day === current.day && next.at > current.at)) latest.set(dealId, next);
  }

  const scopedDeal = (dealId: string): DealInfo | null => {
    const deal = deals.get(dealId);
    if (!deal) return null;
    const unit = deal.unitId ? units.get(deal.unitId) ?? null : null;
    return inScope(deal, unit, scope) ? deal : null;
  };

  const reservas = activities.filter((activity) => activityInScope(activity, deals, units, scope));
  const reservasNow = reservas.filter((activity) => inSpan(activity.day, input.range));
  const reservasPrior = reservas.filter((activity) => inSpan(activity.day, input.prior));

  const promesaDeals = [...latest.values()].flatMap((row) => {
    const deal = scopedDeal(row.dealId);
    return deal ? [{ deal, day: row.day }] : [];
  });
  const promesasNow = promesaDeals.filter((row) => inSpan(row.day, input.range));
  const promesasPrior = promesaDeals.filter((row) => inSpan(row.day, input.prior));

  const firstGates = firstPublished(receipts).flatMap((gate) => {
    const deal = scopedDeal(gate.dealId);
    return deal ? [{ ...gate, deal }] : [];
  });
  const recibosNow = firstGates.filter((gate) => inSpan(gate.day, input.range));
  const recibosPrior = firstGates.filter((gate) => inSpan(gate.day, input.prior));

  const reservaDealIds = new Set(reservasNow.flatMap((activity) => (activity.dealId ? [activity.dealId] : [])));
  const promesaIds = new Set(promesasNow.map((row) => row.deal.id));
  const reciboIds = new Set(recibosNow.map((gate) => gate.dealId));
  const soldIds = new Set(input.sales.map((sale) => sale.dealId));

  const stageDeal = (deal: DealInfo, day: string | null, key: string): StageDeal => {
    const unit = deal.unitId ? units.get(deal.unitId) ?? null : null;
    return {
      key,
      unit: unitLabel(unit),
      deal: deal.pipedriveId ? `Trato ${deal.pipedriveId}` : "Sin trato",
      project: names.project(deal.projectId),
      asesor: names.asesor(deal.asesorId),
      day,
      gtq: deal.valueGtq,
    };
  };

  const reservaRows = reservasNow
    .map((activity) => {
      if (!activity.dealId) {
        return {
          key: `reserva:${activity.id}`,
          unit: "Sin unidad",
          deal: "Sin trato",
          project: "Sin proyecto",
          asesor: "Sin asesor",
          day: activity.day,
          gtq: null,
        };
      }
      const deal = deals.get(activity.dealId);
      if (!deal) return null;
      return stageDeal(deal, activity.day, `reserva:${activity.id}`);
    })
    .filter((row): row is StageDeal => Boolean(row))
    .sort(byDay);

  const distinctReservaValue = sumGtq(
    [...reservaDealIds].map((id) => deals.get(id)?.valueGtq ?? null),
  );
  const priorReservaIds = new Set(reservasPrior.flatMap((activity) => (activity.dealId ? [activity.dealId] : [])));

  const promesaRows = promesasNow.map((row) => stageDeal(row.deal, row.day, `promesa:${row.deal.id}`)).sort(byDay);
  const reciboRows = recibosNow
    .map((gate) => stageDeal(gate.deal, gate.day, `recibo:${gate.dealId}:${gate.unitId}`))
    .sort(byDay);
  const netaRows = input.sales
    .map((sale) => {
      const deal = deals.get(sale.dealId);
      const unit = units.get(sale.unitId) ?? (deal?.unitId ? units.get(deal.unitId) ?? null : null);
      return {
        key: `neta:${sale.dealId}`,
        unit: unitLabel(unit),
        deal: deal?.pipedriveId ? `Trato ${deal.pipedriveId}` : "Sin trato",
        project: names.project(sale.projectId),
        asesor: names.asesor(sale.asesorId),
        day: sale.saleOn,
        gtq: sale.valueGtq,
      };
    })
    .sort(byDay);

  const droppedFrom = (ids: Set<string>, keep: Set<string>, dayOfId: (id: string) => string | null, prefix: string) =>
    [...ids]
      .filter((id) => !keep.has(id))
      .flatMap((id) => {
        const deal = deals.get(id);
        return deal ? [stageDeal(deal, dayOfId(id), `${prefix}:${id}`)] : [];
      })
      .sort(byDay);

  const orphanDropped = reservasNow
    .filter((activity) => !activity.dealId)
    .map((activity) => ({
      key: `huerfana:${activity.id}`,
      unit: "Sin unidad",
      deal: "Sin trato",
      project: "Sin proyecto",
      asesor: "Sin asesor",
      day: activity.day,
      gtq: null,
    }));

  const reservasPacked = pack(reservaRows);
  const promesasPacked = pack(promesaRows);
  const recibosPacked = pack(reciboRows);
  const netasPacked = pack(netaRows);
  const droppedPromesas = pack([...orphanDropped, ...droppedFrom(reservaDealIds, promesaIds, (id) => reservasNow.find((activity) => activity.dealId === id)?.day ?? null, "cae-promesa")]);
  const enteredPromesas = pack(droppedFrom(promesaIds, reservaDealIds, (id) => promesasNow.find((row) => row.deal.id === id)?.day ?? null, "entra-promesa"));
  const droppedRecibos = pack(droppedFrom(promesaIds, reciboIds, (id) => promesasNow.find((row) => row.deal.id === id)?.day ?? null, "cae-recibo"));
  const enteredRecibos = pack(droppedFrom(reciboIds, promesaIds, (id) => recibosNow.find((gate) => gate.dealId === id)?.day ?? null, "entra-recibo"));
  const droppedNetas = pack(droppedFrom(reciboIds, soldIds, (id) => recibosNow.find((gate) => gate.dealId === id)?.day ?? null, "cae-neta"));
  const enteredNetas = pack(
    input.sales
      .filter((sale) => !reciboIds.has(sale.dealId))
      .map((sale) => {
        const deal = deals.get(sale.dealId);
        const unit = units.get(sale.unitId) ?? null;
        return {
          key: `entra-neta:${sale.dealId}`,
          unit: unitLabel(unit),
          deal: deal?.pipedriveId ? `Trato ${deal.pipedriveId}` : "Sin trato",
          project: names.project(sale.projectId),
          asesor: names.asesor(sale.asesorId),
          day: sale.saleOn,
          gtq: sale.valueGtq,
        };
      })
      .sort(byDay),
  );

  const funnel: FunnelStage[] = [
    {
      ...emptyStage("reservas", "Reservas", "Pipedrive", "actividades"),
      count: reservasNow.length,
      gtq: distinctReservaValue,
      priorCount: input.prior ? reservasPrior.length : null,
      priorGtq: input.prior ? sumGtq([...priorReservaIds].map((id) => deals.get(id)?.valueGtq ?? null)) : null,
      deals: reservasPacked.rows,
      listTotal: reservasPacked.total,
    },
    {
      ...emptyStage("promesas", "Promesas firmadas", "Pipedrive", "tratos"),
      count: promesasNow.length,
      gtq: sumGtq(promesasNow.map((row) => row.deal.valueGtq)),
      priorCount: input.prior ? promesasPrior.length : null,
      conversion: conversion(promesasNow.length, reservasNow.length),
      deals: promesasPacked.rows,
      dropped: droppedPromesas.rows,
      entered: enteredPromesas.rows,
      droppedTitle: "Tenían reserva en el periodo y no tienen la promesa firmada en el periodo",
      enteredTitle: "La promesa cae en el periodo y la reserva no",
      listTotal: promesasPacked.total,
      droppedTotal: droppedPromesas.total,
      enteredTotal: enteredPromesas.total,
    },
    {
      ...emptyStage("recibos", "Recibos publicados", "Odoo", "recibos"),
      count: recibosNow.length,
      priorCount: input.prior ? recibosPrior.length : null,
      conversion: conversion(recibosNow.length, promesasNow.length),
      deals: recibosPacked.rows,
      dropped: droppedRecibos.rows,
      entered: enteredRecibos.rows,
      droppedTitle: "Tenían promesa firmada en el periodo y no tienen el primer recibo publicado en el periodo",
      enteredTitle: "El primer recibo cae en el periodo y la promesa no",
      listTotal: recibosPacked.total,
      droppedTotal: droppedRecibos.total,
      enteredTotal: enteredRecibos.total,
    },
    {
      ...emptyStage("netas", "Ventas netas", "Pipedrive + Odoo", "tratos"),
      count: input.netUnits,
      gtq: input.netGtq,
      conversion: conversion(input.netUnits, recibosNow.length),
      deals: netasPacked.rows,
      dropped: droppedNetas.rows,
      entered: enteredNetas.rows,
      droppedTitle: "Tenían el primer recibo publicado en el periodo y no son venta neta",
      enteredTitle: "Son venta neta y el primer recibo no cae en el periodo",
      footnote:
        input.lossCount > 0
          ? `El número es el neto: ${plural(input.sales.length, "venta", "ventas")} menos ${plural(input.lossCount, "desistimiento", "desistimientos")}.`
          : null,
      listTotal: netasPacked.total,
      droppedTotal: droppedNetas.total,
      enteredTotal: enteredNetas.total,
    },
  ];

  const blockers = buildBlockers({
    reservasNow,
    promesaIds,
    reciboIds,
    soldIds,
    deals,
    units,
    latest,
    receipts,
    range: input.range,
    today: input.today,
    names,
  });

  return {
    freshness,
    funnel,
    blockers: blockers.slice(0, BLOCK_CAP),
    blockerTotal: blockers.length,
    notice: notices.length ? [...new Set(notices)].join(" ") : null,
  };
}

function freshnessOf(input: { pipedrive: string | null; odoo: string | null; odooRows: number; today: string }): Freshness {
  const latest = laterIso(input.pipedrive, input.odoo);
  const notes: string[] = [];
  if (input.odooRows === 0) notes.push("No hay recibos de Odoo cargados. Sin esa lectura no hay venta neta.");
  if (!latest) {
    return {
      label: "Sin movimientos cargados",
      stale: true,
      note: notes.join(" ") || "No hay un movimiento cargado en la lectura.",
    };
  }
  const latestDay = guatemalaDay(latest);
  const stale = latestDay <= addDays(input.today, -4);
  if (stale) notes.push(`El último movimiento cargado es del ${stampText(latest)}. Hoy es ${dotted(input.today)}.`);
  return {
    label: `Datos al ${stampText(latest)}`,
    stale: stale || input.odooRows === 0,
    note: notes.length ? notes.join(" ") : null,
  };
}

function inScope(deal: DealInfo, unit: UnitInfo | null, scope: Scope): boolean {
  if (scope.projectIds && !scope.projectIds.includes(deal.projectId)) return false;
  if (scope.asesorId && deal.asesorId !== scope.asesorId) return false;
  if (scope.torreId && unit?.towerId !== scope.torreId) return false;
  return true;
}

function orphanOk(scope: Scope): boolean {
  return scope.projectIds === null && scope.asesorId === null && scope.torreId === null;
}

function activityInScope(activity: Activity, deals: Map<string, DealInfo>, units: Map<string, UnitInfo>, scope: Scope): boolean {
  if (!activity.dealId) return orphanOk(scope);
  const deal = deals.get(activity.dealId);
  if (!deal) return false;
  const unit = deal.unitId ? units.get(deal.unitId) ?? null : null;
  return inScope(deal, unit, scope);
}

function firstPublished(receipts: ReceiptRow[]): { dealId: string; unitId: string; day: string }[] {
  const map = new Map<string, { dealId: string; unitId: string; day: string }>();
  for (const row of receipts) {
    if (!row.posted || row.unresolved || !row.dealId || !row.unitId || !row.publishedOn) continue;
    const key = `${row.dealId}|${row.unitId}`;
    const current = map.get(key);
    if (!current || row.publishedOn < current.day) map.set(key, { dealId: row.dealId, unitId: row.unitId, day: row.publishedOn });
  }
  return [...map.values()];
}

function dedupeReceipts(rows: ReceiptRow[]): ReceiptRow[] {
  const map = new Map<string, ReceiptRow>();
  for (const row of rows) map.set(row.id, row);
  return [...map.values()];
}

function byDay(a: StageDeal, b: StageDeal): number {
  return (b.day ?? "").localeCompare(a.day ?? "") || a.unit.localeCompare(b.unit, "es");
}

async function unmatchedReceipts(
  client: Db,
  units: Map<string, UnitInfo>,
  range: DateWindow,
  projectIds: string[] | null,
): Promise<{ rows: ReceiptRow[]; capped: boolean }> {
  const tokens = [...new Set([...units.values()].map((unit) => unit.canonical))];
  const projects = projectIds ?? [...new Set([...units.values()].map((unit) => unit.projectId))];
  if (tokens.length === 0 || projects.length === 0) return { rows: [], capped: false };
  const from = addDays(range.from, -2);
  const to = addDays(range.to, 2);
  const loaded = await pagedIn(tokens, (slice, start, end) => {
    let query = client
      .from("fact_recibo")
      .select("odoo_payment_id,matched_deal_id,matched_unit_id,project_id,tower_id,model_id,canonical_unit,fecha,published_on,move_state,payment_type,anulado,match_unresolved")
      .in("canonical_unit", slice)
      .in("project_id", projects)
      .eq("payment_type", "inbound")
      .eq("anulado", false)
      .gte("fecha", from)
      .lte("fecha", to)
      .order("odoo_payment_id");
    query = query.range(start, end);
    return query;
  });
  return {
    rows: loaded.rows.flatMap((row) => {
      const mapped = mapReceipt(row);
      if (!mapped || mapped.dealId) return [];
      return [mapped];
    }),
    capped: loaded.capped,
  };
}

function buildBlockers(input: {
  reservasNow: Activity[];
  promesaIds: Set<string>;
  reciboIds: Set<string>;
  soldIds: Set<string>;
  deals: Map<string, DealInfo>;
  units: Map<string, UnitInfo>;
  latest: Map<string, Reception>;
  receipts: ReceiptRow[];
  range: DateWindow;
  today: string;
  names: Names;
}): BlockerRow[] {
  const rows: BlockerRow[] = [];
  const seen = new Set<string>();
  for (const activity of input.reservasNow) {
    if (activity.dealId) continue;
    rows.push({
      id: `huerfana:${activity.id}`,
      unit: "Sin unidad",
      deal: "Sin trato",
      project: "Sin proyecto",
      asesor: "Sin asesor",
      stage: "Reserva",
      missing: "La reserva no tiene trato.",
      severity: "alta",
      days: daysSince(activity.day, input.today),
      gtq: null,
    });
  }

  const ids = new Set<string>([...input.reservasNow.flatMap((activity) => (activity.dealId ? [activity.dealId] : [])), ...input.promesaIds, ...input.reciboIds]);
  for (const id of ids) {
    if (seen.has(id) || input.soldIds.has(id)) continue;
    seen.add(id);
    const deal = input.deals.get(id);
    if (!deal) continue;
    if (deal.lostOn && deal.lostOn <= input.range.to) continue;
    const unit = deal.unitId ? input.units.get(deal.unitId) ?? null : null;
    const reservaDays = input.reservasNow.filter((activity) => activity.dealId === id).map((activity) => activity.day);
    const issue = receiptIssue(deal, unit, reservaDays, input.receipts);
    const gap = explainStuck({
      hasDeal: true,
      hasUnit: Boolean(unit),
      reservaDay: latestDay(reservaDays),
      receptionDay: input.latest.get(id)?.day ?? null,
      receiptDay: issue.receiptDay,
      undated: issue.undated,
      draft: issue.draft,
      mismatch: issue.mismatch,
      unresolved: issue.unresolved,
      periodFrom: input.range.from,
      periodTo: input.range.to,
    });
    if (!gap) continue;
    rows.push({
      id,
      unit: unitLabel(unit),
      deal: deal.pipedriveId ? `Trato ${deal.pipedriveId}` : "Sin trato",
      project: input.names.project(deal.projectId),
      asesor: input.names.asesor(deal.asesorId),
      stage: gap.stage,
      missing: gap.missing,
      severity: gap.severity,
      days: daysSince(gap.lastDay, input.today),
      gtq: deal.valueGtq,
    });
  }

  rows.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "alta" ? -1 : 1;
    const days = (b.days ?? -1) - (a.days ?? -1);
    if (days !== 0) return days;
    return (b.gtq ?? -1) - (a.gtq ?? -1);
  });
  return rows;
}

function receiptIssue(
  deal: DealInfo,
  unit: UnitInfo | null,
  reservaDays: string[],
  receipts: ReceiptRow[],
): { draft: boolean; mismatch: StuckFacts["mismatch"]; unresolved: boolean; undated: boolean; receiptDay: string | null } {
  const matched = receipts.filter((row) => row.dealId === deal.id && row.posted && !row.unresolved && row.unitId && row.publishedOn);
  const receiptDay = matched.map((row) => row.publishedOn).filter((day): day is string => Boolean(day)).sort()[0] ?? null;
  const undated = receipts.some((row) => row.dealId === deal.id && row.posted && !row.unresolved && !row.publishedOn);
  if (receiptDay) return { draft: false, mismatch: null, unresolved: false, undated: false, receiptDay };

  const draft =
    receipts.some((row) => row.dealId === deal.id && row.draft) ||
    (unit ? receipts.some((row) => row.draft && !row.dealId && sameUnit(unit, row)) : false);

  let mismatch: StuckFacts["mismatch"] = null;
  let unresolved = false;
  if (unit) {
    for (const row of receipts) {
      if (row.dealId || !row.fecha || !sameUnit(unit, row)) continue;
      for (const reservaDay of reservaDays) {
        if (row.fecha === reservaDay && row.unresolved) unresolved = true;
        if (row.fecha === reservaDay) continue;
        const oneDay = addDays(row.fecha, 1) === reservaDay;
        if (!mismatch || (oneDay && !mismatch.oneDay)) mismatch = { fecha: row.fecha, reservaDay, oneDay };
      }
    }
  }
  return { draft, mismatch, unresolved, undated, receiptDay: null };
}
