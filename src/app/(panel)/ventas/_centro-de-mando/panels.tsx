"use client";

import type { KeyboardEvent } from "react";
import { FIXTURE, type Project } from "./fixture";
import { formatPct, readoutFor } from "./format";
import {
  BRIDGE,
  COMPARE,
  markOpacity,
  rankMax,
  rankRows,
  type RankRow,
} from "./model";
import { useFlip, useRove } from "./motion";
import type { Target } from "./state";
import styles from "./centro.module.css";

type Handlers = {
  spotlight: Target | null;
  focusProjectId: string | null;
  selected: readonly string[];
  onProject: (projectId: string, shift: boolean) => void;
  onAdvisor: (advisorId: string, projectId: string) => void;
  onTotal: () => void;
  onHover: (target: Target | null) => void;
  onKbd: (target: Target | null) => void;
};

function opacity(mark: { kind: "total" | "project" | "advisor"; projectId: string | null; advisorId: string | null }, handlers: Handlers): number {
  return markOpacity(mark, handlers.spotlight, handlers.focusProjectId, handlers.selected);
}

export function Ranking({
  projects,
  meta,
  ...handlers
}: Handlers & { projects: readonly Project[]; meta: { value: number } | null }) {
  const rows = rankRows(projects);
  const max = rankMax(rows);
  const signature = rows.map((row) => row.advisorId).join("|");
  const flip = useFlip(signature);
  const rove = useRove<HTMLButtonElement>(rows.length, signature);

  return (
    <div className={styles.rankBody}>
      <p id="cdm-rank-sum" className={styles.srOnly}>
        {rows.length === 0
          ? "Sin asesores en la selección."
          : rows.map((row) => `${row.name}, ${row.projectLabel}, ${row.reservas} reservas`).join(". ")}
      </p>
      <div className={styles.rankList} role="group" aria-labelledby="cdm-rank-title" aria-describedby="cdm-rank-sum">
        {rows.map((row, index) => (
          <RankButton
            key={row.advisorId}
            row={row}
            max={max}
            tabIndex={rove.index === index ? 0 : -1}
            opacity={opacity({ kind: "advisor", projectId: row.projectId, advisorId: row.advisorId }, handlers)}
            meta={meta?.value ?? null}
            onRef={(node) => {
              rove.refs.current[index] = node;
              if (node) flip.current.set(row.advisorId, node);
              else flip.current.delete(row.advisorId);
            }}
            onOpen={() => handlers.onAdvisor(row.advisorId, row.projectId)}
            onHover={() => handlers.onHover({ kind: "advisor", projectId: row.projectId, advisorId: row.advisorId })}
            onFocus={() => {
              rove.setIndex(index);
              handlers.onKbd({ kind: "advisor", projectId: row.projectId, advisorId: row.advisorId });
            }}
            onBlur={() => handlers.onKbd(null)}
            onKeyDown={(event) => rove.onKeyDown(event, index)}
          />
        ))}
      </div>
    </div>
  );
}

function RankButton({
  row,
  max,
  tabIndex,
  opacity: fade,
  meta,
  onRef,
  onOpen,
  onHover,
  onFocus,
  onBlur,
  onKeyDown,
}: {
  row: RankRow;
  max: number;
  tabIndex: number;
  opacity: number;
  meta: number | null;
  onRef: (node: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onHover: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const label = readoutFor({ kind: "advisor", projectId: row.projectId, advisorId: row.advisorId });
  return (
    <button
      ref={onRef}
      type="button"
      className={`${styles.row} ${styles.mark}`}
      style={{ opacity: fade }}
      tabIndex={tabIndex}
      aria-label={label}
      onMouseEnter={onHover}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") return;
        onKeyDown(event);
      }}
    >
      <span className={styles.rowTop}>
        <span className={styles.rowName}>{row.name}</span>
        <span className={styles.rowProject} style={{ color: row.fill }}>{row.projectLabel}</span>
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.barFill} style={{ width: `${(row.reservas / max) * 100}%`, background: row.fill }} />
      </span>
      {meta != null ? (
        <span className={styles.bulletRow}>
          <span className={styles.bullet} title="valor ajustable, no es dato del SSOT">
            <span className={styles.bulletFill} style={{ width: `${(row.reservas / 10) * 100}%`, background: row.fill }} />
            <span className={styles.bulletTick} style={{ left: `${(meta / 10) * 100}%` }} />
          </span>
          <span className={row.reservas - meta >= 0 ? styles.up : styles.down}>
            {row.reservas - meta > 0 ? `+${row.reservas - meta}` : String(row.reservas - meta)}
          </span>
        </span>
      ) : null}
      <span className={styles.rowMeta}>
        {row.reservas}
        <span title="derivado"> · {formatPct(row.reservas, FIXTURE.total.reservas)} del total</span>
        <span title="derivado"> · {formatPct(row.reservas, row.projectReservas)} de {row.projectLabel}</span>
      </span>
    </button>
  );
}

export function Waterfall(handlers: Handlers) {
  const rove = useRove<HTMLButtonElement>(BRIDGE.steps.length, "bridge");
  return (
    <div>
      <p id="cdm-bridge-sum" className={styles.srOnly}>
        Puente del mes. Mes anterior {BRIDGE.steps[0]?.valueLabel}, derivado.
        {BRIDGE.steps.map((step) => ` ${step.name} ${step.valueLabel}`).join(".")}.
      </p>
      <div className={styles.bridgeHeads} aria-hidden="true">
        {BRIDGE.steps.map((step) => (
          <span key={step.id} className={styles.bridgeValue} title={step.derived ? "derivado" : undefined}>
            {step.valueLabel}
            {step.derived ? <span className={styles.tag}>derivado</span> : null}
          </span>
        ))}
      </div>
      <div className={styles.bridgePlot} role="group" aria-labelledby="cdm-bridge-title" aria-describedby="cdm-bridge-sum">
        <svg className={styles.bridgeSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {BRIDGE.links.map((d) => (
            <path key={d} d={d} fill="none" stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {BRIDGE.steps.map((step, index) => {
          const target: Target = step.kind === "project" && step.projectId
            ? { kind: "project", projectId: step.projectId }
            : { kind: "total" };
          const fade = opacity(
            { kind: step.kind, projectId: step.projectId, advisorId: null },
            handlers,
          );
          return (
            <button
              key={step.id}
              ref={(node) => {
                rove.refs.current[index] = node;
              }}
              type="button"
              className={`${styles.bridgeHit} ${styles.mark}`}
              style={{ opacity: fade }}
              tabIndex={rove.index === index ? 0 : -1}
              aria-label={readoutFor(target)}
              aria-pressed={step.projectId != null && step.projectId === handlers.focusProjectId}
              onMouseEnter={() => handlers.onHover(target)}
              onFocus={() => {
                rove.setIndex(index);
                handlers.onKbd(target);
              }}
              onBlur={() => handlers.onKbd(null)}
              onClick={(event) => {
                if (step.projectId) handlers.onProject(step.projectId, event.shiftKey);
                else handlers.onTotal();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.shiftKey && step.projectId) {
                  event.preventDefault();
                  handlers.onProject(step.projectId, true);
                  return;
                }
                rove.onKeyDown(event, index);
              }}
            >
              <span
                className={styles.bridgeBar}
                style={
                  step.flat
                    ? { top: 0, height: 2, background: step.fill }
                    : { bottom: `${step.bottomPct}%`, height: `${Math.max(step.heightPct, 0)}%`, background: step.fill }
                }
              />
            </button>
          );
        })}
      </div>
      <div className={styles.bridgeFeet} aria-hidden="true">
        {BRIDGE.steps.map((step) => (
          <span key={step.id}>{step.name}</span>
        ))}
      </div>
    </div>
  );
}

export function Comparison(handlers: Handlers) {
  const rove = useRove<HTMLButtonElement>(COMPARE.length, "compare");
  return (
    <div>
      <p id="cdm-cmp-sum" className={styles.srOnly}>
        Mes pasado contra mes anterior. El mes anterior es derivado.
        {COMPARE.map((col) => ` ${col.name}: ${col.reservas} y ${col.previous}`).join(".")}.
      </p>
      <p className={styles.legend}>
        <span className={styles.swatch} /> Mes pasado
        <span className={styles.swatchGhost} /> Mes anterior <span className={styles.tag} title="derivado">derivado</span>
      </p>
      <div className={styles.cmpPlot} role="group" aria-labelledby="cdm-cmp-title" aria-describedby="cdm-cmp-sum">
        {COMPARE.map((col, index) => {
          const fade = opacity({ kind: "project", projectId: col.projectId, advisorId: null }, handlers);
          return (
            <button
              key={col.projectId}
              ref={(node) => {
                rove.refs.current[index] = node;
              }}
              type="button"
              className={`${styles.cmpHit} ${styles.mark}`}
              style={{ opacity: fade }}
              tabIndex={rove.index === index ? 0 : -1}
              aria-label={readoutFor({ kind: "project", projectId: col.projectId })}
              aria-pressed={col.projectId === handlers.focusProjectId}
              onMouseEnter={() => handlers.onHover({ kind: "project", projectId: col.projectId })}
              onFocus={() => {
                rove.setIndex(index);
                handlers.onKbd({ kind: "project", projectId: col.projectId });
              }}
              onBlur={() => handlers.onKbd(null)}
              onClick={(event) => handlers.onProject(col.projectId, event.shiftKey)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.shiftKey) {
                  event.preventDefault();
                  handlers.onProject(col.projectId, true);
                  return;
                }
                rove.onKeyDown(event, index);
              }}
            >
              <span className={styles.cmpNums}>
                <span>{col.reservas}</span>
                <span title="derivado">{col.previous}</span>
              </span>
              <span className={styles.cmpStage}>
                <span className={styles.ghost} style={{ height: `${col.previousPct}%`, borderColor: col.fill }} />
                <span className={styles.solid} style={{ height: `${col.currentPct}%`, background: col.fill }} />
              </span>
              <span className={styles.cmpName}>{col.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
