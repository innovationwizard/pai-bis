"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { ValorPoint, ValorProject, ValorVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import { MasterTowerDatesButton } from "./master-tower-dates";
import local from "./valor-proyecto.module.css";

const PLOT_TOP = 16;
const AXIS_HEIGHT = 22;

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
  gtq: number;
};

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

function aggregatePoints(projects: readonly ValorProject[]): ChartPoint[] {
  const events: { date: string; label: string; slug: string; gtq: number; order: number }[] = [];
  projects.forEach((project, projectIndex) => {
    cumulativeHistory(project.history).forEach((point, index) => {
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
    return { key: `${event.date}:${index}`, label: event.label, gtq: sum };
  });
}

function recordLine(point: ValorPoint, project: string, currency: string): string {
  const appreciation = point.appreciation == null ? "sin dato" : exactAmount(point.appreciation, currency);
  const id = point.id ? ` · ${point.id}` : "";
  return `${point.label} · ${project} · ${point.field} ${exactAmount(point.gtq, currency)} · appreciation_total ${appreciation} · increment_amount ${exactAmount(point.increment, currency)}${id}`;
}

function projectTip(project: ValorProject, projects: readonly ValorProject[]): Tip {
  const series = chartPoints(project.history);
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

function chartPoints(history: readonly ValorPoint[]): ChartPoint[] {
  return cumulativeHistory(history).map((point, index) => ({
    key: point.id || `${point.date}:${index}`,
    label: point.label,
    gtq: point.gtq,
  }));
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
  const last = points.length > 0 ? points[points.length - 1] : null;
  const text = last ? formatAmount(last.gtq, currency) : "";
  const [low, high] = last ? domainOf(points.map((point) => point.gtq)) : [0, 1];
  const ratio = last ? (high - last.gtq) / (high - low || 1) : 0;
  const marginRight = text ? reserve(text) : 8;
  return (
    <div className={local.chart} role="group" aria-label={last ? `${caption}: ${text}` : caption}>
      {points.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[...points]} margin={{ top: PLOT_TOP, right: marginRight, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="label"
              height={AXIS_HEIGHT}
              interval={0}
              padding={{ left: 36, right: 8 }}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "rgba(13, 32, 65, 0.28)" }}
              tickLine={false}
            />
            <YAxis hide width={0} domain={[low, high]} />
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
      {last ? (
        <button
          type="button"
          className={local.endValue}
          style={{ top: `calc(${PLOT_TOP}px + (100% - ${PLOT_TOP + AXIS_HEIGHT}px) * ${ratio})` }}
          aria-label={`Valor actual ${text}`}
          onClick={onOpen}
        >
          {text}
        </button>
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
      label: `${project.label} · ${tower.label}`,
    })),
  );
  const selectedTower = towerChoices.some((choice) => choice.id === towerId) ? towerId : "";
  const closeRef = useRef<HTMLButtonElement>(null);
  const aggregate = aggregatePoints(projects);
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
              {projects.map((project) => (
                <section key={project.slug} className={`${local.card} ${local.projectCard}`} aria-label={project.label}>
                  <span className={band.kpiName}>{project.label}</span>
                  <ValueChart
                    points={chartPoints(project.history)}
                    currency={project.currency}
                    caption={project.label}
                    onOpen={() => toggle(projectTip(project, projects))}
                  />
                </section>
              ))}
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
