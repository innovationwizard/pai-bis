"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BlockerRow, Freshness, FunnelStage, StageDeal, TotalesVista } from "@/lib/ventas/vista-types";
import { isDisplayProject } from "@/lib/projects";

const moneyFormat = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 });
const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 });

type Measure = "unidades" | "quetzales";
type SortKey = "unit" | "who" | "stage" | "missing" | "days" | "gtq";

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return moneyFormat.format(value);
}

function count(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return countFormat.format(value);
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const n = value * 100;
  const digits = Math.abs(n) >= 10 || n === 0 ? 0 : 1;
  return `${new Intl.NumberFormat("es-GT", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n)}%`;
}

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function tipNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function toneOf(delta: number | null): "up" | "down" | "flat" {
  if (delta == null || delta === 0) return "flat";
  return delta > 0 ? "up" : "down";
}

function versus(current: number, prior: number | null, format: (value: number) => string = count): string {
  if (prior == null) return "Sin periodo anterior";
  const delta = current - prior;
  if (delta === 0) return "Igual que el periodo anterior";
  const percent = prior === 0 ? null : delta / prior;
  const head = `${delta > 0 ? "+" : ""}${format(delta)}`;
  const tail = percent == null ? "" : ` (${percent > 0 ? "+" : ""}${pct(percent)})`;
  return `${head}${tail} vs periodo anterior`;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function VentaFreshness({ freshness }: { freshness: Freshness }) {
  return (
    <div className="vt-stamp">
      <p>{freshness.label}</p>
      {/* <VentaDefinition /> */}
      {freshness.note ? <p className="vt-stale-note">{freshness.note}</p> : null}
    </div>
  );
}

export function VentaDefinition() {
  return null;
  /*
  return (
    <details className="vt-def">
      <summary>Cómo calculamos Venta</summary>
      <div>
        <p>{VENTA_DEFINITION}</p>
        <dl>
          {VENTA_RULES.map((rule) => (
            <div key={rule.label}>
              <dt>{rule.label}</dt>
              <dd>{rule.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
  */
}

export default function TotalesScreen({
  vista,
  onProject,
}: {
  vista: Extract<TotalesVista, { section: "ventas-totales" }>;
  onProject: (id: string, label: string) => void;
}) {
  const [stageId, setStageId] = useState<FunnelStage["id"] | null>(null);
  const [measure, setMeasure] = useState<Measure>("unidades");
  const stage = vista.funnel.find((item) => item.id === stageId) ?? null;
  const delta = vista.priorNetUnits == null ? null : vista.netUnits - vista.priorNetUnits;
  const deltaPct = vista.priorNetUnits ? (vista.netUnits - vista.priorNetUnits) / vista.priorNetUnits : null;
  const onPace = vista.expectedUnits == null ? null : vista.netUnits - vista.expectedUnits;
  const metaText = vista.targetUnits
    ? `vs meta ${pct(vista.netUnits / vista.targetUnits)}`
    : (vista.targetNote ?? "Sin meta");
  const blockers = vista.blockers.filter((row) => isDisplayProject(row.project));
  const blockerTotal = Math.max(blockers.length, vista.blockerTotal - (vista.blockers.length - blockers.length));

  return (
    <div className="op-totales-body">
      <section className="vt-hero" aria-label="Venta neta del periodo">
        <p className="vt-kicker">Venta neta · {vista.periodLabel}</p>
        <p className="vt-hero-figure">
          <b>{count(vista.netUnits)}</b>
          <span>unidades</span>
          <span className="vt-dot" aria-hidden="true">·</span>
          <b>{money(vista.netGtq)}</b>
        </p>
        <p className="vt-variance">
          <span className={`vt-${toneOf(delta)}`}>
            {vista.priorLabel ?? "vs periodo anterior"}:{" "}
            {delta == null ? "sin dato" : `${delta > 0 ? "+" : ""}${count(delta)}`}
            {deltaPct == null ? "" : ` (${deltaPct > 0 ? "+" : ""}${pct(deltaPct)})`}
          </span>
          <span className={`vt-${toneOf(onPace)}`}>{metaText}</span>
        </p>
        <p className="vt-caption">{vista.definition}</p>
        {vista.notice ? <p className="op-note">{vista.notice}</p> : null}
      </section>

      <div className="vt-kpis">
        <Kpi
          label="Reservas del periodo"
          value={count(vista.funnel[0]?.count)}
          detail={money(vista.funnel[0]?.gtq)}
          delta={versus(vista.funnel[0]?.count ?? 0, vista.funnel[0]?.priorCount ?? null)}
          tone={toneOf(vista.funnel[0]?.priorCount == null ? null : (vista.funnel[0]?.count ?? 0) - vista.funnel[0].priorCount)}
        />
        <Kpi
          label="Promesas firmadas"
          value={count(vista.funnel[1]?.count)}
          detail="Recepción de Promesa Firmada"
          delta={versus(vista.funnel[1]?.count ?? 0, vista.funnel[1]?.priorCount ?? null)}
          tone={toneOf(vista.funnel[1]?.priorCount == null ? null : (vista.funnel[1]?.count ?? 0) - vista.funnel[1].priorCount)}
        />
        <Kpi
          label="Recibos publicados"
          value={count(vista.funnel[2]?.count)}
          detail="Primer recibo publicado"
          delta={versus(vista.funnel[2]?.count ?? 0, vista.funnel[2]?.priorCount ?? null)}
          tone={toneOf(vista.funnel[2]?.priorCount == null ? null : (vista.funnel[2]?.count ?? 0) - vista.funnel[2].priorCount)}
        />
        <Kpi
          label="Desistimientos"
          value={count(vista.lossUnits)}
          detail={money(vista.lossGtq)}
          delta={versus(vista.lossUnits, vista.lossPriorUnits)}
          tone={toneOf(vista.lossPriorUnits == null ? null : vista.lossPriorUnits - vista.lossUnits)}
        />
        <Kpi
          label="Valor promedio"
          value={money(vista.promedio)}
          detail="Por unidad neta"
          delta={vista.promedio == null ? "Sin monto para el promedio" : versus(vista.promedio, vista.promedioPrior, money)}
          tone={toneOf(vista.promedio == null || vista.promedioPrior == null ? null : vista.promedio - vista.promedioPrior)}
        />
      </div>

      <section className="vt-card" aria-label="De la reserva a la venta neta">
        <header className="vt-card-head">
          <h2>De la reserva a la venta neta</h2>
          <p>Cada barra es el volumen de esa etapa. El porcentaje la compara con la anterior. Si pasa de 100 %, entraron tratos que no venían de esa etapa.</p>
        </header>
        <div className="vt-funnel">
          {vista.funnel.map((item) => {
            const max = Math.max(...vista.funnel.map((stage) => Math.max(stage.count, 0)), 1);
            const width = (Math.max(item.count, 0) / max) * 100;
            return (
              <button key={item.id} type="button" className="vt-stage" onClick={() => setStageId(item.id)}>
                <span className="vt-stage-name">
                  <strong>{count(item.count)}</strong>
                  <span>{item.label}</span>
                  <small>{item.source} · {item.grain}</small>
                </span>
                <span className="vt-track" aria-hidden="true">
                  <span className="vt-fill" style={{ width: `${width}%` }} />
                </span>
                <span className="vt-conv">{item.conversion == null ? "—" : pct(item.conversion)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="vt-context">
        <section className="vt-card" aria-label="Ritmo acumulado">
          <header className="vt-card-head">
            <div>
              <h2>{vista.paceInsight}</h2>
              <p>Línea continua: este periodo. Punteada: {vista.compareLabel ?? "periodo anterior"}. Azul: ritmo de la meta.</p>
            </div>
            <div className="op-mode" role="group" aria-label="Unidades o quetzales">
              <button type="button" aria-pressed={measure === "unidades"} onClick={() => setMeasure("unidades")}>Unidades</button>
              <button type="button" aria-pressed={measure === "quetzales"} onClick={() => setMeasure("quetzales")}>Quetzales</button>
            </div>
          </header>
          <PaceChart vista={vista} measure={measure} />
        </section>
        <section className="vt-card" aria-label="Ritmo contra la meta">
          <header className="vt-card-head">
            <h2>Ritmo contra la meta</h2>
          </header>
          <Bullet actual={vista.netUnits} expected={vista.expectedUnits} target={vista.targetUnits} note={vista.targetNote} />
        </section>
      </div>

      <section className="vt-card" aria-label="Por proyecto">
        <header className="vt-card-head">
          <h2>Por proyecto</h2>
          <p>Unidades netas, valor y peso sobre el total del periodo.</p>
        </header>
        <Projects vista={vista} onProject={onProject} />
      </section>

      <Blockers rows={blockers} total={blockerTotal} />
      {stage ? <StageDialog stage={stage} onClose={() => setStageId(null)} /> : null}
    </div>
  );
}

function Kpi({ label, value, detail, delta, tone }: { label: string; value: string; detail: string; delta: string; tone: "up" | "down" | "flat" }) {
  return (
    <p className="vt-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      <small className={`vt-${tone}`}>{delta}</small>
    </p>
  );
}

function PaceChart({ vista, measure }: { vista: TotalesVista; measure: Measure }) {
  const units = measure === "unidades";
  const hasPrior = vista.daily.some((point) => (units ? point.anterior : point.anteriorGtq) != null);
  const hasYear = vista.daily.some((point) => (units ? point.anio : point.anioGtq) != null);
  const hasMeta = vista.daily.some((point) => (units ? point.meta : point.metaGtq) != null);
  if (vista.daily.length === 0) return <p className="op-note">Nada que graficar en este periodo.</p>;
  return (
    <div className="vt-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={vista.daily} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={units ? 32 : 72}
            tickFormatter={(value) => (units ? count(tipNumber(value)) : money(tipNumber(value)))}
          />
          <Tooltip formatter={(value, name) => [units ? count(tipNumber(value)) : money(tipNumber(value)), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey={units ? "neto" : "netoGtq"} name="Este periodo" stroke="#0d2041" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          {hasPrior ? (
            <Line type="monotone" dataKey={units ? "anterior" : "anteriorGtq"} name={vista.compareLabel ?? "Periodo anterior"} stroke="#94a3b8" strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
          ) : null}
          {hasYear ? (
            <Line type="monotone" dataKey={units ? "anio" : "anioGtq"} name={vista.yearLabel ?? "Año anterior"} stroke="#64748b" strokeDasharray="2 3" dot={false} connectNulls={false} isAnimationActive={false} />
          ) : null}
          {hasMeta ? (
            <Line type="monotone" dataKey={units ? "meta" : "metaGtq"} name="Ritmo de la meta" stroke="#0573b0" strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Bullet({ actual, expected, target, note }: { actual: number; expected: number | null; target: number | null; note: string | null }) {
  if (target == null || target <= 0) {
    return <p className="op-note">{note ?? "Este periodo no tiene meta."}</p>;
  }
  const scale = Math.max(target, actual, expected ?? 0, 1);
  const actualPct = Math.max(0, Math.min(100, (actual / scale) * 100));
  const expectedPct = expected == null ? null : Math.max(0, Math.min(100, (expected / scale) * 100));
  const targetPct = Math.max(0, Math.min(100, (target / scale) * 100));
  const behind = expected != null && actual < expected;
  return (
    <div className="vt-bullet">
      <div className="vt-bullet-track" aria-hidden="true">
        <span className="vt-bullet-fill" style={{ width: `${actualPct}%`, background: behind ? "#b91c1c" : "#0573b0" }} />
        <span className="vt-bullet-target" style={{ left: `${targetPct}%` }} />
        {expectedPct != null ? <span className="vt-bullet-mark" style={{ left: `${expectedPct}%` }} /> : null}
      </div>
      <p>
        <strong>{count(actual)}</strong> de {count(target)} unidades
        {expected == null || Math.abs(expected - target) < 0.05 ? "." : `. A esta fecha el ritmo de la meta va en ${count(expected)}.`}
      </p>
      <p className="op-note">La barra es lo vendido. La marca es el ritmo. La línea es la meta del periodo.</p>
    </div>
  );
}

function Projects({ vista, onProject }: { vista: TotalesVista; onProject: (id: string, label: string) => void }) {
  const rows = vista.byProject.filter((row) => isDisplayProject(row.label) && (row.units !== 0 || (row.gtq != null && row.gtq !== 0)));
  const max = Math.max(...rows.map((row) => Math.max(row.units, 0)), 1);
  const total = rows.reduce((sum, row) => sum + row.units, 0);
  if (rows.length === 0) return <p className="op-note">Ningún proyecto tiene venta neta en este periodo.</p>;
  return (
    <div className="vt-projects">
      {rows.map((row) => {
        const width = Math.max(row.units > 0 ? 6 : 0, (Math.max(row.units, 0) / max) * 100);
        const share = total === 0 ? null : row.units / total;
        return (
          <button key={row.id} type="button" className="vt-project" onClick={() => onProject(row.id, row.label)}>
            <span className="vt-project-name">{row.label}</span>
            <span className="vt-track" aria-hidden="true">
              <span className="vt-fill" style={{ width: `${width}%` }} />
            </span>
            <span className="vt-project-num">{count(row.units)}</span>
            <span className="vt-project-num">{money(row.gtq)}</span>
            <span className="vt-project-num">{share == null ? "—" : pct(share)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Blockers({ rows, total }: { rows: BlockerRow[]; total: number }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "days", dir: "desc" });
  const sorted = useMemo(() => {
    const copy = [...rows];
    const dir = sort.dir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      const value = compareBlocker(a, b, sort.key);
      if (value !== 0) return value * dir;
      if (a.severity !== b.severity) return a.severity === "alta" ? -1 : 1;
      return a.unit.localeCompare(b.unit, "es");
    });
    return copy;
  }, [rows, sort]);

  function toggle(key: SortKey) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "unit" || key === "who" || key === "stage" || key === "missing" ? "asc" : "desc" }));
  }

  function exportRows() {
    const header = ["Unidad", "Trato", "Proyecto", "Asesor", "Etapa", "Falta", "Días", "Valor"];
    const lines = sorted.map((row) =>
      [row.unit, row.deal, row.project, row.asesor, row.stage, row.missing, row.days == null ? "" : String(row.days), row.gtq == null ? "" : String(row.gtq)]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([`\uFEFF${[header.join(","), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tratos-sin-venta.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="vt-card" aria-label="Tratos que todavía no son venta">
      <header className="vt-card-head">
        <div>
          <h2>Tratos que todavía no son venta</h2>
          <p>
            Tienen reserva, promesa o recibo en el periodo y no cierran las dos puertas.
            {total > rows.length ? ` Se muestran ${rows.length} de ${total}.` : ""}
          </p>
        </div>
        <button type="button" className="op-text" onClick={exportRows} disabled={sorted.length === 0}>Exportar</button>
      </header>
      {sorted.length === 0 ? (
        <p className="op-note">Ningún trato del periodo se quedó sin cerrar las dos puertas.</p>
      ) : (
        <div className="vt-table-wrap">
          <table className="vt-table">
            <thead>
              <tr>
                <Th label="Unidad / trato" active={sort.key === "unit"} dir={sort.dir} onClick={() => toggle("unit")} />
                <Th label="Proyecto · asesor" active={sort.key === "who"} dir={sort.dir} onClick={() => toggle("who")} />
                <Th label="Etapa" active={sort.key === "stage"} dir={sort.dir} onClick={() => toggle("stage")} />
                <Th label="Falta" active={sort.key === "missing"} dir={sort.dir} onClick={() => toggle("missing")} />
                <Th label="Días" active={sort.key === "days"} dir={sort.dir} onClick={() => toggle("days")} />
                <Th label="Valor" active={sort.key === "gtq"} dir={sort.dir} onClick={() => toggle("gtq")} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.unit}</strong>
                    <small>{row.deal}</small>
                  </td>
                  <td>
                    {row.project}
                    <small>{row.asesor}</small>
                  </td>
                  <td>{row.stage}</td>
                  <td className={row.severity === "alta" ? "vt-alta" : "vt-media"}>{row.missing}</td>
                  <td>{row.days == null ? "—" : count(row.days)}</td>
                  <td>{money(row.gtq)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function compareBlocker(a: BlockerRow, b: BlockerRow, key: SortKey): number {
  if (key === "unit") return a.unit.localeCompare(b.unit, "es");
  if (key === "who") return a.project.localeCompare(b.project, "es") || a.asesor.localeCompare(b.asesor, "es");
  if (key === "stage") return a.stage.localeCompare(b.stage, "es");
  if (key === "missing") return a.missing.localeCompare(b.missing, "es");
  if (key === "days") return (a.days ?? -1) - (b.days ?? -1);
  return (a.gtq ?? -1) - (b.gtq ?? -1);
}

function Th({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th>
      <button type="button" onClick={onClick} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
        {label}
        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function StageDialog({ stage, onClose }: { stage: FunnelStage; onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="op-overlay">
      <button type="button" className="op-backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="op-modal" role="dialog" aria-label={stage.label}>
        <header>
          <h2>{stage.label}: {count(stage.count)}</h2>
          <button type="button" onClick={onClose}>Cerrar</button>
        </header>
        {stage.footnote ? <p className="op-note">{stage.footnote}</p> : null}
        <DealList {...listedDeals("En esta etapa", stage.deals, stage.listTotal)} />
        {stage.droppedTotal > 0 ? <DealList {...listedDeals(stage.droppedTitle, stage.dropped, stage.droppedTotal)} /> : null}
        {stage.enteredTotal > 0 ? <DealList {...listedDeals(stage.enteredTitle, stage.entered, stage.enteredTotal)} /> : null}
      </div>
    </div>
  );
}

function listedDeals(title: string, rows: StageDeal[], total: number): { title: string; rows: StageDeal[]; total: number } {
  const kept = rows.filter((row) => isDisplayProject(row.project));
  return { title, rows: kept, total: Math.max(kept.length, total - (rows.length - kept.length)) };
}

function DealList({ title, rows, total }: { title: string; rows: StageDeal[]; total: number }) {
  return (
    <div className="op-modal-scroll">
      <h3>{title}{total > rows.length ? ` · ${rows.length} de ${total}` : ""}</h3>
      {rows.length === 0 ? <p className="op-note">Sin tratos en esta lista.</p> : (
        <table>
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Trato</th>
              <th>Proyecto</th>
              <th>Asesor</th>
              <th>Fecha</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.unit}</td>
                <td>{row.deal}</td>
                <td>{row.project}</td>
                <td>{row.asesor}</td>
                <td>{row.day ? dotted(row.day) : "—"}</td>
                <td>{money(row.gtq)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
