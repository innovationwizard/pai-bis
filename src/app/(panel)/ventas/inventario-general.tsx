"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, ZIndexLayer } from "recharts";
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
const CASCADE_SLOT: Record<InventoryStatusKey, number> = {
  congelado: -2,
  disponible: -1,
  revision: 0,
  reservado: 1,
  vendido: 2,
};

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

function heroScale(project: InventoryProject): number {
  let peak = 0;
  for (const tower of project.towers) peak = Math.max(peak, tower.counts.total);
  return peak > 0 ? peak : 1;
}

const HERO_FONT = "Inter, ui-sans-serif, system-ui, sans-serif";
const HERO_FIGURE = 10;
const HERO_AXIS = 22;
const LABEL_GAP = 2;

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

function figureWidth(text: string, fontFamily: string, fontSize: number): number {
  const key = `${fontFamily}\u0000${fontSize}\u0000${text}`;
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
  probe.style.fontSize = `${fontSize}px`;
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

type PlotBox = { left: number; right: number; top: number; bottom: number };

type OutsideMark = {
  id: string;
  stack: string;
  x: number;
  width: number;
  midY: number;
  text: string;
  plot: PlotBox | null;
  solo: boolean;
  slot: number | null;
  color: string;
  barHeight: number;
  open: () => void;
  aria: string;
};

type PlacedMark = OutsideMark & {
  labelY: number;
  textX: number;
  edgeX: number;
  anchor: "start" | "middle" | "end";
  fill: string;
};

type LabelBook = {
  marks: Map<string, OutsideMark>;
  listener: (() => void) | null;
  frame: boolean;
};

function touchBook(book: LabelBook) {
  if (book.frame) return;
  book.frame = true;
  queueMicrotask(() => {
    book.frame = false;
    book.listener?.();
  });
}

function plotBox(props: BarShapeProps): PlotBox | null {
  const view = (props as { parentViewBox?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown } }).parentViewBox;
  if (!view || typeof view.x !== "number" || typeof view.y !== "number" || typeof view.width !== "number" || typeof view.height !== "number") return null;
  if (view.width <= 0 || view.height <= 0) return null;
  return { left: view.x, right: view.x + view.width, top: view.y, bottom: view.y + view.height };
}

type ColumnSpan = { stack: string; left: number; right: number; center: number; plot: PlotBox | null };

type Draft = {
  mark: OutsideMark;
  x: number;
  y: number;
  w: number;
  slot: number;
};

function labelWidth(text: string): number {
  return figureWidth(text, HERO_FONT, HERO_FIGURE);
}

function halfW(d: Draft): number {
  return d.w / 2;
}

function hitsBar(d: Draft, bars: readonly { left: number; right: number }[]): boolean {
  const left = d.x - halfW(d);
  const right = d.x + halfW(d);
  return bars.some((bar) => right > bar.left + 0.5 && left < bar.right - 0.5);
}

function barList(drafts: readonly Draft[]): { left: number; right: number }[] {
  const bars = new Map<string, { left: number; right: number }>();
  for (const draft of drafts) bars.set(draft.mark.stack, { left: draft.mark.x, right: draft.mark.x + draft.mark.width });
  return [...bars.values()];
}

function hitsLabel(a: Draft, b: Draft): boolean {
  const h = HERO_FIGURE / 2;
  if (a.y + h <= b.y - h + 0.25 || b.y + h <= a.y - h + 0.25) return false;
  if (a.x + halfW(a) <= b.x - halfW(b) + 0.25 || b.x + halfW(b) <= a.x - halfW(a) + 0.25) return false;
  return true;
}

function clampY(d: Draft) {
  const plot = d.mark.plot;
  if (!plot) return;
  const pad = HERO_FIGURE / 2 + 2;
  const minY = plot.top + pad;
  const maxY = plot.bottom - pad;
  if (d.y > maxY) d.y = maxY;
  if (d.y < minY) d.y = minY;
}

function clearBar(d: Draft) {
  const own = [{ left: d.mark.x, right: d.mark.x + d.mark.width }];
  if (!hitsBar(d, own)) return;
  d.x = d.slot > 0
    ? d.mark.x + d.mark.width + LABEL_GAP + halfW(d)
    : d.mark.x - LABEL_GAP - halfW(d);
}

function packSide(items: ReadonlyMap<number, OutsideMark>, slots: readonly number[], anchor: number, direction: -1 | 1): Map<string, number> {
  const positions = new Map<string, number>();
  let cursor = anchor;
  for (const slot of slots) {
    const item = items.get(slot);
    if (!item) continue;
    const width = labelWidth(item.text);
    const x = direction < 0 ? cursor - width / 2 : cursor + width / 2;
    positions.set(item.id, x);
    cursor = direction < 0 ? x - width / 2 - LABEL_GAP : x + width / 2 + LABEL_GAP;
  }
  return positions;
}

function columnSpans(groups: ReadonlyMap<string, OutsideMark[]>): ColumnSpan[] {
  const spans: ColumnSpan[] = [];
  for (const [stack, items] of groups) {
    const sample = items[0];
    if (!sample) continue;
    spans.push({
      stack,
      left: sample.x,
      right: sample.x + sample.width,
      center: sample.x + sample.width / 2,
      plot: sample.plot,
    });
  }
  spans.sort((a, b) => a.center - b.center);
  return spans;
}

function packColumn(items: readonly OutsideMark[], column: ColumnSpan): Draft[] {
  const bySlot = new Map<number, OutsideMark>();
  for (const item of items) bySlot.set(item.slot ?? 0, item);
  const left = packSide(bySlot, [0, -1, -2], column.left - LABEL_GAP, -1);
  const right = packSide(bySlot, [1, 2], column.right + LABEL_GAP, 1);
  return items.map((mark) => {
    const slot = mark.slot ?? 0;
    const x = left.get(mark.id) ?? right.get(mark.id) ?? column.center;
    const draft: Draft = { mark, x, y: mark.midY, w: labelWidth(mark.text), slot };
    clampY(draft);
    clearBar(draft);
    return draft;
  });
}

function resolveLabels(drafts: Draft[]) {
  const bars = barList(drafts);
  for (let pass = 0; pass < 24; pass += 1) {
    let moved = false;
    for (let i = 0; i < drafts.length; i += 1) {
      for (let j = i + 1; j < drafts.length; j += 1) {
        const a = drafts[i];
        const b = drafts[j];
        if (!a || !b || !hitsLabel(a, b)) continue;
        const overlap = Math.min(a.x + halfW(a), b.x + halfW(b)) - Math.max(a.x - halfW(a), b.x - halfW(b));
        const push = Math.max(0.5, overlap / 2);
        const aIsLeft = a.slot < b.slot || (a.slot === b.slot && a.x <= b.x);
        const left = aIsLeft ? a : b;
        const right = aIsLeft ? b : a;
        const nextLeft = left.x - push;
        const nextRight = right.x + push;
        const leftFree = !hitsBar({ ...left, x: nextLeft }, bars);
        const rightFree = !hitsBar({ ...right, x: nextRight }, bars);
        if (leftFree) {
          left.x = nextLeft;
          moved = true;
        }
        if (rightFree) {
          right.x = nextRight;
          moved = true;
        }
        if (hitsLabel(left, right)) {
          const beforeLeft = left.y;
          const beforeRight = right.y;
          const yPush = Math.max(0.5, (HERO_FIGURE - Math.abs(left.y - right.y)) / 2 + 0.5);
          if (left.y <= right.y) {
            left.y -= yPush;
            right.y += yPush;
          } else {
            left.y += yPush;
            right.y -= yPush;
          }
          clampY(left);
          clampY(right);
          if (left.y !== beforeLeft || right.y !== beforeRight) moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

function placeMarks(marks: Iterable<OutsideMark>): PlacedMark[] {
  const groups = new Map<string, OutsideMark[]>();
  for (const mark of marks) {
    const group = groups.get(mark.stack);
    if (group) group.push(mark);
    else groups.set(mark.stack, [mark]);
  }
  const columns = columnSpans(groups);
  const drafts: Draft[] = [];
  for (const [stack, group] of groups) {
    const column = columns.find((item) => item.stack === stack);
    if (!column) continue;
    drafts.push(...packColumn(group, column));
  }
  resolveLabels(drafts);
  const bars = barList(drafts);
  return drafts
    .map((draft) => ({
      ...draft.mark,
      labelY: draft.y,
      textX: draft.x,
      edgeX: draft.x,
      anchor: "middle" as const,
      fill: hitsBar(draft, bars) ? figureInk(draft.mark.color) : NAVY,
    }))
    .sort((a, b) => a.id.localeCompare(b.id, "es"));
}

function samePlacement(current: readonly PlacedMark[], next: readonly PlacedMark[]): boolean {
  if (current.length !== next.length) return false;
  for (let index = 0; index < current.length; index += 1) {
    const left = current[index];
    const right = next[index];
    if (
      left.id !== right.id ||
      left.text !== right.text ||
      left.labelY !== right.labelY ||
      left.textX !== right.textX ||
      left.edgeX !== right.edgeX ||
      left.anchor !== right.anchor ||
      left.fill !== right.fill ||
      left.solo !== right.solo ||
      left.aria !== right.aria
    ) return false;
  }
  return true;
}

function OutsideLabels({ book }: { book: LabelBook }) {
  const [marks, setMarks] = useState<PlacedMark[]>([]);
  useLayoutEffect(() => {
    const publish = () => {
      const next = placeMarks(book.marks.values());
      setMarks((current) => (samePlacement(current, next) ? current : next));
    };
    book.listener = publish;
    publish();
    return () => {
      if (book.listener === publish) book.listener = null;
    };
  }, [book]);
  const onKey = (event: ReactKeyboardEvent<SVGGElement>, open: () => void) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
  };
  return (
    <ZIndexLayer zIndex={2000}>
      <g>
        {marks.map((mark) => (
          <g
            key={mark.id}
            role={mark.solo ? "button" : undefined}
            tabIndex={mark.solo ? 0 : undefined}
            aria-label={mark.solo ? mark.aria : undefined}
            style={{ cursor: "pointer" }}
            onClick={() => book.marks.get(mark.id)?.open()}
            onKeyDown={mark.solo ? (event) => onKey(event, () => book.marks.get(mark.id)?.open()) : undefined}
          >
            <text
              x={mark.textX}
              y={mark.labelY}
              textAnchor={mark.anchor}
              dominantBaseline="central"
              fill={mark.fill}
              stroke={mark.fill === NAVY ? "var(--color-card, #fff)" : "none"}
              strokeWidth={mark.fill === NAVY ? 2 : 0}
              paintOrder="stroke"
              fontFamily={HERO_FONT}
              fontSize={HERO_FIGURE}
              fontWeight={700}
            >
              {mark.text}
            </text>
          </g>
        ))}
      </g>
    </ZIndexLayer>
  );
}

function segmentShape(
  key: InventoryStatusKey,
  color: string,
  place: string,
  book: LabelBook,
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
    const id = `${row.label}:${key}`;
    const open = () => onOpen(row.tower, key);
    const aria = `${place}, ${row.label}, ${item.label}: ${text}`;
    book.marks.set(id, {
      id,
      stack: row.label,
      x,
      width,
      midY: y + height / 2,
      text,
      plot: plotBox(props),
      solo: !drawn,
      slot: CASCADE_SLOT[key],
      color,
      barHeight: height,
      open,
      aria,
    });
    touchBook(book);
    if (!drawn) return null;
    const onKey = (event: ReactKeyboardEvent<SVGGElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    };
    return (
      <g role="button" tabIndex={0} aria-label={aria} style={{ cursor: "pointer" }} onClick={open} onKeyDown={onKey}>
        <rect x={x} y={y} width={width} height={height} fill={color} />
      </g>
    );
  };
}

function linesFor(projects: readonly InventoryProject[], status: InventoryStatusKey): string[] {
  const lines: string[] = [];
  for (const project of projects) {
    for (const tower of project.towers) {
      for (const unit of tower.units) {
        if (unit.status !== status) continue;
        lines.push(`${project.label} · ${tower.label} · ${unit.code}`);
      }
    }
  }
  return lines;
}

function formulaFor(status: InventoryStatusKey): string {
  const item = statusOf(status);
  return `Unidades en v_rv_units_full con estado ${item.label} (${item.status}).`;
}

function StatusList({
  counts,
  onOpen,
}: {
  counts: InventoryCounts;
  onOpen: (status: InventoryStatusKey) => void;
}) {
  const ceiling = counts.total > 0 ? counts.total : 1;
  const rows: { key: InventoryStatusKey; label: string; value: number; color: string; start: number }[] = [];
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
      start,
    });
    start += value;
  }
  return (
    <ul className={styles.statusList}>
      {[...rows].reverse().map((row) => (
        <li key={row.key}>
          <span className={styles.statusName}>{row.label}</span>
          <button type="button" className={styles.statusTrack} onClick={() => onOpen(row.key)}>
            <span className={styles.statusPlot}>
              <span
                className={styles.statusBar}
                style={{ left: `${(row.start / ceiling) * 100}%`, width: `${(row.value / ceiling) * 100}%`, background: row.color }}
              />
            </span>
            <span className={styles.statusCount} style={{ color: row.color }}>{count(row.value)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function HeroTowers({
  project,
  onOpen,
  fit = false,
}: {
  project: InventoryProject;
  onOpen: (tower: InventoryTower, status: InventoryStatusKey) => void;
  fit?: boolean;
}) {
  const yMax = useMemo(() => heroScale(project), [project]);
  const bookRef = useRef<LabelBook | null>(null);
  if (!bookRef.current) bookRef.current = { marks: new Map(), listener: null, frame: false };
  const book = bookRef.current;
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
  useLayoutEffect(() => {
    touchBook(book);
  });
  book.marks.clear();
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
          <BarChart data={rows} margin={{ top: 4, right: 2, left: 2, bottom: 0 }} barCategoryGap="24%">
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
                  maxBarSize={fit ? undefined : 32}
                  shape={segmentShape(key, item.color, project.label, book, onOpen)}
                />
              );
            })}
            <OutsideLabels book={book} />
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

  function openScope(status: InventoryStatusKey, place: string, source: readonly InventoryProject[]) {
    const item = statusOf(status);
    const value = source.reduce((sum, project) => sum + project.counts[status], 0);
    toggle({
      key: `${place}:${status}`,
      title: place === "todos" ? `${item.label} ${count(value)}` : `${place} · ${item.label} ${count(value)}`,
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
                      onOpen={(status) => openScope(status, project.label, [project])}
                    />
                  </article>
                  <div className={styles.detail}>
                    <HeroTowers fit project={project} onOpen={(tower, status) => openTower(project, tower, status)} />
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
