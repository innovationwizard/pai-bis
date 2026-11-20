"use client";

import { useMemo, type ReactElement, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import type { TreemapNode } from "recharts";
import type { PerformanceAdsReport } from "@/lib/mercadeo/performance-ads-data";

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

function compactCount(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return count(value);
}

function compactUsd(value: number): string {
  return `$${(Math.abs(value) / 1_000).toFixed(2)}K`;
}

function thousandUsd(value: number): string {
  return `$${Math.round(value / 1_000)}K`;
}

function tenthUsd(value: number): string {
  return `$${(value / 1_000).toFixed(1)}K`;
}

function tenthCount(value: number): string {
  return `${(value / 1_000).toFixed(1)}K`;
}

function percent(part: number, total: number): string {
  return `${((part / total) * 100).toFixed(2)}%`;
}

function shortCampaign(name: string): string {
  return name.replace(/^cons_guat__kpa_/, "").replace(/_(fb|ga|ig)_.*$/u, "");
}

function shortAccount(name: string): string {
  if (name === "Bosque Las Tapias") return "Bosque";
  if (name === "Puerta Abierta") return "P. Abierta";
  return name;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function withTrend(days: { date: string; cpl: number | null }[]): { date: string; cpl: number | null; trend: number }[] {
  const xs: number[] = [];
  const ys: number[] = [];
  days.forEach((day, index) => {
    if (day.cpl == null) return;
    xs.push(index);
    ys.push(day.cpl);
  });
  const n = xs.length;
  const sx = xs.reduce((sum, value) => sum + value, 0);
  const sy = ys.reduce((sum, value) => sum + value, 0);
  const sxx = xs.reduce((sum, value) => sum + value * value, 0);
  const sxy = xs.reduce((sum, value, index) => sum + value * (ys[index] ?? 0), 0);
  const denom = n * sxx - sx * sx;
  const slope = n < 2 || denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const intercept = n === 0 ? 0 : (sy - slope * sx) / n;
  return days.map((day, index) => ({
    ...day,
    trend: Math.round((intercept + slope * index) * 100) / 100,
  }));
}

const MONTH_TICK: Record<string, string> = {
  "01": "ene",
  "02": "feb",
  "03": "mar",
  "04": "abr",
  "05": "may",
  "06": "jun",
  "07": "jul",
};

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mk-panel">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function CampaignTile(props: TreemapNode): ReactElement {
  const { x, y, width, height, name, value } = props;
  const account = props.account;
  const fill = typeof account === "string" ? (ACCOUNT_COLOR[account] ?? "#94a3b8") : "#94a3b8";
  const showLabel = width > 72 && height > 36;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />
      {showLabel ? (
        <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={700}>
          <tspan x={x + 8} dy={0}>{name}</tspan>
          <tspan x={x + 8} dy={14}>{count(typeof value === "number" ? value : 0)}</tspan>
        </text>
      ) : null}
    </g>
  );
}

export default function PerformanceAdsView({ report }: { report: PerformanceAdsReport }) {
  const pie = useMemo(
    () => [...report.accounts].sort((a, b) => b.leads - a.leads),
    [report.accounts],
  );
  const bySpend = useMemo(
    () => [...report.accounts].sort((a, b) => b.spendUsd - a.spendUsd),
    [report.accounts],
  );
  const byCpl = useMemo(
    () => [...report.accounts]
      .filter((row) => row.cpl != null)
      .sort((a, b) => (b.cpl ?? 0) - (a.cpl ?? 0))
      .map((row) => ({ ...row, short: shortAccount(row.name) })),
    [report.accounts],
  );
  const trend = useMemo(() => withTrend(report.days), [report.days]);
  const campaigns = useMemo(
    () => report.campaigns.map((row) => ({
      name: shortCampaign(row.name),
      account: row.account,
      leads: row.leads,
    })),
    [report.campaigns],
  );
  const monthTicks = report.days.filter((day) => day.date.endsWith("-01")).map((day) => day.date);

  return (
    <div className="mk-ads">
      <div className="mk-hero">
        <div className="mk-kpis">
          <p aria-label={`Alcance ${count(report.alcance)}`}>
            <strong>{compactCount(report.alcance)}</strong>
            <span>Alcance</span>
            <small>{count(report.alcance)}</small>
          </p>
          <p aria-label={`Importe gastado ${usdFormat.format(report.spendUsd)}`}>
            <strong>{compactUsd(report.spendUsd)}</strong>
            <span>Importe gastado</span>
            <small>{usdFormat.format(report.spendUsd)}</small>
          </p>
          <p aria-label={`Clientes potenciales ${count(report.leads)}`}>
            <strong>{compactCount(report.leads)}</strong>
            <span>Clientes potenciales</span>
            <small>{count(report.leads)}</small>
          </p>
        </div>
        <Panel title="Detalle de Pauta">
          <table className="mk-table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Alcance</th>
                <th>Impresiones</th>
                <th>Clientes potenciales</th>
                <th>Frecuencia</th>
              </tr>
            </thead>
            <tbody>
              {report.accounts.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{count(row.alcance)}</td>
                  <td>{count(row.impresiones)}</td>
                  <td>{count(row.leads)}</td>
                  <td>{row.frecuencia == null ? "—" : row.frecuencia.toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                <td>Total</td>
                <td>{count(report.alcance)}</td>
                <td>{count(report.impresiones)}</td>
                <td>{count(report.leads)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Tendencia del costo por cliente potencial">
          <div className="mk-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="date"
                  ticks={monthTicks}
                  tickFormatter={(value: string) => MONTH_TICK[value.slice(5, 7)] ?? value}
                  tick={{ fill: MUTED, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  formatter={(value, name) => {
                    const amount = asNumber(value);
                    const label = name === "trend" ? "Tendencia" : "Costo por lead";
                    return [amount == null ? "—" : `$${amount.toFixed(2)}`, label];
                  }}
                  labelFormatter={(label) => String(label)}
                />
                <Line type="monotone" dataKey="cpl" name="cpl" stroke={BLUE} dot={false} strokeWidth={1.5} />
                <Line type="linear" dataKey="trend" name="trend" stroke={NAVY} dot={false} strokeWidth={1.25} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
      </Panel>

      <div className="mk-row-3">
        <Panel title="Clientes potenciales por proyecto">
          <div className="mk-pie">
            <div className="mk-chart mk-chart-sm">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="leads" nameKey="name" outerRadius={72} stroke="#fff">
                    {pie.map((row) => (
                      <Cell key={row.name} fill={ACCOUNT_COLOR[row.name] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => {
                    const amount = asNumber(value);
                    return [amount == null ? "—" : `${count(amount)} (${percent(amount, report.leads)})`, String(name)];
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mk-legend">
              {pie.map((row) => (
                <li key={row.name}>
                  <i style={{ background: ACCOUNT_COLOR[row.name] ?? "#94a3b8" }} />
                  <span>{row.name}</span>
                  <b>{count(row.leads)} · {percent(row.leads, report.leads)}</b>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Clientes potenciales por día">
          <div className="mk-chart mk-chart-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.weekdays} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 10 }} interval={0} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value) => {
                  const amount = asNumber(value);
                  return [amount == null ? "—" : count(amount), "Clientes potenciales"];
                }} />
                <Bar dataKey="leads" fill={NAVY} radius={[3, 3, 0, 0]} barSize={18}>
                  <LabelList dataKey="leads" position="top" formatter={(value) => {
                    const amount = asNumber(value);
                    return amount == null ? "" : tenthCount(amount);
                  }} fill={NAVY} fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Costo por lead">
          <div className="mk-chart mk-chart-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCpl} margin={{ top: 18, right: 4, left: 0, bottom: 24 }}>
                <XAxis dataKey="short" tick={{ fill: MUTED, fontSize: 10 }} interval={0} angle={-35} textAnchor="end" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value) => {
                  const amount = asNumber(value);
                  return [amount == null ? "—" : `$${amount.toFixed(2)}`, "Promedio"];
                }} />
                <Bar dataKey="cpl" fill={NAVY} radius={[3, 3, 0, 0]} barSize={22}>
                  <LabelList dataKey="cpl" position="top" formatter={(value) => {
                    const amount = asNumber(value);
                    return amount == null ? "" : `$${amount.toFixed(2)}`;
                  }} fill={NAVY} fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mk-board">
        <Panel title="Inversión en pauta">
          <div className="mk-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySpend} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={118} tick={{ fill: NAVY, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => {
                  const amount = asNumber(value);
                  return [amount == null ? "—" : usdFormat.format(amount), "Importe gastado"];
                }} />
                <Bar dataKey="spendUsd" fill={NAVY} radius={[0, 3, 3, 0]} barSize={16}>
                  <LabelList dataKey="spendUsd" position="right" formatter={(value) => {
                    const amount = asNumber(value);
                    return amount == null ? "" : thousandUsd(amount);
                  }} fill={NAVY} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Campañas">
          <div className="mk-chart mk-chart-lg">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={campaigns}
                dataKey="leads"
                nameKey="name"
                stroke="#fff"
                fill={NAVY}
                content={CampaignTile}
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
        <Panel title="Gestión de presupuesto">
          <div className="mk-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.months} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value) => {
                  const amount = asNumber(value);
                  return [amount == null ? "—" : usdFormat.format(amount), "Importe gastado"];
                }} />
                <Line type="monotone" dataKey="spendUsd" stroke={NAVY} strokeWidth={2} dot={{ r: 3, fill: NAVY }}>
                  <LabelList dataKey="spendUsd" position="top" formatter={(value) => {
                    const amount = asNumber(value);
                    return amount == null ? "" : tenthUsd(amount);
                  }} fill={BLUE} fontSize={11} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
