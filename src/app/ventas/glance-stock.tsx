"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import type { AnalisisVista, ConversionVista, InventarioVista, ValorVista, VentasVista } from "@/lib/ventas/vista-types";

type StockBar = {
  periodo: string;
  desde: string;
  hasta: string;
  proyectos: string[] | null;
  asesor: string;
  torre: string;
  fuente: string;
  modelo: string;
  habitaciones: string;
  estadoUnidad: string;
  buscar: string;
};

type UnitRow = { unit: string; tower: string; model: string; status: string; amount: number | null; currency: string | null };

const moneyGtq = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 });
const moneyUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 });

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

function pair(gtq: number | null, usd: number | null): string {
  const parts = [gtq != null ? money(gtq) : "", usd != null ? dollars(usd) : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Sin precio de lista";
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
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

export function isStockVista(vista: VentasVista): vista is AnalisisVista | InventarioVista | ValorVista | ConversionVista {
  return vista.section === "analisis-de-inventario" || vista.section === "inventario-general" || vista.section === "valor-del-proyecto" || vista.section === "tasa-de-conversion";
}

export function StockScreens({ vista, bar }: { vista: AnalisisVista | InventarioVista | ValorVista | ConversionVista; bar: StockBar }) {
  const [drill, setDrill] = useState<{ title: string; modelo: string; project: string } | null>(null);
  useEffect(() => setDrill(null), [vista]);
  return (
    <>
      {vista.section === "analisis-de-inventario" ? <Analisis vista={vista} onModel={(id, label) => setDrill({ title: label, modelo: id, project: "" })} /> : null}
      {vista.section === "inventario-general" ? <General vista={vista} onProject={(id, label) => setDrill({ title: label, modelo: "", project: id })} /> : null}
      {vista.section === "valor-del-proyecto" ? <Valor vista={vista} onProject={(id, label) => setDrill({ title: label, modelo: "", project: id })} /> : null}
      {vista.section === "tasa-de-conversion" ? <Conversion vista={vista} /> : null}
      {drill && vista.section !== "tasa-de-conversion" && vista.section !== "valor-del-proyecto" ? (
        <UnitDrawer vista={vista} bar={bar} drill={drill} onClose={() => setDrill(null)} />
      ) : null}
      {drill && vista.section === "valor-del-proyecto" ? <TraceDrawer vista={vista} projectId={drill.project} title={drill.title} onClose={() => setDrill(null)} /> : null}
    </>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <p>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </p>
  );
}

function Analisis({ vista, onModel }: { vista: AnalisisVista; onModel: (id: string, label: string) => void }) {
  const rows = vista.models.slice(0, 12);
  return (
    <>
      <div className="op-kpis">
        <Kpi label="Modelo líder" value={vista.leader ? clip(vista.leader) : "—"} detail={vista.leaderShare == null ? "Sin ventas" : pct(vista.leaderShare)} />
        <Kpi label="Vendidas" value={count(vista.sold)} detail="en el periodo" />
        <Kpi label="Disponibles" value={count(vista.available)} detail="siguen en venta" />
        <Kpi label="Modelos" value={count(vista.models.length)} detail={vista.models.length > 12 ? "el gráfico muestra 12" : "en esta vista"} />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Ventas por modelo">
        <header className="op-head"><div><h2>Vendidas por modelo</h2><p className="op-note">{vista.caption}</p></div></header>
        <Horizontal rows={rows} nameKey="label" valueKey="sold" onPick={(row) => onModel(row.id, row.label)} />
      </section>
      <section className="op-hero" aria-label="Vendido contra disponible" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Vendidas contra disponible</h2><p className="op-note">Disponible sigue en venta al fin del periodo.</p></div></header>
        <Grouped rows={rows} bars={[{ key: "sold", name: "Vendidas", fill: "#0d2041" }, { key: "available", name: "Disponible", fill: "#0573b0" }]} onPick={(row) => onModel(row.id, row.label)} />
      </section>
    </>
  );
}

function General({ vista, onProject }: { vista: InventarioVista; onProject: (id: string, label: string) => void }) {
  return (
    <>
      <div className="op-kpis op-kpis-3">
        <Kpi label="Vendido" value={count(vista.vendido)} detail={pair(vista.vendidoGtq, vista.vendidoUsd)} />
        <Kpi label="Congelado" value={count(vista.congelado)} detail={pair(vista.congeladoGtq, vista.congeladoUsd)} />
        <Kpi label="Disponible" value={count(vista.disponible)} detail={pair(vista.disponibleGtq, vista.disponibleUsd)} />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Inventario por proyecto">
        <header className="op-head"><div><h2>Por proyecto</h2><p className="op-note">{vista.caption}</p></div></header>
        <div className="op-chart">
          {vista.byProject.length === 0 ? <p className="op-note">Nada que graficar en este periodo.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vista.byProject} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip formatter={(value, name) => [count(tipNumber(value)), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="vendido" name="Vendido" stackId="estado" fill="#0d2041" isAnimationActive={false} onClick={(row) => pickProject(row, onProject)} />
                <Bar dataKey="congelado" name="Congelado" stackId="estado" fill="#b45309" isAnimationActive={false} onClick={(row) => pickProject(row, onProject)} />
                <Bar dataKey="disponible" name="Disponible" stackId="estado" fill="#0573b0" isAnimationActive={false} onClick={(row) => pickProject(row, onProject)} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      <section className="op-hero" aria-label="Precio de lista disponible" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Precio de lista disponible</h2></div></header>
        <Grouped
          rows={vista.byProject}
          bars={[{ key: "disponibleGtq", name: "Quetzales", fill: "#0d2041" }, { key: "disponibleUsd", name: "Dólares", fill: "#0573b0" }]}
          format={(value) => count(value)}
          onPick={(row) => onProject(row.id, row.label)}
        />
      </section>
    </>
  );
}

function Valor({ vista, onProject }: { vista: ValorVista; onProject: (id: string, label: string) => void }) {
  return (
    <>
      <div className="op-kpis">
        <Kpi label="Lista en quetzales" value={money(vista.listGtq)} detail="precio de lista vigente" />
        <Kpi label="Lista en dólares" value={dollars(vista.listUsd)} detail="no se suma con quetzales" />
        <Kpi label="Desistido" value={count(vista.lossUnits)} detail="unidades del periodo" />
        <Kpi label="Valor desistido" value={money(vista.lossGtq)} detail="valor del trato" />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Valor de ventas y desistimientos">
        <header className="op-head"><div><h2>Doce meses</h2><p className="op-note">{vista.caption}</p></div></header>
        <div className="op-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={vista.months} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => money(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} width={64} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value, name) => [money(tipNumber(value)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#0d2041" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="desistido" name="Desistido" stroke="#b91c1c" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="op-hero" aria-label="Disponible contra desistido" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Disponible contra desistido</h2></div></header>
        <Grouped
          rows={vista.byProject}
          bars={[
            { key: "disponibleGtq", name: "Disponible Q", fill: "#0573b0" },
            { key: "disponibleUsd", name: "Disponible $", fill: "#3d6f8f" },
            { key: "desistidoGtq", name: "Desistido", fill: "#b91c1c" },
          ]}
          format={money}
          onPick={(row) => onProject(row.id, row.label)}
        />
      </section>
    </>
  );
}

function Conversion({ vista }: { vista: ConversionVista }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="op-kpis">
        <Kpi label="Lead a venta" value={pct(vista.saleRate)} detail={`${count(vista.sales)} ventas`} />
        <Kpi label="Lead a PCV" value={pct(vista.pcvRate)} detail={`${count(vista.pcv)} PCV`} />
        <Kpi label="Leads" value={count(vista.leads)} detail={`${count(vista.visits)} visitas`} />
        <Kpi label="Ventas" value={count(vista.sales)} detail="en el periodo" />
      </div>
      <section className="op-hero op-hero-budget" aria-label="Embudo">
        <header className="op-head">
          <div><h2>Leads, visitas, ventas y PCV</h2><p className="op-note">{vista.caption}</p></div>
          <button type="button" className="op-text" onClick={() => setOpen(true)}>Por fuente y asesor</button>
        </header>
        <Horizontal rows={vista.funnel} nameKey="label" valueKey="units" />
      </section>
      <section className="op-hero" aria-label="Tasa mensual" style={{ flex: 1 }}>
        <header className="op-head"><div><h2>Tasa lead a venta</h2></div></header>
        <div className="op-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={vista.months} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => pct(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} width={40} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value, name) => [name === "Tasa" ? pct(tipNumber(value)) : count(tipNumber(value)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="rate" name="Tasa" stroke="#0d2041" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      {open ? (
        <Overlay title="Por fuente y por asesor" onClose={() => setOpen(false)}>
          <RateTable title="Fuente" rows={vista.byFuente} />
          <RateTable title="Asesor" rows={vista.byAsesor} />
        </Overlay>
      ) : null}
    </>
  );
}

function RateTable({ title, rows }: { title: string; rows: ConversionVista["byFuente"] }) {
  return (
    <>
      <h3 style={{ margin: "8px 0 0", color: "#0d2041", fontSize: 14 }}>{title}</h3>
      <table>
        <thead><tr><th>{title}</th><th>Leads</th><th>Visitas</th><th>Ventas</th><th>PCV</th><th>Tasa</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}><td>{row.label}</td><td>{count(row.leads)}</td><td>{count(row.visits)}</td><td>{count(row.sales)}</td><td>{count(row.pcv)}</td><td>{pct(row.saleRate)}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Horizontal<T extends Record<string, string | number | null>>({
  rows,
  nameKey,
  valueKey,
  onPick,
}: {
  rows: T[];
  nameKey: keyof T & string;
  valueKey: keyof T & string;
  onPick?: (row: T) => void;
}) {
  if (rows.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <div className="op-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={rows} margin={{ left: 8, right: 36, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey={nameKey as never} width={148} tick={{ fontSize: 11, fill: "#0d2041" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value) => [count(tipNumber(value)), ""]} />
          <Bar dataKey={valueKey as never} fill="#0d2041" barSize={12} isAnimationActive={false} cursor={onPick ? "pointer" : undefined} onClick={(row) => {
            const payload = (row as { payload?: T }).payload;
            if (payload && onPick) onPick(payload);
          }}>
            {rows.map((row, index) => <Cell key={`${String(row[nameKey])}-${index}`} fill={index === 0 ? "#0d2041" : "#0573b0"} />)}
            <LabelList dataKey={valueKey as never} position="right" formatter={(value) => count(tipNumber(value))} fill="#334155" fontSize={11} />
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
  format = count,
}: {
  rows: T[];
  bars: { key: keyof T & string; name: string; fill: string }[];
  onPick?: (row: T) => void;
  format?: (value: number | null) => string;
}) {
  if (rows.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <div className="op-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tickFormatter={(value) => format(tipNumber(value))} tick={{ fontSize: 11, fill: "#64748b" }} width={56} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value, name) => [format(tipNumber(value)), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key as never} name={bar.name} fill={bar.fill} barSize={12} isAnimationActive={false} cursor={onPick ? "pointer" : undefined} onClick={(row) => {
              const payload = (row as { payload?: T }).payload;
              if (payload && onPick) onPick(payload);
            }} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function pickProject(row: unknown, onProject: (id: string, label: string) => void) {
  const payload = (row as { payload?: { id?: string; label?: string } }).payload;
  if (payload?.id && payload.label) onProject(payload.id, payload.label);
}

function UnitDrawer({
  vista,
  bar,
  drill,
  onClose,
}: {
  vista: AnalisisVista | InventarioVista;
  bar: StockBar;
  drill: { title: string; modelo: string; project: string };
  onClose: () => void;
}) {
  const [units, setUnits] = useState<UnitRow[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ section: vista.section, periodo: bar.periodo });
    if (bar.periodo === "custom" && bar.desde && bar.hasta) {
      params.set("desde", bar.desde);
      params.set("hasta", bar.hasta);
    }
    if (bar.proyectos === null) {
      /* todos */
    } else if (bar.proyectos.length === 0) params.append("proyecto", "ninguno");
    else for (const id of bar.proyectos) params.append("proyecto", id);
    if (drill.project) params.set("proyecto", drill.project);
    if (drill.modelo || bar.modelo) params.set("modelo", drill.modelo || bar.modelo);
    if (bar.torre) params.set("torre", bar.torre);
    if (bar.habitaciones) params.set("habitaciones", bar.habitaciones);
    if (bar.estadoUnidad) params.set("estadoUnidad", bar.estadoUnidad);
    if (bar.buscar) params.set("buscar", bar.buscar);
    const controller = new AbortController();
    fetch(`/api/ventas/detalle?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { units?: UnitRow[]; note?: string | null; error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo leer las unidades");
        setUnits(body.units ?? []);
        setNote(body.note ?? null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "No se pudo leer las unidades");
      });
    return () => controller.abort();
  }, [bar, drill, vista.section]);

  return (
    <Overlay title={drill.title} onClose={onClose}>
      {vista.section === "analisis-de-inventario" ? (
        <table>
          <thead><tr><th>Torre</th><th>Vendidas</th><th>Disponible</th></tr></thead>
          <tbody>
            {vista.byTower.filter((row) => row.modelId === drill.modelo).map((row) => (
              <tr key={`${row.modelId}-${row.tower}`}><td>{row.tower}</td><td>{count(row.sold)}</td><td>{count(row.available)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {vista.section === "inventario-general" ? (
        <table>
          <thead><tr><th>Torre</th><th>Vendido</th><th>Congelado</th><th>Disponible</th></tr></thead>
          <tbody>
            {vista.byTower.filter((row) => row.projectId === drill.project).map((row) => (
              <tr key={`${row.projectId}-${row.tower}`}><td>{row.tower}</td><td>{count(row.vendido)}</td><td>{count(row.congelado)}</td><td>{count(row.disponible)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {error ? <p className="op-note op-warn">{error}</p> : null}
      {note ? <p className="op-note">{note}</p> : null}
      {units == null && !error ? <p className="op-note">Cargando unidades…</p> : null}
      {units && units.length > 0 ? (
        <div className="op-modal-scroll" style={{ maxHeight: "50vh" }}>
          <table>
            <thead><tr><th>Unidad</th><th>Torre</th><th>Modelo</th><th>Estado</th><th>Precio de lista</th></tr></thead>
            <tbody>
              {units.map((row) => (
                <tr key={`${row.tower}-${row.unit}-${row.status}`}>
                  <td>{row.unit}</td>
                  <td>{row.tower}</td>
                  <td>{row.model}</td>
                  <td>{row.status}</td>
                  <td>{row.currency === "USD" ? dollars(row.amount) : money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Overlay>
  );
}

function TraceDrawer({ vista, projectId, title, onClose }: { vista: ValorVista; projectId: string; title: string; onClose: () => void }) {
  const rows = vista.traces.filter((row) => row.project === title);
  return (
    <Overlay title={title} onClose={onClose}>
      <p className="op-note">Venta, baja y estado de inventario al fin del periodo. {projectId ? "" : ""}</p>
      {rows.length === 0 ? <p className="op-note">No hay desistimientos de este proyecto en el periodo.</p> : (
        <div className="op-modal-scroll" style={{ maxHeight: "60vh" }}>
          <table>
            <thead><tr><th>Unidad</th><th>Torre</th><th>Venta</th><th>Baja</th><th>Estado</th><th>Quetzales</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.unit}-${row.lostOn}`}>
                  <td>{row.unit}</td>
                  <td>{row.tower}</td>
                  <td>{row.saleOn ?? "—"}</td>
                  <td>{row.lostOn}</td>
                  <td>{row.status}</td>
                  <td>{money(row.gtq)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
