"use client";

import HorizontalBarChart from "@/components/charts/horizontal-bar-chart";
import BulletChart from "@/components/bullet-chart";
import presupuestosMercadeo from "@/app/pabi/contable/data/presupuestos-mercadeo.json";
import type { CentrosCosto, FondeoStatus, MercadeoOficial } from "@/app/pabi/contable/contable-charts";

const gastos = presupuestosMercadeo.rows["1"] as MercadeoOficial;
const fondeos = presupuestosMercadeo.rows["2"] as FondeoStatus;
const centros = presupuestosMercadeo.rows["3"] as CentrosCosto;

const money = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 0,
});

function pct(value: number): string {
  const n = value * 100;
  return `${new Intl.NumberFormat("es-GT", { maximumFractionDigits: n >= 10 ? 0 : 1 }).format(n)}%`;
}

export default function DirectivoView() {
  const presupuesto = gastos.semestre.presupuesto;
  const real = gastos.semestre.real;
  const ratio = presupuesto > 0 ? real / presupuesto : null;
  const over = ratio != null && ratio > 1;
  const fondeoMercadeo = fondeos.porProyecto.reduce((sum, row) => sum + row.mercadeo, 0);

  return (
    <div className="op-screen">
      <div className="op-toolbar">
        <p className="op-range">Periodo {gastos.semestre.periodo}. El fondeo es el acumulado de cada proyecto.</p>
      </div>
      <section className="op-hero op-hero-budget" aria-label="Gastos de mercadeo contra presupuesto">
        <header className="op-head">
          <div>
            <h2>Gastos de mercadeo</h2>
            <p className="op-figure">
              <span style={{ color: over ? "#b91c1c" : "#0573b0" }}>{ratio == null ? "Sin presupuesto" : pct(ratio)}</span>
              <small>
                {money.format(real)} de {money.format(presupuesto)} · {gastos.semestre.periodo}
              </small>
            </p>
            <p className="op-note">Acumulado desde el inicio de cada proyecto: {money.format(gastos.acumulado.value)}.</p>
          </div>
        </header>
        <div className="op-chart op-clip">
          <BulletChart
            lowerIsBetter
            formatValue={(value) => money.format(value)}
            items={gastos.porProyecto.map((row) => ({
              label: row.name,
              value: row.realSemestre,
              target: row.presupuestoSemestre,
              subtitle: `anual ${money.format(row.presupuestoAnual)}`,
            }))}
          />
        </div>
      </section>
      <div className="op-mid">
        <section className="op-hero" aria-label="Fondeo de mercadeo por proyecto">
          <header className="op-head">
            <div>
              <h2>Fondeo de mercadeo</h2>
              <p className="op-figure">
                <span>{money.format(fondeoMercadeo)}</span>
                <small>acumulado por proyecto</small>
              </p>
            </div>
          </header>
          <div className="op-chart op-clip">
            <HorizontalBarChart
              labelWidth={148}
              format={(value) => money.format(value)}
              data={fondeos.porProyecto.map((row) => ({ label: row.name, value: row.mercadeo }))}
            />
          </div>
        </section>
        <section className="op-hero" aria-label="Gasto por centro de costo">
          <header className="op-head">
            <div>
              <h2>Centros de costo</h2>
              <p className="op-figure">
                <span>{money.format(centros.totalTodosLosCentros)}</span>
                <small>{centros.periodo} · planilla por área</small>
              </p>
            </div>
          </header>
          <div className="op-chart op-clip">
            <HorizontalBarChart
              labelWidth={156}
              format={(value) => money.format(value)}
              data={centros.centros.map((row) => ({
                label: row.name,
                value: row.gasto ?? 0,
                noData: row.gasto == null,
              }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
