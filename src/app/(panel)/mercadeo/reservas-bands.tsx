"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CountRow, MercadeoReservasReport } from "@/lib/mercadeo/reservas-report";

const NAVY = "#0d2041";
const BLUE = "#0573b0";
const GRID = "#e2e8f0";
const MUTED = "#64748b";

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

function count(value: number): string {
  return countFormat.format(value);
}

function compactUsd(value: number): string {
  return `$${(Math.abs(value) / 1_000).toFixed(2)}K`;
}

function tenthUsd(value: number): string {
  if (value === 0) return "";
  if (Math.abs(value) < 1000) return usdFormat.format(value);
  return `$${(value / 1_000).toFixed(1)}K`;
}

function money(value: number | null): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 10_000) return compactUsd(value);
  return usdFormat.format(value);
}

function percent(value: number | null, digits: number): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function signedPercent(value: number | null): string {
  if (value == null) return "—";
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

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mk-panel">
      <h3>{title}</h3>
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

function horizontalHeight(rows: number): number {
  return Math.max(210, rows * 28 + 12);
}

function Ranking({ rows, color }: { rows: CountRow[]; color?: (name: string) => string }) {
  if (rows.length === 0) return <p className="vc-sub">Sin reservas en el periodo.</p>;
  return (
    <div className="mk-chart" style={{ height: horizontalHeight(rows.length) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={172}
            tick={{ fill: NAVY, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip formatter={(value) => {
            const amount = asNumber(value);
            return [amount == null ? "—" : count(amount), "Reservas"];
          }} />
          <Bar dataKey="count" fill={NAVY} barSize={14} radius={[0, 3, 3, 0]}>
            {rows.map((row) => (
              <Cell key={row.name} fill={color ? color(row.name) : NAVY} />
            ))}
            <LabelList dataKey="count" position="right" fill={NAVY} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function MercadeoReservasView({ report }: { report: MercadeoReservasReport }) {
  const performance = report.performanceS;
  const reservas = report.reporte;
  const projectColor = (name: string) => ACCOUNT_COLOR[name] ?? MUTED;

  return (
    <>
      <hr className="vc-band-rule" />
      <section id="performance-s" className="mk-band" aria-labelledby="performance-s-title">
        <h2 id="performance-s-title">Performance S</h2>
        <p className="vc-sub">
          La inversión es la misma pauta de Performance Ads. Las reservas son el dato cargado al {dotted(report.refreshed)}.
        </p>
        <div className="mk-ads">
          <div className="mk-kpis mk-kpis-row">
            <Kpi
              label="Reservas"
              value={count(performance.reservas)}
              detail="en el periodo"
              aria={`Reservas ${count(performance.reservas)}`}
            />
            <Kpi
              label="Inversión"
              value={compactUsd(performance.spendUsd)}
              detail={usdFormat.format(performance.spendUsd)}
              aria={`Inversión ${usdFormat.format(performance.spendUsd)}`}
            />
            <Kpi
              label="Costo por reserva"
              value={money(performance.costoPorReserva)}
              detail="inversión / reservas"
              aria={`Costo por reserva ${money(performance.costoPorReserva)}`}
            />
            <Kpi
              label="Meses con ambos"
              value={performance.monthCount === 0 ? "—" : `${count(performance.monthsWithBoth)} de ${count(performance.monthCount)}`}
              detail="con pauta y con reservas"
              aria={`Meses con pauta y reservas ${performance.monthsWithBoth} de ${performance.monthCount}`}
            />
          </div>

          <Panel title="Inversión en pauta vs. reservas mensuales">
            {performance.months.length === 0 ? (
              <p className="vc-sub">Sin meses en el periodo.</p>
            ) : (
              <>
                <div className="mk-chart mk-chart-lg">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={performance.months} margin={{ top: 22, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} interval={0} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="reservas" hide />
                      <YAxis yAxisId="spend" orientation="right" hide />
                      <Tooltip formatter={(value, name) => {
                        const amount = asNumber(value);
                        if (name === "spendUsd") return [amount == null ? "—" : usdFormat.format(amount), "Inversión"];
                        return [amount == null ? "—" : count(amount), "Reservas"];
                      }} />
                      <Bar yAxisId="reservas" dataKey="reservas" fill={NAVY} barSize={22} radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="reservas" position="top" fill={NAVY} fontSize={11} />
                      </Bar>
                      <Line yAxisId="spend" type="monotone" dataKey="spendUsd" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE }}>
                        <LabelList dataKey="spendUsd" position="top" formatter={(value) => tenthUsd(asNumber(value) ?? 0)} fill={BLUE} fontSize={11} />
                      </Line>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <ul className="op-legend">
                  <li><i style={{ background: NAVY }} />Reservas</li>
                  <li><i style={{ background: BLUE }} />Inversión (USD)</li>
                </ul>
              </>
            )}
          </Panel>

          <Panel title="Detalle mensual">
            <table className="mk-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Inversión</th>
                  <th>Leads</th>
                  <th>Reservas</th>
                  <th>De lead a reserva</th>
                  <th>Costo por reserva</th>
                </tr>
              </thead>
              <tbody>
                {performance.months.map((month) => (
                  <tr key={month.key}>
                    <td>{month.label}</td>
                    <td>{usdFormat.format(month.spendUsd)}</td>
                    <td>{count(month.leads)}</td>
                    <td>{count(month.reservas)}</td>
                    <td>{percent(month.leadToReserva, 2)}</td>
                    <td>{month.costoPorReserva == null ? "—" : usdFormat.format(month.costoPorReserva)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Total</td>
                  <td>{usdFormat.format(performance.spendUsd)}</td>
                  <td>{count(performance.leads)}</td>
                  <td>{count(performance.reservas)}</td>
                  <td>{percent(ratioOrNull(performance.reservas, performance.leads), 2)}</td>
                  <td>{performance.costoPorReserva == null ? "—" : usdFormat.format(performance.costoPorReserva)}</td>
                </tr>
              </tbody>
            </table>
          </Panel>
        </div>
      </section>

      <hr className="vc-band-rule" />
      <section id="reporte-reservas" className="mk-band" aria-labelledby="reporte-reservas-title">
        <h2 id="reporte-reservas-title">Reporte Reservas</h2>
        <div className="mk-ads">
          <div className="mk-kpis mk-kpis-row">
            <Kpi
              label="Reservas"
              value={count(reservas.reservas)}
              detail="en el periodo"
              aria={`Reservas ${count(reservas.reservas)}`}
            />
            <Kpi
              label="Costo por cierre"
              value={money(reservas.costoPorCierre)}
              detail="inversión / reservas"
              aria={`Costo por cierre ${money(reservas.costoPorCierre)}`}
            />
            <Kpi
              label={reservas.last ? `Reservas · ${reservas.last.label}` : "Último mes"}
              value={reservas.last ? count(reservas.last.count) : "—"}
              detail={reservas.previous ? `mes anterior ${count(reservas.previous.count)}` : "sin mes previo"}
              aria={reservas.last ? `Reservas en ${reservas.last.label} ${count(reservas.last.count)}` : "Sin último mes"}
            />
            <Kpi
              label="Variación mensual"
              value={signedPercent(reservas.variation)}
              detail={reservas.last && reservas.previous ? `${reservas.previous.label} → ${reservas.last.label}` : "sin mes previo"}
              aria={`Variación mensual ${signedPercent(reservas.variation)}`}
            />
          </div>

          <div className="mk-split">
            <Panel title="Reservas por fuente">
              <Ranking rows={reservas.byFuente} />
            </Panel>
            <Panel title="Reservas por proyecto">
              <Ranking rows={reservas.byProyecto} color={projectColor} />
            </Panel>
          </div>

          <div className="mk-split">
            <Panel title="Reservas por mes">
              {reservas.months.length === 0 ? (
                <p className="vc-sub">Sin meses en el periodo.</p>
              ) : (
                <div className="mk-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reservas.months} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} interval={0} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip formatter={(value) => {
                        const amount = asNumber(value);
                        return [amount == null ? "—" : count(amount), "Reservas"];
                      }} />
                      <Line type="monotone" dataKey="count" stroke={NAVY} strokeWidth={2} dot={{ r: 3, fill: NAVY }}>
                        <LabelList dataKey="count" position="top" fill={NAVY} fontSize={11} />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
            <Panel title="Reservas por asesor">
              <Ranking rows={reservas.byAsesor} />
            </Panel>
          </div>

          <Panel title="Reservas por fuente">
            <p className="vc-sub">
              La inversión no viene separada por fuente. Cada fila es la parte del total que corresponde a sus reservas.
            </p>
            {reservas.fuentes.length === 0 ? (
              <p className="vc-sub">Sin reservas en el periodo.</p>
            ) : (
              <table className="mk-table">
                <thead>
                  <tr>
                    <th>Fuente</th>
                    <th>Reservas</th>
                    <th>Participación</th>
                    <th>Parte de la inversión</th>
                  </tr>
                </thead>
                <tbody>
                  {reservas.fuentes.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{count(row.count)}</td>
                      <td>{percent(row.share, 1)}</td>
                      <td>{usdFormat.format(row.spendUsd)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Total</td>
                    <td>{count(reservas.reservas)}</td>
                    <td>{reservas.reservas === 0 ? "—" : "100.0%"}</td>
                    <td>{usdFormat.format(reservas.spendUsd)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}

function ratioOrNull(part: number, total: number): number | null {
  if (total === 0) return null;
  return part / total;
}
