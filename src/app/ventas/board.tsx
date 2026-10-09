"use client";

import { useEffect, useState } from "react";
import type { VentasReport } from "@/lib/ventas/report";

const STORAGE_KEY = "pai-ventas-filtros";

type BarState = {
  periodo: string;
  desde: string;
  hasta: string;
  comparar: boolean;
  n: number;
  anio: boolean;
  proyecto: string;
  asesor: string;
  torre: string;
  modelo: string;
  habitaciones: string;
  promocion: string;
  fuente: string;
  motivo: string;
  descuento: string;
  estado: string;
  estadoUnidad: string;
  buscar: string;
  caso: boolean;
  ff: boolean;
};

const INITIAL: BarState = {
  periodo: "este-mes",
  desde: "",
  hasta: "",
  comparar: false,
  n: 1,
  anio: false,
  proyecto: "",
  asesor: "",
  torre: "",
  modelo: "",
  habitaciones: "",
  promocion: "",
  fuente: "",
  motivo: "",
  descuento: "",
  estado: "",
  estadoUnidad: "",
  buscar: "",
  caso: false,
  ff: false,
};

const SPECIFIC: Record<string, (keyof BarState)[]> = {
  "ventas-totales": ["asesor", "torre", "modelo", "habitaciones", "promocion", "descuento", "ff", "caso"],
  "objetivos-de-ventas": ["asesor"],
  "status-de-ventas": ["estado", "asesor"],
  "ventas-por-canales": ["fuente"],
  "analisis-de-inventario": ["torre", "modelo", "habitaciones", "estadoUnidad"],
  "inventario-general": ["torre", "estadoUnidad", "buscar"],
  "tasa-de-conversion": ["fuente"],
  desistimientos: ["motivo", "asesor"],
  descuentos: ["descuento"],
  "subidas-de-precios": ["torre"],
  "ff-y-casos-especiales": ["caso"],
  promociones: ["promocion"],
};

const LABELS: Record<string, string> = {
  asesor: "Asesor",
  torre: "Torre",
  modelo: "Modelo",
  habitaciones: "Habitaciones",
  promocion: "Promoción",
  descuento: "Descuento",
  fuente: "Fuente",
  motivo: "Motivo",
  estado: "Estado",
  estadoUnidad: "Estado de unidad",
  buscar: "Buscar unidad",
};

function money(value: number | null, currency = "GTQ"): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function units(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 }).format(value);
}

export default function VentasBoard({ section }: { section: string }) {
  const [bar, setBar] = useState<BarState>(INITIAL);
  const [ready, setReady] = useState(false);
  const [report, setReport] = useState<VentasReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setBar({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      /* keep defaults */
    }
    setReady(true);
  }, []);

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
    for (const key of ["proyecto", ...(SPECIFIC[section] ?? [])] as (keyof BarState)[]) {
      const value = bar[key];
      if (typeof value === "string" && value) params.set(key, value);
      if (value === true) params.set(key, "1");
    }
    const controller = new AbortController();
    setError(null);
    fetch(`/api/ventas?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo leer Ventas");
        setReport(body as VentasReport);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "No se pudo leer Ventas");
      });
    return () => controller.abort();
  }, [bar, ready, section]);

  function update(patch: Partial<BarState>) {
    setBar((current) => ({ ...current, ...patch }));
  }

  const specific = SPECIFIC[section] ?? [];

  return (
    <div className="ventas-board">
      <div className="ventas-bar">
        <label>
          Proyecto
          <select value={bar.proyecto} onChange={(event) => update({ proyecto: event.target.value })}>
            <option value="">Todos los proyectos</option>
            {(report?.choices.proyecto ?? []).map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label} ({choice.count})
              </option>
            ))}
          </select>
        </label>
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
            <input
              type="number"
              min={1}
              max={12}
              value={bar.n}
              onChange={(event) => update({ n: Number(event.target.value) })}
            />
          </label>
        ) : null}
        <label className="ventas-check">
          <input type="checkbox" checked={bar.anio} onChange={(event) => update({ anio: event.target.checked })} />
          Mismo período del año anterior
        </label>
        <button type="button" className="ventas-reset" onClick={() => setBar(INITIAL)}>
          Restablecer
        </button>
      </div>
      {specific.length > 0 ? (
        <div className="ventas-bar ventas-bar-specific">
          {specific.map((key) => {
            if (key === "buscar") {
              return (
                <label key={key}>
                  Buscar unidad
                  <input value={bar.buscar} onChange={(event) => update({ buscar: event.target.value })} />
                </label>
              );
            }
            if (key === "ff" || key === "caso") {
              return (
                <label key={key} className="ventas-check">
                  <input
                    type="checkbox"
                    checked={bar[key]}
                    onChange={(event) => update({ [key]: event.target.checked })}
                  />
                  {key === "ff" ? "Friends & Family" : "Caso especial"}
                </label>
              );
            }
            const choiceKey = key === "descuento" ? "tipoDescuento" : key;
            return (
              <label key={key}>
                {LABELS[key] ?? key}
                <select value={String(bar[key] ?? "")} onChange={(event) => update({ [key]: event.target.value })}>
                  <option value="">Todos</option>
                  {(report?.choices[choiceKey] ?? []).map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label} ({choice.count})
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="ventas-notice">{error}</p> : null}
      {report?.gapNotice ? <p className="ventas-notice">{report.gapNotice}</p> : null}
      {report?.emptyNotice ? <p className="ventas-notice">{report.emptyNotice}</p> : null}
      {report?.caption ? <p className="ventas-caption">{report.caption}</p> : null}
      {!report && !error ? <p className="ventas-caption">Cargando…</p> : null}

      {report && !report.emptyNotice ? (
        <>
          <p className="ventas-caption">{report.rangeLabel}</p>
          <div className="ventas-tiles">
            {report.tiles.map((tile) => (
              <article key={tile.label} className="ventas-tile">
                <h2>{tile.label}</h2>
                <p className="ventas-units">{units(tile.units)}</p>
                <p>{money(tile.gtq)}</p>
                {tile.sinMonto > 0 ? <p className="ventas-caption">{tile.sinMonto} sin monto</p> : null}
              </article>
            ))}
            {report.net ? (
              <article className="ventas-tile">
                <h2>Neto</h2>
                <p className="ventas-units">{units(report.net.units)}</p>
                <p>{money(report.net.gtq)}</p>
              </article>
            ) : null}
          </div>
          {report.comparisons.length > 0 ? (
            <div className="ventas-compare">
              {report.comparisons.map((comparison) => (
                <div key={comparison.label}>
                  <h3>{comparison.label}</h3>
                  <div className="ventas-tiles">
                    {comparison.tiles.map((tile) => (
                      <article key={tile.label} className="ventas-tile">
                        <h2>{tile.label}</h2>
                        <p className="ventas-units">{units(tile.units)}</p>
                        <p>{money(tile.gtq)}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {report.rows.length > 0 ? (
            <table className="ventas-table">
              <thead>
                <tr>
                  <th>Corte</th>
                  <th>Unidades</th>
                  <th>Quetzales</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{units(row.units)}</td>
                    <td>{section === "objetivos-de-ventas" ? units(row.gtq) : money(row.gtq)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {section === "objetivos-de-ventas" && report.rows.length > 0 ? (
            <p className="ventas-caption">La columna de quetzales muestra la meta en unidades. No hay meta en quetzales.</p>
          ) : null}
          {report.groups.map((group) => (
            <div key={group.currency}>
              <h3>{group.currency}</h3>
              <table className="ventas-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Unidades</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{units(row.units)}</td>
                      <td>{money(row.gtq ?? null, group.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {report.list.length > 0 ? (
            <table className="ventas-table">
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th>Torre</th>
                  <th>Estado</th>
                  <th>Precio de lista</th>
                </tr>
              </thead>
              <tbody>
                {report.list.map((row) => (
                  <tr key={`${row.tower}-${row.unit}-${row.status}`}>
                    <td>{row.unit}</td>
                    <td>{row.tower}</td>
                    <td>{row.status}</td>
                    <td>{money(row.amount, row.currency ?? "GTQ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
