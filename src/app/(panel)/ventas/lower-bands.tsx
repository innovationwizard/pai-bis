"use client";

import { Fragment, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { isDisplayProject, projectKey } from "@/lib/projects";
import { UNIT_STATUS_COLORS } from "@/lib/reservas/constants";
import type {
  AnalisisVista,
  CasoVista,
  ConversionVista,
  DescuentoVista,
  DesistenciaVista,
  InventarioVista,
  NamedBar,
  PrecioVista,
  PromoVista,
  ReferidosVista,
} from "@/lib/ventas/vista-types";
import styles from "./lower-bands.module.css";

const NAVY = "#0d2041";
const BLUE = "#0573b0";
const AMBER = "#b45309";
const GRID = "#e2e8f0";

const moneyFormat = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 });
const dollarFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 });

export type ProjectSlot = { id: string; label: string };

type Weight = "project" | "row";
type Tone = "navy" | "red" | "amber" | "blue";

type Mark = {
  id: string;
  label: string;
  value: number;
  hue?: string;
  tone?: Tone;
  aside?: string | null;
  text?: string;
};

type StackSegment = { key: string; label: string; value: number; color: string; text?: string };
type StockKey = "disponible" | "reservado" | "congelado" | "vendido";

type StackRow = {
  key: string;
  id: string;
  label: string;
  axis?: string;
  segments: StackSegment[];
  onOpen?: () => void;
};

const STOCK: { key: StockKey; label: string; color: string }[] = [
  { key: "disponible", label: "Disponible", color: UNIT_STATUS_COLORS.AVAILABLE },
  { key: "reservado", label: "Reservado", color: UNIT_STATUS_COLORS.RESERVED },
  { key: "congelado", label: "Congelado", color: UNIT_STATUS_COLORS.FROZEN },
  { key: "vendido", label: "Vendido", color: UNIT_STATUS_COLORS.SOLD },
];

const PROJECT_BLUE: Record<string, string> = {
  "boulevard-5": "#3d6f8f",
  benestare: "#0d2041",
  "bosque-las-tapias": "#0573b0",
  "santa-elena": "#1a4a68",
};

const SALE_SLUGS: { slug: string; name: string }[] = [
  { slug: "boulevard-5", name: "BOULEVARD 5" },
  { slug: "benestare", name: "BENESTARE" },
  { slug: "bosque-las-tapias", name: "BOSQUE LAS TAPIAS" },
  { slug: "santa-elena", name: "SANTA ELENA" },
];

function saleTowerOptions(rows: AnalisisVista["modelSales"]): { id: string; label: string }[] {
  const seen = new Map<string, { name: string; slug: string }>();
  for (const row of rows) {
    if (!row.towerId || !(row.sold > 0) || isMissingLabel(row.towerName)) continue;
    if (!seen.has(row.towerId)) seen.set(row.towerId, { name: row.towerName, slug: row.projectSlug });
  }
  const nameCount = new Map<string, number>();
  for (const info of seen.values()) nameCount.set(info.name, (nameCount.get(info.name) ?? 0) + 1);
  return [...seen.entries()]
    .map(([id, info]) => {
      const project = SALE_SLUGS.find((item) => item.slug === info.slug)?.name;
      const shared = (nameCount.get(info.name) ?? 0) > 1;
      const label = shared && project ? `${titleLabel(project)} · ${info.name}` : info.name;
      return { id, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function saleModelOptions(rows: AnalisisVista["modelSales"]): string[] {
  return [...new Set(rows.filter((row) => row.sold > 0 && !isMissingLabel(row.model)).map((row) => row.model))]
    .sort((a, b) => a.localeCompare(b, "es"));
}

function projectFill(label: string): string | null {
  const key = projectKey(label);
  if (key === projectKey("BOULEVARD 5")) return PROJECT_BLUE["boulevard-5"];
  if (key === projectKey("BENESTARE")) return PROJECT_BLUE.benestare;
  if (key === projectKey("BOSQUE LAS TAPIAS")) return PROJECT_BLUE["bosque-las-tapias"];
  if (key === projectKey("SANTA ELENA")) return PROJECT_BLUE["santa-elena"];
  return null;
}

function projectBarColor(slug: string): string {
  return PROJECT_BLUE[slug] ?? NAVY;
}

function markFill(mark: Mark): string {
  if (mark.tone === "red") return "#b91c1c";
  if (mark.tone === "amber") return AMBER;
  if (mark.tone === "blue") return BLUE;
  return projectFill(mark.label) ?? NAVY;
}

function saleGroups(rows: AnalisisVista["modelSales"], includeSantaElena: boolean): ColumnGroup[] {
  const byProject = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (isMissingLabel(row.model)) continue;
    const models = byProject.get(row.projectSlug) ?? new Map<string, number>();
    models.set(row.model, (models.get(row.model) ?? 0) + row.sold);
    byProject.set(row.projectSlug, models);
  }
  const groups: ColumnGroup[] = [];
  for (const item of SALE_SLUGS) {
    const models = byProject.get(item.slug) ?? new Map<string, number>();
    if (item.slug === "santa-elena" && includeSantaElena) {
      if (!models.has("491.91 m²")) models.set("491.91 m²", 0);
      if (!models.has("581 m²")) models.set("581 m²", 0);
    }
    const kept = [...models.entries()].filter((entry) => item.slug === "santa-elena" || entry[1] > 0);
    if (kept.length === 0) continue;
    const label = titleLabel(item.name);
    const color = projectBarColor(item.slug);
    groups.push({
      key: item.slug,
      label,
      rows: kept
        .sort((a, b) => a[0].localeCompare(b[0], "es"))
        .map(([model, sold]) => ({
          key: `${item.slug}:${model}`,
          id: item.slug,
          label: model,
          axis: model,
          segments: [{ key: "ventas", label: "Ventas", value: sold, color }],
        })),
    });
  }
  return groups;
}

function ModeloChart({ vista }: { vista: AnalisisVista }) {
  const [tower, setTower] = useState("");
  const [modelo, setModelo] = useState("");
  const sales = vista.modelSales;
  const towers = saleTowerOptions(sales);
  const towerActive = towers.some((choice) => choice.id === tower) ? tower : "";
  const inTower = sales.filter((row) => !towerActive || row.towerId === towerActive);
  const models = saleModelOptions(inTower);
  const modeloActive = models.includes(modelo) ? modelo : "";
  const shown = inTower.filter((row) => !modeloActive || row.model === modeloActive);
  const groups = saleGroups(shown, towerActive === "" && modeloActive === "");

  function chooseTower(value: string) {
    setTower(value);
    const next = saleModelOptions(sales.filter((row) => !value || row.towerId === value));
    setModelo((current) => (current && next.includes(current) ? current : ""));
  }

  return (
    <>
      <div className={styles.localFilters}>
        <label>
          Torre
          <select value={towerActive} onChange={(event) => chooseTower(event.target.value)}>
            <option value="">Todas</option>
            {towers.map((choice) => (
              <option key={choice.id} value={choice.id}>{choice.label}</option>
            ))}
          </select>
        </label>
        <label>
          Modelo
          <select value={modeloActive} onChange={(event) => setModelo(event.target.value)}>
            <option value="">Todos</option>
            {models.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      {groups.length === 0 ? emptyNote(null) : <SmallMultiples groups={groups} legend={false} />}
    </>
  );
}

function money(value: number): string {
  return moneyFormat.format(value);
}

function dollars(value: number): string {
  return dollarFormat.format(value);
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

function titleLabel(label: string): string {
  const key = projectKey(label);
  if (key === projectKey("BOULEVARD 5")) return "Boulevard 5";
  if (key === projectKey("BENESTARE")) return "Benestare";
  if (key === projectKey("BOSQUE LAS TAPIAS")) return "Bosque Las Tapias";
  if (key === projectKey("SANTA ELENA")) return "Santa Elena";
  return label;
}

function niceScale(peak: number): { scale: number; marks: number[] } {
  if (!(peak > 0)) return { scale: 1, marks: [0, 1] };
  if (peak <= 12) {
    const scale = Math.ceil(peak);
    return { scale, marks: Array.from({ length: scale + 1 }, (_, index) => index) };
  }
  const padded = peak * 1.05;
  const exp = Math.floor(Math.log10(padded));
  const base = 10 ** exp;
  const frac = padded / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  const scale = nice * base;
  const step = scale / 4;
  return { scale, marks: [0, 1, 2, 3, 4].map((index) => step * index) };
}

function columnScale(peak: number): { scale: number; marks: number[] } {
  if (!(peak > 0)) return { scale: 1, marks: [0, 1] };
  const scale = peak * 1.12;
  if (scale <= 16) {
    const marks: number[] = [];
    for (let mark = 0; mark <= scale + 1e-9; mark += 1) marks.push(mark);
    return { scale, marks };
  }
  const step = columnStep(scale);
  const count = Math.floor(scale / step + 1e-9);
  const marks = Array.from({ length: count + 1 }, (_, index) => {
    const value = index * step;
    return Math.round(value * 1000) / 1000;
  });
  return { scale, marks };
}

function columnStep(scale: number): number {
  const exp = Math.floor(Math.log10(Math.max(scale / 4, 1e-9)));
  const base = 10 ** exp;
  const candidates = [1, 2, 2.5, 5, 10].map((factor) => factor * base);
  const ranked = candidates
    .map((step) => ({ step, intervals: scale / step }))
    .filter((item) => item.intervals >= 3 && item.intervals <= 6);
  if (ranked.length === 0) {
    return candidates.reduce((best, step) => (Math.abs(scale / step - 4) < Math.abs(scale / best - 4) ? step : best));
  }
  ranked.sort((a, b) => Math.abs(a.intervals - 4) - Math.abs(b.intervals - 4));
  return ranked[0].step;
}

function tipNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function emptyNote(_notice: string | null | undefined): ReactNode {
  void _notice;
  // return <p className="op-note">{_notice ?? "Nada que graficar en este periodo."}</p>;
  return null;
}

function press(event: KeyboardEvent<HTMLDivElement>, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

function orderedProjects<T extends { id: string; label: string }>(
  roster: readonly ProjectSlot[],
  rows: readonly T[],
): { id: string; label: string; row: T | null }[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    if (!isDisplayProject(row.label)) continue;
    const key = projectKey(row.label);
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return roster
    .filter((slot) => isDisplayProject(slot.label))
    .map((slot) => {
      const row = byKey.get(projectKey(slot.label)) ?? null;
      return {
        id: row?.id || slot.id,
        label: row?.label ?? titleLabel(slot.label),
        row,
      };
    });
}

function Scale({
  marks,
  scale,
  span,
  gutter,
}: {
  marks: readonly number[];
  scale: number;
  span: number;
  gutter: number;
}) {
  if (span <= 0 || !(scale > 0)) return null;
  return (
    <div className={styles.scale} style={{ gridRow: `1 / span ${span}`, marginRight: gutter }} aria-hidden="true">
      {marks.map((mark, index) => (
        <span key={`${index}:${mark}`} className={styles.gridLine} style={{ left: `${(mark / scale) * 100}%` }} />
      ))}
    </div>
  );
}

function clickableChart(
  rows: readonly Mark[],
  format: (value: number) => string,
  weight: Weight,
  gutter: number,
  onPick?: (id: string, label: string) => void,
) {
  const { scale, marks } = niceScale(rows.reduce((max, row) => Math.max(max, row.value), 0));
  const withAside = rows.some((row) => row.aside);
  const plot = weight === "project" ? styles.plotProject : styles.plotRow;
  return (
    <div className={withAside ? styles.frameAside : styles.frame}>
      <Scale marks={marks} scale={scale} span={rows.length} gutter={gutter} />
      {rows.map((row, index) => {
        const pct = scale > 0 ? Math.min(100, Math.max(0, (row.value / scale) * 100)) : 0;
        const shown = row.text ?? format(row.value);
        const open = onPick && row.id !== "" ? () => onPick(row.id, row.label) : null;
        return (
          <div
            key={row.id || `${row.label}:${index}`}
            className={styles.row}
            style={{ gridRow: index + 1 }}
            role={open ? "button" : undefined}
            tabIndex={open ? 0 : undefined}
            aria-label={`${row.label}: ${shown}`}
            onClick={open ?? undefined}
            onKeyDown={open ? (event) => press(event, open) : undefined}
          >
            <span className={styles.name}>{row.label}</span>
            <div className={`${styles.plot} ${plot}`}>
              <div className={styles.field} style={{ right: gutter }}>
                {row.value <= 0 ? <span className={styles.zeroTick} aria-hidden="true" /> : (
                  <span
                    className={styles.bar}
                    data-project={row.hue || undefined}
                    data-tone={row.hue ? undefined : row.tone ?? "navy"}
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                )}
                <span className={styles.count} style={{ left: row.value <= 0 ? 8 : `calc(${pct}% + 6px)` }}>
                  {shown}
                </span>
              </div>
            </div>
            {withAside ? (
              <span className={styles.aside}>
                {row.aside ? <span className={styles.pill}>{row.aside}</span> : null}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const PROJECT_PLOT = 300;
const TOWER_PLOT = 252;
const SEGMENT_LABEL = 16;
const COLUMN_GAP = 4;

function segmentInk(color: string): string {
  return color === UNIT_STATUS_COLORS.AVAILABLE ? NAVY : "#fff";
}

function columnSlices(values: readonly number[], scale: number, plot: number): { height: number; labelY: number; inside: boolean }[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  const columnPx = total > 0 && scale > 0 ? Math.min(plot, (total / scale) * plot) : 0;
  let cursor = 0;
  const slices = values.map((value) => {
    const height = value > 0 && total > 0 ? (value / total) * columnPx : 0;
    const labelY = cursor + height / 2;
    cursor += height;
    return { height, labelY, inside: height >= SEGMENT_LABEL };
  });
  const outside = slices.flatMap((slice, index) => (slice.height > 0 && !slice.inside ? [index] : []));
  for (let index = 1; index < outside.length; index += 1) {
    const previous = slices[outside[index - 1]].labelY;
    if (slices[outside[index]].labelY - previous < SEGMENT_LABEL) {
      slices[outside[index]].labelY = previous + SEGMENT_LABEL;
    }
  }
  if (outside.length > 0) {
    const lastIndex = outside[outside.length - 1];
    const last = slices[lastIndex].labelY;
    if (last > plot - 8) {
      const shift = last - (plot - 8);
      for (const index of outside) slices[index].labelY -= shift;
    }
    const first = slices[outside[0]].labelY;
    if (first < 8) {
      const shift = 8 - first;
      for (const index of outside) slices[index].labelY += shift;
    }
  }
  return slices;
}

function tickBottom(mark: number, scale: number): string {
  if (!(scale > 0)) return "0px";
  const pct = (mark / scale) * 100;
  if (pct <= 0) return "0px";
  if (pct >= 97) return "calc(100% - 14px)";
  return `calc(${pct}% - 7px)`;
}

function ColumnName({ label, wrap }: { label: string; wrap: boolean }) {
  if (!wrap) return <span className={styles.colName}>{label}</span>;
  return <span className={`${styles.colName} ${styles.colNameClamp}`} title={label}>{label}</span>;
}

function shownValue(segment: StackSegment, format: (value: number) => string): string {
  return segment.text ?? format(segment.value);
}

function StackColumn({
  row,
  scale,
  plot,
  wrap,
  format = count,
}: {
  row: StackRow;
  scale: number;
  plot: number;
  wrap: boolean;
  format?: (value: number) => string;
}) {
  const values = row.segments.map((segment) => segment.value);
  const total = values.reduce((sum, value) => sum + value, 0);
  const slices = columnSlices(values, scale, plot);
  const spoken = row.segments.map((segment) => `${shownValue(segment, format)} ${segment.label.toLowerCase()}`).join(", ");
  const spokenLabel = `${row.label}: ${spoken}`;
  const drawn = slices.flatMap((slice, index) => (slice.height > 0 ? [index] : []));
  const bottomIndex = drawn[0] ?? -1;
  const topIndex = drawn[drawn.length - 1] ?? -1;
  const single = row.segments.length === 1 ? row.segments[0] : null;
  const zeroInk = single?.color ?? NAVY;
  const chart = (
    <>
      <div className={styles.colField} style={{ height: plot }}>
        {total <= 0 ? (
          <span className={styles.colZero} style={{ color: zeroInk }}>
            {single?.text ?? format(0)}
            <span className={styles.colZeroTick} style={{ background: zeroInk }} aria-hidden="true" />
          </span>
        ) : (
          <div className={styles.colStack} style={{ height: slices.reduce((sum, slice) => sum + slice.height, 0) }}>
            {row.segments.map((segment, index) => {
              const slice = slices[index];
              const shown = shownValue(segment, format);
              if (!slice || slice.height <= 0) return null;
              const placeInside = slice.inside && shown.length <= 9;
              return (
                <span
                  key={segment.key}
                  className={styles.vseg}
                  style={{
                    height: slice.height,
                    background: segment.color,
                    color: segmentInk(segment.color),
                    borderBottomLeftRadius: index === bottomIndex ? 2 : 0,
                    borderBottomRightRadius: index === bottomIndex ? 2 : 0,
                    borderTopLeftRadius: index === topIndex ? 2 : 0,
                    borderTopRightRadius: index === topIndex ? 2 : 0,
                  }}
                >
                  {placeInside ? shown : null}
                </span>
              );
            })}
            {row.segments.map((segment, index) => {
              const slice = slices[index];
              const shown = shownValue(segment, format);
              if (!slice || slice.height <= 0 || (slice.inside && shown.length <= 9)) return null;
              return (
                <span
                  key={`${segment.key}:n`}
                  className={styles.colTag}
                  style={{
                    bottom: slice.labelY,
                    background: segment.color,
                    color: segmentInk(segment.color),
                  }}
                >
                  {shown}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <ColumnName label={row.axis ?? row.label} wrap={wrap} />
    </>
  );
  if (!row.onOpen) {
    return (
      <div className={styles.col} role="group" aria-label={spokenLabel}>
        {chart}
      </div>
    );
  }
  return (
    <button type="button" className={styles.col} aria-label={spokenLabel} onClick={row.onOpen}>
      {chart}
    </button>
  );
}

type ColumnGroup = { key: string; label: string | null; rows: readonly StackRow[] };

function SmallMultiples({ groups, legend = true, fit = false }: { groups: readonly ColumnGroup[]; legend?: boolean; fit?: boolean }) {
  const plot = TOWER_PLOT;
  const peak = groups.reduce((max, group) => {
    return group.rows.reduce((rowMax, row) => {
      const total = row.segments.reduce((sum, segment) => sum + segment.value, 0);
      return Math.max(rowMax, total);
    }, max);
  }, 0);
  const { scale, marks } = columnScale(peak);
  return (
    <>
      {legend ? (
        <ul className={styles.legend}>
          {STOCK.map((item) => (
            <li key={item.key}>
              <span className={styles.swatch} style={{ background: item.color }} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className={fit ? `${styles.multiples} ${styles.multiplesFit}` : styles.multiples}>
        <div className={styles.yAxis} style={{ height: plot }} aria-hidden="true">
          {marks.map((mark) => (
            <span key={mark} className={styles.yTick} style={{ bottom: tickBottom(mark, scale) }}>
              {count(mark)}
            </span>
          ))}
        </div>
        <div className={styles.miniTrack}>
          {groups.map((group, index) => (
            <Fragment key={group.key}>
              {index > 0 ? <span className={fit ? `${styles.miniRule} ${styles.miniRuleFit}` : styles.miniRule} aria-hidden="true" /> : null}
              <section className={styles.mini} style={{ flex: fit ? "1 1 0" : `${Math.max(group.rows.length, 1)} 1 0` }} aria-label={group.label ?? undefined}>
                <h3 className={styles.miniTitle}>{group.label}</h3>
                <div className={styles.miniStage}>
                  <div className={styles.miniGrid} style={{ height: plot }} aria-hidden="true">
                    {marks.map((mark) => mark <= 0 ? null : (
                      <span key={mark} className={styles.colGridLine} style={{ bottom: `${(mark / scale) * 100}%` }} />
                    ))}
                  </div>
                  <div className={styles.colRow} style={{ gap: COLUMN_GAP }}>
                    {group.rows.map((row) => (
                      <StackColumn key={row.key} row={row} scale={scale} plot={plot} wrap />
                    ))}
                  </div>
                </div>
              </section>
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}

function StackChart({ groups, weight }: { groups: readonly ColumnGroup[]; weight: Weight }) {
  const plot = weight === "project" ? PROJECT_PLOT : TOWER_PLOT;
  const grouped = groups.some((group) => group.label);
  const peak = groups.reduce((max, group) => {
    return group.rows.reduce((rowMax, row) => {
      const total = row.segments.reduce((sum, segment) => sum + segment.value, 0);
      return Math.max(rowMax, total);
    }, max);
  }, 0);
  const { scale, marks } = columnScale(peak);
  return (
    <>
      <ul className={styles.legend}>
        {STOCK.map((item) => (
          <li key={item.key}>
            <span className={styles.swatch} style={{ background: item.color }} aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>
      <div className={styles.colChart} data-weight={weight} data-grouped={grouped ? "true" : "false"}>
        <div className={styles.yAxis} style={{ height: plot }} aria-hidden="true">
          {marks.map((mark) => (
            <span key={mark} className={styles.yTick} style={{ bottom: tickBottom(mark, scale) }}>
              {count(mark)}
            </span>
          ))}
        </div>
        <div className={styles.colClip}>
          <div className={styles.colBody}>
            <div className={styles.colGrid} style={{ height: plot }} aria-hidden="true">
              {marks.map((mark) => mark <= 0 ? null : (
                <span key={mark} className={styles.colGridLine} style={{ bottom: `${(mark / scale) * 100}%` }} />
              ))}
            </div>
            <div className={styles.colGroups}>
              {groups.map((group) => (
                <div key={group.key} className={styles.colGroup} style={{ flex: `${Math.max(group.rows.length, 1)} 1 0` }}>
                  {grouped ? <div className={styles.colGroupName}>{group.label}</div> : null}
                  <div className={styles.colRow} style={{ gap: COLUMN_GAP }}>
                    {group.rows.map((row) => (
                      <StackColumn key={row.key} row={row} scale={scale} plot={plot} wrap={grouped} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function stockSegments(counts: Record<StockKey, number>): StackSegment[] {
  return STOCK.map((item) => ({
    key: item.key,
    label: item.label,
    color: item.color,
    value: counts[item.key],
  }));
}

function MarkColumns({
  rows,
  format,
  onPick,
  axis = "count",
}: {
  rows: readonly Mark[];
  format: (value: number) => string;
  onPick?: (id: string, label: string) => void;
  axis?: "count" | "money";
}) {
  const visible = rows.filter((row) => !isMissingLabel(row.label));
  if (visible.length === 0) return null;
  const plot = TOWER_PLOT;
  const peak = visible.reduce((max, row) => Math.max(max, row.value), 0);
  const { scale, marks } = columnScale(peak);
  const axisFormat = axis === "money" ? format : count;
  return (
    <div className={styles.colChart} data-weight="project" data-axis={axis}>
      <div className={styles.yAxis} style={{ height: plot }} aria-hidden="true">
        {marks.map((mark) => (
          <span key={mark} className={styles.yTick} style={{ bottom: tickBottom(mark, scale) }}>
            {axisFormat(mark)}
          </span>
        ))}
      </div>
      <div className={styles.colClip}>
        <div className={styles.colBody}>
          <div className={styles.colGrid} style={{ height: plot }} aria-hidden="true">
            {marks.map((mark) => mark <= 0 ? null : (
              <span key={mark} className={styles.colGridLine} style={{ bottom: `${(mark / scale) * 100}%` }} />
            ))}
          </div>
          <div className={styles.colRow} style={{ gap: COLUMN_GAP }}>
            {visible.map((row, index) => (
              <StackColumn
                key={row.id || `${row.label}:${index}`}
                row={{
                  key: row.id || `${row.label}:${index}`,
                  id: row.id,
                  label: row.label,
                  segments: [{ key: "valor", label: row.label, value: row.value, color: markFill(row), text: row.text }],
                  onOpen: onPick && row.id !== "" ? () => onPick(row.id, row.label) : undefined,
                }}
                scale={scale}
                plot={plot}
                wrap
                format={format}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function funnelPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0%";
  const rounded = Math.round(value * 1000) / 10;
  const digits = Number.isInteger(rounded) ? 0 : 1;
  return `${new Intl.NumberFormat("es-GT", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(rounded)}%`;
}

const FUNNEL_PROJECT_PLOT = 220;

function stageLines(label: string): readonly [string, string] {
  const split = label.lastIndexOf(" ");
  if (split <= 0) return [label, "\u00a0"];
  return [label.slice(0, split), label.slice(split + 1)];
}

function FunnelColumn({
  bar,
  scale,
  plot,
  ink,
}: {
  bar: ConversionVista["all"]["bars"][number];
  scale: number;
  plot: number;
  ink: string;
}) {
  const shown = count(bar.count);
  const raw = bar.count > 0 && scale > 0 ? (bar.count / scale) * plot : 0;
  const height = raw <= 0 ? 0 : Math.min(plot, Math.max(raw, 2));
  const inside = height >= 20 && shown.length <= 6;
  const rate = bar.hasNext ? funnelPct(bar.nextRate) : null;
  const [first, second] = stageLines(bar.label);
  const spoken = rate ? `${bar.label}: ${shown}, ${rate}` : `${bar.label}: ${shown}`;
  return (
    <div className={styles.col} role="group" aria-label={spoken}>
      <div className={`${styles.colField} ${styles.funnelField}`} style={{ height: plot }}>
        {bar.count <= 0 ? (
          <span className={styles.colZero} style={{ color: ink }}>
            {shown}
            <span className={styles.colZeroTick} style={{ background: ink }} aria-hidden="true" />
          </span>
        ) : (
          <div className={`${styles.colStack} ${styles.funnelBar}`} style={{ height, background: ink }}>
            {inside ? <span>{shown}</span> : null}
          </div>
        )}
        {bar.count > 0 && !inside ? (
          <span className={styles.funnelAbove} style={{ bottom: height + 4, color: ink }}>
            {shown}
          </span>
        ) : null}
      </div>
      <span className={styles.funnelStage}>
        <span>{first}</span>
        <span>{second}</span>
      </span>
      <span className={styles.funnelRate}>{rate ?? "\u00a0"}</span>
    </div>
  );
}

function EmbudoChart({
  bars,
  winRate,
  weight,
  hue,
}: {
  bars: ConversionVista["all"]["bars"];
  winRate: number | null;
  weight: Weight;
  hue?: string;
}) {
  const peak = bars.reduce((max, bar) => Math.max(max, bar.count), 0);
  const { scale, marks } = columnScale(peak);
  const plot = weight === "project" ? PROJECT_PLOT : FUNNEL_PROJECT_PLOT;
  const ink = hue ? projectBarColor(hue) : NAVY;
  return (
    <div>
      <p className={styles.win}>Tasa de ganados {funnelPct(winRate)}</p>
      <div className={`${styles.colChart} ${styles.funnelChart}`} data-weight={weight}>
        <div className={styles.yAxis} style={{ height: plot }} aria-hidden="true">
          {marks.map((mark) => (
            <span key={mark} className={styles.yTick} style={{ bottom: tickBottom(mark, scale) }}>
              {count(mark)}
            </span>
          ))}
        </div>
        <div className={styles.colClip}>
          <div className={styles.colBody}>
            <div className={styles.colGrid} style={{ height: plot }} aria-hidden="true">
              {marks.map((mark) => mark <= 0 ? null : (
                <span key={mark} className={styles.colGridLine} style={{ bottom: `${(mark / scale) * 100}%` }} />
              ))}
            </div>
            <div className={styles.colRow} style={{ gap: 8 }}>
              {bars.map((bar) => (
                <FunnelColumn key={bar.label} bar={bar} scale={scale} plot={plot} ink={ink} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TasaBand({
  vista,
  pending,
}: {
  vista: ConversionVista | null;
  pending: ReactNode;
}) {
  return (
    <section className={styles.bandPlain} aria-labelledby="vt-tasa-title">
      <h2 id="vt-tasa-title" className={styles.title}>Tasa de conversión</h2>
      {vista == null ? pending : (
        <>
          <h3 className={styles.subTitle}>de todos los proyectos</h3>
          <EmbudoChart bars={vista.all.bars} winRate={vista.all.winRate} weight="project" />
          <h3 className={styles.subTitle}>por proyecto</h3>
          <div className={styles.projectFunnels}>
            {vista.funnels.map((funnel) => (
              <article key={funnel.slug} className={styles.projectFunnel} aria-label={funnel.label}>
                <h4 className={styles.projectName}>{funnel.label}</h4>
                <EmbudoChart bars={funnel.bars} winRate={funnel.winRate} weight="row" hue={funnel.slug} />
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function InventarioBands({
  vista,
  pending,
  roster,
  projectName,
  asesorNote,
  onProject,
  onTower,
}: {
  vista: InventarioVista | null;
  pending: ReactNode;
  roster: readonly ProjectSlot[];
  projectName: ReadonlyMap<string, string>;
  asesorNote: string | null;
  onProject: (id: string, label: string) => void;
  onTower: (projectId: string, tower: string, label: string) => void;
}) {
  void asesorNote;
  if (!vista) {
    return (
      <section className={styles.band} aria-labelledby="vt-inventario-title">
        <h2 id="vt-inventario-title" className={styles.title}>Inventario general</h2>
        {/* {asesorNote ? <p className="op-note">{asesorNote}</p> : null} */}
        {pending}
      </section>
    );
  }
  const projects = orderedProjects(roster, vista.byProject).map((item) => {
    const row = item.row;
    const id = item.id;
    return {
      key: id || item.label,
      id,
      label: item.label,
      segments: stockSegments({
        vendido: row?.vendido ?? 0,
        reservado: row?.reservado ?? 0,
        congelado: row?.congelado ?? 0,
        disponible: row?.disponible ?? 0,
      }),
      onOpen: id ? () => onProject(id, item.label) : undefined,
    } satisfies StackRow;
  });
  const towers = towerGroups(vista, roster, projectName, onTower, onProject);
  const models = modelGroups(vista, roster, projectName);
  return (
    <div className={styles.pair}>
      <section className={styles.band} aria-labelledby="vt-inventario-todos-title">
        <h2 id="vt-inventario-todos-title" className={styles.title}>Inventario de todos los proyectos</h2>
        {/* {vista.notice && !vista.notice.includes("otro estado") ? <p className="op-note">{vista.notice}</p> : null} */}
        {/* {asesorNote ? <p className="op-note">{asesorNote}</p> : null} */}
        {projects.length === 0 ? emptyNote(null) : <StackChart groups={[{ key: "proyectos", label: null, rows: projects }]} weight="project" />}
      </section>
      <section className={styles.band} aria-labelledby="vt-inventario-por-proyecto-title">
        <h2 id="vt-inventario-por-proyecto-title" className={styles.title}>Inventario por proyecto</h2>
        {towers.length === 0 ? emptyNote(null) : <SmallMultiples groups={towers} fit />}
      </section>
      <section className={styles.band} aria-labelledby="vt-inventario-modelo-title">
        <h2 id="vt-inventario-modelo-title" className={styles.title}>Inventario por modelo</h2>
        {models.length === 0 ? emptyNote(null) : <SmallMultiples groups={models} />}
      </section>
    </div>
  );
}

function isMissingLabel(label: string): boolean {
  const key = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return key === "sin dato" || key === "sin torre" || key === "sin modelo" || key === "sin asesor" || key === "asesor pending" || key === "meta pending";
}

function towerGroups(
  vista: InventarioVista,
  roster: readonly ProjectSlot[],
  projectName: ReadonlyMap<string, string>,
  onTower: (projectId: string, tower: string, label: string) => void,
  onProject: (id: string, label: string) => void,
): ColumnGroup[] {
  const groups: ColumnGroup[] = [];
  for (const slot of projectSlots(vista, roster, projectName)) {
    const towers = vista.byTower
      .filter((tower) => projectKey(slot.nameOf.get(tower.projectId) ?? "") === projectKey(slot.label))
      .sort((a, b) => a.tower.localeCompare(b.tower, "es"));
    if (projectKey(slot.label) === projectKey("SANTA ELENA")) {
      const fromProject = vista.byProject.find((project) => projectKey(project.label) === projectKey(slot.label));
      const summed = towers.reduce((sum, tower) => ({
        vendido: sum.vendido + tower.vendido,
        reservado: sum.reservado + tower.reservado,
        congelado: sum.congelado + tower.congelado,
        disponible: sum.disponible + tower.disponible,
      }), {
        vendido: fromProject && towers.length === 0 ? fromProject.vendido : 0,
        reservado: fromProject && towers.length === 0 ? fromProject.reservado : 0,
        congelado: fromProject && towers.length === 0 ? fromProject.congelado : 0,
        disponible: fromProject && towers.length === 0 ? fromProject.disponible : 0,
      });
      groups.push({
        key: slot.id || slot.label,
        label: slot.label,
        rows: [{
          key: `${slot.id || slot.label}:casas`,
          id: slot.id,
          label: slot.label,
          axis: "Casas",
          segments: stockSegments(summed),
          onOpen: slot.id ? () => onProject(slot.id, slot.label) : undefined,
        }],
      });
      continue;
    }
    const named = towers.filter((tower) => !isMissingLabel(tower.tower));
    if (named.length > 0) {
      groups.push({
        key: slot.id || slot.label,
        label: slot.label,
        rows: named.map((tower, index) => {
          const label = `${slot.label} · ${tower.tower}`;
          return {
            key: `${tower.projectId}:${index}:${tower.tower}`,
            id: tower.projectId,
            label,
            axis: tower.tower,
            segments: stockSegments({
              vendido: tower.vendido,
              reservado: tower.reservado,
              congelado: tower.congelado,
              disponible: tower.disponible,
            }),
            onOpen: () => onTower(tower.projectId, tower.tower, label),
          };
        }),
      });
      continue;
    }
    const fromProject = vista.byProject.find((project) => projectKey(project.label) === projectKey(slot.label));
    groups.push({
      key: slot.id || slot.label,
      label: slot.label,
      rows: [{
        key: `${slot.id || slot.label}:total`,
        id: slot.id,
        label: slot.label,
        axis: slot.label,
        segments: stockSegments({
          vendido: fromProject?.vendido ?? 0,
          reservado: fromProject?.reservado ?? 0,
          congelado: fromProject?.congelado ?? 0,
          disponible: fromProject?.disponible ?? 0,
        }),
        onOpen: slot.id ? () => onProject(slot.id, slot.label) : undefined,
      }],
    });
  }
  return groups;
}

const MODEL_SLUGS: { slug: string; name: string }[] = [
  { slug: "boulevard-5", name: "BOULEVARD 5" },
  { slug: "benestare", name: "BENESTARE" },
  { slug: "bosque-las-tapias", name: "BOSQUE LAS TAPIAS" },
  { slug: "santa-elena", name: "SANTA ELENA" },
];

function modelInProject(
  model: InventarioVista["byModel"][number],
  slotLabel: string,
  nameOf: ReadonlyMap<string, string>,
): boolean {
  const named = MODEL_SLUGS.find((item) => item.slug === model.projectSlug);
  if (named) return projectKey(named.name) === projectKey(slotLabel);
  return projectKey(nameOf.get(model.projectId) ?? "") === projectKey(slotLabel);
}

function modelGroups(
  vista: InventarioVista,
  roster: readonly ProjectSlot[],
  projectName: ReadonlyMap<string, string>,
): ColumnGroup[] {
  const groups: ColumnGroup[] = [];
  for (const slot of projectSlots(vista, roster, projectName)) {
    const models = vista.byModel
      .filter((model) => modelInProject(model, slot.label, slot.nameOf))
      .filter((model) => model.vendido + model.reservado + model.congelado + model.disponible > 0)
      .filter((model) => !isMissingLabel(model.model))
      .sort((a, b) => a.model.localeCompare(b.model, "es"));
    const rows = projectKey(slot.label) === projectKey("SANTA ELENA")
      ? [...models, ...["491.91 m²", "581 m²"].filter((size) => !models.some((model) => model.model === size)).map((size) => ({
        projectId: slot.id,
        projectSlug: "santa-elena",
        model: size,
        vendido: 0,
        reservado: 0,
        congelado: 0,
        disponible: 0,
      }))].sort((a, b) => a.model.localeCompare(b.model, "es"))
      : models;
    if (rows.length === 0) continue;
    groups.push({
      key: slot.id || slot.label,
      label: slot.label,
      rows: rows.map((model) => ({
        key: `${model.projectSlug}:${model.model}`,
        id: model.projectId,
        label: `${slot.label} · ${model.model}`,
        axis: model.model,
        segments: stockSegments({
          vendido: model.vendido,
          reservado: model.reservado,
          congelado: model.congelado,
          disponible: model.disponible,
        }),
      })),
    });
  }
  return groups;
}

function projectSlots(
  vista: InventarioVista,
  roster: readonly ProjectSlot[],
  projectName: ReadonlyMap<string, string>,
): { id: string; label: string; nameOf: Map<string, string> }[] {
  const nameOf = new Map<string, string>();
  for (const project of vista.byProject) nameOf.set(project.id, project.label);
  for (const [id, label] of projectName) if (!nameOf.has(id)) nameOf.set(id, label);
  return orderedProjects(roster, vista.byProject).map((slot) => ({ id: slot.id, label: slot.label, nameOf }));
}

export function ModeloBand({
  vista,
  pending,
}: {
  vista: AnalisisVista | null;
  pending: ReactNode;
}) {
  return (
    <section className={styles.band} aria-labelledby="vt-modelo-title">
      <h2 id="vt-modelo-title" className={styles.title}>Ventas por modelo</h2>
      {!vista ? pending : <ModeloChart vista={vista} />}
    </section>
  );
}

function seriesLive(points: readonly { gtq: number; usd: number }[], key: "gtq" | "usd"): boolean {
  return points.some((point) => point[key] !== 0);
}

function pointLabel(value: unknown, format: (n: number) => string): string {
  const n = tipNumber(value);
  if (n == null) return "";
  return format(n);
}

function CurrencyLine({
  points,
  dataKey,
  name,
  stroke,
  format,
}: {
  points: PrecioVista["months"];
  dataKey: "gtq" | "usd";
  name: string;
  stroke: string;
  format: (value: number) => string;
}) {
  return (
    <div className={styles.plotLine}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ left: 0, right: 12, top: 22, bottom: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tickFormatter={(value) => format(tipNumber(value) ?? 0)} tick={{ fontSize: 11, fill: "#64748b" }} width={88} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value) => [format(tipNumber(value) ?? 0), name]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey={dataKey} name={name} stroke={stroke} strokeWidth={4.5} dot={{ r: 3 }} isAnimationActive={false}>
            <LabelList dataKey={dataKey} position="top" formatter={(value) => pointLabel(value, format)} fill={stroke} fontSize={10} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ValorBand({
  precios,
  preciosPending,
  descuentos,
  descuentosPending,
}: {
  precios: PrecioVista | null;
  preciosPending: ReactNode;
  descuentos: DescuentoVista | null;
  descuentosPending: ReactNode;
}) {
  return (
    <section className={styles.band} aria-labelledby="vt-valor-title">
      <h2 id="vt-valor-title" className={styles.title}>Valor de proyecto</h2>
      <h3 className={styles.subTitle}>Trayectoria de precios</h3>
      {!precios ? preciosPending : <PriceBody vista={precios} />}
      <h3 className={styles.subTitle}>Impacto del descuento</h3>
      {!descuentos ? descuentosPending : <DiscountBody vista={descuentos} />}
    </section>
  );
}

function PriceBody({ vista }: { vista: PrecioVista }) {
  if (vista.months.length === 0) return emptyNote(vista.notice);
  const gtq = seriesLive(vista.months, "gtq");
  const usd = seriesLive(vista.months, "usd");
  const showGtq = gtq || !usd;
  const showUsd = usd;
  return (
    <>
      {/* {vista.notice ? <p className="op-note">{vista.notice}</p> : null} */}
      {showGtq ? <CurrencyLine points={vista.months} dataKey="gtq" name="Quetzales" stroke={NAVY} format={money} /> : null}
      {showUsd ? <CurrencyLine points={vista.months} dataKey="usd" name="Dólares" stroke={BLUE} format={dollars} /> : null}
    </>
  );
}

function DiscountBody({ vista }: { vista: DescuentoVista }) {
  if (vista.gtq == null && vista.saleGtq == null) return emptyNote(vista.notice);
  const rows: Mark[] = [
    { id: "ventas", label: "Ventas con descuento", value: vista.saleGtq ?? 0, tone: "amber" },
    { id: "descuento", label: "Descuento", value: vista.gtq ?? 0, tone: "amber" },
  ];
  return (
    <>
      {/* {vista.notice ? <p className="op-note">{vista.notice}</p> : null} */}
      <MarkColumns rows={rows} format={money} axis="money" />
    </>
  );
}

export function DesistimientosBands({
  vista,
  pending,
  roster,
  onProject,
}: {
  vista: DesistenciaVista | null;
  pending: ReactNode;
  roster: readonly ProjectSlot[];
  onProject: (id: string, label: string) => void;
}) {
  if (!vista) {
    return (
      <section className={styles.band} aria-labelledby="vt-desist-title">
        <h2 id="vt-desist-title" className={styles.title}>Desistimientos</h2>
        {pending}
      </section>
    );
  }
  const moneyMode = vista.motivos.some((row) => row.gtq != null) || vista.byProject.some((row) => row.gtq != null);
  const format = moneyMode ? (value: number) => money(value) : count;
  const motivos: Mark[] = vista.motivos.map((row) => ({
    id: row.id,
    label: row.label,
    value: moneyMode ? row.gtq ?? 0 : row.units,
    tone: "red" as const,
  }));
  const projects: Mark[] = orderedProjects(roster, vista.byProject).map((item) => ({
    id: item.id,
    label: item.label,
    value: moneyMode ? item.row?.gtq ?? 0 : item.row?.units ?? 0,
    hue: hueKey(item.label),
  }));
  return (
    <div className={styles.pair}>
      <section className={styles.band} aria-labelledby="vt-desist-motivo-title">
        <h2 id="vt-desist-motivo-title" className={styles.title}>Desistimientos por motivo</h2>
        {/* {vista.notice ? <p className="op-note">{vista.notice}</p> : null} */}
        {motivos.length === 0 ? emptyNote(null) : <MarkColumns rows={motivos} format={format} axis={moneyMode ? "money" : "count"} />}
      </section>
      <section className={styles.band} aria-labelledby="vt-desist-proyecto-title">
        <h2 id="vt-desist-proyecto-title" className={styles.title}>Desistimientos por proyecto</h2>
        {projects.length === 0 ? emptyNote(null) : <MarkColumns rows={projects} format={format} axis={moneyMode ? "money" : "count"} onPick={onProject} />}
      </section>
    </div>
  );
}

function amountRows(rows: readonly NamedBar[], tone: Tone): { marks: Mark[]; moneyMode: boolean } {
  const moneyMode = rows.some((row) => row.gtq != null);
  return {
    moneyMode,
    marks: rows.map((row) => ({
      id: row.id,
      label: row.label,
      value: moneyMode ? row.gtq ?? 0 : row.units,
      tone,
    })),
  };
}

function casoAmounts(vista: CasoVista): NamedBar[] {
  const byTipo = new Map<string, { n: number; gtq: number; priced: boolean }>();
  for (const row of vista.traces) {
    const current = byTipo.get(row.tipo) ?? { n: 0, gtq: 0, priced: true };
    current.n += 1;
    if (row.gtq == null) current.priced = false;
    else current.gtq += row.gtq;
    byTipo.set(row.tipo, current);
  }
  const complete = vista.marked != null && vista.traces.length > 0 && vista.traces.length === vista.marked;
  return vista.tipos.map((row) => {
    if (row.gtq != null || !complete || row.id === "resto") return row;
    const found = byTipo.get(row.label);
    if (!found || !found.priced || found.n !== row.units) return row;
    return { ...row, gtq: found.gtq };
  });
}

function AmountCard({
  title,
  id,
  pending,
  notice,
  rows,
  tone,
}: {
  title: string;
  id: string;
  pending: ReactNode | null;
  notice: string | null;
  rows: readonly NamedBar[] | null;
  tone: Tone;
}) {
  const built = rows ? amountRows(rows, tone) : null;
  const format = built?.moneyMode ? money : count;
  void notice;
  return (
    <section className={styles.band} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>{title}</h2>
      {pending}
      {/* {notice ? <p className="op-note">{notice}</p> : null} */}
      {built && built.marks.length === 0 ? emptyNote(null) : null}
      {built && built.marks.length > 0 ? (
        <MarkColumns rows={built.marks} format={format} axis={built.moneyMode ? "money" : "count"} />
      ) : null}
    </section>
  );
}

export function ControlesGrid({
  descuentos,
  descuentosPending,
  precios,
  preciosPending,
  casos,
  casosPending,
  promos,
  promosPending,
  roster,
}: {
  descuentos: DescuentoVista | null;
  descuentosPending: ReactNode;
  precios: PrecioVista | null;
  preciosPending: ReactNode;
  casos: CasoVista | null;
  casosPending: ReactNode;
  promos: PromoVista | null;
  promosPending: ReactNode;
  roster: readonly ProjectSlot[];
}) {
  const gtqLive = (precios?.byProject ?? []).some((row) => (row.gtq ?? 0) !== 0);
  const usdLive = (precios?.byProject ?? []).some((row) => (row.usd ?? 0) !== 0);
  const pricesUnloaded = precios != null && precios.gtq == null && precios.usd == null && precios.byProject.length === 0;
  const showGtq = precios != null && !pricesUnloaded && (gtqLive || !usdLive);
  const showUsd = precios != null && !pricesUnloaded && usdLive;
  const priceProjects = precios && !pricesUnloaded ? orderedProjects(roster, precios.byProject) : [];
  const casoChart = casos ? casoMarks(casos) : null;
  return (
    <section className="vc-grid-2" aria-label="Controles">
      <AmountCard
        title="Descuentos"
        id="vt-descuentos-title"
        pending={descuentos ? null : descuentosPending}
        notice={descuentos?.notice ?? null}
        rows={descuentos ? descuentos.tipos : null}
        tone="amber"
      />
      <section className={styles.band} aria-labelledby="vt-subidas-title">
        <h2 id="vt-subidas-title" className={styles.title}>Subidas de precios</h2>
        {!precios ? preciosPending : (
          <>
            {/* {precios.notice ? <p className="op-note">{precios.notice}</p> : null} */}
            {priceProjects.length === 0 ? emptyNote(null) : null}
            {priceProjects.length > 0 && showGtq ? (
              <>
                {showUsd ? <h3 className={styles.subTitle}>Quetzales</h3> : null}
                <MarkColumns
                  rows={priceProjects.map((item) => ({
                    id: item.id || item.label,
                    label: item.label,
                    value: item.row?.gtq ?? 0,
                    hue: hueKey(item.label),
                  }))}
                  format={money}
                  axis="money"
                />
              </>
            ) : null}
            {priceProjects.length > 0 && showUsd ? (
              <>
                {showGtq ? <h3 className={styles.subTitle}>Dólares</h3> : null}
                <MarkColumns
                  rows={priceProjects.map((item) => ({
                    id: `${item.id || item.label}:usd`,
                    label: item.label,
                    value: item.row?.usd ?? 0,
                    hue: hueKey(item.label),
                  }))}
                  format={dollars}
                  axis="money"
                />
              </>
            ) : null}
          </>
        )}
      </section>
      <section className={styles.band} aria-labelledby="vt-casos-title">
        <h2 id="vt-casos-title" className={styles.title}>F&amp;F y casos especiales</h2>
        {!casos ? casosPending : (
          <>
            {/* {casos.notice ? <p className="op-note">{casos.notice}</p> : null} */}
            {casoChart && casoChart.rows.length === 0 ? emptyNote(null) : null}
            {casoChart && casoChart.rows.length > 0 ? (
              <MarkColumns rows={casoChart.rows} format={casoChart.moneyMode ? money : count} axis={casoChart.moneyMode ? "money" : "count"} />
            ) : null}
          </>
        )}
      </section>
      <AmountCard
        title="Promociones"
        id="vt-promos-title"
        pending={promos ? null : promosPending}
        notice={promos?.notice ?? null}
        rows={promos ? promos.tipos : null}
        tone="navy"
      />
    </section>
  );
}

function casoMarks(vista: CasoVista): { rows: Mark[]; moneyMode: boolean } {
  const marked = vista.marked != null && vista.marked > 0;
  const source = casoAmounts(vista)
    .filter((row) => marked || row.id !== "resto")
    .filter((row) => !isMissingLabel(row.label));
  const moneyMode = source.length > 0 && source.every((row) => row.gtq != null);
  return {
    moneyMode,
    rows: source.map((row) => ({
      id: row.id,
      label: row.label,
      value: moneyMode ? row.gtq ?? 0 : row.units,
      tone: "navy" as const,
      text: !moneyMode && row.gtq != null ? `${count(row.units)} · ${money(row.gtq)}` : undefined,
    })),
  };
}

export function ReferidosBand({
  vista,
  pending,
}: {
  vista: ReferidosVista | null;
  pending: ReactNode;
}) {
  return (
    <section className={styles.band} aria-labelledby="vt-referidos-title">
      <h2 id="vt-referidos-title" className={styles.title}>Control Referidos</h2>
      {!vista ? pending : <ReferidosBody vista={vista} />}
    </section>
  );
}

function ReferidosBody({ vista }: { vista: ReferidosVista }) {
  const marked = vista.si != null && vista.si > 0;
  const names = vista.nombres.length > 0;
  if (vista.scopedDeals === 0) return null;
  if (vista.si == null && !names) {
    // return <p className="op-note">Estos tratos no traen referido, tipo de referido ni nombre de referidor.</p>;
    return null;
  }
  const typed = vista.byTipo
    .filter((row) => !isMissingLabel(row.label))
    .map((row) => ({ id: row.id, label: row.label, value: row.units, tone: "navy" as const }));
  const rows: Mark[] = typed.length > 0
    ? typed
    : marked && vista.si != null
      ? [{ id: "referidos", label: "Referidos", value: vista.si, tone: "navy" as const }]
      : [];
  return (
    <>
      {/* {vista.notice ? <p className="op-note">{vista.notice}</p> : null} */}
      {/* {vista.si === 0 ? <p className="op-note">Ningún trato está marcado como referido.</p> : null} */}
      {/* {vista.sinTipo != null && vista.sinTipo > 0 ? <p className="op-note">{count(vista.sinTipo)} sin tipo de referido.</p> : null} */}
      {rows.length > 0 ? <MarkColumns rows={rows} format={count} /> : null}
      {names ? (
        <>
          <h3 className={styles.subTitle}>Referidores</h3>
          <ul className={styles.names}>
            {vista.nombres.map((name, index) => <li key={`${name}:${index}`}>{name}</li>)}
          </ul>
          {/* {vista.nombresTotal != null && vista.nombresTotal > vista.nombres.length ? (
            <p className="op-note">La lista trae {vista.nombres.length} de {vista.nombresTotal}.</p>
          ) : null} */}
        </>
      ) : null}
    </>
  );
}
