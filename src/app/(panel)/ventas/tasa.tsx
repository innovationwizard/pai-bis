"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { EmbudoDeal, EmbudoFunnel } from "@/lib/ventas/embudo";
import type { ConversionVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import styles from "./tasa.module.css";

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

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

function reservaCount(funnel: EmbudoFunnel): number {
  return funnel.bars.find((bar) => bar.label === "Reserva")?.count ?? 0;
}

function StageColumns({
  funnel,
  peak,
  openKey,
  onCount,
  onRate,
}: {
  funnel: EmbudoFunnel;
  peak: number;
  openKey: string | null;
  onCount: (key: string, deals: readonly EmbudoDeal[]) => void;
  onRate: (key: string, deals: readonly EmbudoDeal[]) => void;
}) {
  return (
    <div className={styles.cols} role="group" aria-label={funnel.label} style={{ gridTemplateColumns: `repeat(${Math.max(funnel.bars.length, 1)}, minmax(0, 1fr))` }}>
      {funnel.bars.map((bar, index) => {
        const height = peak > 0 ? (bar.count / peak) * 100 : 0;
        const countKey = `${funnel.slug}:${index}`;
        const rateKey = `${funnel.slug}:rate:${index}`;
        const next = funnel.bars[index + 1]?.label ?? "";
        return (
          <div key={bar.label} className={styles.col}>
            <button
              type="button"
              className={styles.num}
              aria-pressed={openKey === countKey}
              aria-label={`${funnel.label}. ${bar.label}: ${count(bar.count)}`}
              onClick={() => onCount(countKey, reached(funnel.deals, index + 1))}
            >
              {count(bar.count)}
            </button>
            {bar.hasNext ? (
              <button
                type="button"
                className={styles.rate}
                aria-pressed={openKey === rateKey}
                aria-label={`${bar.label} a ${next}: ${percent(bar.nextRate ?? 0)}`}
                onClick={() => onRate(rateKey, reached(funnel.deals, index + 2))}
              >
                {percent(bar.nextRate ?? 0)}
              </button>
            ) : null}
            <span className={styles.plot} aria-hidden="true">
              <span className={styles.fill} style={{ height: `${height}%` }} />
            </span>
            <span className={styles.colName}>{bar.label}</span>
          </div>
        );
      })}
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

  return (
    <section id="tasa-de-conversion" className={styles.block} aria-labelledby="vt-tasa-title">
      <h2 id="vt-tasa-title" className={styles.title}>Tasa de conversión</h2>
      {vista == null ? pending : (
        <div className={band.fold}>
          <div className={`${band.top} ${band.overview}`}>
            <div className={band.rail}>
              <button
                type="button"
                className={band.kpi}
                aria-label={`Todos los Proyectos: ${count(reservaCount(vista.all))} reservas`}
                onClick={() => show("todos:reserva", reached(vista.all.deals, 8))}
              >
                <span className={band.kpiName}>Todos los Proyectos</span>
                <span className={styles.figure}>{count(reservaCount(vista.all))}</span>
              </button>
            </div>
            <div className={band.hero}>
              <div className={styles.cols} role="group" aria-label="Proyectos" style={{ gridTemplateColumns: `repeat(${Math.max(vista.funnels.length, 1)}, minmax(0, 1fr))` }}>
                {vista.funnels.map((funnel) => {
                  const reservas = reservaCount(funnel);
                  const peak = Math.max(1, ...vista.funnels.map((row) => reservaCount(row)));
                  return (
                    <div key={funnel.slug} className={styles.col}>
                      <button
                        type="button"
                        className={styles.num}
                        aria-label={`${funnel.label}: ${count(reservas)} reservas`}
                        onClick={() => show(`${funnel.slug}:reserva`, reached(funnel.deals, 8))}
                      >
                        {count(reservas)}
                      </button>
                      <span className={styles.plot} aria-hidden="true">
                        <span className={styles.fill} style={{ height: `${(reservas / peak) * 100}%` }} />
                      </span>
                      <span className={styles.colName}>{funnel.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {vista.funnels.length > 0 ? (
            <div className={band.projects}>
              {vista.funnels.map((funnel) => (
                <div key={funnel.slug} className={band.top}>
                  <div className={band.rail}>
                    <div className={band.kpi} aria-label={`${funnel.label}: ${count(reservaCount(funnel))} reservas`}>
                      <span className={band.kpiName}>{funnel.label}</span>
                      <span className={styles.figure}>{count(reservaCount(funnel))}</span>
                    </div>
                  </div>
                  <div className={band.hero}>
                    <StageColumns
                      funnel={funnel}
                      peak={Math.max(1, ...funnel.bars.map((bar) => bar.count))}
                      openKey={proof?.key ?? null}
                      onCount={show}
                      onRate={show}
                    />
                  </div>
                </div>
              ))}
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
