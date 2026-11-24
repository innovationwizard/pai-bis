"use client";

import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { leakage, type EmbudoDeal, type EmbudoFunnel, type Leakage, type LeakageTone } from "@/lib/ventas/embudo";
import type { ConversionVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import styles from "./tasa.module.css";

const countFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
const COLUMN_HEADROOM = 1.14;

function activateColumn(event: ReactKeyboardEvent<HTMLButtonElement>, action: () => void) {
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

function zText(z: number): string {
  if (!Number.isFinite(z)) return z < 0 ? "(Z = -∞)" : "(Z = ∞)";
  const rounded = Math.round(z * 100) / 100;
  const body = rounded === 0 ? "0.00" : rounded.toFixed(2);
  return `(Z = ${body})`;
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

function LeakCard({
  name,
  reading,
  atZero,
}: {
  name: string;
  reading: Leakage;
  atZero: boolean;
}) {
  const stage = atZero ? "0" : (reading.stage ?? "Saludable");
  const tone: LeakageTone = atZero ? "green" : reading.tone;
  const z = atZero ? 0 : reading.z;
  return (
    <div className={band.kpi}>
      <span className={band.kpiName}>{name}</span>
      <span className={styles.leak}>
        <span className={styles.leakStage}>{stage}</span>
        <span className={styles.zPill} data-tone={tone}>{zText(z)}</span>
      </span>
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
    <div className={styles.funnel} role="group" aria-label={`Etapas de ${funnel.label}`}>
      {funnel.bars.map((bar, index) => {
        const height = (Math.max(0, bar.count) / scale) * 100;
        const countKey = `${funnel.slug}:${index}`;
        const rateKey = `${funnel.slug}:rate:${index}`;
        const next = funnel.bars[index + 1];
        const openCount = () => onCount(countKey, reached(funnel.deals, index + 1));
        return (
          <div key={bar.label} className={styles.stageWrap}>
            <div className={styles.stage}>
              <button
                type="button"
                className={styles.plot}
                aria-pressed={openKey === countKey}
                aria-label={`${funnel.label}. ${bar.label}: ${count(bar.count)}`}
                onClick={openCount}
                onKeyDown={(event) => activateColumn(event, openCount)}
              >
                <span className={styles.num} style={{ bottom: `calc(${height}% + 2px)` }}>{count(bar.count)}</span>
                <span
                  className={styles.bar}
                  data-project={hue || undefined}
                  style={{ height: `${height}%` }}
                />
              </button>
              <span className={styles.name}><span>{bar.label}</span></span>
            </div>
            {bar.hasNext && next ? (
              <div className={styles.joint}>
                <button
                  type="button"
                  className={styles.rate}
                  aria-pressed={openKey === rateKey}
                  aria-label={`${bar.label} a ${next.label}: ${percent(bar.nextRate ?? 0)}`}
                  onClick={() => onRate(rateKey, reached(funnel.deals, index + 2))}
                >
                  {percent(bar.nextRate ?? 0)}
                </button>
              </div>
            ) : null}
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

  const atZero = vista != null && vista.funnels.length === 0;
  const portfolio = vista?.all ?? null;
  const heroLeak = portfolio ? leakage(portfolio, portfolio) : null;

  return (
    <section id="tasa-de-conversion" className={band.block} aria-labelledby="vt-tasa-title">
      <h2 id="vt-tasa-title" className={styles.title}>Tasa de conversión</h2>
      {vista == null || portfolio == null || heroLeak == null ? pending : (
        <div className={band.fold}>
          <div className={`${band.top} ${band.overview}`}>
            <div className={band.rail}>
              <LeakCard name="Todos los Proyectos" reading={heroLeak} atZero={atZero} />
            </div>
            <div className={`${band.hero} ${band.ogCard} ${styles.funnelCard}`}>
              <StageColumns
                funnel={portfolio}
                hue=""
                openKey={proof?.key ?? null}
                onCount={show}
                onRate={show}
              />
            </div>
          </div>
          {atZero ? null : (
            <div className={band.projects}>
              {vista.funnels.map((funnel) => (
                <div key={funnel.slug} className={band.top}>
                  <div className={band.rail}>
                    <LeakCard name={funnel.label} reading={leakage(funnel, portfolio)} atZero={false} />
                  </div>
                  <div className={`${band.hero} ${band.ogCard} ${styles.funnelCard}`}>
                    <StageColumns
                      funnel={funnel}
                      hue={hueKey(funnel.label)}
                      openKey={proof?.key ?? null}
                      onCount={show}
                      onRate={show}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
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
