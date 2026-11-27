"use client";

import type { ReactElement, ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import type { TreemapNode } from "recharts";
import type { InventarioPresupuestoReport } from "@/lib/mercadeo/inventario-presupuesto";

const NAVY = "#0d2041";
const MUTED = "#64748b";
const SERIES = ["#101b33", "#5e7192", "#a97e35", "#43786c", "#a8574a", "#9aa3b4"];

const STATUS_COLOR: Record<string, string> = {
  PCV: "#101b33",
  Disponible: "#43786c",
  Reservado: "#a97e35",
  Congelado: "#9aa3b4",
  "Congelado Junta Directiva": "#9aa3b4",
  Liberado: "#5e7192",
  CD: "#a8574a",
};

const ACCOUNT_COLOR: Record<string, string> = {
  Benestare: "#0d2041",
  "Bosque Las Tapias": "#0573b0",
  Boulevard5: "#3d6f8f",
  "Santa Elena": "#1a4a68",
  "Puerta Abierta": "#94a3b8",
  "Casa Elisa": "#5e7192",
};

const countFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quetzalFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const areaFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function count(value: number): string {
  return countFormat.format(value);
}

function usd(value: number): string {
  return usdFormat.format(value);
}

function quetzales(value: number): string {
  return `Q${quetzalFormat.format(value)}`;
}

function compactQuetzales(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000) {
    return `${sign}Q${(absolute / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (absolute >= 1_000) return `${sign}Q${(absolute / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return quetzales(value);
}

function percent(value: number, digits: number): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function signedPercent(value: number): string {
  const body = `${(Math.abs(value) * 100).toFixed(1)}%`;
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <article className="mk-panel">
      <h3>{title}</h3>
      {note ? <p className="vc-sub">{note}</p> : null}
      {children}
    </article>
  );
}

function Kpi({ label, value, detail, aria }: { label: string; value: string; detail: string; aria: string }) {
  return (
    <p aria-label={aria}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </p>
  );
}

function barHeight(rows: number): number {
  return Math.max(180, rows * 34 + 8);
}

function TypeTile(props: TreemapNode): ReactElement {
  const { x, y, width, height, name, value } = props;
  const color = typeof props.color === "string" ? props.color : NAVY;
  const showLabel = width > 56 && height > 32;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} stroke="#fff" strokeWidth={2} />
      {showLabel ? (
        <text x={x + 8} y={y + 16} fill="#fff" fontSize={11} fontWeight={700}>
          <tspan x={x + 8} dy={0}>{name}</tspan>
          <tspan x={x + 8} dy={14}>{count(typeof value === "number" ? value : 0)}</tspan>
        </text>
      ) : null}
    </g>
  );
}

export default function InventarioPresupuestoView({ report }: { report: InventarioPresupuestoReport }) {
  const inventory = report.inventario;
  const budget = report.presupuesto;
  const difference = roundDiff(budget.actual, budget.plan);
  const statusRows = inventory.byStatus.map((row) => ({
    ...row,
    label: `${count(row.count)}  ${percent(row.share, 0)}`,
  }));
  const types = inventory.byType.map((row, index) => ({
    name: row.name,
    count: row.count,
    color: SERIES[index % SERIES.length],
  }));

  return (
    <>
      <hr className="vc-band-rule" />
      <section id="integracion-de-inventarios" className="mk-band" aria-labelledby="integracion-de-inventarios-title">
        <h2 id="integracion-de-inventarios-title">Integración de Inventarios</h2>
        <p className="vc-sub">El periodo no cambia esta vista. Los proyectos sí.</p>
        <div className="mk-ads">
          <div className="mk-kpis mk-kpis-row">
            <Kpi label="Unidades" value={count(inventory.units)} detail="en el inventario" aria={`Unidades ${count(inventory.units)}`} />
            <Kpi
              label="Disponibles"
              value={count(inventory.disponibles)}
              detail={inventory.units === 0 ? "sin unidades" : `${percent(inventory.disponibles / inventory.units, 1)} del total`}
              aria={`Disponibles ${count(inventory.disponibles)}`}
            />
            <Kpi
              label="Valor de inventario"
              value={compactQuetzales(inventory.price)}
              detail={`${quetzales(inventory.price)} quetzales`}
              aria={`Valor de inventario ${quetzales(inventory.price)}`}
            />
            <Kpi
              label="Valor disponible"
              value={compactQuetzales(inventory.disponiblePrice)}
              detail={`${count(inventory.disponibles)} unidades`}
              aria={`Valor disponible ${quetzales(inventory.disponiblePrice)}`}
            />
          </div>

          {inventory.units === 0 ? (
            <p className="vc-sub">Sin unidades para estos proyectos.</p>
          ) : (
            <>
              <div className="mk-split">
                <Panel title="Estatus de unidades">
                  <div className="mk-chart" style={{ height: barHeight(statusRows.length) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusRows} layout="vertical" margin={{ top: 4, right: 72, left: 8, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={168} tick={{ fill: NAVY, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value, name) => {
                          const amount = asNumber(value);
                          return [amount == null ? "—" : `${count(amount)} unidades`, String(name)];
                        }} />
                        <Bar dataKey="count" barSize={16} radius={[0, 3, 3, 0]}>
                          {statusRows.map((row) => (
                            <Cell key={row.name} fill={STATUS_COLOR[row.name] ?? NAVY} />
                          ))}
                          <LabelList dataKey="label" position="right" fill={NAVY} fontSize={11} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel title="Tipología × estatus" note="conteo de unidades">
                  <div className="mk-chart mk-chart-lg">
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={types}
                        dataKey="count"
                        nameKey="name"
                        stroke="#fff"
                        fill={NAVY}
                        content={TypeTile}
                        isAnimationActive={false}
                      >
                        <Tooltip formatter={(value, name) => {
                          const amount = asNumber(value);
                          return [amount == null ? "—" : count(amount), String(name)];
                        }} />
                      </Treemap>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <div className="mk-split">
                <Panel title="Unidades por proyecto">
                  <Ranking rows={inventory.byProject} color={(name) => ACCOUNT_COLOR[name] ?? MUTED} />
                </Panel>
                <Panel title="Habitaciones" note="unidades por número de habitaciones">
                  <div className="mk-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={inventory.byBedrooms} margin={{ top: 18, right: 4, left: 0, bottom: 4 }}>
                        <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip formatter={(value) => {
                          const amount = asNumber(value);
                          return [amount == null ? "—" : count(amount), "Unidades"];
                        }} />
                        <Bar dataKey="count" fill={NAVY} barSize={28} radius={[3, 3, 0, 0]}>
                          <LabelList dataKey="count" position="top" fill={NAVY} fontSize={11} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <Panel title="Detalle de unidades" note="Primeras 200 filas, por precio. El total suma todas las unidades.">
                <table className="mk-table">
                  <thead>
                    <tr>
                      <th>Proyecto</th>
                      <th>Nivel</th>
                      <th>Unidad</th>
                      <th>Tipo</th>
                      <th>M²</th>
                      <th>Hab</th>
                      <th>Estatus</th>
                      <th>Reserva</th>
                      <th>Precio (Q)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.shown.map((row, index) => (
                      <tr key={`${row.project}-${row.level}-${row.number}-${index}`}>
                        <td>{row.project}</td>
                        <td>{row.level}</td>
                        <td>{count(row.number)}</td>
                        <td>{row.type}</td>
                        <td>{areaFormat.format(row.area)}</td>
                        <td>{count(row.bedrooms)}</td>
                        <td>{row.status}</td>
                        <td>{row.reserved ? dotted(row.reserved) : "—"}</td>
                        <td>{quetzalFormat.format(row.price)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td>Total</td>
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td>{quetzalFormat.format(inventory.price)}</td>
                    </tr>
                  </tbody>
                </table>
              </Panel>
            </>
          )}
        </div>
      </section>

      <hr className="vc-band-rule" />
      <section id="presupuesto-mercadeo" className="mk-band" aria-labelledby="presupuesto-mercadeo-title">
        <h2 id="presupuesto-mercadeo-title">Presupuesto Mercadeo</h2>
        <p className="vc-sub">
          El periodo no cambia el plan. El gasto real es la pauta de noviembre 2025 a febrero 2026. El archivo no trae divisa.
        </p>
        <div className="mk-ads">
          <div className="mk-kpis mk-kpis-row">
            <Kpi
              label="Presupuesto cargado"
              value={usd(budget.plan)}
              detail={`${count(budget.lines)} líneas`}
              aria={`Presupuesto cargado ${usd(budget.plan)}`}
            />
            <Kpi label="Meses presupuestados" value="4" detail="nov 25 – feb 26" aria="Cuatro meses, noviembre 2025 a febrero 2026" />
            <Kpi
              label="Gasto real"
              value={usd(budget.actual)}
              detail="de la pauta, los mismos meses"
              aria={`Gasto real ${usd(budget.actual)}`}
            />
            <Kpi
              label="Diferencia"
              value={usd(difference)}
              detail={budget.plan === 0 ? "sin plan" : `${signedPercent(budget.actual / budget.plan - 1)} vs. el plan`}
              aria={`Diferencia ${usd(difference)}`}
            />
          </div>

          <div className="mk-split">
            <Panel title="Presupuesto por proyecto">
              {budget.byProject.length === 0 ? (
                <p className="vc-sub">Sin presupuesto para estos proyectos.</p>
              ) : (
                <MoneyBars rows={budget.byProject} />
              )}
            </Panel>
            <Panel title="Presupuesto por concepto">
              {budget.byConcepto.length === 0 ? (
                <p className="vc-sub">Sin presupuesto para estos proyectos.</p>
              ) : (
                <MoneyBars rows={budget.byConcepto} />
              )}
            </Panel>
          </div>

          <Panel title="Líneas de presupuesto">
            {budget.rows.length === 0 ? (
              <p className="vc-sub">Sin presupuesto para estos proyectos.</p>
            ) : (
              <>
                <table className="mk-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Mes</th>
                      <th>Proyecto</th>
                      <th>Conformado</th>
                      <th>Concepto</th>
                      <th>Proveedor</th>
                      <th>Inversión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budget.rows.map((row, index) => (
                      <tr key={`${row.fecha}-${row.project}-${row.concepto}-${index}`}>
                        <td style={row.badDate ? { color: "#a8433a", fontWeight: 700 } : undefined}>{row.fecha || "—"}</td>
                        <td>{row.mes}</td>
                        <td>{row.raw}</td>
                        <td>{row.project}</td>
                        <td>{row.concepto}</td>
                        <td>{row.proveedor}</td>
                        <td>{usd(row.inversion)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td>Total</td>
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td>{usd(budget.plan)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="vc-sub">Las fechas en rojo no existen en el calendario y vienen así desde el archivo.</p>
              </>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}

function roundDiff(actual: number, plan: number): number {
  return Math.round((actual - plan) * 100) / 100;
}

function Ranking({
  rows,
  color,
}: {
  rows: { name: string; count: number; price: number; disponibles: number }[];
  color: (name: string) => string;
}) {
  return (
    <div className="mk-chart" style={{ height: barHeight(rows.length) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: NAVY, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value, name, item) => {
            const amount = asNumber(value);
            const payload = item.payload;
            const record = payload !== null && typeof payload === "object" ? payload as { price?: unknown; disponibles?: unknown } : null;
            const price = asNumber(record?.price);
            const disponibles = asNumber(record?.disponibles);
            const text = amount == null ? "—" : count(amount);
            const extra = price == null || disponibles == null ? "" : ` · ${compactQuetzales(price)} · ${count(disponibles)} disponibles`;
            return [`${text}${extra}`, String(name)];
          }} />
          <Bar dataKey="count" barSize={14} radius={[0, 3, 3, 0]}>
            {rows.map((row) => (
              <Cell key={row.name} fill={color(row.name)} />
            ))}
            <LabelList dataKey="count" position="right" fill={NAVY} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MoneyBars({ rows }: { rows: { name: string; inversion: number }[] }) {
  return (
    <div className="mk-chart" style={{ height: barHeight(rows.length) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 88, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: NAVY, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value) => {
            const amount = asNumber(value);
            return [amount == null ? "—" : usd(amount), "Inversión"];
          }} />
          <Bar dataKey="inversion" fill={NAVY} barSize={14} radius={[0, 3, 3, 0]}>
            {rows.map((row, index) => (
              <Cell key={row.name} fill={SERIES[index % SERIES.length] ?? NAVY} />
            ))}
            <LabelList dataKey="inversion" position="right" formatter={(value) => {
              const amount = asNumber(value);
              return amount == null ? "" : usd(amount);
            }} fill={NAVY} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
