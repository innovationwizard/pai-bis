import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const SHEET = "Performance - Data Base PA";
const FROM = "2026-01-01";
const TO = "2026-07-31";
const WORKBOOK = path.join(
  process.cwd(),
  "docs-mercadeo-oct-09",
  "performance-dashboard-puerta-abierta-pbix_2026-08-06",
  "Performance-Report-Puerta-Abierta.xlsx",
);

const DATE_HEADERS = ["Fecha"] as const;
const SUM_HEADERS = ["Alcance", "Clientes potenciales", "Importe gastado (USD)"] as const;

export type PerformanceAdsSums = {
  alcance: number;
  importeGastadoUsd: number;
  clientesPotenciales: number;
  desde: typeof FROM;
  hasta: typeof TO;
  loadedThrough: string;
  rows: number;
};

type Cache = { mtimeMs: number; value: PerformanceAdsSums };

let cache: Cache | null = null;

function isoDay(value: unknown): string | null {
  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    return match?.[1] ?? null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return utc.toISOString().slice(0, 10);
  }
  return null;
}

function finite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function headerName(cell: unknown): string {
  return typeof cell === "string" ? cell.trim() : "";
}

export function loadPerformanceAdsSums(): PerformanceAdsSums {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(WORKBOOK);
  } catch (error) {
    console.error("Pauta de Meta no disponible", error);
    throw new Error("No se pudo leer la pauta de Meta.");
  }
  if (cache && cache.mtimeMs === stat.mtimeMs) return cache.value;

  const workbook = XLSX.read(fs.readFileSync(WORKBOOK), { type: "buffer" });
  const sheet = workbook.Sheets[SHEET];
  if (!sheet) throw new Error("No se pudo leer la pauta de Meta.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });
  const headers = (matrix[0] ?? []).map(headerName);
  const column = (name: string) => headers.indexOf(name);
  const fechaIdx = column(DATE_HEADERS[0]);
  const alcanceIdx = column(SUM_HEADERS[0]);
  const leadsIdx = column(SUM_HEADERS[1]);
  const usdIdx = column(SUM_HEADERS[2]);
  if (fechaIdx < 0 || alcanceIdx < 0 || leadsIdx < 0 || usdIdx < 0) {
    throw new Error("No se pudo leer la pauta de Meta.");
  }

  let alcance = 0;
  let importe = 0;
  let leads = 0;
  let rows = 0;
  let loadedThrough = "";

  for (const row of matrix.slice(1)) {
    const day = isoDay(row[fechaIdx]);
    if (!day) continue;
    if (day > loadedThrough) loadedThrough = day;
    if (day < FROM || day > TO) continue;
    const alcanceCell = finite(row[alcanceIdx]);
    const leadCell = finite(row[leadsIdx]);
    const usdCell = finite(row[usdIdx]);
    if (alcanceCell != null) alcance += alcanceCell;
    if (leadCell != null) leads += leadCell;
    if (usdCell != null) importe += usdCell;
    rows += 1;
  }

  if (rows === 0 || loadedThrough === "") throw new Error("No se pudo leer la pauta de Meta.");

  const value: PerformanceAdsSums = {
    alcance,
    importeGastadoUsd: Math.round(importe * 100) / 100,
    clientesPotenciales: leads,
    desde: FROM,
    hasta: TO,
    loadedThrough,
    rows,
  };
  cache = { mtimeMs: stat.mtimeMs, value };
  return value;
}
