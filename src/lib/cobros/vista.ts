import { createAdminClient } from "@/lib/supabase/admin";
import {
  guatemalaToday,
  inclusiveDays,
  monthName,
  monthStart,
  monthsTouched,
  previousWindows,
  resolveRange,
  windowLabel,
  yearAgoWindow,
  type DateWindow,
  type PeriodPreset,
} from "@/lib/ventas/period";
import {
  PLAN_FREEZE,
  SIN_DATOS,
  isCobrosSection,
  type Bar,
  type Choice,
  type CobrosSection,
  type CobrosVista,
  type DraftBlock,
  type Kpi,
  type Line,
  type Series,
} from "@/lib/cobros/types";

const PAGE = 1000;
const LIST_CAP = 300;
const CACHE_MS = 30_000;
const NOT_LOADED = "El libro de Odoo 15 todavía no está cargado. Falta correr la carga en el editor SQL.";
const PLAN_NOT_LOADED = "El plan de enganche todavía no está cargado.";

const QUESTIONS: Record<CobrosSection, string> = {
  "cobros-por-proyecto": "¿Cuánto se cobró en el periodo, por proyecto?",
  "cobros-acumulados": "¿Cuánto llevamos cobrado al cierre del periodo, y qué parte del enganche cubre?",
  "cobros-del-mes": "¿Cuánto se cobró en cada mes del periodo, y cómo cae contra la cuota de enganche?",
  deficit: "¿Quién va corto contra el plan de enganche, en el mes y acumulado?",
  superavit: "¿Quién va adelante del plan de enganche, en el mes y acumulado?",
  "reporte-deficit-superavit": "¿En qué socios el enganche va corto o adelante?",
  alertas: "¿Qué socios con plan de enganche van cortos?",
  "decisiones-desistimientos": "¿Qué efectivo publicado sigue en los socios marcados DS-, y cuándo se editó el nombre?",
  "casos-especiales": "¿Qué hay que revisar, si el archivo no marca un caso especial?",
  "reporte-recurrente": "¿Qué recibos publicados caen en el periodo?",
  "alertas-desistimiento": "¿Qué socios todavía sin DS- van cortos contra el enganche?",
  "cierre-mensual-de-cobros": "¿Cómo cierra el periodo con los recibos publicados, y qué quedó fuera?",
};

const FAMILY: Record<string, string> = {
  "02": "02-",
  "cd-02": "CD-02-",
  bnt: "BNT-",
  "03": "03-",
  c: "C-",
  blt: "BLT-",
  "01": "01-",
  none: "Sin prefijo",
};

const CLASE: Record<string, string> = {
  reportado: "Reportado (borrador)",
  anulado: "Anulado",
  cancel: "Cancelado",
  salida_cliente: "Cargo de tarjeta, no reembolso",
  cesion_proveedor: "Cesión a proveedor",
  otro: "Fuera del cobro",
};

const KIND: Record<string, string> = {
  "cd-02": "CD-02-",
  "co-comprador": "Co-comprador",
  "gv1-cero": "Recibo GV1 en cero",
  "sin-asignar": "Sin prefijo",
  "cesion-proveedor": "Cesión en pago a proveedor",
};

type Project = { slug: string; name: string; inFive: boolean; hasUnitBook: boolean; sort: number };

type Cobro = {
  paymentId: number;
  partnerId: number | null;
  partnerName: string;
  projectSlug: string;
  projectName: string;
  prefixFamily: string;
  tower: string | null;
  modelo: string | null;
  apt: string | null;
  ds: boolean;
  currency: string;
  amount: number;
  debitGtq: number | null;
  moveDate: string | null;
  journal: string | null;
  descripcion: string | null;
  recibo: string | null;
  companyAgrees: boolean | null;
};

type Fuera = {
  clase: string;
  projectSlug: string;
  projectName: string;
  partnerId: number | null;
  partnerName: string;
  ds: boolean;
  currency: string;
  amount: number;
  debitGtq: number | null;
  moveDate: string | null;
  journal: string | null;
  descripcion: string | null;
};

type PlanUnit = {
  projectSlug: string;
  projectName: string;
  partnerId: number;
  rawName: string;
  apt: string | null;
  modelo: string | null;
  tower: string | null;
  buyerName: string | null;
  commercialState: string | null;
  hasPlan: boolean;
  confidence: string | null;
  balance: number | null;
  monthsBehind: number | null;
  lastReceiptOn: string | null;
  isDuplicate: boolean;
  balanceScope: string;
};

type PlanMonth = {
  projectSlug: string;
  partnerId: number;
  monthOn: string;
  expected: number;
  confirmed: number;
  cumExpected: number;
  cumConfirmed: number;
};

type Partner = {
  partnerId: number;
  name: string;
  writeOnUtc: string | null;
  projectSlug: string;
  projectName: string;
  prefixFamily: string;
  tower: string | null;
  modelo: string | null;
  apt: string | null;
  buyerName: string | null;
  ds: boolean;
};

type Caso = {
  kind: string;
  projectSlug: string;
  partnerId: number | null;
  partnerName: string;
  moveDate: string | null;
  currency: string | null;
  amount: number | null;
  detail: string;
};

type Meta = { cutoffLabel: string; lastPostedOn: string | null; cobroCount: number };

type Book = {
  projects: Project[];
  cobros: Cobro[];
  fuera: Fuera[];
  units: PlanUnit[];
  months: PlanMonth[];
  partners: Partner[];
  casos: Caso[];
  meta: Meta;
};

export type CobrosFilters = {
  preset: PeriodPreset;
  customFrom: string | null;
  customTo: string | null;
  compareN: boolean;
  n: number;
  compareYear: boolean;
  projectSlugs: string[] | null;
  tower: string | null;
  modelo: string | null;
  bank: string | null;
  marca: "todos" | "ds" | "vigente";
  moneda: "todas" | "GTQ" | "USD";
  drill: string | null;
};

const PRESETS = new Set<PeriodPreset>(["este-mes", "mes-anterior", "este-trimestre", "este-ano", "custom"]);

export function parseCobrosFilters(url: URL): CobrosFilters {
  const presetRaw = url.searchParams.get("periodo");
  const preset: PeriodPreset = presetRaw && PRESETS.has(presetRaw as PeriodPreset) ? (presetRaw as PeriodPreset) : "este-ano";
  const projects = url.searchParams.getAll("proyecto").filter(Boolean);
  const marcaRaw = url.searchParams.get("marca");
  const monedaRaw = url.searchParams.get("moneda");
  return {
    preset,
    customFrom: url.searchParams.get("desde"),
    customTo: url.searchParams.get("hasta"),
    compareN: url.searchParams.get("comparar") === "1",
    n: Math.min(12, Math.max(1, Number(url.searchParams.get("n")) || 1)),
    compareYear: url.searchParams.get("anio") === "1",
    projectSlugs: projects.length === 0 ? null : projects.includes("ninguno") ? [] : projects,
    tower: url.searchParams.get("torre") || null,
    modelo: url.searchParams.get("modelo") || null,
    bank: url.searchParams.get("banco") || null,
    marca: marcaRaw === "ds" || marcaRaw === "vigente" ? marcaRaw : "todos",
    moneda: monedaRaw === "GTQ" || monedaRaw === "USD" ? monedaRaw : "todas",
    drill: url.searchParams.get("detalle") || null,
  };
}

let bookCache: { at: number; book: Book } | null = null;

function db() {
  return createAdminClient().schema("cobros");
}

function explain(error: { message: string; code?: string }): Error {
  const message = error.message;
  if (
    message.includes("schema") ||
    message.includes("does not exist") ||
    message.includes("Could not find") ||
    error.code === "PGRST106" ||
    error.code === "42P01"
  ) {
    return new Error("Cobros todavía no está en la base. Hay que correr 082 y la carga 083 a 086 en el editor SQL, y exponer el esquema cobros.");
  }
  return new Error(message);
}

async function fetchAll(table: string, select: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const client = db();
  for (let from = 0; from < 200000; from += PAGE) {
    const { data, error } = await client.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw explain(error);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function flag(value: unknown): boolean {
  return value === true;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function nextMonth(monthStartIso: string): string {
  const year = Number(monthStartIso.slice(0, 4));
  const month = Number(monthStartIso.slice(5, 7));
  const next = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(next).padStart(2, "0")}-01`;
}

function showDay(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function latestPostedOn(rows: Cobro[], today = guatemalaToday()): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    const day = row.moveDate?.slice(0, 10);
    if (!day || day > today) continue;
    if (latest === null || day > latest) latest = day;
  }
  return latest;
}

const gtqFormat = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdFormat = new Intl.NumberFormat("es-GT", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const countFormat = new Intl.NumberFormat("es-GT");

function money(currency: string, amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  if (currency === "GTQ") return gtqFormat.format(amount);
  if (currency === "USD") return usdFormat.format(amount);
  return `${amount.toFixed(2)} ${currency}`;
}

function count(value: number): string {
  return countFormat.format(value);
}

function isDs(name: string): boolean {
  return name.startsWith("DS-") || name.includes("02-DS-") || name.includes("02-04DS-");
}

function familyOf(prefix: string): string {
  return FAMILY[prefix] ?? prefix;
}

async function loadBook(): Promise<Book> {
  if (bookCache && Date.now() - bookCache.at < CACHE_MS) return bookCache.book;
  const [projectRows, cobroRows, fueraRows, unitRows, monthRows, partnerRows, casoRows, metaRows] = await Promise.all([
    fetchAll("project", "slug,name,in_five,has_unit_book,sort_order"),
    fetchAll(
      "v_cobro",
      "odoo_payment_id,odoo_partner_id,partner_name,project_slug,project_name,prefix_family,tower,modelo,apt,is_desistimiento,currency,amount,debit_gtq,move_date,journal_name,descripcion,x_no_recibo,company_agrees",
    ),
    fetchAll(
      "v_recibo_fuera",
      "clase,project_slug,project_name,odoo_partner_id,partner_name,is_desistimiento,currency,amount,debit_gtq,move_date,journal_name,descripcion",
    ),
    fetchAll(
      "v_plan_unidad",
      "project_slug,project_name,odoo_partner_id,raw_name,apt,modelo,tower,buyer_name,commercial_state,has_plan,plan_confidence,balance,months_behind,last_receipt_on,is_duplicate,balance_scope",
    ),
    fetchAll("v_plan_mes", "project_slug,odoo_partner_id,month_on,expected,confirmed,cum_expected,cum_confirmed"),
    fetchAll(
      "v_partner",
      "odoo_partner_id,name,write_on_utc,project_slug,project_name,prefix_family,tower,modelo,apt,buyer_name,is_desistimiento",
    ),
    fetchAll("v_caso_revision", "kind,project_slug,odoo_partner_id,partner_name,move_date,currency,amount,detail"),
    fetchAll("v_meta", "archive_cutoff_label,cobro_count"),
  ]);

  const metaRow = metaRows[0];
  const book: Book = {
    projects: projectRows
      .map((row) => ({
        slug: String(row.slug),
        name: String(row.name),
        inFive: flag(row.in_five),
        hasUnitBook: flag(row.has_unit_book),
        sort: Number(row.sort_order) || 0,
      }))
      .sort((a, b) => a.sort - b.sort),
    cobros: cobroRows.map((row) => ({
      paymentId: Number(row.odoo_payment_id),
      partnerId: num(row.odoo_partner_id),
      partnerName: text(row.partner_name) ?? "sin nombre",
      projectSlug: String(row.project_slug),
      projectName: String(row.project_name),
      prefixFamily: String(row.prefix_family),
      tower: text(row.tower),
      modelo: text(row.modelo),
      apt: text(row.apt),
      ds: flag(row.is_desistimiento),
      currency: String(row.currency),
      amount: num(row.amount) ?? 0,
      debitGtq: num(row.debit_gtq),
      moveDate: text(row.move_date),
      journal: text(row.journal_name),
      descripcion: text(row.descripcion),
      recibo: text(row.x_no_recibo),
      companyAgrees: row.company_agrees === null || row.company_agrees === undefined ? null : flag(row.company_agrees),
    })),
    fuera: fueraRows.map((row) => ({
      clase: String(row.clase),
      projectSlug: String(row.project_slug),
      projectName: String(row.project_name),
      partnerId: num(row.odoo_partner_id),
      partnerName: text(row.partner_name) ?? "sin nombre",
      ds: flag(row.is_desistimiento),
      currency: String(row.currency),
      amount: num(row.amount) ?? 0,
      debitGtq: num(row.debit_gtq),
      moveDate: text(row.move_date),
      journal: text(row.journal_name),
      descripcion: text(row.descripcion),
    })),
    units: unitRows.map((row) => ({
      projectSlug: String(row.project_slug),
      projectName: String(row.project_name),
      partnerId: Number(row.odoo_partner_id),
      rawName: text(row.raw_name) ?? "sin nombre",
      apt: text(row.apt),
      modelo: text(row.modelo),
      tower: text(row.tower),
      buyerName: text(row.buyer_name),
      commercialState: text(row.commercial_state),
      hasPlan: flag(row.has_plan),
      confidence: text(row.plan_confidence),
      balance: num(row.balance),
      monthsBehind: num(row.months_behind),
      lastReceiptOn: text(row.last_receipt_on),
      isDuplicate: flag(row.is_duplicate),
      balanceScope: text(row.balance_scope) ?? "",
    })),
    months: monthRows.map((row) => ({
      projectSlug: String(row.project_slug),
      partnerId: Number(row.odoo_partner_id),
      monthOn: String(row.month_on).slice(0, 10),
      expected: num(row.expected) ?? 0,
      confirmed: num(row.confirmed) ?? 0,
      cumExpected: num(row.cum_expected) ?? 0,
      cumConfirmed: num(row.cum_confirmed) ?? 0,
    })),
    partners: partnerRows.map((row) => ({
      partnerId: Number(row.odoo_partner_id),
      name: text(row.name) ?? "sin nombre",
      writeOnUtc: text(row.write_on_utc),
      projectSlug: String(row.project_slug),
      projectName: String(row.project_name),
      prefixFamily: String(row.prefix_family),
      tower: text(row.tower),
      modelo: text(row.modelo),
      apt: text(row.apt),
      buyerName: text(row.buyer_name),
      ds: flag(row.is_desistimiento),
    })),
    casos: casoRows.map((row) => ({
      kind: String(row.kind),
      projectSlug: String(row.project_slug),
      partnerId: num(row.odoo_partner_id),
      partnerName: text(row.partner_name) ?? "sin nombre",
      moveDate: text(row.move_date),
      currency: text(row.currency),
      amount: num(row.amount),
      detail: text(row.detail) ?? "",
    })),
    meta: {
      cutoffLabel: text(metaRow?.archive_cutoff_label) ?? "2026-11-02 12:00 America/Guatemala",
      lastPostedOn: null,
      cobroCount: num(metaRow?.cobro_count) ?? 0,
    },
  };
  book.meta.lastPostedOn = latestPostedOn(book.cobros);
  bookCache = { at: Date.now(), book };
  return book;
}

function inWindow(day: string | null, range: DateWindow): boolean {
  return Boolean(day && day >= range.from && day <= range.to);
}

function selectedProjects(book: Book, filters: CobrosFilters): Project[] {
  if (filters.projectSlugs === null) return book.projects.filter((project) => project.inFive);
  return book.projects.filter((project) => filters.projectSlugs?.includes(project.slug));
}

function projectOk(slug: string, filters: CobrosFilters, book: Book): boolean {
  return selectedProjects(book, filters).some((project) => project.slug === slug);
}

function onlySinDatos(projects: Project[]): boolean {
  return projects.length > 0 && projects.every((project) => !project.hasUnitBook);
}

function receiptOk(row: Cobro, filters: CobrosFilters, book: Book, range: DateWindow | null): boolean {
  if (!projectOk(row.projectSlug, filters, book)) return false;
  if (range && !inWindow(row.moveDate, range)) return false;
  if (filters.tower && (row.tower ?? "") !== filters.tower) return false;
  if (filters.modelo && (row.modelo ?? "") !== filters.modelo) return false;
  if (filters.bank && (row.journal ?? "") !== filters.bank) return false;
  if (filters.marca === "ds" && !row.ds) return false;
  if (filters.marca === "vigente" && row.ds) return false;
  if (filters.moneda !== "todas" && row.currency !== filters.moneda) return false;
  return true;
}

function unitOk(unit: PlanUnit, filters: CobrosFilters, book: Book): boolean {
  if (!projectOk(unit.projectSlug, filters, book)) return false;
  if (filters.tower && (unit.tower ?? "") !== filters.tower) return false;
  if (filters.modelo && (unit.modelo ?? "") !== filters.modelo) return false;
  if (filters.marca === "ds" && !isDs(unit.rawName)) return false;
  if (filters.marca === "vigente" && isDs(unit.rawName)) return false;
  return true;
}

function sumOf(rows: Cobro[], currency: string): { n: number; amount: number; debit: number } {
  let n = 0;
  let amount = 0;
  let debit = 0;
  for (const row of rows) {
    if (row.currency !== currency) continue;
    n += 1;
    amount += row.amount;
    if (row.debitGtq != null) debit += row.debitGtq;
  }
  return { n, amount: round2(amount), debit: round2(debit) };
}

function bookedKpi(usd: { n: number; debit: number }): Kpi | null {
  if (usd.n === 0) return null;
  return {
    label: "Quetzales del asiento",
    value: money("GTQ", usd.debit),
    hint: "Débito de los recibos en dólares. No entra en el total en quetzales.",
  };
}

function bookedBeside(currency: string, debit: number | null): string {
  if (currency !== "USD" || debit == null) return "—";
  return money("GTQ", debit);
}

function cap(lines: Line[], total: number): { lines: Line[]; listTotal: number } {
  return { lines: lines.slice(0, LIST_CAP), listTotal: total };
}

function choicesFrom(rows: Cobro[]): CobrosVista["choices"] {
  const torre = new Map<string, string>();
  const modelo = new Map<string, string>();
  const banco = new Map<string, string>();
  for (const row of rows) {
    if (row.tower) torre.set(row.tower, row.tower);
    if (row.modelo) modelo.set(row.modelo, row.modelo);
    if (row.journal) banco.set(row.journal, row.journal);
  }
  const toChoice = (map: Map<string, string>): Choice[] =>
    [...map.values()].sort((a, b) => a.localeCompare(b, "es")).map((label) => ({ id: label, label }));
  return { torre: toChoice(torre), modelo: toChoice(modelo), banco: toChoice(banco) };
}

function projectBars(rows: Cobro[], currency: string, projects: Project[]): Bar[] {
  return projects
    .filter((project) => project.hasUnitBook)
    .map((project) => ({
      id: project.slug,
      label: project.name,
      value: sumOf(rows.filter((row) => row.projectSlug === project.slug), currency).amount,
    }));
}

function projectBookedBars(rows: Cobro[], projects: Project[]): Bar[] {
  return projects
    .filter((project) => project.hasUnitBook)
    .map((project) => ({
      id: project.slug,
      label: project.name,
      value: sumOf(rows.filter((row) => row.projectSlug === project.slug), "USD").debit,
    }))
    .filter((bar) => bar.value !== 0);
}

function partnerLines(rows: Cobro[], drill: string | null): { lines: Line[]; listTotal: number } {
  const scoped = drill ? rows.filter((row) => row.projectSlug === drill) : rows;
  const grouped = new Map<string, Cobro[]>();
  for (const row of scoped) {
    const key = `${row.projectSlug}:${row.partnerId ?? row.partnerName}`;
    const list = grouped.get(key);
    if (list) list.push(row);
    else grouped.set(key, [row]);
  }
  const lines = [...grouped.values()]
    .map((group) => {
      const head = group[0];
      const gtq = sumOf(group, "GTQ");
      const usd = sumOf(group, "USD");
      return {
        id: `${head.projectSlug}:${head.partnerId ?? head.partnerName}`,
        drillId: head.projectSlug,
        sort: gtq.amount,
        values: [
          head.partnerName,
          familyOf(head.prefixFamily),
          head.tower ?? "Sin torre",
          head.modelo ?? "—",
          head.apt ?? "—",
          count(gtq.n),
          money("GTQ", gtq.amount),
          count(usd.n),
          usd.n ? money("USD", usd.amount) : "—",
          usd.n ? money("GTQ", usd.debit) : "—",
        ],
      };
    })
    .sort((a, b) => b.sort - a.sort);
  return cap(
    lines.map(({ sort: _sort, ...line }) => line),
    lines.length,
  );
}

function isMonthId(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

function isDayId(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function receiptLines(rows: Cobro[], drill: string | null, drillOf: (row: Cobro) => string): { lines: Line[]; listTotal: number } {
  const scoped = drill
    ? rows.filter((row) => {
        if (isDayId(drill)) return row.moveDate === drill;
        if (isMonthId(drill)) return (row.moveDate ?? "").slice(0, 7) === drill;
        return drillOf(row) === drill;
      })
    : rows;
  const sorted = [...scoped].sort((a, b) => (b.moveDate ?? "").localeCompare(a.moveDate ?? "") || b.amount - a.amount);
  const lines = sorted.map((row) => ({
    id: String(row.paymentId),
    drillId: drillOf(row),
    values: [
      showDay(row.moveDate),
      row.projectName,
      row.partnerName,
      familyOf(row.prefixFamily),
      row.tower ?? "Sin torre",
      row.modelo ?? "—",
      row.currency,
      money(row.currency, row.amount),
      bookedBeside(row.currency, row.debitGtq),
      row.journal ?? "—",
      row.ds ? "DS-" : "Vigente",
    ],
  }));
  return cap(lines, lines.length);
}

function monthSeries(rows: Cobro[], currency: string, name: string): Series[] {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    if (row.currency !== currency || !row.moveDate) continue;
    const key = row.moveDate.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + row.amount);
  }
  const points = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ id: key, label: monthName(`${key}-01`), value: round2(value) }));
  return points.length ? [{ name, points }] : [];
}

function cumulativeSeries(rows: Cobro[], currency: string, projects: Project[], end: string): Series[] {
  const series: Series[] = [];
  for (const project of projects.filter((item) => item.hasUnitBook)) {
    const mine = rows.filter((row) => row.projectSlug === project.slug && row.currency === currency && row.moveDate && row.moveDate <= end);
    if (mine.length === 0) continue;
    const byMonth = new Map<string, number>();
    for (const row of mine) {
      const key = row.moveDate?.slice(0, 7);
      if (!key) continue;
      byMonth.set(key, (byMonth.get(key) ?? 0) + row.amount);
    }
    const keys = [...byMonth.keys()].sort();
    const first = keys[0];
    const last = end.slice(0, 7);
    if (!first) continue;
    let running = 0;
    const points: { id: string; label: string; value: number }[] = [];
    let cursor = `${first}-01`;
    while (cursor.slice(0, 7) <= last) {
      running += byMonth.get(cursor.slice(0, 7)) ?? 0;
      points.push({ id: project.slug, label: monthName(cursor), value: round2(running) });
      cursor = nextMonth(cursor);
    }
    series.push({ name: project.name, points });
  }
  return series;
}

function cumulativeBooked(rows: Cobro[], projects: Project[], end: string): Series[] {
  const series: Series[] = [];
  for (const project of projects.filter((item) => item.hasUnitBook)) {
    const mine = rows.filter((row) => row.projectSlug === project.slug && row.currency === "USD" && row.debitGtq != null && row.moveDate && row.moveDate <= end);
    if (mine.length === 0) continue;
    const byMonth = new Map<string, number>();
    for (const row of mine) {
      const key = row.moveDate?.slice(0, 7);
      if (!key) continue;
      byMonth.set(key, (byMonth.get(key) ?? 0) + (row.debitGtq ?? 0));
    }
    const first = [...byMonth.keys()].sort()[0];
    if (!first) continue;
    let running = 0;
    const points: { id: string; label: string; value: number }[] = [];
    let cursor = `${first}-01`;
    while (cursor.slice(0, 7) <= end.slice(0, 7)) {
      running += byMonth.get(cursor.slice(0, 7)) ?? 0;
      points.push({ id: project.slug, label: monthName(cursor), value: round2(running) });
      cursor = nextMonth(cursor);
    }
    series.push({ name: project.name, points });
  }
  return series;
}

function bookedOverTime(rows: Cobro[], grain: "day" | "month"): Series[] {
  const byKey = new Map<string, number>();
  for (const row of rows) {
    if (row.currency !== "USD" || row.debitGtq == null || !row.moveDate) continue;
    const key = grain === "month" ? row.moveDate.slice(0, 7) : row.moveDate;
    byKey.set(key, (byKey.get(key) ?? 0) + row.debitGtq);
  }
  const points = [...byKey.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({
      id: key,
      label: grain === "month" ? monthName(`${key}-01`) : showDay(key),
      value: round2(value),
    }));
  return points.length ? [{ name: "Quetzales del asiento", points }] : [];
}

function monthBookedBars(rows: Cobro[]): Bar[] {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    if (row.currency !== "USD" || !row.moveDate || row.debitGtq == null) continue;
    const key = row.moveDate.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + row.debitGtq);
  }
  return [...byMonth.entries()]
    .filter(([, value]) => value !== 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ id: key, label: monthName(`${key}-01`), value: round2(value) }));
}

function baseNotices(book: Book, selected: Project[], rows: Cobro[]): string[] {
  const notices: string[] = [];
  if (selected.some((project) => !project.hasUnitBook)) notices.push(SIN_DATOS);
  const disagree = rows.filter((row) => row.companyAgrees === false).length;
  if (disagree > 0) {
    notices.push(`${count(disagree)} recibos cuyo prefijo y compañía no coinciden. El proyecto es el prefijo del nombre.`);
  }
  if (book.meta.lastPostedOn) {
    notices.push(`Último recibo publicado: ${showDay(book.meta.lastPostedOn)}. El archivo corta ${book.meta.cutoffLabel}.`);
  }
  return notices;
}

function compareReceipts(book: Book, filters: CobrosFilters, range: DateWindow): { label: string; detail: string }[] {
  if (!filters.compareN && !filters.compareYear) return [];
  const windows: DateWindow[] = [];
  if (filters.compareN) windows.push(...previousWindows(range, filters.n));
  if (filters.compareYear) windows.push(yearAgoWindow(range));
  return windows.map((window) => {
    const rows = book.cobros.filter((row) => receiptOk(row, filters, book, window));
    const gtq = sumOf(rows, "GTQ");
    const usd = sumOf(rows, "USD");
    const booked = usd.n > 0 ? ` · asiento ${money("GTQ", usd.debit)}` : "";
    return { label: window.label || windowLabel(window), detail: `${money("GTQ", gtq.amount)} · ${money("USD", usd.amount)}${booked}` };
  });
}

function blank(
  section: CobrosSection,
  range: DateWindow,
  book: Book,
  selected: Project[],
  choices: CobrosVista["choices"],
  notices: string[],
  caption: string,
): CobrosVista {
  return {
    section,
    question: QUESTIONS[section],
    periodLabel: range.label,
    rangeLabel: `${showDay(range.from)} – ${showDay(range.to)}`,
    caption,
    notices,
    empty: null,
    projects: book.projects
      .filter((project) => project.inFive)
      .map((project) => ({
        id: project.slug,
        label: project.hasUnitBook ? project.name : `${project.name} · sin datos en Odoo 15`,
        ledger: project.hasUnitBook ? "con_libro" : "sin_datos",
      })),
    choices,
    kpis: [],
    gtqBars: [],
    usdBars: [],
    bookedBars: [],
    gtqSeries: [],
    usdSeries: [],
    bookedSeries: [],
    lineTitle: "Detalle",
    lineHeaders: [],
    lines: [],
    listTotal: 0,
    drafts: null,
    compare: [],
    baked: section === "reporte-recurrente" ? "resumen" : section === "alertas-desistimiento" ? "alertas" : section === "cierre-mensual-de-cobros" ? "cierre" : null,
  };
}

function sinDatosVista(section: CobrosSection, range: DateWindow, book: Book, selected: Project[]): CobrosVista {
  const vista = blank(section, range, book, selected, { torre: [], modelo: [], banco: [] }, [SIN_DATOS], "Esta selección no tiene libro de unidades en Odoo 15.");
  vista.empty = SIN_DATOS;
  return vista;
}

type Cut = { monthOn: string; expected: number; confirmed: number; balance: number };

function indexMonths(months: PlanMonth[]): Map<string, PlanMonth[]> {
  const map = new Map<string, PlanMonth[]>();
  for (const month of months) {
    const key = `${month.projectSlug}:${month.partnerId}`;
    const list = map.get(key);
    if (list) list.push(month);
    else map.set(key, [month]);
  }
  return map;
}

function cutAt(months: PlanMonth[] | undefined, end: string): Cut | null {
  if (!months) return null;
  let best: PlanMonth | null = null;
  for (const month of months) {
    if (month.monthOn <= end && (best === null || month.monthOn > best.monthOn)) best = month;
  }
  if (!best) return null;
  return {
    monthOn: best.monthOn,
    expected: best.cumExpected,
    confirmed: best.cumConfirmed,
    balance: round2(best.cumExpected - best.cumConfirmed),
  };
}

function planPopulation(book: Book, filters: CobrosFilters): { units: PlanUnit[]; months: Map<string, PlanMonth[]> } {
  const units = book.units.filter((unit) => unitOk(unit, filters, book));
  const allowed = new Set(units.map((unit) => `${unit.projectSlug}:${unit.partnerId}`));
  const months = new Map<string, PlanMonth[]>();
  for (const [key, rows] of indexMonths(book.months)) {
    if (allowed.has(key)) months.set(key, rows);
  }
  return { units, months };
}

function lectura(balance: number | null, hasPlan: boolean, duplicate: boolean): string {
  if (duplicate) return "Duplicado";
  if (!hasPlan) return "Sin plan";
  if (balance === null) return "Sin cuota en el periodo";
  if (balance > 1) return "Corto";
  if (balance < -1) return "Adelante";
  return "En el plan";
}

export async function buildCobrosVista(section: string, filters: CobrosFilters): Promise<CobrosVista> {
  if (!isCobrosSection(section)) throw new Error("Esa vista no existe.");
  const book = await loadBook();
  const range = resolveRange(filters.preset, filters.customFrom, filters.customTo);
  const selected = selectedProjects(book, filters);
  if (selected.length === 0) {
    const vista = blank(section, range, book, selected, { torre: [], modelo: [], banco: [] }, [], "Ningún proyecto seleccionado.");
    vista.empty = "Ningún proyecto seleccionado.";
    return vista;
  }
  if (onlySinDatos(selected)) return sinDatosVista(section, range, book, selected);

  const choiceRows = book.cobros.filter((row) => projectOk(row.projectSlug, filters, book) && inWindow(row.moveDate, range));
  const choices = choicesFrom(choiceRows);
  for (const unit of book.units.filter((unit) => projectOk(unit.projectSlug, filters, book))) {
    if (unit.tower && !choices.torre.some((choice) => choice.id === unit.tower)) choices.torre.push({ id: unit.tower, label: unit.tower });
    if (unit.modelo && !choices.modelo.some((choice) => choice.id === unit.modelo)) choices.modelo.push({ id: unit.modelo, label: unit.modelo });
  }
  choices.torre.sort((a, b) => a.label.localeCompare(b.label, "es"));
  choices.modelo.sort((a, b) => a.label.localeCompare(b.label, "es"));

  if (section === "deficit" || section === "superavit" || section === "reporte-deficit-superavit" || section === "alertas" || section === "alertas-desistimiento") {
    return planVista(section, filters, book, range, selected, choices);
  }
  if (section === "casos-especiales") return casosVista(filters, book, range, selected, choices);
  if (section === "decisiones-desistimientos") return decisionesVista(filters, book, range, selected, choices);
  return receiptVista(section, filters, book, range, selected, choices);
}

function periodDrafts(book: Book, filters: CobrosFilters, range: DateWindow): Fuera[] {
  const partners = new Map(book.partners.map((partner) => [partner.partnerId, partner]));
  return book.fuera.filter((row) => {
    if (row.clase !== "reportado") return false;
    if (!projectOk(row.projectSlug, filters, book)) return false;
    if (!inWindow(row.moveDate, range)) return false;
    if (filters.bank && (row.journal ?? "") !== filters.bank) return false;
    if (filters.marca === "ds" && !row.ds) return false;
    if (filters.marca === "vigente" && row.ds) return false;
    if (filters.moneda !== "todas" && row.currency !== filters.moneda) return false;
    const partner = row.partnerId != null ? partners.get(row.partnerId) : undefined;
    if (filters.tower && (partner?.tower ?? "") !== filters.tower) return false;
    if (filters.modelo && (partner?.modelo ?? "") !== filters.modelo) return false;
    return true;
  });
}

function draftBlock(rows: Fuera[]): DraftBlock | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => (b.moveDate ?? "").localeCompare(a.moveDate ?? "") || b.amount - a.amount);
  return {
    title: "Reportado (borrador). No entra en el publicado.",
    headers: ["Fecha", "Proyecto", "Socio", "Moneda", "Monto", "Q del asiento", "Banco"],
    total: sorted.length,
    lines: sorted.slice(0, LIST_CAP).map((row, index) => ({
      id: `borrador:${row.partnerId ?? index}:${row.moveDate ?? ""}:${row.amount}`,
      drillId: row.projectSlug,
      values: [
        showDay(row.moveDate),
        row.projectName,
        row.partnerName,
        row.currency,
        money(row.currency, row.amount),
        bookedBeside(row.currency, row.debitGtq),
        row.journal ?? "—",
      ],
    })),
  };
}

function receiptVista(
  section: CobrosSection,
  filters: CobrosFilters,
  book: Book,
  range: DateWindow,
  selected: Project[],
  choices: CobrosVista["choices"],
): CobrosVista {
  if (book.meta.cobroCount === 0) {
    const vista = blank(section, range, book, selected, choices, [NOT_LOADED], NOT_LOADED);
    vista.empty = NOT_LOADED;
    return vista;
  }
  const throughEnd = section === "cobros-acumulados";
  const window = throughEnd ? { from: "2000-01-01", to: range.to, label: range.label } : range;
  const rows = book.cobros.filter((row) => receiptOk(row, filters, book, window));
  const periodRows = throughEnd ? rows.filter((row) => inWindow(row.moveDate, range)) : rows;
  const gtq = sumOf(throughEnd ? rows : periodRows, "GTQ");
  const usd = sumOf(throughEnd ? rows : periodRows, "USD");
  const notices = baseNotices(book, selected, periodRows);
  const drafts = periodDrafts(book, filters, range);
  if (section !== "cobros-acumulados" && drafts.length > 0 && periodRows.length === 0) {
    notices.unshift(`Hay ${count(drafts.length)} borradores en el periodo. No entran en el publicado.`);
  }
  const measured = selected.filter((project) => project.hasUnitBook);
  const caption = throughEnd
    ? "El acumulado suma desde el primer recibo publicado hasta el fin del periodo. Quetzales y dólares van aparte."
    : "Un cobro es un recibo de cliente publicado, no anulado y no interno. La fecha es la del asiento.";

  const vista = blank(section, range, book, selected, choices, notices, caption);
  vista.compare = compareReceipts(book, filters, range);
  if (filters.moneda !== "USD") {
    vista.kpis.push({ label: "Quetzales", value: money("GTQ", gtq.amount), hint: `${count(gtq.n)} recibos` });
  }
  if (filters.moneda !== "GTQ") {
    vista.kpis.push({ label: "Dólares", value: money("USD", usd.amount), hint: usd.n ? `${count(usd.n)} recibos` : "Sin recibos en dólares" });
    const booked = bookedKpi(usd);
    if (booked) vista.kpis.push(booked);
  }

  if (section === "cobros-por-proyecto" || section === "reporte-recurrente" || section === "cierre-mensual-de-cobros") {
    vista.gtqBars = filters.moneda === "USD" ? [] : projectBars(rows, "GTQ", measured);
    vista.usdBars = filters.moneda === "GTQ" ? [] : projectBars(rows, "USD", measured);
    vista.bookedBars = filters.moneda === "GTQ" ? [] : projectBookedBars(rows, measured);
  }
  if (section === "cobros-acumulados") {
    vista.gtqSeries = filters.moneda === "USD" ? [] : cumulativeSeries(rows, "GTQ", measured, range.to);
    vista.usdSeries = filters.moneda === "GTQ" ? [] : cumulativeSeries(rows, "USD", measured, range.to);
    vista.bookedSeries = filters.moneda === "GTQ" ? [] : cumulativeBooked(rows, measured, range.to);
    vista.bookedBars = filters.moneda === "GTQ" ? [] : projectBookedBars(rows, measured);
    vista.gtqBars = filters.moneda === "USD" ? [] : projectBars(rows, "GTQ", measured);
    const ratio = planRatio(book, filters, range.to);
    vista.kpis.push(ratio.kpi);
    notices.push(PLAN_FREEZE);
    if (ratio.note) notices.push(ratio.note);
  }
  if (section === "cobros-del-mes") {
    const grain = inclusiveDays(range.from, range.to) <= 62 ? "day" : "month";
    vista.gtqSeries = filters.moneda === "USD" ? [] : grain === "month" ? monthSeries(periodRows, "GTQ", "Publicado") : daySeries(periodRows, "GTQ", "Publicado");
    vista.usdSeries = filters.moneda === "GTQ" ? [] : grain === "month" ? monthSeries(periodRows, "USD", "Publicado") : daySeries(periodRows, "USD", "Publicado");
    vista.bookedSeries = filters.moneda === "GTQ" ? [] : bookedOverTime(periodRows, grain);
    const cuota = cuotaSeries(book, filters, range);
    if (cuota.points.length && filters.moneda !== "USD") vista.gtqSeries.push(cuota);
    notices.push(PLAN_FREEZE);
    notices.push("La cuota es el enganche del plan, solo en los socios que tienen plan. El publicado es el libro.");
  }
  if (section === "cierre-mensual-de-cobros") {
    const zeros = periodRows.filter((row) => row.amount === 0).length;
    const ds = sumOf(periodRows.filter((row) => row.ds), "GTQ");
    vista.kpis.push({ label: "Recibos en cero", value: count(zeros), hint: "Cuentan y no suman dinero" });
    vista.kpis.push({ label: "Quetzales en nombres DS-", value: money("GTQ", ds.amount), hint: `${count(ds.n)} recibos, en el mes en que se publicaron` });
    const fuera = cierreFuera(book, filters, range);
    const journals = journalLines(periodRows, filters.drill);
    const side = fueraLines(fuera, filters.drill);
    vista.lineTitle = "Bancos del publicado, y lo que quedó fuera";
    vista.bookedBars = filters.moneda === "GTQ" ? [] : projectBookedBars(periodRows, measured);
    vista.lineHeaders = ["Clase", "Proyecto", "Fecha", "Banco", "Moneda", "Monto", "Q del asiento", "Detalle"];
    const merged = [...journals.lines, ...side.lines];
    const packed = cap(merged, journals.listTotal + side.listTotal);
    vista.lines = packed.lines;
    vista.listTotal = packed.listTotal;
    notices.push("Anulados, cancelados y borradores se ven y no entran en el total. No hay reembolsos de comprador que restar.");
    return vista;
  }

  const partnerMode = section === "cobros-por-proyecto" || section === "cobros-acumulados";
  if (partnerMode) {
    const packed = partnerLines(rows, filters.drill);
    vista.lineTitle = "Por socio. 02- y CD-02- siguen separados, igual que BNT- y 03-.";
    vista.lineHeaders = ["Socio", "Familia", "Torre", "Modelo", "Apto", "Recibos Q", "Quetzales", "Recibos $", "Dólares", "Q del asiento"];
    vista.lines = packed.lines;
    vista.listTotal = packed.listTotal;
    if (section === "cobros-acumulados") {
      const shown = filters.drill && !isMonthId(filters.drill) && !isDayId(filters.drill)
        ? drafts.filter((row) => row.projectSlug === filters.drill)
        : drafts;
      if (shown.length > 0) {
        notices.unshift(`${count(shown.length)} borradores en el periodo. No entran en el acumulado publicado.`);
      }
      vista.drafts = draftBlock(shown);
    }
  } else {
    const packed = receiptLines(periodRows, filters.drill, (row) => (section === "cobros-del-mes" ? (row.moveDate ?? "").slice(0, 7) : row.projectSlug));
    vista.lineTitle = "Recibos publicados";
    vista.lineHeaders = ["Fecha", "Proyecto", "Socio", "Familia", "Torre", "Modelo", "Moneda", "Monto", "Q del asiento", "Banco", "Marca"];
    vista.lines = packed.lines;
    vista.listTotal = packed.listTotal;
    if (section === "cobros-del-mes") {
      vista.gtqBars = filters.moneda === "USD" ? [] : monthBars(periodRows, "GTQ");
      vista.usdBars = filters.moneda === "GTQ" ? [] : monthBars(periodRows, "USD");
      vista.bookedBars = filters.moneda === "GTQ" ? [] : monthBookedBars(periodRows);
    }
  }
  return vista;
}

function daySeries(rows: Cobro[], currency: string, name: string): Series[] {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    if (row.currency !== currency || !row.moveDate) continue;
    byDay.set(row.moveDate, (byDay.get(row.moveDate) ?? 0) + row.amount);
  }
  const points = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, value]) => ({ id: day, label: showDay(day), value: round2(value) }));
  return points.length ? [{ name, points }] : [];
}

function monthBars(rows: Cobro[], currency: string): Bar[] {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    if (row.currency !== currency || !row.moveDate) continue;
    const key = row.moveDate.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + row.amount);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ id: key, label: monthName(`${key}-01`), value: round2(value) }));
}

function cuotaSeries(book: Book, filters: CobrosFilters, range: DateWindow): Series {
  const { units, months } = planPopulation(book, filters);
  const keys = new Set(units.filter((unit) => unit.hasPlan && !unit.isDuplicate).map((unit) => `${unit.projectSlug}:${unit.partnerId}`));
  const byMonth = new Map<string, number>();
  for (const month of monthsTouched(range.from, range.to)) {
    byMonth.set(month.slice(0, 7), 0);
  }
  for (const [key, rows] of months) {
    if (!keys.has(key)) continue;
    for (const row of rows) {
      if (row.monthOn < monthStart(range.from) || row.monthOn > range.to) continue;
      const bucket = row.monthOn.slice(0, 7);
      byMonth.set(bucket, (byMonth.get(bucket) ?? 0) + row.expected);
    }
  }
  const points = [...byMonth.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ id: key, label: monthName(`${key}-01`), value: round2(value) }));
  return { name: "Cuota de enganche", points };
}

function planRatio(book: Book, filters: CobrosFilters, end: string): { kpi: Kpi; note: string | null } {
  const { units, months } = planPopulation(book, filters);
  let expected = 0;
  let confirmed = 0;
  let used: string | null = null;
  let planned = 0;
  for (const unit of units) {
    if (!unit.hasPlan || unit.isDuplicate) continue;
    const cut = cutAt(months.get(`${unit.projectSlug}:${unit.partnerId}`), end);
    if (!cut) continue;
    planned += 1;
    expected += cut.expected;
    confirmed += cut.confirmed;
    if (!used || cut.monthOn > used) used = cut.monthOn;
  }
  if (planned === 0 || expected <= 0) {
    return { kpi: { label: "Cobertura del enganche", value: "Sin plan", hint: "No hay cuota para esta selección" }, note: null };
  }
  const ratio = confirmed / expected;
  const note = used && used.slice(0, 7) < end.slice(0, 7)
    ? `La cobertura usa ${monthName(used)}. El plan no tiene meses después.`
    : null;
  return {
    kpi: {
      label: "Cobertura del enganche",
      value: `${(ratio * 100).toFixed(1)} %`,
      hint: `${money("GTQ", round2(confirmed))} de ${money("GTQ", round2(expected))} · ${count(planned)} socios con plan`,
    },
    note,
  };
}

function journalLines(rows: Cobro[], drill: string | null): { lines: Line[]; listTotal: number } {
  const scoped = drill ? rows.filter((row) => row.projectSlug === drill) : rows;
  const grouped = new Map<string, Cobro[]>();
  for (const row of scoped) {
    const key = `${row.projectSlug}:${row.currency}:${row.journal ?? "—"}`;
    const list = grouped.get(key);
    if (list) list.push(row);
    else grouped.set(key, [row]);
  }
  const lines = [...grouped.values()].map((group) => {
    const head = group[0];
    const amount = round2(group.reduce((sum, row) => sum + row.amount, 0));
    const debit = round2(group.reduce((sum, row) => sum + (row.debitGtq ?? 0), 0));
    return {
      id: `publicado:${head.projectSlug}:${head.currency}:${head.journal ?? ""}`,
      drillId: head.projectSlug,
      values: ["Publicado", head.projectName, "—", head.journal ?? "—", head.currency, money(head.currency, amount), bookedBeside(head.currency, head.currency === "USD" ? debit : null), `${count(group.length)} recibos`],
    };
  });
  return { lines, listTotal: lines.length };
}

function cierreFuera(book: Book, filters: CobrosFilters, range: DateWindow): Fuera[] {
  return book.fuera.filter((row) => {
    if (!projectOk(row.projectSlug, filters, book)) return false;
    if (!inWindow(row.moveDate, range)) return false;
    if (filters.bank && (row.journal ?? "") !== filters.bank) return false;
    if (filters.marca === "ds" && !row.ds) return false;
    if (filters.marca === "vigente" && row.ds) return false;
    if (filters.moneda !== "todas" && row.currency !== filters.moneda) return false;
    return row.clase === "reportado" || row.clase === "anulado" || row.clase === "cancel" || row.clase === "salida_cliente";
  });
}

function fueraLines(rows: Fuera[], drill: string | null): { lines: Line[]; listTotal: number } {
  const scoped = drill ? rows.filter((row) => row.projectSlug === drill) : rows;
  const lines = scoped.map((row, index) => ({
    id: `fuera:${index}:${row.partnerName}:${row.moveDate ?? ""}`,
    drillId: row.projectSlug,
    values: [
      CLASE[row.clase] ?? row.clase,
      row.projectName,
      showDay(row.moveDate),
      row.journal ?? "—",
      row.currency,
      money(row.currency, row.amount),
      bookedBeside(row.currency, row.debitGtq),
      row.descripcion ?? row.partnerName,
    ],
  }));
  return { lines, listTotal: lines.length };
}

function planVista(
  section: CobrosSection,
  filters: CobrosFilters,
  book: Book,
  range: DateWindow,
  selected: Project[],
  choices: CobrosVista["choices"],
): CobrosVista {
  if (book.units.length === 0) {
    const vista = blank(section, range, book, selected, choices, [PLAN_NOT_LOADED, PLAN_FREEZE], PLAN_NOT_LOADED);
    vista.empty = PLAN_NOT_LOADED;
    return vista;
  }
  const { units, months } = planPopulation(book, filters);
  const usable = units.filter((unit) => unit.hasPlan && !unit.isDuplicate);
  const duplicates = units.filter((unit) => unit.isDuplicate).length;
  const brecha = units.filter((unit) => unit.commercialState === "brecha" && !unit.isDuplicate).length;
  const aheadSide = section === "superavit";
  const notices = [PLAN_FREEZE, "En Boulevard 5 el archivo guarda el plan completo, sin mes de corte. Aquí el saldo es el acumulado del mes."];
  if (selected.some((project) => !project.hasUnitBook)) notices.push(SIN_DATOS);
  if (duplicates > 0) notices.push(`${count(duplicates)} filas duplicadas no entran en el total.`);
  if (brecha > 0 && section === "deficit") {
    notices.push(`${count(brecha)} socios pagan y no tienen plan. Eso no es déficit: falta la expectativa.`);
  }
  const scored: { unit: PlanUnit; cut: Cut }[] = [];
  let used: string | null = null;
  for (const unit of usable) {
    const cut = cutAt(months.get(`${unit.projectSlug}:${unit.partnerId}`), range.to);
    if (!cut) continue;
    if (!used || cut.monthOn > used) used = cut.monthOn;
    scored.push({ unit, cut });
  }
  if (used && used.slice(0, 7) < range.to.slice(0, 7)) {
    notices.push(`El saldo acumulado usa ${monthName(used)}. El plan no tiene el mes del periodo.`);
  }
  const short = scored.filter((row) => row.cut.balance > 1);
  const ahead = scored.filter((row) => row.cut.balance < -1);
  const focus = aheadSide ? ahead : section === "reporte-deficit-superavit" ? scored : short;
  const vista = blank(section, range, book, selected, choices, notices, "El saldo es esperado menos confirmado del plan. Positivo va corto. Negativo va adelante. No es el saldo de la factura.");
  const total = round2(focus.reduce((sum, row) => sum + (aheadSide ? -row.cut.balance : Math.max(row.cut.balance, 0)), 0));
  vista.kpis = [
    {
      label: aheadSide ? "Adelante del enganche" : "Corto del enganche",
      value: money("GTQ", total),
      hint: `${count(focus.length)} socios`,
    },
  ];
  if (section === "reporte-deficit-superavit") {
    vista.kpis = [
      { label: "Cortos", value: count(short.length), hint: money("GTQ", round2(short.reduce((sum, row) => sum + row.cut.balance, 0))) },
      { label: "Adelante", value: count(ahead.length), hint: money("GTQ", round2(ahead.reduce((sum, row) => sum + -row.cut.balance, 0))) },
      { label: "En el plan", value: count(scored.length - short.length - ahead.length), hint: "Saldo entre −1 y 1" },
    ];
  }
  const showLive = section === "alertas" || section === "alertas-desistimiento";
  if (showLive) {
    notices.unshift("Odoo no guarda alertas. Esta lista es el saldo corto del plan. Los meses de atraso son los del archivo, no del periodo. El publicado es el libro de recibos; el último recibo del plan es la foto del 1 de octubre de 2026.");
  }
  const listed = section === "alertas-desistimiento" ? focus.filter((row) => !isDs(row.unit.rawName)) : focus;
  if (section === "alertas-desistimiento") {
    const marked = focus.filter((row) => isDs(row.unit.rawName)).length;
    vista.kpis.push({ label: "Ya marcados DS-", value: count(marked), hint: "Esos están en decisiones, no aquí" });
  }
  const byProject = new Map<string, number>();
  for (const row of listed) {
    const amount = aheadSide ? -row.cut.balance : Math.max(row.cut.balance, 0);
    byProject.set(row.unit.projectSlug, (byProject.get(row.unit.projectSlug) ?? 0) + amount);
  }
  vista.gtqBars = selected
    .filter((project) => project.hasUnitBook)
    .map((project) => ({ id: project.slug, label: project.name, value: round2(byProject.get(project.slug) ?? 0) }));
  const monthTotals = new Map<string, number>();
  for (const month of monthsTouched(range.from, range.to)) monthTotals.set(month.slice(0, 7), 0);
  for (const unit of usable) {
    for (const month of months.get(`${unit.projectSlug}:${unit.partnerId}`) ?? []) {
      if (month.monthOn < monthStart(range.from) || month.monthOn > range.to) continue;
      const gap = month.expected - month.confirmed;
      const piece = aheadSide ? Math.max(-gap, 0) : Math.max(gap, 0);
      const key = month.monthOn.slice(0, 7);
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + piece);
    }
  }
  if (section === "deficit" || section === "superavit") {
    vista.gtqSeries = [{
      name: aheadSide ? "Adelante del mes" : "Corto del mes",
      points: [...monthTotals.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => ({ id: key, label: monthName(`${key}-01`), value: round2(value) })),
    }];
  }
  const monthDrill = filters.drill && isMonthId(filters.drill) ? filters.drill : null;
  const projectDrill = filters.drill && !monthDrill ? filters.drill : null;
  const rows = listed
    .filter((row) => {
      if (projectDrill && row.unit.projectSlug !== projectDrill) return false;
      if (!monthDrill) return true;
      const gapMonths = months.get(`${row.unit.projectSlug}:${row.unit.partnerId}`) ?? [];
      return gapMonths.some((month) => {
        if (month.monthOn.slice(0, 7) !== monthDrill) return false;
        const gap = month.expected - month.confirmed;
        return aheadSide ? gap < 0 : gap > 0;
      });
    })
    .sort((a, b) => (b.unit.monthsBehind ?? 0) - (a.unit.monthsBehind ?? 0) || b.cut.balance - a.cut.balance);
  const liveByPartner = new Map<string, Cobro[]>();
  if (showLive) {
    for (const cobro of book.cobros) {
      if (cobro.partnerId == null) continue;
      const key = `${cobro.projectSlug}:${cobro.partnerId}`;
      const list = liveByPartner.get(key);
      if (list) list.push(cobro);
      else liveByPartner.set(key, [cobro]);
    }
    let liveGtq = 0;
    let liveUsd = 0;
    let liveUsdDebit = 0;
    let liveCount = 0;
    for (const row of rows) {
      const cash = liveByPartner.get(`${row.unit.projectSlug}:${row.unit.partnerId}`) ?? [];
      const gtq = sumOf(cash, "GTQ");
      const usd = sumOf(cash, "USD");
      liveGtq += gtq.amount;
      liveUsd += usd.amount;
      liveUsdDebit += usd.debit;
      liveCount += cash.length;
    }
    vista.kpis.push({ label: "Quetzales publicados", value: money("GTQ", round2(liveGtq)), hint: `${count(liveCount)} recibos del libro en estos socios` });
    if (liveUsd !== 0) {
      vista.kpis.push({
        label: "Dólares publicados",
        value: money("USD", round2(liveUsd)),
        hint: `Asiento ${money("GTQ", round2(liveUsdDebit))}. No entra en los quetzales publicados.`,
      });
    }
  }
  vista.lineTitle = "Socios del plan. Cada nombre es su propio socio, aunque el apartamento se repita.";
  vista.lineHeaders = showLive
    ? ["Proyecto", "Torre", "Modelo", "Apto", "Socio", "Lectura", "Saldo", "Meses del archivo", "Último recibo del plan", "Último publicado", "Q publicado", "USD publicado", "Confianza", "DS-"]
    : ["Proyecto", "Torre", "Modelo", "Apto", "Socio", "Lectura", "Saldo", "Meses del archivo", "Último recibo del plan", "Confianza", "DS-"];
  const lines = rows.map((row) => {
    const cash = liveByPartner.get(`${row.unit.projectSlug}:${row.unit.partnerId}`) ?? [];
    const gtq = sumOf(cash, "GTQ");
    const usd = sumOf(cash, "USD");
    const lastLive = cash.reduce<string | null>((max, item) => (max === null || (item.moveDate && item.moveDate > max) ? item.moveDate : max), null);
    const base = [
      row.unit.projectName,
      row.unit.tower ?? "Sin torre",
      row.unit.modelo ?? "—",
      row.unit.apt ?? "—",
      row.unit.rawName,
      lectura(row.cut.balance, true, false),
      money("GTQ", row.cut.balance),
      row.unit.monthsBehind === null ? "—" : count(row.unit.monthsBehind),
      showDay(row.unit.lastReceiptOn),
    ];
    if (showLive) {
      base.push(showDay(lastLive), gtq.n ? money("GTQ", gtq.amount) : "—", usd.n ? money("USD", usd.amount) : "—");
    }
    base.push(row.unit.confidence ?? "—", isDs(row.unit.rawName) ? "DS-" : "No");
    return {
      id: `${row.unit.projectSlug}:${row.unit.partnerId}`,
      drillId: row.unit.projectSlug,
      values: base,
    };
  });
  const packed = cap(lines, lines.length);
  vista.lines = packed.lines;
  vista.listTotal = packed.listTotal;
  vista.compare = comparePlan(book, filters, range, aheadSide);
  return vista;
}

function comparePlan(book: Book, filters: CobrosFilters, range: DateWindow, aheadSide: boolean): { label: string; detail: string }[] {
  if (!filters.compareN && !filters.compareYear) return [];
  const windows: DateWindow[] = [];
  if (filters.compareN) windows.push(...previousWindows(range, filters.n));
  if (filters.compareYear) windows.push(yearAgoWindow(range));
  const { units, months } = planPopulation(book, filters);
  return windows.map((window) => {
    let total = 0;
    for (const unit of units) {
      if (!unit.hasPlan || unit.isDuplicate) continue;
      const cut = cutAt(months.get(`${unit.projectSlug}:${unit.partnerId}`), window.to);
      if (!cut) continue;
      total += aheadSide ? Math.max(-cut.balance, 0) : Math.max(cut.balance, 0);
    }
    return { label: window.label || windowLabel(window), detail: money("GTQ", round2(total)) };
  });
}

function decisionesVista(
  filters: CobrosFilters,
  book: Book,
  range: DateWindow,
  selected: Project[],
  choices: CobrosVista["choices"],
): CobrosVista {
  if (book.meta.cobroCount === 0) {
    const vista = blank("decisiones-desistimientos", range, book, selected, choices, [NOT_LOADED], NOT_LOADED);
    vista.empty = NOT_LOADED;
    return vista;
  }
  const notices = [
    "DS- es el marcador. No hay motivo, ni reembolso, ni fecha de la decisión. El gráfico de meses es la última edición del socio, en UTC.",
    ...baseNotices(book, selected, []),
  ];
  const partners = book.partners.filter((partner) => {
    if (!partner.ds) return false;
    if (!projectOk(partner.projectSlug, filters, book)) return false;
    if (filters.tower && (partner.tower ?? "") !== filters.tower) return false;
    if (filters.modelo && (partner.modelo ?? "") !== filters.modelo) return false;
    if (filters.marca === "vigente") return false;
    return true;
  });
  const periodRows = book.cobros.filter((row) => row.ds && receiptOk(row, filters, book, range));
  const bookRows = book.cobros.filter((row) => row.ds && receiptOk(row, { ...filters, marca: "ds" }, book, null));
  const vista = blank(
    "decisiones-desistimientos",
    range,
    book,
    selected,
    choices,
    notices,
    "El efectivo se queda en el socio marcado. El nombre nuevo del apartamento empieza en cero.",
  );
  if (filters.marca === "vigente") {
    vista.empty = "Esta vista es la marca DS-. El filtro Vigente la deja vacía.";
    return vista;
  }
  const gtq = sumOf(periodRows, "GTQ");
  const usd = sumOf(periodRows, "USD");
  const bookGtq = sumOf(bookRows, "GTQ");
  vista.kpis = [
    { label: "Quetzales en el periodo", value: money("GTQ", gtq.amount), hint: `${count(gtq.n)} recibos` },
    { label: "Dólares en el periodo", value: money("USD", usd.amount), hint: `${count(usd.n)} recibos` },
    { label: "Socios DS-", value: count(partners.length), hint: `En el libro, ${money("GTQ", bookGtq.amount)}` },
  ];
  const booked = bookedKpi(usd);
  if (booked && filters.moneda !== "GTQ") vista.kpis.splice(2, 0, booked);
  vista.gtqBars = projectBars(periodRows, "GTQ", selected);
  vista.usdBars = filters.moneda === "GTQ" ? [] : projectBars(periodRows, "USD", selected);
  vista.bookedBars = filters.moneda === "GTQ" ? [] : projectBookedBars(periodRows, selected);
  const byWrite = new Map<string, number>();
  for (const partner of partners) {
    if (!partner.writeOnUtc) continue;
    const key = partner.writeOnUtc.slice(0, 7);
    byWrite.set(key, (byWrite.get(key) ?? 0) + 1);
  }
  vista.gtqSeries = [{
    name: "Última edición, UTC",
    points: [...byWrite.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({ id: key, label: monthName(`${key}-01`), value })),
  }];
  const cash = new Map<string, Cobro[]>();
  for (const row of periodRows) {
    const key = `${row.projectSlug}:${row.partnerId ?? row.partnerName}`;
    const list = cash.get(key);
    if (list) list.push(row);
    else cash.set(key, [row]);
  }
  const bookCash = new Map<string, Cobro[]>();
  for (const row of bookRows) {
    const key = `${row.projectSlug}:${row.partnerId ?? row.partnerName}`;
    const list = bookCash.get(key);
    if (list) list.push(row);
    else bookCash.set(key, [row]);
  }
  const writeMonth = filters.drill && isMonthId(filters.drill) ? filters.drill : null;
  const projectDrill = filters.drill && !writeMonth ? filters.drill : null;
  const scoped = partners.filter((partner) => {
    if (projectDrill && partner.projectSlug !== projectDrill) return false;
    if (writeMonth && (partner.writeOnUtc ?? "").slice(0, 7) !== writeMonth) return false;
    return true;
  });
  const lines = scoped
    .map((partner) => {
      const key = `${partner.projectSlug}:${partner.partnerId}`;
      const period = cash.get(key) ?? [];
      const whole = bookCash.get(key) ?? [];
      const periodGtq = sumOf(period, "GTQ");
      const wholeGtq = sumOf(whole, "GTQ");
      const periodUsd = sumOf(period, "USD");
      return {
        sort: wholeGtq.amount,
        line: {
          id: key,
          drillId: partner.projectSlug,
          values: [
            partner.projectName,
            partner.name,
            familyOf(partner.prefixFamily),
            partner.tower ?? "Sin torre",
            partner.apt ?? "—",
            money("GTQ", periodGtq.amount),
            money("GTQ", wholeGtq.amount),
            periodUsd.n ? money("USD", periodUsd.amount) : "—",
            periodUsd.n ? money("GTQ", periodUsd.debit) : "—",
            showDay(whole.reduce<string | null>((min, row) => (min === null || (row.moveDate && row.moveDate < min) ? row.moveDate : min), null)),
            showDay(whole.reduce<string | null>((max, row) => (max === null || (row.moveDate && row.moveDate > max) ? row.moveDate : max), null)),
            showDay(partner.writeOnUtc),
          ],
        },
      };
    })
    .sort((a, b) => b.sort - a.sort);
  const packed = cap(lines.map((row) => row.line), lines.length);
  vista.lineTitle = "Socios marcados. El quetzal del libro es todo lo publicado, no solo el periodo.";
  vista.lineHeaders = ["Proyecto", "Socio", "Familia", "Torre", "Apto", "Q del periodo", "Q del libro", "USD del periodo", "Q del asiento", "Primer recibo", "Último recibo", "Última edición"];
  vista.lines = packed.lines;
  vista.listTotal = packed.listTotal;
  vista.compare = compareReceipts(book, { ...filters, marca: "ds" }, range);
  return vista;
}

function casoAmount(book: Book, row: Caso): string {
  if (!row.currency || row.amount == null) return "—";
  const main = money(row.currency, row.amount);
  if (row.currency !== "USD") return main;
  const debits = [
    ...book.cobros.filter((cobro) => cobro.currency === "USD" && cobro.partnerId === row.partnerId && cobro.moveDate === row.moveDate && cobro.amount === row.amount),
    ...book.fuera.filter((item) => item.currency === "USD" && item.partnerId === row.partnerId && item.moveDate === row.moveDate && item.amount === row.amount),
  ].map((item) => item.debitGtq).filter((value): value is number => value != null);
  const unique = [...new Set(debits.map((value) => value.toFixed(2)))];
  if (unique.length !== 1) return main;
  return `${main} · asiento ${money("GTQ", Number(unique[0]))}`;
}

function casosVista(
  filters: CobrosFilters,
  book: Book,
  range: DateWindow,
  selected: Project[],
  choices: CobrosVista["choices"],
): CobrosVista {
  const partnerById = new Map(book.partners.map((partner) => [partner.partnerId, partner]));
  const notices = [
    "No hay código de caso especial ni de Friends & Family. Las categorías 1, 2 y 5 no tienen nombre en el archivo y no se usan como marca.",
  ];
  if (selected.some((project) => !project.hasUnitBook)) notices.push(SIN_DATOS);
  const rows = book.casos.filter((caso) => {
    if (!projectOk(caso.projectSlug, filters, book) && caso.kind !== "cesion-proveedor") return false;
    if (caso.kind === "cesion-proveedor" && filters.projectSlugs !== null && !filters.projectSlugs.includes("boulevard-5") && filters.projectSlugs.length > 0) {
      return false;
    }
    const partner = caso.partnerId != null ? partnerById.get(caso.partnerId) : undefined;
    if (filters.tower && (partner?.tower ?? "") !== filters.tower) return false;
    if (filters.modelo && (partner?.modelo ?? "") !== filters.modelo) return false;
    const dated = caso.kind === "gv1-cero" || caso.kind === "sin-asignar" || caso.kind === "cesion-proveedor";
    if (dated && caso.moveDate && !inWindow(caso.moveDate, range)) return false;
    return true;
  });
  const vista = blank(
    "casos-especiales",
    range,
    book,
    selected,
    choices,
    notices,
    "Lista de revisión. No es una población medida.",
  );
  const byKind = new Map<string, number>();
  for (const row of rows) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + 1);
  vista.gtqBars = [...byKind.entries()].map(([kind, value]) => ({ id: kind, label: KIND[kind] ?? kind, value }));
  const scoped = filters.drill ? rows.filter((row) => row.kind === filters.drill) : rows;
  const lines = scoped.map((row, index) => ({
    id: `${row.kind}:${row.partnerId ?? index}:${row.moveDate ?? ""}`,
    drillId: row.kind,
    values: [
      KIND[row.kind] ?? row.kind,
      book.projects.find((project) => project.slug === row.projectSlug)?.name ?? "—",
      row.partnerName,
      showDay(row.moveDate),
      casoAmount(book, row),
      row.detail,
    ],
  }));
  const packed = cap(lines, lines.length);
  vista.lineTitle = "Qué revisar";
  vista.lineHeaders = ["Lista", "Proyecto", "Nombre", "Fecha", "Monto", "Por qué está aquí"];
  vista.lines = packed.lines;
  vista.listTotal = packed.listTotal;
  vista.kpis = vista.gtqBars.map((bar) => ({ label: bar.label, value: count(bar.value), hint: "Registros" }));
  return vista;
}
