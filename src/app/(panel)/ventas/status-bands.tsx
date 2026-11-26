"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import {
  Area,
  Brush,
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { LabelProps } from "recharts";
import type { StatusBand, StatusPoint, StatusSourceRow, StatusVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import split from "./lower-bands.module.css";
import pace from "./status-bands.module.css";

const RESERVAS = "#0d2041";
const PCV = "#0573b0";
const ESPERADO = "#64748b";
const SURPLUS = "#16a34a";
const DEFICIT = "#ef4444";
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

type PaceScope = {
  id: string;
  name: string;
  reservas: number;
  pcv: number;
  esperado: number;
  gap: number;
  units: number;
  startOn: string;
  closeOn: string;
  reservaRows: readonly StatusSourceRow[];
  pcvRows: readonly StatusSourceRow[];
  frozenDetail: string | null;
  filter: string;
  summed: boolean;
};

type PaceRow = {
  day: string;
  reservas: number | null;
  pcv: number | null;
  esperado: number;
  floor: number | null;
  surplus: number | null;
  deficit: number | null;
};

type Tip = {
  key: string;
  title: string;
  body: string;
  rows: readonly StatusSourceRow[];
};

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function shortMonth(iso: string): string {
  const name = MONTHS[Number(iso.slice(5, 7)) - 1];
  if (!name) return iso;
  return `${name} ${iso.slice(2, 4)}`;
}

function isQuarterStart(iso: string): boolean {
  const month = iso.slice(5, 7);
  return iso.slice(8, 10) === "01" && (month === "01" || month === "04" || month === "07" || month === "10");
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatUnits(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0";
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function formatGap(value: number): string {
  if (value > 0.05) return `+${formatUnits(value)}`;
  if (value < -0.05) return formatUnits(value);
  return "0";
}

function toneOf(value: number): "up" | "down" | "flat" {
  if (value > 0.05) return "up";
  if (value < -0.05) return "down";
  return "flat";
}

function ordered(rows: readonly StatusSourceRow[]): StatusSourceRow[] {
  return [...rows].sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
}

function memberName(column: StatusBand): string {
  const mark = " · ";
  const index = column.label.lastIndexOf(mark);
  return index < 0 ? column.label : column.label.slice(index + mark.length);
}

function projectIdOfTower(column: StatusBand): string {
  const index = column.id.indexOf("|");
  return index < 0 ? "" : column.id.slice(0, index);
}

function tapiasTorreB(column: StatusBand): boolean {
  return column.frozenDetail?.includes("F&F") === true;
}

function scopeOf(column: StatusBand, name: string, filter: string): PaceScope {
  return {
    id: column.id,
    name,
    reservas: column.reservas,
    pcv: column.pcv,
    esperado: column.esperado,
    gap: column.gap,
    units: column.units,
    startOn: column.startOn,
    closeOn: column.closeOn,
    reservaRows: column.reservaRows ?? [],
    pcvRows: column.pcvRows ?? [],
    frozenDetail: column.frozenDetail,
    filter,
    summed: false,
  };
}

function overallScope(projects: readonly StatusBand[]): PaceScope {
  const reservas = projects.reduce((sum, column) => sum + column.reservas, 0);
  const pcv = projects.reduce((sum, column) => sum + column.pcv, 0);
  const esperado = round1(projects.reduce((sum, column) => sum + column.esperado, 0));
  return {
    id: "todos",
    name: "Todos los Proyectos",
    reservas,
    pcv,
    esperado,
    gap: round1(reservas - esperado),
    units: projects.reduce((sum, column) => sum + column.units, 0),
    startOn: "",
    closeOn: "",
    reservaRows: ordered(projects.flatMap((column) => column.reservaRows ?? [])),
    pcvRows: ordered(projects.flatMap((column) => column.pcvRows ?? [])),
    frozenDetail: null,
    filter: projects.map((column) => column.label).join(", ") || "ningún proyecto",
    summed: true,
  };
}

function paint(day: string, reservas: number | null, pcv: number | null, esperado: number): PaceRow {
  const expected = round1(esperado);
  if (reservas == null) {
    return { day, reservas: null, pcv, esperado: expected, floor: null, surplus: null, deficit: null };
  }
  const above = reservas - expected;
  return {
    day,
    reservas,
    pcv,
    esperado: expected,
    floor: Math.min(reservas, expected),
    surplus: above > 0 ? above : 0,
    deficit: above < 0 ? -above : 0,
  };
}

function sampleAt(project: StatusBand, day: string, asOf: string): { reservas: number | null; pcv: number | null; esperado: number } {
  if (!project.startOn || !project.closeOn) {
    if (day > asOf) return { reservas: null, pcv: null, esperado: 0 };
    if (day < asOf) return { reservas: 0, pcv: 0, esperado: 0 };
    return { reservas: project.reservas, pcv: project.pcv, esperado: project.esperado };
  }
  if (day < project.startOn) {
    return { reservas: day > asOf ? null : 0, pcv: day > asOf ? null : 0, esperado: 0 };
  }
  let chosen: StatusPoint | null = null;
  for (const point of project.points) {
    if (point.day <= day) chosen = point;
    else break;
  }
  if (!chosen) return { reservas: day > asOf ? null : 0, pcv: day > asOf ? null : 0, esperado: 0 };
  return { reservas: chosen.reservas, pcv: chosen.pcv, esperado: chosen.esperado };
}

function rowsOf(column: StatusBand, asOf: string): PaceRow[] {
  if (column.points.length === 0) return [paint(asOf, column.reservas, column.pcv, column.esperado)];
  return column.points.map((point) => paint(point.day, point.reservas, point.pcv, point.esperado));
}

function aggregateRows(projects: readonly StatusBand[], asOf: string): PaceRow[] {
  if (projects.length === 0) return [paint(asOf, 0, 0, 0)];
  const days = new Set<string>();
  for (const project of projects) {
    for (const point of project.points) days.add(point.day);
  }
  if (days.size === 0) days.add(asOf);
  return [...days].sort((a, b) => a.localeCompare(b)).map((day) => {
    let reservas: number | null = 0;
    let pcv: number | null = 0;
    let esperado = 0;
    for (const project of projects) {
      const sample = sampleAt(project, day, asOf);
      if (sample.reservas == null) reservas = null;
      else if (reservas != null) reservas += sample.reservas;
      if (sample.pcv == null) pcv = null;
      else if (pcv != null) pcv += sample.pcv;
      esperado += sample.esperado;
    }
    return paint(day, reservas, pcv, esperado);
  });
}

function tickDays(days: readonly string[]): string[] {
  const quarters = days.filter(isQuarterStart);
  if (quarters.length > 0) return quarters;
  return days.length > 0 ? [days[0]] : [];
}

function yMax(rows: readonly PaceRow[]): number {
  const peak = rows.reduce((max, row) => Math.max(max, row.reservas ?? 0, row.pcv ?? 0, row.esperado), 0);
  return peak > 0 ? peak * 1.12 : 1;
}

function lastActual(rows: readonly PaceRow[]): number {
  let index = -1;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].reservas != null) index = i;
  }
  return index;
}

function dayOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function axisTick(value: unknown): string {
  const day = dayOf(value);
  if (isQuarterStart(day)) return shortMonth(day);
  return day ? dotted(day) : "";
}

function brushTick(value: unknown): string {
  const day = dayOf(value);
  return isQuarterStart(day) ? shortMonth(day) : "";
}

function filterSentence(filter: string): string {
  return `Filtro activo: ${filter}. El periodo y el asesor no cambian este número.`;
}

function reservasTip(scope: PaceScope, asOf: string): Tip {
  return {
    key: `reservas:${scope.id}`,
    title: "Reservas",
    body: `Acumulado de reservas al ${dotted(asOf)}: ${formatUnits(scope.reservas)}. Cuenta cada actividad Reserva. La fecha es la del comprobante. Fuente: ventas.fact_comprobante. ${filterSentence(scope.filter)}`,
    rows: scope.reservaRows,
  };
}

function pcvTip(scope: PaceScope, asOf: string): Tip {
  return {
    key: `pcv:${scope.id}`,
    title: "PCV",
    body: `Acumulado de PCV al ${dotted(asOf)}: ${formatUnits(scope.pcv)}. Cuenta un trato con la promesa emitida. La fecha es la de emisión. Si la emisión es anterior a la reserva, cuenta la fecha de la reserva. Fuente: ventas.fact_pcv_issuance. ${filterSentence(scope.filter)}`,
    rows: scope.pcvRows,
  };
}

function esperadoTip(scope: PaceScope, asOf: string): Tip {
  const fecha = scope.summed
    ? `Suma de lo esperado de cada proyecto al ${dotted(asOf)}. Cada proyecto empieza en cero en su primer mes con una reserva o un PCV y llega a sus unidades 24 meses después.`
    : scope.startOn && scope.closeOn
      ? `Línea recta desde cero el ${dotted(scope.startOn)} hasta ${formatUnits(scope.units)} unidades el ${dotted(scope.closeOn)}.`
      : "No hay mes de inicio en la base, así que lo esperado queda en 0.";
  return {
    key: `esperado:${scope.id}`,
    title: "Esperado",
    body: `Lo esperado al ${dotted(asOf)}: ${formatUnits(scope.esperado)}. ${fecha} Fuente: v_rv_units_full. ${filterSentence(scope.filter)}`,
    rows: [],
  };
}

function gapTip(scope: PaceScope, asOf: string): Tip {
  return {
    key: `gap:${scope.id}`,
    title: "Variación",
    body: `Reservas menos lo esperado al ${dotted(asOf)}: ${formatGap(scope.gap)}. Reservas ${formatUnits(scope.reservas)}. Esperado ${formatUnits(scope.esperado)}. ${filterSentence(scope.filter)}`,
    rows: [],
  };
}

function seriesLabel(last: number, lastDay: string | null, color: string, dy: number, onOpen: () => void) {
  return function SeriesLabel(props: LabelProps): ReactElement {
    const x = typeof props.x === "number" ? props.x : null;
    const y = typeof props.y === "number" ? props.y : null;
    const payload = (props as { payload?: { day?: unknown } }).payload;
    const day = typeof payload?.day === "string" ? payload.day : null;
    const current = day != null ? day === lastDay : props.index === last;
    if (!current || x == null || y == null || typeof props.value !== "number") return <g />;
    return (
      <text
        x={x}
        y={y + dy}
        textAnchor="middle"
        fill={color}
        fontSize={11}
        fontWeight={700}
        fontFamily="inherit"
        style={{ cursor: "pointer" }}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        {formatUnits(props.value)}
      </text>
    );
  };
}

function PaceChart({
  scope,
  rows,
  asOf,
  onTip,
}: {
  scope: PaceScope;
  rows: readonly PaceRow[];
  asOf: string;
  onTip: (tip: Tip) => void;
}) {
  const last = lastActual(rows);
  const lastDay = last >= 0 ? rows[last].day : null;
  const ticks = tickDays(rows.map((row) => row.day));
  return (
    <div
      className={pace.chart}
      role="group"
      aria-label={`${scope.name}. Reservas ${formatUnits(scope.reservas)}. PCV ${formatUnits(scope.pcv)}. Variación ${formatGap(scope.gap)}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={[...rows]} margin={{ top: 20, right: 64, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="day"
            ticks={ticks}
            tickFormatter={axisTick}
            interval={0}
            tick={{ fontSize: 11, fontWeight: 700, fill: "#0d2041" }}
            axisLine={{ stroke: "rgba(13, 32, 65, 0.28)" }}
            tickLine={false}
          />
          <YAxis hide width={0} domain={[0, yMax(rows)]} />
          <Area
            dataKey="floor"
            stackId="variacion"
            type="linear"
            stroke="none"
            strokeWidth={0}
            fill="transparent"
            connectNulls={false}
            legendType="none"
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="surplus"
            stackId="variacion"
            type="linear"
            stroke="none"
            strokeWidth={0}
            fill={SURPLUS}
            fillOpacity={0.38}
            connectNulls={false}
            legendType="none"
            activeDot={false}
            isAnimationActive={false}
            style={{ cursor: "pointer" }}
            onClick={() => onTip(gapTip(scope, asOf))}
          />
          <Area
            dataKey="deficit"
            stackId="variacion"
            type="linear"
            stroke="none"
            strokeWidth={0}
            fill={DEFICIT}
            fillOpacity={0.38}
            connectNulls={false}
            legendType="none"
            activeDot={false}
            isAnimationActive={false}
            style={{ cursor: "pointer" }}
            onClick={() => onTip(gapTip(scope, asOf))}
          />
          <Line
            dataKey="reservas"
            type="linear"
            stroke={RESERVAS}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
            style={{ cursor: "pointer" }}
            label={{ content: seriesLabel(last, lastDay, RESERVAS, -8, () => onTip(reservasTip(scope, asOf))) }}
            onClick={() => onTip(reservasTip(scope, asOf))}
          />
          <Line
            dataKey="pcv"
            type="linear"
            stroke={PCV}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
            style={{ cursor: "pointer" }}
            label={{ content: seriesLabel(last, lastDay, PCV, 14, () => onTip(pcvTip(scope, asOf))) }}
            onClick={() => onTip(pcvTip(scope, asOf))}
          />
          <Line
            dataKey="esperado"
            type="linear"
            stroke={ESPERADO}
            strokeWidth={1}
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
            style={{ cursor: "pointer" }}
            onClick={() => onTip(esperadoTip(scope, asOf))}
          />
          <Brush
            dataKey="day"
            height={24}
            travellerWidth={8}
            stroke="#0d2041"
            fill="#f8fafc"
            tickFormatter={brushTick}
            ariaLabel="Meses"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <button
        type="button"
        className={pace.variance}
        data-tone={toneOf(scope.gap)}
        aria-label={`Variación ${formatGap(scope.gap)}`}
        onClick={() => onTip(gapTip(scope, asOf))}
      >
        {formatGap(scope.gap)}
      </button>
    </div>
  );
}

function TipView({ tip, onClose }: { tip: Tip; onClose: () => void }) {
  return (
    <div className={split.splitTip} role="dialog" aria-label={tip.title}>
      <div className={split.splitTipHead}>
        <strong>{tip.title}</strong>
        <button type="button" onClick={onClose}>Cerrar</button>
      </div>
      <p>{tip.body}</p>
      {tip.rows.length > 0 ? (
        <p>{tip.rows.map((row) => `${dotted(row.day)} · ${row.dealId}`).join("; ")}</p>
      ) : null}
    </div>
  );
}

export function StatusLifetime({
  vista,
  pending,
}: {
  vista: StatusVista | null;
  pending: ReactNode;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [towerId, setTowerId] = useState("");

  useEffect(() => {
    if (!tip) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setTip(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tip]);

  if (!vista) return <>{pending}</>;

  const projects = vista.byProject;
  const selected = vista.byTower.find((column) => column.id === towerId) ?? null;
  const overall = overallScope(projects);
  const asOf = vista.asOf;

  function showTip(next: Tip) {
    setTip((current) => (current?.key === next.key ? null : next));
  }

  return (
    <div className={`${band.block} ${split.splitPage}`}>
      {vista.notice ? <p className={band.warn}>{vista.notice}</p> : null}
      <div className={pace.titleRow}>
        <h2 className={band.title}>Status de ventas</h2>
        <label className={pace.filter}>
          Torres
          <select
            value={selected?.id ?? ""}
            onChange={(event) => {
              setTowerId(event.target.value);
              setTip(null);
            }}
          >
            <option value="">Todas</option>
            {vista.byTower.map((column) => (
              <option key={column.id} value={column.id}>{column.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className={pace.stack}>
        <div className={`${split.splitHero} ${pace.heroBand}`}>
          <span className={split.splitHeroTitle}>Todos los Proyectos</span>
          <PaceChart scope={overall} rows={aggregateRows(projects, asOf)} asOf={asOf} onTip={showTip} />
        </div>
        {projects.length > 0 ? (
          <div className={split.splitBands}>
            {projects.map((project) => {
              const tower = selected && projectIdOfTower(selected) === project.id ? selected : null;
              const column = tower ?? project;
              const scope = scopeOf(column, tower ? memberName(tower) : project.label, column.label);
              const title = tower ? tower.label : project.label;
              const flag = tower && tapiasTorreB(tower) ? "Congelado" : null;
              return (
                <section key={project.id} className={`${split.splitHero} ${pace.projectBand}`} aria-label={title}>
                  <span className={split.splitHeroTitle}>{title}</span>
                  {flag ? (
                    <button
                      type="button"
                      className={pace.frozen}
                      onClick={() => showTip({
                        key: `frozen:${column.id}`,
                        title: flag,
                        body: column.frozenDetail ?? flag,
                        rows: [],
                      })}
                    >
                      {flag}
                    </button>
                  ) : null}
                  <PaceChart scope={scope} rows={rowsOf(column, asOf)} asOf={asOf} onTip={showTip} />
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
      {tip ? <TipView tip={tip} onClose={() => setTip(null)} /> : null}
    </div>
  );
}
