"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { BudgetStatus } from "@/lib/mercadeo/operativo-types";
import type { GlanceSection, MercadeoVista } from "@/lib/mercadeo/glance-types";
import { Overlay, TargetDrawer } from "./operativo-view";

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

const TONE_COLOR = { "sin-leads": "#b91c1c", caro: "#b45309", "en-linea": "#0573b0" };

type BarState = {
  periodo: string;
  desde: string;
  hasta: string;
  proyectos: string[] | null;
};

const INITIAL: BarState = { periodo: "este-mes", desde: "", hasta: "", proyectos: null };

const moneyFormat = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 });
const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return moneyFormat.format(value);
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Sin presupuesto";
  const n = value * 100;
  return `${new Intl.NumberFormat("es-GT", { maximumFractionDigits: n >= 10 ? 0 : 1 }).format(n)}%`;
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
  return { ...INITIAL, periodo: parsed.periodo ?? INITIAL.periodo, desde: parsed.desde ?? "", hasta: parsed.hasta ?? "", proyectos };
}

type Drill = { kind: "campaign"; campaign: string } | { kind: "month"; month: string } | { kind: "puerta" };

export default function GlanceView({ section }: { section: GlanceSection }) {
  const [bar, setBar] = useState<BarState>(INITIAL);
  const [ready, setReady] = useState(false);
  const [vista, setVista] = useState<MercadeoVista | null>(null);
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
    const params = new URLSearchParams({ section, periodo: bar.periodo });
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
    setDrill(null);
    fetch(`/api/mercadeo/vista?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as MercadeoVista & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo leer Mercadeo");
        setVista(body);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "No se pudo leer Mercadeo");
      });
    return () => controller.abort();
  }, [bar, ready, section]);

  function update(patch: Partial<BarState>) {
    setBar((current) => ({ ...current, ...patch }));
  }

  const choices = vista?.projects ?? [];
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

  const show = vista && vista.section === section && !error ? vista : null;

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
        {show?.section === "gestion-de-pauta" ? (
          <button type="button" className="op-text" onClick={() => { setTargetsOpen(true); setDrill(null); }}>
            Presupuesto
          </button>
        ) : null}
        <p className="op-range">{show ? `${show.periodLabel}. ${show.rangeLabel}.` : error ? "" : "Cargando…"}</p>
      </div>

      {show ? <p className="op-question">{show.question}</p> : null}
      {error ? <p className="op-note op-warn">{error}</p> : null}
      {show?.notice ? <p className="op-note">{show.notice}</p> : null}
      {show?.section === "efectividad" ? <Efectividad vista={show} onCampaign={(campaign) => setDrill({ kind: "campaign", campaign })} onPuerta={() => setDrill({ kind: "puerta" })} /> : null}
      {show?.section === "costo-por-lead" ? <CostoPorLead vista={show} /> : null}
      {show?.section === "inversion-acumulada" ? <Inversion vista={show} onMonth={(month) => setDrill({ kind: "month", month })} /> : null}
      {show?.section === "canales" ? <Canales vista={show} /> : null}
      {show?.section === "gestion-de-pauta" ? <Gestion vista={show} onProject={(slug) => update({ proyectos: [slug] })} /> : null}

      {targetsOpen && show?.section === "gestion-de-pauta" ? (
        <TargetDrawer report={show.editor} onClose={() => setTargetsOpen(false)} onSaved={() => setBar((current) => ({ ...current }))} />
      ) : null}
      {drill && show ? <GlanceDrill vista={show} drill={drill} onClose={() => setDrill(null)} /> : null}
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

function Efectividad({
  vista,
  onCampaign,
  onPuerta,
}: {
  vista: Extract<MercadeoVista, { section: "efectividad" }>;
  onCampaign: (campaign: string) => void;
  onPuerta: () => void;
}) {
  return (
    <>
      <div className="op-kpis">
        <Kpi label="Gasto Meta" value={money(vista.spendGtq)} detail={`${count(vista.leads)} leads`} />
        <Kpi label="CPL mediano" value={vista.medianCpl == null ? "—" : money(vista.medianCpl)} detail="de las campañas con lead" />
        <Kpi label="Con venta" value={count(vista.withSales)} detail={vista.rest > 0 ? `${count(vista.rest)} quedan fuera del top` : "en el periodo"} />
        <Kpi label="Reservas en el top" value={count(vista.byReservas.reduce((sum, row) => sum + row.units, 0))} detail="campañas con reserva" />
      </div>
      <div className="op-mid">
        <section className="op-hero" aria-label="Gasto por campaña">
          <header className="op-head">
            <div>
              <h2>Gasto por campaña</h2>
              <p className="op-note">{vista.caption}</p>
            </div>
            <ul className="op-legend">
              <li><i style={{ background: TONE_COLOR["en-linea"] }} />En línea</li>
              <li><i style={{ background: TONE_COLOR.caro }} />Sobre la mediana</li>
              <li><i style={{ background: TONE_COLOR["sin-leads"] }} />Sin leads</li>
            </ul>
          </header>
          <Bars
            rows={vista.bySpend}
            nameKey="short"
            valueKey="spendGtq"
            format={money}
            colorOf={(row) => TONE_COLOR[row.tone]}
            onPick={(row) => onCampaign(row.campaign)}
          />
        </section>
        <section className="op-hero" aria-label="Reservas por campaña">
          <header className="op-head"><div><h2>Reservas por campaña</h2></div></header>
          <Bars
            rows={vista.byReservas}
            nameKey="short"
            valueKey="units"
            format={(value) => count(value ?? 0)}
            colorOf={() => "#0d2041"}
            onPick={(row) => onCampaign(row.campaign)}
          />
        </section>
      </div>
      <section className="op-hero op-hero-cierre" aria-label="Costo por cierre de campaña">
        <header className="op-head"><div><h2>Costo por cierre</h2><p className="op-note">Gasto Meta ÷ ventas con esa campaña. Arriba está la más cara.</p></div></header>
        <Bars
          rows={vista.byCierre}
          nameKey="short"
          valueKey="costo"
          format={money}
          colorOf={() => "#0573b0"}
          onPick={(row) => onCampaign(row.campaign)}
        />
      </section>
      {vista.puerta ? (
        <p className="op-note">
          Puerta Abierta {money(vista.puerta.spendGtq)} y {count(vista.puerta.leads)} leads.{" "}
          <button type="button" className="op-text" onClick={onPuerta}>Ver campañas</button>
        </p>
      ) : null}
    </>
  );
}

function CostoPorLead({ vista }: { vista: Extract<MercadeoVista, { section: "costo-por-lead" }> }) {
  const data = (vista.series[0]?.points ?? []).map((point, index) => {
    const row: Record<string, string | number | null> = { label: point.label, month: point.month };
    for (const series of vista.series) row[series.slug] = series.points[index]?.cpl ?? null;
    return row;
  });
  const delta = vista.latestCpl != null && vista.previousCpl != null ? vista.latestCpl - vista.previousCpl : null;
  const leads = vista.monthRows.reduce((sum, row) => sum + row.leads, 0);
  return (
    <>
      <div className="op-kpis op-kpis-3">
        <Kpi label={vista.latestLabel} value={vista.latestCpl == null ? "Sin leads" : money(vista.latestCpl)} detail="costo por lead del mes" />
        <Kpi
          label="Contra el mes previo"
          value={delta == null ? "—" : `${delta > 0 ? "+" : ""}${money(delta)}`}
          detail={vista.previousLabel ?? "Sin mes previo"}
          color={delta == null ? undefined : delta > 0 ? "#b45309" : "#0573b0"}
        />
        <Kpi label="Leads del mes" value={count(leads)} detail={vista.caption} />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Evolución de costo por lead">
        <header className="op-head"><div><h2>Costo por lead por proyecto</h2></div></header>
        <div className="op-chart">
          {data.length === 0 ? <p className="op-note">No hay meses en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => money(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} width={64} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value, name) => [money(tipNumber(value)), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {vista.series.map((series) => (
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
      <div className="op-mid">
        <section className="op-hero" aria-label="Leads del mes">
          <header className="op-head"><div><h2>Leads de {vista.latestLabel}</h2></div></header>
          <Bars rows={vista.monthRows} nameKey="label" valueKey="leads" format={(value) => count(value ?? 0)} colorOf={(row) => PROJECT_COLOR[row.slug] ?? "#0573b0"} />
        </section>
        <section className="op-hero" aria-label="Gasto Meta del mes">
          <header className="op-head"><div><h2>Gasto Meta de {vista.latestLabel}</h2></div></header>
          <Bars rows={vista.monthRows} nameKey="label" valueKey="spendGtq" format={money} colorOf={(row) => PROJECT_COLOR[row.slug] ?? "#0573b0"} />
        </section>
      </div>
    </>
  );
}

function Inversion({
  vista,
  onMonth,
}: {
  vista: Extract<MercadeoVista, { section: "inversion-acumulada" }>;
  onMonth: (month: string) => void;
}) {
  const gap = vista.planGtq == null ? null : vista.cumulativeGtq - vista.planGtq;
  return (
    <>
      <div className="op-kpis op-kpis-3">
        <Kpi label="Pauta acumulada" value={money(vista.cumulativeGtq)} detail={vista.caption} />
        <Kpi label="Presupuesto acumulado" value={money(vista.planGtq)} detail="meses y proyectos con meta" />
        <Kpi
          label="Diferencia"
          value={gap == null ? "Sin presupuesto" : money(gap)}
          detail={gap == null ? "Falta la meta" : gap > 0 ? "Por delante del presupuesto" : "Dentro del presupuesto"}
          color={gap != null && gap > 0 ? "#b45309" : "#0573b0"}
        />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Inversión acumulada">
        <header className="op-head"><div><h2>Mes y acumulado</h2><p className="op-note">La barra es la pauta del mes. Las líneas son el acumulado.</p></div></header>
        <div className="op-chart">
          {vista.months.length === 0 ? <p className="op-note">No hay meses en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={vista.months}
                margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                onClick={(state) => {
                  const index = typeof state.activeTooltipIndex === "number" ? state.activeTooltipIndex : Number(state.activeTooltipIndex);
                  const month = vista.months[index]?.month;
                  if (month) onMonth(month);
                }}
              >
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => money(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} width={72} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value, name) => [money(tipNumber(value)), name === "pautaGtq" ? "Pauta del mes" : name === "cumulativeGtq" ? "Acumulado" : "Presupuesto acumulado"]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pautaGtq" name="Pauta del mes" fill="#94a3b8" barSize={14} isAnimationActive={false} />
                <Line type="monotone" dataKey="cumulativeGtq" name="Acumulado" stroke="#0d2041" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="cumulativePlanGtq" name="Presupuesto" stroke="#0573b0" strokeWidth={2} strokeDasharray="4 3" connectNulls={false} dot={{ r: 3 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      <section className="op-hero op-hero-cierre" aria-label="Acumulado por proyecto">
        <header className="op-head"><div><h2>Acumulado por proyecto</h2><p className="op-note">La barra gris es el presupuesto. El clic en un mes abre el desglose.</p></div></header>
        <div className="op-chart">
          {vista.gaps.length === 0 ? <p className="op-note">No hay proyectos en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={vista.gaps} margin={{ left: 8, right: 28, top: 4, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => money(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={128} tick={{ fontSize: 12, fill: "#0d2041" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value, name) => [money(tipNumber(value)), name === "planGtq" ? "Presupuesto" : "Pauta"]} />
                <Bar dataKey="planGtq" fill="#e2e8f0" barSize={10} isAnimationActive={false} />
                <Bar dataKey="actualGtq" barSize={10} isAnimationActive={false}>
                  {vista.gaps.map((row) => <Cell key={row.slug} fill={PROJECT_COLOR[row.slug] ?? "#0573b0"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </>
  );
}

function Canales({ vista }: { vista: Extract<MercadeoVista, { section: "canales" }> }) {
  const spend = vista.channels.flatMap((channel) => channel.spendGtq == null ? [] : [{ label: channel.label, spendGtq: channel.spendGtq }]);
  const mute = vista.channels.filter((channel) => channel.spendGtq == null).map((channel) => channel.label);
  const days = vista.channels.flatMap((channel) => channel.activeDays == null ? [] : [{ label: channel.label, activeDays: channel.activeDays }]);
  const leads = vista.channels.flatMap((channel) => {
    if (channel.leads != null) return [{ label: "Meta · leads", units: channel.leads }];
    if (channel.forms != null) return [{ label: "Google · formularios", units: channel.forms }];
    return [];
  });
  return (
    <>
      <div className="op-kpis op-kpis-3">
        <Kpi label="Canales con gasto" value={`${count(vista.active)} de ${count(vista.measured)}`} detail={vista.caption} />
        <Kpi label="Días del periodo" value={count(vista.days)} detail="Meta y Google cuentan días con gasto" />
        <Kpi label="Sin ejecución" value={mute.length === 0 ? "Ninguno" : String(mute.length)} detail={mute.length === 0 ? "Todos tienen real o gasto" : mute.join(", ")} />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Gasto por canal">
        <header className="op-head"><div><h2>Gasto por canal</h2></div></header>
        <Bars rows={spend} nameKey="label" valueKey="spendGtq" format={money} colorOf={() => "#0d2041"} />
      </section>
      <div className="op-mid">
        <section className="op-hero" aria-label="Días con gasto">
          <header className="op-head"><div><h2>Días con gasto</h2><p className="op-note">De {count(vista.days)} días. TikTok, LinkedIn, Pauta digital y Wati no tienen día.</p></div></header>
          <Bars rows={days} nameKey="label" valueKey="activeDays" format={(value) => count(value ?? 0)} colorOf={() => "#0573b0"} />
        </section>
        <section className="op-hero" aria-label="Leads y formularios">
          <header className="op-head"><div><h2>Leads y formularios</h2><p className="op-note">Meta es clientes potenciales. Google es formularios. No son la misma unidad.</p></div></header>
          <Bars rows={leads} nameKey="label" valueKey="units" format={(value) => count(value ?? 0)} colorOf={(row) => row.label.startsWith("Google") ? "#3d6f8f" : "#0d2041"} />
        </section>
      </div>
      <p className="op-note">La operación diaria de publicación sigue en <a href="https://app.metricool.com/" target="_blank" rel="noreferrer">Metricool</a>.</p>
    </>
  );
}

function Gestion({
  vista,
  onProject,
}: {
  vista: Extract<MercadeoVista, { section: "gestion-de-pauta" }>;
  onProject: (slug: string) => void;
}) {
  const rows = vista.rows.map((row) => ({ ...row, target: row.targetGtq }));
  return (
    <>
      <div className="op-kpis op-kpis-3">
        <Kpi label="Gastado" value={money(vista.actualGtq)} detail={vista.scope} color={STATUS_COLOR[vista.status]} />
        <Kpi label="Presupuesto" value={money(vista.targetGtq)} detail={pct(vista.paceRatio == null ? vista.targetGtq && vista.targetGtq > 0 ? vista.actualGtq / vista.targetGtq : null : vista.paceRatio) + (vista.partial ? " del ritmo" : " del mes")} />
        <Kpi label="Ritmo a hoy" value={vista.paceGtq == null ? "Sin presupuesto" : money(vista.paceGtq)} detail={vista.caption} />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Presupuesto por proyecto">
        <header className="op-head"><div><h2>Presupuesto por proyecto</h2><p className="op-note">El clic deja solo ese proyecto.</p></div></header>
        <div className="op-chart">
          {rows.length === 0 ? <p className="op-note">No hay proyectos en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={rows} margin={{ left: 8, right: 36, top: 4, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => money(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={128} tick={{ fontSize: 12, fill: "#0d2041" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value, name) => [money(tipNumber(value)), name === "actualGtq" ? "Gasto" : "Presupuesto"]} />
                <Bar dataKey="target" fill="#e2e8f0" barSize={10} isAnimationActive={false} />
                <Bar dataKey="actualGtq" barSize={10} isAnimationActive={false} onClick={(row) => {
                  const slug = (row.payload as { slug?: string } | undefined)?.slug;
                  if (slug) onProject(slug);
                }}>
                  {rows.map((row) => <Cell key={row.slug} fill={STATUS_COLOR[row.status]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        {vista.puerta ? <p className="op-note">Puerta Abierta {money(vista.puerta.actualGtq)} de {money(vista.puerta.targetGtq)}. No suma a los proyectos.</p> : null}
      </section>
      <section className="op-hero op-hero-cierre" aria-label="Ritmo diario">
        <header className="op-head"><div><h2>Gasto acumulado del periodo</h2></div></header>
        <div className="op-chart">
          {vista.daily.length === 0 ? <p className="op-note">No hay días en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vista.daily} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={(value) => money(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} width={72} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value, name) => [money(tipNumber(value)), name === "paceGtq" ? "Presupuesto repartido" : "Gasto acumulado"]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="actualGtq" name="Gasto" stroke="#0d2041" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="paceGtq" name="Presupuesto" stroke="#0573b0" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </>
  );
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
          <Bar dataKey={valueKey as never} barSize={12} isAnimationActive={false} onClick={(row) => {
            const payload = row.payload as T | undefined;
            if (payload && onPick) onPick(payload);
          }}>
            {rows.map((row, index) => <Cell key={`${String(row[nameKey])}-${index}`} fill={colorOf(row)} />)}
            <LabelList dataKey={valueKey} position="right" formatter={(value) => format(tipNumber(value))} fill="#334155" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GlanceDrill({ vista, drill, onClose }: { vista: MercadeoVista; drill: Drill; onClose: () => void }) {
  if (vista.section === "efectividad" && drill.kind === "campaign") {
    const row = vista.detail.find((item) => item.campaign === drill.campaign);
    return (
      <Overlay title={drill.campaign} onClose={onClose}>
        <p className="op-figure"><span>{row?.cpl == null ? "Sin leads" : money(row.cpl)}</span><small>por lead</small></p>
        <p className="op-note">Gasto {money(row?.spendGtq)}. Leads {count(row?.leads ?? 0)}. Reservas {count(row?.reservas ?? 0)}. Ventas {count(row?.ventas ?? 0)}.</p>
      </Overlay>
    );
  }
  if (vista.section === "efectividad" && drill.kind === "puerta") {
    const list = vista.detail.filter((item) => item.scope === "puerta");
    return (
      <Overlay title="Puerta Abierta" onClose={onClose}>
        <p className="op-note">Centro de costo propio. No entra en las barras de los proyectos.</p>
        {list.length === 0 ? <p className="op-note">No hay campañas de Puerta Abierta en este periodo.</p> : list.map((row) => (
          <p key={row.campaign} className="op-note">{row.campaign}: {money(row.spendGtq)} · {count(row.leads ?? 0)} leads · {count(row.reservas)} reservas</p>
        ))}
      </Overlay>
    );
  }
  if (vista.section === "inversion-acumulada" && drill.kind === "month") {
    const month = vista.monthLines.find((item) => item.month === drill.month);
    return (
      <Overlay title={month?.label ?? "Mes"} onClose={onClose}>
        {(month?.lines ?? []).map((line) => (
          <p key={line.label} className="op-note">{line.label}: {line.gtq == null ? "sin ejecución" : money(line.gtq)}</p>
        ))}
      </Overlay>
    );
  }
  return null;
}
