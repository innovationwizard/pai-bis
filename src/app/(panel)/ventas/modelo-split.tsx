"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { BarShapeProps, XAxisTickContentProps } from "recharts";
import { compareProjectLabels } from "@/lib/projects";
import { odooTowerLabel, towerIdentity } from "@/lib/ventas/tower-label";
import type { AnalisisVista, SplitMove, SplitUnit } from "@/lib/ventas/vista-types";
import styles from "./lower-bands.module.css";

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

const PROJECT_COLOR: Record<string, string> = {
  benestare: "#0d2041",
  "boulevard-5": "#3d6f8f",
  "bosque-las-tapias": "#0573b0",
  "santa-elena": "#1a4a68",
};

type Tip = { key: string; title: string; formula: string; source: string; rows: string[] };
type Kind = "reserva" | "pcv";
type Series = { model: string; reserva: SplitMove[]; pcv: SplitMove[] };
type ProjectView = { slug: string; label: string; series: Series[] };

const RESERVA_SOURCE = "Actividades Reserva finalizadas en el periodo. Una fila por actividad. Fuente: ventas.fact_comprobante.comprobante_on.";
const PCV_SOURCE = "Promesa emitida cuya fecha cae en el periodo. La fecha es el día del reloj de emisión. Fuente: ventas.fact_pcv_issuance.clock_on.";

function count(value: number): string {
  return countFormat.format(value);
}

function reservaUnit(units: number): string {
  return units === 1 ? "reserva" : "reservas";
}

function dotted(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function projectLabel(vista: AnalisisVista, slug: string): string {
  return vista.split.projects.find((project) => project.slug === slug)?.label ?? slug;
}

function hueKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function projectColor(label: string): string {
  return PROJECT_COLOR[hueKey(label)] ?? "#64748b";
}

function projectTint(hex: string): string {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, 0.12)`;
}

function countSize(models: number): number {
  if (models > 12) return 9;
  if (models > 8) return 10;
  return 11;
}

function modelsIn(
  slug: string,
  units: readonly SplitUnit[],
  moves: readonly SplitMove[],
): string[] {
  const names = new Set<string>();
  for (const unit of units) {
    if (unit.projectSlug === slug && unit.model) names.add(unit.model);
  }
  for (const move of moves) {
    if (move.projectSlug === slug && move.model) names.add(move.model);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "es"));
}

function collect(
  moves: readonly SplitMove[],
  slug: string,
  model: string,
  kind: Kind,
): SplitMove[] {
  const rows: SplitMove[] = [];
  for (const move of moves) {
    if (move.kind !== kind || move.projectSlug !== slug || move.model !== model) continue;
    rows.push(move);
  }
  return rows;
}

function seriesFor(
  units: readonly SplitUnit[],
  moves: readonly SplitMove[],
  slug: string,
): Series[] {
  return modelsIn(slug, units, moves).map((model) => ({
    model,
    reserva: collect(moves, slug, model, "reserva"),
    pcv: collect(moves, slug, model, "pcv"),
  }));
}

function moveLine(vista: AnalisisVista, move: SplitMove): string {
  const who = move.unit || move.id;
  const model = move.model ? ` · ${modeloLabel(move.model)}` : "";
  return `${projectLabel(vista, move.projectSlug)} · ${who} · ${dotted(move.day)}${model}`;
}

function buildView(vista: AnalisisVista): {
  projects: ProjectView[];
  reservas: SplitMove[];
  pcvs: SplitMove[];
} {
  const projects = [...vista.split.projects]
    .sort((a, b) => compareProjectLabels(a.label, b.label))
    .map((project) => ({
      slug: project.slug,
      label: project.label,
      series: seriesFor(vista.split.units, vista.split.moves, project.slug),
    }));
  const reservas: SplitMove[] = [];
  const pcvs: SplitMove[] = [];
  for (const project of projects) {
    for (const row of project.series) {
      reservas.push(...row.reserva);
      pcvs.push(...row.pcv);
    }
  }
  return { projects, reservas, pcvs };
}

function scaleOf(projects: readonly ProjectView[], kind: Kind): number {
  let peak = 0;
  for (const project of projects) {
    for (const row of project.series) peak = Math.max(peak, row[kind].length);
  }
  return peak > 0 ? peak : 1;
}

type ModelCount = { model: string; moves: SplitMove[] };

function countsFor(project: ProjectView, kind: Kind): ModelCount[] {
  return project.series.map((row) => ({ model: row.model, moves: row[kind] }));
}

type TowerRef = { key: string; label: string };

function projectTowers(slug: string, units: readonly SplitUnit[], moves: readonly SplitMove[]): TowerRef[] {
  const labels = new Map<string, string>();
  const add = (projectSlug: string, name: string) => {
    if (projectSlug !== slug) return;
    const label = name.trim();
    const key = towerIdentity(label);
    if (!key) return;
    const known = labels.get(key);
    labels.set(key, known == null ? odooTowerLabel(label) : known);
  };
  for (const unit of units) add(unit.projectSlug, unit.towerName);
  for (const move of moves) add(move.projectSlug, move.towerName);
  return [...labels.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es") || a.key.localeCompare(b.key));
}

type TowerSlice = TowerRef & { moves: SplitMove[] };
type ModelCluster = { model: string; towers: TowerSlice[] };

function modelClusters(
  project: ProjectView,
  units: readonly SplitUnit[],
  moves: readonly SplitMove[],
  kind: Kind,
): ModelCluster[] {
  const towers = projectTowers(project.slug, units, moves);
  return project.series.map((row) => ({
    model: row.model,
    towers: towers.map((tower) => ({
      ...tower,
      moves: row[kind].filter((move) => towerIdentity(move.towerName) === tower.key),
    })),
  }));
}

function torreTotals(project: ProjectView, units: readonly SplitUnit[], moves: readonly SplitMove[]): Series[] {
  const rows = {
    reserva: project.series.flatMap((row) => row.reserva),
    pcv: project.series.flatMap((row) => row.pcv),
  };
  return projectTowers(project.slug, units, moves).map((tower) => ({
    model: tower.label,
    reserva: rows.reserva.filter((move) => towerIdentity(move.towerName) === tower.key),
    pcv: rows.pcv.filter((move) => towerIdentity(move.towerName) === tower.key),
  }));
}

function torreTotalPeak(
  projects: readonly ProjectView[],
  units: readonly SplitUnit[],
  moves: readonly SplitMove[],
  kind: Kind,
): number {
  let peak = 0;
  for (const project of projects) {
    for (const tower of torreTotals(project, units, moves)) peak = Math.max(peak, tower[kind].length);
  }
  return peak > 0 ? peak : 1;
}

function towerPeak(
  projects: readonly ProjectView[],
  units: readonly SplitUnit[],
  moves: readonly SplitMove[],
  kind: Kind,
): number {
  let peak = 0;
  for (const project of projects) {
    for (const group of modelClusters(project, units, moves, kind)) {
      for (const tower of group.towers) peak = Math.max(peak, tower.moves.length);
    }
  }
  return peak > 0 ? peak : 1;
}

function ModelList({
  rows,
  scale,
  color,
  dashed,
  onOpen,
}: {
  rows: readonly ModelCount[];
  scale: number;
  color: string;
  dashed: boolean;
  onOpen: (row: ModelCount) => void;
}) {
  const ceiling = scale > 0 ? scale : 1;
  return (
    <ul className={styles.splitModelList}>
      {rows.map((row) => {
        const value = row.moves.length;
        const width = `${(value / ceiling) * 100}%`;
        return (
          <li key={row.model}>
            <span className={styles.splitModelName}>{modeloLabel(row.model)}</span>
            <button type="button" className={styles.splitModelTrack} onClick={() => onOpen(row)}>
              <span className={styles.splitModelPlot}>
                <span
                  className={styles.splitModelBar}
                  data-dashed={dashed ? "true" : undefined}
                  style={{
                    width,
                    background: dashed ? projectTint(color) : color,
                    borderColor: color,
                  }}
                />
              </span>
              <span className={styles.splitModelCount}>{count(value)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TowerChart({
  place,
  clusters,
  scale,
  color,
  dashed,
  onOpen,
}: {
  place: string;
  clusters: readonly ModelCluster[];
  scale: number;
  color: string;
  dashed: boolean;
  onOpen: (group: ModelCluster, tower: TowerSlice) => void;
}) {
  const ceiling = scale > 0 ? scale : 1;
  return (
    <div className={styles.towerChart}>
      {clusters.map((group) => (
        <div key={group.model} className={styles.towerCluster}>
          <div className={styles.towerCols}>
            {group.towers.map((tower) => {
              const value = tower.moves.length;
              const height = `${(value / ceiling) * 100}%`;
              return (
                <button
                  key={`${tower.key}:${tower.label}`}
                  type="button"
                  className={styles.towerCol}
                  aria-label={`${place}. ${modeloLabel(group.model)}. ${tower.label}. ${count(value)}`}
                  onClick={() => onOpen(group, tower)}
                >
                  <span className={styles.towerPlot}>
                    <span className={styles.towerNum} style={{ bottom: `calc(${height} + 2px)` }}>{count(value)}</span>
                    {value > 0 ? (
                      <span
                        className={styles.towerBar}
                        data-dashed={dashed ? "true" : undefined}
                        style={{
                          height,
                          background: dashed ? projectTint(color) : color,
                          borderColor: color,
                        }}
                      />
                    ) : null}
                  </span>
                  <span className={styles.towerModel}>{tower.label}</span>
                </button>
              );
            })}
          </div>
          <span className={styles.towerName}>{modeloLabel(group.model)}</span>
        </div>
      ))}
    </div>
  );
}

function modelOf(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const model = (payload as { model?: unknown }).model;
  return typeof model === "string" ? model : "";
}

function modeloLabel(label: string): string {
  return label.replace(/\s*PLUS\b/gi, "+");
}

function chartSlots(box: number, countFont: number): { top: number; axis: number } {
  const topWanted = countFont + 6;
  const axis = 22;
  if (box >= topWanted + axis + 16) return { top: topWanted, axis };
  const available = Math.max(0, box - 16);
  const top = Math.max(11, Math.min(topWanted, Math.floor(available * 0.4)));
  return { top, axis: Math.max(16, available - top) };
}

function HorizontalTick({ x, y, payload }: XAxisTickContentProps) {
  const anchorX = typeof x === "number" ? x : Number(x);
  const anchorY = typeof y === "number" ? y : Number(y);
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return null;
  const label = payload?.value == null ? "" : modeloLabel(String(payload.value));
  return (
    <text
      x={anchorX}
      y={anchorY + 12}
      fill="#0d2041"
      fontSize={11}
      fontWeight={700}
      fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
      textAnchor="middle"
    >
      {label}
    </text>
  );
}

function columnValue(value: BarShapeProps["value"]): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const last = value[value.length - 1];
    return typeof last === "number" && Number.isFinite(last) ? last : 0;
  }
  return 0;
}

function columnShape(
  kind: Kind,
  place: string,
  color: string,
  fontSize: number,
  onOpen: (model: string, kind: Kind) => void,
) {
  return function Column(props: BarShapeProps) {
    const { x, y, width, height } = props;
    if (x == null || y == null || width == null || height == null) return null;
    const model = modelOf(props.payload);
    const shown = columnValue(props.value);
    const dashed = kind === "pcv";
    const label = dashed ? "PCV" : "Reserva";
    const cx = x + width / 2;
    const baseline = y - 4;
    const hit = Math.max(12, width);
    return (
      <g
        role="button"
        tabIndex={0}
        aria-label={`${place}. ${label} ${count(shown)}`}
        style={{ cursor: "pointer" }}
        onClick={() => onOpen(model, kind)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onOpen(model, kind);
        }}
      >
        {width > 0 && height > 0 ? (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={dashed ? projectTint(color) : color}
            stroke={dashed ? color : "none"}
            strokeWidth={dashed ? 1.5 : 0}
            strokeDasharray={dashed ? "4 3" : undefined}
          />
        ) : null}
        <rect x={cx - hit / 2} y={baseline - fontSize - 1} width={hit} height={fontSize + 4} fill="transparent" />
        <text x={cx} y={baseline} textAnchor="middle" fill="#0d2041" fontSize={fontSize} fontWeight={700}>
          {count(shown)}
        </text>
      </g>
    );
  };
}

function ModelChart({
  place,
  series,
  kind,
  yMax,
  maxBarSize = 22,
  onOpen,
}: {
  place: string;
  series: readonly Series[];
  kind: Kind;
  yMax: number;
  maxBarSize?: number | null;
  onOpen: (model: string, kind: Kind, place: string) => void;
}) {
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
  const fontSize = countSize(series.length);
  const slots = chartSlots(box, fontSize);
  const data = series.map((row) => ({ model: row.model, value: row[kind].length }));
  const open = (model: string) => onOpen(model, kind, place);
  const name = kind === "reserva" ? "Reserva" : "PCV";
  const color = projectColor(place);
  return (
    <div ref={host} className={styles.splitChart}>
      {box > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: slots.top, right: 2, left: 2, bottom: 0 }} barCategoryGap="12%">
            <XAxis
              dataKey="model"
              interval={0}
              minTickGap={0}
              height={slots.axis}
              tickSize={0}
              tickMargin={0}
              tickLine={false}
              padding={{ left: 4, right: 4 }}
              axisLine={{ stroke: "rgba(13, 32, 65, 0.28)" }}
              tick={HorizontalTick}
            />
            <YAxis hide width={0} domain={[0, yMax]} allowDecimals={false} />
            <Bar
              dataKey="value"
              name={name}
              fill={kind === "reserva" ? color : projectTint(color)}
              stroke={kind === "pcv" ? color : "none"}
              maxBarSize={maxBarSize ?? undefined}
              isAnimationActive={false}
              activeBar={false}
              shape={columnShape(kind, place, color, fontSize, (model) => open(model))}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export function ModeloSplit({ vista }: { vista: AnalisisVista }) {
  const [series, setSeries] = useState<Kind>("reserva");
  const [tip, setTip] = useState<Tip | null>(null);
  const view = useMemo(() => buildView(vista), [vista]);
  const yMax = useMemo(() => scaleOf(view.projects, series), [view.projects, series]);
  const towerMax = useMemo(
    () => towerPeak(view.projects, vista.split.units, vista.split.moves, series),
    [view.projects, vista.split.units, vista.split.moves, series],
  );
  const heroTowerMax = useMemo(() => {
    let peak = torreTotalPeak(view.projects, vista.split.units, vista.split.moves, series);
    for (const project of view.projects) {
      if (project.slug !== "santa-elena") continue;
      for (const row of project.series) peak = Math.max(peak, row[series].length);
    }
    return peak > 0 ? peak : 1;
  }, [view.projects, vista.split.units, vista.split.moves, series]);

  useEffect(() => {
    if (!tip) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setTip(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tip]);

  function open(next: Tip) {
    setTip((current) => (current?.key === next.key ? null : next));
  }

  function openCount(model: string, kind: Kind, place: string) {
    const project = view.projects.find((item) => item.label === place);
    const row = project?.series.find((item) => item.model === model);
    const moves = row ? row[kind] : [];
    const title = kind === "reserva" ? "Reserva" : "PCV";
    open({
      key: `${place}:${kind}:${model}`,
      title: `${title} ${count(moves.length)}`,
      formula: kind === "reserva" ? "Actividades Reserva del periodo." : "PCV del periodo.",
      source: kind === "reserva" ? RESERVA_SOURCE : PCV_SOURCE,
      rows: moves.map((move) => moveLine(vista, move)),
    });
  }

  return (
    <>
      <div className={styles.titleRow}>
        <h2 id="vt-modelo-title" className={styles.title}>Split de ventas por modelo y por torre</h2>
        <div className={styles.localFilters}>
          <div className={styles.splitToggle} role="group" aria-label="Reserva o PCV">
            <button
              type="button"
              aria-pressed={series === "reserva"}
              onClick={() => {
                setSeries("reserva");
                setTip(null);
              }}
            >
              Reserva
            </button>
            <button
              type="button"
              aria-pressed={series === "pcv"}
              onClick={() => {
                setSeries("pcv");
                setTip(null);
              }}
            >
              PCV
            </button>
          </div>
        </div>
      </div>
      <div className={styles.splitBand}>
        <div className={styles.splitHero}>
          <span className={styles.splitHeroTitle}>Todos los Proyectos</span>
          <button
            type="button"
            className={styles.splitFigure}
            onClick={() => open(series === "reserva" ? {
              key: "reservas",
              title: `Unidades con Reserva ${count(view.reservas.length)}`,
              formula: "Actividades Reserva del periodo en el filtro.",
              source: RESERVA_SOURCE,
              rows: view.reservas.map((move) => moveLine(vista, move)),
            } : {
              key: "pcv",
              title: `Unidades con PCV ${count(view.pcvs.length)}`,
              formula: "PCV del periodo en el filtro.",
              source: PCV_SOURCE,
              rows: view.pcvs.map((move) => moveLine(vista, move)),
            })}
          >
            <strong>
              {count(series === "reserva" ? view.reservas.length : view.pcvs.length)}
              <span className={styles.splitUnit}>
                {series === "reserva" ? reservaUnit(view.reservas.length) : "PCV"}
              </span>
            </strong>
          </button>
        </div>
        <div className={styles.splitCards}>
          {view.projects.map((project) => (
            <article key={project.slug} className={styles.splitCard} aria-label={project.label}>
              <h3 className={styles.splitProject}>{project.label}</h3>
              {(() => {
                const byModelo = project.slug === "santa-elena";
                const columns = byModelo ? project.series : torreTotals(project, vista.split.units, vista.split.moves);
                if (columns.length === 0) return null;
                return (
                  <ModelChart
                    place={project.label}
                    series={columns}
                    kind={series}
                    yMax={heroTowerMax}
                    onOpen={byModelo ? openCount : (label, kind, place) => {
                      const found = view.projects.find((item) => item.label === place);
                      const matched = found
                        ? found.series.flatMap((row) => row[kind]).filter((move) => odooTowerLabel(move.towerName) === label)
                        : [];
                      const title = kind === "reserva" ? "Reserva" : "PCV";
                      open({
                        key: `${place}:${kind}:torre:${label}`,
                        title: `${place}. ${label}. ${title} ${count(matched.length)}`,
                        formula: kind === "reserva" ? "Actividades Reserva del periodo." : "PCV del periodo.",
                        source: kind === "reserva" ? RESERVA_SOURCE : PCV_SOURCE,
                        rows: matched.map((move) => moveLine(vista, move)),
                      });
                    }}
                  />
                );
              })()}
            </article>
          ))}
        </div>
      </div>
      {view.projects.length > 0 ? (
        <div className={styles.splitBands}>
          {view.projects.map((project) => (
              <section key={project.slug} className={styles.splitProjectBand} aria-label={project.label}>
                <div className={styles.splitHero}>
                  <span className={styles.splitHeroTitle}>{project.label}</span>
                  <ModelList
                    rows={countsFor(project, series)}
                    scale={yMax}
                    color={projectColor(project.label)}
                    dashed={series === "pcv"}
                    onOpen={(row) => openCount(row.model, series, project.label)}
                  />
                </div>
                <div className={styles.splitCards}>
                  <article className={styles.splitCard} aria-label={project.slug === "santa-elena" ? `Modelos de ${project.label}` : `Torres de ${project.label}`}>
                    {project.slug === "santa-elena" ? (
                      project.series.length > 0 ? (
                        <ModelChart
                          place={project.label}
                          series={project.series}
                          kind={series}
                          yMax={yMax}
                          onOpen={openCount}
                        />
                      ) : null
                    ) : (
                      <TowerChart
                        place={project.label}
                      clusters={modelClusters(project, vista.split.units, vista.split.moves, series)}
                      scale={towerMax}
                      color={projectColor(project.label)}
                      dashed={series === "pcv"}
                      onOpen={(group, tower) => {
                        const title = series === "reserva" ? "Reserva" : "PCV";
                        const model = modeloLabel(group.model);
                        open({
                          key: `${project.slug}:${series}:${group.model}:${tower.key}`,
                          title: `${project.label}. ${model}. ${tower.label}. ${title} ${count(tower.moves.length)}`,
                          formula: series === "reserva" ? "Actividades Reserva del periodo." : "PCV del periodo.",
                          source: series === "reserva" ? RESERVA_SOURCE : PCV_SOURCE,
                          rows: tower.moves.map((move) => moveLine(vista, move)),
                        });
                      }}
                      />
                    )}
                  </article>
                </div>
              </section>
          ))}
        </div>
      ) : null}
      {tip ? (
        <div className={styles.splitTip} role="dialog" aria-label={tip.title}>
          <div className={styles.splitTipHead}>
            <strong>{tip.title}</strong>
            <button type="button" onClick={() => setTip(null)}>Cerrar</button>
          </div>
          <p>{tip.formula}</p>
          <p>{tip.source}</p>
          <p>{vista.split.scope}</p>
          {vista.split.notice ? <p>{vista.split.notice}</p> : null}
          <ul>
            {tip.rows.map((row, index) => (
              <li key={`${index}:${row}`}>{row}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
