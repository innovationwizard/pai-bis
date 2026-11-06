"use client";

import { projectById, readoutFor } from "./format";
import { advisorFill, markOpacity, PROJECT_HUE, visibleProjects } from "./model";
import { useRove } from "./motion";
import type { Target } from "./state";
import styles from "./centro.module.css";

type Handlers = {
  spotlight: Target | null;
  focusProjectId: string | null;
  selected: readonly string[];
  onProject: (projectId: string, shift: boolean) => void;
  onAdvisor: (advisorId: string, projectId: string) => void;
  onHover: (target: Target | null) => void;
  onKbd: (target: Target | null) => void;
};

type Column = {
  key: string;
  name: string;
  reservas: number;
  fill: string;
  target: Target;
};

export default function VerticalBars(handlers: Handlers) {
  const focus = handlers.focusProjectId ? projectById(handlers.focusProjectId) : null;
  const columns: Column[] = focus
    ? focus.advisors.map((advisor, index) => ({
        key: advisor.id,
        name: advisor.name,
        reservas: advisor.reservas,
        fill: advisorFill(focus.id, index),
        target: { kind: "advisor", projectId: focus.id, advisorId: advisor.id },
      }))
    : visibleProjects(null, handlers.selected).map((project) => ({
        key: project.id,
        name: project.label,
        reservas: project.reservas,
        fill: PROJECT_HUE[project.id] ?? "#0d2041",
        target: { kind: "project", projectId: project.id },
      }));
  const peak = columns.reduce((max, column) => Math.max(max, column.reservas), 1);
  const rove = useRove<HTMLButtonElement>(columns.length, focus?.id ?? handlers.selected.join("|"));

  return (
    <div
      className={styles.vbars}
      role="group"
      aria-label={focus ? `Asesores de ${focus.label}` : "Proyectos"}
    >
      {columns.map((column, index) => {
        const fade = markOpacity(
          {
            kind: column.target.kind,
            projectId: column.target.kind === "total" ? null : column.target.projectId,
            advisorId: column.target.kind === "advisor" ? column.target.advisorId : null,
          },
          handlers.spotlight,
          handlers.focusProjectId,
          handlers.selected,
        );
        return (
          <button
            key={column.key}
            ref={(node) => {
              rove.refs.current[index] = node;
            }}
            type="button"
            className={`${styles.vcol} ${styles.mark}`}
            style={{ opacity: fade }}
            tabIndex={rove.index === index ? 0 : -1}
            aria-label={readoutFor(column.target)}
            aria-pressed={column.target.kind === "project" && column.target.projectId === handlers.focusProjectId}
            onMouseEnter={() => handlers.onHover(column.target)}
            onFocus={() => {
              rove.setIndex(index);
              handlers.onKbd(column.target);
            }}
            onBlur={() => handlers.onKbd(null)}
            onClick={(event) => {
              if (column.target.kind === "project") handlers.onProject(column.target.projectId, event.shiftKey);
              else if (column.target.kind === "advisor") handlers.onAdvisor(column.target.advisorId, column.target.projectId);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.shiftKey && column.target.kind === "project") {
                event.preventDefault();
                handlers.onProject(column.target.projectId, true);
                return;
              }
              rove.onKeyDown(event, index);
            }}
          >
            <span className={styles.vval}>{column.reservas}</span>
            <span className={styles.vplot}>
              <span
                className={styles.vbar}
                style={{ height: `${(column.reservas / peak) * 100}%`, background: column.fill }}
              />
            </span>
            <span className={styles.vname}>{column.name}</span>
          </button>
        );
      })}
    </div>
  );
}
