import { Fragment } from "react";
import { formatDataAsOf } from "@/app/pabi/data-as-of";
import type { PerformanceAdsSums } from "@/lib/mercadeo/performance-ads";
import { MERCADEO_SECTIONS } from "./sections";

const exactCount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const exactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

/** Power BI card scale: 22,082,106 → 22M, 24,360 → 24K, 81,665.83 → $81.67K. */
function compactCount(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return exactCount.format(value);
}

function compactUsd(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(2)}K`;
  return `${sign}$${absolute.toFixed(2)}`;
}

function AdsCards({ sums, readError }: { sums: PerformanceAdsSums | null; readError: boolean }) {
  if (readError || sums == null) {
    return <p className="op-note">No se pudo leer la pauta de Meta.</p>;
  }
  const cards = [
    {
      label: "Alcance",
      compact: compactCount(sums.alcance),
      exact: exactCount.format(sums.alcance),
    },
    {
      label: "Importe gastado",
      compact: compactUsd(sums.importeGastadoUsd),
      exact: exactUsd.format(sums.importeGastadoUsd),
    },
    {
      label: "Clientes potenciales",
      compact: compactCount(sums.clientesPotenciales),
      exact: exactCount.format(sums.clientesPotenciales),
    },
  ];
  return (
    <div className="op-kpis op-kpis-3 mk-kpis">
      {cards.map((card) => (
        <p key={card.label} aria-label={`${card.label} ${card.exact}`}>
          <strong>{card.compact}</strong>
          <span>{card.label}</span>
          <small>{card.exact}</small>
        </p>
      ))}
    </div>
  );
}

export default function MercadeoReport({
  sums,
  readError,
}: {
  sums: PerformanceAdsSums | null;
  readError: boolean;
}) {
  const desde = sums?.desde ?? "2026-01-01";
  const hasta = sums?.hasta ?? "2026-07-31";
  return (
    <div className="vc-command">
      <header className="vc-head cc-filter-battery">
        <p className="op-range">
          <span>
            {dotted(desde)} – {dotted(hasta)}
          </span>
          {sums ? <span className="op-fresh">{formatDataAsOf(sums.loadedThrough, true)}</span> : null}
        </p>
        <hr className="op-filter-rule" />
      </header>
      {MERCADEO_SECTIONS.map((section, index) => (
        <Fragment key={section.slug}>
          {index > 0 ? <hr className="op-filter-rule vc-band-rule" /> : null}
          <section id={section.slug} className="mk-band" aria-labelledby={`${section.slug}-title`}>
            <h2 id={`${section.slug}-title`}>{section.title}</h2>
            {section.slug === "performance-ads" ? <AdsCards sums={sums} readError={readError} /> : null}
          </section>
        </Fragment>
      ))}
    </div>
  );
}
