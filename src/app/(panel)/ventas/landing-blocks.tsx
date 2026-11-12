"use client";

import { useState, type ReactNode } from "react";
import { compareProjectLabels, isDisplayProject, PROJECT_DISPLAY_ORDER, projectKey } from "@/lib/projects";
import type { FunnelStage, MeasureRow, ObjetivosVista, StatusVista, TotalesVista } from "@/lib/ventas/vista-types";
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

function rosterAsesores(objetivos: ObjetivosVista): MeasureRow[] {
  const allowed = new Set(objetivos.rosterAsesorIds);
  return objetivos.byAsesor.filter((row) => allowed.has(row.id));
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
            <span className={styles.vval}>{whole(column.reservas)}</span>
            <span className={styles.vplot}>
              <span className={styles.vbar} data-project={column.hue} style={{ height: widthOf(column.reservas, peak) }} />
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
  const [projectId, setProjectId] = useState<string | null>(null);
  const [advisorName, setAdvisorName] = useState<string | null>(null);
  const stage = reservaStage(totales);
  const projects = chartProjects(objetivos);
  const total = objetivos ? objetivos.units : stage ? stage.count : null;
  const prior = stage?.priorCount ?? null;
  const priorAligned = prior != null && total != null && (objetivos == null ? stage != null : stage?.count === objetivos.units);
  const notReps = new Set((objetivos?.nonSalesReps ?? []).map((name) => name.trim()));
  const selected = projects.find((project) => project.id === projectId) ?? null;
  const drilled = selected ? advisorsInProject(selected.label, selected.units, stage, notReps) : null;
  const advisorRows = drilled?.ok ? drilled.rows : null;
  const advisorShown = advisorName && advisorRows?.some((row) => row.name === advisorName) ? advisorName : null;

  function zoomOut() {
    setProjectId(null);
    setAdvisorName(null);
  }

  function zoomProject(id: string) {
    setProjectId(id);
    setAdvisorName(null);
  }

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
  const peak = advisorRows
    ? Math.max(1, ...advisorRows.map((row) => row.reservas))
    : Math.max(1, ...projects.map((project) => project.units));
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
            onClick={zoomOut}
          />
        </div>

        <div className={styles.hero}>
          <h2 id="vt-bar-title" className={styles.srOnly}>
            Barras por proyecto. Al elegir un proyecto, sus asesores.
          </h2>
          <nav className={styles.crumbs} aria-label="Total, proyecto y asesor">
            <button type="button" className={styles.crumb} aria-current={selected ? undefined : "page"} onClick={zoomOut}>
              Total
            </button>
            <span className={styles.crumbSep} aria-hidden="true">›</span>
            {selected ? (
              <button
                type="button"
                className={styles.crumb}
                aria-current={advisorShown ? undefined : "page"}
                onClick={() => setAdvisorName(null)}
              >
                {selected.label}
              </button>
            ) : (
              <span className={styles.crumbMuted}>Proyecto</span>
            )}
            <span className={styles.crumbSep} aria-hidden="true">›</span>
            {selected && advisorShown ? (
              <button type="button" className={styles.crumb} aria-current="page" onClick={() => setAdvisorName(advisorShown)}>
                {advisorShown}
              </button>
            ) : (
              <span className={styles.crumbMuted}>Asesor</span>
            )}
          </nav>
          <div className={styles.heroChart}>
            {!objetivos && !objetivosError ? <p className={styles.caption}>Cargando…</p> : null}
            {!objetivos && objetivosError ? <p className={styles.warn}>{objetivosError}</p> : null}
            {objetivos && projects.length === 0 ? <p className={styles.caption}>Sin proyectos en este periodo.</p> : null}
            {objetivos && projects.length > 0 && !selected ? (
              <div className={styles.vbars} role="group" aria-labelledby="vt-bar-title" aria-label="Proyectos">
                <Columns
                  peak={peak}
                  columns={projects.map((project) => ({
                    key: project.id,
                    name: project.label,
                    reservas: project.units,
                    hue: hueKey(project.label),
                    pressed: false,
                    label: `${project.label}: ${whole(project.units)} reservas, ${shareText(project.units, total)} del total.`,
                    onClick: () => zoomProject(project.id),
                  }))}
                />
              </div>
            ) : null}
            {selected && !totales && !totalesError ? <p className={styles.caption}>Cargando…</p> : null}
            {selected && !totales && totalesError ? <p className={styles.warn}>{totalesError}</p> : null}
            {selected && totales && advisorRows == null ? <Unplugged source={ADVISOR_SPLIT} /> : null}
            {selected && advisorRows && advisorRows.length === 0 ? <p className={styles.caption}>Sin asesores en este periodo.</p> : null}
            {selected && advisorRows && advisorRows.length > 0 ? (
              <div className={styles.vbars} role="group" aria-label={`Asesores de ${selected.label}`}>
                <Columns
                  peak={peak}
                  columns={advisorRows.map((row) => ({
                    key: `${selected.id}:${row.name}`,
                    name: row.name,
                    reservas: row.reservas,
                    hue: hueKey(selected.label),
                    pressed: advisorShown === row.name,
                    label: `${selected.label} · ${row.name}: ${whole(row.reservas)} reservas, ${shareText(row.reservas, total)} del total, ${shareText(row.reservas, selected.units)} de ${selected.label}.`,
                    onClick: () => setAdvisorName(row.name),
                  }))}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {listed ? <hr className={styles.rule} /> : null}

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

function MeasureToggle({ mode, onChange }: { mode: GoalMode; onChange: (mode: GoalMode) => void }) {
  return (
    <div className={`tier-switch tier-switch-compact ${styles.measure}`} role="group" aria-label="Unidades o porcentaje">
      <button type="button" aria-pressed={mode === "u"} aria-label="Unidades" onClick={() => onChange("u")}>
        U
      </button>
      <button type="button" aria-pressed={mode === "pct"} aria-label="Porcentaje" onClick={() => onChange("pct")}>
        %
      </button>
    </div>
  );
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

export function ReservasMetaBlock({
  objetivos,
  objetivosError,
}: {
  objetivos: ObjetivosVista | null;
  objetivosError: string | null;
}) {
  const [mode, setMode] = useState<GoalMode>("u");
  const rows = metaProjects(objetivos).map((row) => ({
    id: row.id,
    name: row.label,
    units: row.units,
    target: row.targetUnits,
    hue: hueKey(row.label),
    lead: false,
    solid: true,
  }));
  return (
    <section className={`${styles.block} ${styles.metaBand}`} aria-labelledby="vt-meta-title">
      <div className={styles.bandHead}>
        <h2 id="vt-meta-title" className={styles.panelTitle}>Objetivos por proyecto</h2>
        <MeasureToggle mode={mode} onChange={setMode} />
      </div>
      {!objetivos && objetivosError ? <p className={styles.warn}>{objetivosError}</p> : null}
      {!objetivos && !objetivosError ? <p className={styles.caption}>Cargando…</p> : null}
      {objetivos && rows.length === 0 ? <p className={styles.caption}>Sin proyectos en este periodo.</p> : null}
      {rows.length > 0 ? <GoalList rows={rows} mode={mode} /> : null}
    </section>
  );
}

export function AsesoresBlock({ totales, objetivos, objetivosError }: Omit<Props, "totalesError">) {
  const stage = reservaStage(totales);
  const projects = chartProjects(objetivos);
  return (
    <section className={`${styles.block} ${styles.panel}`} aria-labelledby="vt-asesores-title">
      <div className={styles.bandHead}>
        <h2 id="vt-asesores-title" className={styles.panelTitle}>Objetivos por asesor</h2>
      </div>
      {!objetivos && objetivosError ? <p className={styles.warn}>{objetivosError}</p> : null}
      {!objetivos && !objetivosError ? <p className={styles.caption}>Cargando…</p> : null}
      {objetivos ? (
        <>
          {/* Restore if requested: “La meta de un mes abierto es la del mes completo…”.
          {objetivos.caption && !objetivos.caption.includes("¿") ? <p className={styles.caption}>{objetivos.caption}</p> : null}
          */}
          <AsesorRows objetivos={objetivos} stage={stage} projects={projects} />
        </>
      ) : null}
    </section>
  );
}

type AdvisorPlace = { project: string; projectUnits: number };

function rosterProject(
  asesorId: string,
  objetivos: ObjetivosVista,
  projects: readonly ProjectBar[],
): AdvisorPlace | null {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const cells = objetivos.editor.cells
    .filter((cell) => cell.asesorId === asesorId && byId.has(cell.projectId))
    .sort((a, b) => {
      const byMonth = b.month.localeCompare(a.month);
      if (byMonth !== 0) return byMonth;
      return compareProjectLabels(byId.get(a.projectId)?.label ?? "", byId.get(b.projectId)?.label ?? "");
    });
  const project = cells[0] ? byId.get(cells[0].projectId) : undefined;
  if (!project) return null;
  return { project: project.label, projectUnits: project.units };
}

function AsesorRows({
  objetivos,
  stage,
  projects,
}: {
  objetivos: ObjetivosVista;
  stage: FunnelStage | null;
  projects: readonly ProjectBar[];
}) {
  const placed = rosterAsesores(objetivos).map((row) => ({
    row,
    place: rosterProject(row.id, objetivos, projects) ?? singleProject(row.label, row.units, stage, projects),
  }));
  const groups = new Map<string, typeof placed>();
  for (const name of PROJECT_DISPLAY_ORDER) groups.set(projectKey(name), []);
  const rest: typeof placed = [];
  for (const item of placed) {
    const key = item.place ? projectKey(item.place.project) : "";
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else rest.push(item);
  }
  const byUnits = (a: (typeof placed)[number], b: (typeof placed)[number]) =>
    b.row.units - a.row.units || a.row.label.localeCompare(b.row.label, "es");
  for (const bucket of groups.values()) bucket.sort(byUnits);
  rest.sort(byUnits);

  const toGoal = (item: (typeof placed)[number], lead: boolean): GoalRow => ({
    id: item.row.id,
    name: item.row.label,
    units: item.row.units,
    target: item.row.targetUnits,
    hue: item.place ? hueKey(item.place.project) : "",
    lead,
    solid: true,
  });
  const grouped = PROJECT_DISPLAY_ORDER.map((name) => {
    const items = groups.get(projectKey(name)) ?? [];
    return { key: projectKey(name), rows: items.map((item, index) => toGoal(item, index === 0)) };
  }).filter((group) => group.rows.length > 0);
  const loose = rest.map((item) => toGoal(item, false));
  const rows = [...grouped.flatMap((group) => group.rows), ...loose];
  if (rows.length === 0) return null;
  const axis = axisOf(rows, "u");
  const marks = gridMarks(axis.scale);
  const line = (row: GoalRow) => <GoalLine key={row.id} row={row} axis={axis} mode="u" />;
  const bands = loose.length > 0 ? grouped.length + 1 : grouped.length;

  return (
    <div className={`${styles.goalFrame} ${styles.goalFrameGrouped}`}>
      <GoalScale marks={marks} scale={axis.scale} span={bands} />
      {grouped.map((group, index) => (
        <div key={group.key} className={styles.projectGroup} style={{ gridRow: index + 1 }}>
          {group.rows.map(line)}
        </div>
      ))}
      {loose.length > 0 ? (
        <div className={styles.projectGroup} style={{ gridRow: grouped.length + 1 }}>
          {loose.map(line)}
        </div>
      ) : null}
    </div>
  );
}

function statusProjectRows(status: StatusVista): GoalRow[] {
  return [...status.byProject]
    .filter((row) => isDisplayProject(row.label))
    .sort((a, b) => compareProjectLabels(a.label, b.label))
    .map((row) => ({
      id: row.id,
      name: row.label,
      units: row.units,
      target: row.paceUnits,
      hue: hueKey(row.label),
      lead: false,
      solid: true,
    }));
}

function statusProjects(status: StatusVista): ProjectBar[] {
  return [...status.byProject]
    .filter((row) => isDisplayProject(row.label))
    .map((row) => ({ id: row.id, label: row.label, units: row.units }))
    .sort((a, b) => compareProjectLabels(a.label, b.label));
}

function statusAsesorProject(
  asesorId: string,
  status: StatusVista,
  projects: readonly ProjectBar[],
): { project: string } | null {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const cells = status.editor.cells
    .filter((cell) => cell.asesorId === asesorId && byId.has(cell.projectId))
    .sort((a, b) => {
      const byMonth = b.month.localeCompare(a.month);
      if (byMonth !== 0) return byMonth;
      return compareProjectLabels(byId.get(a.projectId)?.label ?? "", byId.get(b.projectId)?.label ?? "");
    });
  const project = cells[0] ? byId.get(cells[0].projectId) : undefined;
  if (!project) return null;
  return { project: project.label };
}

export function StatusProyectoBlock({ status }: { status: StatusVista }) {
  const rows = statusProjectRows(status);
  return (
    <section className={`${styles.block} ${styles.metaBand}`} aria-labelledby="vt-status-proyecto-title">
      <div className={styles.bandHead}>
        <h2 id="vt-status-proyecto-title" className={styles.panelTitle}>Status por proyecto</h2>
      </div>
      {rows.length > 0 ? <GoalList rows={rows} mode="u" /> : null}
    </section>
  );
}

function StatusAsesorRows({
  status,
  totales,
}: {
  status: StatusVista;
  totales: TotalesVista | null;
}) {
  const projects = statusProjects(status);
  const stage = reservaStage(totales);
  const placed = status.byAsesor.map((row) => ({
    row,
    place: statusAsesorProject(row.id, status, projects) ?? singleProject(row.label, row.units, stage, projects),
  }));
  const groups = new Map<string, typeof placed>();
  for (const name of PROJECT_DISPLAY_ORDER) groups.set(projectKey(name), []);
  const rest: typeof placed = [];
  for (const item of placed) {
    const key = item.place ? projectKey(item.place.project) : "";
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else rest.push(item);
  }
  const byUnits = (a: (typeof placed)[number], b: (typeof placed)[number]) =>
    b.row.units - a.row.units || a.row.label.localeCompare(b.row.label, "es");
  for (const bucket of groups.values()) bucket.sort(byUnits);
  rest.sort(byUnits);

  const toGoal = (item: (typeof placed)[number], lead: boolean): GoalRow => ({
    id: item.row.id,
    name: item.row.label,
    units: item.row.units,
    target: item.row.paceUnits,
    hue: item.place ? hueKey(item.place.project) : "",
    lead,
    solid: true,
  });
  const grouped = PROJECT_DISPLAY_ORDER.map((name) => {
    const items = groups.get(projectKey(name)) ?? [];
    return { key: projectKey(name), rows: items.map((item, index) => toGoal(item, index === 0)) };
  }).filter((group) => group.rows.length > 0);
  const loose = rest.map((item) => toGoal(item, false));
  const rows = [...grouped.flatMap((group) => group.rows), ...loose];
  if (rows.length === 0) return null;
  const axis = axisOf(rows, "u");
  const marks = gridMarks(axis.scale);
  const line = (row: GoalRow) => <GoalLine key={row.id} row={row} axis={axis} mode="u" />;
  const bands = loose.length > 0 ? grouped.length + 1 : grouped.length;

  return (
    <div className={`${styles.goalFrame} ${styles.goalFrameGrouped}`}>
      <GoalScale marks={marks} scale={axis.scale} span={bands} />
      {grouped.map((group, index) => (
        <div key={group.key} className={styles.projectGroup} style={{ gridRow: index + 1 }}>
          {group.rows.map(line)}
        </div>
      ))}
      {loose.length > 0 ? (
        <div className={styles.projectGroup} style={{ gridRow: grouped.length + 1 }}>
          {loose.map(line)}
        </div>
      ) : null}
    </div>
  );
}

export function StatusAsesorBlock({
  status,
  totales,
}: {
  status: StatusVista;
  totales: TotalesVista | null;
}) {
  return (
    <section className={`${styles.block} ${styles.panel}`} aria-labelledby="vt-status-asesor-title">
      <div className={styles.bandHead}>
        <h2 id="vt-status-asesor-title" className={styles.panelTitle}>Status por asesor</h2>
      </div>
      <StatusAsesorRows status={status} totales={totales} />
    </section>
  );
}
