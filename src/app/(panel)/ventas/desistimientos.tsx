"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DesistenciaCase, DesistenciaVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import local from "./desistimientos.module.css";

const moneyFormat = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 0,
});
const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

type Series = "u" | "q";

function money(value: number): string {
  return moneyFormat.format(value);
}

function count(value: number): string {
  return countFormat.format(value);
}

function figure(series: Series, units: number, gtq: number): string {
  return series === "u" ? count(units) : money(gtq);
}

function hueKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dotted(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function caseLine(row: DesistenciaCase): string {
  const value = row.gtq == null ? "sin valor" : money(row.gtq);
  return `${row.project} · ${row.torre} · ${row.unit} · ${dotted(row.lostOn)} · ${value}`;
}

type Column = {
  key: string;
  name: string;
  units: number;
  gtq: number;
  hue: string;
  cases: DesistenciaCase[];
};

function scaleOf(values: readonly number[]): number {
  const peak = values.reduce((max, value) => Math.max(max, value), 0);
  return peak > 0 ? peak * 1.14 : 1;
}

function Columns({
  columns,
  series,
  scale,
  level,
  label,
  openKey,
  onOpen,
}: {
  columns: readonly Column[];
  series: Series;
  scale: number;
  level: "project" | "asesor";
  label: string;
  openKey: string | null;
  onOpen: (column: Column) => void;
}) {
  return (
    <div className={band.ogCols} data-level={level} role="group" aria-label={label}>
      {columns.map((column) => {
        const value = series === "u" ? column.units : column.gtq;
        const height = (Math.max(0, value) / scale) * 100;
        const text = figure(series, column.units, column.gtq);
        const open = openKey === column.key;
        return (
          <button
            key={column.key}
            type="button"
            className={`${band.ogCol} ${local.hit}`}
            data-open={open ? "true" : "false"}
            aria-pressed={open}
            aria-label={`${column.name}: ${text}`}
            onClick={() => onOpen(column)}
          >
            <span className={band.ogColBody}>
              <span className={band.ogPlotWrap}>
                <span className={band.ogPlot}>
                  <span className={band.ogNum} style={{ bottom: `calc(${height}% + 2px)` }}>{text}</span>
                  <span
                    className={`${band.ogBar} ${series === "q" ? local.seriesQ : ""}`}
                    data-project={column.hue || undefined}
                    data-series={series}
                    style={{ height: `${height}%` }}
                  />
                </span>
              </span>
            </span>
            <span className={band.ogName}>{column.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Desistimientos({
  vista,
  pending,
}: {
  vista: DesistenciaVista | null;
  pending: ReactNode;
}) {
  const board = vista?.board ?? null;
  const projects = board?.projects ?? [];
  const [series, setSeries] = useState<Series>("u");
  const [proof, setProof] = useState<{ key: string; lines: string[] } | null>(null);
  const heroScale = scaleOf(projects.map((project) => (series === "u" ? project.units : project.gtq)));
  const towerScale = scaleOf(projects.flatMap((project) => project.towers.map((tower) => (series === "u" ? tower.units : tower.gtq))));

  useEffect(() => {
    if (!proof) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setProof(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [proof]);

  function show(key: string, cases: readonly DesistenciaCase[]) {
    const lines = [...cases]
      .sort((a, b) => a.torre.localeCompare(b.torre, "es") || a.unit.localeCompare(b.unit, "es", { numeric: true }))
      .map(caseLine);
    setProof((current) => (current?.key === key ? null : { key, lines }));
  }

  function choose(next: Series) {
    setSeries(next);
    setProof(null);
  }

  return (
    <section id="desistimientos" className={band.block} aria-labelledby="vt-desist-title">
      <h2 id="vt-desist-title" className={local.title}>Desistimientos</h2>
      {vista?.notice ? <p className={local.notice}>{vista.notice}</p> : null}
      {!board ? pending : (
        <>
          <div className={local.toggleRow}>
            <div className={local.toggle} role="group" aria-label="Unidades o quetzales">
              <button type="button" aria-pressed={series === "u"} onClick={() => choose("u")}>U</button>
              <button type="button" aria-pressed={series === "q"} onClick={() => choose("q")}>Q</button>
            </div>
          </div>
          <div className={band.fold}>
            <div className={`${band.top} ${band.overview}`}>
              <div className={band.rail}>
                <div className={band.kpi}>
                  <span className={band.kpiName}>Todos los Proyectos</span>
                  <button
                    type="button"
                    className={local.value}
                    onClick={() => show("todos", projects.flatMap((project) => project.cases))}
                  >
                    {figure(series, board.units, board.gtq)}
                  </button>
                </div>
              </div>
              <div className={`${band.hero} ${band.ogCard}`}>
                {projects.length > 0 ? (
                  <Columns
                    columns={projects.map((project) => ({
                      key: project.slug,
                      name: project.label,
                      units: project.units,
                      gtq: project.gtq,
                      hue: hueKey(project.label),
                      cases: project.cases,
                    }))}
                    series={series}
                    scale={heroScale}
                    level="project"
                    label="Proyectos"
                    openKey={proof?.key ?? null}
                    onOpen={(column) => show(column.key, column.cases)}
                  />
                ) : null}
              </div>
            </div>
            {projects.length > 0 ? (
              <div className={band.projects}>
                {projects.map((project) => (
                  <div key={project.slug} className={`${band.top} ${local.band}`}>
                    <div className={band.rail}>
                      <div className={band.kpi}>
                        <span className={band.kpiName}>{project.label}</span>
                        <button
                          type="button"
                          className={local.value}
                          onClick={() => show(project.slug, project.cases)}
                        >
                          {figure(series, project.units, project.gtq)}
                        </button>
                      </div>
                    </div>
                    <div className={`${band.hero} ${band.ogCard}`}>
                      <Columns
                        columns={project.towers.map((tower) => ({
                          key: `${project.slug}:${tower.label}`,
                          name: tower.label,
                          units: tower.units,
                          gtq: tower.gtq,
                          hue: hueKey(project.label),
                          cases: tower.cases,
                        }))}
                        series={series}
                        scale={towerScale}
                        level="asesor"
                        label={`Torres de ${project.label}`}
                        openKey={proof?.key ?? null}
                        onOpen={(column) => show(column.key, column.cases)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
      {proof ? (
        <div className={local.proof} role="dialog" aria-label="Casos">
          <button type="button" onClick={() => setProof(null)}>Cerrar</button>
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
