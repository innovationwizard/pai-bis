"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CobrosResumenTable, type CobrosResumen } from "@/app/pabi/contable/contable-charts";
import cobrosJson from "@/app/pabi/contable/data/cobros.json";
import comisionesJson from "@/app/pabi/contable/data/comisiones.json";
import type { CobrosSection, CobrosVista, Series } from "@/lib/cobros/types";

const STORAGE_KEY = "pai-cobros-filtros";
const COLORS = ["#0d2041", "#0573b0", "#b45309", "#3d6f8f", "#1a4a68"];

type FilterKey = "torre" | "modelo" | "banco" | "marca" | "moneda";

const SPECIFIC: Record<CobrosSection, FilterKey[]> = {
  "cobros-por-proyecto": ["torre", "modelo", "banco", "marca", "moneda"],
  "cobros-acumulados": ["torre", "modelo", "banco", "marca", "moneda"],
  "cobros-del-mes": ["torre", "modelo", "banco", "marca", "moneda"],
  deficit: ["torre", "modelo", "marca"],
  superavit: ["torre", "modelo", "marca"],
  "reporte-deficit-superavit": ["torre", "modelo", "marca"],
  alertas: ["torre", "modelo", "marca"],
  "decisiones-desistimientos": ["torre", "modelo", "banco", "marca", "moneda"],
  "casos-especiales": ["torre", "modelo"],
  "reporte-recurrente": ["torre", "modelo", "banco", "marca", "moneda"],
  "alertas-desistimiento": ["torre", "modelo", "marca"],
  "cierre-mensual-de-cobros": ["torre", "modelo", "banco", "marca", "moneda"],
};

const FIELD_LABEL: Record<FilterKey, string> = {
  torre: "Torre",
  modelo: "Modelo",
  banco: "Banco",
  marca: "Marca",
  moneda: "Moneda",
};

type BarState = {
  periodo: string;
  desde: string;
  hasta: string;
  comparar: boolean;
  n: number;
  anio: boolean;
  proyectos: string[] | null;
  torre: string;
  modelo: string;
  banco: string;
  marca: string;
  moneda: string;
  detalle: string;
};

const INITIAL: BarState = {
  periodo: "este-ano",
  desde: "",
  hasta: "",
  comparar: false,
  n: 1,
  anio: false,
  proyectos: null,
  torre: "",
  modelo: "",
  banco: "",
  marca: "",
  moneda: "",
  detalle: "",
};

const bakedResumen = cobrosJson.rows["1"] as CobrosResumen;
const bakedCierre = comisionesJson.rows["2"] as CobrosResumen;

function readBar(raw: string): BarState {
  const parsed = JSON.parse(raw) as Partial<BarState>;
  return {
    ...INITIAL,
    ...parsed,
    proyectos: Array.isArray(parsed.proyectos) ? parsed.proyectos.filter((item) => typeof item === "string") : null,
    n: typeof parsed.n === "number" ? parsed.n : 1,
  };
}

function pivot(series: Series[]): Record<string, string | number>[] {
  const labels: string[] = [];
  for (const item of series) {
    for (const point of item.points) {
      if (!labels.includes(point.label)) labels.push(point.label);
    }
  }
  return labels.map((label) => {
    const row: Record<string, string | number> = { label };
    for (const item of series) {
      const point = item.points.find((candidate) => candidate.label === label);
      if (!point) continue;
      row[item.name] = point.value;
      row[`id:${item.name}`] = point.id;
    }
    return row;
  });
}

export default function CobrosView({ section }: { section: CobrosSection }) {
  const [bar, setBar] = useState<BarState>(INITIAL);
  const [ready, setReady] = useState(false);
  const [vista, setVista] = useState<CobrosVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
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
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [projectsOpen]);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bar));
    } catch {
      /* the page still works without the saved filters */
    }
    const params = new URLSearchParams({ section, periodo: bar.periodo });
    if (bar.periodo === "custom" && bar.desde && bar.hasta) {
      params.set("desde", bar.desde);
      params.set("hasta", bar.hasta);
    }
    if (bar.comparar) {
      params.set("comparar", "1");
      params.set("n", String(bar.n));
    }
    if (bar.anio) params.set("anio", "1");
    if (bar.proyectos === null) {
      /* Los cinco proyectos */
    } else if (bar.proyectos.length === 0) {
      params.append("proyecto", "ninguno");
    } else {
      for (const id of bar.proyectos) params.append("proyecto", id);
    }
    for (const key of SPECIFIC[section]) {
      const value = bar[key];
      if (value) params.set(key === "torre" ? "torre" : key === "banco" ? "banco" : key === "marca" ? "marca" : key === "moneda" ? "moneda" : "modelo", value);
    }
    if (bar.detalle) params.set("detalle", bar.detalle);
    const controller = new AbortController();
    let cancelled = false;
    setError(null);
    setLoading(true);
    fetch(`/api/cobros/vista?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as CobrosVista & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo leer Cobros");
        if (!cancelled) setVista(body);
      })
      .catch((reason: unknown) => {
        if (cancelled || (reason instanceof DOMException && reason.name === "AbortError")) return;
        setError(reason instanceof Error ? reason.message : "No se pudo leer Cobros");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [bar, ready, section]);

  const choices = vista?.projects ?? [];
  const allIds = choices.map((choice) => choice.id);
  const projectLabel = useMemo(() => {
    if (bar.proyectos === null) return "Los cinco proyectos";
    if (bar.proyectos.length === 0) return "Ningún proyecto";
    const names = bar.proyectos.map((id) => choices.find((choice) => choice.id === id)?.label ?? id);
    return names.length <= 2 ? names.join(", ") : `${names.length} proyectos`;
  }, [bar.proyectos, choices]);

  function update(patch: Partial<BarState>) {
    setBar((current) => ({ ...current, ...patch, detalle: patch.detalle ?? "" }));
  }

  function toggleProject(id: string) {
    setBar((current) => {
      const selected = current.proyectos === null ? allIds : current.proyectos;
      const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
      if (allIds.length > 0 && next.length === allIds.length) return { ...current, proyectos: null, detalle: "" };
      return { ...current, proyectos: next, detalle: "" };
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
                <input
                  type="checkbox"
                  checked={bar.proyectos === null}
                  onChange={() => setBar((current) => ({ ...current, proyectos: current.proyectos === null ? [] : null, detalle: "" }))}
                />
                Los cinco proyectos
              </label>
              {choices.map((choice) => (
                <label key={choice.id}>
                  <input
                    type="checkbox"
                    checked={bar.proyectos === null || bar.proyectos.includes(choice.id)}
                    onChange={() => toggleProject(choice.id)}
                  />
                  {choice.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
        {specific.map((key) => (
          <label key={key}>
            {FIELD_LABEL[key]}
            <select value={bar[key]} onChange={(event) => update({ [key]: event.target.value })}>
              <option value="">{key === "marca" ? "Todas" : key === "moneda" ? "Todas" : "Todos"}</option>
              {key === "marca" ? (
                <>
                  <option value="ds">DS-</option>
                  <option value="vigente">Vigente</option>
                </>
              ) : null}
              {key === "moneda" ? (
                <>
                  <option value="GTQ">Quetzales</option>
                  <option value="USD">Dólares</option>
                </>
              ) : null}
              {key === "torre" || key === "modelo" || key === "banco"
                ? (show?.choices[key] ?? []).map((choice) => (
                    <option key={choice.id} value={choice.id}>{choice.label}</option>
                  ))
                : null}
            </select>
          </label>
        ))}
        {section !== "casos-especiales" ? (
          <>
            <label className="ventas-check">
              <input type="checkbox" checked={bar.comparar} onChange={(event) => update({ comparar: event.target.checked })} />
              N períodos anteriores
            </label>
            {bar.comparar ? (
              <label>
                N
                <input type="number" min={1} max={12} value={bar.n} onChange={(event) => update({ n: Number(event.target.value), comparar: true })} />
              </label>
            ) : null}
            <label className="ventas-check">
              <input type="checkbox" checked={bar.anio} onChange={(event) => update({ anio: event.target.checked })} />
              Mismo período del año anterior
            </label>
          </>
        ) : null}
        <button type="button" className="op-text" onClick={() => setBar(INITIAL)}>Restablecer</button>
        <p className="op-range">
          {show ? `${show.periodLabel}: ${show.rangeLabel}.` : ""}
          {loading ? " Actualizando…" : ""}
        </p>
      </div>
      <hr className="op-filter-rule" />

      {show ? <p className="op-question">{show.question}</p> : null}
      {error ? <p className="op-note op-warn">{error}</p> : null}
      {show?.empty ? <p className="op-note op-warn">{show.empty}</p> : null}
      {show && !show.empty ? (
        <>
          <p className="op-note">{show.caption}</p>
          {show.notices.map((notice) => (
            <p key={notice} className="op-note">{notice}</p>
          ))}
          {show.kpis.length > 0 ? (
            <div className="op-kpis">
              {show.kpis.map((kpi) => (
                <p key={kpi.label}>
                  <strong>{kpi.value}</strong>
                  <span>{kpi.label}</span>
                  <small>{kpi.hint}</small>
                </p>
              ))}
            </div>
          ) : null}
          {show.compare.length > 0 ? (
            <div className="op-kpis">
              {show.compare.map((item) => (
                <p key={item.label}>
                  <strong>{item.detail}</strong>
                  <span>{item.label}</span>
                  <small>Misma selección, otro periodo</small>
                </p>
              ))}
            </div>
          ) : null}
          {bar.detalle ? (
            <button type="button" className="op-text" onClick={() => setBar((current) => ({ ...current, detalle: "" }))}>
              Quitar el detalle
            </button>
          ) : null}
          <MoneyChart
            title={section === "casos-especiales" ? "Registros de revisión" : "Quetzales"}
            rows={show.gtqBars}
            onPick={(id) => setBar((current) => ({ ...current, detalle: id }))}
          />
          <MoneyChart title="Dólares" rows={show.usdBars} onPick={(id) => setBar((current) => ({ ...current, detalle: id }))} />
          <MoneyChart title="Quetzales del asiento en dólares" rows={show.bookedBars} onPick={(id) => setBar((current) => ({ ...current, detalle: id }))} />
          <SeriesChart title="Quetzales" series={show.gtqSeries} onPick={(id) => setBar((current) => ({ ...current, detalle: id }))} />
          <SeriesChart title="Dólares" series={show.usdSeries} onPick={(id) => setBar((current) => ({ ...current, detalle: id }))} />
          <SeriesChart title="Quetzales del asiento en dólares" series={show.bookedSeries} onPick={(id) => setBar((current) => ({ ...current, detalle: id }))} />
          {show.lines.length > 0 ? (
            <section className="op-hero" aria-label={show.lineTitle}>
              <header className="op-head">
                <div>
                  <h2>{show.lineTitle}</h2>
                  <p className="op-note">
                    {show.listTotal > show.lines.length ? `${show.lines.length} de ${show.listTotal}` : `${show.listTotal}`}
                  </p>
                </div>
              </header>
              <div style={{ overflowX: "auto" }}>
                <table className="ventas-table">
                  <thead>
                    <tr>
                      {show.lineHeaders.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {show.lines.map((line) => (
                      <tr key={line.id}>
                        {line.values.map((value, index) => (
                          <td key={`${line.id}-${index}`}>{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {show.drafts ? (
            <section className="op-hero" aria-label={show.drafts.title}>
              <header className="op-head">
                <div>
                  <h2>{show.drafts.title}</h2>
                  <p className="op-note">
                    {show.drafts.total > show.drafts.lines.length ? `${show.drafts.lines.length} de ${show.drafts.total}` : `${show.drafts.total}`}
                  </p>
                </div>
              </header>
              <div style={{ overflowX: "auto" }}>
                <table className="ventas-table">
                  <thead>
                    <tr>
                      {show.drafts.headers.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {show.drafts.lines.map((line) => (
                      <tr key={line.id}>
                        {line.values.map((value, index) => (
                          <td key={`${line.id}-${index}`}>{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {show.baked === "resumen" ? (
            <section className="op-hero" aria-label="Excel de agosto 2026">
              <h2>Excel de agosto 2026</h2>
              <p className="op-note">No es el libro publicado. Es la foto que ya estaba en la vista directiva.</p>
              <CobrosResumenTable data={bakedResumen} />
            </section>
          ) : null}
          {show.baked === "cierre" ? (
            <section className="op-hero" aria-label="Excel de cierre">
              <h2>Excel de agosto 2026</h2>
              <p className="op-note">No es el cierre del libro publicado. Es la foto de comisiones que ya estaba en la vista directiva.</p>
              <CobrosResumenTable data={bakedCierre} />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MoneyChart({ title, rows, onPick }: { title: string; rows: { id: string; label: string; value: number }[]; onPick: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <section className="op-hero" aria-label={title} style={{ minHeight: 220 }}>
      <header className="op-head"><div><h2>{title}</h2></div></header>
      <div className="op-chart" style={{ height: Math.max(180, rows.length * 36) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11, fill: "#334155" }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar
              dataKey="value"
              name={title}
              fill="#0d2041"
              isAnimationActive={false}
              onClick={(state: { id?: string; payload?: { id?: string } }) => {
                const id = state.id ?? state.payload?.id;
                if (id) onPick(id);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SeriesChart({ title, series, onPick }: { title: string; series: Series[]; onPick: (id: string) => void }) {
  const data = pivot(series);
  if (data.length === 0) return null;
  const names = series.map((item) => item.name);
  return (
    <section className="op-hero" aria-label={`${title}, serie`} style={{ minHeight: 240 }}>
      <header className="op-head"><div><h2>{title}</h2></div></header>
      <div className="op-chart" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {names.map((name, index) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                isAnimationActive={false}
                dot={(dot: { cx?: number; cy?: number; stroke?: string; payload?: unknown }) => {
                  if (dot.cx == null || dot.cy == null) return <g key={`${name}-empty`} />;
                  const payload = dot.payload as Record<string, string | number> | undefined;
                  const id = payload?.[`id:${name}`];
                  return (
                    <circle
                      key={`${name}-${dot.cx}-${dot.cy}`}
                      cx={dot.cx}
                      cy={dot.cy}
                      r={4}
                      fill={dot.stroke ?? COLORS[index % COLORS.length]}
                      style={{ cursor: "pointer" }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (typeof id === "string") onPick(id);
                      }}
                    />
                  );
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
