"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { BarShapeProps, XAxisTickContentProps } from "recharts";
import { compareProjectLabels } from "@/lib/projects";
import type { AnalisisVista, SplitMove, SplitUnit } from "@/lib/ventas/vista-types";
import styles from "./lower-bands.module.css";

const RESERVA = "#0d2041";
const PCV = "#0573b0";
const LABEL_FONT = "700 11px Inter, ui-sans-serif, system-ui, sans-serif";

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

type Tip = { key: string; title: string; formula: string; source: string; rows: string[] };
type TowerChoice = { id: string; label: string; slug: string };
type Scope = { kind: "all" } | { kind: "one"; id: string } | { kind: "none" };
type Kind = "reserva" | "pcv";
type Series = { model: string; reserva: SplitMove[]; pcv: SplitMove[] };
type ProjectView = { slug: string; label: string; series: Series[] };

const RESERVA_SOURCE = "Actividades Reserva finalizadas en el periodo. Una fila por actividad. Fuente: ventas.fact_comprobante.comprobante_on.";
const PCV_SOURCE = "Promesa emitida cuya fecha cae en el periodo. La fecha es la de emisión, o la del primer comprobante si es posterior. Entra solo si el trato tiene comprobante. Fuente: ventas.fact_pcv_issuance.clock_on y ventas.fact_comprobante.";

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

function unnamed(label: string): boolean {
  const key = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return key === "" || key === "sin dato" || key === "sin torre" || key === "sin modelo";
}

function projectLabel(vista: AnalisisVista, slug: string): string {
  return vista.split.projects.find((project) => project.slug === slug)?.label ?? slug;
}

function inScope(towerId: string, scope: Scope): boolean {
  if (scope.kind === "all") return true;
  if (scope.kind === "none") return false;
  return towerId === scope.id;
}

function countSize(models: number): number {
  if (models > 12) return 9;
  if (models > 8) return 10;
  return 11;
}

function towerChoices(vista: AnalisisVista): TowerChoice[] {
  const seen = new Map<string, { name: string; slug: string }>();
  const rows = [
    ...vista.split.units.map((unit) => ({ id: unit.towerId, name: unit.towerName, slug: unit.projectSlug })),
    ...vista.split.moves.map((move) => ({ id: move.towerId, name: move.towerName, slug: move.projectSlug })),
  ];
  for (const row of rows) {
    if (!row.id || !row.name || unnamed(row.name) || seen.has(row.id)) continue;
    seen.set(row.id, { name: row.name, slug: row.slug });
  }
  const nameCount = new Map<string, number>();
  for (const info of seen.values()) nameCount.set(info.name, (nameCount.get(info.name) ?? 0) + 1);
  return [...seen.entries()]
    .map(([id, info]) => {
      const shared = (nameCount.get(info.name) ?? 0) > 1;
      const project = projectLabel(vista, info.slug);
      return { id, label: shared ? `${project} · ${info.name}` : info.name, slug: info.slug };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function modelChoices(vista: AnalisisVista, tower: TowerChoice | null): string[] {
  const names = new Set<string>();
  for (const unit of vista.split.units) {
    if (tower && unit.towerId !== tower.id) continue;
    if (unit.model) names.add(unit.model);
  }
  for (const move of vista.split.moves) {
    if (tower && move.towerId !== tower.id) continue;
    if (move.model) names.add(move.model);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "es"));
}

function modelsIn(
  slug: string,
  units: readonly SplitUnit[],
  moves: readonly SplitMove[],
  scope: Scope,
  focused: string,
): string[] {
  if (scope.kind === "none") return [];
  if (focused) return [focused];
  const names = new Set<string>();
  for (const unit of units) {
    if (unit.projectSlug === slug && unit.model && inScope(unit.towerId, scope)) names.add(unit.model);
  }
  for (const move of moves) {
    if (move.projectSlug === slug && move.model && inScope(move.towerId, scope)) names.add(move.model);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "es"));
}

function collect(
  moves: readonly SplitMove[],
  slug: string,
  model: string,
  scope: Scope,
  kind: Kind,
): SplitMove[] {
  const rows: SplitMove[] = [];
  for (const move of moves) {
    if (move.kind !== kind || move.projectSlug !== slug || move.model !== model) continue;
    if (!inScope(move.towerId, scope)) continue;
    rows.push(move);
  }
  return rows;
}

function seriesFor(
  units: readonly SplitUnit[],
  moves: readonly SplitMove[],
  slug: string,
  scope: Scope,
  focused: string,
): Series[] {
  return modelsIn(slug, units, moves, scope, focused).map((model) => ({
    model,
    reserva: collect(moves, slug, model, scope, "reserva"),
    pcv: collect(moves, slug, model, scope, "pcv"),
  }));
}

function cardScope(tower: TowerChoice | null, slug: string): Scope {
  if (!tower) return { kind: "all" };
  if (tower.slug !== slug) return { kind: "none" };
  return { kind: "one", id: tower.id };
}

function moveLine(vista: AnalisisVista, move: SplitMove): string {
  const who = move.unit || move.id;
  const model = move.model ? ` · ${move.model}` : "";
  return `${projectLabel(vista, move.projectSlug)} · ${who} · ${dotted(move.day)}${model}`;
}

function buildView(vista: AnalisisVista, tower: TowerChoice | null, focused: string): {
  projects: ProjectView[];
  reservas: SplitMove[];
  pcvs: SplitMove[];
} {
  const projects = [...vista.split.projects]
    .sort((a, b) => compareProjectLabels(a.label, b.label))
    .map((project) => {
      const scope = cardScope(tower, project.slug);
      return {
        slug: project.slug,
        label: project.label,
        series: seriesFor(vista.split.units, vista.split.moves, project.slug, scope, focused),
      };
    });
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

function movesOf(project: ProjectView, kind: Kind): SplitMove[] {
  const rows: SplitMove[] = [];
  for (const item of project.series) rows.push(...item[kind]);
  return rows;
}

function modelOf(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const model = (payload as { model?: unknown }).model;
  return typeof model === "string" ? model : "";
}

let labelCanvas: HTMLCanvasElement | null = null;

function labelWidth(text: string, fontSize: number): number {
  if (typeof document === "undefined") return text.length * fontSize * 0.64;
  labelCanvas ??= document.createElement("canvas");
  const ctx = labelCanvas.getContext("2d");
  if (!ctx) return text.length * fontSize * 0.64;
  ctx.font = LABEL_FONT.replace("11px", `${fontSize}px`);
  return ctx.measureText(text).width;
}

function longestLabel(labels: readonly string[]): string {
  return labels.reduce((best, label) => (label.length > best.length ? label : best), "");
}

function paddedWidth(text: string, fontSize: number): number {
  return labelWidth(text, fontSize) * 1.12 + 6;
}

function fitLabel(labels: readonly string[], room: number): { font: number; axis: number } {
  const longest = longestLabel(labels);
  const full = longest ? paddedWidth(longest, 11) : 16;
  if (!longest || room >= full) return { font: 11, axis: Math.max(16, Math.ceil(full)) };
  if (room <= 6) return { font: 1, axis: Math.max(0, room) };
  let font = 11 * ((room - 6) / Math.max(full - 6, 1));
  let width = paddedWidth(longest, font);
  if (width > room && width > 0) font *= room / width;
  return { font: Math.max(font, 1), axis: room };
}

function chartSlots(box: number, countFont: number, labels: readonly string[]): { top: number; font: number; axis: number } {
  const topWanted = countFont + 6;
  const fitted = fitLabel(labels, Number.POSITIVE_INFINITY);
  const minPlot = 16;
  if (box >= topWanted + fitted.axis + minPlot) {
    return { top: topWanted, font: 11, axis: fitted.axis };
  }
  const available = Math.max(0, box - minPlot);
  const top = Math.max(11, Math.min(topWanted, Math.floor(available * 0.34)));
  const axis = Math.max(0, available - top);
  const squeezed = fitLabel(labels, axis);
  return { top, font: squeezed.font, axis };
}

function VerticalTick({ x, y, payload, fontSize }: XAxisTickContentProps & { fontSize: number }) {
  const anchorX = typeof x === "number" ? x : Number(x);
  const anchorY = typeof y === "number" ? y : Number(y);
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return null;
  const label = payload?.value == null ? "" : String(payload.value);
  const yText = anchorY + 2;
  return (
    <text
      x={anchorX}
      y={yText}
      fill="#0d2041"
      fontSize={fontSize}
      fontWeight={700}
      fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
      textAnchor="end"
      transform={`rotate(-90 ${anchorX} ${yText})`}
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
            fill={dashed ? "rgba(5, 115, 176, 0.12)" : RESERVA}
            stroke={dashed ? PCV : "none"}
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
  const labels = series.map((row) => row.model);
  const slots = chartSlots(box, fontSize, labels);
  const data = series.map((row) => ({ model: row.model, value: row[kind].length }));
  const open = (model: string) => onOpen(model, kind, place);
  const name = kind === "reserva" ? "Reserva" : "PCV";
  const tick = (props: XAxisTickContentProps) => <VerticalTick {...props} fontSize={slots.font} />;
  return (
    <div ref={host} className={styles.splitChart}>
      {box > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: slots.top, right: 2, left: 2, bottom: 0 }} barCategoryGap="12%">
            <XAxis
              dataKey="model"
              interval={0}
              minTickGap={0}
              angle={-90}
              textAnchor="end"
              height={slots.axis}
              tickSize={0}
              tickMargin={0}
              tickLine={false}
              padding={{ left: 6, right: 6 }}
              axisLine={{ stroke: "rgba(13, 32, 65, 0.28)" }}
              tick={tick}
            />
            <YAxis hide width={0} domain={[0, yMax]} allowDecimals={false} />
            <Bar
              dataKey="value"
              name={name}
              fill={kind === "reserva" ? RESERVA : "rgba(5, 115, 176, 0.12)"}
              stroke={kind === "pcv" ? PCV : "none"}
              maxBarSize={maxBarSize ?? undefined}
              isAnimationActive={false}
              activeBar={false}
              shape={columnShape(kind, place, fontSize, (model) => open(model))}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export function ModeloSplit({ vista }: { vista: AnalisisVista }) {
  const [tower, setTower] = useState("");
  const [modelo, setModelo] = useState("");
  const [series, setSeries] = useState<Kind>("reserva");
  const [tip, setTip] = useState<Tip | null>(null);
  const towers = towerChoices(vista);
  const towerActive = towers.find((choice) => choice.id === tower) ?? null;
  const models = modelChoices(vista, towerActive);
  const modeloActive = models.includes(modelo) ? modelo : "";
  const view = useMemo(() => buildView(vista, towerActive, modeloActive), [vista, towerActive, modeloActive]);
  const yMax = useMemo(() => scaleOf(view.projects, series), [view.projects, series]);
  const scopeText = `${vista.split.scope} Torre: ${towerActive?.label ?? "Todas"}. Modelo: ${modeloActive || "Todos"}.`;

  useEffect(() => {
    if (!tip) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setTip(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tip]);

  function chooseTower(value: string) {
    setTower(value);
    const nextTower = towers.find((choice) => choice.id === value) ?? null;
    const nextModels = modelChoices(vista, nextTower);
    setModelo((current) => (current && nextModels.includes(current) ? current : ""));
    setTip(null);
  }

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

  function openProject(project: ProjectView, kind: Kind) {
    const moves = movesOf(project, kind);
    const heading = kind === "reserva" ? "Unidades con Reserva" : "Unidades con PCV";
    open({
      key: `${project.slug}:${kind}`,
      title: `${project.label}. ${heading} ${count(moves.length)}`,
      formula: kind === "reserva" ? "Actividades Reserva del periodo en el filtro." : "PCV del periodo en el filtro.",
      source: kind === "reserva" ? RESERVA_SOURCE : PCV_SOURCE,
      rows: moves.map((move) => moveLine(vista, move)),
    });
  }

  return (
    <>
      <div className={styles.localFilters}>
        <label>
          Torre
          <select value={towerActive?.id ?? ""} onChange={(event) => chooseTower(event.target.value)}>
            <option value="">Todas</option>
            {towers.map((choice) => (
              <option key={choice.id} value={choice.id}>{choice.label}</option>
            ))}
          </select>
        </label>
        <label>
          Modelo
          <select
            value={modeloActive}
            onChange={(event) => {
              setModelo(event.target.value);
              setTip(null);
            }}
          >
            <option value="">Todos</option>
            {models.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </label>
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
      <div className={styles.splitBand}>
        <div className={styles.splitHero}>
          <span className={styles.splitHeroTitle}>Todos los Proyectos</span>
          <button
            type="button"
            className={styles.splitFigure}
            onClick={() => open({
              key: "reservas",
              title: `Unidades con Reserva ${count(view.reservas.length)}`,
              formula: "Actividades Reserva del periodo en el filtro.",
              source: RESERVA_SOURCE,
              rows: view.reservas.map((move) => moveLine(vista, move)),
            })}
          >
            <strong>
              {count(view.reservas.length)}
              <span className={styles.splitUnit}>{reservaUnit(view.reservas.length)}</span>
            </strong>
          </button>
          <button
            type="button"
            className={styles.splitFigure}
            onClick={() => open({
              key: "pcv",
              title: `Unidades con PCV ${count(view.pcvs.length)}`,
              formula: "PCV del periodo en el filtro.",
              source: PCV_SOURCE,
              rows: view.pcvs.map((move) => moveLine(vista, move)),
            })}
          >
            <strong>
              {count(view.pcvs.length)}
              <span className={styles.splitUnit}>PCV</span>
            </strong>
          </button>
        </div>
        <div className={styles.splitCards}>
          {view.projects.map((project) => (
            <article key={project.slug} className={styles.splitCard} aria-label={project.label}>
              <h3 className={styles.splitProject}>{project.label}</h3>
              {project.series.length > 0 ? (
                <ModelChart
                  place={project.label}
                  series={project.series}
                  kind={series}
                  yMax={yMax}
                  onOpen={openCount}
                />
              ) : null}
            </article>
          ))}
        </div>
      </div>
      {view.projects.length > 0 ? (
        <div className={styles.splitBands}>
          {view.projects.map((project) => {
            const reservas = movesOf(project, "reserva");
            const pcvs = movesOf(project, "pcv");
            return (
              <section key={project.slug} className={styles.splitProjectBand} aria-label={project.label}>
                <div className={styles.splitHero}>
                  <span className={styles.splitHeroTitle}>{project.label}</span>
                  <button
                    type="button"
                    className={styles.splitFigure}
                    onClick={() => openProject(project, "reserva")}
                  >
                    <strong>
                      {count(reservas.length)}
                      <span className={styles.splitUnit}>{reservaUnit(reservas.length)}</span>
                    </strong>
                  </button>
                  <button
                    type="button"
                    className={styles.splitFigure}
                    onClick={() => openProject(project, "pcv")}
                  >
                    <strong>
                      {count(pcvs.length)}
                      <span className={styles.splitUnit}>PCV</span>
                    </strong>
                  </button>
                </div>
                <div className={styles.splitCards}>
                  <article className={styles.splitCard} aria-label={`Modelos de ${project.label}`}>
                    {project.series.length > 0 ? (
                      <ModelChart
                        place={project.label}
                        series={project.series}
                        kind={series}
                        yMax={yMax}
                        maxBarSize={null}
                        onOpen={openCount}
                      />
                    ) : null}
                  </article>
                </div>
              </section>
            );
          })}
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
          <p>{scopeText}</p>
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
