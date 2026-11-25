"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
const textWidths = new Map<string, number>();

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

function textWidth(text: string, fontSize: number, family: string): number {
  const key = `${family}\u0000${fontSize}\u0000${text}`;
  const cached = textWidths.get(key);
  if (cached != null) return cached;
  const probe = document.createElement("span");
  probe.textContent = text;
  probe.style.position = "fixed";
  probe.style.left = "-9999px";
  probe.style.top = "0";
  probe.style.visibility = "hidden";
  probe.style.whiteSpace = "nowrap";
  probe.style.fontFamily = family;
  probe.style.fontSize = `${fontSize}px`;
  probe.style.fontWeight = "700";
  probe.style.fontVariantNumeric = "tabular-nums";
  probe.style.lineHeight = "1";
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  textWidths.set(key, width);
  return width;
}

function FitText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<number | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const host = node?.parentElement;
    if (!node || !host) return;
    const fit = () => {
      const available = host.clientWidth;
      if (available <= 0) return;
      const computed = Number.parseFloat(getComputedStyle(host).fontSize);
      const base = Number.isFinite(computed) && computed > 0 ? computed : 8;
      const needed = textWidth(text, base, getComputedStyle(host).fontFamily || "inherit");
      const room = Math.max(0, available - 1);
      const next = needed > room && needed > 0 ? (base * room) / needed : base;
      setSize((current) => (current != null && Math.abs(current - next) < 0.15 ? current : next));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [text]);
  return (
    <span ref={ref} className={styles.fitText} style={size == null ? undefined : { fontSize: `${size}px` }}>
      {text}
    </span>
  );
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

function cardScale(project: InventoryProject): number {
  let peak = 0;
  for (const tower of project.towers) {
    for (const key of WATERFALL) peak = Math.max(peak, tower.counts[key]);
  }
  return peak;
}

function StatusList({
  counts,
  onOpen,
}: {
  counts: InventoryCounts;
  onOpen: (status: InventoryStatusKey) => void;
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
          <span className={styles.statusPlot} aria-hidden="true">
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

function StatusBlocks({
  project,
  onOpen,
}: {
  project: InventoryProject;
  onOpen: (tower: InventoryTower, status: InventoryStatusKey) => void;
}) {
  const scale = useMemo(() => cardScale(project), [project]);
  const ceiling = scale > 0 ? scale : 1;
  return (
    <div className={styles.blocks}>
      {WATERFALL.map((key) => {
        const item = statusOf(key);
        return (
          <div key={key} className={styles.block}>
            <span className={styles.blockName}>{item.label}</span>
            <div className={styles.columns}>
              {project.towers.map((tower, index) => {
                const value = tower.counts[key];
                const text = count(value);
                return (
                  <div key={`${tower.label}:${index}`} className={styles.column}>
                    <button
                      type="button"
                      className={styles.num}
                      style={{ color: item.color }}
                      aria-label={`${project.label}, ${tower.label}, ${item.label}: ${text}`}
                      onClick={() => onOpen(tower, key)}
                    >
                      {text}
                    </button>
                    <div className={styles.plot}>
                      <span className={styles.barGap} style={{ flexGrow: ceiling - value }} />
                      <span className={styles.bar} style={{ flexGrow: value, background: item.color }} />
                    </div>
                    <span className={styles.torre}>
                      <FitText text={tower.label} />
                    </span>
                  </div>
                );
              })}
            </div>
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
                onOpen={(status) => openScope(status, "todos", projects)}
              />
            </article>
            <div className={styles.expanded}>
              <div className={styles.cards}>
                {projects.map((project) => (
                  <article key={project.slug} className={styles.card} aria-label={project.label}>
                    <span className={styles.cardName}>{project.label}</span>
                    <StatusBlocks project={project} onOpen={(tower, status) => openTower(project, tower, status)} />
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
                    <StatusBlocks project={project} onOpen={(tower, status) => openTower(project, tower, status)} />
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
