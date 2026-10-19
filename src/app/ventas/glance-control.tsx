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
  const [title, setTitle] = useState<string | null>(null);
  const rows = title ? vista.traces.filter((row) => row.motivo === title || row.project === title) : vista.traces;
  return (
    <>
      <div className="op-kpis op-kpis-3">
        <Kpi label="Desistidas" value={count(vista.units)} detail="en el periodo" />
        <Kpi label="Valor" value={money(vista.gtq)} detail="valor del trato" />
        <Kpi label="Motivos" value={count(vista.motivos.length)} detail="en esta vista" />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Desistimientos por motivo">
        <header className="op-head"><div><h2>Por motivo</h2><p className="op-note">{vista.caption}</p></div></header>
        <Bars rows={vista.motivos} onPick={(row) => setTitle(row.label)} />
      </section>
      <section className="op-hero" aria-label="Desistimientos por proyecto" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Valor por proyecto</h2></div></header>
        <Bars rows={vista.byProject} valueKey="gtq" format={money} onPick={(row) => setTitle(row.label)} />
      </section>
      {title ? (
        <Overlay title={title} onClose={() => setTitle(null)}>
          <h3 style={{ margin: 0, color: "#0d2041", fontSize: 14 }}>Por asesor</h3>
          <Bars rows={vista.byAsesor} />
          <TraceTable rows={rows} columns={["Unidad", "Proyecto", "Asesor", "Motivo", "Baja", "Quetzales"]} cells={(row) => [row.unit, row.project, row.asesor, row.motivo, row.lostOn, money(row.gtq)]} />
        </Overlay>
      ) : null}
    </>
  );
}

function Descuentos({ vista }: { vista: DescuentoVista }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="op-kpis op-kpis-3">
        <Kpi label="Descuento" value={vista.gtq == null && vista.units === 0 ? "Sin dato" : money(vista.gtq)} detail={vista.units ? `${count(vista.units)} líneas` : "sin líneas"} />
        <Kpi label="Participación" value={pct(vista.share)} detail={vista.saleGtq == null ? "Sin ventas con descuento" : `sobre ${money(vista.saleGtq)}`} />
        <Kpi label="Con descuento" value={vista.share == null && vista.units === 0 ? "Sin dato" : count(vista.units)} detail="líneas del periodo" />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Descuento por tipo">
        <header className="op-head"><div><h2>Por tipo</h2><p className="op-note">{vista.caption}</p></div><button type="button" className="op-text" onClick={() => setOpen(true)}>Ver líneas</button></header>
        <Bars rows={vista.tipos} valueKey="gtq" format={money} />
      </section>
      <section className="op-hero" aria-label="Descuento por asesor" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Por asesor</h2></div></header>
        <Bars rows={vista.byAsesor} valueKey="gtq" format={money} />
      </section>
      {open ? (
        <Overlay title="Líneas de descuento" onClose={() => setOpen(false)}>
          <TraceTable rows={vista.traces} columns={["Asesor", "Tipo", "Quetzales", "Tasa"]} cells={(row) => [row.asesor, row.tipo, money(row.gtq), pct(row.rate)]} />
        </Overlay>
      ) : null}
    </>
  );
}

function Precios({ vista }: { vista: PrecioVista }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="op-kpis op-kpis-3">
        <Kpi label="Unidades" value={vista.gtq == null && vista.usd == null && vista.units === 0 ? "Sin dato" : count(vista.units)} detail="con subida en el periodo" />
        <Kpi label="Quetzales" value={vista.gtq == null && vista.units === 0 ? "Sin dato" : money(vista.gtq)} detail="diferencia de lista" />
        <Kpi label="Dólares" value={vista.usd == null && vista.units === 0 ? "Sin dato" : dollars(vista.usd)} detail="no se suman con quetzales" />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Subida por mes">
        <header className="op-head"><div><h2>Doce meses</h2><p className="op-note">{vista.caption}</p></div></header>
        <div className="op-chart">
          {vista.months.length === 0 ? <p className="op-note">Nada que graficar en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vista.months} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={48} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="gtq" name="Quetzales" stroke="#0d2041" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="usd" name="Dólares" stroke="#0573b0" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      <section className="op-hero" aria-label="Subida por proyecto" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Por proyecto</h2><button type="button" className="op-text" onClick={() => setOpen(true)}>Ver unidades</button></div></header>
        <div className="op-chart">
          {vista.byProject.length === 0 ? <p className="op-note">Nada que graficar en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vista.byProject} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={48} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="gtq" name="Quetzales" fill="#0d2041" isAnimationActive={false} />
                <Bar dataKey="usd" name="Dólares" fill="#0573b0" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      {open ? (
        <Overlay title="Unidades" onClose={() => setOpen(false)}>
          <TraceTable rows={vista.traces} columns={["Unidad", "Torre", "Antes", "Ahora", "Diferencia", "Moneda"]} cells={(row) => [row.unit, row.tower, count(row.previous), count(row.next), count(row.difference), row.currency]} />
        </Overlay>
      ) : null}
    </>
  );
}

function Casos({ vista }: { vista: CasoVista }) {
  const [open, setOpen] = useState(false);
  const known = vista.marked != null;
  return (
    <>
      <div className="op-kpis">
        <Kpi label="Friends & Family" value={vista.ff == null ? "Sin marcas" : count(vista.ff)} detail={known ? "en el periodo" : "la marca no está cargada"} />
        <Kpi label="Caso especial" value={vista.especial == null ? "Sin marcas" : count(vista.especial)} detail={known ? "en el periodo" : "la marca no está cargada"} />
        <Kpi label="Ventas" value={count(vista.sales)} detail="siguen en Ventas totales" />
        <Kpi label="Peso" value={pct(vista.share)} detail={known ? "sobre las ventas" : "sin marcas"} />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Casos contra el resto">
        <header className="op-head"><div><h2>Contra el resto de ventas</h2><p className="op-note">{vista.caption}</p></div></header>
        <Bars rows={vista.tipos} />
      </section>
      <section className="op-hero" aria-label="Casos por proyecto" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Por proyecto</h2>{vista.traces.length ? <button type="button" className="op-text" onClick={() => setOpen(true)}>Ver ventas</button> : null}</div></header>
        <div className="op-chart">
          {vista.byProject.length === 0 ? <p className="op-note">Nada que graficar en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vista.byProject} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} width={32} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sales" name="Ventas" fill="#94a3b8" isAnimationActive={false} />
                {known ? <Bar dataKey="marked" name="Con marca" fill="#0d2041" isAnimationActive={false} /> : null}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      {open ? (
        <Overlay title="Ventas marcadas" onClose={() => setOpen(false)}>
          <TraceTable rows={vista.traces} columns={["Unidad", "Proyecto", "Asesor", "Tipo", "Quetzales"]} cells={(row) => [row.unit, row.project, row.asesor, row.tipo, money(row.gtq)]} />
        </Overlay>
      ) : null}
    </>
  );
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
