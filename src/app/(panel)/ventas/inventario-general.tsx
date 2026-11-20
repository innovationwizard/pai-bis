"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { UNIT_STATUS_COLORS, UNIT_STATUS_LABELS } from "@/lib/reservas/constants";
import type { RvUnitStatus } from "@/lib/reservas/types";
import type {
  InventarioVista,
  InventoryBoard,
  InventoryCounts,
  InventoryProject,
  InventoryStatusKey,
  InventoryTower,
} from "@/lib/ventas/vista-types";
import styles from "./inventario-general.module.css";

const NAVY = "#0d2041";
const TITLE = "Inventario general";

const STATUSES: { key: InventoryStatusKey; status: RvUnitStatus }[] = [
  { key: "disponible", status: "AVAILABLE" },
  { key: "revision", status: "SOFT_HOLD" },
  { key: "reservado", status: "RESERVED" },
  { key: "congelado", status: "FROZEN" },
  { key: "vendido", status: "SOLD" },
];

const WATERFALL: InventoryStatusKey[] = ["congelado", "disponible", "revision", "reservado", "vendido"];

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

type Tip = {
  key: string;
  title: string;
  formula: string;
  scope: string;
  rows: string[];
};

function count(value: number): string {
  return countFormat.format(value);
}

function statusOf(key: InventoryStatusKey): { status: RvUnitStatus; label: string; color: string } {
  const found = STATUSES.find((item) => item.key === key);
  const status = found?.status ?? "AVAILABLE";
  return { status, label: UNIT_STATUS_LABELS[status], color: UNIT_STATUS_COLORS[status] };
}

function scaleOf(projects: readonly InventoryProject[]): number {
  let peak = 0;
  for (const project of projects) {
    for (const tower of project.towers) peak = Math.max(peak, tower.counts.total);
  }
  return peak > 0 ? peak : 1;
}

function linesFor(projects: readonly InventoryProject[], status: InventoryStatusKey | null): string[] {
  const lines: string[] = [];
  for (const project of projects) {
    for (const tower of project.towers) {
      for (const unit of tower.units) {
        if (status && unit.status !== status) continue;
        lines.push(`${project.label} · ${tower.label} · ${unit.code}`);
      }
    }
  }
  return lines;
}

function formulaFor(status: InventoryStatusKey | null): string {
  if (!status) {
    return "Suma de unidades en v_rv_units_full con estado Disponible, En revisión, Reservado, Congelado o Vendido.";
  }
  const item = statusOf(status);
  return `Unidades en v_rv_units_full con estado ${item.label} (${item.status}).`;
}

function StatusList({
  counts,
  includeTotal,
  onOpen,
}: {
  counts: InventoryCounts;
  includeTotal: boolean;
  onOpen: (status: InventoryStatusKey | null) => void;
}) {
  const ceiling = counts.total > 0 ? counts.total : 1;
  const rows: { key: string; label: string; value: number; color: string; status: InventoryStatusKey | null; start: number; summary: boolean }[] = [];
  let start = 0;
  for (const key of WATERFALL) {
    const item = STATUSES.find((entry) => entry.key === key);
    if (!item) continue;
    const value = counts[key];
    rows.push({
      key,
      label: UNIT_STATUS_LABELS[item.status],
      value,
      color: UNIT_STATUS_COLORS[item.status],
      status: key,
      start,
      summary: false,
    });
    start += value;
  }
  if (includeTotal) {
    rows.push({ key: "total", label: "Total", value: counts.total, color: NAVY, status: null, start: 0, summary: true });
  }
  return (
    <ul className={styles.statusList}>
      {rows.map((row) => {
        const width = row.summary ? (row.value > 0 ? 100 : 0) : (row.value / ceiling) * 100;
        const left = row.summary ? 0 : (row.start / ceiling) * 100;
        return (
          <li key={row.key}>
            <span className={styles.statusName}>{row.label}</span>
            <button type="button" className={styles.statusTrack} onClick={() => onOpen(row.status)}>
              <span className={styles.statusPlot}>
                <span
                  className={styles.statusBar}
                  style={{ left: `${left}%`, width: `${width}%`, background: row.color }}
                />
              </span>
              <span className={styles.statusCount} style={{ color: row.color }}>{count(row.value)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TowerRows({
  project,
  scale,
  onOpen,
}: {
  project: InventoryProject;
  scale: number;
  onOpen: (tower: InventoryTower, status: InventoryStatusKey) => void;
}) {
  return (
    <div className={styles.towers}>
      {project.towers.map((tower) => (
        <div key={`${project.slug}:${tower.label}`} className={styles.tower}>
          <span className={styles.towerName}>{tower.label}</span>
          <div className={styles.track} aria-hidden="true">
            {STATUSES.map((item) => {
              const value = tower.counts[item.key];
              if (value <= 0) return null;
              return (
                <span
                  key={item.key}
                  className={styles.seg}
                  style={{ width: `${(value / scale) * 100}%`, background: UNIT_STATUS_COLORS[item.status] }}
                />
              );
            })}
          </div>
          <div className={styles.nums}>
            {STATUSES.map((item) => (
              <button
                key={item.key}
                type="button"
                style={{ color: UNIT_STATUS_COLORS[item.status] }}
                aria-label={`${project.label}, ${tower.label}, ${UNIT_STATUS_LABELS[item.status]}: ${count(tower.counts[item.key])}`}
                onClick={() => onOpen(tower, item.key)}
              >
                {count(tower.counts[item.key])}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InventarioGeneral({
  vista,
  pending,
}: {
  vista: InventarioVista | null;
  pending: ReactNode;
}) {
  const board: InventoryBoard | null = vista?.board ?? null;
  const projects = board?.projects ?? [];
  const scale = useMemo(() => scaleOf(projects), [projects]);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    setTip(null);
  }, [board]);

  useEffect(() => {
    if (!tip) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setTip(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tip]);

  function toggle(next: Tip) {
    setTip((current) => (current?.key === next.key ? null : next));
  }

  function openScope(status: InventoryStatusKey | null, place: string, source: readonly InventoryProject[]) {
    const name = status ? statusOf(status).label : "Total";
    const value = status
      ? source.reduce((sum, project) => sum + project.counts[status], 0)
      : source.reduce((sum, project) => sum + project.counts.total, 0);
    const key = `${place}:${status ?? "total"}`;
    toggle({
      key,
      title: place === "todos" ? `${name} ${count(value)}` : `${place} · ${name} ${count(value)}`,
      formula: formulaFor(status),
      scope: board?.scope ?? "",
      rows: linesFor(source, status),
    });
  }

  function openTower(project: InventoryProject, tower: InventoryTower, status: InventoryStatusKey) {
    const item = statusOf(status);
    toggle({
      key: `${project.slug}:${tower.label}:${status}`,
      title: `${project.label} · ${tower.label} · ${item.label} ${count(tower.counts[status])}`,
      formula: formulaFor(status),
      scope: board?.scope ?? "",
      rows: tower.units.filter((unit) => unit.status === status).map((unit) => `${project.label} · ${tower.label} · ${unit.code}`),
    });
  }

  return (
    <section id="inventario-general" className={styles.page} aria-labelledby="vt-inventario-title">
      <h2 id="vt-inventario-title" className={styles.title}>{TITLE}</h2>
      {!board ? pending : (
        <>
          <div className={styles.heroBand}>
            <article className={styles.kpi} aria-label="Todos los Proyectos">
              <span className={styles.kpiName}>Todos los Proyectos</span>
              <StatusList
                counts={board.counts}
                includeTotal
                onOpen={(status) => openScope(status, "todos", projects)}
              />
            </article>
            <div className={styles.expanded}>
              <div className={styles.cards}>
                {projects.map((project) => (
                  <article key={project.slug} className={styles.card} aria-label={project.label}>
                    <span className={styles.cardName}>{project.label}</span>
                    <TowerRows project={project} scale={scale} onOpen={(tower, status) => openTower(project, tower, status)} />
                  </article>
                ))}
              </div>
            </div>
          </div>
          {projects.length > 0 ? (
            <div className={styles.bands}>
              {projects.map((project) => (
                <div key={project.slug} className={styles.band}>
                  <article className={styles.kpi} aria-label={project.label}>
                    <span className={styles.kpiName}>{project.label}</span>
                    <StatusList
                      counts={project.counts}
                      includeTotal={false}
                      onOpen={(status) => openScope(status, project.label, [project])}
                    />
                  </article>
                  <div className={styles.detail}>
                    <TowerRows project={project} scale={scale} onOpen={(tower, status) => openTower(project, tower, status)} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {tip ? (
            <div className={styles.tip} role="dialog" aria-label={tip.title}>
              <div className={styles.tipHead}>
                <strong>{tip.title}</strong>
                <button type="button" onClick={() => setTip(null)}>Cerrar</button>
              </div>
              <p>{tip.formula}</p>
              <p>Fuente: v_rv_units_full.status, project_slug, tower_name, unit_number.</p>
              <p>{tip.scope} Sin periodo, sin asesor y sin modelo.</p>
              {tip.rows.length === 0 ? <p>Ninguna unidad.</p> : (
                <ul>
                  {tip.rows.map((row, index) => (
                    <li key={`${index}:${row}`}>{row}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
