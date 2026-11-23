"use client";

/*
 * Section 2.1 name mapping (class names unchanged):
 * .overview / .ogLead → Hero Band
 * .kpi (when parent is .overview or .ogLead) → Compact Hero
 * .kpi (when parent is a project row) → Project KPI Card
 * .hero (when parent is .overview or .ogLead) → Expanded Hero
 * .hero (when parent is a project row) → Project Detail Card
 * .projects / .ogBands → Project Bands
 * data-level="project" → Project Summary Columns
 * data-level="asesor" → Member Columns
 */

import { type ReactNode } from "react";
import { compareProjectLabels, isDisplayProject, projectKey } from "@/lib/projects";
import type { CanalesVista, FunnelStage, ObjetivosVista, TotalesVista } from "@/lib/ventas/vista-types";
import styles from "./landing-blocks.module.css";

const TOTAL_PRIOR = "reservas del periodo anterior";
const ADVISOR_SPLIT = "reservas por asesor dentro del proyecto";

type Props = {
  totales: TotalesVista | null;
  objetivos: ObjetivosVista | null;
  totalesError: string | null;
  objetivosError: string | null;
};

type ProjectBar = { id: string; label: string; units: number };

type AdvisorSlice = { name: string; reservas: number };

function whole(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function reservaWord(units: number): string {
  return whole(units) === "1" ? "reserva" : "reservas";
}

function signedWhole(value: number): string {
  const text = whole(value);
  return value > 0 ? `+${text}` : text;
}

function percentText(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  let body = rounded.toFixed(2);
  if (body.endsWith("0")) body = body.slice(0, -1);
  if (body.endsWith("0")) body = body.slice(0, -1);
  if (body.endsWith(".")) body = body.slice(0, -1);
  return `${body}%`;
}

function changePill(current: number, previous: number): string {
  const change = current - previous;
  if (previous === 0) return current === 0 ? "0 (0%)" : `${signedWhole(change)} (n/d)`;
  return `${signedWhole(change)} (${percentText((change / previous) * 100)})`;
}

function shareText(part: number, all: number): string {
  if (all === 0) return "n/d";
  return `${((part / all) * 100).toFixed(1)}%`;
}

function toneClass(value: number): string {
  if (value > 0) return styles.up;
  if (value < 0) return styles.down;
  return styles.flat;
}

function widthOf(value: number, scale: number): string {
  if (scale <= 0) return "0%";
  const pct = Math.min(100, Math.max(0, (value / scale) * 100));
  return `${pct}%`;
}

function reservaStage(totales: TotalesVista | null): FunnelStage | null {
  return totales?.funnel.find((stage) => stage.id === "reservas") ?? null;
}

function projectsOf(objetivos: ObjetivosVista | null): ProjectBar[] {
  if (!objetivos) return [];
  return [...objetivos.byProject]
    .map((row) => ({ id: row.id, label: row.label, units: row.units }))
    .sort((a, b) => compareProjectLabels(a.label, b.label));
}

function hueKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function chartProjects(objetivos: ObjetivosVista | null): ProjectBar[] {
  return projectsOf(objetivos).filter((project) => isDisplayProject(project.label));
}

type MetaRow = { id: string; label: string; units: number; targetUnits: number | null };

function metaProjects(objetivos: ObjetivosVista | null): MetaRow[] {
  if (!objetivos) return [];
  return objetivos.byProject
    .filter((row) => isDisplayProject(row.label))
    .map((row) => ({
      id: row.id,
      label: row.label,
      units: row.units,
      targetUnits: projectKey(row.label) === projectKey("SANTA ELENA") ? (row.targetUnits ?? 0) : row.targetUnits,
    }))
    .sort((a, b) => compareProjectLabels(a.label, b.label));
}

function Unplugged({ source }: { source: string }) {
  return <span className={styles.unplugged}>No conectado: {source}</span>;
}

function advisorsInProject(
  label: string,
  units: number,
  stage: FunnelStage | null,
  notReps: ReadonlySet<string>,
): { ok: true; rows: AdvisorSlice[] } | { ok: false } {
  if (!stage || stage.deals.length !== stage.listTotal) return { ok: false };
  const counts = new Map<string, number>();
  let sum = 0;
  for (const deal of stage.deals) {
    if (deal.project.trim() !== label.trim()) continue;
    sum += 1;
    const name = deal.asesor.trim() || "Sin asesor";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (sum !== units) return { ok: false };
  const rows = [...counts.entries()]
    .filter(([name]) => !notReps.has(name))
    .map(([name, reservas]) => ({ name, reservas }))
    .sort((a, b) => b.reservas - a.reservas || a.name.localeCompare(b.name, "es"));
  return { ok: true, rows };
}

function singleProject(
  name: string,
  units: number,
  stage: FunnelStage | null,
  projects: readonly ProjectBar[],
): { project: string; projectUnits: number } | null {
  if (units <= 0 || !stage || stage.deals.length !== stage.listTotal) return null;
  const matched = stage.deals.filter((deal) => deal.asesor.trim() === name.trim());
  if (matched.length !== units) return null;
  const names = new Set(matched.map((deal) => deal.project.trim()));
  if (names.size !== 1) return null;
  const project = [...names][0];
  if (!project) return null;
  const row = projects.find((item) => item.label.trim() === project);
  if (!row || row.units <= 0) return null;
  return { project: row.label, projectUnits: row.units };
}

function squeeze(count: number): { gridTemplateColumns: string } {
  return { gridTemplateColumns: `repeat(${Math.max(count, 1)}, minmax(0, 1fr))` };
}

function Columns({
  columns,
  peak,
}: {
  columns: {
    key: string;
    name: string;
    reservas: number;
    hue: string;
    pressed?: boolean;
    label: string;
    onClick?: () => void;
  }[];
  peak: number;
}) {
  return (
    <>
      {columns.map((column) => {
        const body = (
          <>
            <span className={styles.vplot}>
              <span className={styles.vtrack}>
                <span className={styles.vbar} data-project={column.hue} style={{ height: widthOf(column.reservas, peak) }}>
                  <span className={styles.vval}>{whole(column.reservas)}</span>
                </span>
              </span>
            </span>
            <span className={styles.vname}>{column.name}</span>
          </>
        );
        if (!column.onClick) {
          return (
            <div key={column.key} className={styles.vcol} aria-label={column.label}>
              {body}
            </div>
          );
        }
        return (
          <button
            key={column.key}
            type="button"
            className={styles.vcol}
            aria-pressed={column.pressed ?? false}
            aria-label={column.label}
            onClick={column.onClick}
          >
            {body}
          </button>
        );
      })}
    </>
  );
}

function ReservaCard({
  name,
  units,
  prior,
  priorTitle,
  status,
  label,
  onClick,
}: {
  name?: string;
  units: number;
  prior: number | null;
  priorTitle?: string;
  status?: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      {name ? <span className={styles.kpiName}>{name}</span> : null}
      <span className={styles.kpiValue}>
        {whole(units)}
        <span className={styles.kpiUnit}>{reservaWord(units)}</span>
      </span>
      {/* Restore if requested: delta, thin bar, activity numbers, and “Cantidad de actividades”.
      {prior != null ? <span className={toneClass(units - prior)}>{changePill(units, prior)}</span> : status}
      {prior != null ? (
        <span className={styles.meter}>
          <span
            className={styles.meterBar}
            data-decline={units < prior ? "true" : undefined}
            title={priorTitle}
          >
            <span className={styles.meterPrev} style={{ width: units >= prior ? widthOf(prior, units || 1) : "100%" }} />
            <span
              className={styles.meterNow}
              style={{ width: units >= prior ? widthOf(Math.max(0, units - prior), units || 1) : widthOf(units, prior || 1) }}
            />
          </span>
          <span className={styles.meterScale}>
            <span>{whole(prior)}</span>
            <span>{whole(units)}</span>
          </span>
        </span>
      ) : null}
      <span className={styles.caption}>Cantidad de actividades</span>
      */}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={styles.kpi} aria-label={label} onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <div className={styles.kpi} aria-label={label}>
      {body}
    </div>
  );
}

function projectPrior(stage: FunnelStage | null, projectId: string, comparable: boolean): number | null {
  if (!comparable || !stage || stage.priorByProject == null) return null;
  return stage.priorByProject.find((row) => row.id === projectId)?.count ?? 0;
}

export function VentasTotalesBlock({ totales, objetivos, totalesError, objetivosError }: Props) {
  const stage = reservaStage(totales);
  const projects = chartProjects(objetivos);
  const total = objetivos ? objetivos.units : stage ? stage.count : null;
  const prior = stage?.priorCount ?? null;
  const priorAligned = prior != null && total != null && (objetivos == null ? stage != null : stage?.count === objetivos.units);
  const notReps = new Set((objetivos?.nonSalesReps ?? []).map((name) => name.trim()));

  if (total == null) {
    const waiting = (!totales && !totalesError) || (!objetivos && !objetivosError);
    return (
      <section className={styles.block} aria-label="Ventas totales">
        {totalesError ? <p className={styles.warn}>{totalesError}</p> : null}
        {objetivosError ? <p className={styles.warn}>{objetivosError}</p> : null}
        {waiting ? <p className={styles.caption}>Cargando…</p> : null}
      </section>
    );
  }

  const comparable = priorAligned && prior != null;
  const status = comparable
    ? null
    : !totales && !totalesError
      ? <span className={styles.caption}>Cargando…</span>
      : totalesError
        ? <span className={styles.warn}>{totalesError}</span>
        : <Unplugged source={TOTAL_PRIOR} />;
  const cap = objetivos?.notice?.includes("5.000") ? objetivos.notice : null;
  const peak = Math.max(1, ...projects.map((project) => project.units));
  const versus = totales?.priorLabel === "vs mes anterior" ? "frente al mes anterior" : "frente al periodo anterior";
  const totalWord = reservaWord(total);
  const totalLabel = priorAligned && prior != null
    ? `Total: ${whole(total)} ${totalWord}, ${changePill(total, prior)} ${versus}.`
    : totalesError
      ? `Total: ${whole(total)} ${totalWord}. ${totalesError}`
      : !totales && !totalesError
        ? `Total: ${whole(total)} ${totalWord}. Cargando…`
        : `Total: ${whole(total)} ${totalWord}. No conectado: ${TOTAL_PRIOR}.`;

  const listed = objetivos != null && projects.length > 0;

  return (
    <section className={styles.block} aria-label="Ventas totales">
      <div className={listed ? styles.fold : undefined}>
      <div className={`${styles.top} ${styles.overview}`}>
        <div className={styles.rail}>
          <ReservaCard
            name="Todos los Proyectos"
            units={total}
            prior={comparable && prior != null ? prior : null}
            priorTitle={totales?.priorLabel === "vs mes anterior" ? "Mes anterior" : "Periodo anterior"}
            status={status}
            label={totalLabel}
          />
        </div>

        <div className={styles.hero}>
          <h2 id="vt-bar-title" className={styles.srOnly}>
            Reservas por proyecto
          </h2>
          <div className={styles.heroChart}>
            {!objetivos && !objetivosError ? <p className={styles.caption}>Cargando…</p> : null}
            {!objetivos && objetivosError ? <p className={styles.warn}>{objetivosError}</p> : null}
            {objetivos && projects.length === 0 ? <p className={styles.caption}>Sin proyectos en este periodo.</p> : null}
            {objetivos && projects.length > 0 ? (
              <div className={styles.vbars} role="group" aria-labelledby="vt-bar-title" aria-label="Proyectos" style={squeeze(projects.length)}>
                <Columns
                  peak={peak}
                  columns={projects.map((project) => ({
                    key: project.id,
                    name: project.label,
                    reservas: project.units,
                    hue: hueKey(project.label),
                    label: `${project.label}: ${whole(project.units)} reservas, ${shareText(project.units, total)} del total.`,
                  }))}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {listed ? (
        <div className={styles.projects}>
          {projects.map((project) => {
            const drilled = advisorsInProject(project.label, project.units, stage, notReps);
            const advisorColumns = project.units === 0 ? [] : drilled.ok ? drilled.rows : null;
            const earlier = projectPrior(stage, project.id, comparable);
            const peakProject = advisorColumns && advisorColumns.length > 0
              ? Math.max(1, ...advisorColumns.map((row) => row.reservas))
              : 1;
            const projectWord = reservaWord(project.units);
            const projectLabel = earlier != null
              ? `${project.label}: ${whole(project.units)} ${projectWord}, ${changePill(project.units, earlier)} ${versus}.`
              : `${project.label}: ${whole(project.units)} ${projectWord}.`;
            return (
              <div key={project.id} className={styles.top}>
                <div className={styles.rail}>
                  <ReservaCard
                    name={project.label}
                    units={project.units}
                    prior={earlier}
                    priorTitle={totales?.priorLabel === "vs mes anterior" ? "Mes anterior" : "Periodo anterior"}
                    label={projectLabel}
                  />
                </div>
                <div className={styles.hero}>
                  <div className={styles.heroChart}>
                    {advisorColumns && advisorColumns.length > 0 ? (
                      <div className={styles.vbars} role="group" aria-label={`Asesores de ${project.label}`}>
                        <Columns
                          peak={peakProject}
                          columns={advisorColumns.map((row) => ({
                            key: `${project.id}:${row.name}`,
                            name: row.name,
                            reservas: row.reservas,
                            hue: hueKey(project.label),
                            label: `${project.label} · ${row.name}: ${whole(row.reservas)} reservas, ${shareText(row.reservas, total)} del total, ${shareText(row.reservas, project.units)} de ${project.label}.`,
                          }))}
                        />
                      </div>
                    ) : null}
                    {advisorColumns == null ? <Unplugged source={ADVISOR_SPLIT} /> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      </div>

      {cap ? <p className={styles.caption}>{cap}</p> : null}
    </section>
  );
}

type GoalMode = "u" | "pct";

type GoalRow = {
  id: string;
  name: string;
  units: number;
  target: number | null;
  hue: string;
  lead: boolean;
  solid: boolean;
};

type GoalAxis = { kind: GoalMode; scale: number };

function gridMarks(scale: number): number[] {
  if (!(scale > 0)) return [];
  const top = Math.floor(scale) + 1;
  const marks: number[] = [];
  for (let value = 0; value <= top; value += 1) marks.push(value);
  return marks;
}

function axisOf(rows: readonly GoalRow[], mode: GoalMode): GoalAxis {
  const unitPeak = rows.reduce((max, row) => Math.max(max, row.units, row.target ?? 0), 0);
  const units = unitPeak <= 0 ? 1 : unitPeak;
  if (mode !== "pct") return { kind: "u", scale: units };
  let peak = 0;
  let any = false;
  for (const row of rows) {
    if (row.target != null && row.target > 0) {
      any = true;
      peak = Math.max(peak, (row.units / row.target) * 100);
    }
  }
  if (!any) return { kind: "u", scale: units };
  return { kind: "pct", scale: Math.max(100, peak) };
}

function fieldPct(value: number, scale: number): number {
  if (scale <= 0) return 0;
  return Math.min(100, Math.max(0, (value / scale) * 100));
}

function markPct(value: number, scale: number): string {
  if (scale <= 0) return "0%";
  return `${(value / scale) * 100}%`;
}

function barValue(row: GoalRow, axis: GoalAxis): number {
  if (axis.kind === "pct") {
    if (row.target != null && row.target > 0) return (row.units / row.target) * 100;
    return 0;
  }
  return row.units;
}

function tickValue(row: GoalRow, axis: GoalAxis): number | null {
  if (row.target == null) return null;
  if (axis.kind === "pct" && row.target > 0) return 100;
  return row.target;
}

function anchor(pct: number): string {
  if (pct <= 0) return "translateX(0)";
  if (pct >= 100) return "translateX(-100%)";
  return "translateX(-50%)";
}

function actualText(row: GoalRow, mode: GoalMode): string {
  if (mode === "pct" && row.target != null && row.target > 0) return `${Math.round((row.units / row.target) * 100)}%`;
  return whole(row.units);
}

function metaText(row: GoalRow, mode: GoalMode): string | null {
  if (row.target == null) return null;
  if (mode === "pct" && row.target > 0) return "100%";
  return whole(row.target);
}

function GoalScale({ marks, scale, span }: { marks: readonly number[]; scale: number; span: number }) {
  if (marks.length === 0 || span <= 0) return null;
  return (
    <div className={styles.goalScale} style={{ gridRow: `1 / span ${span}` }} aria-hidden="true">
      {marks.map((mark) => (
        <span key={mark} className={styles.goalGridLine} style={{ left: markPct(mark, scale) }} />
      ))}
    </div>
  );
}

function GoalLine({ row, axis, mode, frameRow }: { row: GoalRow; axis: GoalAxis; mode: GoalMode; frameRow?: number }) {
  const barPct = fieldPct(barValue(row, axis), axis.scale);
  const tick = tickValue(row, axis);
  const tickPct = tick == null ? null : fieldPct(tick, axis.scale);
  const meta = metaText(row, mode);
  const gap = row.target == null ? null : row.units - row.target;
  const short = tickPct != null && barPct < tickPct;
  const over = tickPct != null && barPct > tickPct;
  const segFrom = tickPct == null ? 0 : Math.min(barPct, tickPct);
  const segTo = tickPct == null ? 0 : Math.max(barPct, tickPct);
  return (
    <div className={styles.goalRow} style={frameRow == null ? undefined : { gridRow: frameRow }}>
      <span className={styles.goalName}>{row.name}</span>
      <div className={styles.goalPlot}>
        <div className={styles.goalField}>
          {tickPct != null && segTo - segFrom > 0.05 ? (
            <span
              className={`${styles.goalSeg} ${short ? styles.goalShort : ""} ${over ? styles.goalOver : ""}`}
              style={{ left: `${segFrom}%`, width: `${segTo - segFrom}%` }}
              aria-hidden="true"
            />
          ) : null}
          <span
            className={row.solid ? styles.goalBarSolid : styles.goalBarMix}
            data-project={row.hue || undefined}
            data-lead={row.lead && row.hue ? "true" : undefined}
            style={{ width: `${barPct}%` }}
            aria-hidden="true"
          />
          {tickPct != null ? (
            <span className={styles.goalTick} style={{ left: `${tickPct}%`, transform: anchor(tickPct) }} aria-hidden="true" />
          ) : null}
          {meta != null && tickPct != null ? (
            <span className={styles.goalMeta} style={{ left: `${tickPct}%`, transform: anchor(tickPct) }}>
              {meta}
            </span>
          ) : null}
          <span className={styles.goalActual} style={{ left: `calc(${barPct}% + 6px)` }}>
            {actualText(row, mode)}
          </span>
        </div>
      </div>
      <span className={styles.goalDelta}>
        {gap != null ? <span className={toneClass(gap)}>{signedWhole(gap)}</span> : null}
      </span>
    </div>
  );
}

function GoalList({ rows, mode }: { rows: readonly GoalRow[]; mode: GoalMode }) {
  const axis = axisOf(rows, mode);
  const marks = gridMarks(axis.scale);
  return (
    <div className={styles.goalFrame}>
      <GoalScale marks={marks} scale={axis.scale} span={rows.length} />
      {rows.map((row, index) => (
        <GoalLine key={row.id} row={row} axis={axis} mode={mode} frameRow={index + 1} />
      ))}
    </div>
  );
}

const COLUMN_HEADROOM = 1.14;

function signedPercent(gapValue: number, target: number): string | null {
  if (target === 0) return gapValue === 0 ? "0%" : null;
  const pct = Math.round((gapValue / target) * 100);
  if (pct > 0) return `+${pct}%`;
  return `${pct}%`;
}

function varianceOf(units: number, target: number | null): { units: string; pct: string | null; gap: number } | null {
  if (target == null) return null;
  const gapValue = units - target;
  return {
    units: signedWhole(gapValue),
    pct: signedPercent(gapValue, target),
    gap: gapValue,
  };
}

function toneName(value: number): "up" | "down" | "flat" {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

type ObjetivoColumn = {
  key: string;
  name: string;
  units: number;
  target: number | null;
  hue: string;
};

function columnLabel(column: ObjetivoColumn): string {
  const count = `${whole(column.units)} ${reservaWord(column.units)}`;
  const variance = varianceOf(column.units, column.target);
  if (column.target == null || !variance) return `${column.name}: ${count}.`;
  const gapText = variance.pct ? `${variance.units} (${variance.pct})` : variance.units;
  return `${column.name}: ${count} frente a objetivo ${whole(column.target)}, ${gapText}.`;
}

function ObjetivoFigure({ units, target }: { units: number; target: number | null }) {
  const variance = varianceOf(units, target);
  return (
    <span className={styles.ogFigure}>
      <span className={styles.ogActual}>
        <span className={styles.ogTarget}>{whole(units)}</span>
        {target != null ? <span className={styles.ogSlash}>/</span> : null}
        {target != null ? <span className={styles.ogTarget}>{whole(target)}</span> : null}
      </span>
      {variance ? (
        <span className={toneClass(variance.gap)}>
          {variance.pct ? `${variance.units} (${variance.pct})` : variance.units}
        </span>
      ) : null}
    </span>
  );
}

function ObjetivoCard({ name, units, target }: { name: string; units: number; target: number | null }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiName}>{name}</span>
      <ObjetivoFigure units={units} target={target} />
    </div>
  );
}

function ObjetivoColumns({
  columns,
  level,
  label,
}: {
  columns: readonly ObjetivoColumn[];
  level: "project" | "asesor";
  label: string;
}) {
  const peak = columns.reduce((max, column) => Math.max(max, column.units, column.target ?? 0), 0);
  const scale = peak <= 0 ? 1 : peak * COLUMN_HEADROOM;
  return (
    <div className={styles.ogCols} data-level={level} role="group" aria-label={label}>
      {columns.map((column) => {
        const variance = varianceOf(column.units, column.target);
        const bar = (Math.max(0, column.units) / scale) * 100;
        const line = column.target == null ? null : (Math.max(0, column.target) / scale) * 100;
        const gapText = variance ? (variance.pct ? `${variance.units} (${variance.pct})` : variance.units) : "";
        return (
          <div key={column.key} className={styles.ogCol} role="img" aria-label={columnLabel(column)}>
            <div className={styles.ogColBody}>
              <div className={styles.ogPlotWrap}>
                <div className={styles.ogPlot}>
                  <span className={styles.ogNum} style={{ bottom: `calc(${bar}% + 2px)` }}>{whole(column.units)}</span>
                  {line != null ? <span className={styles.ogLine} style={{ bottom: `${line}%` }} aria-hidden="true" /> : null}
                  <span
                    className={styles.ogBar}
                    data-project={column.hue || undefined}
                    style={{ height: `${bar}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
            <span className={styles.ogName}>{column.name}</span>
            <span className={styles.ogDelta} data-tone={variance ? toneName(variance.gap) : undefined}>
              {gapText || "\u00a0"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function projectAsesores(
  objetivos: ObjetivosVista,
  projectId: string,
): { id: string; label: string; units: number; targetUnits: number | null }[] {
  const groups = Array.isArray(objetivos.asesoresByProject) ? objetivos.asesoresByProject : [];
  const found = groups.find((group) => group.projectId === projectId);
  return [...(found?.asesores ?? [])].sort(
    (a, b) => b.units - a.units || a.label.localeCompare(b.label, "es"),
  );
}

export function ObjetivosBlock({
  objetivos,
  objetivosError,
}: {
  objetivos: ObjetivosVista | null;
  objetivosError: string | null;
}) {
  if (!objetivos) {
    return (
      <section className={styles.block} id="objetivos-de-ventas" aria-label="Objetivos de ventas">
        {objetivosError ? <p className={styles.warn}>{objetivosError}</p> : <p className={styles.caption}>Cargando…</p>}
      </section>
    );
  }

  const projects = metaProjects(objetivos);
  const projectColumns: ObjetivoColumn[] = projects.map((project) => ({
    key: project.id,
    name: project.label,
    units: project.units,
    target: project.targetUnits,
    hue: hueKey(project.label),
  }));

  return (
    <section className={`${styles.block} ${styles.ogSection}`} id="objetivos-de-ventas" aria-label="Objetivos de ventas">
      <div className={`${styles.top} ${styles.ogLead}`}>
        <div className={styles.rail}>
          <ObjetivoCard name="Todos los Proyectos" units={objetivos.units} target={objetivos.targetUnits} />
        </div>
        <div className={`${styles.hero} ${styles.ogCard}`}>
          {projectColumns.length > 0 ? <ObjetivoColumns columns={projectColumns} level="project" label="Proyectos" /> : null}
        </div>
      </div>
      {projects.length > 0 ? (
        <div className={styles.ogBands}>
          {projects.map((project) => (
            <div key={project.id} className={`${styles.top} ${styles.ogBand}`}>
              <div className={styles.rail}>
                <ObjetivoCard name={project.label} units={project.units} target={project.targetUnits} />
              </div>
              <div className={`${styles.hero} ${styles.ogCard}`}>
                <ObjetivoColumns
                  columns={projectAsesores(objetivos, project.id).map((asesor) => ({
                    key: `${project.id}:${asesor.id}`,
                    name: asesor.label,
                    units: asesor.units,
                    target: asesor.targetUnits,
                    hue: hueKey(project.label),
                  }))}
                  level="asesor"
                  label={`Asesores de ${project.label}`}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function CanalesBlock({
  vista,
  error,
  onFuente,
}: {
  vista: CanalesVista | null;
  error: string | null;
  onFuente?: (id: string, label: string) => void;
}) {
  const board = vista?.fuenteBoard ?? [];
  const total = board.reduce((sum, project) => sum + project.reservas, 0);
  const peak = Math.max(1, ...board.map((project) => project.reservas));
  const memberPeak = Math.max(1, ...board.flatMap((project) => project.fuentes.map((fuente) => fuente.reservas)));
  return (
    <section className={styles.block} id="ventas-por-canales" aria-labelledby="vt-canales-title">
      <h2 id="vt-canales-title" className={styles.srOnly}>Ventas por canales</h2>
      {!vista && error ? <p className={styles.warn}>{error}</p> : null}
      {!vista && !error ? <p className={styles.caption}>Cargando…</p> : null}
      {vista ? (
        <div className={styles.fold}>
          <div className={`${styles.top} ${styles.overview}`}>
            <div className={styles.rail}>
              <div className={styles.kpi} aria-label={`Todos los Proyectos: ${whole(total)} reservas`}>
                <span className={styles.kpiName}>Todos los Proyectos</span>
                <span className={styles.kpiValue}>{whole(total)}<span className={styles.kpiUnit}>{reservaWord(total)}</span></span>
              </div>
            </div>
            <div className={styles.hero}>
              <div className={styles.heroChart}>
                {board.length > 0 ? (
                  <div className={styles.vbars} role="group" aria-label="Proyectos" style={squeeze(board.length)}>
                    <Columns
                      peak={peak}
                      columns={board.map((project) => ({
                        key: project.id,
                        name: project.label,
                        reservas: project.reservas,
                        hue: hueKey(project.label),
                        label: `${project.label}: ${whole(project.reservas)} reservas.`,
                      }))}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {board.length > 0 ? (
            <div className={styles.projects}>
              {board.map((project) => (
                <div key={project.id} className={styles.top}>
                  <div className={styles.rail}>
                    <div className={styles.kpi} aria-label={`${project.label}: ${whole(project.reservas)} reservas`}>
                      <span className={styles.kpiName}>{project.label}</span>
                      <span className={styles.kpiValue}>{whole(project.reservas)}<span className={styles.kpiUnit}>{reservaWord(project.reservas)}</span></span>
                    </div>
                  </div>
                  <div className={styles.hero}>
                    <div className={styles.heroChart}>
                      <div className={styles.vbars} role="group" aria-label={`Fuentes de ${project.label}`} style={squeeze(project.fuentes.length)}>
                        <Columns
                          peak={memberPeak}
                          columns={project.fuentes.map((fuente) => ({
                            key: `${project.id}:${fuente.id}`,
                            name: fuente.label,
                            reservas: fuente.reservas,
                            hue: hueKey(project.label),
                            label: `${project.label} · ${fuente.label}: ${whole(fuente.reservas)} reservas.`,
                            onClick: onFuente && fuente.id !== "otras" ? () => onFuente(fuente.id, fuente.label) : undefined,
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
