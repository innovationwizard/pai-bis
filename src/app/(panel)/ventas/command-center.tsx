"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type BlockerRow,
  type Choice,
  type DescuentoVista,
  type FunnelStage,
  type PrecioVista,
  type ReferidosVista,
  type SaleLine,
  type StageDeal,
  type StatusRow,
  type ValorVista,
  type VentasVista,
  type VistaSection,
} from "@/lib/ventas/vista-types";
import { ProjectPillRow } from "@/components/project-pill-row";
import { compareProjectLabels, isDisplayProject, projectPillOptions, sortByProjectLabel } from "@/lib/projects";
import { AsesoresBlock, ReservasMetaBlock, StatusAsesorBlock, StatusCierreChart, StatusProyectoBlock, VentasTotalesBlock } from "./landing-blocks";

const NAVY = "#0d2041";
const BLUE = "#0573b0";
const RED = "#b91c1c";
const AMBER = "#b45309";
const GRID = "#e2e8f0";
const CHART_CAP = 12;

function displayProjects<T extends { label: string }>(rows: readonly T[]): T[] {
  return sortByProjectLabel(rows.filter((row) => isDisplayProject(row.label)));
}

const SECTIONS: VistaSection[] = [
  "ventas-totales",
  "objetivos-de-ventas",
  "status-de-ventas",
  "inventario-general",
  "ventas-por-canales",
  "analisis-de-inventario",
  "valor-del-proyecto",
  "desistimientos",
  "descuentos",
  "subidas-de-precios",
  "ff-y-casos-especiales",
  "promociones",
  "control-referidos",
];

type BarState = {
  periodo: string;
  desde: string;
  hasta: string;
  proyectos: string[] | null;
  asesor: string;
  torre: string;
};

const INITIAL: BarState = {
  periodo: "este-mes",
  desde: "",
  hasta: "",
  proyectos: null,
  asesor: "",
  torre: "",
};

type Focus =
  | { kind: "proyecto"; id: string; label: string }
  | { kind: "asesor"; id: string; label: string }
  | { kind: "fuente"; id: string; label: string }
  | { kind: "torre"; projectId: string; tower: string; label: string }
  | { kind: "etapa"; id: FunnelStage["id"]; label: string };

type SortKey = "unit" | "who" | "stage" | "missing" | "days" | "gtq";

const moneyFormat = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 });
const dollarFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 });

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return moneyFormat.format(value);
}

function dollars(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return dollarFormat.format(value);
}

function count(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return countFormat.format(value);
}

function signed(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Sin meta";
  const text = count(value);
  return value > 0 ? `+${text}` : text;
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const n = value * 100;
  const digits = Math.abs(n) >= 10 || n === 0 ? 0 : 1;
  return `${new Intl.NumberFormat("es-GT", { maximumFractionDigits: digits }).format(n)}%`;
}

function dotted(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function dottedSpan(label: string): string {
  return label.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => dotted(iso));
}

function stampDate(label: string): string {
  return label.replace(/\s+\d{2}:\d{2}\s*$/u, "");
}

function tipNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function labelStack(value: unknown): string {
  const n = tipNumber(value);
  if (n == null || n === 0) return "";
  return count(n);
}

function labelMoney(value: unknown): string {
  const n = tipNumber(value);
  if (n == null) return "";
  return money(n);
}

function labelDollars(value: unknown): string {
  const n = tipNumber(value);
  if (n == null) return "";
  return dollars(n);
}

function labelSigned(value: unknown): string {
  const n = tipNumber(value);
  if (n == null) return "";
  return signed(n);
}

function clip(label: string, max = 22): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

function gapFill(value: number): string {
  if (value < 0) return RED;
  if (value > 0) return BLUE;
  return NAVY;
}

function payloadOf(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  const record = input as { payload?: unknown };
  const source = record.payload && typeof record.payload === "object" ? record.payload : input;
  return source as Record<string, unknown>;
}

function readRow(input: unknown): { id: string; label: string } | null {
  const row = payloadOf(input);
  if (!row || typeof row.id !== "string" || typeof row.label !== "string") return null;
  return { id: row.id, label: row.label };
}

function readTower(input: unknown): { projectId: string; tower: string; label: string } | null {
  const row = payloadOf(input);
  if (!row || typeof row.id !== "string" || typeof row.tower !== "string" || typeof row.label !== "string") return null;
  return { projectId: row.id, tower: row.tower, label: row.label };
}

function isStageId(value: string): value is FunnelStage["id"] {
  return value === "reservas" || value === "promesas" || value === "recibos" || value === "netas";
}

function sameFocus(current: Focus | null, next: Focus): boolean {
  if (!current || current.kind !== next.kind) return false;
  if (current.kind === "torre" && next.kind === "torre") {
    return current.projectId === next.projectId && current.tower === next.tower;
  }
  if (current.kind === "etapa" && next.kind === "etapa") return current.id === next.id;
  if (current.kind === "proyecto" && next.kind === "proyecto") return current.id === next.id;
  if (current.kind === "asesor" && next.kind === "asesor") return current.id === next.id;
  if (current.kind === "fuente" && next.kind === "fuente") return current.id === next.id;
  return false;
}

function focusText(focus: Focus): string {
  if (focus.kind === "proyecto") return `Proyecto: ${focus.label}`;
  if (focus.kind === "asesor") return `Asesor: ${focus.label}`;
  if (focus.kind === "fuente") return `Canal: ${focus.label}`;
  if (focus.kind === "torre") return `Torre: ${focus.label}`;
  return `Etapa: ${focus.label}`;
}

function withCurrent(options: Choice[], id: string): Choice[] {
  if (!id || options.some((option) => option.id === id)) return options;
  return [{ id, label: "Filtro activo" }, ...options];
}

function mergeChoices(lists: Choice[][]): Choice[] {
  const map = new Map<string, string>();
  for (const list of lists) {
    for (const item of list) if (!map.has(item.id)) map.set(item.id, item.label);
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function vistaOf<S extends VistaSection>(
  vistas: Partial<Record<VistaSection, VentasVista>>,
  section: S,
): Extract<VentasVista, { section: S }> | null {
  const vista = vistas[section];
  if (!vista || vista.section !== section) return null;
  return vista as Extract<VentasVista, { section: S }>;
}

function unitsFromNetas(funnel: FunnelStage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const stage of funnel) {
    for (const deal of [...stage.deals, ...stage.entered]) {
      const prefix = deal.key.startsWith("entra-neta:") ? "entra-neta:" : deal.key.startsWith("neta:") ? "neta:" : null;
      if (!prefix) continue;
      map.set(deal.key.slice(prefix.length), deal.unit);
    }
  }
  return map;
}

function lineMatches(line: SaleLine, focus: Focus | null): boolean {
  if (!focus || focus.kind === "etapa") return true;
  if (focus.kind === "proyecto") return line.projectId === focus.id;
  if (focus.kind === "asesor") return line.asesorId === focus.id;
  if (focus.kind === "fuente") return line.fuenteId === focus.id;
  return line.projectId === focus.projectId && line.torre === focus.tower;
}

function blockerMatches(row: BlockerRow, focus: Focus | null, projectName: string | null): boolean {
  if (!focus || focus.kind === "etapa" || focus.kind === "fuente") return true;
  if (focus.kind === "proyecto") return row.project === focus.label;
  if (focus.kind === "asesor") return row.asesor === focus.label;
  if (!projectName) return true;
  return row.project === projectName;
}

function capRows<T>(rows: T[], limit: number): { rows: T[]; hidden: number } {
  if (rows.length <= limit) return { rows, hidden: 0 };
  return { rows: rows.slice(0, limit), hidden: rows.length - limit };
}

function buildParams(bar: BarState): URLSearchParams {
  const params = new URLSearchParams({ periodo: bar.periodo });
  if (bar.periodo === "custom" && bar.desde && bar.hasta) {
    params.set("desde", bar.desde);
    params.set("hasta", bar.hasta);
  }
  if (bar.proyectos === null) {
    /* Todos los proyectos. */
  } else if (bar.proyectos.length === 0) {
    params.append("proyecto", "ninguno");
  } else {
    for (const id of bar.proyectos) params.append("proyecto", id);
  }
  if (bar.asesor) params.set("asesor", bar.asesor);
  if (bar.torre) params.set("torre", bar.torre);
  return params;
}

async function readVista(response: Response, section: VistaSection): Promise<VentasVista> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("No se pudo leer Ventas");
  }
  const record = body && typeof body === "object" ? body as { error?: unknown; section?: unknown } : {};
  if (!response.ok) {
    throw new Error(typeof record.error === "string" ? record.error : "No se pudo leer Ventas");
  }
  if (record.section !== section) throw new Error("La respuesta no corresponde a la vista.");
  return body as VentasVista;
}

function ChartFrame({ height, children }: { height: number; children: ReactElement }) {
  return (
    <div className="vc-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function tipPair(value: unknown, name: unknown): [string, string] {
  if (value == null) return ["Sin meta", String(name ?? "")];
  return [count(tipNumber(value)), String(name ?? "")];
}

function moneyTip(value: unknown, name: unknown): [string, string] {
  if (value == null) return ["Sin monto", String(name ?? "")];
  return [money(tipNumber(value)), String(name ?? "")];
}

export default function CommandCenter() {
  const [bar, setBar] = useState<BarState>(INITIAL);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [vistas, setVistas] = useState<Partial<Record<VistaSection, VentasVista>>>({});
  const [errors, setErrors] = useState<Partial<Record<VistaSection, string>>>({});
  const [busy, setBusy] = useState<VistaSection[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setVistas({});
    setErrors({});
    setBusy(SECTIONS);
    const params = buildParams(bar);
    for (const section of SECTIONS) {
      const query = new URLSearchParams(params);
      query.set("section", section);
      fetch(`/api/ventas/vista?${query.toString()}`, { signal: controller.signal })
        .then((response) => readVista(response, section))
        .then((body) => {
          if (cancelled) return;
          setVistas((current) => ({ ...current, [section]: body }));
          setErrors((current) => {
            if (!current[section]) return current;
            const next = { ...current };
            delete next[section];
            return next;
          });
          setBusy((current) => current.filter((item) => item !== section));
        })
        .catch((reason: unknown) => {
          if (cancelled || (reason instanceof DOMException && reason.name === "AbortError")) return;
          setErrors((current) => ({
            ...current,
            [section]: reason instanceof Error ? reason.message : "No se pudo leer Ventas",
          }));
          setBusy((current) => current.filter((item) => item !== section));
        });
    }
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [bar]);

  useEffect(() => {
    if (!focus) return;
    document.getElementById("vc-detalle")?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  function update(patch: Partial<BarState>) {
    setFocus(null);
    setBar((current) => ({ ...current, ...patch }));
  }

  function selectAllProjects() {
    setFocus(null);
    setBar((current) => ({ ...current, proyectos: null }));
  }

  function toggleProject(id: string) {
    if (!id) return;
    setFocus(null);
    setBar((current) => {
      const known = new Set(projectIds);
      const selected = current.proyectos === null ? projectIds : current.proyectos;
      const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
      const coversAll = projectIds.length > 0 && projectIds.every((item) => next.includes(item));
      const onlyKnown = next.every((item) => known.has(item));
      if (coversAll && onlyKnown) return { ...current, proyectos: null };
      return { ...current, proyectos: next };
    });
  }

  function toggleFocus(next: Focus) {
    setFocus((current) => (sameFocus(current, next) ? null : next));
  }

  const totales = vistaOf(vistas, "ventas-totales");
  const objetivos = vistaOf(vistas, "objetivos-de-ventas");
  const status = vistaOf(vistas, "status-de-ventas");
  const inventario = vistaOf(vistas, "inventario-general");

  const loadedProjects = useMemo(
    () => sortByProjectLabel(mergeChoices([totales?.projects ?? [], objetivos?.projects ?? [], inventario?.projects ?? []])),
    [totales, objetivos, inventario],
  );
  const [projects, setProjects] = useState<Choice[]>([]);
  useEffect(() => {
    if (loadedProjects.length > 0) setProjects(loadedProjects);
  }, [loadedProjects]);
  const projectOptions = useMemo(() => projectPillOptions(projects), [projects]);
  const projectIds = useMemo(
    () => projectOptions.map((option) => option.id).filter((id) => id !== ""),
    [projectOptions],
  );
  const asesores = useMemo(
    () => mergeChoices([totales?.choices.asesor ?? [], objetivos?.choices.asesor ?? [], status?.choices.asesor ?? []]),
    [totales, objetivos, status],
  );
  const torres = useMemo(
    () => mergeChoices([totales?.choices.torre ?? [], inventario?.choices.torre ?? []]),
    [totales, inventario],
  );
  const projectName = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) map.set(project.id, project.label);
    return map;
  }, [projects]);

  return (
    <div className="vc-command">
      <header className="vc-head cc-filter-battery">
        <ProjectPillRow
          options={projectOptions}
          selectedIds={bar.proyectos}
          onSelectAll={selectAllProjects}
          onToggle={toggleProject}
        />
        <div className="op-toolbar">
          <label>
            Periodo
            <select value={bar.periodo} onChange={(event) => update({ periodo: event.target.value })}>
              <option value="este-mes">Este mes</option>
              <option value="mes-anterior">Mes anterior</option>
              <option value="este-trimestre">Este trimestre</option>
              <option value="este-ano">Este año</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          {bar.periodo === "custom" ? (
            <>
              <label>
                Desde
                <input type="date" value={bar.desde} onChange={(event) => update({ desde: event.target.value })} />
              </label>
              <label>
                Hasta
                <input type="date" value={bar.hasta} onChange={(event) => update({ hasta: event.target.value })} />
              </label>
            </>
          ) : null}
          <label>
            Asesor
            <select value={bar.asesor} onChange={(event) => update({ asesor: event.target.value })}>
              <option value="">Todos</option>
              {withCurrent(asesores, bar.asesor).map((choice) => (
                <option key={choice.id} value={choice.id}>{choice.label}</option>
              ))}
            </select>
          </label>
          <label>
            Torre
            <select value={bar.torre} onChange={(event) => update({ torre: event.target.value })}>
              <option value="">Todas</option>
              {withCurrent(torres, bar.torre).map((choice) => (
                <option key={choice.id} value={choice.id}>{choice.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="op-text" onClick={() => { setFocus(null); setBar(INITIAL); }}>
            Restablecer
          </button>
          <p className="op-range">
            {totales ? `${totales.periodLabel}: ${dottedSpan(totales.rangeLabel)}.` : ""}
            {totales ? (
              <span className="op-fresh" data-stale={totales.freshness.stale ? "true" : "false"}>
                {stampDate(totales.freshness.label)}
              </span>
            ) : errors["ventas-totales"] ? (
              <span className="op-fresh">No se pudo leer el último dato cargado.</span>
            ) : (
              <span className="op-fresh">Cargando…</span>
            )}
          </p>
        </div>
        {totales?.freshness.note ? <p className="op-note op-warn">{totales.freshness.note}</p> : null}
        <hr className="op-filter-rule" />
      </header>

      <VentasTotalesBlock
        key={`${bar.periodo}|${bar.desde}|${bar.hasta}|${bar.proyectos === null ? "todos" : bar.proyectos.join(",")}|${bar.asesor}|${bar.torre}`}
        totales={totales}
        objetivos={objetivos}
        totalesError={errors["ventas-totales"] ?? null}
        objetivosError={errors["objetivos-de-ventas"] ?? null}
      />
      <hr className="op-filter-rule vc-band-rule" />
      <ReservasMetaBlock
        objetivos={objetivos}
        objetivosError={errors["objetivos-de-ventas"] ?? null}
      />
      <AsesoresBlock
        totales={totales}
        objetivos={objetivos}
        objetivosError={errors["objetivos-de-ventas"] ?? null}
      />
      <hr className="op-filter-rule vc-band-rule" />

      <section aria-label="Status contra la fecha de cierre">
        <article className="vc-card">
          <StatusCierreChart
            vista={status}
            pending={<StatusLine section="status-de-ventas" errors={errors} busy={busy} />}
          />
          {status ? (
            <>
              {status.notice ? <p className="op-note">{status.notice}</p> : null}
              {totales?.targetNote ? <p className="op-note">{totales.targetNote}</p> : null}
              <StatusProyectoBlock status={status} />
              <StatusAsesorBlock status={status} totales={totales} />
            </>
          ) : null}
        </article>
      </section>
      <hr className="op-filter-rule vc-band-rule" />

      <section aria-label="Tasa de conversión">
        <article className="vc-card">
          <h2>Tasa de conversión</h2>
          {/* <p className="vc-sub">
            Reservas, promesas firmadas, recibos publicados y ventas netas. El porcentaje compara cada etapa con la anterior. Si pasa de 100 %, entraron tratos que no venían de esa etapa.
          </p> */}
          {totales ? <FunnelChart funnel={totales.funnel} onStage={(id, label) => toggleFocus({ kind: "etapa", id, label })} /> : <StatusLine section="ventas-totales" errors={errors} busy={busy} />}
        </article>
      </section>
      <hr className="op-filter-rule vc-band-rule" />

      <section aria-label="Inventario">
        <div className="vc-grid-2">
          <article className="vc-card">
            <h2>Inventario general por proyecto</h2>
            {inventario ? (
              <>
                {/* {inventario.caption ? <p className="vc-sub">{inventario.caption}</p> : null} */}
                {/* Restore if requested: “N unidades están en otro estado.”
                {inventario.notice?.includes("otro estado") ? <p className="op-note">{inventario.notice}</p> : null}
                */}
                {inventario.notice && !inventario.notice.includes("otro estado") ? <p className="op-note">{inventario.notice}</p> : null}
                {bar.asesor ? <p className="op-note">El inventario no se parte por asesor.</p> : null}
                <StackChart
                  rows={displayProjects(inventario.byProject)}
                  onPick={(id, label) => toggleFocus({ kind: "proyecto", id, label })}
                />
              </>
            ) : (
              <StatusLine section="inventario-general" errors={errors} busy={busy} />
            )}
          </article>
          <article className="vc-card">
            <h2>Inventario general por torre</h2>
            {inventario ? (
              <StackChart
                rows={[...inventario.byTower]
                  .filter((row) => {
                    const label = inventario.byProject.find((project) => project.id === row.projectId)?.label
                      ?? projectName.get(row.projectId)
                      ?? "";
                    return isDisplayProject(label);
                  })
                  .sort((a, b) => {
                    const byProject = compareProjectLabels(
                      projectName.get(a.projectId) ?? "",
                      projectName.get(b.projectId) ?? "",
                    );
                    if (byProject !== 0) return byProject;
                    return a.tower.localeCompare(b.tower, "es");
                  })
                  .map((row) => ({
                    id: row.projectId,
                    label: `${projectName.get(row.projectId) ?? "Proyecto"} · ${row.tower}`,
                    tower: row.tower,
                    vendido: row.vendido,
                    congelado: row.congelado,
                    disponible: row.disponible,
                  }))}
                onTower={(projectId, tower, label) => toggleFocus({ kind: "torre", projectId, tower, label })}
              />
            ) : (
              <StatusLine section="inventario-general" errors={errors} busy={busy} />
            )}
          </article>
        </div>
      </section>
      <hr className="op-filter-rule vc-band-rule" />

      <section className="vc-grid-2" aria-label="Brechas contra el ritmo">
        <article className="vc-card">
          <h2>Brecha contra el ritmo por proyecto</h2>
          {/* <p className="vc-sub">Real menos ritmo a la fecha de cierre. Rojo: déficit. Azul: excedente.</p> */}
          {status ? (
            <GapBars
              rows={displayProjects(status.byProject)}
              onPick={(id, label) => toggleFocus({ kind: "proyecto", id, label })}
            />
          ) : (
            <StatusLine section="status-de-ventas" errors={errors} busy={busy} />
          )}
        </article>
        <article className="vc-card">
          <h2>Brecha contra el ritmo por asesor</h2>
          {status ? (
            <GapBars
              rows={capRows(status.byAsesor, CHART_CAP).rows}
              hidden={capRows(status.byAsesor, CHART_CAP).hidden}
              hiddenText="asesores"
              onPick={(id, label) => toggleFocus({ kind: "asesor", id, label })}
            />
          ) : (
            <StatusLine section="status-de-ventas" errors={errors} busy={busy} />
          )}
        </article>
      </section>
      <hr className="op-filter-rule vc-band-rule" />

      <section className="vc-grid-2" aria-label="Canales y modelos">
        <article className="vc-card">
          <h2>Ventas por canales</h2>
          <CanalesPanel vistas={vistas} errors={errors} busy={busy} onFuente={(id, label) => toggleFocus({ kind: "fuente", id, label })} />
        </article>
        <article className="vc-card">
          <h2>Ventas por modelo</h2>
          <ModeloPanel vistas={vistas} errors={errors} busy={busy} />
        </article>
      </section>
      <hr className="op-filter-rule vc-band-rule" />

      <ValorBand vistas={vistas} errors={errors} busy={busy} />
      <hr className="op-filter-rule vc-band-rule" />
      <DesistenciasPanel vistas={vistas} errors={errors} busy={busy} onProject={(id, label) => toggleFocus({ kind: "proyecto", id, label })} />
      <hr className="op-filter-rule vc-band-rule" />
      <ControlesPanel vistas={vistas} errors={errors} busy={busy} />
      <hr className="op-filter-rule vc-band-rule" />
      <ReferidosBand vistas={vistas} errors={errors} busy={busy} />
      <hr className="op-filter-rule vc-band-rule" />

      <section id="vc-detalle" className="vc-card" aria-label="Detalle operativo">
        <h2>Tratos que todavía no son venta</h2>
        <p className="vc-sub">Tienen reserva, promesa o recibo en el periodo y no cierran las dos puertas. La columna Falta es la puerta que no está.</p>
        {focus ? (
          <p className="vc-chip">
            {focusText(focus)}
            <button type="button" onClick={() => setFocus(null)}>Quitar filtro</button>
          </p>
        ) : null}
        {focus?.kind === "fuente" ? <p className="op-note">El canal filtra el detalle de ventas. Los tratos sin venta no traen canal.</p> : null}
        {focus?.kind === "etapa" ? <p className="op-note">La etapa muestra los tratos de esa barra. La lista de faltantes no cambia: ya son tratos sin las dos puertas.</p> : null}
        {focus?.kind === "torre" ? <p className="op-note">La torre filtra el detalle de ventas. Los tratos sin venta quedan en el proyecto de esa torre.</p> : null}
        {totales ? (
          <>
            {totales.blockerTotal > totales.blockers.length ? (
              <p className="op-note">
                Se muestran {totales.blockers.length} de {totales.blockerTotal}.
                {focus ? " El filtro corre sobre esas filas." : ""}
              </p>
            ) : null}
            <Blockers
              rows={totales.blockers.filter((row) => isDisplayProject(row.project) && blockerMatches(row, focus, focus?.kind === "torre" ? projectName.get(focus.projectId) ?? null : null))}
            />
            <h2>Detalle de ventas</h2>
            <p className="vc-sub">Cliente no está en la vista de ventas. Unidad aparece cuando el trato está en la etapa de venta neta.</p>
            {focus?.kind === "etapa" ? (
              <StageDetail stage={totales.funnel.find((item) => item.id === focus.id) ?? null} />
            ) : (
              <SalesTable
                lines={totales.lines.filter((line) => isDisplayProject(line.project) && lineMatches(line, focus))}
                shown={totales.listShown}
                total={totales.listTotal}
                filtered={focus != null}
                units={unitsFromNetas(totales.funnel)}
              />
            )}
          </>
        ) : (
          <StatusLine section="ventas-totales" errors={errors} busy={busy} />
        )}
      </section>
    </div>
  );
}

function StatusLine({
  section,
  errors,
  busy,
}: {
  section: VistaSection;
  errors: Partial<Record<VistaSection, string>>;
  busy: VistaSection[];
}) {
  if (errors[section]) return <p className="op-note op-warn">{errors[section]}</p>;
  if (busy.includes(section) || busy.length === 0) return <p className="op-note">Cargando…</p>;
  return <p className="op-note">Cargando…</p>;
}

function FunnelChart({ funnel, onStage }: { funnel: FunnelStage[]; onStage: (id: FunnelStage["id"], label: string) => void }) {
  const data = funnel.map((stage) => ({
    id: stage.id,
    label: stage.label,
    count: stage.count,
    mark: stage.conversion == null ? count(stage.count) : `${count(stage.count)} · ${pct(stage.conversion)}`,
  }));
  if (data.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <>
      <ChartFrame height={220}>
        <BarChart layout="vertical" data={data} margin={{ left: 8, right: 72, top: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12, fill: NAVY }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value, name) => tipPair(value, name)} />
          <Bar
            dataKey="count"
            name="Volumen"
            fill={NAVY}
            barSize={16}
            isAnimationActive={false}
            cursor="pointer"
            onClick={(row) => {
              const hit = readRow(row);
              if (hit && isStageId(hit.id)) onStage(hit.id, hit.label);
            }}
          >
            <LabelList dataKey="mark" position="right" fill="#334155" fontSize={11} />
          </Bar>
        </BarChart>
      </ChartFrame>
      {/* <p className="vc-sub">
        {funnel.map((stage) => `${stage.label}: ${stage.source}, ${stage.grain}`).join(" · ")}
      </p> */}
    </>
  );
}

function GapBars({
  rows,
  hidden = 0,
  hiddenText = "filas",
  onPick,
}: {
  rows: StatusRow[];
  hidden?: number;
  hiddenText?: string;
  onPick: (id: string, label: string) => void;
}) {
  const plotted = rows.filter((row): row is StatusRow & { gapUnits: number } => row.gapUnits != null);
  const withoutMeta = rows.length - plotted.length;
  if (plotted.length === 0) return <p className="op-note">Sin meta para esta barra.</p>;
  const data = plotted.map((row) => ({ id: row.id, label: row.label, gap: row.gapUnits }));
  return (
    <>
      <ChartFrame height={Math.max(220, data.length * 32 + 36)}>
        <BarChart layout="vertical" data={data} margin={{ left: 8, right: 48, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={140} tickFormatter={(value) => clip(String(value))} tick={{ fontSize: 11, fill: NAVY }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value, name) => [signed(tipNumber(value)), String(name ?? "")]} />
          <Bar dataKey="gap" name="Real menos ritmo" isAnimationActive={false} cursor="pointer" onClick={(row) => {
            const hit = readRow(row);
            if (hit) onPick(hit.id, hit.label);
          }}>
            {data.map((row) => <Cell key={row.id} fill={gapFill(row.gap)} />)}
            <LabelList dataKey="gap" position="right" formatter={labelSigned} fill="#334155" fontSize={11} />
          </Bar>
        </BarChart>
      </ChartFrame>
      {withoutMeta > 0 ? <p className="op-note">{withoutMeta} sin meta, fuera de la barra.</p> : null}
      {hidden > 0 ? <p className="op-note">{data.length} de {data.length + hidden} {hiddenText}.</p> : null}
    </>
  );
}

function StackChart({
  rows,
  onPick,
  onTower,
}: {
  rows: { id: string; label: string; tower?: string; vendido: number; congelado: number; disponible: number }[];
  onPick?: (id: string, label: string) => void;
  onTower?: (projectId: string, tower: string, label: string) => void;
}) {
  if (rows.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  function pick(row: unknown) {
    if (onTower) {
      const tower = readTower(row);
      if (tower) onTower(tower.projectId, tower.tower, tower.label);
      return;
    }
    const hit = readRow(row);
    if (hit && onPick) onPick(hit.id, hit.label);
  }
  return (
    <ChartFrame height={Math.max(220, rows.length * 32 + 48)}>
      <BarChart layout="vertical" data={rows} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={160} tickFormatter={(value) => clip(String(value), 28)} tick={{ fontSize: 11, fill: NAVY }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value, name) => tipPair(value, name)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="disponible" name="Disponible" stackId="estado" fill={BLUE} isAnimationActive={false} cursor="pointer" onClick={pick}>
          <LabelList dataKey="disponible" position="center" formatter={labelStack} fill="#fff" fontSize={10} />
        </Bar>
        <Bar dataKey="congelado" name="Congelado" stackId="estado" fill={AMBER} isAnimationActive={false} cursor="pointer" onClick={pick}>
          <LabelList dataKey="congelado" position="center" formatter={labelStack} fill="#fff" fontSize={10} />
        </Bar>
        <Bar dataKey="vendido" name="Vendido" stackId="estado" fill={NAVY} isAnimationActive={false} cursor="pointer" onClick={pick}>
          <LabelList dataKey="vendido" position="center" formatter={labelStack} fill="#fff" fontSize={10} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

type AmountRow = { id: string; label: string; units: number; gtq: number | null };

function barMark(
  row: AmountRow,
  dataKey: "units" | "gtq",
  moneyValues: boolean,
  showGtq: boolean,
  format: ((value: number | null) => string) | undefined,
): string {
  if (format) return format(dataKey === "gtq" ? row.gtq : row.units);
  if (moneyValues) return row.gtq == null ? "" : money(row.gtq);
  if (showGtq && row.gtq != null) return `${count(row.units)} · ${money(row.gtq)}`;
  return count(row.units);
}

function NamedBars({
  rows,
  dataKey,
  name,
  fill,
  moneyValues = false,
  showGtq = false,
  format,
  onPick,
}: {
  rows: AmountRow[];
  dataKey: "units" | "gtq";
  name: string;
  fill: string;
  moneyValues?: boolean;
  showGtq?: boolean;
  format?: (value: number | null) => string;
  onPick?: (id: string, label: string) => void;
}) {
  const eligible = rows.filter((row) => (dataKey === "gtq" ? row.gtq != null : true));
  if (eligible.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  const shown = capRows(eligible, CHART_CAP);
  const data = shown.rows.map((row) => ({
    ...row,
    mark: barMark(row, dataKey, moneyValues, showGtq, format),
  }));
  const wide = moneyValues || showGtq || format != null;
  return (
    <>
      <ChartFrame height={Math.max(200, data.length * 32 + 36)}>
        <BarChart layout="vertical" data={data} margin={{ left: 8, right: wide ? 132 : 48, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={150} tickFormatter={(value) => clip(String(value))} tick={{ fontSize: 11, fill: NAVY }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value, seriesName) => (moneyValues || format ? (format ? [format(tipNumber(value)), String(seriesName ?? "")] : moneyTip(value, seriesName)) : tipPair(value, seriesName))} />
          <Bar dataKey={dataKey} name={name} fill={fill} barSize={12} isAnimationActive={false} cursor={onPick ? "pointer" : undefined} onClick={(row) => {
            if (!onPick) return;
            const hit = readRow(row);
            if (hit && hit.id !== "otras") onPick(hit.id, hit.label);
          }}>
            <LabelList dataKey="mark" position="right" fill="#334155" fontSize={11} />
          </Bar>
        </BarChart>
      </ChartFrame>
      {shown.hidden > 0 ? <p className="op-note">{data.length} de {data.length + shown.hidden}.</p> : null}
    </>
  );
}

type BandProps = {
  vistas: Partial<Record<VistaSection, VentasVista>>;
  errors: Partial<Record<VistaSection, string>>;
  busy: VistaSection[];
};

function ModeloPanel({ vistas, errors, busy }: BandProps) {
  const vista = vistaOf(vistas, "analisis-de-inventario");
  if (!vista) return <StatusLine section="analisis-de-inventario" errors={errors} busy={busy} />;
  const ranked = [...vista.models].sort((a, b) => b.sold - a.sold || a.label.localeCompare(b.label, "es"));
  return (
    <>
      {vista.notice ? <p className="op-note">{vista.notice}</p> : null}
      <NamedBars
        rows={ranked.map((row) => ({ id: row.id, label: row.label, units: row.sold, gtq: null }))}
        dataKey="units"
        name="Vendidas"
        fill={NAVY}
      />
    </>
  );
}

function CanalesPanel({
  vistas,
  errors,
  busy,
  onFuente,
}: BandProps & { onFuente: (id: string, label: string) => void }) {
  const vista = vistaOf(vistas, "ventas-por-canales");
  if (!vista) return <StatusLine section="ventas-por-canales" errors={errors} busy={busy} />;
  return (
    <>
      {vista.notice ? <p className="op-note">{vista.notice}</p> : null}
      <NamedBars rows={vista.channels} dataKey="units" name="Unidades" fill={NAVY} showGtq onPick={onFuente} />
    </>
  );
}

function DesistenciasPanel({
  vistas,
  errors,
  busy,
  onProject,
}: BandProps & { onProject: (id: string, label: string) => void }) {
  const vista = vistaOf(vistas, "desistimientos");
  const projectRows = vista ? displayProjects(vista.byProject) : [];
  const moneyMode = vista != null && (vista.motivos.some((row) => row.gtq != null) || projectRows.some((row) => row.gtq != null));
  return (
    <section className="vc-grid-2" aria-label="Desistimientos">
      <article className="vc-card">
        <h2>Desistimientos por motivo</h2>
        {!vista ? <StatusLine section="desistimientos" errors={errors} busy={busy} /> : (
          <>
            {vista.notice ? <p className="op-note">{vista.notice}</p> : null}
            <NamedBars rows={vista.motivos} dataKey={moneyMode ? "gtq" : "units"} name={moneyMode ? "Valor" : "Unidades"} fill={RED} moneyValues={moneyMode} />
          </>
        )}
      </article>
      <article className="vc-card">
        <h2>Desistimientos por proyecto</h2>
        {vista ? (
          <NamedBars rows={projectRows} dataKey={moneyMode ? "gtq" : "units"} name={moneyMode ? "Valor" : "Unidades"} fill={RED} moneyValues={moneyMode} onPick={onProject} />
        ) : (
          <StatusLine section="desistimientos" errors={errors} busy={busy} />
        )}
      </article>
    </section>
  );
}

function ValorBand({ vistas, errors, busy }: BandProps) {
  const valor = vistaOf(vistas, "valor-del-proyecto");
  const precios = vistaOf(vistas, "subidas-de-precios");
  const descuentos = vistaOf(vistas, "descuentos");
  return (
    <section aria-label="Valor de proyecto">
      <article className="vc-card">
        <h2>Valor de proyecto</h2>
        {!valor ? <StatusLine section="valor-del-proyecto" errors={errors} busy={busy} /> : (
          <>
            {valor.notice ? <p className="op-note">{valor.notice}</p> : null}
            <ValueTrajectory months={valor.months} />
            <ProjectValue rows={displayProjects(valor.byProject)} />
          </>
        )}
      </article>
      <div className="vc-grid-2">
        <article className="vc-card">
          <h2>Trayectoria de precios</h2>
          {!precios ? <StatusLine section="subidas-de-precios" errors={errors} busy={busy} /> : <PriceTrajectory vista={precios} />}
        </article>
        <article className="vc-card">
          <h2>Impacto del descuento</h2>
          {!descuentos ? <StatusLine section="descuentos" errors={errors} busy={busy} /> : <DiscountImpact vista={descuentos} />}
        </article>
      </div>
    </section>
  );
}

function ValueTrajectory({ months }: { months: ValorVista["months"] }) {
  if (months.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <ChartFrame height={280}>
      <ComposedChart data={months} margin={{ left: 8, right: 12, top: 22, bottom: 16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(value) => labelMoney(value)} tick={{ fontSize: 11, fill: "#64748b" }} width={84} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value, name) => moneyTip(value, name)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="desistido" name="Desistido" fill={RED} barSize={14} isAnimationActive={false}>
          <LabelList dataKey="desistido" position="top" formatter={labelMoney} fill={RED} fontSize={9} />
        </Bar>
        <Line type="monotone" dataKey="ventas" name="Ventas" stroke={NAVY} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false}>
          <LabelList dataKey="ventas" position="bottom" formatter={labelMoney} fill={NAVY} fontSize={9} />
        </Line>
      </ComposedChart>
    </ChartFrame>
  );
}

function ProjectValue({ rows }: { rows: ValorVista["byProject"] }) {
  const gtq = rows.filter((row) => row.disponibleGtq != null || row.desistidoGtq != null);
  const usd = rows.filter((row) => row.disponibleUsd != null);
  if (gtq.length === 0 && usd.length === 0) return null;
  return (
    <>
      {gtq.length > 0 ? (
        <ChartFrame height={Math.max(180, gtq.length * 48 + 36)}>
          <BarChart layout="vertical" data={gtq} margin={{ left: 8, right: 96, top: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={140} tickFormatter={(value) => clip(String(value))} tick={{ fontSize: 11, fill: NAVY }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value, name) => moneyTip(value, name)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="disponibleGtq" name="Disponible" fill={BLUE} barSize={10} isAnimationActive={false}>
              <LabelList dataKey="disponibleGtq" position="right" formatter={labelMoney} fill="#334155" fontSize={10} />
            </Bar>
            <Bar dataKey="desistidoGtq" name="Desistido" fill={RED} barSize={10} isAnimationActive={false}>
              <LabelList dataKey="desistidoGtq" position="right" formatter={labelMoney} fill="#334155" fontSize={10} />
            </Bar>
          </BarChart>
        </ChartFrame>
      ) : null}
      {usd.length > 0 ? (
        <ChartFrame height={Math.max(160, usd.length * 36 + 36)}>
          <BarChart layout="vertical" data={usd} margin={{ left: 8, right: 96, top: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={140} tickFormatter={(value) => clip(String(value))} tick={{ fontSize: 11, fill: NAVY }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value, name) => [dollars(tipNumber(value)), String(name ?? "")]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="disponibleUsd" name="Disponible $" fill={NAVY} barSize={10} isAnimationActive={false}>
              <LabelList dataKey="disponibleUsd" position="right" formatter={labelDollars} fill="#334155" fontSize={10} />
            </Bar>
          </BarChart>
        </ChartFrame>
      ) : null}
    </>
  );
}

function PriceTrajectory({ vista }: { vista: PrecioVista }) {
  if (vista.months.length === 0) return <p className="op-note">{vista.notice ?? "Nada que graficar en este periodo."}</p>;
  return (
    <>
      {vista.notice ? <p className="op-note">{vista.notice}</p> : null}
      <CurrencyLine months={vista.months} dataKey="gtq" name="Quetzales" stroke={NAVY} format={labelMoney} />
      <CurrencyLine months={vista.months} dataKey="usd" name="Dólares" stroke={BLUE} format={labelDollars} />
    </>
  );
}

function CurrencyLine({
  months,
  dataKey,
  name,
  stroke,
  format,
}: {
  months: PrecioVista["months"];
  dataKey: "gtq" | "usd";
  name: string;
  stroke: string;
  format: (value: unknown) => string;
}) {
  return (
    <ChartFrame height={200}>
      <LineChart data={months} margin={{ left: 8, right: 12, top: 18, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={48} />
        <Tooltip formatter={(value) => [format(value), name]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey={dataKey} name={name} stroke={stroke} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false}>
          <LabelList dataKey={dataKey} position="top" formatter={format} fill={stroke} fontSize={9} />
        </Line>
      </LineChart>
    </ChartFrame>
  );
}

function DiscountImpact({ vista }: { vista: DescuentoVista }) {
  if (vista.gtq == null && vista.saleGtq == null) {
    return <p className="op-note">{vista.notice ?? "Nada que graficar en este periodo."}</p>;
  }
  return (
    <NamedBars
      rows={[
        { id: "ventas", label: "Ventas con descuento", units: vista.units, gtq: vista.saleGtq },
        { id: "descuento", label: "Descuento", units: vista.units, gtq: vista.gtq },
      ]}
      dataKey="gtq"
      name="Quetzales"
      fill={AMBER}
      moneyValues
    />
  );
}

function casoAmounts(vista: Extract<VentasVista, { section: "ff-y-casos-especiales" }>): AmountRow[] {
  const byTipo = new Map<string, { n: number; gtq: number; priced: boolean }>();
  for (const row of vista.traces) {
    const current = byTipo.get(row.tipo) ?? { n: 0, gtq: 0, priced: true };
    current.n += 1;
    if (row.gtq == null) current.priced = false;
    else current.gtq += row.gtq;
    byTipo.set(row.tipo, current);
  }
  const complete = vista.marked != null && vista.traces.length > 0 && vista.traces.length === vista.marked;
  return vista.tipos.map((row) => {
    if (row.gtq != null || !complete || row.id === "resto") return row;
    const found = byTipo.get(row.label);
    if (!found || !found.priced || found.n !== row.units) return row;
    return { ...row, gtq: found.gtq };
  });
}

function ControlesPanel({ vistas, errors, busy }: BandProps) {
  const descuentos = vistaOf(vistas, "descuentos");
  const precios = vistaOf(vistas, "subidas-de-precios");
  const casos = vistaOf(vistas, "ff-y-casos-especiales");
  const promos = vistaOf(vistas, "promociones");
  const promoMoney = promos?.tipos.some((row) => row.gtq != null) ?? false;
  const gtqProjects = displayProjects((precios?.byProject ?? []).filter((row) => row.gtq != null));
  const usdProjects = displayProjects((precios?.byProject ?? []).filter((row) => row.usd != null));
  return (
    <section className="vc-grid-2" aria-label="Controles">
      <article className="vc-card">
        <h2>Descuentos</h2>
        {!descuentos ? <StatusLine section="descuentos" errors={errors} busy={busy} /> : (
          <>
            {descuentos.notice ? <p className="op-note">{descuentos.notice}</p> : null}
            {descuentos.tipos.length > 0 ? (
              <NamedBars
                rows={descuentos.tipos}
                dataKey={descuentos.tipos.some((row) => row.gtq != null) ? "gtq" : "units"}
                name="Descuento"
                fill={AMBER}
                moneyValues={descuentos.tipos.some((row) => row.gtq != null)}
              />
            ) : null}
          </>
        )}
      </article>
      <article className="vc-card">
        <h2>Subidas de precios</h2>
        {!precios ? <StatusLine section="subidas-de-precios" errors={errors} busy={busy} /> : (
          <>
            {precios.notice ? <p className="op-note">{precios.notice}</p> : null}
            {gtqProjects.length > 0 ? (
              <NamedBars
                rows={gtqProjects.map((row) => ({ id: row.id, label: row.label, units: row.units, gtq: row.gtq }))}
                dataKey="gtq"
                name="Quetzales"
                fill={NAVY}
                moneyValues
              />
            ) : null}
            {usdProjects.length > 0 ? (
              <NamedBars
                rows={usdProjects.map((row) => ({ id: `${row.id}:usd`, label: row.label, units: row.units, gtq: row.usd }))}
                dataKey="gtq"
                name="Dólares"
                fill={BLUE}
                format={dollars}
              />
            ) : null}
          </>
        )}
      </article>
      <article className="vc-card">
        <h2>F&amp;F y casos especiales</h2>
        {!casos ? <StatusLine section="ff-y-casos-especiales" errors={errors} busy={busy} /> : (
          <>
            {casos.notice ? <p className="op-note">{casos.notice}</p> : null}
            {casos.tipos.length > 0 ? <NamedBars rows={casoAmounts(casos)} dataKey="units" name="Unidades" fill={NAVY} showGtq /> : null}
          </>
        )}
      </article>
      <article className="vc-card">
        <h2>Promociones</h2>
        {!promos ? <StatusLine section="promociones" errors={errors} busy={busy} /> : (
          <>
            {promos.notice ? <p className="op-note">{promos.notice}</p> : null}
            <NamedBars
              rows={promos.tipos}
              dataKey={promoMoney ? "gtq" : "units"}
              name={promoMoney ? "Quetzales" : "Unidades"}
              fill={NAVY}
              moneyValues={promoMoney}
              showGtq={!promoMoney}
            />
          </>
        )}
      </article>
    </section>
  );
}

function ReferidosBand({ vistas, errors, busy }: BandProps) {
  const vista = vistaOf(vistas, "control-referidos");
  return (
    <section aria-label="Control Referidos">
      <article className="vc-card">
        <h2>Control Referidos</h2>
        {!vista ? <StatusLine section="control-referidos" errors={errors} busy={busy} /> : <ReferidosBody vista={vista} />}
      </article>
    </section>
  );
}

function ReferidosBody({ vista }: { vista: ReferidosVista }) {
  const marked = vista.si != null && vista.si > 0;
  const names = vista.nombres.length > 0;
  return (
    <>
      {vista.notice ? <p className="op-note">{vista.notice}</p> : null}
      {vista.scopedDeals === 0 ? null : vista.si == null && !names ? (
        <p className="op-note">Estos tratos no traen referido, tipo de referido ni nombre de referidor.</p>
      ) : (
        <>
          {vista.si === 0 ? <p className="op-note">Ningún trato está marcado como referido.</p> : null}
          {marked ? (
            <>
              <p className="vc-sub">{count(vista.si)} {vista.si === 1 ? "referido" : "referidos"}.</p>
              {vista.byTipo.length > 0 ? (
                <NamedBars rows={vista.byTipo} dataKey="units" name="Referidos" fill={NAVY} />
              ) : null}
              {vista.sinTipo != null && vista.sinTipo > 0 ? (
                <p className="op-note">{count(vista.sinTipo)} sin tipo de referido.</p>
              ) : null}
            </>
          ) : null}
          {names ? (
            <>
              <h3>Referidores</h3>
              <ul className="vc-referidos">
                {vista.nombres.map((name) => <li key={name}>{name}</li>)}
              </ul>
              {vista.nombresTotal != null && vista.nombresTotal > vista.nombres.length ? (
                <p className="op-note">La lista trae {vista.nombres.length} de {vista.nombresTotal}.</p>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </>
  );
}

function Blockers({ rows }: { rows: BlockerRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "days", dir: "desc" });
  const sorted = useMemo(() => {
    const copy = [...rows];
    const dir = sort.dir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      const value = compareBlocker(a, b, sort.key);
      if (value !== 0) return value * dir;
      return a.unit.localeCompare(b.unit, "es");
    });
    return copy;
  }, [rows, sort]);

  function toggle(key: SortKey) {
    setSort((current) => (
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "days" || key === "gtq" ? "desc" : "asc" }
    ));
  }

  if (sorted.length === 0) return <p className="op-note">Ningún trato de este filtro se quedó sin cerrar las dos puertas.</p>;
  return (
    <div className="vt-table-wrap">
        <table className="vt-table">
          <thead>
            <tr>
              <Th label="Unidad / trato" active={sort.key === "unit"} dir={sort.dir} onClick={() => toggle("unit")} />
              <Th label="Proyecto · asesor" active={sort.key === "who"} dir={sort.dir} onClick={() => toggle("who")} />
              <Th label="Etapa" active={sort.key === "stage"} dir={sort.dir} onClick={() => toggle("stage")} />
              <Th label="Falta" active={sort.key === "missing"} dir={sort.dir} onClick={() => toggle("missing")} />
              <Th label="Días" active={sort.key === "days"} dir={sort.dir} onClick={() => toggle("days")} />
              <Th label="Valor" active={sort.key === "gtq"} dir={sort.dir} onClick={() => toggle("gtq")} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.unit}</strong><small>{row.deal}</small></td>
                <td>{row.project}<small>{row.asesor}</small></td>
                <td>{row.stage}</td>
                <td className={row.severity === "alta" ? "vt-alta" : "vt-media"}>{row.missing}</td>
                <td>{row.days == null ? "—" : count(row.days)}</td>
                <td>{money(row.gtq)}</td>
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
}

function compareBlocker(a: BlockerRow, b: BlockerRow, key: SortKey): number {
  if (key === "unit") return a.unit.localeCompare(b.unit, "es");
  if (key === "who") return a.project.localeCompare(b.project, "es") || a.asesor.localeCompare(b.asesor, "es");
  if (key === "stage") return a.stage.localeCompare(b.stage, "es");
  if (key === "missing") return a.missing.localeCompare(b.missing, "es");
  if (key === "days") return (a.days ?? -1) - (b.days ?? -1);
  return (a.gtq ?? -1) - (b.gtq ?? -1);
}

function Th({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th>
      <button type="button" onClick={onClick} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
        {label}
        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function SalesTable({
  lines,
  shown,
  total,
  filtered,
  units,
}: {
  lines: SaleLine[];
  shown: number;
  total: number;
  filtered: boolean;
  units: Map<string, string>;
}) {
  if (lines.length === 0) return <p className="op-note">Ninguna venta de este filtro.</p>;
  return (
    <>
      {total > shown ? (
        <p className="op-note">
          La lista trae {shown} de {total}.{filtered ? " El filtro corre sobre esas filas." : ""}
        </p>
      ) : null}
      <div className="vt-table-wrap">
        <table className="vt-table">
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Proyecto</th>
              <th>Asesor</th>
              <th>Cliente</th>
              <th>Fuente</th>
              <th>Fecha</th>
              <th>Valor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${line.kind}:${line.dealId}:${line.day}:${index}`}>
                <td>{units.get(line.dealId) ?? "—"}</td>
                <td>{line.project}</td>
                <td>{line.asesor}</td>
                <td>—</td>
                <td>{line.fuente}</td>
                <td>{dotted(line.day)}</td>
                <td>{money(line.gtq)}</td>
                <td>{line.kind === "venta" ? "Venta" : "Desistimiento"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function listedDeals(rows: StageDeal[], total: number): { rows: StageDeal[]; total: number } {
  const kept = rows.filter((row) => isDisplayProject(row.project));
  return { rows: kept, total: Math.max(kept.length, total - (rows.length - kept.length)) };
}

function StageDetail({ stage }: { stage: FunnelStage | null }) {
  if (!stage) return <p className="op-note">Esa etapa no está en el periodo.</p>;
  return (
    <>
      <p className="vc-sub">Esta lista es la de la etapa. No trae cliente ni canal.</p>
      {stage.footnote ? <p className="op-note">{stage.footnote}</p> : null}
      <DealTable title={stage.label} {...listedDeals(stage.deals, stage.listTotal)} />
      {stage.droppedTotal > 0 ? <DealTable title={stage.droppedTitle} {...listedDeals(stage.dropped, stage.droppedTotal)} /> : null}
      {stage.enteredTotal > 0 ? <DealTable title={stage.enteredTitle} {...listedDeals(stage.entered, stage.enteredTotal)} /> : null}
    </>
  );
}

function DealTable({ title, rows, total }: { title: string; rows: StageDeal[]; total: number }) {
  return (
    <>
      <h3>{title}{total > rows.length ? ` · ${rows.length} de ${total}` : ""}</h3>
      {rows.length === 0 ? <p className="op-note">Sin tratos en esta lista.</p> : (
        <div className="vt-table-wrap">
          <table className="vt-table">
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Trato</th>
                <th>Proyecto</th>
                <th>Asesor</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.unit}</td>
                  <td>{row.deal}</td>
                  <td>{row.project}</td>
                  <td>{row.asesor}</td>
                  <td>—</td>
                  <td>{dotted(row.day)}</td>
                  <td>{money(row.gtq)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
