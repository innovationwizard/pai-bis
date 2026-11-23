"use client";

import { useState, type ReactNode } from "react";
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
import type { CasoVista, DescuentoVista, DesistenciaVista, PrecioVista, PromoVista, VentasVista } from "@/lib/ventas/vista-types";
import { isDisplayProject } from "@/lib/projects";
import { ControlDescuentos } from "./descuentos";
import { ControlCasos } from "./casos";
import { ControlSubidas } from "./subidas";
import { Desistimientos } from "./desistimientos";

const moneyGtq = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 });
const moneyUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 });
const SERIES = ["#0d2041", "#0573b0", "#b45309", "#3d6f8f"];

function count(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return countFormat.format(value);
}
function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return moneyGtq.format(value);
}
function dollars(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return moneyUsd.format(value);
}
function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Sin dato";
  return `${new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 }).format(value * 100)}%`;
}
function tipNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}
function clip(label: string): string {
  return label.length <= 22 ? label : `${label.slice(0, 21)}…`;
}

export function isControlVista(vista: VentasVista): vista is DesistenciaVista | DescuentoVista | PrecioVista | CasoVista | PromoVista {
  return vista.section === "desistimientos" || vista.section === "descuentos" || vista.section === "subidas-de-precios" || vista.section === "ff-y-casos-especiales" || vista.section === "promociones";
}

export function ControlScreens({ vista }: { vista: DesistenciaVista | DescuentoVista | PrecioVista | CasoVista | PromoVista }) {
  if (vista.section === "desistimientos") return <Desistencias vista={vista} />;
  if (vista.section === "descuentos") return <Descuentos vista={vista} />;
  if (vista.section === "subidas-de-precios") return <Precios vista={vista} />;
  if (vista.section === "ff-y-casos-especiales") return <Casos vista={vista} />;
  return <Promos vista={vista} />;
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <p><strong>{value}</strong><span>{label}</span><small>{detail}</small></p>;
}

function Desistencias({ vista }: { vista: DesistenciaVista }) {
  return <Desistimientos vista={vista} pending={null} />;
}

function Descuentos({ vista }: { vista: DescuentoVista }) {
  return <ControlDescuentos vista={vista} pending={null} />;
}

function Precios({ vista }: { vista: PrecioVista }) {
  return <ControlSubidas vista={vista} pending={null} />;
}

function Casos({ vista }: { vista: CasoVista }) {
  return <ControlCasos vista={vista} pending={null} />;
}

function Promos({ vista }: { vista: PromoVista }) {
  const [open, setOpen] = useState(false);
  const data = vista.months.map((label, index) => {
    const row: Record<string, string | number> = { label };
    for (const series of vista.series) row[series.id] = series.units[index] ?? 0;
    return row;
  });
  return (
    <>
      <div className="op-kpis">
        <Kpi label="Con promoción" value={count(vista.promoted)} detail={`${count(vista.units)} ventas`} />
        <Kpi label="Promoción líder" value={vista.leader ? clip(vista.leader) : "—"} detail={pct(vista.leaderShare)} />
        <Kpi label="Quetzales" value={money(vista.gtq)} detail="de las ventas con promoción" />
        <Kpi label="Tipos" value={count(vista.tipos.length)} detail="en el periodo" />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Ventas por promoción">
        <header className="op-head"><div><h2>Por promoción</h2><p className="op-note">{vista.caption}</p></div><button type="button" className="op-text" onClick={() => setOpen(true)}>Por asesor</button></header>
        <Bars rows={vista.tipos} />
      </section>
      <section className="op-hero" aria-label="Promociones por mes" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Las cuatro, mes a mes</h2></div></header>
        <div className="op-chart">
          {vista.series.length === 0 ? <p className="op-note">Nada que graficar en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} width={32} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {vista.series.map((series, index) => (
                  <Line key={series.id} type="monotone" dataKey={series.id} name={series.label} stroke={SERIES[index] ?? "#0573b0"} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      {open ? (
        <Overlay title="Asesor y promoción" onClose={() => setOpen(false)}>
          <TraceTable rows={vista.byAsesor} columns={["Asesor", "Promoción", "Unidades", "Quetzales"]} cells={(row) => [row.asesor, row.promocion, count(row.units), money(row.gtq)]} />
        </Overlay>
      ) : null}
    </>
  );
}

function Bars({
  rows,
  valueKey = "units",
  format = count,
  onPick,
}: {
  rows: { id: string; label: string; units: number; gtq: number | null }[];
  valueKey?: "units" | "gtq";
  format?: (value: number | null) => string;
  onPick?: (row: { id: string; label: string; units: number; gtq: number | null }) => void;
}) {
  if (rows.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <div className="op-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={rows.slice(0, 12)} margin={{ left: 8, right: 56, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tickFormatter={(value) => format(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={148} tick={{ fontSize: 11, fill: "#0d2041" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value) => [format(tipNumber(value)), ""]} />
          <Bar dataKey={valueKey} fill="#0d2041" barSize={12} isAnimationActive={false} cursor={onPick ? "pointer" : undefined} onClick={(row) => {
            const payload = (row as { payload?: { id: string; label: string; units: number; gtq: number | null } }).payload;
            if (payload && onPick) onPick(payload);
          }}>
            {rows.slice(0, 12).map((row, index) => <Cell key={row.id} fill={index === 0 ? "#0d2041" : "#0573b0"} />)}
            <LabelList dataKey={valueKey} position="right" formatter={(value) => format(tipNumber(value))} fill="#334155" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TraceTable<T>({ rows, columns, cells }: { rows: T[]; columns: string[]; cells: (row: T) => string[] }) {
  if (rows.length === 0) return <p className="op-note">No hay filas en este periodo.</p>;
  return (
    <div className="op-modal-scroll" style={{ maxHeight: "50vh" }}>
      <table>
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{cells(row).map((cell, cellIndex) => <td key={columns[cellIndex]}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="op-overlay">
      <button type="button" className="op-backdrop" aria-label="Cerrar" onClick={onClose} />
      <aside className="op-drawer" role="dialog" aria-label={title}>
        <header><h2>{title}</h2><button type="button" onClick={onClose}>Cerrar</button></header>
        {children}
      </aside>
    </div>
  );
}
