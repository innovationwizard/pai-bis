"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Chart, CreditosVista, DealRow } from "@/lib/creditos/pipedrive-vista";

const PROJECTS = [
  { slug: "benestare", name: "Benestare" },
  { slug: "bosque-las-tapias", name: "Bosque Las Tapias" },
  { slug: "boulevard-5", name: "Boulevard 5" },
  { slug: "santa-elena", name: "Santa Elena" },
  { slug: "casa-elisa", name: "Casa Elisa" },
  { slug: "torre-coban", name: "Torre Cobán" },
];

type Filters = { periodo: string; desde: string; hasta: string; proyecto: string };

const INITIAL: Filters = { periodo: "este-mes", desde: "", hasta: "", proyecto: "todos" };

export default function CreditosBoard({ section, title }: { section: string; title: string }) {
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [focus, setFocus] = useState<string | null>(null);
  const [vista, setVista] = useState<CreditosVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams({ section, periodo: filters.periodo, proyecto: filters.proyecto });
    if (filters.periodo === "custom") {
      if (filters.desde) params.set("desde", filters.desde);
      if (filters.hasta) params.set("hasta", filters.hasta);
    }
    setLoading(true);
    fetch(`/api/creditos/vista?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as CreditosVista & { error?: string };
        if (ignore) return;
        if (!response.ok) throw new Error(body.error || "No se pudo leer Créditos");
        setVista(body);
        setError(null);
        setFocus(null);
      })
      .catch((caught: unknown) => {
        if (ignore) return;
        setError(caught instanceof Error ? caught.message : "No se pudo leer Créditos");
        setVista(null);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [section, filters]);

  const deals = vista ? vista.deals.filter((deal) => (focus ? deal.keys.includes(focus) : true)) : [];

  return (
    <div className="ventas-board">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#0d2041" }}>{title}</h1>
        {vista ? <p className="ventas-caption">{vista.question}</p> : null}
        {vista ? <p className="op-note">{vista.limitation}</p> : null}
      </div>
      <form className="ventas-bar" onSubmit={(event) => event.preventDefault()}>
        <label>
          Periodo
          <select value={filters.periodo} onChange={(event) => setFilters({ ...filters, periodo: event.target.value })}>
            <option value="este-mes">Este mes</option>
            <option value="mes-anterior">Mes anterior</option>
            <option value="este-trimestre">Este trimestre</option>
            <option value="este-ano">Este año</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        {filters.periodo === "custom" ? (
          <>
            <label>
              Desde
              <input type="date" value={filters.desde} onChange={(event) => setFilters({ ...filters, desde: event.target.value })} />
            </label>
            <label>
              Hasta
              <input type="date" value={filters.hasta} onChange={(event) => setFilters({ ...filters, hasta: event.target.value })} />
            </label>
          </>
        ) : null}
        <label>
          Proyecto
          <select value={filters.proyecto} onChange={(event) => setFilters({ ...filters, proyecto: event.target.value })}>
            <option value="todos">Todos</option>
            {PROJECTS.map((project) => (
              <option key={project.slug} value={project.slug}>{project.name}</option>
            ))}
          </select>
        </label>
        <button type="button" className="op-note" onClick={() => setFilters(INITIAL)}>
          Restablecer
        </button>
      </form>
      {vista ? <p className="op-note">Periodo {vista.periodLabel}. Cola abierta al {vista.asOf}.</p> : null}
      {loading ? <p className="op-note">Cargando…</p> : null}
      {error ? <p className="op-note op-warn">{error}</p> : null}
      {vista && !vista.loaded ? <p className="op-note">{vista.emptyMessage}</p> : null}
      {vista && vista.loaded && vista.emptyMessage ? <p className="op-note">{vista.emptyMessage}</p> : null}
      {vista && vista.loaded ? (
        <>
          <div className="op-kpis">
            {vista.kpis.map((item) => (
              <p key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </p>
            ))}
          </div>
          {vista.charts.map((chart) => (
            <ChartCard key={chart.title} chart={chart} onPick={setFocus} />
          ))}
          {vista.matrix && vista.matrix.length > 0 ? (
            <section className="op-hero">
              <h2>Cola abierta por etapa</h2>
              <p className="op-note">{vista.matrixNote}</p>
              <div style={{ overflowX: "auto" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left">Etapa</th>
                      {vista.matrix[0].cells.map((cell) => (
                        <th key={cell.project} className="px-2 py-2 text-right">{cell.project}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vista.matrix.map((row) => (
                      <tr key={row.lane}>
                        <td className="px-2 py-2">
                          {row.lane}
                          <div className="op-note">{row.scope}</div>
                        </td>
                        {row.cells.map((cell) => (
                          <td key={cell.project} className="px-2 py-2 text-right tabular-nums">{cell.text}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {vista.coverage && vista.coverage.length > 0 ? (
            <section className="op-hero">
              <h2>Qué hay registrado, por proyecto</h2>
              <p className="op-note">{vista.coverageNote}</p>
              <div style={{ overflowX: "auto" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left">Dato</th>
                      {vista.coverage[0].cells.map((cell) => (
                        <th key={cell.project} className="px-2 py-2 text-right">{cell.project}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vista.coverage.map((row) => (
                      <tr key={row.measure}>
                        <td className="px-2 py-2">{row.measure}</td>
                        {row.cells.map((cell) => (
                          <td key={cell.project} className="px-2 py-2 text-right">{cell.text}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {vista.queue && vista.queue.length > 0 ? (
            <section className="op-hero">
              <h2>Etapas con trato</h2>
              <p className="op-note">Ganado no es desembolso. La mediana es de días en la etapa actual.</p>
              <div style={{ overflowX: "auto" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left">Proyecto</th>
                      <th className="px-2 py-2 text-left">Etapa</th>
                      <th className="px-2 py-2 text-right">Abiertos</th>
                      <th className="px-2 py-2 text-right">Perdidos</th>
                      <th className="px-2 py-2 text-right">Ganados</th>
                      <th className="px-2 py-2 text-right">Mediana de días</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vista.queue.map((row) => (
                      <tr key={`${row.project}-${row.stage}`}>
                        <td className="px-2 py-2">{row.project}</td>
                        <td className="px-2 py-2">{row.stage}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.open}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.lost}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.won}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.median}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          <section className="op-hero">
            <h2>Tratos</h2>
            <p className="op-note">{vista.dealNote}</p>
            {focus ? (
              <button type="button" className="op-note" onClick={() => setFocus(null)}>
                Quitar el filtro de la barra
              </button>
            ) : null}
            {deals.length === 0 ? <p className="op-note">Ningún trato de esta lista coincide con la barra.</p> : (
              <div style={{ overflowX: "auto", maxHeight: 480 }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left">Trato</th>
                      <th className="px-2 py-2 text-left">Proyecto</th>
                      <th className="px-2 py-2 text-left">Etapa</th>
                      <th className="px-2 py-2 text-left">Estado</th>
                      <th className="px-2 py-2 text-left">Tipo</th>
                      <th className="px-2 py-2 text-right">Días en la etapa</th>
                      <th className="px-2 py-2 text-left">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal) => (
                      <DealLine key={deal.id} deal={deal} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function ChartCard({ chart, onPick }: { chart: Chart; onPick: (key: string) => void }) {
  const total = chart.points.reduce((sum, point) => sum + Number(point.value ?? 0), 0);
  return (
    <section className="op-hero">
      <h2>{chart.title}</h2>
      <p className="op-note">{chart.note}</p>
      {chart.points.length === 0 || total === 0 ? <p className="op-note">{chart.empty}</p> : (
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chart.points}
              margin={{ left: 0, right: 8, top: 8, bottom: 24 }}
              onClick={(state) => {
                const payload = state as { activePayload?: { payload?: { key?: unknown } }[] };
                const key = payload.activePayload?.[0]?.payload?.key;
                if (typeof key === "string") onPick(key);
              }}
            >
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} width={32} />
              <Tooltip />
              <Bar dataKey="value" fill="#0d2041" name="Tratos o hechos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function DealLine({ deal }: { deal: DealRow }) {
  return (
    <tr>
      <td className="px-2 py-2">{deal.title}</td>
      <td className="px-2 py-2">{deal.project}</td>
      <td className="px-2 py-2">{deal.stage}</td>
      <td className="px-2 py-2">{deal.status}</td>
      <td className="px-2 py-2">{deal.tipo}</td>
      <td className="px-2 py-2 text-right tabular-nums">{deal.days}</td>
      <td className="px-2 py-2">{deal.extra}</td>
    </tr>
  );
}
