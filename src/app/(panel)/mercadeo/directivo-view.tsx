"use client";

import GhostCard from "@/app/pabi/ghost-card";
import presupuestosMercadeo from "@/app/pabi/contable/data/presupuestos-mercadeo.json";
import type { MercadeoOficial } from "@/app/pabi/contable/contable-charts";

const gastos = presupuestosMercadeo.rows["1"] as MercadeoOficial;

export default function DirectivoView() {
  return (
    <div className="op-screen">
      <div className="op-toolbar">
        <p className="op-range">Periodo {gastos.semestre.periodo}. El fondeo es el acumulado de cada proyecto.</p>
      </div>
      <GhostCard missing="Gastos de mercadeo" />
      <div className="op-mid">
        <GhostCard missing="Fondeo de mercadeo" />
        <GhostCard missing="Centros de costo" />
      </div>
    </div>
  );
}
