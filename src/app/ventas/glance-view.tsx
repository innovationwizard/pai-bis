"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import type { Choice, StatusVista, TargetEditor, VentasVista, VistaSection } from "@/lib/ventas/vista-types";
import { isControlVista, ControlScreens } from "./glance-control";
import { isStockVista, StockScreens } from "./glance-stock";

const STORAGE_KEY = "pai-ventas-filtros";
const SERIES_COLOR = ["#0d2041", "#0573b0", "#b45309", "#3d6f8f"];
const PROJECT_COLOR: Record<string, string> = {
  benestare: "#0d2041",
  "bosque-las-tapias": "#0573b0",
  "boulevard-5": "#3d6f8f",
  "casa-elisa": "#6d8ea3",
  "santa-elena": "#1a4a68",
};

type FilterKey = "asesor" | "torre" | "fuente" | "modelo" | "habitaciones" | "motivo" | "descuento" | "promocion" | "caso" | "estadoUnidad" | "buscar";

type BarState = {
  periodo: string;
  desde: string;
  hasta: string;
  comparar: boolean;
  n: number;
  anio: boolean;
  proyectos: string[] | null;
  asesor: string;
  torre: string;
  fuente: string;
  modelo: string;
  habitaciones: string;
  motivo: string;
  descuento: string;
  promocion: string;
  caso: string;
  estadoUnidad: string;
  buscar: string;
};

const INITIAL: BarState = {
  periodo: "este-mes",
  desde: "",
  hasta: "",
  comparar: false,
  n: 1,
  anio: false,
  proyectos: null,
  asesor: "",
  torre: "",
  fuente: "",
  modelo: "",
  habitaciones: "",
  motivo: "",
  descuento: "",
  promocion: "",
  caso: "",
  estadoUnidad: "",
  buscar: "",
};

const SPECIFIC: Record<VistaSection, FilterKey[]> = {
  "ventas-totales": ["asesor", "torre"],
  "objetivos-de-ventas": ["asesor"],
  "status-de-ventas": ["asesor"],
  "ventas-por-canales": ["fuente", "asesor"],
  "analisis-de-inventario": ["torre", "modelo", "habitaciones"],
  "inventario-general": ["torre", "estadoUnidad", "buscar"],
  "valor-del-proyecto": ["torre"],
  "tasa-de-conversion": ["fuente", "asesor"],
  desistimientos: ["motivo", "asesor"],
  descuentos: ["descuento", "asesor"],
  "subidas-de-precios": ["torre"],
  "ff-y-casos-especiales": ["caso", "asesor"],
  promociones: ["promocion", "asesor"],
};

const FIELD_LABEL: Record<FilterKey, string> = {
  asesor: "Asesor",
  torre: "Torre",
  fuente: "Canal",
  modelo: "Modelo",
  habitaciones: "Habitaciones",
  motivo: "Motivo",
  descuento: "Descuento",
  promocion: "Promoción",
  caso: "Caso",
  estadoUnidad: "Estado de unidad",
  buscar: "Buscar unidad",
};

type Drill = { kind: "project" | "asesor" | "fuente"; id: string; label: string };

const moneyFormat = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 });
const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 });

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return moneyFormat.format(value);
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
  if (value == null || !Number.isFinite(value)) return "Sin meta";
  const n = value * 100;
  return `${new Intl.NumberFormat("es-GT", { maximumFractionDigits: n >= 10 ? 0 : 1 }).format(n)}%`;
}

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function tipNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function clip(label: string, max = 22): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

function projectSlug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function projectColor(label: string): string {
  return PROJECT_COLOR[projectSlug(label)] ?? "#0573b0";
}

function gapColor(value: number | null): string {
  if (value == null) return "#94a3b8";
  if (value < 0) return "#b91c1c";
  if (value > 0) return "#0573b0";
  return "#0d2041";
}

function toneColor(tone: StatusVista["tone"]): string {
  if (tone === "deficit") return "#b91c1c";
  if (tone === "excedente") return "#0573b0";
  if (tone === "en-linea") return "#0d2041";
  return "#64748b";
}

function toneWord(tone: StatusVista["tone"]): string {
  if (tone === "deficit") return "Déficit";
  if (tone === "excedente") return "Excedente";
  if (tone === "en-linea") return "En la meta";
  return "Sin meta";
}

function readBar(raw: string): BarState {
  const parsed = JSON.parse(raw) as Partial<BarState> & { proyecto?: unknown };
  const legacy = parsed.proyecto;
  const proyectos = "proyectos" in parsed
    ? Array.isArray(parsed.proyectos)
      ? parsed.proyectos.filter((id): id is string => typeof id === "string")
      : null
    : typeof legacy === "string" && legacy
      ? [legacy]
      : null;
  return {
    ...INITIAL,
    ...parsed,
    comparar: parsed.comparar === true,
    anio: parsed.anio === true,
    n: typeof parsed.n === "number" && Number.isFinite(parsed.n) ? parsed.n : 1,
    proyectos,
    asesor: typeof parsed.asesor === "string" ? parsed.asesor : "",
    torre: typeof parsed.torre === "string" ? parsed.torre : "",
    fuente: typeof parsed.fuente === "string" ? parsed.fuente : "",
    modelo: typeof parsed.modelo === "string" ? parsed.modelo : "",
    habitaciones: typeof parsed.habitaciones === "string" ? parsed.habitaciones : "",
    motivo: typeof parsed.motivo === "string" ? parsed.motivo : "",
    descuento: typeof parsed.descuento === "string" ? parsed.descuento : "",
    promocion: typeof parsed.promocion === "string" ? parsed.promocion : "",
    caso: typeof parsed.caso === "string" ? parsed.caso : "",
    estadoUnidad: typeof parsed.estadoUnidad === "string" ? parsed.estadoUnidad : "",
    buscar: typeof parsed.buscar === "string" ? parsed.buscar : "",
  };
}

function withCurrent(options: Choice[], id: string): Choice[] {
  if (!id || options.some((option) => option.id === id)) return options;
  return [{ id, label: "Filtro activo" }, ...options];
}

export default function GlanceView({ section }: { section: VistaSection }) {
  const [bar, setBar] = useState<BarState>(INITIAL);
  const [ready, setReady] = useState(false);
  const [vista, setVista] = useState<VentasVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [drill, setDrill] = useState<Drill | null>(null);
  const projectsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setBar(readBar(raw));
    } catch {
      /* keep defaults */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!projectsOpen) return;
    function onPointer(event: MouseEvent) {
      if (!projectsRef.current?.contains(event.target as Node)) setProjectsOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setProjectsOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [projectsOpen]);

  useEffect(() => {
    if (!drill && !targetsOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrill(null);
        setTargetsOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drill, targetsOpen]);

  useEffect(() => {
    if (!ready) return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...bar }));
    } catch {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bar));
    }
    const params = new URLSearchParams({ section, periodo: bar.periodo });
    if (bar.periodo === "custom" && bar.desde && bar.hasta) {
      params.set("desde", bar.desde);
      params.set("hasta", bar.hasta);
    }
    if (section === "ventas-totales") {
      if (bar.comparar) {
        params.set("comparar", "1");
        params.set("n", String(bar.n));
      }
      if (bar.anio) params.set("anio", "1");
    }
    if (bar.proyectos === null) {
      /* Todos los proyectos */
    } else if (bar.proyectos.length === 0) {
      params.append("proyecto", "ninguno");
    } else {
      for (const id of bar.proyectos) params.append("proyecto", id);
    }
    if (bar.asesor && SPECIFIC[section].includes("asesor")) params.set("asesor", bar.asesor);
    for (const key of SPECIFIC[section]) {
      if (key === "asesor") continue;
      const value = bar[key];
      if (value) params.set(key, value);
    }
    const controller = new AbortController();
    let cancelled = false;
    setError(null);
    setLoading(true);
    setDrill(null);
    fetch(`/api/ventas/vista?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as VentasVista & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo leer Ventas");
        if (!cancelled) setVista(body);
      })
      .catch((reason: unknown) => {
        if (cancelled || (reason instanceof DOMException && reason.name === "AbortError")) return;
        setError(reason instanceof Error ? reason.message : "No se pudo leer Ventas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [bar, ready, section]);

  function update(patch: Partial<BarState>) {
    setBar((current) => ({ ...current, ...patch }));
  }

  const choices = vista?.projects ?? [];
  const allIds = choices.map((choice) => choice.id);
  const projectLabel = useMemo(() => {
    if (bar.proyectos === null) return "Todos los proyectos";
    if (bar.proyectos.length === 0) return "Ningún proyecto";
    const names = bar.proyectos.map((id) => choices.find((choice) => choice.id === id)?.label ?? id);
    return names.length <= 2 ? names.join(", ") : `${names.length} proyectos`;
  }, [bar.proyectos, choices]);

  function toggleAll() {
    setBar((current) => ({ ...current, proyectos: current.proyectos === null ? [] : null }));
  }

  function toggleProject(id: string) {
    setBar((current) => {
      const selected = current.proyectos === null ? allIds : current.proyectos;
      const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
      if (allIds.length > 0 && next.length === allIds.length) return { ...current, proyectos: null };
      return { ...current, proyectos: next };
    });
  }

  const show = vista && vista.section === section && !error ? vista : null;
  const specific = SPECIFIC[section];

  return (
    <div className="op-screen">
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
        <div className="op-projects" ref={projectsRef}>
          <span>Proyecto</span>
          <button type="button" aria-expanded={projectsOpen} onClick={() => setProjectsOpen((open) => !open)}>
            {projectLabel}
          </button>
          {projectsOpen ? (
            <div className="op-menu" role="group" aria-label="Proyecto">
              <label>
                <input type="checkbox" checked={bar.proyectos === null} onChange={toggleAll} />
                Todos los proyectos
              </label>
              {choices.map((choice) => {
                const checked = bar.proyectos === null || bar.proyectos.includes(choice.id);
                return (
                  <label key={choice.id}>
                    <input type="checkbox" checked={checked} onChange={() => toggleProject(choice.id)} />
                    {choice.label}
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
        {specific.map((key) => {
          if (key === "buscar") {
            return (
              <label key={key}>
                Buscar unidad
                <input value={bar.buscar} onChange={(event) => update({ buscar: event.target.value })} />
              </label>
            );
          }
          return (
            <label key={key}>
              {FIELD_LABEL[key]}
              <select value={bar[key]} onChange={(event) => update({ [key]: event.target.value })}>
                <option value="">Todos</option>
                {withCurrent(show?.choices[key] ?? [], bar[key]).map((choice) => (
                  <option key={choice.id} value={choice.id}>{choice.label}</option>
                ))}
              </select>
            </label>
          );
        })}
        {section === "ventas-totales" ? (
          <>
            <label className="ventas-check">
              <input type="checkbox" checked={bar.comparar} onChange={(event) => update({ comparar: event.target.checked })} />
              N períodos anteriores
            </label>
            {bar.comparar ? (
              <label>
                N
                <input type="number" min={1} max={12} value={bar.n} onChange={(event) => update({ n: Number(event.target.value) })} />
              </label>
            ) : null}
            <label className="ventas-check">
              <input type="checkbox" checked={bar.anio} onChange={(event) => update({ anio: event.target.checked })} />
              Mismo período del año anterior
            </label>
          </>
        ) : null}
        {show && "editor" in show ? (
          <button type="button" className="op-text" onClick={() => { setTargetsOpen(true); setDrill(null); }}>
            Metas
          </button>
        ) : null}
        <button type="button" className="op-text" onClick={() => setBar(INITIAL)}>Restablecer</button>
        <p className="op-range">
          {show ? `${show.periodLabel}. ${show.rangeLabel}.` : ""}
          {loading ? " Actualizando…" : ""}
          {!show && !error && !loading ? "Cargando…" : ""}
        </p>
      </div>

      {show ? <p className="op-question">{show.question}</p> : null}
      {error ? <p className="op-note op-warn">{error}</p> : null}
      {show?.notice ? <p className="op-note">{show.notice}</p> : null}
      {show?.section === "ventas-totales" ? <Totales vista={show} onProject={(id, label) => setDrill({ kind: "project", id, label })} /> : null}
      {show?.section === "objetivos-de-ventas" ? (
        <Objetivos
          vista={show}
          onProject={(id, label) => setDrill({ kind: "project", id, label })}
          onAsesor={(id, label) => setDrill({ kind: "asesor", id, label })}
        />
      ) : null}
      {show?.section === "status-de-ventas" ? (
        <Status
          vista={show}
          onProject={(id, label) => setDrill({ kind: "project", id, label })}
          onAsesor={(id, label) => setDrill({ kind: "asesor", id, label })}
        />
      ) : null}
      {show?.section === "ventas-por-canales" ? <Canales vista={show} onFuente={(id, label) => setDrill({ kind: "fuente", id, label })} /> : null}
      {show && isStockVista(show) ? <StockScreens vista={show} bar={bar} /> : null}
      {show && isControlVista(show) ? <ControlScreens vista={show} /> : null}

      {targetsOpen && show && "editor" in show ? (
        <TargetDrawer editor={show.editor} onClose={() => setTargetsOpen(false)} onSaved={() => setBar((current) => ({ ...current }))} />
      ) : null}
      {drill && show ? <DrillDrawer vista={show} drill={drill} onClose={() => setDrill(null)} /> : null}
    </div>
  );
}

function Kpi({ label, value, detail, color }: { label: string; value: string; detail: string; color?: string }) {
  return (
    <p>
      <strong style={color ? { color } : undefined}>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </p>
  );
}

function Totales({ vista, onProject }: { vista: Extract<VentasVista, { section: "ventas-totales" }>; onProject: (id: string, label: string) => void }) {
  const delta = vista.priorNetUnits == null ? null : vista.netUnits - vista.priorNetUnits;
  return (
    <>
      <div className="op-kpis">
        <Kpi label="Neto" value={count(vista.netUnits)} detail={delta == null ? "unidades" : `${signed(delta)} vs anterior`} color={delta == null ? undefined : gapColor(delta)} />
        <Kpi label="Quetzales netos" value={money(vista.netGtq)} detail={`${count(vista.grossUnits)} brutas`} />
        <Kpi label="Desistimientos" value={count(vista.lossUnits)} detail={money(vista.lossGtq)} color={vista.lossUnits > 0 ? "#b91c1c" : undefined} />
        <Kpi label="Brutas" value={count(vista.grossUnits)} detail={money(vista.grossGtq)} />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Ventas del periodo">
        <header className="op-head">
          <div>
            <h2>Neto del periodo</h2>
            <p className="op-note">{vista.caption}</p>
          </div>
        </header>
        <div className="op-chart">
          {vista.daily.length === 0 ? <p className="op-note">Nada que graficar en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={vista.daily} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip formatter={(value, name) => [count(tipNumber(value)), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="dia" name="Del día" fill="#d6e4ee" isAnimationActive={false} />
                <Line type="monotone" dataKey="neto" name="Acumulado" stroke="#0d2041" strokeWidth={2} dot={false} isAnimationActive={false} />
                {vista.priorLabel ? <Line type="monotone" dataKey="anterior" name={vista.priorLabel} stroke="#94a3b8" strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} /> : null}
                {vista.yearLabel ? <Line type="monotone" dataKey="anio" name={vista.yearLabel} stroke="#0573b0" strokeDasharray="2 3" dot={false} connectNulls={false} isAnimationActive={false} /> : null}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      <section className="op-hero" aria-label="Neto por proyecto" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Neto por proyecto</h2></div></header>
        <Bars
          rows={vista.byProject}
          nameKey="label"
          valueKey="units"
          format={(value) => count(value)}
          colorOf={(row) => projectColor(row.label)}
          onPick={(row) => onProject(row.id, row.label)}
        />
      </section>
    </>
  );
}

function Objetivos({
  vista,
  onProject,
  onAsesor,
}: {
  vista: Extract<VentasVista, { section: "objetivos-de-ventas" }>;
  onProject: (id: string, label: string) => void;
  onAsesor: (id: string, label: string) => void;
}) {
  const asesorRows = asesorChart(vista.byAsesor);
  return (
    <>
      <div className="op-kpis">
        <Kpi label="Cumplimiento" value={pct(vista.ratio)} detail={vista.targetUnits == null ? "Sin meta" : `Meta ${count(vista.targetUnits)}`} color={gapColor(vista.gapUnits)} />
        <Kpi label="Unidades" value={count(vista.units)} detail={signed(vista.gapUnits)} color={gapColor(vista.gapUnits)} />
        <Kpi label="Quetzales" value={money(vista.gtq)} detail={vista.targetGtq == null ? "Sin meta en quetzales" : `Meta ${money(vista.targetGtq)}`} />
        <Kpi label="Brecha" value={signed(vista.gapUnits)} detail="Real menos meta" color={gapColor(vista.gapUnits)} />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Real contra meta por proyecto">
        <header className="op-head">
          <div>
            <h2>Real contra meta</h2>
            <p className="op-note">{vista.caption}</p>
          </div>
        </header>
        <Grouped
          rows={vista.byProject}
          bars={[
            { key: "units", name: "Real", fill: "#0d2041" },
            { key: "targetUnits", name: "Meta", fill: "#0573b0" },
          ]}
          onPick={(row) => onProject(row.id, row.label)}
        />
      </section>
      <section className="op-hero" aria-label="Brecha por asesor" style={{ flex: 1 }}>
        <header className="op-head">
          <div>
            <h2>{asesorRows.mode === "gap" ? "Brecha por asesor" : "Ventas por asesor"}</h2>
            <p className="op-note">{asesorRows.note}</p>
          </div>
        </header>
        <Bars
          rows={asesorRows.rows}
          nameKey="label"
          valueKey={asesorRows.mode}
          format={(value) => (asesorRows.mode === "gap" ? signed(value) : count(value))}
          colorOf={(row) => (asesorRows.mode === "gap" ? gapColor(row.gap) : "#0d2041")}
          onPick={(row) => onAsesor(row.id, row.label)}
        />
      </section>
    </>
  );
}

function Status({
  vista,
  onProject,
  onAsesor,
}: {
  vista: Extract<VentasVista, { section: "status-de-ventas" }>;
  onProject: (id: string, label: string) => void;
  onAsesor: (id: string, label: string) => void;
}) {
  const asesorRows = asesorChart(vista.byAsesor);
  return (
    <>
      <div className="op-kpis">
        <Kpi label={toneWord(vista.tone)} value={signed(vista.gapUnits)} detail="unidades contra el ritmo" color={toneColor(vista.tone)} />
        <Kpi label="Quetzales" value={signed(vista.gapGtq)} detail={`Real ${money(vista.gtq)}`} color={toneColor(vista.tone)} />
        <Kpi label="Ritmo" value={count(vista.paceUnits)} detail={`Meta ${count(vista.targetUnits)}`} />
        <Kpi label="Fecha de cierre" value={dotted(vista.closeOn)} detail={vista.dayLabel} />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Ritmo hacia la fecha de cierre">
        <header className="op-head">
          <div>
            <h2>Ritmo hacia la fecha de cierre</h2>
            <p className="op-note">{vista.caption}</p>
          </div>
        </header>
        <div className="op-chart">
          {vista.rhythm.length === 0 ? <p className="op-note">Nada que graficar en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vista.rhythm} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip formatter={(value, name) => [count(tipNumber(value)), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="real" name="Real" stroke="#0d2041" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ritmo" name="Ritmo" stroke="#0573b0" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      <div className="op-mid">
        <section className="op-hero" aria-label="Ritmo por proyecto">
          <header className="op-head"><div><h2>Por proyecto</h2></div></header>
          <Grouped
            rows={vista.byProject}
            bars={[
              { key: "units", name: "Real", fill: "#0d2041" },
              { key: "paceUnits", name: "Ritmo", fill: "#0573b0" },
              { key: "targetUnits", name: "Meta", fill: "#94a3b8" },
            ]}
            onPick={(row) => onProject(row.id, row.label)}
          />
        </section>
        <section className="op-hero" aria-label="Brecha por asesor">
          <header className="op-head">
            <div>
              <h2>{asesorRows.mode === "gap" ? "Brecha por asesor" : "Ventas por asesor"}</h2>
              <p className="op-note">{asesorRows.note}</p>
            </div>
          </header>
          <Bars
            rows={asesorRows.rows}
            nameKey="label"
            valueKey={asesorRows.mode}
            format={(value) => (asesorRows.mode === "gap" ? signed(value) : count(value))}
            colorOf={(row) => (asesorRows.mode === "gap" ? gapColor(row.gap) : "#0d2041")}
            onPick={(row) => onAsesor(row.id, row.label)}
          />
        </section>
      </div>
    </>
  );
}

function Canales({ vista, onFuente }: { vista: Extract<VentasVista, { section: "ventas-por-canales" }>; onFuente: (id: string, label: string) => void }) {
  const data = vista.months.map((label, index) => {
    const row: Record<string, string | number> = { label };
    for (const series of vista.series) row[series.id] = series.units[index] ?? 0;
    return row;
  });
  return (
    <>
      <div className="op-kpis">
        <Kpi label="Ventas" value={count(vista.units)} detail="en el periodo" />
        <Kpi label="Canal líder" value={vista.leader ? clip(vista.leader) : "—"} detail={vista.leaderShare == null ? "Sin ventas" : pct(vista.leaderShare)} />
        <Kpi label="Quetzales" value={money(vista.gtq)} detail="valor del trato" />
        <Kpi label="Canales" value={count(vista.channels.filter((row) => row.id !== "otras").length)} detail={vista.channels.some((row) => row.id === "otras") ? "el resto va en Otras fuentes" : "con venta"} />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Ventas por canal">
        <header className="op-head">
          <div>
            <h2>Ventas por canal</h2>
            <p className="op-note">{vista.caption}</p>
          </div>
        </header>
        <Bars
          rows={vista.channels}
          nameKey="label"
          valueKey="units"
          format={(value) => count(value)}
          colorOf={(row) => (row.id === vista.channels[0]?.id ? "#0d2041" : "#0573b0")}
          onPick={(row) => onFuente(row.id, row.label)}
        />
      </section>
      <section className="op-hero" aria-label="Canales por mes" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Los cuatro canales, mes a mes</h2></div></header>
        <div className="op-chart">
          {vista.series.length === 0 ? <p className="op-note">Nada que graficar en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip formatter={(value, name) => [count(tipNumber(value)), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {vista.series.map((series, index) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.id}
                    name={series.label}
                    stroke={SERIES_COLOR[index] ?? "#0573b0"}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </>
  );
}

function asesorChart<T extends { id: string; label: string; units: number; gapUnits: number | null; targetUnits: number | null }>(rows: T[]) {
  const withMeta = rows.filter((row) => row.gapUnits != null);
  const source = (withMeta.length > 0 ? withMeta : rows).slice(0, 12);
  const hidden = rows.length - source.length;
  return {
    mode: (withMeta.length > 0 ? "gap" : "units") as "gap" | "units",
    note: hidden > 0 ? `${source.length} de ${rows.length}. El déficit más grande primero.` : "El déficit más grande primero.",
    rows: source.map((row) => ({ ...row, gap: row.gapUnits ?? 0 })),
  };
}

function Bars<T extends Record<string, string | number | null>>({
  rows,
  nameKey,
  valueKey,
  format,
  colorOf,
  onPick,
}: {
  rows: T[];
  nameKey: keyof T & string;
  valueKey: keyof T & string;
  format: (value: number | null) => string;
  colorOf: (row: T) => string;
  onPick?: (row: T) => void;
}) {
  if (rows.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <div className="op-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={rows} margin={{ left: 8, right: 48, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tickFormatter={(value) => format(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey={nameKey as never} width={148} tick={{ fontSize: 11, fill: "#0d2041" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value) => [format(tipNumber(value)), ""]} />
          <Bar
            dataKey={valueKey as never}
            barSize={12}
            isAnimationActive={false}
            cursor={onPick ? "pointer" : undefined}
            onClick={(row) => {
              const payload = (row as { payload?: T }).payload;
              if (payload && onPick) onPick(payload);
            }}
          >
            {rows.map((row, index) => <Cell key={`${String(row[nameKey])}-${index}`} fill={colorOf(row)} />)}
            <LabelList dataKey={valueKey as never} position="right" formatter={(value) => format(tipNumber(value))} fill="#334155" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Grouped<T extends { id: string; label: string }>({
  rows,
  bars,
  onPick,
}: {
  rows: T[];
  bars: { key: keyof T & string; name: string; fill: string }[];
  onPick?: (row: T) => void;
}) {
  if (rows.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <div className="op-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
          <Tooltip formatter={(value, name) => [count(tipNumber(value)), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key as never}
              name={bar.name}
              fill={bar.fill}
              barSize={14}
              isAnimationActive={false}
              cursor={onPick ? "pointer" : undefined}
              onClick={(row) => {
                const payload = (row as { payload?: T }).payload;
                if (payload && onPick) onPick(payload);
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DrillDrawer({ vista, drill, onClose }: { vista: VentasVista; drill: Drill; onClose: () => void }) {
  const topCanales = vista.section === "ventas-por-canales"
    ? new Set(vista.channels.filter((row) => row.id !== "otras").map((row) => row.id))
    : null;
  const rows = vista.lines.filter((line) => {
    if (drill.kind === "project") return line.projectId === drill.id;
    if (drill.kind === "asesor") return line.asesorId === drill.id;
    if (drill.id === "otras") return topCanales ? !topCanales.has(line.fuenteId) : false;
    return line.fuenteId === drill.id;
  });
  return (
    <Overlay title={drill.label} onClose={onClose}>
      <p className="op-note">
        {count(rows.length)} en esta lista. {count(vista.listTotal)} en el periodo.
        {vista.listShown < vista.listTotal ? " La lista muestra las más recientes." : ""}
      </p>
      <div className="op-modal-scroll" style={{ maxHeight: "65vh" }}>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Proyecto</th>
              <th>Asesor</th>
              <th>Canal</th>
              <th>Torre</th>
              <th>Quetzales</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.kind}-${row.dealId}-${row.day}`}>
                <td>{dotted(row.day)}</td>
                <td>{row.kind === "venta" ? "Venta" : "Desistimiento"}</td>
                <td>{row.project}</td>
                <td>{row.asesor}</td>
                <td>{row.fuente}</td>
                <td>{row.torre}</td>
                <td>{money(row.gtq)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Overlay>
  );
}

function TargetDrawer({ editor, onClose, onSaved }: { editor: TargetEditor; onClose: () => void; onSaved: () => void }) {
  const [month, setMonth] = useState(editor.months.at(-1)?.month ?? "");
  const [projectId, setProjectId] = useState(editor.projects[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Record<string, { units: string; gtq: string }>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, { units: string; gtq: string }> = {};
    for (const cell of editor.cells) {
      if (cell.month !== month || cell.projectId !== projectId) continue;
      next[cell.asesorId] = {
        units: cell.units == null ? "" : String(cell.units),
        gtq: cell.gtq == null ? "" : String(cell.gtq),
      };
    }
    setDraft(next);
  }, [editor, month, projectId]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const withDraft = editor.asesores.filter((asesor) => {
      const row = draft[asesor.id];
      return Boolean(row && (row.units || row.gtq));
    });
    const base = needle
      ? editor.asesores.filter((asesor) => asesor.label.toLowerCase().includes(needle))
      : editor.asesores.length <= 18
        ? editor.asesores
        : editor.asesores.slice(0, 18);
    const seen = new Set(base.map((asesor) => asesor.id));
    return [...base, ...withDraft.filter((asesor) => !seen.has(asesor.id))];
  }, [draft, editor.asesores, query]);

  const history = editor.history.filter((event) => event.month === month && (!projectId || event.project === editor.projects.find((project) => project.id === projectId)?.label)).slice(0, 8);

  async function save() {
    setSaving(true);
    setMessage(null);
    const entries = Object.entries(draft).flatMap(([asesorId, value]) => {
      const unitsText = value.units.trim();
      const gtqText = value.gtq.trim();
      if (!unitsText && !gtqText) return [];
      return [{
        asesorId,
        projectId,
        ...(unitsText ? { units: Number(unitsText) } : {}),
        ...(gtqText ? { gtq: Number(gtqText) } : {}),
      }];
    });
    if (entries.some((entry) => ("units" in entry && !Number.isInteger(entry.units)) || ("gtq" in entry && (entry.gtq == null || !Number.isFinite(entry.gtq) || entry.gtq < 0)))) {
      setMessage("Las unidades son un entero. Los quetzales son un número de cero para arriba.");
      setSaving(false);
      return;
    }
    if (!month || !projectId || entries.length === 0) {
      setMessage("Escribe al menos una meta.");
      setSaving(false);
      return;
    }
    try {
      const response = await fetch("/api/ventas/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, entries }),
      });
      const body = (await response.json()) as { error?: string; inserted?: number; snapshot?: boolean };
      if (!response.ok) throw new Error(body.error ?? "No se guardó la meta");
      if (body.inserted === 0) setMessage("Esa meta ya estaba guardada.");
      else if (body.snapshot === false) setMessage("Meta guardada en el historial. El calendario de ese mes no está cargado, así que la vista anterior no la toma.");
      else setMessage("Meta guardada. El mes anterior no cambia.");
      onSaved();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se guardó la meta");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay title="Metas del mes" onClose={onClose}>
      {editor.tableReady ? null : (
        <p className="op-note op-warn">Hay que correr la migración 081 en el editor SQL de Supabase. Hasta entonces la meta no se guarda.</p>
      )}
      <label>
        Mes
        <select value={month} onChange={(event) => setMonth(event.target.value)}>
          {editor.months.map((item) => <option key={item.month} value={item.month}>{item.label}</option>)}
        </select>
      </label>
      <label>
        Proyecto
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          {editor.projects.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label>
        Buscar asesor
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <p className="op-note">Un campo vacío no se escribe. Guardar inserta una fila nueva y deja las anteriores.</p>
      <div className="op-target-head"><span>Asesor</span><span>Unidades</span><span>Quetzales</span></div>
      {shown.map((asesor) => (
        <label key={asesor.id} className="op-target-meta">
          <span>{asesor.label}</span>
          <input
            inputMode="numeric"
            aria-label={`Unidades ${asesor.label}`}
            value={draft[asesor.id]?.units ?? ""}
            disabled={!editor.tableReady}
            onChange={(event) => setDraft((current) => ({ ...current, [asesor.id]: { units: event.target.value, gtq: current[asesor.id]?.gtq ?? "" } }))}
          />
          <input
            inputMode="decimal"
            aria-label={`Quetzales ${asesor.label}`}
            value={draft[asesor.id]?.gtq ?? ""}
            disabled={!editor.tableReady}
            onChange={(event) => setDraft((current) => ({ ...current, [asesor.id]: { units: current[asesor.id]?.units ?? "", gtq: event.target.value } }))}
          />
        </label>
      ))}
      {editor.asesores.length > shown.length ? <p className="op-note">Escribe el nombre para ver los demás.</p> : null}
      <button type="button" className="op-save" disabled={saving || !editor.tableReady} onClick={save}>
        {saving ? "Guardando…" : "Guardar mes"}
      </button>
      {message ? <p className="op-note">{message}</p> : null}
      {history.length > 0 ? (
        <ul className="op-history">
          {history.map((event) => (
            <li key={`${event.asesor}-${event.project}-${event.enteredAt}`}>
              {event.asesor} · {count(event.units)} u · {money(event.gtq)} · {event.enteredAt.slice(0, 16).replace("T", " ")}
            </li>
          ))}
        </ul>
      ) : null}
    </Overlay>
  );
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="op-overlay">
      <button type="button" className="op-backdrop" aria-label="Cerrar" onClick={onClose} />
      <aside className="op-drawer" role="dialog" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>Cerrar</button>
        </header>
        {children}
      </aside>
    </div>
  );
}
