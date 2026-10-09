"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CampaignRow, MercadeoReport, MonthPoint, Pair, RangeRow } from "@/lib/mercadeo/report";

const STORAGE_KEY = "pai-mercadeo-filtros";

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

function readBar(raw: string): BarState {
  const parsed = JSON.parse(raw) as Partial<BarState>;
  const proyectos = Array.isArray(parsed.proyectos)
    ? parsed.proyectos.filter((id): id is string => typeof id === "string")
    : parsed.proyectos === null
      ? null
      : INITIAL.proyectos;
  return { ...INITIAL, ...parsed, proyectos };
}

function money(value: number | null): string {
  if (value == null) return "sin monto";
  return new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 }).format(value);
}

function units(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 }).format(value);
}

function pairCells(pair: Pair): string {
  return `${units(pair.units)} · ${pair.sinMonto > 0 && pair.gtq == null ? "sin monto" : money(pair.gtq)}`;
}

export default function MercadeoBoard({ section }: { section: string }) {
  const [bar, setBar] = useState<BarState>(INITIAL);
  const [ready, setReady] = useState(false);
  const [report, setReport] = useState<MercadeoReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [ranges, setRanges] = useState<RangeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
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
    if (!ready) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bar));
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
      /* Todos */
    } else if (bar.proyectos.length === 0) {
      params.append("proyecto", "ninguno");
    } else {
      for (const slug of bar.proyectos) params.append("proyecto", slug);
    }
    const controller = new AbortController();
    setError(null);
    fetch(`/api/mercadeo/report?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo leer Mercadeo");
        const next = body as MercadeoReport;
        setReport(next);
        setRanges(next.ranges);
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

  const choices = report?.projects ?? [];
  const allIds = choices.map((choice) => choice.slug);

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

  const projectLabel = (() => {
    if (bar.proyectos === null) return "Todos los proyectos";
    if (bar.proyectos.length === 0) return "Ningún proyecto";
    const names = bar.proyectos.map((slug) => choices.find((choice) => choice.slug === slug)?.label ?? slug);
    return names.length <= 2 ? names.join(", ") : `${names.length} proyectos`;
  })();

  async function saveRanges() {
    setSaving(true);
    setSaved(null);
    try {
      const response = await fetch("/api/mercadeo/lead-ranges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ranges: ranges.map((range) => ({ slug: range.slug, min: range.min, max: range.max })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No se guardó la meta");
      setSaved("Meta guardada.");
      setBar((current) => ({ ...current }));
    } catch (reason) {
      setSaved(reason instanceof Error ? reason.message : "No se guardó la meta");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ventas-board">
      <div className="ventas-bar">
        <div className="ventas-field ventas-projects" ref={projectsRef}>
          <span>Proyecto</span>
          <button type="button" className="ventas-projects-button" aria-expanded={projectsOpen} onClick={() => setProjectsOpen((open) => !open)}>
            {projectLabel}
          </button>
          {projectsOpen ? (
            <div className="ventas-projects-menu" role="group" aria-label="Proyecto">
              <label className="ventas-project-option">
                <input type="checkbox" checked={bar.proyectos === null} onChange={toggleAll} />
                Todos los proyectos
              </label>
              {choices.map((choice) => {
                const checked = bar.proyectos === null || bar.proyectos.includes(choice.slug);
                return (
                  <label key={choice.slug} className="ventas-project-option">
                    <input type="checkbox" checked={checked} onChange={() => toggleProject(choice.slug)} />
                    {choice.label}
                  </label>
                );
              })}
            </div>
          ) : null}
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
        <button type="button" className="ventas-projects-button" onClick={() => setBar(INITIAL)}>
          Restablecer
        </button>
      </div>

      {section === "canales" ? <Metricool /> : null}
      {error ? <p className="mercadeo-note">{error}</p> : null}
      {report && !error ? (
        <>
          <p className="mercadeo-note">{report.periodLabel}. {report.rangeLabel}. {report.caption}</p>
          {report.notice ? <p className="mercadeo-note">{report.notice}</p> : null}
          {section !== "canales" && report.insights.length > 0 ? (
            <div className="mercadeo-insights">
              {report.insights.map((insight) => (
                <p key={insight.text} className={`mercadeo-insight ${insight.tone}`}>{insight.text}</p>
              ))}
            </div>
          ) : null}
          {section === "reporte-maestro" || section === "efectividad" ? (
            <div className="ventas-tiles">
              {report.tiles.map((tile) => (
                <article key={tile.label} className="ventas-tile">
                  <h2>{tile.label}</h2>
                  <p className="ventas-units">{tile.value}</p>
                  <p className="ventas-caption">{tile.detail}</p>
                </article>
              ))}
            </div>
          ) : null}
          {section === "reporte-maestro" ? (
            <>
              <Formulas formulas={report.formulas} />
              {report.byProject.length > 0 ? (
                <Table title="Por proyecto" head={["Proyecto", "Leads", "Pauta", "ROAS", "Reservas", "Ventas"]}>
                  {report.byProject.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{units(row.leads)}</td>
                      <td>{money(row.pautaGtq)}</td>
                      <td>{units(row.roas)}</td>
                      <td>{pairCells(row.reservas)}</td>
                      <td>{pairCells(row.ventas)}</td>
                    </tr>
                  ))}
                </Table>
              ) : null}
              {report.puertaAbierta ? <CostCenterBlock row={report.puertaAbierta} /> : null}
              <RangeEditor ranges={ranges} saving={saving} saved={saved} onChange={setRanges} onSave={saveRanges} />
              {report.fuentes.length > 0 ? (
                <Table title="Por fuente" head={["Fuente", "Reservas", "Ventas"]}>
                  {report.fuentes.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{pairCells(row.reservas)}</td>
                      <td>{pairCells(row.ventas)}</td>
                    </tr>
                  ))}
                </Table>
              ) : null}
              <Table title="Costo por plataforma" head={["Plataforma", "Ventas", "Costo por cierre", "Cómo se calcula"]}>
                {report.platforms.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{pairCells(row.ventas)}</td>
                    <td>{row.costo == null ? "—" : money(row.costo)}</td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </Table>
            </>
          ) : null}
          {section === "efectividad" ? (
            <>
              {report.campaigns.length > 0 ? <CampaignTable title="Campañas" rows={report.campaigns} /> : null}
              {report.puertaCampaigns.length > 0 ? <CampaignTable title="Puerta Abierta" rows={report.puertaCampaigns} /> : null}
              {report.campaigns.length === 0 && report.puertaCampaigns.length === 0 ? (
                <p className="mercadeo-note">No hay campañas en este corte.</p>
              ) : null}
            </>
          ) : null}
          {section === "costo-por-lead" ? (
            <>
              <h3>Costo por lead de Meta</h3>
              <MonthChart points={report.months} field="cpl" />
              <Table title="Mes a mes" head={["Mes", "Leads Meta", "Gasto Meta", "Costo por lead", "Nota"]}>
                {report.months.map((point) => (
                  <tr key={point.month}>
                    <td>{point.label}</td>
                    <td>{units(point.leads)}</td>
                    <td>{money(point.metaSpendGtq)}</td>
                    <td>{point.cpl == null ? "—" : money(point.cpl)}</td>
                    <td>{point.note ?? ""}</td>
                  </tr>
                ))}
              </Table>
            </>
          ) : null}
          {section === "inversion-acumulada" ? (
            <>
              <h3>Inversión acumulada</h3>
              <MonthChart points={report.months} field="cumulativeGtq" />
              <Table title="Mes a mes" head={["Mes", "Pauta del mes", "Acumulado", "Presupuesto", "Nota"]}>
                {report.months.map((point) => (
                  <tr key={point.month}>
                    <td>{point.label}</td>
                    <td>{money(point.pautaGtq)}</td>
                    <td>{money(point.cumulativeGtq)}</td>
                    <td>{point.planGtq == null ? "sin presupuesto" : money(point.planGtq)}</td>
                    <td>{point.note ?? ""}</td>
                  </tr>
                ))}
              </Table>
            </>
          ) : null}
          {report.comparisons.length > 0 && section !== "canales" ? (
            <div>
              <h3>Comparación</h3>
              {report.comparisons.map((comparison) => (
                <div key={comparison.label}>
                  <p className="mercadeo-note">{comparison.label}</p>
                  <div className="ventas-tiles">
                    {comparison.tiles.map((tile) => (
                      <article key={`${comparison.label}-${tile.label}`} className="ventas-tile">
                        <h2>{tile.label}</h2>
                        <p className="ventas-units">{tile.value}</p>
                        <p className="ventas-caption">{tile.detail}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Formulas({ formulas }: { formulas: string[] }) {
  return (
    <div>
      {formulas.map((formula) => (
        <p key={formula} className="mercadeo-formula">{formula}</p>
      ))}
    </div>
  );
}

function CostCenterBlock({ row }: { row: MercadeoReport["byProject"][number] }) {
  return (
    <div>
      <h3>Puerta Abierta</h3>
      <p className="mercadeo-note">Centro de costo propio. No se suma a los proyectos.</p>
      <div className="ventas-tiles">
        <article className="ventas-tile"><h2>Leads</h2><p className="ventas-units">{units(row.leads)}</p></article>
        <article className="ventas-tile"><h2>Pauta</h2><p className="ventas-units">{money(row.pautaGtq)}</p></article>
        <article className="ventas-tile"><h2>Reservas</h2><p className="ventas-units">{pairCells(row.reservas)}</p></article>
        <article className="ventas-tile"><h2>Ventas</h2><p className="ventas-units">{pairCells(row.ventas)}</p></article>
      </div>
    </div>
  );
}

function CampaignTable({ title, rows }: { title: string; rows: CampaignRow[] }) {
  if (rows.length === 0) return <p className="mercadeo-note">No hay campañas en este corte.</p>;
  return (
    <Table title={title} head={["Campaña", "Gasto", "Leads", "Costo por lead", "Alcance", "Impresiones", "Reservas", "Ventas"]}>
      {rows.map((row) => (
        <tr key={`${title}-${row.campaign}`}>
          <td>{row.campaign}</td>
          <td>{row.spendGtq == null ? "—" : money(row.spendGtq)}</td>
          <td>{row.leads == null ? "—" : units(row.leads)}</td>
          <td>{row.cpl == null ? "—" : money(row.cpl)}</td>
          <td>{row.reach == null ? "—" : units(row.reach)}</td>
          <td>{row.impressions == null ? "—" : units(row.impressions)}</td>
          <td>{pairCells(row.reservas)}</td>
          <td>{pairCells(row.ventas)}</td>
        </tr>
      ))}
    </Table>
  );
}

function Table({ title, head, children }: { title: string; head: string[]; children: ReactNode }) {
  return (
    <div>
      <h3>{title}</h3>
      <table className="ventas-table">
        <thead>
          <tr>{head.map((cell) => <th key={cell}>{cell}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function RangeEditor({
  ranges,
  saving,
  saved,
  onChange,
  onSave,
}: {
  ranges: RangeRow[];
  saving: boolean;
  saved: string | null;
  onChange: (ranges: RangeRow[]) => void;
  onSave: () => void;
}) {
  function setBound(slug: string, key: "min" | "max", raw: string) {
    const next = raw === "" ? null : Number(raw);
    onChange(ranges.map((range) => range.slug === slug ? { ...range, [key]: next != null && Number.isFinite(next) ? next : null } : range));
  }
  return (
    <div className="mercadeo-ranges">
      <h3>Meta mensual de leads</h3>
      <p className="mercadeo-note">Piso y techo del mes. Vacío quiere decir que ese centro no tiene meta. El cambio aplica a todos los meses.</p>
      {ranges.map((range) => (
        <div key={range.slug} className="mercadeo-range">
          <span>{range.label}</span>
          <input aria-label={`Piso ${range.label}`} inputMode="numeric" value={range.min ?? ""} onChange={(event) => setBound(range.slug, "min", event.target.value)} />
          <input aria-label={`Techo ${range.label}`} inputMode="numeric" value={range.max ?? ""} onChange={(event) => setBound(range.slug, "max", event.target.value)} />
        </div>
      ))}
      <button type="button" className="ventas-projects-button" disabled={saving} onClick={onSave}>
        {saving ? "Guardando..." : "Guardar metas"}
      </button>
      {saved ? <p className="mercadeo-note">{saved}</p> : null}
    </div>
  );
}

function MonthChart({ points, field }: { points: MonthPoint[]; field: "cpl" | "cumulativeGtq" }) {
  const values = points.map((point) => point[field] ?? 0);
  const max = Math.max(...values, 1);
  const width = 640;
  const height = 220;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const path = points.map((point, index) => {
    const x = index * step;
    const y = height - 24 - ((point[field] ?? 0) / max) * (height - 40);
    return `${index === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");
  return (
    <svg className="mercadeo-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <path d={path} fill="none" stroke="#0573b0" strokeWidth="2" />
      {points.map((point, index) => (
        <text key={point.month} x={index * step} y={height - 4} fontSize="11" fill="#64748b">{point.label}</text>
      ))}
    </svg>
  );
}

function Metricool() {
  return (
    <div>
      <p className="mercadeo-note">La operación de los canales digitales está en Metricool. Si el recuadro queda en blanco, abre el acceso directo.</p>
      <p><a href="https://app.metricool.com/" target="_blank" rel="noreferrer">Abrir Metricool</a></p>
      <iframe className="mercadeo-frame" title="Metricool" src="https://app.metricool.com/" />
    </div>
  );
}
