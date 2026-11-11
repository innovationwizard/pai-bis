"use client";

import { useState, type ReactNode } from "react";
import { compareProjectLabels } from "@/lib/projects";
import type { FunnelStage, MeasureRow, ObjetivosVista, TotalesVista } from "@/lib/ventas/vista-types";
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

function inBarChart(label: string): boolean {
  const folded = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (folded.includes("casa elisa")) return false;
  if (folded.includes("coban")) return false;
  return true;
}

function chartProjects(objetivos: ObjetivosVista | null): ProjectBar[] {
  return projectsOf(objetivos).filter((project) => inBarChart(project.label));
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

export function AsesoresBlock({ totales, objetivos, objetivosError }: Omit<Props, "totalesError">) {
  const stage = reservaStage(totales);
  const projects = projectsOf(objetivos);
  return (
    <section className={`${styles.block} ${styles.panel}`} aria-labelledby="vt-asesores-title">
      <h2 id="vt-asesores-title" className={styles.panelTitle}>Asesores</h2>
      {!objetivos && objetivosError ? <p className={styles.warn}>{objetivosError}</p> : null}
      {!objetivos && !objetivosError ? <p className={styles.caption}>Cargando…</p> : null}
      {objetivos ? (
        <>
          {objetivos.caption && !objetivos.caption.includes("¿") ? <p className={styles.caption}>{objetivos.caption}</p> : null}
          {objetivos.notice ? <p className={styles.caption}>{objetivos.notice}</p> : null}
          {totales?.targetNote ? <p className={styles.caption}>{totales.targetNote}</p> : null}
          {rosterAsesores(objetivos).length === 0 ? (
            <p className={styles.caption}>Sin asesores en este periodo.</p>
          ) : (
            <AsesorRows objetivos={objetivos} stage={stage} projects={projects} />
          )}
        </>
      ) : null}
    </section>
  );
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
  const rows = rosterAsesores(objetivos).sort((a, b) => b.units - a.units || a.label.localeCompare(b.label, "es"));
  const scale = rows.reduce((max, row) => Math.max(max, row.units, row.targetUnits ?? 0), 1);
  const seenProjects = new Set<string>();
  const painted = rows.map((row) => {
    const place = singleProject(row.label, row.units, stage, projects);
    const hue = place ? hueKey(place.project) : "";
    const lead = hue.length > 0 && !seenProjects.has(hue);
    if (hue) seenProjects.add(hue);
    return { row, place, hue, lead };
  });
  return (
    <div className={styles.rankList}>
      {painted.map(({ row, place, hue, lead }) => {
        const gap = row.gapUnits;
        return (
          <div key={row.id} className={styles.row}>
            <span className={styles.rowName}>
              {row.label}
              {place ? <span className={styles.rowProject}>{place.project}</span> : null}
            </span>
            <span className={styles.track} aria-hidden="true">
              <span
                className={styles.barFill}
                data-project={hue || undefined}
                data-lead={lead ? "true" : undefined}
                style={{ width: widthOf(row.units, scale) }}
              />
              {row.targetUnits != null ? <span className={styles.tickMark} style={{ left: widthOf(row.targetUnits, scale) }} /> : null}
            </span>
            <span className={styles.rowMeta}>
              {whole(row.units)}
              <span> · {shareText(row.units, objetivos.units)} del total</span>
              {place ? <span> · {shareText(row.units, place.projectUnits)} de {place.project}</span> : null}
              {row.targetUnits != null ? (
                <>
                  <span> · meta {whole(row.targetUnits)}</span>
                  {gap != null ? <span className={toneClass(gap)}>{signedWhole(gap)}</span> : null}
                </>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
