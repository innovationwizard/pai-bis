"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { EmbudoDeal, EmbudoFunnel } from "@/lib/ventas/embudo";
import type { ConversionVista } from "@/lib/ventas/vista-types";
import styles from "./tasa.module.css";

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });

const PROJECT_INK: Record<string, string> = {
  "boulevard-5": "#3d6f8f",
  benestare: "#0d2041",
  "bosque-las-tapias": "#0573b0",
  "santa-elena": "#1a4a68",
};

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

function FunnelChart({
  funnel,
  ink,
  openKey,
  onCount,
  onRate,
}: {
  funnel: EmbudoFunnel;
  ink: string;
  openKey: string | null;
  onCount: (key: string, deals: readonly EmbudoDeal[]) => void;
  onRate: (key: string, deals: readonly EmbudoDeal[]) => void;
}) {
  const peak = funnel.bars.reduce((max, bar) => Math.max(max, bar.count), 0);
  return (
    <article className={styles.funnel} aria-label={funnel.label}>
      <h3 className={styles.name}>{funnel.label}</h3>
      {funnel.bars.map((bar, index) => {
        const width = peak > 0 ? (bar.count / peak) * 100 : 0;
        const inside = bar.count > 0 && width >= 12;
        const countKey = `${funnel.slug}:${index}`;
        const rateKey = `${funnel.slug}:rate:${index}`;
        return (
          <div key={bar.label}>
            <div className={styles.stage}>
              <span className={styles.label}>{bar.label}</span>
              <span className={styles.track}>
                <span
                  className={styles.fill}
                  style={{ width: `${width}%`, background: bar.count > 0 ? ink : "transparent" }}
                />
                <button
                  type="button"
                  className={styles.count}
                  aria-pressed={openKey === countKey}
                  aria-label={`${funnel.label}. ${bar.label}: ${count(bar.count)}`}
                  style={{
                    left: inside ? `calc(${width}% - 8px)` : `calc(${width}% + 6px)`,
                    transform: inside ? "translateX(-100%)" : "none",
                    color: inside ? "#fff" : ink,
                  }}
                  onClick={() => onCount(countKey, reached(funnel.deals, index + 1))}
                >
                  {count(bar.count)}
                </button>
              </span>
            </div>
            {bar.hasNext ? (
              <button
                type="button"
                className={styles.rate}
                aria-pressed={openKey === rateKey}
                aria-label={`${bar.label} a ${funnel.bars[index + 1]?.label ?? ""}: ${percent(bar.nextRate ?? 0)}`}
                onClick={() => onRate(rateKey, reached(funnel.deals, index + 2))}
              >
                {percent(bar.nextRate ?? 0)}
              </button>
            ) : null}
          </div>
        );
      })}
    </article>
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
        <>
          <FunnelChart
            funnel={vista.all}
            ink="#0d2041"
            openKey={proof?.key ?? null}
            onCount={show}
            onRate={show}
          />
          {vista.funnels.map((funnel) => (
            <FunnelChart
              key={funnel.slug}
              funnel={funnel}
              ink={PROJECT_INK[funnel.slug] ?? "#0d2041"}
              openKey={proof?.key ?? null}
              onCount={show}
              onRate={show}
            />
          ))}
        </>
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
