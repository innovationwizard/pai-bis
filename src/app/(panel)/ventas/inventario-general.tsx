"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { BarShapeProps, XAxisTickContentProps } from "recharts";
import { UNIT_STATUS_COLORS, UNIT_STATUS_LABELS } from "@/lib/reservas/constants";
import type { RvUnitStatus } from "@/lib/reservas/types";
import type {
  InventarioVista,
  InventoryBoard,
  InventoryCounts,
  InventoryProject,
  InventoryStatusKey,
  InventoryTower,
} from "@/lib/ventas/vista-types";
import styles from "./inventario-general.module.css";

const NAVY = "#0d2041";
const TITLE = "Inventario general";

const STATUSES: { key: InventoryStatusKey; status: RvUnitStatus }[] = [
  { key: "disponible", status: "AVAILABLE" },
  { key: "revision", status: "SOFT_HOLD" },
  { key: "reservado", status: "RESERVED" },
  { key: "congelado", status: "FROZEN" },
  { key: "vendido", status: "SOLD" },
];

const WATERFALL: InventoryStatusKey[] = ["congelado", "disponible", "revision", "reservado", "vendido"];

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

type Tip = {
  key: string;
  title: string;
  formula: string;
  scope: string;
  rows: string[];
};

function count(value: number): string {
  return countFormat.format(value);
}

function statusOf(key: InventoryStatusKey): { status: RvUnitStatus; label: string; color: string } {
  const found = STATUSES.find((item) => item.key === key);
  const status = found?.status ?? "AVAILABLE";
  return { status, label: UNIT_STATUS_LABELS[status], color: UNIT_STATUS_COLORS[status] };
}

function detailScale(projects: readonly InventoryProject[]): number {
  let peak = 0;
  for (const project of projects) {
    for (const tower of project.towers) {
      for (const key of WATERFALL) peak = Math.max(peak, tower.counts[key]);
    }
  }
  return peak > 0 ? peak : 1;
}

function heroScale(project: InventoryProject): number {
  let peak = 0;
  for (const tower of project.towers) peak = Math.max(peak, tower.counts.total);
  return peak > 0 ? peak : 1;
}

const HERO_FONT = "Inter, ui-sans-serif, system-ui, sans-serif";
const HERO_FIGURE = 10;
const HERO_FIGURE_PAD = 2;
const HERO_AXIS = 22;

function figureInk(hex: string): string {
  const raw = hex.replace("#", "");
  const red = Number.parseInt(raw.slice(0, 2), 16);
  const green = Number.parseInt(raw.slice(2, 4), 16);
  const blue = Number.parseInt(raw.slice(4, 6), 16);
  if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) return "#ffffff";
  const y = (red * 299 + green * 587 + blue * 114) / 1000;
  return y >= 120 ? "#0d2041" : "#ffffff";
}

const figureWidths = new Map<string, number>();

function figureWidth(text: string, fontFamily: string): number {
  const key = `${fontFamily}\0${text}`;
  const cached = figureWidths.get(key);
  if (cached != null) return cached;
  const probe = document.createElement("span");
  probe.textContent = text;
  probe.style.position = "fixed";
  probe.style.left = "-9999px";
  probe.style.top = "0";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.whiteSpace = "nowrap";
  probe.style.fontFamily = fontFamily;
  probe.style.fontSize = `${HERO_FIGURE}px`;
  probe.style.fontWeight = "700";
  probe.style.fontVariantNumeric = "tabular-nums";
  probe.style.lineHeight = "1";
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  figureWidths.set(key, width);
  return width;
}

type HeroDatum = {
  label: string;
  tower: InventoryTower;
} & Record<InventoryStatusKey, number>;

function ColumnTick({ x, y, payload }: XAxisTickContentProps) {
  const anchorX = typeof x === "number" ? x : Number(x);
  const anchorY = typeof y === "number" ? y : Number(y);
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return null;
  const label = payload?.value == null ? "" : String(payload.value);
  return (
    <text x={anchorX} y={anchorY + 12} fill={NAVY} fontSize={11} fontWeight={700} fontFamily={HERO_FONT} textAnchor="middle">
      {label}
    </text>
  );
}

function heroDatum(payload: unknown): HeroDatum | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Partial<HeroDatum>;
  if (typeof row.label !== "string" || !row.tower) return null;
  return row as HeroDatum;
}

function segmentShape(
  key: InventoryStatusKey,
  color: string,
  place: string,
  onOpen: (tower: InventoryTower, status: InventoryStatusKey) => void,
) {
  return function Segment(props: BarShapeProps) {
    const { x, y, width, height } = props;
    if (x == null || y == null || width == null || height == null) return null;
    const row = heroDatum(props.payload);
    if (!row) return null;
    const value = row[key];
    const text = count(value);
    const item = statusOf(key);
    const drawn = width > 0 && height > 0;
    const inside = drawn && height >= HERO_FIGURE + HERO_FIGURE_PAD && width >= figureWidth(text, HERO_FONT) + HERO_FIGURE_PAD;
    const open = () => onOpen(row.tower, key);
    const onKey = (event: ReactKeyboardEvent<SVGGElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    };
    if (!drawn && !inside) return null;
    return (
      <g role="button" tabIndex={0} aria-label={`${place}, ${row.label}, ${item.label}: ${text}`} style={{ cursor: "pointer" }} onClick={open} onKeyDown={onKey}>
        {drawn ? <rect x={x} y={y} width={width} height={height} fill={color} /> : null}
        {inside ? (
          <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fill={figureInk(color)} fontFamily={HERO_FONT} fontSize={HERO_FIGURE} fontWeight={700}>
            {text}
          </text>
        ) : null}
      </g>
    );
  };
}

function linesFor(projects: readonly InventoryProject[], status: InventoryStatusKey | null): string[] {
  const lines: string[] = [];
  for (const project of projects) {
    for (const tower of project.towers) {
      for (const unit of tower.units) {
        if (status && unit.status !== status) continue;
        lines.push(`${project.label} · ${tower.label} · ${unit.code}`);
      }
    }
  }
  return lines;
}

function formulaFor(status: InventoryStatusKey | null): string {
  if (!status) {
    return "Suma de unidades en v_rv_units_full con estado Disponible, En revisión, Reservado, Congelado o Vendido.";
  }
  const item = statusOf(status);
  return `Unidades en v_rv_units_full con estado ${item.label} (${item.status}).`;
}

function StatusList({
  counts,
  includeTotal,
  onOpen,
}: {
  counts: InventoryCounts;
  includeTotal: boolean;
  onOpen: (status: InventoryStatusKey | null) => void;
}) {
  const ceiling = counts.total > 0 ? counts.total : 1;
  const rows: { key: string; label: string; value: number; color: string; status: InventoryStatusKey | null; start: number; summary: boolean }[] = [];
  let start = 0;
  for (const key of WATERFALL) {
    const item = STATUSES.find((entry) => entry.key === key);
    if (!item) continue;
    const value = counts[key];
    rows.push({
      key,
      label: UNIT_STATUS_LABELS[item.status],
      value,
      color: UNIT_STATUS_COLORS[item.status],
      status: key,
      start,
      summary: false,
    });
    start += value;
  }
  if (includeTotal) {
    rows.push({ key: "total", label: "Total", value: counts.total, color: NAVY, status: null, start: 0, summary: true });
  }
  return (
    <ul className={styles.statusList}>
      {rows.map((row) => {
        const width = row.summary ? (row.value > 0 ? 100 : 0) : (row.value / ceiling) * 100;
        const left = row.summary ? 0 : (row.start / ceiling) * 100;
        return (
          <li key={row.key}>
            <span className={styles.statusName}>{row.label}</span>
            <button type="button" className={styles.statusTrack} onClick={() => onOpen(row.status)}>
              <span className={styles.statusPlot}>
                <span
                  className={styles.statusBar}
                  style={{ left: `${left}%`, width: `${width}%`, background: row.color }}
                />
              </span>
              <span className={styles.statusCount} style={{ color: row.color }}>{count(row.value)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TowerRows({
  project,
  scale,
  onOpen,
}: {
  project: InventoryProject;
  scale: number;
  onOpen: (tower: InventoryTower, status: InventoryStatusKey) => void;
}) {
  return (
    <div className={styles.torreBlocks}>
      {project.towers.map((tower) => (
        <section key={`${project.slug}:${tower.label}`} className={styles.torreBlock} aria-label={tower.label}>
          <h3 className={styles.torreHeading}>{tower.label}</h3>
          <ul className={styles.statusList}>
            {WATERFALL.map((key) => {
              const item = statusOf(key);
              const value = tower.counts[key];
              return (
                <li key={key}>
                  <span className={styles.statusName}>{item.label}</span>
                  <button
                    type="button"
                    className={styles.statusTrack}
                    aria-label={`${project.label}, ${tower.label}, ${item.label}: ${count(value)}`}
                    onClick={() => onOpen(tower, key)}
                  >
                    <span className={styles.statusPlot}>
                      <span className={styles.statusBar} style={{ left: 0, width: `${(value / scale) * 100}%`, background: item.color }} />
                    </span>
                    <span className={styles.statusCount} style={{ color: item.color }}>{count(value)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function HeroTowers({
  project,
  onOpen,
}: {
  project: InventoryProject;
  onOpen: (tower: InventoryTower, status: InventoryStatusKey) => void;
}) {
  const yMax = useMemo(() => heroScale(project), [project]);
  const host = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(0);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => {
      const next = Math.round(node.clientHeight);
      setBox((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const rows: HeroDatum[] = project.towers.map((tower) => ({
    label: tower.label,
    tower,
    congelado: tower.counts.congelado,
    disponible: tower.counts.disponible,
    revision: tower.counts.revision,
    reservado: tower.counts.reservado,
    vendido: tower.counts.vendido,
  }));
  return (
    <div ref={host} className={styles.heroChart}>
      {box > 0 && rows.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 2, left: 2, bottom: 0 }} barCategoryGap="12%">
            <XAxis
              dataKey="label"
              interval={0}
              minTickGap={0}
              height={HERO_AXIS}
              tickSize={0}
              tickMargin={0}
              tickLine={false}
              padding={{ left: 4, right: 4 }}
              axisLine={{ stroke: "rgba(13, 32, 65, 0.28)" }}
              tick={ColumnTick}
            />
            <YAxis hide width={0} domain={[0, yMax]} allowDecimals={false} />
            {WATERFALL.map((key) => {
              const item = statusOf(key);
              return (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="status"
                  fill={item.color}
                  isAnimationActive={false}
                  activeBar={false}
                  maxBarSize={32}
                  shape={segmentShape(key, item.color, project.label, onOpen)}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export function InventarioGeneral({
  vista,
  pending,
}: {
  vista: InventarioVista | null;
  pending: ReactNode;
}) {
  const board: InventoryBoard | null = vista?.board ?? null;
  const projects = board?.projects ?? [];
  const scale = useMemo(() => detailScale(projects), [projects]);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    setTip(null);
  }, [board]);

  useEffect(() => {
    if (!tip) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setTip(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tip]);

  function toggle(next: Tip) {
    setTip((current) => (current?.key === next.key ? null : next));
  }

  function openScope(status: InventoryStatusKey | null, place: string, source: readonly InventoryProject[]) {
    const name = status ? statusOf(status).label : "Total";
    const value = status
      ? source.reduce((sum, project) => sum + project.counts[status], 0)
      : source.reduce((sum, project) => sum + project.counts.total, 0);
    const key = `${place}:${status ?? "total"}`;
    toggle({
      key,
      title: place === "todos" ? `${name} ${count(value)}` : `${place} · ${name} ${count(value)}`,
      formula: formulaFor(status),
      scope: board?.scope ?? "",
      rows: linesFor(source, status),
    });
  }

  function openTower(project: InventoryProject, tower: InventoryTower, status: InventoryStatusKey) {
    const item = statusOf(status);
    toggle({
      key: `${project.slug}:${tower.label}:${status}`,
      title: `${project.label} · ${tower.label} · ${item.label} ${count(tower.counts[status])}`,
      formula: formulaFor(status),
      scope: board?.scope ?? "",
      rows: tower.units.filter((unit) => unit.status === status).map((unit) => `${project.label} · ${tower.label} · ${unit.code}`),
    });
  }

  return (
    <section id="inventario-general" className={styles.page} aria-labelledby="vt-inventario-title">
      <h2 id="vt-inventario-title" className={styles.title}>{TITLE}</h2>
      {!board ? pending : (
        <>
          <div className={styles.heroBand}>
            <article className={styles.kpi} aria-label="Todos los Proyectos">
              <span className={styles.kpiName}>Todos los Proyectos</span>
              <StatusList
                counts={board.counts}
                includeTotal
                onOpen={(status) => openScope(status, "todos", projects)}
              />
            </article>
            <div className={styles.expanded}>
              <div className={styles.cards}>
                {projects.map((project) => (
                  <article key={project.slug} className={styles.card} aria-label={project.label}>
                    <span className={styles.cardName}>{project.label}</span>
                    <HeroTowers project={project} onOpen={(tower, status) => openTower(project, tower, status)} />
                  </article>
                ))}
              </div>
            </div>
          </div>
          {projects.length > 0 ? (
            <div className={styles.bands}>
              {projects.map((project) => (
                <div key={project.slug} className={styles.band}>
                  <article className={styles.kpi} aria-label={project.label}>
                    <span className={styles.kpiName}>{project.label}</span>
                    <StatusList
                      counts={project.counts}
                      includeTotal={false}
                      onOpen={(status) => openScope(status, project.label, [project])}
                    />
                  </article>
                  <div className={styles.detail}>
                    <TowerRows project={project} scale={scale} onOpen={(tower, status) => openTower(project, tower, status)} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {tip ? (
            <div className={styles.tip} role="dialog" aria-label={tip.title}>
              <div className={styles.tipHead}>
                <strong>{tip.title}</strong>
                <button type="button" onClick={() => setTip(null)}>Cerrar</button>
              </div>
              <p>{tip.formula}</p>
              <p>Fuente: v_rv_units_full.status, project_slug, tower_name, unit_number.</p>
              <p>{tip.scope} Sin periodo, sin asesor y sin modelo.</p>
              {tip.rows.length === 0 ? <p>Ninguna unidad.</p> : (
                <ul>
                  {tip.rows.map((row, index) => (
                    <li key={`${index}:${row}`}>{row}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
