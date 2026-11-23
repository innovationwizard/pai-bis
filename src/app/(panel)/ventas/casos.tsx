"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CasoMark, CasoProject, CasoVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import chrome from "./desistimientos.module.css";
import local from "./descuentos.module.css";

const moneyFormat = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 0,
});
const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

function money(value: number): string {
  return moneyFormat.format(value);
}

function count(value: number): string {
  return countFormat.format(value);
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

function amountText(gtq: number | null): string {
  return gtq == null ? "" : ` · ${money(gtq)}`;
}

function markLine(mark: CasoMark): string {
  return `${mark.project} · ${mark.torre} · ${mark.unit} · ${dotted(mark.saleOn)} · ${mark.reason}${amountText(mark.gtq)}`;
}

function drawerLine(mark: CasoMark): string {
  return `${mark.unit} · ${dotted(mark.saleOn)} · ${mark.reason}${amountText(mark.gtq)}`;
}

type Column = {
  key: string;
  name: string;
  units: number;
  hue: string;
  marks: CasoMark[];
};

function scaleOf(values: readonly number[]): number {
  const peak = values.reduce((max, value) => Math.max(max, value), 0);
  return peak > 0 ? peak * 1.14 : 1;
}

function Columns({
  columns,
  scale,
  level,
  label,
  openKey,
  onOpen,
}: {
  columns: readonly Column[];
  scale: number;
  level: "project" | "asesor";
  label: string;
  openKey: string | null;
  onOpen: (column: Column) => void;
}) {
  return (
    <div className={band.ogCols} data-level={level} role="group" aria-label={label}>
      {columns.map((column) => {
        const height = (Math.max(0, column.units) / scale) * 100;
        const text = count(column.units);
        const open = openKey === column.key;
        return (
          <button
            key={column.key}
            type="button"
            className={`${band.ogCol} ${chrome.hit}`}
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
                    className={band.ogBar}
                    data-project={column.hue || undefined}
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

export function ControlCasos({
  vista,
  pending,
}: {
  vista: CasoVista | null;
  pending: ReactNode;
}) {
  const board = vista?.board ?? null;
  const projects = board?.projects ?? [];
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [proof, setProof] = useState<{ key: string; lines: string[] } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openProject = projects.find((project) => project.slug === openSlug) ?? null;
  const heroScale = scaleOf(projects.map((project) => project.units));
  const towerScale = scaleOf(projects.flatMap((project) => project.towers.map((tower) => tower.units)));

  useEffect(() => {
    if (openSlug && !projects.some((project) => project.slug === openSlug)) setOpenSlug(null);
  }, [openSlug, projects]);

  useEffect(() => {
    if (!openProject && !proof) return;
    if (openProject) closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenSlug(null);
      setProof(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openProject, proof]);

  function show(key: string, marks: readonly CasoMark[]) {
    const lines = [...marks]
      .sort((a, b) => a.torre.localeCompare(b.torre, "es") || a.unit.localeCompare(b.unit, "es", { numeric: true }))
      .map(markLine);
    setProof((current) => (current?.key === key ? null : { key, lines }));
  }

  function openDrawer(project: CasoProject) {
    setProof(null);
    setOpenSlug(project.slug);
  }

  return (
    <section id="ff-y-casos-especiales" className={band.block} aria-labelledby="vt-casos-title">
      <h2 id="vt-casos-title" className={chrome.title}>F&F y casos especiales</h2>
      {vista?.notice ? <p className={chrome.notice}>{vista.notice}</p> : null}
      {!board ? pending : (
        <div className={band.fold}>
          <div className={`${band.top} ${band.overview}`}>
            <div className={band.rail}>
              <div className={band.kpi}>
                <span className={band.kpiName}>Todos los Proyectos</span>
                <button
                  type="button"
                  className={chrome.value}
                  onClick={() => show("todos", projects.flatMap((project) => project.marks))}
                >
                  {count(board.units)}
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
                    hue: hueKey(project.label),
                    marks: project.marks,
                  }))}
                  scale={heroScale}
                  level="project"
                  label="Proyectos"
                  openKey={openSlug}
                  onOpen={(column) => {
                    const project = projects.find((item) => item.slug === column.key);
                    if (project) openDrawer(project);
                  }}
                />
              ) : null}
            </div>
          </div>
          {projects.length > 0 ? (
            <div className={band.projects}>
              {projects.map((project) => (
                <div key={project.slug} className={`${band.top} ${chrome.band}`}>
                  <div className={band.rail}>
                    <div className={band.kpi}>
                      <span className={band.kpiName}>{project.label}</span>
                      <button
                        type="button"
                        className={chrome.value}
                        onClick={() => show(project.slug, project.marks)}
                      >
                        {count(project.units)}
                      </button>
                    </div>
                  </div>
                  <div className={`${band.hero} ${band.ogCard}`}>
                    <Columns
                      columns={project.towers.map((tower) => ({
                        key: `${project.slug}:${tower.label}`,
                        name: tower.label,
                        units: tower.units,
                        hue: hueKey(project.label),
                        marks: tower.marks,
                      }))}
                      scale={towerScale}
                      level="asesor"
                      label={`Torres de ${project.label}`}
                      openKey={proof?.key ?? null}
                      onOpen={(column) => show(column.key, column.marks)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {proof ? (
        <div className={chrome.proof} role="dialog" aria-label="Casos">
          <button type="button" onClick={() => setProof(null)}>Cerrar</button>
          {proof.lines.length > 0 ? (
            <ul>
              {proof.lines.map((line, index) => <li key={`${index}:${line}`}>{line}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
      {openProject ? (
        <aside className={local.drawer} role="dialog" aria-label={openProject.label}>
          <div className={local.drawerHead}>
            <h3>{openProject.label}</h3>
            <button ref={closeRef} type="button" onClick={() => setOpenSlug(null)}>Cerrar</button>
          </div>
          {openProject.marks.length > 0 ? (
            <ul className={local.list}>
              {openProject.marks.map((mark, index) => <li key={`${index}:${mark.unit}:${mark.reason}`}>{drawerLine(mark)}</li>)}
            </ul>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}
