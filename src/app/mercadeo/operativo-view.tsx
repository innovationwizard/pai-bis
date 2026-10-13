"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import type { BudgetStatus, OperativoReport } from "@/lib/mercadeo/operativo-types";

const STORAGE_KEY = "pai-mercadeo-filtros";

const PROJECT_COLOR: Record<string, string> = {
  benestare: "#0d2041",
  "bosque-las-tapias": "#0573b0",
  "boulevard-5": "#3d6f8f",
  "casa-elisa": "#6d8ea3",
  "santa-elena": "#1a4a68",
  "puerta-abierta": "#94a3b8",
};

const STATUS_COLOR: Record<BudgetStatus, string> = {
  agotado: "#b91c1c",
  "sobre-ritmo": "#b45309",
  "en-ritmo": "#0573b0",
  "bajo-presupuesto": "#0d2041",
  "sin-presupuesto": "#94a3b8",
};

const STATUS_LABEL: Record<BudgetStatus, string> = {
  agotado: "Agotado",
  "sobre-ritmo": "Sobre el ritmo",
  "en-ritmo": "En ritmo",
  "bajo-presupuesto": "Bajo el presupuesto",
  "sin-presupuesto": "Sin presupuesto",
};

const LINKS = [
  { href: "/mercadeo", label: "Operativo" },
  { href: "/mercadeo/reporte-maestro", label: "Meta de leads y ROAS" },
  { href: "/mercadeo/efectividad", label: "Efectividad de campañas" },
  { href: "/mercadeo/inversion-acumulada", label: "Gestión de pauta" },
  { href: "/mercadeo/canales", label: "Operatividad de canales" },
] as const;

type Mode = "operativo" | "directivo";
type Drill =
  | { kind: "fuente"; label: string }
  | { kind: "cierre"; slug: string }
  | { kind: "cpl"; month: string; slug: string };

type BarState = {
  periodo: string;
  desde: string;
  hasta: string;
  comparar: boolean;
  n: number;
  anio: boolean;
  proyectos: string[] | null;
};

const INITIAL: BarState = {
  periodo: "este-mes",
  desde: "",
  hasta: "",
  comparar: false,
  n: 1,
  anio: false,
  proyectos: null,
};

const moneyFormat = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 });
const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return moneyFormat.format(value);
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Sin presupuesto";
  const n = value * 100;
  const digits = n >= 10 ? 0 : 1;
  return `${new Intl.NumberFormat("es-GT", { maximumFractionDigits: digits }).format(n)}%`;
}

function count(value: number): string {
  return countFormat.format(value);
}

function tipNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function readBar(raw: string): BarState {
  const parsed = JSON.parse(raw) as Partial<BarState>;
  const proyectos = Array.isArray(parsed.proyectos)
    ? parsed.proyectos.filter((id): id is string => typeof id === "string")
    : parsed.proyectos === null
      ? null
      : INITIAL.proyectos;
  return { ...INITIAL, ...parsed, proyectos };
}

export default function OperativoView() {
  const [mode, setMode] = useState<Mode>("operativo");
  const [bar, setBar] = useState<BarState>(INITIAL);
  const [ready, setReady] = useState(false);
  const [report, setReport] = useState<OperativoReport | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bar));
    const params = new URLSearchParams({ periodo: bar.periodo });
    if (bar.periodo === "custom" && bar.desde && bar.hasta) {
      params.set("desde", bar.desde);
      params.set("hasta", bar.hasta);
    }
    if (bar.proyectos === null) {
      /* Todos */
    } else if (bar.proyectos.length === 0) {
      params.append("proyecto", "ninguno");
    } else {
      for (const slug of bar.proyectos) params.append("proyecto", slug);
    }
    const controller = new AbortController();
    setError(null);
    fetch(`/api/mercadeo/operativo?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as OperativoReport & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo leer Mercadeo");
        setReport(body);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "No se pudo leer Mercadeo");
      });
    return () => controller.abort();
  }, [bar, ready]);

  function update(patch: Partial<BarState>) {
    setBar((current) => ({ ...current, ...patch }));
  }

  const choices = report?.projects ?? [];
  const allIds = choices.map((choice) => choice.slug);
  const projectLabel = useMemo(() => {
    if (bar.proyectos === null) return "Todos los proyectos";
    if (bar.proyectos.length === 0) return "Ningún proyecto";
    const names = bar.proyectos.map((slug) => choices.find((choice) => choice.slug === slug)?.label ?? slug);
    return names.length <= 2 ? names.join(", ") : `${names.length} proyectos`;
  }, [bar.proyectos, choices]);

  function toggleAll() {
    setBar((current) => ({ ...current, proyectos: current.proyectos === null ? [] : null }));
  }

  function toggleProject(slug: string) {
    setBar((current) => {
      const selected = current.proyectos === null ? allIds : current.proyectos;
      const next = selected.includes(slug) ? selected.filter((item) => item !== slug) : [...selected, slug];
      if (allIds.length > 0 && next.length === allIds.length) return { ...current, proyectos: null };
      return { ...current, proyectos: next };
    });
  }

  function focusProject(slug: string) {
    setBar((current) => {
      if (current.proyectos?.length === 1 && current.proyectos[0] === slug) return { ...current, proyectos: null };
      return { ...current, proyectos: [slug] };
    });
  }

  return (
    <div className="op-screen">
      <div className="op-toolbar">
        <div className="op-mode" role="group" aria-label="Vista">
          <button type="button" aria-pressed={mode === "operativo"} onClick={() => setMode("operativo")}>Operativo</button>
          <button type="button" aria-pressed={mode === "directivo"} onClick={() => setMode("directivo")}>Directivo</button>
        </div>
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
                const checked = bar.proyectos === null || bar.proyectos.includes(choice.slug);
                return (
                  <label key={choice.slug}>
                    <input type="checkbox" checked={checked} onChange={() => toggleProject(choice.slug)} />
                    {choice.label}
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
        <button type="button" className="op-text" onClick={() => { setTargetsOpen(true); setDrill(null); }}>
          Presupuesto
        </button>
        <p className="op-range">{report ? `${report.periodLabel}. ${report.rangeLabel}.` : error ? "" : "Cargando…"}</p>
      </div>

      <nav className="op-subnav" aria-label="Mercadeo">
        {LINKS.map((link) => (
          <a key={link.label} href={link.href} aria-current={link.href === "/mercadeo" && link.label === "Operativo" ? "page" : undefined}>
            {link.label}
          </a>
        ))}
      </nav>

      {mode === "directivo" ? <Directivo /> : null}
      {mode === "operativo" && error ? <p className="op-note op-warn">{error}</p> : null}
      {mode === "operativo" && report?.notice ? <p className="op-note">{report.notice}</p> : null}
      {mode === "operativo" && report && !error ? (
        <>
          <BudgetHero report={report} onProject={focusProject} />
          <div className="op-mid">
            <CplHero report={report} onPoint={(month, slug) => setDrill({ kind: "cpl", month, slug })} />
            <FuenteHero report={report} onFuente={(label) => setDrill({ kind: "fuente", label })} />
          </div>
          <CierreHero report={report} onProject={(slug) => setDrill({ kind: "cierre", slug })} />
        </>
      ) : null}

      {targetsOpen && report ? (
        <TargetDrawer
          report={report}
          onClose={() => setTargetsOpen(false)}
          onSaved={() => setBar((current) => ({ ...current }))}
        />
      ) : null}
      {drill && report ? <DrillDrawer report={report} drill={drill} onClose={() => setDrill(null)} /> : null}
    </div>
  );
}

function Directivo() {
  return (
    <section className="op-hero op-directivo">
      <h2>Vista directiva</h2>
      <p>
        Esta vista todavía no está dibujada. Operativo es la que decide: consumo de presupuesto, costo por lead,
        fuente de las reservas y costo por cierre.
      </p>
    </section>
  );
}

function BudgetHero({ report, onProject }: { report: OperativoReport; onProject: (slug: string) => void }) {
  const headline = report.budgetHeadline;
  const rows = report.budget.map((row) => ({
    ...row,
    target: row.targetGtq,
    tag: row.ratio == null ? "s/p" : pct(row.ratio),
  }));
  const pace = report.partial && headline.paceRatio != null
    ? `Ritmo a hoy ${pct(headline.paceRatio)} del tramo corrido. El presupuesto es del mes completo.`
    : "Mes cerrado. La barra compara el gasto del corte con el presupuesto del mes.";
  return (
    <section className="op-hero op-hero-budget" aria-label="Consumo de presupuesto de pauta">
      <header className="op-head">
        <div>
          <h2>Consumo de presupuesto</h2>
          <p className="op-figure">
            <span style={{ color: STATUS_COLOR[headline.status] }}>{pct(headline.ratio)}</span>
            <small>{money(headline.actualGtq)} de {money(headline.targetGtq)} · {headline.scope}</small>
          </p>
          <p className="op-note">{pace}</p>
        </div>
        <ul className="op-legend">
          {(["agotado", "sobre-ritmo", "en-ritmo", "bajo-presupuesto"] as const).map((status) => (
            <li key={status}><i style={{ background: STATUS_COLOR[status] }} />{STATUS_LABEL[status]}</li>
          ))}
        </ul>
      </header>
      <div className="op-chart">
        {rows.length === 0 ? <p className="op-note">No hay proyectos en este corte.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={rows} margin={{ left: 8, right: 36, top: 4, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => money(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={128} tick={{ fontSize: 12, fill: "#0d2041" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value, name) => [money(tipNumber(value)), name === "actualGtq" ? "Gasto" : "Presupuesto"]} />
              <Bar dataKey="target" name="target" fill="#e2e8f0" barSize={10} isAnimationActive={false} />
              <Bar dataKey="actualGtq" name="actualGtq" barSize={10} isAnimationActive={false} onClick={(row) => {
                const slug = (row.payload as { slug?: string } | undefined)?.slug;
                if (slug) onProject(slug);
              }}>
                {rows.map((row) => <Cell key={row.slug} fill={STATUS_COLOR[row.status]} />)}
                <LabelList dataKey="tag" position="right" fill="#334155" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {report.puertaBudget ? (
        <p className="op-note">
          Puerta Abierta {money(report.puertaBudget.actualGtq)} de {money(report.puertaBudget.targetGtq)}. No suma a los proyectos.
        </p>
      ) : null}
      <details className="op-def">
        <summary>Definición</summary>
        <p>
          El gasto es Meta y Google de los días del corte, más TikTok, LinkedIn, Pauta Digital y Wati cuando el corte cubre el mes completo.
          Un real vacío no entra como cero. El presupuesto ingresado de ese mes gana. Si no hay uno, se usa el presupuesto cargado.
          Un dólar de pauta se convierte a 7.80. Una cuenta en quetzales no se multiplica.
        </p>
      </details>
    </section>
  );
}

function CplHero({ report, onPoint }: { report: OperativoReport; onPoint: (month: string, slug: string) => void }) {
  const data = (report.cpl[0]?.points ?? []).map((point, index) => {
    const row: Record<string, string | number | null> = { label: point.label, month: point.month };
    for (const series of report.cpl) row[series.slug] = series.points[index]?.cpl ?? null;
    return row;
  });
  return (
    <section className="op-hero" aria-label="Evolución de costo por lead por proyecto">
      <header className="op-head">
        <div>
          <h2>Costo por lead</h2>
          <p className="op-note">{report.cplCaption}</p>
        </div>
      </header>
      <div className="op-chart">
        {data.length === 0 ? <p className="op-note">No hay meses en este corte.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
              onClick={(state) => {
                const index = typeof state.activeTooltipIndex === "number" ? state.activeTooltipIndex : Number(state.activeTooltipIndex);
                const slug = typeof state.activeDataKey === "string" ? state.activeDataKey : null;
                if (!Number.isInteger(index) || index < 0 || !slug) return;
                const point = report.cpl.find((series) => series.slug === slug)?.points[index];
                if (point) onPoint(point.month, slug);
              }}
            >
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => money(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} width={64} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value, name) => [money(tipNumber(value)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {report.cpl.map((series) => (
                <Line
                  key={series.slug}
                  type="monotone"
                  dataKey={series.slug}
                  name={series.label}
                  stroke={PROJECT_COLOR[series.slug] ?? "#0573b0"}
                  strokeWidth={2}
                  strokeDasharray={series.dashed ? "4 3" : undefined}
                  connectNulls={false}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function FuenteHero({ report, onFuente }: { report: OperativoReport; onFuente: (label: string) => void }) {
  return (
    <section className="op-hero" aria-label="Reservas por fuente">
      <header className="op-head">
        <div>
          <h2>Reservas por fuente</h2>
          <p className="op-figure">
            <span>{count(report.reservaUnits)}</span>
            <small>reservas en el corte</small>
          </p>
        </div>
      </header>
      <div className="op-chart">
        {report.fuentes.length === 0 ? <p className="op-note">No hay reservas en este corte.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={report.fuentes} margin={{ left: 8, right: 28, top: 4, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={108} tick={{ fontSize: 12, fill: "#0d2041" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [count(tipNumber(value) ?? 0), "Reservas"]} />
              <Bar dataKey="units" barSize={12} isAnimationActive={false} onClick={(row) => {
                const label = (row.payload as { label?: string } | undefined)?.label;
                if (label) onFuente(label);
              }}>
                {report.fuentes.map((row) => (
                  <Cell key={row.label} fill={row.label === "Sin dato" || row.label === "Otras fuentes" ? "#94a3b8" : "#0d2041"} />
                ))}
                <LabelList dataKey="units" position="right" fill="#334155" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function CierreHero({ report, onProject }: { report: OperativoReport; onProject: (slug: string) => void }) {
  const rows = report.cierre.filter((row) => row.costo != null);
  const missing = report.cierre.filter((row) => row.costo == null).map((row) => row.label);
  const headline = report.cierreHeadline;
  return (
    <section className="op-hero op-hero-cierre" aria-label="Costo por cierre">
      <header className="op-head">
        <div>
          <h2>Costo por cierre</h2>
          <p className="op-figure">
            <span>{headline.costo == null ? "Sin ventas" : money(headline.costo)}</span>
            <small>{count(headline.ventas)} ventas · pauta {money(headline.pautaGtq)} · {headline.scope}</small>
          </p>
        </div>
      </header>
      <div className="op-chart">
        {rows.length === 0 ? <p className="op-note">No hay ventas con pauta en este corte.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={rows} margin={{ left: 8, right: 48, top: 4, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => money(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={128} tick={{ fontSize: 12, fill: "#0d2041" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [money(tipNumber(value)), "Costo por cierre"]} />
              <Bar dataKey="costo" barSize={12} isAnimationActive={false} onClick={(row) => {
                const slug = (row.payload as { slug?: string } | undefined)?.slug;
                if (slug) onProject(slug);
              }}>
                {rows.map((row) => <Cell key={row.slug} fill={PROJECT_COLOR[row.slug] ?? "#0573b0"} />)}
                <LabelList dataKey="costo" position="right" formatter={(value) => money(tipNumber(value))} fill="#334155" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {missing.length > 0 ? <p className="op-note">Sin ventas o sin pauta: {missing.join(", ")}.</p> : null}
      <details className="op-def">
        <summary>Definición</summary>
        <p>Pauta del período ÷ cantidad de ventas del período. Una venta es la unidad que ya tiene el Recibo publicado y la Recepción de Promesa Firmada. La fecha de la venta es la más tardía de esas dos, y esa fecha tiene que caer en el período. Un valor vacío se queda en el conteo y se muestra como sin monto. Puerta Abierta no entra en el total de los proyectos.</p>
      </details>
    </section>
  );
}

function TargetDrawer({
  report,
  onClose,
  onSaved,
}: {
  report: OperativoReport;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [month, setMonth] = useState(report.months.at(-1)?.month ?? "");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const cell of report.targets) {
      if (cell.month !== month) continue;
      next[cell.slug] = cell.enteredGtq == null ? "" : String(cell.enteredGtq);
    }
    setDraft(next);
  }, [report, month]);

  const cells = report.targets.filter((cell) => cell.month === month);
  const history = report.targetHistory.filter((event) => event.month === month).slice(0, 8);

  async function save() {
    setSaving(true);
    setMessage(null);
    const entries = Object.entries(draft)
      .filter(([, value]) => value.trim() !== "")
      .map(([slug, value]) => ({ slug, amountGtq: Number(value) }));
    if (entries.some((entry) => !Number.isFinite(entry.amountGtq) || entry.amountGtq < 0)) {
      setMessage("Cada monto es un número en quetzales, cero o mayor.");
      setSaving(false);
      return;
    }
    if (entries.length === 0) {
      setMessage("Escribe al menos un presupuesto.");
      setSaving(false);
      return;
    }
    try {
      const response = await fetch("/api/mercadeo/pauta-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, entries }),
      });
      const body = (await response.json()) as { error?: string; inserted?: number };
      if (!response.ok) throw new Error(body.error ?? "No se guardó el presupuesto");
      setMessage(body.inserted === 0 ? "Ese presupuesto ya estaba guardado." : "Presupuesto guardado. El mes anterior no cambia.");
      onSaved();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se guardó el presupuesto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay title="Presupuesto del mes" onClose={onClose}>
      {report.targetTableReady ? null : (
        <p className="op-note op-warn">Hay que correr la migración 080 en el editor SQL de Supabase. Hasta entonces el gráfico usa el presupuesto cargado.</p>
      )}
      <label>
        Mes
        <select value={month} onChange={(event) => setMonth(event.target.value)}>
          {report.months.map((item) => <option key={item.month} value={item.month}>{item.label}</option>)}
        </select>
      </label>
      <p className="op-note">Un monto vacío no se escribe. Guardar inserta una fila nueva y deja las anteriores.</p>
      {cells.map((cell) => (
        <label key={cell.slug} className="op-target">
          <span>{cell.label}</span>
          <input
            inputMode="decimal"
            aria-label={`Presupuesto ${cell.label}`}
            value={draft[cell.slug] ?? ""}
            disabled={!report.targetTableReady}
            onChange={(event) => setDraft((current) => ({ ...current, [cell.slug]: event.target.value }))}
          />
          <small>{cell.loadedGtq == null ? "Sin carga" : `Cargado ${money(cell.loadedGtq)}`}</small>
        </label>
      ))}
      <button type="button" className="op-save" disabled={saving || !report.targetTableReady} onClick={save}>
        {saving ? "Guardando…" : "Guardar mes"}
      </button>
      {message ? <p className="op-note">{message}</p> : null}
      {history.length > 0 ? (
        <ul className="op-history">
          {history.map((event) => (
            <li key={`${event.slug}-${event.enteredAt}`}>
              {event.label} · {money(event.amountGtq)} · {event.enteredAt.slice(0, 16).replace("T", " ")}
            </li>
          ))}
        </ul>
      ) : null}
    </Overlay>
  );
}

function DrillDrawer({ report, drill, onClose }: { report: OperativoReport; drill: Drill; onClose: () => void }) {
  if (drill.kind === "fuente") {
    const bar = report.fuentes.find((row) => row.label === drill.label);
    const rows = drill.label === "Otras fuentes"
      ? report.fuenteProjects.filter((row) => bar?.folded.includes(row.fuente))
      : report.fuenteProjects.filter((row) => row.fuente === drill.label);
    return (
      <Overlay title={drill.label} onClose={onClose}>
        <p className="op-figure"><span>{count(bar?.units ?? 0)}</span><small>{money(bar?.gtq ?? null)} del valor del trato</small></p>
        {bar && bar.sinMonto > 0 ? <p className="op-note">{count(bar.sinMonto)} sin monto.</p> : null}
        <table>
          <thead><tr><th>Proyecto</th><th>Reservas</th><th>Quetzales</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.fuente}-${row.slug}`}>
                <td>{row.project}</td>
                <td>{count(row.units)}</td>
                <td>{money(row.gtq)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Overlay>
    );
  }
  if (drill.kind === "cierre") {
    const row = report.cierre.find((item) => item.slug === drill.slug);
    return (
      <Overlay title={row?.label ?? "Costo por cierre"} onClose={onClose}>
        <p className="op-figure"><span>{row?.costo == null ? "Sin ventas" : money(row.costo)}</span></p>
        <p className="op-note">{count(row?.ventas ?? 0)} ventas. Pauta {money(row?.pautaGtq ?? null)}. Pauta ÷ ventas.</p>
      </Overlay>
    );
  }
  const series = report.cpl.find((item) => item.slug === drill.slug);
  const point = series?.points.find((item) => item.month === drill.month);
  return (
    <Overlay title={`${series?.label ?? "Proyecto"} · ${point?.label ?? ""}`} onClose={onClose}>
      <p className="op-figure"><span>{point?.cpl == null ? "Sin leads" : money(point.cpl)}</span><small>por lead de Meta</small></p>
      <p className="op-note">{count(point?.leads ?? 0)} leads. Gasto Meta {money(point?.spendGtq ?? null)}.</p>
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
