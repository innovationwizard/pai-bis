"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LabelList, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { ValorProject, ValorUnitLine, ValorVista } from "@/lib/ventas/vista-types";
import band from "./landing-blocks.module.css";
import local from "./valor-proyecto.module.css";

const moneyFormat = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 0,
});
const dollarFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function money(value: number): string {
  return moneyFormat.format(value);
}

function dollars(value: number): string {
  return dollarFormat.format(value);
}

function hueKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function percentOf(discount: number, list: number): string | null {
  if (list <= 0) return null;
  return `${Math.round((discount / list) * 100)}%`;
}

function discountText(discount: number, list: number): string {
  const percent = percentOf(discount, list);
  return percent ? `${money(discount)} (${percent})` : money(discount);
}

function amountText(unit: ValorUnitLine): string {
  if (unit.amount == null) return "sin precio";
  return unit.currency === "USD" ? dollars(unit.amount) : money(unit.amount);
}

function unitLine(unit: ValorUnitLine): string {
  const currency = unit.currency || "sin moneda";
  return `${unit.project} · ${unit.torre} · ${unit.code} · ${amountText(unit)} · ${currency}`;
}

function discountLine(unit: ValorUnitLine): string {
  return `${unit.project} · ${unit.torre} · ${unit.code} · ${money(unit.discountGtq)} · GTQ`;
}

type Column = {
  key: string;
  name: string;
  value: number;
  hue: string;
};

function scaleOf(values: readonly number[]): number {
  const peak = values.reduce((max, value) => Math.max(max, value), 0);
  return peak > 0 ? peak * 1.14 : 1;
}

function Columns({
  columns,
  scale,
  level,
  label,
  openKey,
  onOpen,
}: {
  columns: readonly Column[];
  scale: number;
  level: "project" | "asesor";
  label: string;
  openKey: string | null;
  onOpen: (column: Column) => void;
}) {
  return (
    <div className={band.ogCols} data-level={level} role="group" aria-label={label}>
      {columns.map((column) => {
        const height = (Math.max(0, column.value) / scale) * 100;
        const open = openKey === column.key;
        return (
          <button
            key={column.key}
            type="button"
            className={`${band.ogCol} ${local.hit}`}
            data-open={open ? "true" : "false"}
            aria-pressed={open}
            aria-label={`${column.name}: ${money(column.value)}`}
            onClick={() => onOpen(column)}
          >
            <span className={band.ogColBody}>
              <span className={band.ogPlotWrap}>
                <span className={band.ogPlot}>
                  <span className={band.ogNum} style={{ bottom: `calc(${height}% + 2px)` }}>{money(column.value)}</span>
                  <span className={band.ogBar} data-project={column.hue || undefined} style={{ height: `${height}%` }} />
                </span>
              </span>
            </span>
            <span className={band.ogName}>{column.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function ValueCard({
  name,
  list,
  discount,
  onList,
  onDiscount,
}: {
  name: string;
  list: number;
  discount: number;
  onList: () => void;
  onDiscount: () => void;
}) {
  return (
    <div className={band.kpi}>
      <span className={band.kpiName}>{name}</span>
      <button type="button" className={local.value} onClick={onList}>
        {money(list)}
      </button>
      <button
        type="button"
        className={`${local.pill} ${discount > 0 ? band.down : band.flat}`}
        onClick={onDiscount}
      >
        {discountText(discount, list)}
      </button>
    </div>
  );
}

function pointLabel(value: unknown, currency: string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return currency === "USD" ? dollars(n) : money(n);
}

export function ValorProyecto({
  vista,
  pending,
}: {
  vista: ValorVista | null;
  pending: ReactNode;
}) {
  const board = vista?.board ?? null;
  const projects = board?.projects ?? [];
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [proof, setProof] = useState<{ key: string; lines: string[] } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openProject = projects.find((project) => project.slug === openSlug) ?? null;
  const heroScale = scaleOf(projects.map((project) => project.listGtq));
  const towerScale = scaleOf(projects.flatMap((project) => project.towers.map((tower) => tower.listGtq)));

  useEffect(() => {
    if (openSlug && !projects.some((project) => project.slug === openSlug)) setOpenSlug(null);
  }, [openSlug, projects]);

  useEffect(() => {
    if (!openProject) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenSlug(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openProject]);

  function orderedUnits(units: readonly ValorUnitLine[]): ValorUnitLine[] {
    return [...units].sort((a, b) => a.torre.localeCompare(b.torre, "es") || a.code.localeCompare(b.code, "es", { numeric: true }));
  }

  function showList(key: string, units: readonly ValorUnitLine[]) {
    const lines = orderedUnits(units).map(unitLine);
    setProof((current) => (current?.key === key ? null : { key, lines }));
  }

  function showDiscount(key: string, units: readonly ValorUnitLine[]) {
    const lines = orderedUnits(units).filter((unit) => unit.discountGtq > 0).map(discountLine);
    setProof((current) => (current?.key === key ? null : { key, lines }));
  }

  function openTrajectory(project: ValorProject) {
    setProof(null);
    setOpenSlug(project.slug);
  }

  return (
    <section id="valor-del-proyecto" className={band.block} aria-labelledby="vt-valor-title">
      <h2 id="vt-valor-title" className={local.title}>Valor de proyecto</h2>
      {vista?.notice ? <p className={local.notice}>{vista.notice}</p> : null}
      {!board ? pending : (
        <div className={band.fold}>
          <div className={`${band.top} ${band.overview}`}>
            <div className={band.rail}>
              <ValueCard
                name="Todos los Proyectos"
                list={board.listGtq}
                discount={board.discountGtq}
                onList={() => showList("todos", projects.flatMap((project) => project.units))}
                onDiscount={() => showDiscount("todos-descuento", projects.flatMap((project) => project.units))}
              />
            </div>
            <div className={`${band.hero} ${band.ogCard}`}>
              {projects.length > 0 ? (
                <Columns
                  columns={projects.map((project) => ({
                    key: project.slug,
                    name: project.label,
                    value: project.listGtq,
                    hue: hueKey(project.label),
                  }))}
                  scale={heroScale}
                  level="project"
                  label="Proyectos"
                  openKey={openSlug}
                  onOpen={(column) => {
                    const project = projects.find((item) => item.slug === column.key);
                    if (project) openTrajectory(project);
                  }}
                />
              ) : null}
            </div>
          </div>
          {projects.length > 0 ? (
            <div className={band.projects}>
              {projects.map((project) => (
                <div key={project.slug} className={`${band.top} ${local.band}`}>
                  <div className={band.rail}>
                    <ValueCard
                      name={project.label}
                      list={project.listGtq}
                      discount={project.discountGtq}
                      onList={() => showList(project.slug, project.units)}
                      onDiscount={() => showDiscount(`${project.slug}-descuento`, project.units)}
                    />
                  </div>
                  <div className={`${band.hero} ${band.ogCard}`}>
                    <Columns
                      columns={project.towers.map((tower) => ({
                        key: `${project.slug}:${tower.label}`,
                        name: tower.label,
                        value: tower.listGtq,
                        hue: hueKey(project.label),
                      }))}
                      scale={towerScale}
                      level="asesor"
                      label={`Torres de ${project.label}`}
                      openKey={proof?.key ?? null}
                      onOpen={(column) => {
                        const tower = project.towers.find((item) => `${project.slug}:${item.label}` === column.key);
                        if (tower) showList(column.key, tower.units);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {proof ? (
        <div className={local.proof} role="dialog" aria-label="Unidades">
          <button type="button" onClick={() => setProof(null)}>Cerrar</button>
          {proof.lines.length > 0 ? (
            <ul>
              {proof.lines.map((line, index) => <li key={`${index}:${line}`}>{line}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
      {openProject ? (
        <aside className={local.drawer} role="dialog" aria-label={openProject.label}>
          <div className={local.drawerHead}>
            <h3>{openProject.label}</h3>
            <button ref={closeRef} type="button" onClick={() => setOpenSlug(null)}>Cerrar</button>
          </div>
          <div className={local.plot}>
            {openProject.history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={openProject.history} margin={{ left: 8, right: 12, top: 28, bottom: 8 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    interval={openProject.history.length > 6 ? "preserveStartEnd" : 0}
                  />
                  <YAxis hide width={0} />
                  <Line type="monotone" dataKey="gtq" stroke="#0d2041" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}>
                    <LabelList dataKey="gtq" position="top" formatter={(value) => pointLabel(value, openProject.currency)} fill="#0d2041" fontSize={11} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </aside>
      ) : null}
    </section>
  );
}
