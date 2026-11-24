"use client";

import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { EmbudoDeal, EmbudoFunnel } from "@/lib/ventas/embudo";
import type { ConversionVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import styles from "./tasa.module.css";

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
const COLUMN_HEADROOM = 1.14;

function activateColumn(event: ReactKeyboardEvent<HTMLDivElement>, action: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

function count(value: number): string {
  return countFormat.format(value);
}

function percent(rate: number): string {
  return `${percentFormat.format(Math.round(rate * 100))}%`;
}

function dotted(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function dealLine(deal: EmbudoDeal): string {
  return `${deal.project} · ${deal.stage} · ${dotted(deal.addOn)} · ${deal.id}`;
}

function reached(deals: readonly EmbudoDeal[], position: number): EmbudoDeal[] {
  return deals
    .filter((deal) => deal.stageOrder >= position)
    .sort((a, b) => b.stageOrder - a.stageOrder || a.addOn.localeCompare(b.addOn) || a.id.localeCompare(b.id, "es", { numeric: true }));
}

function hueKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scaleOf(values: readonly number[]): number {
  const peak = values.reduce((max, value) => Math.max(max, value), 0);
  return peak > 0 ? peak * COLUMN_HEADROOM : 1;
}

function reservaCount(funnel: EmbudoFunnel): number {
  return funnel.bars.find((bar) => bar.label === "Reserva")?.count ?? 0;
}

function reservaDeals(funnel: EmbudoFunnel): EmbudoDeal[] {
  const index = funnel.bars.findIndex((bar) => bar.label === "Reserva");
  if (index < 0) return [];
  return reached(funnel.deals, index + 1);
}

function SummaryColumns({
  funnels,
  openKey,
  onOpen,
}: {
  funnels: readonly EmbudoFunnel[];
  openKey: string | null;
  onOpen: (key: string, deals: readonly EmbudoDeal[]) => void;
}) {
  const scale = scaleOf(funnels.map((funnel) => reservaCount(funnel)));
  return (
    <div className={band.ogCols} data-level="project" role="group" aria-label="Proyectos">
      {funnels.map((funnel) => {
        const units = reservaCount(funnel);
        const height = (Math.max(0, units) / scale) * 100;
        const key = `${funnel.slug}:reserva`;
        const open = () => onOpen(key, reservaDeals(funnel));
        return (
          <div
            key={funnel.slug}
            className={`${band.ogCol} ${styles.count}`}
            role="button"
            tabIndex={0}
            aria-pressed={openKey === key}
            aria-label={`${funnel.label}: ${count(units)}`}
            onClick={open}
            onKeyDown={(event) => activateColumn(event, open)}
          >
            <div className={band.ogColBody}>
              <div className={band.ogPlotWrap}>
                <div className={band.ogPlot}>
                  <span className={band.ogNum} style={{ bottom: `calc(${height}% + 2px)` }}>{count(units)}</span>
                  <span
                    className={band.ogBar}
                    data-project={hueKey(funnel.label) || undefined}
                    style={{ height: `${height}%` }}
                  />
                </div>
              </div>
            </div>
            <span className={band.ogName}>{funnel.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StageColumns({
  funnel,
  hue,
  openKey,
  onCount,
  onRate,
}: {
  funnel: EmbudoFunnel;
  hue: string;
  openKey: string | null;
  onCount: (key: string, deals: readonly EmbudoDeal[]) => void;
  onRate: (key: string, deals: readonly EmbudoDeal[]) => void;
}) {
  const scale = scaleOf(funnel.bars.map((bar) => bar.count));
  return (
    <div className={band.ogCols} data-level="asesor" role="group" aria-label={`Etapas de ${funnel.label}`}>
      {funnel.bars.map((bar, index) => {
        const height = (Math.max(0, bar.count) / scale) * 100;
        const countKey = `${funnel.slug}:${index}`;
        const rateKey = `${funnel.slug}:rate:${index}`;
        const next = funnel.bars[index + 1];
        const openCount = () => onCount(countKey, reached(funnel.deals, index + 1));
        return (
          <div
            key={bar.label}
            className={`${band.ogCol} ${styles.count}`}
            role="button"
            tabIndex={0}
            aria-pressed={openKey === countKey}
            aria-label={`${funnel.label}. ${bar.label}: ${count(bar.count)}`}
            onClick={openCount}
            onKeyDown={(event) => activateColumn(event, openCount)}
          >
            <div className={band.ogColBody}>
              <div className={band.ogPlotWrap}>
                <div className={band.ogPlot}>
                  <span className={band.ogNum} style={{ bottom: `calc(${height}% + 2px)` }}>{count(bar.count)}</span>
                  <span
                    className={band.ogBar}
                    data-project={hue || undefined}
                    style={{ height: `${height}%` }}
                  />
                </div>
              </div>
            </div>
            <span className={band.ogName}>{bar.label}</span>
            {bar.hasNext && next ? (
              <button
                type="button"
                className={`${band.ogDelta} ${styles.count}`}
                aria-pressed={openKey === rateKey}
                aria-label={`${bar.label} a ${next.label}: ${percent(bar.nextRate ?? 0)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRate(rateKey, reached(funnel.deals, index + 2));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") event.stopPropagation();
                }}
              >
                {percent(bar.nextRate ?? 0)}
              </button>
            ) : (
              <span className={band.ogDelta}>{"\u00a0"}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReservaFigure({
  units,
  pressed,
  label,
  onClick,
}: {
  units: number;
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${band.kpiValue} ${styles.count}`}
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
    >
      {count(units)}
      <span className={band.kpiUnit}>Reserva</span>
    </button>
  );
}

export function TasaBand({
  vista,
  pending,
}: {
  vista: ConversionVista | null;
  pending: ReactNode;
}) {
  const [proof, setProof] = useState<{ key: string; lines: string[] } | null>(null);

  useEffect(() => {
    if (!proof) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setProof(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [proof]);

  function show(key: string, deals: readonly EmbudoDeal[]) {
    const lines = deals.map(dealLine);
    setProof((current) => (current?.key === key ? null : { key, lines }));
  }

  const reservaKey = vista ? `${vista.all.slug}:reserva` : "";
  const reserva = vista ? reservaCount(vista.all) : 0;

  return (
    <section id="tasa-de-conversion" className={band.block} aria-labelledby="vt-tasa-title">
      <h2 id="vt-tasa-title" className={styles.title}>Tasa de conversión</h2>
      {vista == null ? pending : (
        <div className={band.fold}>
          <div className={`${band.top} ${band.overview}`}>
            <div className={band.rail}>
              <div className={band.kpi}>
                <span className={band.kpiName}>Todos los Proyectos</span>
                <ReservaFigure
                  units={reserva}
                  pressed={proof?.key === reservaKey}
                  label={`Todos los Proyectos. Reserva: ${count(reserva)}`}
                  onClick={() => show(reservaKey, reservaDeals(vista.all))}
                />
              </div>
            </div>
            <div className={`${band.hero} ${band.ogCard}`}>
              {vista.funnels.length > 0 ? (
                <SummaryColumns
                  funnels={vista.funnels}
                  openKey={proof?.key ?? null}
                  onOpen={show}
                />
              ) : null}
            </div>
          </div>
          {vista.funnels.length > 0 ? (
            <div className={band.projects}>
              {vista.funnels.map((funnel) => {
                const units = reservaCount(funnel);
                const key = `${funnel.slug}:reserva`;
                return (
                  <div key={funnel.slug} className={band.top}>
                    <div className={band.rail}>
                      <div className={band.kpi}>
                        <span className={band.kpiName}>{funnel.label}</span>
                        <ReservaFigure
                          units={units}
                          pressed={proof?.key === key}
                          label={`${funnel.label}. Reserva: ${count(units)}`}
                          onClick={() => show(key, reservaDeals(funnel))}
                        />
                      </div>
                    </div>
                    <div className={`${band.hero} ${band.ogCard}`}>
                      <StageColumns
                        funnel={funnel}
                        hue={hueKey(funnel.label)}
                        openKey={proof?.key ?? null}
                        onCount={show}
                        onRate={show}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
      {proof ? (
        <div className={styles.proof} role="dialog" aria-label="Tratos">
          <button type="button" onClick={() => setProof(null)}>Cerrar</button>
          {proof.lines.length > 0 ? (
            <ul>
              {proof.lines.map((line, index) => <li key={`${index}:${line}`}>{line}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
