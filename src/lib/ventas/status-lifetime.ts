import { createAdminClient } from "@/lib/supabase/admin";
import { PROJECT_DISPLAY_ORDER, projectKey } from "@/lib/projects";
import { guatemalaToday } from "./period";
import type { Choice, StatusBand, StatusPoint, StatusVista } from "./vista-types";

const PAGE = 1000;
const CAP = 20000;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const DISPLAY_NAME: Record<string, string> = {
  [projectKey("BOULEVARD 5")]: "Boulevard 5",
  [projectKey("BENESTARE")]: "Benestare",
  [projectKey("BOSQUE LAS TAPIAS")]: "Bosque Las Tapias",
  [projectKey("SANTA ELENA")]: "Santa Elena",
};

type Scope = {
  projectIds: string[] | null;
};

type Named = { id: string; name: string; sin: boolean };
type TowerDim = { id: string; projectId: string; name: string; sin: boolean };
type DealDim = { projectId: string; unitId: string };
type UnitDim = { towerId: string };
type Stock = { total: number; congelado: number; name: string };

const EMPTY_CHOICES: StatusVista["choices"] = {
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

function ventasDb() {
  return createAdminClient().schema("ventas");
}

type Db = ReturnType<typeof ventasDb>;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function addMonths(iso: string, months: number): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}

function shortMonth(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;
}

function earliestMonth(reservas: Map<string, number> | undefined, pcv: Map<string, number> | undefined): string | null {
  let earliest = "";
  for (const days of [reservas, pcv]) {
    if (!days) continue;
    for (const day of days.keys()) {
      if (day && (!earliest || day < earliest)) earliest = day;
    }
  }
  if (!earliest) return null;
  return `${earliest.slice(0, 7)}-01`;
}

function expectedAt(units: number, start: string, close: string, day: string): number {
  if (day <= start) return 0;
  if (day >= close) return units;
  const span = daysBetween(start, close);
  if (span <= 0) return units;
  return units * (daysBetween(start, day) / span);
}

function towerKey(name: string): string {
  const key = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const letter = key.match(/^torre\s+([a-e])$/);
  if (letter) return letter[1].toUpperCase();
  if (/^[a-e]$/.test(key)) return key.toUpperCase();
  if (key === "principal") return "PRINCIPAL";
  return key;
}

function hiddenTower(key: string): boolean {
  return key === "" || key === "sin dato" || key === "sin torre";
}

function towerTitle(name: string): string {
  const trimmed = name.trim();
  if (/^[A-E]$/i.test(trimmed)) return `Torre ${trimmed.toUpperCase()}`;
  return trimmed;
}

function displayName(name: string): string {
  return DISPLAY_NAME[projectKey(name)] ?? name;
}

function axisOf(day: string, start: string, close: string, today: string): string {
  if (day === close) return "cierre";
  if (day === today) return "hoy";
  if (day === start || day.slice(5, 10) === "01-01") return shortMonth(day);
  return "";
}

function monthStarts(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = `${from.slice(0, 7)}-01`;
  const end = `${to.slice(0, 7)}-01`;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return days;
}

function atCount(prefix: { day: string; n: number }[], day: string): number {
  let lo = 0;
  let hi = prefix.length - 1;
  let answer = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (prefix[mid].day <= day) {
      answer = prefix[mid].n;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return answer;
}

function prefixOf(days: Map<string, number> | undefined): { day: string; n: number }[] {
  if (!days) return [];
  let running = 0;
  return [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, count]) => {
      running += count;
      return { day, n: running };
    });
}

function bump(map: Map<string, Map<string, number>>, key: string, day: string): void {
  const days = map.get(key) ?? new Map<string, number>();
  days.set(day, (days.get(day) ?? 0) + 1);
  map.set(key, days);
}

function buildPoints(
  units: number,
  start: string,
  close: string,
  today: string,
  reservas: { day: string; n: number }[],
  pcv: { day: string; n: number }[],
): StatusPoint[] {
  const domainEnd = today > close ? today : close;
  const days = new Set<string>(monthStarts(start, domainEnd));
  days.add(start);
  days.add(close);
  if (today >= start && today <= domainEnd) days.add(today);
  const ordered = [...days].sort((a, b) => a.localeCompare(b));
  const points: StatusPoint[] = ordered.map((day) => {
    const future = day > today;
    return {
      day,
      reservas: future ? null : atCount(reservas, day),
      pcv: future ? null : atCount(pcv, day),
      esperado: round1(expectedAt(units, start, close, day)),
      labelReservas: false,
      labelPcv: false,
      labelEsperado: false,
      axisLabel: axisOf(day, start, close, today),
    };
  });
  let monthIndex = 0;
  for (const point of points) {
    const actual = point.day <= today;
    const monthPoint = point.day.endsWith("-01");
    if (actual && (point.day === start || point.day === today)) {
      point.labelReservas = true;
      point.labelPcv = true;
    }
    if (actual && monthPoint) {
      if (monthIndex % 6 === 0) {
        point.labelReservas = true;
        point.labelPcv = true;
      }
      monthIndex += 1;
    }
    if (point.day === start || point.day === close || point.day === today) point.labelEsperado = true;
  }
  return points;
}

function bandOf(input: {
  id: string;
  label: string;
  kind: "proyecto" | "torre";
  congelado: boolean;
  frozenDetail: string | null;
  units: number;
  start: string | null;
  close: string;
  today: string;
  reservas: { day: string; n: number }[];
  pcv: { day: string; n: number }[];
}): StatusBand {
  const reservas = atCount(input.reservas, input.today);
  const pcv = atCount(input.pcv, input.today);
  if (!input.start || !input.close) {
    return {
      id: input.id,
      label: input.label,
      kind: input.kind,
      congelado: input.congelado,
      frozenDetail: input.frozenDetail,
      units: input.units,
      reservas,
      pcv,
      esperado: 0,
      gap: round1(reservas - 0),
      startOn: "",
      closeOn: "",
      points: [{
        day: input.today,
        reservas,
        pcv,
        esperado: 0,
        labelReservas: true,
        labelPcv: true,
        labelEsperado: false,
        axisLabel: "hoy",
      }],
    };
  }
  const esperado = round1(expectedAt(input.units, input.start, input.close, input.today));
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    congelado: input.congelado,
    frozenDetail: input.frozenDetail,
    units: input.units,
    reservas,
    pcv,
    esperado,
    gap: round1(reservas - esperado),
    startOn: input.start,
    closeOn: input.close,
    points: buildPoints(input.units, input.start, input.close, input.today, input.reservas, input.pcv),
  };
}

function emptyVista(today: string, projects: Choice[], notice: string | null): StatusVista {
  return {
    section: "status-de-ventas",
    question: "Déficit o excedente contra el cierre temporal, por proyecto y por torre.",
    periodLabel: "Acumulado",
    rangeLabel: `al ${today.slice(8, 10)}.${today.slice(5, 7)}.${today.slice(0, 4)}`,
    caption: "",
    notice,
    projects,
    choices: EMPTY_CHOICES,
    lines: [],
    listShown: 0,
    listTotal: 0,
    asOf: today,
    byProject: [],
    byTower: [],
  };
}

async function readPages(
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<{ rows: Record<string, unknown>[]; capped: boolean }> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < CAP; offset += PAGE) {
    const { data, error } = await run(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, capped: false };
  }
  return { rows, capped: true };
}

async function loadProjects(client: Db): Promise<Named[]> {
  const { data, error } = await client.from("dim_project").select("id,name,is_sin_dato");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    sin: row.is_sin_dato === true,
  }));
}

function choicesOf(projects: Named[]): Choice[] {
  const byKey = new Map(projects.filter((project) => !project.sin).map((project) => [projectKey(project.name), project]));
  const choices: Choice[] = [];
  for (const name of PROJECT_DISPLAY_ORDER) {
    const match = byKey.get(projectKey(name));
    if (match) choices.push({ id: match.id, label: match.name });
  }
  return choices;
}

export async function buildStatusLifetime(filters: Scope): Promise<StatusVista> {
  const today = guatemalaToday();
  const client = ventasDb();
  const projects = await loadProjects(client);
  const choices = choicesOf(projects);
  if (filters.projectIds && filters.projectIds.length === 0) return emptyVista(today, choices, null);

  const byKey = new Map(projects.filter((project) => !project.sin).map((project) => [projectKey(project.name), project]));
  const selected = PROJECT_DISPLAY_ORDER.flatMap((name) => {
    const key = projectKey(name);
    const project = byKey.get(key);
    if (!project) return [];
    if (filters.projectIds && !filters.projectIds.includes(project.id)) return [];
    return [{ key, project, label: DISPLAY_NAME[key] ?? displayName(project.name) }];
  });
  if (selected.length === 0) return emptyVista(today, choices, null);

  const [reservasPage, pcvPage, towersPage, inventory] = await Promise.all([
    readPages((from, to) =>
      client.from("fact_comprobante").select("id,deal_id,comprobante_on").order("id").range(from, to),
    ),
    readPages((from, to) =>
      client.from("fact_pcv_issuance").select("id,deal_id,clock_on").order("id").range(from, to),
    ),
    readPages((from, to) =>
      client.from("dim_tower").select("id,project_id,name,is_sin_dato").order("id").range(from, to),
    ),
    loadStock(),
  ]);

  const dealIds = new Set<string>();
  for (const row of reservasPage.rows) {
    if (row.deal_id) dealIds.add(String(row.deal_id));
  }
  for (const row of pcvPage.rows) {
    if (row.deal_id) dealIds.add(String(row.deal_id));
  }
  const deals = new Map<string, DealDim>();
  const ids = [...dealIds];
  for (let index = 0; index < ids.length; index += 80) {
    const slice = ids.slice(index, index + 80);
    const { data, error } = await client.from("dim_deal").select("id,project_id,unit_id").in("id", slice);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const id = row.id == null ? "" : String(row.id);
      if (!id) continue;
      deals.set(id, {
        projectId: row.project_id == null ? "" : String(row.project_id),
        unitId: row.unit_id == null || row.unit_id === "" ? "" : String(row.unit_id),
      });
    }
  }

  const unitIds = [...new Set([...deals.values()].flatMap((deal) => (deal.unitId ? [deal.unitId] : [])))];
  const units = new Map<string, UnitDim>();
  for (let index = 0; index < unitIds.length; index += 80) {
    const slice = unitIds.slice(index, index + 80);
    const { data, error } = await client.from("dim_unit").select("id,tower_id").in("id", slice);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      if (row.id == null) continue;
      units.set(String(row.id), { towerId: row.tower_id == null ? "" : String(row.tower_id) });
    }
  }

  const towers = new Map<string, TowerDim>();
  for (const row of towersPage.rows) {
    const id = row.id == null ? "" : String(row.id);
    if (!id) continue;
    towers.set(id, {
      id,
      projectId: row.project_id == null ? "" : String(row.project_id),
      name: String(row.name ?? ""),
      sin: row.is_sin_dato === true,
    });
  }

  const allowed = new Set(selected.map((project) => project.project.id));
  const reservaDays = new Map<string, Map<string, number>>();
  const pcvDays = new Map<string, Map<string, number>>();
  const reservaTower = new Map<string, Map<string, number>>();
  const pcvTower = new Map<string, Map<string, number>>();

  const earliestComprobante = new Map<string, string>();
  for (const row of reservasPage.rows) {
    const dealId = row.deal_id == null ? "" : String(row.deal_id);
    const day = typeof row.comprobante_on === "string" ? row.comprobante_on.slice(0, 10) : "";
    if (!dealId || !day) continue;
    const known = earliestComprobante.get(dealId);
    if (!known || day < known) earliestComprobante.set(dealId, day);
  }

  function place(
    row: Record<string, unknown>,
    day: string,
    projectMap: Map<string, Map<string, number>>,
    towerMap: Map<string, Map<string, number>>,
  ): void {
    const dealId = row.deal_id == null ? "" : String(row.deal_id);
    if (!day || !dealId) return;
    const deal = deals.get(dealId);
    if (!deal || !allowed.has(deal.projectId)) return;
    bump(projectMap, deal.projectId, day);
    const tower = deal.unitId ? towers.get(units.get(deal.unitId)?.towerId ?? "") : undefined;
    if (!tower || tower.sin || tower.projectId !== deal.projectId) return;
    const key = towerKey(tower.name);
    if (hiddenTower(key)) return;
    bump(towerMap, `${deal.projectId}|${key}`, day);
  }

  for (const row of reservasPage.rows) {
    const day = typeof row.comprobante_on === "string" ? row.comprobante_on.slice(0, 10) : "";
    place(row, day, reservaDays, reservaTower);
  }
  for (const row of pcvPage.rows) {
    const dealId = row.deal_id == null ? "" : String(row.deal_id);
    const reservaOn = dealId ? earliestComprobante.get(dealId) : undefined;
    if (!reservaOn) continue;
    const clock = typeof row.clock_on === "string" ? row.clock_on.slice(0, 10) : "";
    if (!clock) continue;
    place(row, clock > reservaOn ? clock : reservaOn, pcvDays, pcvTower);
  }

  const byProject: StatusBand[] = selected.map((project) => {
    const reservas = prefixOf(reservaDays.get(project.project.id));
    const pcv = prefixOf(pcvDays.get(project.project.id));
    const start = earliestMonth(reservaDays.get(project.project.id), pcvDays.get(project.project.id));
    return bandOf({
      id: project.project.id,
      label: project.label,
      kind: "proyecto",
      congelado: false,
      frozenDetail: null,
      units: inventory.projects.get(project.key) ?? 0,
      start,
      close: start ? addMonths(start, 24) : "",
      today,
      reservas,
      pcv,
    });
  });

  const byTower: StatusBand[] = [];
  for (const project of selected) {
    const start = earliestMonth(reservaDays.get(project.project.id), pcvDays.get(project.project.id));
    const close = start ? addMonths(start, 24) : "";
    const towersOfProject = inventory.towers.get(project.key);
    if (!towersOfProject) continue;
    const rows = [...towersOfProject.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, "es"));
    for (const [key, tower] of rows) {
      if (hiddenTower(key) || tower.total <= 0) continue;
      const frozen = project.key === projectKey("BOSQUE LAS TAPIAS") && key === "B";
      const fullyFrozen = tower.total > 0 && tower.congelado === tower.total;
      const congelado = frozen || fullyFrozen;
      byTower.push(
        bandOf({
          id: `${project.project.id}|${key}`,
          label: `${project.label} · ${towerTitle(tower.name)}`,
          kind: "torre",
          congelado,
          frozenDetail: congelado
            ? frozen
              ? "Congelada. No está en venta normal. Lo que aparece vendido son excepciones F&F."
              : "Todas las unidades de esta torre están congeladas."
            : null,
          units: tower.total,
          start,
          close,
          today,
          reservas: prefixOf(reservaTower.get(`${project.project.id}|${key}`)),
          pcv: prefixOf(pcvTower.get(`${project.project.id}|${key}`)),
        }),
      );
    }
  }

  const notes: string[] = [];
  if (reservasPage.capped) notes.push("La lectura de reservas se detuvo en 20000 filas.");
  if (pcvPage.capped) notes.push("La lectura de PCV se detuvo en 20000 filas.");
  const body = emptyVista(today, choices, notes.length > 0 ? notes.join(" ") : null);
  body.byProject = byProject;
  body.byTower = byTower;
  return body;
}

async function loadStock(): Promise<{ projects: Map<string, number>; towers: Map<string, Map<string, Stock>> }> {
  const client = createAdminClient();
  const projects = new Map<string, number>();
  const towers = new Map<string, Map<string, Stock>>();
  for (let offset = 0; offset < CAP; offset += PAGE) {
    const { data, error } = await client
      .from("v_rv_units_full")
      .select("project_slug,status,tower_name")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of batch) {
      const slug = String(row.project_slug ?? "");
      const key = slug === "boulevard-5"
        ? projectKey("BOULEVARD 5")
        : slug === "benestare"
          ? projectKey("BENESTARE")
          : slug === "bosque-las-tapias"
            ? projectKey("BOSQUE LAS TAPIAS")
            : slug === "santa-elena"
              ? projectKey("SANTA ELENA")
              : "";
      if (!key) continue;
      projects.set(key, (projects.get(key) ?? 0) + 1);
      const name = String(row.tower_name ?? "");
      const token = towerKey(name);
      if (hiddenTower(token)) continue;
      const group = towers.get(key) ?? new Map<string, Stock>();
      const current = group.get(token) ?? { total: 0, congelado: 0, name };
      current.total += 1;
      if (String(row.status ?? "") === "FROZEN") current.congelado += 1;
      if (name.trim().length > current.name.trim().length) current.name = name;
      group.set(token, current);
      towers.set(key, group);
    }
    if (batch.length < PAGE) return { projects, towers };
  }
  throw new Error("v_rv_units_full excedió el límite de lectura.");
}
