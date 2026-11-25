"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { StatusBand, StatusSourceRow, StatusVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import split from "./lower-bands.module.css";

const RESERVAS = "#0d2041";
const PCV = "#0573b0";
const ESPERADO = "#64748b";
const COLUMN_HEADROOM = 1.14;

type PaceScope = {
  id: string;
  name: string;
  reservas: number;
  pcv: number;
  esperado: number;
  gap: number;
  units: number;
  startOn: string;
  closeOn: string;
  reservaRows: readonly StatusSourceRow[];
  pcvRows: readonly StatusSourceRow[];
  frozenDetail: string | null;
  filter: string;
  summed: boolean;
};

type Tip = {
  key: string;
  title: string;
  body: string;
  rows: readonly StatusSourceRow[];
};

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatUnits(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0";
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function formatGap(value: number): string {
  if (value > 0.05) return `+${formatUnits(value)}`;
  if (value < -0.05) return formatUnits(value);
  return "0";
}

function toneOf(value: number): "up" | "down" | "flat" {
  if (value > 0.05) return "up";
  if (value < -0.05) return "down";
  return "flat";
}

function ordered(rows: readonly StatusSourceRow[]): StatusSourceRow[] {
  return [...rows].sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
}

function paceScale(rows: readonly { reservas: number; pcv: number; esperado: number }[]): number {
  const peak = rows.reduce((max, row) => Math.max(max, row.reservas, row.pcv, row.esperado), 0);
  return peak > 0 ? peak * COLUMN_HEADROOM : 1;
}

function percentOf(value: number, scale: number): number {
  if (scale <= 0) return 0;
  return Math.max(0, Math.min(100, (Math.max(0, value) / scale) * 100));
}

function memberName(column: StatusBand): string {
  const mark = " · ";
  const index = column.label.lastIndexOf(mark);
  return index < 0 ? column.label : column.label.slice(index + mark.length);
}

function projectIdOfTower(column: StatusBand): string {
  const index = column.id.indexOf("|");
  return index < 0 ? "" : column.id.slice(0, index);
}

function towersOf(projectId: string, towers: readonly StatusBand[]): StatusBand[] {
  return towers
    .filter((column) => column.kind === "torre" && projectIdOfTower(column) === projectId)
    .sort((a, b) => memberName(a).localeCompare(memberName(b), "es") || a.id.localeCompare(b.id));
}

function flagOf(column: StatusBand): string | null {
  if (!column.congelado || !column.frozenDetail?.includes("F&F")) return null;
  return "Congelado (F&F only)";
}

function scopeOf(column: StatusBand, name: string, filter: string): PaceScope {
  return {
    id: column.id,
    name,
    reservas: column.reservas,
    pcv: column.pcv,
    esperado: column.esperado,
    gap: column.gap,
    units: column.units,
    startOn: column.startOn,
    closeOn: column.closeOn,
    reservaRows: column.reservaRows ?? [],
    pcvRows: column.pcvRows ?? [],
    frozenDetail: column.frozenDetail,
    filter,
    summed: false,
  };
}

function overallScope(projects: readonly StatusBand[]): PaceScope {
  const reservas = projects.reduce((sum, column) => sum + column.reservas, 0);
  const pcv = projects.reduce((sum, column) => sum + column.pcv, 0);
  const esperado = round1(projects.reduce((sum, column) => sum + column.esperado, 0));
  return {
    id: "todos",
    name: "Todos los Proyectos",
    reservas,
    pcv,
    esperado,
    gap: round1(reservas - esperado),
    units: projects.reduce((sum, column) => sum + column.units, 0),
    startOn: "",
    closeOn: "",
    reservaRows: ordered(projects.flatMap((column) => column.reservaRows ?? [])),
    pcvRows: ordered(projects.flatMap((column) => column.pcvRows ?? [])),
    frozenDetail: null,
    filter: projects.map((column) => column.label).join(", ") || "ningún proyecto",
    summed: true,
  };
}

function filterSentence(filter: string): string {
  return `Filtro activo: ${filter}. El periodo y el asesor no cambian este número.`;
}

function reservasTip(scope: PaceScope, asOf: string): Tip {
  return {
    key: `reservas:${scope.id}`,
    title: "Reservas",
    body: `Acumulado de reservas al ${dotted(asOf)}: ${formatUnits(scope.reservas)}. Cuenta cada actividad Reserva. La fecha es la del comprobante. Fuente: ventas.fact_comprobante. ${filterSentence(scope.filter)}`,
    rows: scope.reservaRows,
  };
}

function pcvTip(scope: PaceScope, asOf: string): Tip {
  return {
    key: `pcv:${scope.id}`,
    title: "PCV",
    body: `Acumulado de PCV al ${dotted(asOf)}: ${formatUnits(scope.pcv)}. Cuenta un trato con la promesa emitida. La fecha es la de emisión. Si la emisión es anterior a la reserva, cuenta la fecha de la reserva. Fuente: ventas.fact_pcv_issuance. ${filterSentence(scope.filter)}`,
    rows: scope.pcvRows,
  };
}

function esperadoTip(scope: PaceScope, asOf: string): Tip {
  const fecha = scope.summed
    ? `Suma de lo esperado de cada proyecto al ${dotted(asOf)}. Cada proyecto empieza en cero en su primer mes con una reserva o un PCV y llega a sus unidades 24 meses después.`
    : scope.startOn && scope.closeOn
      ? `Línea recta desde cero el ${dotted(scope.startOn)} hasta ${formatUnits(scope.units)} unidades el ${dotted(scope.closeOn)}.`
      : "No hay mes de inicio en la base, así que lo esperado queda en 0.";
  return {
    key: `esperado:${scope.id}`,
    title: "Esperado",
    body: `Lo esperado al ${dotted(asOf)}: ${formatUnits(scope.esperado)}. ${fecha} Esa fecha de cierre es placeholder. Fuente: v_rv_units_full. ${filterSentence(scope.filter)}`,
    rows: [],
  };
}

function gapTip(scope: PaceScope, asOf: string): Tip {
  return {
    key: `gap:${scope.id}`,
    title: "Variación",
    body: `Reservas menos lo esperado al ${dotted(asOf)}: ${formatGap(scope.gap)}. Reservas ${formatUnits(scope.reservas)}. Esperado ${formatUnits(scope.esperado)}. ${filterSentence(scope.filter)}`,
    rows: [],
  };
}

function NumButton({
  bottom,
  color,
  label,
  onClick,
  children,
  left,
  width,
  align,
}: {
  bottom: number;
  color: string;
  label: string;
  onClick: () => void;
  children: ReactNode;
  left?: string;
  width?: string;
  align?: "right";
}) {
  return (
    <button
      type="button"
      className={split.towerNum}
      aria-label={label}
      onClick={onClick}
      style={{
        margin: 0,
        padding: 0,
        border: 0,
        background: "transparent",
        cursor: "pointer",
        color,
        zIndex: 3,
        bottom: `calc(${bottom}% + 2px)`,
        left: left ?? "auto",
        right: align === "right" ? 0 : "auto",
        width: width ?? "auto",
        textAlign: align === "right" ? "right" : "center",
      }}
    >
      {children}
    </button>
  );
}

function PlaceholderButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={band.caption}
      onClick={onClick}
      style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer", textAlign: "left" }}
    >
      placeholder
    </button>
  );
}

function PaceMarks({
  scope,
  scale,
  asOf,
  name,
  flag,
  onTip,
}: {
  scope: PaceScope;
  scale: number;
  asOf: string;
  name: string | null;
  flag: string | null;
  onTip: (tip: Tip) => void;
}) {
  const reservasH = percentOf(scope.reservas, scale);
  const pcvH = percentOf(scope.pcv, scale);
  const lineH = percentOf(scope.esperado, scale);
  return (
    <div className={split.towerCol} style={{ cursor: "default" }} role="group" aria-label={name ?? scope.name}>
      <div className={split.towerPlot}>
        {scope.reservas > 0 ? (
          <span
            className={split.towerBar}
            aria-hidden="true"
            style={{ height: `${reservasH}%`, left: "8%", width: "36%", background: RESERVAS }}
          />
        ) : null}
        {scope.pcv > 0 ? (
          <span
            className={split.towerBar}
            data-dashed="true"
            aria-hidden="true"
            style={{
              height: `${pcvH}%`,
              left: "52%",
              width: "36%",
              background: "transparent",
              borderColor: PCV,
            }}
          />
        ) : null}
        <span className={band.ogLine} aria-hidden="true" style={{ bottom: `${lineH}%` }} />
        <NumButton
          bottom={reservasH}
          color={RESERVAS}
          left="8%"
          width="36%"
          label={`Reservas ${formatUnits(scope.reservas)}`}
          onClick={() => onTip(reservasTip(scope, asOf))}
        >
          {formatUnits(scope.reservas)}
        </NumButton>
        <NumButton
          bottom={pcvH}
          color={PCV}
          left="52%"
          width="36%"
          label={`PCV ${formatUnits(scope.pcv)}`}
          onClick={() => onTip(pcvTip(scope, asOf))}
        >
          {formatUnits(scope.pcv)}
        </NumButton>
        <NumButton
          bottom={lineH}
          color={ESPERADO}
          align="right"
          label={`Esperado ${formatUnits(scope.esperado)}`}
          onClick={() => onTip(esperadoTip(scope, asOf))}
        >
          {formatUnits(scope.esperado)}
        </NumButton>
      </div>
      {name ? <span className={split.towerModel}>{name}</span> : null}
      <button
        type="button"
        className={band.ogDelta}
        data-tone={toneOf(scope.gap)}
        aria-label={`Variación ${formatGap(scope.gap)}`}
        onClick={() => onTip(gapTip(scope, asOf))}
        style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
      >
        {formatGap(scope.gap)}
      </button>
      {flag ? (
        <button
          type="button"
          className={split.towerModel}
          onClick={() => onTip({
            key: `frozen:${scope.id}`,
            title: flag,
            body: scope.frozenDetail ?? flag,
            rows: [],
          })}
          style={{
            padding: 0,
            border: 0,
            background: "transparent",
            cursor: "pointer",
            color: "var(--color-unit-frozen)",
          }}
        >
          {flag}
        </button>
      ) : null}
    </div>
  );
}

function PaceCard({
  title,
  scope,
  scale,
  asOf,
  placeholder,
  onTip,
}: {
  title: string;
  scope: PaceScope;
  scale: number;
  asOf: string;
  placeholder: boolean;
  onTip: (tip: Tip) => void;
}) {
  return (
    <div className={split.splitHero}>
      <span className={split.splitHeroTitle}>{title}</span>
      <div className={split.towerChart} style={{ width: "100%", height: "auto", minHeight: 0 }}>
        <div className={split.towerCols} style={{ width: "100%", height: "100%" }}>
          <PaceMarks scope={scope} scale={scale} asOf={asOf} name={null} flag={null} onTip={onTip} />
        </div>
      </div>
      {placeholder ? <PlaceholderButton onClick={() => onTip(esperadoTip(scope, asOf))} /> : null}
    </div>
  );
}

function TipView({ tip, onClose }: { tip: Tip; onClose: () => void }) {
  return (
    <div className={split.splitTip} role="dialog" aria-label={tip.title}>
      <div className={split.splitTipHead}>
        <strong>{tip.title}</strong>
        <button type="button" onClick={onClose}>Cerrar</button>
      </div>
      <p>{tip.body}</p>
      {tip.rows.length > 0 ? (
        <p>{tip.rows.map((row) => `${dotted(row.day)} · ${row.dealId}`).join("; ")}</p>
      ) : null}
    </div>
  );
}

export function StatusLifetime({
  vista,
  pending,
}: {
  vista: StatusVista | null;
  pending: ReactNode;
}) {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (!tip) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setTip(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tip]);

  if (!vista) return <>{pending}</>;

  const projects = vista.byProject;
  const overall = overallScope(projects);
  const projectScale = paceScale(projects);
  const asOf = vista.asOf;
  const placeholder = projects.some((project) => project.closeOn !== "");

  function showTip(next: Tip) {
    setTip((current) => (current?.key === next.key ? null : next));
  }

  return (
    <div className={`${band.block} ${split.splitPage}`}>
      {vista.notice ? <p className={band.warn}>{vista.notice}</p> : null}
      <div className={split.splitBand}>
        <PaceCard
          title="Todos los Proyectos"
          scope={overall}
          scale={paceScale([overall])}
          asOf={asOf}
          placeholder={placeholder}
          onTip={showTip}
        />
        <div className={split.splitCards}>
          {projects.length > 0 ? (
            <article className={split.splitCard} aria-label="Proyectos">
              <div className={split.towerChart} style={{ height: "auto", minHeight: 0 }}>
                <div className={split.towerCols} style={{ width: "100%", height: "100%" }}>
                  {projects.map((project) => (
                    <PaceMarks
                      key={project.id}
                      scope={scopeOf(project, project.label, project.label)}
                      scale={projectScale}
                      asOf={asOf}
                      name={project.label}
                      flag={null}
                      onTip={showTip}
                    />
                  ))}
                </div>
              </div>
              {placeholder ? <PlaceholderButton onClick={() => showTip(esperadoTip(overall, asOf))} /> : null}
            </article>
          ) : null}
        </div>
      </div>
      {projects.length > 0 ? (
        <div className={split.splitBands}>
          {projects.map((project) => {
            const towers = towersOf(project.id, vista.byTower);
            const scope = scopeOf(project, project.label, project.label);
            return (
              <section key={project.id} className={split.splitProjectBand} aria-label={project.label}>
                <PaceCard
                  title={project.label}
                  scope={scope}
                  scale={paceScale([scope])}
                  asOf={asOf}
                  placeholder={project.closeOn !== ""}
                  onTip={showTip}
                />
                <div className={split.splitCards}>
                  <article className={split.splitCard} aria-label={`Torres de ${project.label}`}>
                    <div className={split.towerChart}>
                      <div className={split.towerCols} style={{ width: "100%", height: "100%" }}>
                        {towers.map((tower) => (
                          <PaceMarks
                            key={tower.id}
                            scope={scopeOf(tower, memberName(tower), tower.label)}
                            scale={paceScale(towers)}
                            asOf={asOf}
                            name={memberName(tower)}
                            flag={flagOf(tower)}
                            onTip={showTip}
                          />
                        ))}
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      {tip ? <TipView tip={tip} onClose={() => setTip(null)} /> : null}
    </div>
  );
}
