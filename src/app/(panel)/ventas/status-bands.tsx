"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { StatusBand, StatusPoint, StatusVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import styles from "./status-bands.module.css";

const RESERVAS = "#0d2041";
const PCV = "#0573b0";
const ESPERADO = "#94a3b8";
const GRID = "#e2e8f0";

type Tip = { key: string; title: string; body: string };

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
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

function gapClass(value: number): string {
  if (value > 0.05) return styles.up;
  if (value < -0.05) return styles.down;
  return styles.flat;
}

const COLUMN_HEADROOM = 1.14;

function hueKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sumGap(columns: readonly StatusBand[]): number {
  const total = columns.reduce((sum, column) => sum + column.gap, 0);
  return Math.round(total * 10) / 10;
}

function columnScale(columns: readonly StatusBand[]): number {
  const peak = columns.reduce((max, column) => Math.max(max, Math.abs(column.gap)), 0);
  return peak > 0 ? peak * COLUMN_HEADROOM : 1;
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

function towersOf(projectId: string, towers: readonly StatusBand[]): StatusBand[] {
  const rows = towers.filter((column) => column.kind === "torre" && projectIdOfTower(column) === projectId);
  if (rows.length < 2) return [];
  return [...rows].sort((a, b) => memberName(a).localeCompare(memberName(b), "es") || a.id.localeCompare(b.id));
}

function activateColumn(event: ReactKeyboardEvent<HTMLDivElement>, action: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

function dayNumber(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function yTicks(scale: number): number[] {
  if (!(scale > 0)) return [0];
  if (scale <= 10) return [0, Math.ceil(scale)];
  const step = scale <= 40 ? 10 : scale <= 100 ? 20 : scale <= 200 ? 50 : 100;
  const marks = [0];
  for (let value = step; value < scale - step * 0.25; value += step) marks.push(value);
  return marks;
}

function linePath(
  points: readonly StatusPoint[],
  key: "reservas" | "pcv" | "esperado",
  xOf: (day: string) => number,
  yOf: (value: number) => number,
): string {
  let path = "";
  let open = false;
  for (const point of points) {
    const value = point[key];
    if (value == null || !Number.isFinite(value)) {
      open = false;
      continue;
    }
    const command = open ? "L" : "M";
    path += `${command}${xOf(point.day).toFixed(1)} ${yOf(value).toFixed(1)}`;
    open = true;
  }
  return path;
}

function reservaBody(day: string, value: number): string {
  return `Acumulado de reservas al ${dotted(day)}: ${formatUnits(value)}. Cada actividad Reserva hecha en Pipedrive. La fecha es la del comprobante. Fuente: ventas.fact_comprobante. Si el trato no tiene torre, la reserva queda en el proyecto.`;
}

function pcvBody(day: string, value: number): string {
  return `Acumulado de PCV al ${dotted(day)}: ${formatUnits(value)}. Un trato con la promesa emitida. La fecha es la de emisión. Fuente: ventas.fact_pcv_issuance.`;
}

function esperadoBody(band: StatusBand, day: string, value: number): string {
  return `Lo esperado al ${dotted(day)}: ${formatUnits(value)}. La línea gris sale de cero el ${dotted(band.startOn)}, el primer mes con una reserva o un PCV en la base, y llega a ${formatUnits(band.units)} unidades 24 meses después.`;
}

function StatusChart({
  band,
  onTip,
}: {
  band: StatusBand;
  onTip: (tip: Tip) => void;
}) {
  const labelId = useId();
  const width = 720;
  const height = band.kind === "proyecto" ? 176 : 124;
  const pad = { l: 36, r: 28, t: 16, b: 22 };
  const points = band.points;
  const first = points[0]?.day ?? band.startOn;
  const last = points[points.length - 1]?.day ?? band.closeOn;
  const span = Math.max(1, dayNumber(last) - dayNumber(first));
  const peak = points.reduce((max, point) => {
    return Math.max(max, point.reservas ?? 0, point.pcv ?? 0, point.esperado, band.units);
  }, 0);
  const scale = peak <= 0 ? 1 : peak * 1.12;
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const xOf = (day: string) => pad.l + ((dayNumber(day) - dayNumber(first)) / span) * innerW;
  const yOf = (value: number) => pad.t + innerH - (value / scale) * innerH;
  const stroke = band.kind === "proyecto" ? { reservas: 2.75, pcv: 2.25, esperado: 1.25 } : { reservas: 1.75, pcv: 1.5, esperado: 1 };
  const reservasPath = linePath(points, "reservas", xOf, yOf);
  const pcvPath = linePath(points, "pcv", xOf, yOf);
  const hasClose = band.closeOn !== "";
  const esperadoPath = hasClose ? linePath(points, "esperado", xOf, yOf) : "";
  const closeX = hasClose && points.some((point) => point.day === band.closeOn) ? xOf(band.closeOn) : null;

  const rawLabels: { key: string; x: number; y: number; text: string; fill: string; tip: Tip }[] = [];
  for (const point of points) {
    if (point.labelReservas && point.reservas != null) {
      rawLabels.push({
        key: `reservas-${point.day}`,
        x: xOf(point.day),
        y: yOf(point.reservas) - 9,
        text: formatUnits(point.reservas),
        fill: RESERVAS,
        tip: { key: `reservas-${point.day}`, title: "Reservas", body: reservaBody(point.day, point.reservas) },
      });
    }
    if (point.labelPcv && point.pcv != null) {
      rawLabels.push({
        key: `pcv-${point.day}`,
        x: xOf(point.day),
        y: yOf(point.pcv) + 12,
        text: formatUnits(point.pcv),
        fill: PCV,
        tip: { key: `pcv-${point.day}`, title: "PCV", body: pcvBody(point.day, point.pcv) },
      });
    }
    if (point.labelEsperado) {
      rawLabels.push({
        key: `esperado-${point.day}`,
        x: xOf(point.day),
        y: yOf(point.esperado) - 9,
        text: formatUnits(point.esperado),
        fill: "#64748b",
        tip: { key: `esperado-${point.day}`, title: "Esperado", body: esperadoBody(band, point.day, point.esperado) },
      });
    }
  }
  const occupied: { x: number; y: number }[] = [];
  const labels = rawLabels.map((label) => {
    let y = label.y;
    let guard = 0;
    const crowded = (candidate: number) => occupied.some((item) => Math.abs(item.x - label.x) < 34 && Math.abs(item.y - candidate) < 12);
    while (crowded(y) && guard < 5) {
      y -= 11;
      guard += 1;
    }
    if (y < 10) y = Math.min(height - pad.b - 2, label.y + 14);
    occupied.push({ x: label.x, y });
    return { ...label, y };
  });

  const axisPriority = (label: string) => (label === "cierre" ? 0 : label === "hoy" ? 1 : 2);
  const axis = [...points]
    .filter((point) => point.axisLabel)
    .sort((a, b) => axisPriority(a.axisLabel) - axisPriority(b.axisLabel) || a.day.localeCompare(b.day));
  const keptAxis: StatusPoint[] = [];
  for (const point of axis) {
    const x = xOf(point.day);
    if (keptAxis.some((item) => Math.abs(xOf(item.day) - x) < 46)) continue;
    keptAxis.push(point);
  }

  return (
    <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={labelId}>
      <title id={labelId}>{`${band.label}. Reservas ${formatUnits(band.reservas)}. PCV ${formatUnits(band.pcv)}. Variación ${formatGap(band.gap)}.`}</title>
      {yTicks(scale).map((tick) => {
        const y = yOf(tick);
        return (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke={GRID} />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10">{formatUnits(tick)}</text>
          </g>
        );
      })}
      {closeX != null ? <line x1={closeX} x2={closeX} y1={pad.t} y2={height - pad.b} stroke="#cbd5e1" strokeDasharray="2 3" /> : null}
      {hasClose ? <path d={esperadoPath} fill="none" stroke={ESPERADO} strokeWidth={stroke.esperado} /> : null}
      {hasClose ? (
        <path
          d={esperadoPath}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          style={{ cursor: "pointer" }}
          onClick={() => onTip({ key: "esperado", title: "Esperado", body: esperadoBody(band, lastActual(band, "reservas"), band.esperado) })}
        />
      ) : null}
      <path d={pcvPath} fill="none" stroke={PCV} strokeWidth={stroke.pcv} strokeDasharray="6 4" />
      <path
        d={pcvPath}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        style={{ cursor: "pointer" }}
        onClick={() => onTip({ key: "pcv", title: "PCV", body: pcvBody(lastActual(band, "pcv"), band.pcv) })}
      />
      <path d={reservasPath} fill="none" stroke={RESERVAS} strokeWidth={stroke.reservas} />
      <path
        d={reservasPath}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        style={{ cursor: "pointer" }}
        onClick={() => onTip({ key: "reservas", title: "Reservas", body: reservaBody(lastActual(band, "reservas"), band.reservas) })}
      />
      {labels.map((label) => (
        <text
          key={label.key}
          x={label.x}
          y={label.y}
          textAnchor={label.x < 56 ? "start" : label.x > width - 56 ? "end" : "middle"}
          fill={label.fill}
          fontSize={band.kind === "proyecto" ? 11 : 10}
          fontWeight={700}
          stroke="#fff"
          strokeWidth="3"
          paintOrder="stroke"
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          onClick={() => onTip(label.tip)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onTip(label.tip);
            }
          }}
        >
          {label.text}
        </text>
      ))}
      {keptAxis.map((point) => (
        <text key={point.day} x={xOf(point.day)} y={height - 6} textAnchor="middle" fill="#64748b" fontSize="10">
          {point.axisLabel}
        </text>
      ))}
    </svg>
  );
}

function lastActual(band: StatusBand, key: "reservas" | "pcv"): string {
  for (let index = band.points.length - 1; index >= 0; index -= 1) {
    const point = band.points[index];
    if (point && point[key] != null) return point.day;
  }
  return band.startOn;
}

function StatusRow({ band }: { band: StatusBand }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (!tip) return;
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setTip(null);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [tip]);

  function toggle(next: Tip) {
    setTip((current) => (current?.key === next.key ? null : next));
  }

  const asOf = lastActual(band, "reservas");

  return (
    <div ref={ref} className={styles.row} data-kind={band.kind}>
      <div className={styles.side}>
        <div className={styles.name}>
          {band.label}
          {band.congelado ? (
            <button
              type="button"
              className={styles.frozen}
              onClick={() => toggle({
                key: "congelado",
                title: "Congelado",
                body: band.frozenDetail ?? "Esta torre está congelada.",
              })}
            >
              Congelado
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.metric}
          onClick={() => toggle({ key: "reservas", title: "Reservas", body: reservaBody(asOf, band.reservas) })}
        >
          <span>Reservas</span>
          <strong>{formatUnits(band.reservas)}</strong>
        </button>
        <button
          type="button"
          className={styles.metric}
          onClick={() => toggle({ key: "pcv", title: "PCV", body: pcvBody(lastActual(band, "pcv"), band.pcv) })}
        >
          <span data-series="pcv">PCV</span>
          <strong>{formatUnits(band.pcv)}</strong>
        </button>
        <button
          type="button"
          className={`${styles.gap} ${gapClass(band.gap)}`}
          aria-label={`Variación ${formatGap(band.gap)} contra lo esperado al ${dotted(asOf)}`}
          onClick={() => toggle({
            key: "gap",
            title: "Variación",
            body: `Reservas menos lo esperado al ${dotted(asOf)}: ${formatGap(band.gap)}. Lo esperado sigue una línea recta temporal hasta el cierre.`,
          })}
        >
          {formatGap(band.gap)}
        </button>
      </div>
      <div className={styles.plot}>
        <StatusChart band={band} onTip={toggle} />
      </div>
      {tip ? (
        <div className={styles.tip} role="dialog">
          <strong>{tip.title}</strong>
          {tip.body}
        </div>
      ) : null}
    </div>
  );
}

function PaceColumns({
  columns,
  level,
  label,
  hueFor,
  openId,
  onOpen,
  onFrozen,
}: {
  columns: readonly StatusBand[];
  level: "project" | "asesor";
  label: string;
  hueFor: (column: StatusBand) => string;
  openId: string | null;
  onOpen: (id: string) => void;
  onFrozen: (column: StatusBand) => void;
}) {
  const scale = columnScale(columns);
  const flagged = columns.some((column) => column.congelado);
  return (
    <div className={band.ogCols} data-level={level} role="group" aria-label={label}>
      {columns.map((column) => {
        const height = (Math.max(0, Math.abs(column.gap)) / scale) * 100;
        const name = level === "project" ? column.label : memberName(column);
        const hue = hueFor(column);
        return (
          <div
            key={column.id}
            className={band.ogCol}
            role="button"
            tabIndex={0}
            aria-pressed={openId === column.id}
            aria-label={`${name}: ${formatGap(column.gap)}`}
            style={{ cursor: "pointer" }}
            onClick={() => onOpen(column.id)}
            onKeyDown={(event) => activateColumn(event, () => onOpen(column.id))}
          >
            <div className={band.ogColBody}>
              <div className={band.ogPlotWrap}>
                <div className={band.ogPlot}>
                  <span className={band.ogNum} style={{ bottom: `calc(${height}% + 2px)` }}>
                    <span className={gapClass(column.gap)}>{formatGap(column.gap)}</span>
                  </span>
                  <span
                    className={band.ogBar}
                    data-project={hue || undefined}
                    style={{ height: `${height}%` }}
                  />
                </div>
              </div>
            </div>
            <span className={band.ogName} style={{ whiteSpace: "nowrap" }}>{name}</span>
            {flagged ? (
              <span className={band.ogDelta}>
                {column.congelado ? (
                  <button
                    type="button"
                    className={styles.frozen}
                    data-frozen=""
                    onClick={(event) => {
                      event.stopPropagation();
                      onFrozen(column);
                    }}
                  >
                    Congelado
                  </button>
                ) : "\u00a0"}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ChartDrawer({ band: scope, onClose }: { band: StatusBand; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, [scope.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="op-overlay">
      <button type="button" className="op-backdrop" aria-label="Cerrar" onClick={onClose} />
      <aside className="op-drawer" role="dialog" aria-label={scope.label}>
        <header>
          <h2>{scope.label}</h2>
          <button ref={closeRef} type="button" onClick={onClose}>Cerrar</button>
        </header>
        <StatusRow band={scope} />
      </aside>
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [frozen, setFrozen] = useState<Tip | null>(null);
  const frozenRef = useRef<HTMLDivElement>(null);
  const closeDrawer = useCallback(() => setOpenId(null), []);

  const openBand = !vista || openId == null
    ? null
    : vista.byProject.find((column) => column.id === openId)
      ?? vista.byTower.find((column) => column.id === openId)
      ?? null;

  useEffect(() => {
    if (!openId || !vista) return;
    const exists = vista.byProject.some((column) => column.id === openId)
      || vista.byTower.some((column) => column.id === openId);
    if (!exists) setOpenId(null);
  }, [openId, vista]);

  useEffect(() => {
    if (!frozen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setFrozen(null);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (frozenRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-frozen]")) return;
      setFrozen(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [frozen]);

  if (!vista) return <>{pending}</>;

  const projects = vista.byProject;
  const overall = sumGap(projects);

  function openScope(id: string) {
    setFrozen(null);
    setOpenId((current) => (current === id ? null : id));
  }

  function showFrozen(column: StatusBand) {
    setFrozen((current) => current?.key === column.id ? null : {
      key: column.id,
      title: "Congelado",
      body: column.frozenDetail ?? "Esta torre está congelada.",
    });
  }

  return (
    <div className={`${band.block} ${band.ogSection}`}>
      {vista.notice ? <p className={styles.warn}>{vista.notice}</p> : null}
      <div className={`${band.top} ${band.ogLead}`}>
        <div className={band.rail}>
          <div className={band.kpi}>
            <span className={band.kpiName}>Todos los Proyectos</span>
            <span className={`${band.kpiValue} ${gapClass(overall)}`}>{formatGap(overall)}</span>
          </div>
        </div>
        <div className={`${band.hero} ${band.ogCard}`}>
          {projects.length > 0 ? (
            <PaceColumns
              columns={projects}
              level="project"
              label="Proyectos"
              hueFor={(column) => hueKey(column.label)}
              openId={openId}
              onOpen={openScope}
              onFrozen={showFrozen}
            />
          ) : null}
        </div>
      </div>
      {projects.length > 0 ? (
        <div className={band.ogBands}>
          {projects.map((project) => {
            const towers = towersOf(project.id, vista.byTower);
            return (
              <div key={project.id} className={`${band.top} ${band.ogBand}`}>
                <div className={band.rail}>
                  <button
                    type="button"
                    className={band.kpi}
                    aria-pressed={openId === project.id}
                    aria-label={`${project.label}: ${formatGap(project.gap)}`}
                    onClick={() => openScope(project.id)}
                  >
                    <span className={band.kpiName}>{project.label}</span>
                    <span className={`${band.kpiValue} ${gapClass(project.gap)}`}>{formatGap(project.gap)}</span>
                  </button>
                </div>
                <div className={`${band.hero} ${band.ogCard}`}>
                  {towers.length > 0 ? (
                    <PaceColumns
                      columns={towers}
                      level="asesor"
                      label={`Torres de ${project.label}`}
                      hueFor={() => hueKey(project.label)}
                      openId={openId}
                      onOpen={openScope}
                      onFrozen={showFrozen}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {frozen ? (
        <div ref={frozenRef} className={styles.tip} role="dialog">
          <strong>{frozen.title}</strong>
          {frozen.body}
        </div>
      ) : null}
      {openBand ? <ChartDrawer key={openBand.id} band={openBand} onClose={closeDrawer} /> : null}
    </div>
  );
}
