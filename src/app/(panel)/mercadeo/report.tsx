"use client";

import { useMemo, useState } from "react";
import { ProjectPillRow } from "@/components/project-pill-row";
import { formatDataAsOf } from "@/app/pabi/data-as-of";
import { projectPillOptions } from "@/lib/projects";
import { buildPerformanceAds } from "@/lib/mercadeo/performance-ads-data";
import { resolveRange, windowLabel, type PeriodPreset } from "@/lib/ventas/period";
import PerformanceAdsView from "./performance-ads-view";

const PILL_CHOICES = [
  { id: "boulevard-5", label: "Boulevard 5" },
  { id: "benestare", label: "Benestare" },
  { id: "bosque-las-tapias", label: "Bosque Las Tapias" },
  { id: "santa-elena", label: "Santa Elena" },
] as const;

const ACCOUNT_BY_PILL: Record<string, string> = {
  "boulevard-5": "Boulevard5",
  benestare: "Benestare",
  "bosque-las-tapias": "Bosque Las Tapias",
  "santa-elena": "Santa Elena",
};

type BarState = {
  periodo: PeriodPreset;
  desde: string;
  hasta: string;
  proyectos: string[] | null;
  asesor: string;
};

const INITIAL: BarState = {
  periodo: "custom",
  desde: "2026-01-01",
  hasta: "2026-07-31",
  proyectos: null,
  asesor: "",
};

const projectOptions = projectPillOptions(PILL_CHOICES);
const projectIds = projectOptions.map((option) => option.id).filter((id) => id !== "");

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function dottedSpan(label: string): string {
  return label.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => dotted(iso));
}

export default function MercadeoReport() {
  const [bar, setBar] = useState<BarState>(INITIAL);
  const range = resolveRange(bar.periodo, bar.desde, bar.hasta);
  const accountKey = bar.proyectos === null ? "todos" : bar.proyectos.join(",");
  const report = useMemo(() => {
    const accounts = bar.proyectos === null
      ? null
      : bar.proyectos.map((id) => ACCOUNT_BY_PILL[id]).filter((name): name is string => Boolean(name));
    return buildPerformanceAds(range.from, range.to, accounts);
  }, [range.from, range.to, accountKey, bar.proyectos]);
  const windowText = dottedSpan(windowLabel(range));
  const periodText = range.label === windowLabel(range) ? windowText : `${range.label}: ${windowText}`;
  const empty = report.accounts.length === 0;

  function update(patch: Partial<BarState>) {
    setBar((current) => ({ ...current, ...patch }));
  }

  function selectAllProjects() {
    setBar((current) => ({ ...current, proyectos: null }));
  }

  function toggleProject(id: string) {
    if (!id) return;
    setBar((current) => {
      const known = new Set(projectIds);
      const selected = current.proyectos === null ? projectIds : current.proyectos;
      const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
      const coversAll = projectIds.length > 0 && projectIds.every((item) => next.includes(item));
      const onlyKnown = next.every((item) => known.has(item));
      if (coversAll && onlyKnown) return { ...current, proyectos: null };
      return { ...current, proyectos: next };
    });
  }

  return (
    <div className="vc-command">
      <header className="vc-head cc-filter-battery">
        <ProjectPillRow
          options={projectOptions}
          selectedIds={bar.proyectos}
          onSelectAll={selectAllProjects}
          onToggle={toggleProject}
        />
        <div className="op-toolbar">
          <label>
            Periodo
            <select
              value={bar.periodo}
              onChange={(event) => update({ periodo: event.target.value as PeriodPreset })}
            >
              <option value="este-mes">Este mes</option>
              <option value="mes-anterior">Mes anterior</option>
              <option value="este-trimestre">Este trimestre</option>
              <option value="este-ano">Este año</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          {bar.periodo === "custom" ? (
            <>
              <label>
                Desde
                <input type="date" value={bar.desde} onChange={(event) => update({ desde: event.target.value })} />
              </label>
              <label>
                Hasta
                <input type="date" value={bar.hasta} onChange={(event) => update({ hasta: event.target.value })} />
              </label>
            </>
          ) : null}
          <label>
            Asesor
            <select value={bar.asesor} onChange={(event) => update({ asesor: event.target.value })}>
              <option value="">Todos</option>
            </select>
          </label>
          <button type="button" className="op-text" onClick={() => setBar(INITIAL)}>
            Restablecer
          </button>
          <p className="op-range">
            <span>{periodText}.</span>
            <span className="op-fresh">{formatDataAsOf(report.loadedThrough, true)}</span>
          </p>
        </div>
        {empty ? <p className="op-note">Sin pauta en el periodo.</p> : null}
        <hr className="op-filter-rule" />
      </header>
      <section id="performance-ads" className="mk-band" aria-labelledby="performance-ads-title">
        <h2 id="performance-ads-title">Performance Ads</h2>
        <PerformanceAdsView report={report} />
      </section>
    </div>
  );
}
