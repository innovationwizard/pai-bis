"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
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

const TITLE = "Composición del inventario por estado y por torre";

const STATUSES: { key: InventoryStatusKey; status: RvUnitStatus }[] = [
  { key: "disponible", status: "AVAILABLE" },
  { key: "revision", status: "SOFT_HOLD" },
  { key: "reservado", status: "RESERVED" },
  { key: "congelado", status: "FROZEN" },
  { key: "vendido", status: "SOLD" },
];

const WATERFALL: InventoryStatusKey[] = ["congelado", "disponible", "revision", "reservado", "vendido"];

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
let measureCanvas: HTMLCanvasElement | null = null;

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

function textWidth(text: string, font: string): number {
  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  if (!context) return text.length * 7;
  context.font = font;
  return context.measureText(text).width;
}

function FitPrefix({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const fit = () => {
      const room = Math.max(0, node.clientWidth - 1);
      if (room <= 0) return;
      const style = getComputedStyle(node);
      const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      let length = text.length;
      while (length > 0 && textWidth(text.slice(0, length), font) > room) length -= 1;
      const next = text.slice(0, length);
      setShown((current) => (current === next ? current : next));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);
  return (
    <span ref={ref} className={styles.shortStatus}>
      {shown}
    </span>
  );
}

function statusOf(key: InventoryStatusKey): { status: RvUnitStatus; label: string; color: string } {
  const found = STATUSES.find((item) => item.key === key);
  const status = found?.status ?? "AVAILABLE";
  return { status, label: UNIT_STATUS_LABELS[status], color: UNIT_STATUS_COLORS[status] };
}

function linesFor(projects: readonly InventoryProject[], status: InventoryStatusKey): string[] {
  const lines: string[] = [];
  for (const project of projects) {
    for (const tower of project.towers) {
      for (const unit of tower.units) {
        if (unit.status !== status) continue;
        lines.push(`${project.label} · ${tower.label} · ${unit.code}`);
      }
    }
  }
  return lines;
}

function formulaFor(status: InventoryStatusKey): string {
  const item = statusOf(status);
  return `Unidades en v_rv_units_full con estado ${item.label} (${item.status}).`;
}

function heroScale(project: InventoryProject): number {
  let peak = 0;
  for (const key of WATERFALL) peak = Math.max(peak, project.counts[key]);
  return peak;
}

function cardScale(project: InventoryProject): number {
  let peak = 0;
  for (const tower of project.towers) {
    for (const key of WATERFALL) peak = Math.max(peak, tower.counts[key]);
  }
  return peak;
}

function riseOf(value: number, ceiling: number): CSSProperties {
  return { "--rise": `${(value / ceiling) * 100}%` } as CSSProperties;
}

function towersOf(project: InventoryProject): InventoryTower[] {
  return [...project.towers].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function StatusList({
  counts,
  onOpen,
  plotClass,
}: {
  counts: InventoryCounts;
  onOpen: (status: InventoryStatusKey) => void;
  plotClass?: string;
}) {
  const ceiling = counts.total > 0 ? counts.total : 1;
  const rows: { key: InventoryStatusKey; label: string; value: number; color: string; start: number }[] = [];
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
      start,
    });
    start += value;
  }
  return (
    <ul className={styles.statusList}>
      {[...rows].reverse().map((row) => (
        <li key={row.key}>
          <span className={styles.statusName}>{row.label}</span>
          <span className={plotClass ? `${styles.statusPlot} ${plotClass}` : styles.statusPlot} aria-hidden="true">
            <span
              className={styles.statusBar}
              style={{ left: `${(row.start / ceiling) * 100}%`, width: `${(row.value / ceiling) * 100}%`, background: row.color }}
            />
          </span>
          <button
            type="button"
            className={styles.statusCount}
            style={{ color: row.color }}
            aria-label={`${row.label}: ${count(row.value)}`}
            onClick={() => onOpen(row.key)}
          >
            {count(row.value)}
          </button>
        </li>
      ))}
    </ul>
  );
}

function HeroChart({
  project,
  onOpen,
}: {
  project: InventoryProject;
  onOpen: (status: InventoryStatusKey) => void;
}) {
  const ceiling = Math.max(heroScale(project), 1);
  return (
    <div className={styles.heroChart}>
      {WATERFALL.map((key) => {
        const item = statusOf(key);
        const value = project.counts[key];
        const text = count(value);
        return (
          <button
            key={key}
            type="button"
            className={styles.heroCol}
            aria-label={`${project.label}. ${item.label}. ${text}`}
            onClick={() => onOpen(key)}
          >
            <span className={styles.heroPlot} style={riseOf(value, ceiling)}>
              <span className={styles.heroNum}>{text}</span>
              {value > 0 ? <span className={styles.heroBar} style={{ background: item.color }} /> : null}
            </span>
            <span className={styles.heroMark}>{item.label.slice(0, 1)}</span>
          </button>
        );
      })}
    </div>
  );
}

function DetailChart({
  project,
  onOpen,
}: {
  project: InventoryProject;
  onOpen: (tower: InventoryTower, status: InventoryStatusKey) => void;
}) {
  const ceiling = Math.max(cardScale(project), 1);
  const towers = useMemo(() => towersOf(project), [project]);
  return (
    <div className={styles.cross}>
      {WATERFALL.map((key) => {
        const item = statusOf(key);
        return (
          <div key={key} className={styles.block}>
            <div className={styles.towerRow}>
              {towers.map((tower, index) => {
                const value = tower.counts[key];
                const text = count(value);
                return (
                  <button
                    key={`${tower.label}:${index}`}
                    type="button"
                    className={styles.towerCol}
                    aria-label={`${project.label}. ${tower.label}. ${item.label}. ${text}`}
                    onClick={() => onOpen(tower, key)}
                  >
                    <span className={styles.towerPlot} style={riseOf(value, ceiling)}>
                      <span className={styles.towerNum}>{text}</span>
                      {value > 0 ? <span className={styles.towerBar} style={{ background: item.color }} /> : null}
                    </span>
                    <span className={styles.towerName}>{tower.label}</span>
                  </button>
                );
              })}
            </div>
            <FitPrefix text={item.label} />
          </div>
        );
      })}
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

  function openScope(status: InventoryStatusKey, place: string, source: readonly InventoryProject[]) {
    const item = statusOf(status);
    const value = source.reduce((sum, project) => sum + project.counts[status], 0);
    toggle({
      key: `${place}:${status}`,
      title: place === "todos" ? `${item.label} ${count(value)}` : `${place} · ${item.label} ${count(value)}`,
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
                plotClass={styles.heroStatusPlot}
                onOpen={(status) => openScope(status, "todos", projects)}
              />
            </article>
            <div className={styles.expanded}>
              <div className={styles.cards}>
                {projects.map((project) => (
                  <article key={project.slug} className={styles.card} aria-label={project.label}>
                    <span className={styles.cardName}>{project.label}</span>
                    <HeroChart
                      project={project}
                      onOpen={(status) => openScope(status, project.label, [project])}
                    />
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
                      onOpen={(status) => openScope(status, project.label, [project])}
                    />
                  </article>
                  <div className={styles.detail}>
                    <DetailChart project={project} onOpen={(tower, status) => openTower(project, tower, status)} />
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
