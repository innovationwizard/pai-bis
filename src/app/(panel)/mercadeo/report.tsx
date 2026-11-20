import { Fragment } from "react";
import { formatDataAsOf } from "@/app/pabi/data-as-of";
import { performanceAds } from "@/lib/mercadeo/performance-ads-data";
import PerformanceAdsView from "./performance-ads-view";
import { MERCADEO_SECTIONS } from "./sections";

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

export default function MercadeoReport() {
  return (
    <div className="vc-command">
      <header className="vc-head cc-filter-battery">
        <p className="op-range">
          <span>
            {dotted(performanceAds.desde)} – {dotted(performanceAds.hasta)}
          </span>
          <span className="op-fresh">{formatDataAsOf(performanceAds.loadedThrough, true)}</span>
        </p>
        <hr className="op-filter-rule" />
      </header>
      {MERCADEO_SECTIONS.map((section, index) => (
        <Fragment key={section.slug}>
          {index > 0 ? <hr className="op-filter-rule vc-band-rule" /> : null}
          <section id={section.slug} className="mk-band" aria-labelledby={`${section.slug}-title`}>
            <h2 id={`${section.slug}-title`}>{section.title}</h2>
            {section.slug === "performance-ads" ? <PerformanceAdsView /> : null}
          </section>
        </Fragment>
      ))}
    </div>
  );
}
