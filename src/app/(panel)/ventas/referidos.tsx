"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { REFERIDO_TIPOS, type ReferidoProject, type ReferidosVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import styles from "./tasa.module.css";

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
const COLUMN_HEADROOM = 1.14;

type CountColumn = {
  key: string;
  name: string;
  units: number;
  names: readonly string[];
  hue: string;
};

type DrawerState = {
  key: string;
  title: string;
  names: readonly string[];
};

function activateColumn(event: ReactKeyboardEvent<HTMLDivElement>, action: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
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

function scaleOf(values: readonly number[]): number {
  const peak = values.reduce((max, value) => Math.max(max, value), 0);
  return peak > 0 ? peak * COLUMN_HEADROOM : 1;
}

function tipoColumns(project: ReferidoProject): CountColumn[] {
  const hue = hueKey(project.label);
  const byLabel = new Map(project.tipos.map((tipo) => [tipo.label, tipo]));
  return REFERIDO_TIPOS.map((label) => {
    const tipo = byLabel.get(label);
    return {
      key: `tipo:${project.id}:${label}`,
      name: label,
      units: tipo?.units ?? 0,
      names: tipo?.nombres ?? [],
      hue,
    };
  });
}

function CountColumns({
  columns,
  level,
  label,
  openKey,
  onOpen,
}: {
  columns: readonly CountColumn[];
  level: "project" | "asesor";
  label: string;
  openKey: string | null;
  onOpen: (column: CountColumn) => void;
}) {
  const scale = scaleOf(columns.map((column) => column.units));
  return (
    <div className={band.ogCols} data-level={level} role="group" aria-label={label}>
      {columns.map((column) => {
        const height = (Math.max(0, column.units) / scale) * 100;
        const open = () => onOpen(column);
        return (
          <div
            key={column.key}
            className={`${band.ogCol} ${styles.count}`}
            role="button"
            tabIndex={0}
            aria-pressed={openKey === column.key}
            aria-label={`${column.name}: ${count(column.units)}`}
            onClick={open}
            onKeyDown={(event) => activateColumn(event, open)}
          >
            <div className={band.ogColBody}>
              <div className={band.ogPlotWrap}>
                <div className={band.ogPlot}>
                  <span className={band.ogNum} style={{ bottom: `calc(${height}% + 2px)` }}>{count(column.units)}</span>
                  <span
                    className={band.ogBar}
                    data-project={column.hue || undefined}
                    style={{ height: `${height}%` }}
                  />
                </div>
              </div>
            </div>
            <span className={band.ogName}>{column.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function CountFigure({
  units,
  pressed,
  label,
  onClick,
}: {
  units: number;
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${band.kpiValue} ${styles.count}`}
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
    >
      {count(units)}
    </button>
  );
}

function NameDrawer({
  title,
  names,
  onClose,
}: {
  title: string;
  names: readonly string[];
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="op-overlay">
      <button type="button" className="op-backdrop" aria-label="Cerrar" onClick={onClose} />
      <aside className="op-drawer" role="dialog" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose}>Cerrar</button>
        </header>
        {names.length > 0 ? (
          <ul className="op-history">
            {names.map((name) => <li key={name}>{name}</li>)}
          </ul>
        ) : null}
      </aside>
    </div>
  );
}

export function ReferidosBand({
  vista,
  pending,
}: {
  vista: ReferidosVista | null;
  pending: ReactNode;
}) {
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  useEffect(() => {
    setDrawer(null);
  }, [vista]);

  function openNames(key: string, title: string, names: readonly string[]) {
    setDrawer((current) => (current?.key === key ? null : { key, title, names }));
  }

  const total = vista?.si ?? 0;
  const projects = vista?.byProject ?? [];

  return (
    <section id="control-referidos" className={band.block} aria-labelledby="vt-referidos-title">
      <h2 id="vt-referidos-title" className={styles.title}>Control Referidos</h2>
      {vista == null ? pending : (
        <div className={band.fold}>
          <div className={`${band.top} ${band.overview}`}>
            <div className={band.rail}>
              <div className={band.kpi}>
                <span className={band.kpiName}>Todos los Proyectos</span>
                <CountFigure
                  units={total}
                  pressed={drawer?.key === "todos"}
                  label={`Todos los Proyectos: ${count(total)}`}
                  onClick={() => openNames("todos", "Todos los Proyectos", vista.referidores)}
                />
              </div>
            </div>
            <div className={`${band.hero} ${band.ogCard}`}>
              {projects.length > 0 ? (
                <CountColumns
                  columns={projects.map((project) => ({
                    key: `proyecto:${project.id}`,
                    name: project.label,
                    units: project.units,
                    names: project.nombres,
                    hue: hueKey(project.label),
                  }))}
                  level="project"
                  label="Proyectos"
                  openKey={drawer?.key ?? null}
                  onOpen={(column) => openNames(column.key, column.name, column.names)}
                />
              ) : null}
            </div>
          </div>
          {projects.length > 0 ? (
            <div className={band.projects}>
              {projects.map((project) => (
                <div key={project.id} className={band.top}>
                  <div className={band.rail}>
                    <div className={band.kpi}>
                      <span className={band.kpiName}>{project.label}</span>
                      <CountFigure
                        units={project.units}
                        pressed={drawer?.key === `proyecto:${project.id}`}
                        label={`${project.label}: ${count(project.units)}`}
                        onClick={() => openNames(`proyecto:${project.id}`, project.label, project.nombres)}
                      />
                    </div>
                  </div>
                  <div className={`${band.hero} ${band.ogCard}`}>
                    <CountColumns
                      columns={tipoColumns(project)}
                      level="asesor"
                      label={`Tipos de ${project.label}`}
                      openKey={drawer?.key ?? null}
                      onOpen={(column) => openNames(column.key, `${project.label} · ${column.name}`, column.names)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {drawer ? <NameDrawer key={drawer.key} title={drawer.title} names={drawer.names} onClose={closeDrawer} /> : null}
    </section>
  );
}
