"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { guatemalaToday } from "@/lib/ventas/period";
import type { ValorPoint, ValorProject, ValorVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import { MasterTowerDatesButton } from "./master-tower-dates";
import local from "./valor-proyecto.module.css";

const PLOT_TOP = 16;
const AXIS_HEIGHT = 32;
const AXIS_MARGIN = 8;

const moneyFormat = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 0,
});
const dollarFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const plainFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
const exactGtq = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const exactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const VALUE_RULE =
  "Cada punto usa appreciation_total cuando el dato viene y es distinto de increment_amount; si no, usa increment_amount.";

type ChartPoint = {
  key: string;
  label: string;
  date: string;
  gtq: number;
};

type PlacedPoint = ChartPoint & { t: number };

type Tip = {
  key: string;
  title: string;
  body: string;
  lines: string[];
};

function formatAmount(value: number, currency: string): string {
  if (currency === "USD") return dollarFormat.format(value);
  if (currency === "MIXED") return plainFormat.format(value);
  return moneyFormat.format(value);
}

function exactAmount(value: number | null, currency: string): string {
  if (value == null) return "sin dato";
  if (currency === "USD") return exactUsd.format(value);
  if (currency === "MIXED") return plainFormat.format(value);
  return exactGtq.format(value);
}

function domainOf(values: readonly number[]): [number, number] {
  let low = values[0] ?? 0;
  let high = low;
  for (const value of values) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  if (low === high) {
    const pad = Math.abs(low) > 0 ? Math.abs(low) * 0.08 : 1;
    return [low - pad, high + pad];
  }
  const pad = (high - low) * 0.08;
  return [low - pad, high + pad];
}

function reserve(text: string): number {
  return Math.ceil(text.length * 8) + 10;
}

function scopeSentence(projects: readonly ValorProject[]): string {
  const names = projects.map((project) => project.label).join(", ");
  return `Proyectos: ${names || "ninguno"}. Periodo, asesor y modelo no entran en este número.`;
}

const SANTA_ELENA = "santa-elena";
const SANTA_ELENA_RATE = 7.8;

function currencyNote(projects: readonly ValorProject[]): string {
  const santa = projects.some((project) => project.slug === SANTA_ELENA && project.history.length > 0);
  if (!santa) return "";
  return " Santa Elena se multiplica por 7.8 antes de sumarse.";
}

function missingNote(projects: readonly ValorProject[]): string {
  const missing = projects.filter((project) => project.history.length === 0).map((project) => project.label);
  if (missing.length === 0) return "";
  return ` Sin registros: ${missing.join(", ")}.`;
}

function aggregateCurrency(projects: readonly ValorProject[]): string {
  const codes = new Set(
    projects
      .filter((project) => project.history.length > 0)
      .map((project) => (project.slug === SANTA_ELENA ? "GTQ" : project.currency)),
  );
  if (codes.size === 1) return [...codes][0] ?? "GTQ";
  if (codes.size === 0) return "GTQ";
  return "MIXED";
}

function orderedHistory(history: readonly ValorPoint[]): ValorPoint[] {
  return [...history].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function isOpeningBalance(point: ValorPoint, index: number): boolean {
  return index === 0 && (point.notes === "Valor inicial de proyecto" || point.increment === 0);
}

function cumulativeHistory(history: readonly ValorPoint[]): { id: string; date: string; label: string; gtq: number }[] {
  const ordered = orderedHistory(history);
  let total = 0;
  return ordered.map((point, index) => {
    const chosen = point.gtq;
    if (isOpeningBalance(point, index) || index === 0) {
      total = chosen;
    } else {
      total += chosen;
    }
    return { id: point.id, date: point.date, label: point.label, gtq: total };
  });
}

function dottedDay(iso: string): string {
  const day = iso.slice(0, 10);
  const [year, month, date] = day.split("-");
  if (!year || !month || !date) return day;
  return `${date}.${month}.${year}`;
}

function earliestIso(dates: readonly string[]): string {
  let best = "";
  for (const day of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (!best || day < best) best = day;
  }
  return best;
}

function currentTotal(project: ValorProject): number {
  if (project.history.length === 0) return 0;
  const series = cumulativeHistory(project.history);
  return series.length > 0 ? series[series.length - 1].gtq : 0;
}

type Plotted = { key: string; date: string; label: string; gtq: number };

function plotted(project: ValorProject, today: string): Plotted[] {
  if (project.history.length > 1) {
    return cumulativeHistory(project.history).map((point, index) => ({
      key: point.id || `${point.date}:${index}`,
      date: point.date,
      label: point.label,
      gtq: point.gtq,
    }));
  }
  const historyDate = project.history.length === 1 ? orderedHistory(project.history)[0]?.date ?? "" : "";
  const start = earliestIso([project.bornOn, historyDate]);
  if (!start) return [];
  const end = today >= start ? today : start;
  const total = currentTotal(project);
  return [
    { key: `${project.slug}:inicio`, date: start, label: dottedDay(start), gtq: total },
    { key: `${project.slug}:hoy`, date: end, label: dottedDay(end), gtq: total },
  ];
}

function aggregatePoints(projects: readonly ValorProject[], today: string): ChartPoint[] {
  const events: { date: string; label: string; slug: string; gtq: number; order: number }[] = [];
  projects.forEach((project, projectIndex) => {
    plotted(project, today).forEach((point, index) => {
      events.push({
        date: point.date,
        label: point.label,
        slug: project.slug,
        gtq: project.slug === SANTA_ELENA ? point.gtq * SANTA_ELENA_RATE : point.gtq,
        order: projectIndex * 10000 + index,
      });
    });
  });
  events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const latest = new Map<string, number>();
  return events.map((event, index) => {
    latest.set(event.slug, event.gtq);
    let sum = 0;
    for (const value of latest.values()) sum += value;
    return { key: `${event.date}:${index}`, label: event.label, date: event.date, gtq: sum };
  });
}

function recordLine(point: ValorPoint, project: string, currency: string): string {
  const appreciation = point.appreciation == null ? "sin dato" : exactAmount(point.appreciation, currency);
  const id = point.id ? ` · ${point.id}` : "";
  return `${point.label} · ${project} · ${point.field} ${exactAmount(point.gtq, currency)} · appreciation_total ${appreciation} · increment_amount ${exactAmount(point.increment, currency)}${id}`;
}

function projectTip(project: ValorProject, projects: readonly ValorProject[]): Tip {
  const series = chartPoints(project);
  const current = series.length > 0 ? series[series.length - 1] : null;
  const amount = current ? formatAmount(current.gtq, project.currency) : "sin registros";
  return {
    key: project.slug,
    title: project.label,
    body: `Valor actual: ${amount}. Fuente: public.rv_price_history. ${VALUE_RULE} El valor actual es la suma acumulada de esos puntos. Si el primero tiene incremento 0, o su nota es Valor inicial de proyecto, ese monto es el punto de partida y no se vuelve a sumar. ${scopeSentence(projects)}`,
    lines: project.history.map((point) => recordLine(point, project.label, project.currency)),
  };
}

function aggregateTip(projects: readonly ValorProject[], points: readonly ChartPoint[], currency: string): Tip {
  const current = points.length > 0 ? points[points.length - 1] : null;
  const amount = current ? formatAmount(current.gtq, currency) : "sin registros";
  return {
    key: "todos",
    title: "Todos los Proyectos",
    body: `Valor actual: ${amount}. Suma del último valor de cada proyecto. En cada fecha, la línea suma el último valor de cada proyecto hasta esa fecha. Un proyecto sin registros aporta 0.${missingNote(projects)} Fuente: public.rv_price_history. ${VALUE_RULE} ${scopeSentence(projects)}${currencyNote(projects)}`,
    lines: projects.flatMap((project) => project.history.map((point) => recordLine(point, project.label, project.currency))),
  };
}

function chartPoints(project: ValorProject, tower?: { history: ValorProject["history"]; bornOn: string } | null): ChartPoint[] {
  const source = tower
    ? { ...project, history: tower.history, bornOn: tower.bornOn || project.bornOn }
    : project;
  return plotted(source, guatemalaToday()).map((point) => ({
    key: point.key,
    label: point.label,
    date: point.date,
    gtq: point.gtq,
  }));
}

function utcDay(iso: string): number {
  const [year, month, date] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !date) return Number.NaN;
  return Date.UTC(year, month - 1, date);
}

function isoFromUtc(time: number): string {
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const QUARTER_LABELS = ["ene", "abr", "jul", "oct"] as const;

function quarterLabel(time: number): string {
  const date = new Date(time);
  const name = QUARTER_LABELS[Math.floor(date.getUTCMonth() / 3)];
  if (!name || date.getUTCDate() !== 1) return "";
  return `${name} ${String(date.getUTCFullYear()).slice(2)}`;
}

function quarterTicks(points: readonly PlacedPoint[]): number[] {
  let min = "";
  let max = "";
  for (const point of points) {
    const day = point.date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (!min || day < min) min = day;
    if (!max || day > max) max = day;
  }
  if (!min || !max) return [];
  const minMonth = Number(min.slice(5, 7));
  let year = Number(min.slice(0, 4));
  let month = Math.floor((minMonth - 1) / 3) * 3 + 1;
  const ticks: number[] = [];
  for (let guard = 0; guard < 80; guard += 1) {
    const iso = `${year}-${String(month).padStart(2, "0")}-01`;
    if (iso > max) break;
    if (iso >= min) ticks.push(utcDay(iso));
    month += 3;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return ticks;
}

function niceStep(span: number): number {
  if (!(span > 0)) return 1;
  const raw = span / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const error = raw / power;
  const factor = error >= 7.5 ? 10 : error >= 3.5 ? 5 : error >= 1.5 ? 2 : 1;
  return factor * power;
}

function scaleTicks(low: number, high: number): number[] {
  if (low === high) return [low];
  const step = niceStep(high - low);
  const ticks: number[] = [];
  const start = Math.ceil(low / step - 1e-9) * step;
  for (let value = start; value <= high + step * 1e-6; value += step) {
    const rounded = Math.round(value * 100) / 100;
    if (rounded < low - step * 1e-6 || rounded > high + step * 1e-6) continue;
    ticks.push(rounded);
    if (ticks.length > 8) break;
  }
  if (low <= 0 && high >= 0 && !ticks.includes(0)) ticks.push(0);
  ticks.sort((a, b) => a - b);
  return ticks.length > 0 ? ticks : [low, high];
}

function axisAmount(value: number, currency: string): string {
  if (value === 0) return currency === "USD" ? "$0" : "Q0";
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const prefix = currency === "USD" ? "$" : currency === "MIXED" ? "" : "Q";
  if (abs >= 1_000_000) {
    const body = (abs / 1_000_000).toLocaleString("es-GT", { maximumFractionDigits: 1 });
    return `${sign}${prefix}${body} M`;
  }
  if (abs >= 10_000) {
    const body = (abs / 1_000).toLocaleString("es-GT", { maximumFractionDigits: 0 });
    return `${sign}${prefix}${body} mil`;
  }
  return formatAmount(value, currency);
}

function appreciationLabel(start: number, current: number): string {
  if (start === 0) return current === 0 ? "0%" : "";
  const pct = ((current - start) / Math.abs(start)) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return rounded > 0 ? `+${body}%` : `${body}%`;
}

function valueAt(points: readonly PlacedPoint[], time: number): number {
  if (points.length === 0) return 0;
  if (time <= points[0].t) return points[0].gtq;
  const last = points[points.length - 1];
  if (time >= last.t) return last.gtq;
  for (let index = 1; index < points.length; index += 1) {
    const next = points[index];
    if (time > next.t) continue;
    const previous = points[index - 1];
    const span = next.t - previous.t;
    if (span === 0) return next.gtq;
    const ratio = (time - previous.t) / span;
    return previous.gtq + (next.gtq - previous.gtq) * ratio;
  }
  return last.gtq;
}

function ValueChart({
  points,
  currency,
  caption,
  onOpen,
}: {
  points: readonly ChartPoint[];
  currency: string;
  caption: string;
  onOpen: () => void;
}) {
  const series = points
    .map((point) => ({ ...point, t: utcDay(point.date) }))
    .filter((point) => Number.isFinite(point.t))
    .sort((a, b) => a.t - b.t || a.key.localeCompare(b.key));
  const first = series[0] ?? null;
  const last = series.length > 0 ? series[series.length - 1] : null;
  const startText = first ? formatAmount(first.gtq, currency) : "";
  const text = last ? formatAmount(last.gtq, currency) : "";
  const pct = first && last ? appreciationLabel(first.gtq, last.gtq) : "";
  const endText = pct ? `${text} ${pct}` : text;
  const [low, high] = last ? domainOf(series.map((point) => point.gtq)) : [0, 1];
  const ticks = scaleTicks(low, high);
  const yWidth = Math.max(36, ...ticks.map((tick) => reserve(axisAmount(tick, currency))));
  const span = high - low || 1;
  const yOf = (value: number) => (high - value) / span;
  const marginRight = Math.max(reserve(text), pct ? reserve(pct) : 0, 8);
  const quarters = quarterTicks(series);
  const chartRef = useRef<HTMLDivElement>(null);
  const [liftStart, setLiftStart] = useState(false);
  const [hover, setHover] = useState<{ left: number; top: number; text: string } | null>(null);
  const plotBottomInset = AXIS_HEIGHT + AXIS_MARGIN;

  useEffect(() => {
    const node = chartRef.current;
    if (!node || !first || !last) {
      setLiftStart(false);
      return;
    }
    const plotWidth = node.clientWidth - yWidth - marginRight;
    const crowded = reserve(startText) + marginRight + 12 > plotWidth;
    const sameBand = Math.abs(yOf(first.gtq) - yOf(last.gtq)) < 0.28;
    setLiftStart(crowded && sameBand);
  }, [startText, marginRight, yWidth, first, last, low, high]);

  function onMove(event: MouseEvent<HTMLDivElement>) {
    if (!first || !last) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const plotLeft = yWidth;
    const plotRight = rect.width - marginRight;
    const plotTop = PLOT_TOP;
    const plotBottom = rect.height - plotBottomInset;
    if (plotRight <= plotLeft || x < plotLeft || x > plotRight || y < plotTop || y > plotBottom) {
      setHover(null);
      return;
    }
    const time = first.t + ((x - plotLeft) / (plotRight - plotLeft)) * (last.t - first.t);
    const value = valueAt(series, time);
    const lineY = plotTop + yOf(value) * (plotBottom - plotTop);
    if (Math.abs(y - lineY) > 14) {
      setHover(null);
      return;
    }
    setHover({
      left: x,
      top: y,
      text: `${dottedDay(isoFromUtc(time))} · ${formatAmount(value, currency)}`,
    });
  }

  return (
    <div
      ref={chartRef}
      className={local.chart}
      role="group"
      aria-label={last ? `${caption}: inicio ${startText}, actual ${endText}` : caption}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      {series.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: PLOT_TOP, right: marginRight, bottom: AXIS_MARGIN, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(13, 32, 65, 0.16)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={quarters}
              height={AXIS_HEIGHT}
              interval="preserveStartEnd"
              minTickGap={48}
              tickMargin={8}
              tickFormatter={(value: number) => quarterLabel(value)}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "rgba(13, 32, 65, 0.28)" }}
              tickLine={false}
            />
            <YAxis
              width={yWidth}
              domain={[low, high]}
              ticks={ticks}
              tickFormatter={(value: number) => axisAmount(value, currency)}
              tick={{ fontSize: 11, fill: "rgba(13, 32, 65, 0.45)" }}
              axisLine={false}
              tickLine={false}
            />
            <Line
              type="linear"
              dataKey="gtq"
              stroke="#0d2041"
              strokeWidth={2}
              dot={{ r: 3, fill: "#0d2041", strokeWidth: 0 }}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : null}
      {first ? (
        <span
          className={liftStart ? `${local.startValue} ${local.startLifted}` : local.startValue}
          style={{ left: yWidth, top: `calc(${PLOT_TOP}px + (100% - ${PLOT_TOP + plotBottomInset}px) * ${yOf(first.gtq)})` }}
        >
          {startText}
        </span>
      ) : null}
      {last ? (
        <button
          type="button"
          className={local.endValue}
          style={{ top: `calc(${PLOT_TOP}px + (100% - ${PLOT_TOP + plotBottomInset}px) * ${yOf(last.gtq)})` }}
          aria-label={`Valor actual ${endText}`}
          onClick={onOpen}
        >
          <span className={local.amount}>{text}</span>
          {pct ? <span className={local.appreciation}>{pct}</span> : null}
        </button>
      ) : null}
      {hover ? (
        <p className={local.hoverValue} style={{ left: hover.left, top: hover.top }}>{hover.text}</p>
      ) : null}
    </div>
  );
}

export function ValorProyecto({
  vista,
  pending,
}: {
  vista: ValorVista | null;
  pending: ReactNode;
}) {
  const board = vista?.board ?? null;
  const projects = board?.projects ?? [];
  const [proof, setProof] = useState<Tip | null>(null);
  const [towerId, setTowerId] = useState("");
  const towerChoices = projects.flatMap((project) =>
    project.towers.map((tower, index) => ({
      id: `${project.slug}:${index}:${tower.label}`,
      slug: project.slug,
      towerLabel: tower.label,
      label: `${project.label} · ${tower.label}`,
    })),
  );
  const selectedTower = towerChoices.some((choice) => choice.id === towerId) ? towerId : "";
  const activeTower = towerChoices.find((choice) => choice.id === selectedTower) ?? null;
  const closeRef = useRef<HTMLButtonElement>(null);
  const aggregate = aggregatePoints(projects, guatemalaToday());
  const currency = aggregateCurrency(projects);

  useEffect(() => {
    if (!proof) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setProof(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [proof]);

  function toggle(next: Tip) {
    setProof((current) => (current?.key === next.key ? null : next));
  }

  return (
    <section id="valor-del-proyecto" className={band.block} aria-labelledby="vt-valor-title">
      <div className={local.titleRow}>
        <h2 id="vt-valor-title" className={local.title}>Valorización del proyecto</h2>
        <div className={local.titleTools}>
          <label className={local.filter}>
            <select value={selectedTower} onChange={(event) => setTowerId(event.target.value)}>
              <option value="">Torres</option>
              {towerChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>{choice.label}</option>
              ))}
            </select>
          </label>
          <MasterTowerDatesButton />
        </div>
      </div>
      {vista?.notice ? <p className={local.notice}>{vista.notice}</p> : null}
      {!board ? pending : (
        <div className={local.stack}>
          <div className={`${local.card} ${local.heroCard}`}>
            <span className={band.kpiName}>Todos los Proyectos</span>
            <ValueChart
              points={aggregate}
              currency={currency}
              caption="Todos los Proyectos"
              onOpen={() => toggle(aggregateTip(projects, aggregate, currency))}
            />
          </div>
          {projects.length > 0 ? (
            <div className={local.bands}>
              {projects.map((project) => {
                const tower = activeTower?.slug === project.slug
                  ? project.towers.find((item) => item.label === activeTower.towerLabel) ?? null
                  : null;
                return (
                  <section key={project.slug} className={`${local.card} ${local.projectCard}`} aria-label={project.label}>
                    <span className={band.kpiName}>{project.label}</span>
                    <ValueChart
                      points={chartPoints(project, tower)}
                      currency={project.currency}
                      caption={project.label}
                      onOpen={() => toggle(projectTip(project, projects))}
                    />
                  </section>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
      {proof ? (
        <div className={local.proof} role="dialog" aria-label={proof.title}>
          <button ref={closeRef} type="button" onClick={() => setProof(null)}>Cerrar</button>
          <p>{proof.body}</p>
          {proof.lines.length > 0 ? (
            <ul>
              {proof.lines.map((line, index) => <li key={`${index}:${line}`}>{line}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
