"use client";

import {
  CentrosCostoChart,
  CesionClientesTable,
  CesionDirectivoCard,
  CobrosAlertasCard,
  CobrosResumenTable,
  ComisionesVentasChart,
  FondeoStatusTable,
  LiveDesistimientosCard,
  LiveExpedientesCard,
  MercadeoOficialCard,
  type CentrosCosto,
  type CesionClientes,
  type CesionDirectivo,
  type CobrosAlertasDesistimiento,
  type CobrosResumen,
  type ComisionesVentas,
  type FondeoStatus,
  type MercadeoOficial,
} from "@/app/pabi/contable/contable-charts";
import type { TierDrill } from "@/app/pabi/department-icons";
import presupuestosMercadeo from "@/app/pabi/contable/data/presupuestos-mercadeo.json";
import comisiones from "@/app/pabi/contable/data/comisiones.json";
import cobros from "@/app/pabi/contable/data/cobros.json";
import cesion from "@/app/pabi/contable/data/cesion-derechos.json";

const gastos = presupuestosMercadeo.rows["1"] as MercadeoOficial;
const fondeos = presupuestosMercadeo.rows["2"] as FondeoStatus;
const centros = presupuestosMercadeo.rows["3"] as CentrosCosto;
const cierreVentas = comisiones.rows["1"] as ComisionesVentas;
const cierreCobros = comisiones.rows["2"] as CobrosResumen;
const cobrosRecurrente = cobros.rows["1"] as CobrosResumen;
const cobrosAlertas = cobros.rows["2"] as CobrosAlertasDesistimiento;
const cesionClientes = cesion.rows["1"] as CesionClientes;
const cesionDirectivo = cesion.rows["2"] as CesionDirectivo;

export default function TierDrill({ drill }: { drill: TierDrill }) {
  return (
    <div className="ventas-board">
      {drill === "gastos-mercadeo" ? <MercadeoOficialCard data={gastos} /> : null}
      {drill === "fondeos" ? <FondeoStatusTable data={fondeos} /> : null}
      {drill === "centros-de-costos" ? <CentrosCostoChart data={centros} /> : null}
      {drill === "cierre-ventas" ? <ComisionesVentasChart data={cierreVentas} /> : null}
      {drill === "retencion-reembolso" ? <LiveDesistimientosCard num="2" /> : null}
      {drill === "gastos-administrativos" ? <LiveDesistimientosCard num="3" /> : null}
      {drill === "clientes-a-desistir" ? <LiveDesistimientosCard num="4" /> : null}
      {drill === "cesion-clientes" ? <CesionClientesTable data={cesionClientes} /> : null}
      {drill === "cesion-directivo" ? <CesionDirectivoCard data={cesionDirectivo} /> : null}
      {drill === "cobros-recurrente" ? <CobrosResumenTable data={cobrosRecurrente} /> : null}
      {drill === "cobros-alertas" ? <CobrosAlertasCard data={cobrosAlertas} /> : null}
      {drill === "cierre-cobros" ? <CobrosResumenTable data={cierreCobros} /> : null}
      {drill === "expedientes" ? <LiveExpedientesCard /> : null}
    </div>
  );
}
