"use client";

import { useMemo, useState } from "react";
import { FIXTURE } from "./fixture";
import { findAdvisor, fixtureCsv, formatPct, previousOf } from "./format";
import { Ticks, trapTab } from "./frame";
import styles from "./centro.module.css";

export function Drawer({
  advisorId,
  onClose,
  labelledBy,
}: {
  advisorId: string;
  onClose: () => void;
  labelledBy?: string;
}) {
  const found = findAdvisor(advisorId);
  return (
    <>
      <button type="button" className={styles.backdrop} aria-label="Cerrar ficha" onClick={onClose} />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cdm-drawer-title"
        onKeyDown={trapTab}
      >
        <Ticks />
        {found ? (
          <>
            <p className={styles.caption}>{found.project.label}</p>
            <div className={styles.drawerHead}>
              <h2 id="cdm-drawer-title">{found.advisor.name}</h2>
              <button type="button" className={styles.btn} data-autofocus="drawer" onClick={onClose}>
                Cerrar
              </button>
            </div>
            <p className={styles.caption}>No es un dato en vivo.</p>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th scope="row">Proyecto</th>
                  <td>{found.project.label}</td>
                </tr>
                <tr>
                  <th scope="row">Reservas</th>
                  <td className={styles.num}>{found.advisor.reservas}</td>
                </tr>
                <tr>
                  <th scope="row">Porcentaje del proyecto</th>
                  <td className={styles.num} title="derivado">
                    {formatPct(found.advisor.reservas, found.project.reservas)}
                    <span className={styles.tag}>derivado</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Porcentaje del total</th>
                  <td className={styles.num} title="derivado">
                    {formatPct(found.advisor.reservas, FIXTURE.total.reservas)}
                    <span className={styles.tag}>derivado</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Mes anterior</th>
                  <td>n/d</td>
                </tr>
                <tr>
                  <th scope="row">Meta</th>
                  <td>n/d</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p>No está en los datos.</p>
        )}
        {labelledBy ? <span className={styles.srOnly}>{labelledBy}</span> : null}
      </aside>
    </>
  );
}

export function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.modal}>
      <div
        className={styles.helpCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cdm-help-title"
        onKeyDown={trapTab}
      >
        <Ticks />
        <div className={styles.drawerHead}>
          <h2 id="cdm-help-title">Atajos</h2>
          <button type="button" className={styles.btn} data-autofocus="ayuda" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <ul className={styles.helpList}>
          <li><kbd>?</kbd> abre y cierra esta ayuda.</li>
          <li>Flechas: moverse entre elementos del mismo grupo.</li>
          <li>Enter: acercar un proyecto o abrir un asesor.</li>
          <li>Esc: alejar, o cerrar la ficha y los paneles.</li>
          <li>Clic con Mayús: seleccionar varios proyectos.</li>
        </ul>
        <p className={styles.caption}>No es un dato en vivo.</p>
      </div>
    </div>
  );
}

export function Origen({ onClose }: { onClose: () => void }) {
  const csv = useMemo(() => fixtureCsv(), []);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "error">("idle");

  async function copyTable() {
    try {
      await navigator.clipboard.writeText(csv);
      setCopyState("ok");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className={styles.modal}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cdm-origen-title"
        onKeyDown={trapTab}
      >
        <Ticks />
        <div className={styles.drawerHead}>
          <h2 id="cdm-origen-title">Origen de los datos</h2>
          <button type="button" className={styles.btn} data-autofocus="origen" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <p className={styles.caption}>
          {FIXTURE.badge}. Pipedrive Insights. No es una consulta en vivo.
        </p>
        <dl className={styles.filters}>
          <dt>Periodo</dt>
          <dd>{FIXTURE.period} ({FIXTURE.month})</dd>
          <dt>Métrica</dt>
          <dd>{FIXTURE.metric}</dd>
          <dt>Tipo de actividad</dt>
          <dd>{FIXTURE.activity}</dd>
          <dt>Estado</dt>
          <dd>{FIXTURE.status}</dd>
          <dt>Embudos</dt>
          <dd>{FIXTURE.pipelines.join(", ")}</dd>
        </dl>
        {FIXTURE.projects.map((project) => (
          <section key={project.id} className={styles.filterBlock}>
            <h3>{project.label}</h3>
            <p className={styles.caption}>Etiqueta SSOT: {project.ssotLabel}. Embudos: {project.pipelines.join(", ")}.</p>
            <ul className={styles.filterNames}>
              {project.advisorFilter.map((name) => {
                const barred = project.advisors.some((advisor) => advisor.name === name);
                return (
                  <li key={name}>
                    {name}
                    {barred ? "" : " · sin barra"}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <p className={styles.caption}>
          Bosque Las Tapias muestra 0 0. El cambio se lee como 0 y el porcentaje como 0.
        </p>
        <p className={styles.caption}>
          Mes anterior, derivado: total {previousOf(FIXTURE.total.reservas, FIXTURE.total.change)}
          {FIXTURE.projects.map((project) => `; ${project.label} ${previousOf(project.reservas, project.change)}`)}.
        </p>
        <div className={styles.tools}>
          <button type="button" className={styles.btn} onClick={() => void copyTable()}>
            {copyState === "ok" ? "Copiado" : "Copiar tabla CSV"}
          </button>
        </div>
        {copyState === "error" ? (
          <>
            <p className={styles.caption}>No se pudo copiar. El texto de la tabla queda abajo.</p>
            <textarea className={styles.csv} readOnly value={csv} aria-label="Tabla CSV" />
          </>
        ) : null}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Etiqueta SSOT</th>
              <th>Reservas</th>
              <th>Cambio frente al mes anterior</th>
              <th>Asesores</th>
            </tr>
          </thead>
          <tbody>
            {FIXTURE.projects.map((project) => (
              <tr key={project.id}>
                <td>{project.label}</td>
                <td>{project.ssotLabel}</td>
                <td className={styles.num}>{project.reservas}</td>
                <td>{project.changeLabel}</td>
                <td>{project.advisors.map((advisor) => `${advisor.name} ${advisor.reservas}`).join("; ")}</td>
              </tr>
            ))}
            <tr>
              <td>Total</td>
              <td>General</td>
              <td className={styles.num}>{FIXTURE.total.reservas}</td>
              <td>{FIXTURE.total.changeLabel}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
