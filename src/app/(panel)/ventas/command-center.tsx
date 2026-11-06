"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  VENTA_DEFINITION,
  type BlockerRow,
  type Choice,
  type FunnelStage,
  type MeasureRow,
  type SaleLine,
  type StageDeal,
  type StatusRow,
  type VentasVista,
  type VistaSection,
} from "@/lib/ventas/vista-types";

const NAVY = "#0d2041";
const BLUE = "#0573b0";
const RED = "#b91c1c";
const AMBER = "#b45309";
const SLATE = "#94a3b8";
const GRID = "#e2e8f0";
const CHART_CAP = 12;

const PRIORITY: VistaSection[] = [
  "ventas-totales",
  "objetivos-de-ventas",
  "status-de-ventas",
  "inventario-general",
];

type Panel = "modelo" | "canales" | "desistimientos" | "controles";

const PANEL_SECTIONS: Record<Panel, VistaSection[]> = {
  modelo: ["analisis-de-inventario"],
  canales: ["ventas-por-canales"],
  desistimientos: ["desistimientos"],
  controles: ["descuentos", "subidas-de-precios", "ff-y-casos-especiales", "promociones"],
};

type BarState = {
  periodo: string;
  desde: string;
  hasta: string;
  proyecto: string;
  asesor: string;
  torre: string;
};

const INITIAL: BarState = {
  periodo: "este-mes",
  desde: "",
  hasta: "",
  proyecto: "",
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

function tipNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function clip(label: string, max = 22): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

function gapFill(value: number): string {
  if (value < 0) return RED;
  if (value > 0) return BLUE;
  return NAVY;
}

function goalFill(real: number, meta: number | null): string {
  if (meta == null) return NAVY;
  return real < meta ? RED : BLUE;
}

function plainCaption(caption: string | null | undefined): string | null {
  if (!caption || caption.includes("¿")) return null;
  return caption;
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
  if (bar.proyecto) params.append("proyecto", bar.proyecto);
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
  const [panel, setPanel] = useState<Panel | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [vistas, setVistas] = useState<Partial<Record<VistaSection, VentasVista>>>({});
  const [errors, setErrors] = useState<Partial<Record<VistaSection, string>>>({});
  const [busy, setBusy] = useState<VistaSection[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setVistas({});
    setErrors({});
    setBusy(PRIORITY);
    const params = buildParams(bar);
    for (const section of PRIORITY) {
      const query = new URLSearchParams(params);
      query.set("section", section);
      fetch(`/api/ventas/vista?${query.toString()}`, { signal: controller.signal })
        .then((response) => readVista(response, section))
        .then((body) => {
          if (cancelled) return;
          setVistas((current) => ({ ...current, [section]: body }));
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
    if (!panel) return;
    const sections = PANEL_SECTIONS[panel];
    const controller = new AbortController();
    let cancelled = false;
    setBusy((current) => [...new Set([...current, ...sections])]);
    const params = buildParams(bar);
    for (const section of sections) {
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
  }, [bar, panel]);

  useEffect(() => {
    if (!focus) return;
    document.getElementById("vc-detalle")?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  function update(patch: Partial<BarState>) {
    setFocus(null);
    setBar((current) => ({ ...current, ...patch }));
  }

  function toggleFocus(next: Focus) {
    setFocus((current) => (sameFocus(current, next) ? null : next));
  }

  function togglePanel(next: Panel) {
    setPanel((current) => (current === next ? null : next));
  }

  const totales = vistaOf(vistas, "ventas-totales");
  const objetivos = vistaOf(vistas, "objetivos-de-ventas");
  const status = vistaOf(vistas, "status-de-ventas");
  const inventario = vistaOf(vistas, "inventario-general");

  const projects = useMemo(
    () => mergeChoices([totales?.projects ?? [], objetivos?.projects ?? [], inventario?.projects ?? []]),
    [totales, objetivos, inventario],
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
      <header className="vc-head">
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
            Proyecto
            <select value={bar.proyecto} onChange={(event) => update({ proyecto: event.target.value })}>
              <option value="">Todos los proyectos</option>
              {withCurrent(projects, bar.proyecto).map((choice) => (
                <option key={choice.id} value={choice.id}>{choice.label}</option>
              ))}
            </select>
          </label>
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
                {totales.freshness.label}
              </span>
            ) : errors["ventas-totales"] ? (
              <span className="op-fresh">No se pudo leer el último dato cargado.</span>
            ) : (
              <span className="op-fresh">Cargando…</span>
            )}
          </p>
        </div>
        <p className="vc-definition">{VENTA_DEFINITION}</p>
        {totales?.freshness.note ? <p className="op-note op-warn">{totales.freshness.note}</p> : null}
      </header>

      <section className="vc-grid-2" aria-label="Ventas totales, ritmo y status">
        <article className="vc-card">
          <h2>Ventas totales y ritmo</h2>
          {totales ? (
            <>
              <p className="vc-figure">
                {count(totales.netUnits)} <span>unidades netas</span>
                <span aria-hidden="true"> · </span>
                {money(totales.netGtq)}
              </p>
              <p className="vc-sub">
                {count(totales.grossUnits)} con fecha de venta en el periodo · {count(totales.lossUnits)} desistimientos en el periodo.
                {" "}Línea continua: este periodo. Punteada gris: {totales.compareLabel ?? "periodo anterior"}.
                {totales.daily.some((point) => point.meta != null) ? " Punteada azul: ritmo de la meta." : ""}
              </p>
              <PaceChart vista={totales} />
              {totales.notice ? <p className="op-note">{totales.notice}</p> : null}
            </>
          ) : (
            <StatusLine section="ventas-totales" errors={errors} busy={busy} />
          )}
        </article>
        <article className="vc-card">
          <h2>Status contra la fecha de cierre</h2>
          {status ? (
            <>
              <p className="vc-sub">
                Fecha de cierre {dotted(status.closeOn)}. {status.dayLabel}. Real {count(status.units)} · ritmo {count(status.paceUnits)} · {signed(status.gapUnits)} unidades.
              </p>
              {plainCaption(status.caption) ? <p className="vc-sub">{status.caption}</p> : null}
              <RhythmChart vista={status} />
              {status.notice ? <p className="op-note">{status.notice}</p> : null}
              {totales?.targetNote ? <p className="op-note">{totales.targetNote}</p> : null}
            </>
          ) : (
            <StatusLine section="status-de-ventas" errors={errors} busy={busy} />
          )}
        </article>
      </section>

      <section aria-label="Conversión, objetivos e inventario">
        <article className="vc-card">
          <h2>Tasa de conversión</h2>
          <p className="vc-sub">
            Reservas, promesas firmadas, recibos publicados y ventas netas. El porcentaje compara cada etapa con la anterior. Si pasa de 100 %, entraron tratos que no venían de esa etapa.
          </p>
          {totales ? <FunnelChart funnel={totales.funnel} onStage={(id, label) => toggleFocus({ kind: "etapa", id, label })} /> : <StatusLine section="ventas-totales" errors={errors} busy={busy} />}
        </article>
        <div className="vc-grid-2">
          <article className="vc-card">
            <h2>Ventas contra objetivos por proyecto</h2>
            <p className="vc-sub">Rojo: debajo de la meta. Azul: en la meta o arriba. Sin barra gris: sin meta.</p>
            {objetivos ? (
              <>
                {plainCaption(objetivos.caption) ? <p className="vc-sub">{objetivos.caption}</p> : null}
                {objetivos.notice ? <p className="op-note">{objetivos.notice}</p> : null}
                {totales?.targetNote ? <p className="op-note">{totales.targetNote}</p> : null}
                <GoalBars
                  rows={[...objetivos.byProject].sort((a, b) => b.units - a.units || a.label.localeCompare(b.label, "es"))}
                  onPick={(id, label) => toggleFocus({ kind: "proyecto", id, label })}
                />
              </>
            ) : (
              <StatusLine section="objetivos-de-ventas" errors={errors} busy={busy} />
            )}
          </article>
          <article className="vc-card">
            <h2>Ventas contra objetivos por asesor</h2>
            <p className="vc-sub">Por unidades, de mayor a menor.</p>
            {objetivos ? (
              <GoalBars
                rows={capRows([...objetivos.byAsesor].sort((a, b) => b.units - a.units || a.label.localeCompare(b.label, "es")), CHART_CAP).rows}
                hidden={capRows(objetivos.byAsesor, CHART_CAP).hidden}
                hiddenText="asesores, por unidades"
                onPick={(id, label) => toggleFocus({ kind: "asesor", id, label })}
              />
            ) : (
              <StatusLine section="objetivos-de-ventas" errors={errors} busy={busy} />
            )}
          </article>
        </div>
        <div className="vc-grid-2">
          <article className="vc-card">
            <h2>Inventario general por proyecto</h2>
            {inventario ? (
              <>
                {plainCaption(inventario.caption) ? <p className="vc-sub">{inventario.caption}</p> : null}
                {inventario.notice ? <p className="op-note">{inventario.notice}</p> : null}
                {bar.asesor ? <p className="op-note">El inventario no se parte por asesor.</p> : null}
                <StackChart
                  rows={inventario.byProject}
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
                rows={inventario.byTower.map((row) => ({
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

      <section className="vc-grid-2" aria-label="Brechas contra el ritmo">
        <article className="vc-card">
          <h2>Brecha contra el ritmo por proyecto</h2>
          <p className="vc-sub">Real menos ritmo a la fecha de cierre. Rojo: déficit. Azul: excedente.</p>
          {status ? (
            <GapBars
              rows={status.byProject}
              onPick={(id, label) => toggleFocus({ kind: "proyecto", id, label })}
            />
          ) : (
            <StatusLine section="status-de-ventas" errors={errors} busy={busy} />
          )}
        </article>
        <article className="vc-card">
          <h2>Brecha contra el ritmo por asesor</h2>
          <p className="vc-sub">El déficit más grande primero.</p>
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

      <section className="vc-card" aria-label="Vistas secundarias">
        <h2>Detalle por modelo, canal y controles</h2>
        <div className="vc-tabs">
          <button type="button" aria-pressed={panel === "modelo"} onClick={() => togglePanel("modelo")}>Modelo</button>
          <button type="button" aria-pressed={panel === "canales"} onClick={() => togglePanel("canales")}>Canales</button>
          <button type="button" aria-pressed={panel === "desistimientos"} onClick={() => togglePanel("desistimientos")}>Desistimientos</button>
          <button type="button" aria-pressed={panel === "controles"} onClick={() => togglePanel("controles")}>Descuentos, precios, F&amp;F y promociones</button>
        </div>
        {panel === "modelo" ? <ModeloPanel vistas={vistas} errors={errors} busy={busy} /> : null}
        {panel === "canales" ? <CanalesPanel vistas={vistas} errors={errors} busy={busy} onFuente={(id, label) => toggleFocus({ kind: "fuente", id, label })} /> : null}
        {panel === "desistimientos" ? <DesistenciasPanel vistas={vistas} errors={errors} busy={busy} onProject={(id, label) => toggleFocus({ kind: "proyecto", id, label })} /> : null}
        {panel === "controles" ? <ControlesPanel vistas={vistas} errors={errors} busy={busy} /> : null}
      </section>

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
              rows={totales.blockers.filter((row) => blockerMatches(row, focus, focus?.kind === "torre" ? projectName.get(focus.projectId) ?? null : null))}
            />
            <h2>Detalle de ventas</h2>
            <p className="vc-sub">Cliente no está en la vista de ventas. Unidad aparece cuando el trato está en la etapa de venta neta.</p>
            {focus?.kind === "etapa" ? (
              <StageDetail stage={totales.funnel.find((item) => item.id === focus.id) ?? null} />
            ) : (
              <SalesTable
                lines={totales.lines.filter((line) => lineMatches(line, focus))}
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

function PaceChart({ vista }: { vista: Extract<VentasVista, { section: "ventas-totales" }> }) {
  const hasPrior = vista.daily.some((point) => point.anterior != null);
  const hasMeta = vista.daily.some((point) => point.meta != null);
  if (vista.daily.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <ChartFrame height={280}>
      <LineChart data={vista.daily} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
        <Tooltip formatter={(value, name) => tipPair(value, name)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="neto" name="Este periodo" stroke={NAVY} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        {hasPrior ? (
          <Line type="monotone" dataKey="anterior" name={vista.compareLabel ?? "Periodo anterior"} stroke={SLATE} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
        ) : null}
        {hasMeta ? (
          <Line type="monotone" dataKey="meta" name="Ritmo de la meta" stroke={BLUE} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
        ) : null}
      </LineChart>
    </ChartFrame>
  );
}

function RhythmChart({ vista }: { vista: Extract<VentasVista, { section: "status-de-ventas" }> }) {
  if (vista.rhythm.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <ChartFrame height={260}>
      <LineChart data={vista.rhythm} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
        <Tooltip formatter={(value, name) => tipPair(value, name)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="real" name="Real" stroke={NAVY} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="ritmo" name="Ritmo" stroke={BLUE} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ChartFrame>
  );
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
      <p className="vc-sub">
        {funnel.map((stage) => `${stage.label}: ${stage.source}, ${stage.grain}`).join(" · ")}
      </p>
    </>
  );
}

function GoalBars({
  rows,
  hidden = 0,
  hiddenText = "filas",
  onPick,
}: {
  rows: MeasureRow[];
  hidden?: number;
  hiddenText?: string;
  onPick: (id: string, label: string) => void;
}) {
  const data = rows.map((row) => ({ id: row.id, label: row.label, real: row.units, meta: row.targetUnits }));
  if (data.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <>
      <ChartFrame height={Math.max(220, data.length * 36 + 36)}>
        <BarChart layout="vertical" data={data} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={140} tickFormatter={(value) => clip(String(value))} tick={{ fontSize: 11, fill: NAVY }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value, name) => tipPair(value, name)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="meta" name="Meta" fill={SLATE} barSize={8} isAnimationActive={false} cursor="pointer" onClick={(row) => {
            const hit = readRow(row);
            if (hit) onPick(hit.id, hit.label);
          }} />
          <Bar dataKey="real" name="Real" barSize={8} isAnimationActive={false} cursor="pointer" onClick={(row) => {
            const hit = readRow(row);
            if (hit) onPick(hit.id, hit.label);
          }}>
            {data.map((row) => <Cell key={row.id} fill={goalFill(row.real, row.meta)} />)}
          </Bar>
        </BarChart>
      </ChartFrame>
      {hidden > 0 ? <p className="op-note">{data.length} de {data.length + hidden} {hiddenText}.</p> : null}
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
        <BarChart layout="vertical" data={data} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={140} tickFormatter={(value) => clip(String(value))} tick={{ fontSize: 11, fill: NAVY }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value, name) => [signed(tipNumber(value)), String(name ?? "")]} />
          <Bar dataKey="gap" name="Real menos ritmo" isAnimationActive={false} cursor="pointer" onClick={(row) => {
            const hit = readRow(row);
            if (hit) onPick(hit.id, hit.label);
          }}>
            {data.map((row) => <Cell key={row.id} fill={gapFill(row.gap)} />)}
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
        <Bar dataKey="disponible" name="Disponible" stackId="estado" fill={BLUE} isAnimationActive={false} cursor="pointer" onClick={pick} />
        <Bar dataKey="congelado" name="Congelado" stackId="estado" fill={AMBER} isAnimationActive={false} cursor="pointer" onClick={pick} />
        <Bar dataKey="vendido" name="Vendido" stackId="estado" fill={NAVY} isAnimationActive={false} cursor="pointer" onClick={pick} />
      </BarChart>
    </ChartFrame>
  );
}

function NamedBars({
  rows,
  dataKey,
  name,
  fill,
  moneyValues = false,
  onPick,
}: {
  rows: { id: string; label: string; units: number; gtq: number | null }[];
  dataKey: "units" | "gtq";
  name: string;
  fill: string;
  moneyValues?: boolean;
  onPick?: (id: string, label: string) => void;
}) {
  const data = rows.filter((row) => (dataKey === "gtq" ? row.gtq != null : true));
  if (data.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  const shown = capRows(data, CHART_CAP);
  return (
    <>
      <ChartFrame height={Math.max(200, shown.rows.length * 32 + 36)}>
        <BarChart layout="vertical" data={shown.rows} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={150} tickFormatter={(value) => clip(String(value))} tick={{ fontSize: 11, fill: NAVY }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value, seriesName) => (moneyValues ? moneyTip(value, seriesName) : tipPair(value, seriesName))} />
          <Bar dataKey={dataKey} name={name} fill={fill} barSize={12} isAnimationActive={false} cursor={onPick ? "pointer" : undefined} onClick={(row) => {
            if (!onPick) return;
            const hit = readRow(row);
            if (hit && hit.id !== "otras") onPick(hit.id, hit.label);
          }} />
        </BarChart>
      </ChartFrame>
      {shown.hidden > 0 ? <p className="op-note">{shown.rows.length} de {shown.rows.length + shown.hidden}.</p> : null}
    </>
  );
}

function ModeloPanel({
  vistas,
  errors,
  busy,
}: {
  vistas: Partial<Record<VistaSection, VentasVista>>;
  errors: Partial<Record<VistaSection, string>>;
  busy: VistaSection[];
}) {
  const vista = vistaOf(vistas, "analisis-de-inventario");
  if (!vista) return <StatusLine section="analisis-de-inventario" errors={errors} busy={busy} />;
  const ranked = [...vista.models].sort((a, b) => b.sold - a.sold || a.label.localeCompare(b.label, "es"));
  return (
    <article>
      <h3>Ventas por modelo</h3>
      {plainCaption(vista.caption) ? <p className="vc-sub">{vista.caption}</p> : null}
      {vista.notice ? <p className="op-note">{vista.notice}</p> : null}
      <NamedBars
        rows={ranked.map((row) => ({ id: row.id, label: row.label, units: row.sold, gtq: row.listGtq }))}
        dataKey="units"
        name="Vendidas"
        fill={NAVY}
      />
    </article>
  );
}

function CanalesPanel({
  vistas,
  errors,
  busy,
  onFuente,
}: {
  vistas: Partial<Record<VistaSection, VentasVista>>;
  errors: Partial<Record<VistaSection, string>>;
  busy: VistaSection[];
  onFuente: (id: string, label: string) => void;
}) {
  const vista = vistaOf(vistas, "ventas-por-canales");
  if (!vista) return <StatusLine section="ventas-por-canales" errors={errors} busy={busy} />;
  return (
    <article>
      <h3>Ventas por canal</h3>
      {plainCaption(vista.caption) ? <p className="vc-sub">{vista.caption}</p> : null}
      {vista.notice ? <p className="op-note">{vista.notice}</p> : null}
      <NamedBars rows={vista.channels} dataKey="units" name="Unidades" fill={NAVY} onPick={onFuente} />
    </article>
  );
}

function DesistenciasPanel({
  vistas,
  errors,
  busy,
  onProject,
}: {
  vistas: Partial<Record<VistaSection, VentasVista>>;
  errors: Partial<Record<VistaSection, string>>;
  busy: VistaSection[];
  onProject: (id: string, label: string) => void;
}) {
  const vista = vistaOf(vistas, "desistimientos");
  if (!vista) return <StatusLine section="desistimientos" errors={errors} busy={busy} />;
  const moneyMode = vista.motivos.some((row) => row.gtq != null) || vista.byProject.some((row) => row.gtq != null);
  return (
    <div className="vc-grid-2">
      <article>
        <h3>Desistimientos por motivo</h3>
        <p className="vc-sub">{count(vista.units)} desistimientos · {money(vista.gtq)} valor del trato.</p>
        {plainCaption(vista.caption) ? <p className="vc-sub">{vista.caption}</p> : null}
        {vista.notice ? <p className="op-note">{vista.notice}</p> : null}
        <NamedBars rows={vista.motivos} dataKey={moneyMode ? "gtq" : "units"} name={moneyMode ? "Valor del trato" : "Unidades"} fill={RED} moneyValues={moneyMode} />
      </article>
      <article>
        <h3>Desistimientos por proyecto</h3>
        <NamedBars rows={vista.byProject} dataKey={moneyMode ? "gtq" : "units"} name={moneyMode ? "Valor del trato" : "Unidades"} fill={RED} moneyValues={moneyMode} onPick={onProject} />
      </article>
    </div>
  );
}

function ControlesPanel({
  vistas,
  errors,
  busy,
}: {
  vistas: Partial<Record<VistaSection, VentasVista>>;
  errors: Partial<Record<VistaSection, string>>;
  busy: VistaSection[];
}) {
  const descuentos = vistaOf(vistas, "descuentos");
  const precios = vistaOf(vistas, "subidas-de-precios");
  const casos = vistaOf(vistas, "ff-y-casos-especiales");
  const promos = vistaOf(vistas, "promociones");
  return (
    <div className="vc-grid-2">
      <article>
        <h3>Descuentos</h3>
        {!descuentos ? <StatusLine section="descuentos" errors={errors} busy={busy} /> : (
          <>
            {plainCaption(descuentos.caption) ? <p className="vc-sub">{descuentos.caption}</p> : null}
            {descuentos.notice ? <p className="op-note">{descuentos.notice}</p> : null}
            {descuentos.tipos.length > 0 ? (
              <>
                <p className="vc-sub">{count(descuentos.units)} descuentos · {money(descuentos.gtq)} · {pct(descuentos.share)} del valor de esas ventas.</p>
                <NamedBars rows={descuentos.tipos} dataKey={descuentos.tipos.some((row) => row.gtq != null) ? "gtq" : "units"} name="Descuento" fill={AMBER} moneyValues={descuentos.tipos.some((row) => row.gtq != null)} />
              </>
            ) : null}
          </>
        )}
      </article>
      <article>
        <h3>Subidas de precios</h3>
        {!precios ? <StatusLine section="subidas-de-precios" errors={errors} busy={busy} /> : (
          <>
            {plainCaption(precios.caption) ? <p className="vc-sub">{precios.caption}</p> : null}
            {precios.notice ? <p className="op-note">{precios.notice}</p> : null}
            {precios.gtq == null && precios.usd == null && precios.byProject.length === 0 ? null : (
              <>
                <p className="vc-sub">{count(precios.units)} unidades · {money(precios.gtq)} · {dollars(precios.usd)}. Quetzales y dólares no se suman.</p>
                <NamedBars
                  rows={precios.byProject.map((row) => ({ id: row.id, label: row.label, units: row.units, gtq: row.gtq }))}
                  dataKey="gtq"
                  name="Quetzales"
                  fill={NAVY}
                  moneyValues
                />
              </>
            )}
          </>
        )}
      </article>
      <article>
        <h3>F&amp;F y casos especiales</h3>
        {!casos ? <StatusLine section="ff-y-casos-especiales" errors={errors} busy={busy} /> : (
          <>
            {plainCaption(casos.caption) ? <p className="vc-sub">{casos.caption}</p> : null}
            {casos.notice ? <p className="op-note">{casos.notice}</p> : null}
            {casos.marked == null ? null : (
              <>
                <p className="vc-sub">Marcadas {count(casos.marked)} · F&amp;F {count(casos.ff)} · especiales {count(casos.especial)} · peso {pct(casos.share)}.</p>
                <NamedBars rows={casos.tipos} dataKey="units" name="Unidades" fill={NAVY} />
              </>
            )}
          </>
        )}
      </article>
      <article>
        <h3>Promociones</h3>
        {!promos ? <StatusLine section="promociones" errors={errors} busy={busy} /> : (
          <>
            {plainCaption(promos.caption) ? <p className="vc-sub">{promos.caption}</p> : null}
            {promos.notice ? <p className="op-note">{promos.notice}</p> : null}
            <p className="vc-sub">{count(promos.units)} ventas · {count(promos.promoted)} con promoción · {money(promos.gtq)}.</p>
            <NamedBars rows={promos.tipos} dataKey="units" name="Unidades" fill={NAVY} />
          </>
        )}
      </article>
    </div>
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

function StageDetail({ stage }: { stage: FunnelStage | null }) {
  if (!stage) return <p className="op-note">Esa etapa no está en el periodo.</p>;
  return (
    <>
      <p className="vc-sub">Esta lista es la de la etapa. No trae cliente ni canal.</p>
      {stage.footnote ? <p className="op-note">{stage.footnote}</p> : null}
      <DealTable title={stage.label} rows={stage.deals} total={stage.listTotal} />
      {stage.droppedTotal > 0 ? <DealTable title={stage.droppedTitle} rows={stage.dropped} total={stage.droppedTotal} /> : null}
      {stage.enteredTotal > 0 ? <DealTable title={stage.enteredTitle} rows={stage.entered} total={stage.enteredTotal} /> : null}
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
