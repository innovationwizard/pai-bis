"use client";

import type { ReactNode } from "react";
import type { ReferidosVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import styles from "./referidos.module.css";

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

function count(value: number): string {
  return countFormat.format(value);
}

function Columns({
  columns,
  peak,
  label,
}: {
  columns: readonly { key: string; name: string; units: number }[];
  peak: number;
  label: string;
}) {
  return (
    <div className={styles.cols} role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))` }}>
      {columns.map((column) => (
        <div key={column.key} className={styles.col} aria-label={`${column.name}: ${count(column.units)}`}>
          <span className={styles.num}>{count(column.units)}</span>
          <span className={styles.plot} aria-hidden="true">
            <span className={styles.fill} style={{ height: `${peak > 0 ? (column.units / peak) * 100 : 0}%` }} />
          </span>
          <span className={styles.name}>{column.name}</span>
        </div>
      ))}
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
  const total = vista?.si ?? 0;
  const projects = vista?.board ?? [];
  const peak = Math.max(1, ...projects.map((project) => project.units));
  const memberPeak = Math.max(1, ...projects.flatMap((project) => project.tipos.map((tipo) => tipo.units)));
  return (
    <section id="control-referidos" className={band.block} aria-labelledby="vt-referidos-title">
      <h2 id="vt-referidos-title" className={band.srOnly}>Control Referidos</h2>
      {vista == null ? pending : (
        <div className={band.fold}>
          <div className={`${band.top} ${band.overview}`}>
            <div className={band.rail}>
              <div className={band.kpi} aria-label={`Todos los Proyectos: ${count(total)}`}>
                <span className={band.kpiName}>Todos los Proyectos</span>
                <span className={styles.figure}>{count(total)}</span>
              </div>
            </div>
            <div className={band.hero}>
              <Columns
                label="Proyectos"
                peak={peak}
                columns={projects.map((project) => ({ key: project.id, name: project.label, units: project.units }))}
              />
            </div>
          </div>
          {projects.length > 0 ? (
            <div className={band.projects}>
              {projects.map((project) => (
                <div key={project.id} className={band.top}>
                  <div className={band.rail}>
                    <div className={band.kpi} aria-label={`${project.label}: ${count(project.units)}`}>
                      <span className={band.kpiName}>{project.label}</span>
                      <span className={styles.figure}>{count(project.units)}</span>
                    </div>
                  </div>
                  <div className={band.hero}>
                    <Columns
                      label={`Tipos de ${project.label}`}
                      peak={memberPeak}
                      columns={project.tipos.map((tipo) => ({
                        key: `${project.id}:${tipo.id}`,
                        name: tipo.label,
                        units: tipo.units,
                      }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
