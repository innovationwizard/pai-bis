"use client";

import { useEffect, useState } from "react";
import type { AnalisisVista, SplitMove, SplitUnit } from "@/lib/ventas/vista-types";
import styles from "./lower-bands.module.css";

const RESERVA = "#0d2041";

const SANTA_ELENA = ["491.91 m²", "581 m²"];

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
const pctFormat = new Intl.NumberFormat("es-GT", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

type Tip = { key: string; title: string; formula: string; source: string; rows: string[] };
type TowerChoice = { id: string; label: string; slug: string };
type Scope = { kind: "all" } | { kind: "one"; id: string } | { kind: "none" };

const INVENTORY_SOURCE = "Inventario actual. Fuente: v_rv_units_full.status. Disponible, Reservado, Congelado y Vendido. En revisión no entra.";
const RESERVA_SOURCE = "Actividades Reserva finalizadas en el periodo. Una fila por actividad. Fuente: ventas.fact_comprobante.comprobante_on.";
const PCV_SOURCE = "Promesa emitida cuya fecha cae en el periodo. La fecha es la de emisión, o la del primer comprobante si es posterior. Entra solo si el trato tiene comprobante. Fuente: ventas.fact_pcv_issuance.clock_on y ventas.fact_comprobante.";
const VENDIDO_SOURCE = "PCV del periodo dividido entre las unidades del inventario actual.";
const PESO_SOURCE = "Unidades del modelo divididas entre las unidades de este grupo.";

function count(value: number): string {
  return countFormat.format(value);
}

function share(part: number, whole: number): string {
  if (!(whole > 0)) return "0%";
  return `${pctFormat.format(Math.round((part / whole) * 1000) / 10)}%`;
}

function dotted(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function projectLabel(vista: AnalisisVista, slug: string): string {
  return vista.split.projects.find((project) => project.slug === slug)?.label ?? slug;
}

function inScope(towerId: string, scope: Scope): boolean {
  if (scope.kind === "all") return true;
  if (scope.kind === "none") return false;
  return towerId === scope.id;
}

function scopeKey(scope: Scope): string {
  if (scope.kind === "all") return "all";
  if (scope.kind === "none") return "none";
  return scope.id;
}

function towerChoices(vista: AnalisisVista): TowerChoice[] {
  const seen = new Map<string, { name: string; slug: string }>();
  const rows = [
    ...vista.split.units.map((unit) => ({ id: unit.towerId, name: unit.towerName, slug: unit.projectSlug })),
    ...vista.split.moves.map((move) => ({ id: move.towerId, name: move.towerName, slug: move.projectSlug })),
  ];
  for (const row of rows) {
    if (!row.id || !row.name || seen.has(row.id)) continue;
    seen.set(row.id, { name: row.name, slug: row.slug });
  }
  const nameCount = new Map<string, number>();
  for (const info of seen.values()) nameCount.set(info.name, (nameCount.get(info.name) ?? 0) + 1);
  return [...seen.entries()]
    .map(([id, info]) => {
      const shared = (nameCount.get(info.name) ?? 0) > 1;
      const project = projectLabel(vista, info.slug);
      return { id, label: shared ? `${project} · ${info.name}` : info.name, slug: info.slug };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function modelChoices(vista: AnalisisVista, tower: TowerChoice | null): string[] {
  const names = new Set<string>();
  for (const unit of vista.split.units) {
    if (tower && unit.towerId !== tower.id) continue;
    if (unit.model) names.add(unit.model);
  }
  for (const move of vista.split.moves) {
    if (tower && move.towerId !== tower.id) continue;
    if (move.model) names.add(move.model);
  }
  const santa = vista.split.projects.some((project) => project.slug === "santa-elena");
  if (santa && (!tower || tower.slug === "santa-elena")) {
    for (const size of SANTA_ELENA) names.add(size);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "es"));
}

function modelsOf(slug: string, units: readonly SplitUnit[], moves: readonly SplitMove[], focused: string): string[] {
  if (focused) return [focused];
  const names = new Set<string>();
  for (const unit of units) if (unit.projectSlug === slug && unit.model) names.add(unit.model);
  for (const move of moves) if (move.projectSlug === slug && move.model) names.add(move.model);
  if (slug === "santa-elena") for (const size of SANTA_ELENA) names.add(size);
  return [...names].sort((a, b) => a.localeCompare(b, "es"));
}

function structuralTowers(slug: string, units: readonly SplitUnit[], moves: readonly SplitMove[]): { id: string; name: string }[] {
  const names = new Map<string, string>();
  for (const unit of units) if (unit.projectSlug === slug && unit.towerId && unit.towerName) names.set(unit.towerId, unit.towerName);
  for (const move of moves) if (move.projectSlug === slug && move.towerId && move.towerName) names.set(move.towerId, move.towerName);
  return [...names.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function cardScope(tower: TowerChoice | null, slug: string): Scope {
  if (!tower) return { kind: "all" };
  if (tower.slug !== slug) return { kind: "none" };
  return { kind: "one", id: tower.id };
}

function unitLine(unit: SplitUnit): string {
  return unit.towerName ? `${unit.code} · ${unit.towerName}` : unit.code;
}

function moveLine(vista: AnalisisVista, move: SplitMove): string {
  const who = move.unit || move.id;
  const model = move.model ? ` · ${move.model}` : "";
  return `${projectLabel(vista, move.projectSlug)} · ${who} · ${dotted(move.day)}${model}`;
}

function Hit({
  className,
  label,
  onClick,
  children,
}: {
  className?: string;
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" className={className ?? styles.splitHit} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function ModeloSplit({ vista }: { vista: AnalisisVista }) {
  const [tower, setTower] = useState("");
  const [modelo, setModelo] = useState("");
  const [tip, setTip] = useState<Tip | null>(null);
  const towers = towerChoices(vista);
  const towerActive = towers.find((choice) => choice.id === tower) ?? null;
  const models = modelChoices(vista, towerActive);
  const modeloActive = models.includes(modelo) ? modelo : "";
  const slotCount = Math.max(
    1,
    ...vista.split.projects.map((project) => modelsOf(project.slug, vista.split.units, vista.split.moves, modeloActive).length),
  );
  const scopeText = `${vista.split.scope} Torre: ${towerActive?.label ?? "Todas"}. Modelo: ${modeloActive || "Todos"}.`;
  const shownUnits = vista.split.units.filter((unit) => (!towerActive || unit.towerId === towerActive.id) && (!modeloActive || unit.model === modeloActive));
  const shownMoves = vista.split.moves.filter((move) => (!towerActive || move.towerId === towerActive.id) && (!modeloActive || move.model === modeloActive));
  const reservas = shownMoves.filter((move) => move.kind === "reserva");
  const pcvs = shownMoves.filter((move) => move.kind === "pcv");

  useEffect(() => {
    if (!tip) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setTip(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tip]);

  function chooseTower(value: string) {
    setTower(value);
    const nextTower = towers.find((choice) => choice.id === value) ?? null;
    const nextModels = modelChoices(vista, nextTower);
    setModelo((current) => (current && nextModels.includes(current) ? current : ""));
    setTip(null);
  }

  function open(next: Tip) {
    setTip((current) => (current?.key === next.key ? null : next));
  }

  return (
    <>
      <div className={styles.localFilters}>
        <label>
          Torre
          <select value={towerActive?.id ?? ""} onChange={(event) => chooseTower(event.target.value)}>
            <option value="">Todas</option>
            {towers.map((choice) => (
              <option key={choice.id} value={choice.id}>{choice.label}</option>
            ))}
          </select>
        </label>
        <label>
          Modelo
          <select
            value={modeloActive}
            onChange={(event) => {
              setModelo(event.target.value);
              setTip(null);
            }}
          >
            <option value="">Todos</option>
            {models.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      <ul className={styles.legend}>
        <li>
          <span className={styles.swatch} style={{ background: RESERVA }} aria-hidden="true" />
          Reservas
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.splitSwatchPcv}`} aria-hidden="true" />
          PCV
        </li>
      </ul>
      <div className={styles.splitStage} style={{ ["--split-slots" as string]: String(slotCount) }}>
        <div className={styles.splitHero}>
          <button
            type="button"
            className={styles.splitFigure}
            onClick={() => open({
              key: "unidades",
              title: `Unidades ${count(shownUnits.length)}`,
              formula: "Suma del inventario actual en el filtro.",
              source: INVENTORY_SOURCE,
              rows: shownUnits.map(unitLine),
            })}
          >
            <strong>{count(shownUnits.length)}</strong>
            <span>Unidades</span>
          </button>
          <button
            type="button"
            className={styles.splitFigure}
            onClick={() => open({
              key: "reservas",
              title: `Reservas ${count(reservas.length)}`,
              formula: "Actividades Reserva del periodo en el filtro.",
              source: RESERVA_SOURCE,
              rows: reservas.map((move) => moveLine(vista, move)),
            })}
          >
            <strong>{count(reservas.length)}</strong>
            <span>Reservas</span>
          </button>
          <button
            type="button"
            className={styles.splitFigure}
            onClick={() => open({
              key: "pcv",
              title: `PCV ${count(pcvs.length)}`,
              formula: "PCV del periodo en el filtro.",
              source: PCV_SOURCE,
              rows: pcvs.map((move) => moveLine(vista, move)),
            })}
          >
            <strong>{count(pcvs.length)}</strong>
            <span>PCV</span>
          </button>
          <button
            type="button"
            className={styles.splitFigure}
            onClick={() => open({
              key: "vendido",
              title: `% vendido ${share(pcvs.length, shownUnits.length)}`,
              formula: `${count(pcvs.length)} PCV / ${count(shownUnits.length)} unidades.`,
              source: VENDIDO_SOURCE,
              rows: [
                ...pcvs.map((move) => `PCV · ${moveLine(vista, move)}`),
                ...shownUnits.map((unit) => `Unidad · ${unitLine(unit)}`),
              ],
            })}
          >
            <strong>{share(pcvs.length, shownUnits.length)}</strong>
            <span>% vendido</span>
          </button>
        </div>
        <div className={styles.splitCards}>
          {vista.split.projects.map((project) => (
            <ProjectCard
              key={project.slug}
              vista={vista}
              slug={project.slug}
              label={project.label}
              focusedModel={modeloActive}
              scope={cardScope(towerActive, project.slug)}
              onTip={open}
            />
          ))}
        </div>
      </div>
      {tip ? (
        <div className={styles.splitTip} role="dialog" aria-label={tip.title}>
          <div className={styles.splitTipHead}>
            <strong>{tip.title}</strong>
            <button type="button" onClick={() => setTip(null)}>Cerrar</button>
          </div>
          <p>{tip.formula}</p>
          <p>{tip.source}</p>
          <p>{scopeText}</p>
          {vista.split.notice ? <p>{vista.split.notice}</p> : null}
          <ul>
            {tip.rows.map((row, index) => (
              <li key={`${index}:${row}`}>{row}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function ProjectCard({
  vista,
  slug,
  label,
  focusedModel,
  scope,
  onTip,
}: {
  vista: AnalisisVista;
  slug: string;
  label: string;
  focusedModel: string;
  scope: Scope;
  onTip: (tip: Tip) => void;
}) {
  const models = modelsOf(slug, vista.split.units, vista.split.moves, focusedModel);
  const towers = structuralTowers(slug, vista.split.units, vista.split.moves);
  return (
    <article className={styles.splitCard} aria-label={label}>
      <h3 className={styles.splitProject}>{label}</h3>
      <ModelGraphics vista={vista} slug={slug} models={models} scope={scope} onTip={onTip} />
      {scope.kind === "all" && towers.length > 1 ? towers.map((tower) => (
        <section key={tower.id} className={styles.splitTower} aria-label={tower.name}>
          <h4>{tower.name}</h4>
          <ModelGraphics vista={vista} slug={slug} models={models} scope={{ kind: "one", id: tower.id }} compact onTip={onTip} />
        </section>
      )) : null}
    </article>
  );
}

function ModelGraphics({
  vista,
  slug,
  models,
  scope,
  compact = false,
  onTip,
}: {
  vista: AnalisisVista;
  slug: string;
  models: readonly string[];
  scope: Scope;
  compact?: boolean;
  onTip: (tip: Tip) => void;
}) {
  const parent = vista.split.units.filter((unit) => unit.projectSlug === slug && inScope(unit.towerId, scope));
  let salePeak = 1;
  const rows = models.map((model) => {
    const units = parent.filter((unit) => unit.model === model);
    const reserva = vista.split.moves.filter((move) => move.kind === "reserva" && move.projectSlug === slug && move.model === model && inScope(move.towerId, scope));
    const pcv = vista.split.moves.filter((move) => move.kind === "pcv" && move.projectSlug === slug && move.model === model && inScope(move.towerId, scope));
    salePeak = Math.max(salePeak, reserva.length, pcv.length);
    return { model, units, reserva, pcv };
  });
  return (
    <div className={compact ? `${styles.splitModels} ${styles.splitModelsStrip}` : styles.splitModels}>
      {rows.map((row) => (
        <ModelRow
          key={`${slug}:${scopeKey(scope)}:${row.model}`}
          vista={vista}
          slug={slug}
          model={row.model}
          scope={scope}
          units={row.units}
          parent={parent.length}
          reserva={row.reserva}
          pcv={row.pcv}
          salePeak={salePeak}
          compact={compact}
          onTip={onTip}
        />
      ))}
    </div>
  );
}

function ModelRow({
  vista,
  slug,
  model,
  scope,
  units,
  parent,
  reserva,
  pcv,
  salePeak,
  compact = false,
  onTip,
}: {
  vista: AnalisisVista;
  slug: string;
  model: string;
  scope: Scope;
  units: readonly SplitUnit[];
  parent: number;
  reserva: readonly SplitMove[];
  pcv: readonly SplitMove[];
  salePeak: number;
  compact?: boolean;
  onTip: (tip: Tip) => void;
}) {
  const where = `${projectLabel(vista, slug)} · ${model}`;
  const mark = scopeKey(scope);
  const disponible = units.filter((unit) => unit.status === "disponible");
  const total = units.length;
  return (
    <div className={styles.splitModel} role="group" aria-label={where}>
      <button
        type="button"
        className={compact ? styles.splitModelNameStrip : styles.splitModelName}
        onClick={() => onTip({
          key: `${where}:${mark}:modelo`,
          title: model,
          formula: `${share(total, parent)} peso · ${share(pcv.length, total)} vendido · ${count(disponible.length)} disponible`,
          source: PESO_SOURCE,
          rows: units.map(unitLine),
        })}
      >
        {model}
      </button>
      <div className={styles.splitSales}>
        <SaleBar
          dashed={false}
          value={reserva.length}
          peak={salePeak}
          label={`${where}. Reservas ${count(reserva.length)}`}
          onClick={() => onTip({
            key: `${where}:${mark}:reserva`,
            title: `Reservas ${count(reserva.length)}`,
            formula: "Actividades Reserva del periodo.",
            source: RESERVA_SOURCE,
            rows: reserva.map((move) => moveLine(vista, move)),
          })}
        />
        <SaleBar
          dashed
          value={pcv.length}
          peak={salePeak}
          label={`${where}. PCV ${count(pcv.length)}`}
          onClick={() => onTip({
            key: `${where}:${mark}:pcv`,
            title: `PCV ${count(pcv.length)}`,
            formula: "PCV del periodo.",
            source: PCV_SOURCE,
            rows: pcv.map((move) => moveLine(vista, move)),
          })}
        />
      </div>
    </div>
  );
}

function SaleBar({
  dashed,
  value,
  peak,
  label,
  onClick,
}: {
  dashed: boolean;
  value: number;
  peak: number;
  label: string;
  onClick: () => void;
}) {
  const width = value > 0 && peak > 0 ? Math.round((value / peak) * 100) : 0;
  const shown = count(value);
  return (
    <div className={styles.splitSalePlot}>
      <span className={styles.splitSaleTrack}>
        <button
          type="button"
          className={dashed ? styles.splitSalePcv : styles.splitSaleReserva}
          style={{ width: `${width}%`, color: dashed ? "#0d2041" : "#fff" }}
          aria-label={label}
          onClick={onClick}
        />
      </span>
      <button type="button" className={styles.splitSaleNum} aria-label={label} onClick={onClick}>
        {shown}
      </button>
    </div>
  );
}
