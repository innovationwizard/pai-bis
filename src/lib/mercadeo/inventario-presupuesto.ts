import { adsGrain } from "./performance-ads-grain";
import { budgetGrain } from "./budget-grain";
import { inventoryGrain } from "./inventory-grain";

const SPEND_MONTHS = new Set(["2025-11", "2025-12", "2026-01", "2026-02"]);
const ADS_EPOCH_MS = Date.parse(`${adsGrain.epoch}T00:00:00Z`);
const INV_EPOCH_MS = Date.parse(`${inventoryGrain.epoch}T00:00:00Z`);

export type StatusRow = {
  name: string;
  count: number;
  share: number;
  price: number;
};

export type TypeRow = {
  name: string;
  count: number;
  price: number;
  disponibles: number;
};

export type UnitProjectRow = {
  name: string;
  count: number;
  price: number;
  disponibles: number;
};

export type BedroomRow = {
  name: string;
  bedrooms: number | null;
  count: number;
};

export type UnitRow = {
  project: string;
  level: string;
  number: number;
  type: string;
  area: number;
  bedrooms: number;
  status: string;
  reserved: string | null;
  price: number;
};

export type InventarioReport = {
  units: number;
  disponibles: number;
  price: number;
  disponiblePrice: number;
  byStatus: StatusRow[];
  byType: TypeRow[];
  byProject: UnitProjectRow[];
  byBedrooms: BedroomRow[];
  shown: UnitRow[];
};

export type BudgetLine = {
  fecha: string;
  mes: string;
  raw: string;
  project: string;
  concepto: string;
  proveedor: string;
  inversion: number;
  badDate: boolean;
};

export type PresupuestoReport = {
  plan: number;
  lines: number;
  actual: number;
  byProject: { name: string; inversion: number }[];
  byConcepto: { name: string; inversion: number }[];
  rows: BudgetLine[];
};

export type InventarioPresupuestoReport = {
  inventario: InventarioReport;
  presupuesto: PresupuestoReport;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isoFrom(epochMs: number, offset: number): string {
  return new Date(epochMs + offset * 86_400_000).toISOString().slice(0, 10);
}

function allowed(name: string, accounts: readonly string[] | null): boolean {
  return accounts == null || accounts.includes(name);
}

function counts<T extends { count: number; name: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}

export function buildInventarioPresupuesto(
  accounts: readonly string[] | null,
): InventarioPresupuestoReport {
  const status = new Map<string, { count: number; price: number }>();
  const types = new Map<string, { count: number; price: number; disponibles: number }>();
  const projects = new Map<string, { count: number; price: number; disponibles: number }>();
  const bedrooms = new Map<string, { bedrooms: number | null; count: number }>();
  const units: UnitRow[] = [];
  let price = 0;
  let disponibles = 0;
  let disponiblePrice = 0;

  for (const row of inventoryGrain.rows) {
    const project = inventoryGrain.projects[row[0] ?? -1];
    const level = inventoryGrain.levels[row[1] ?? -1];
    const number = row[2];
    const type = inventoryGrain.types[row[3] ?? -1];
    const area = row[4];
    const bedroomCount = row[5];
    const unitPrice = row[6];
    const statusName = inventoryGrain.statuses[row[7] ?? -1];
    const day = row[8];
    if (!project || !level || !type || !statusName) continue;
    if (typeof number !== "number" || typeof area !== "number" || typeof bedroomCount !== "number" || typeof unitPrice !== "number") continue;
    if (!allowed(project, accounts)) continue;
    price += unitPrice;
    const currentStatus = status.get(statusName) ?? { count: 0, price: 0 };
    currentStatus.count += 1;
    currentStatus.price += unitPrice;
    status.set(statusName, currentStatus);
    const currentType = types.get(type) ?? { count: 0, price: 0, disponibles: 0 };
    currentType.count += 1;
    currentType.price += unitPrice;
    if (statusName === "Disponible") currentType.disponibles += 1;
    types.set(type, currentType);
    const currentProject = projects.get(project) ?? { count: 0, price: 0, disponibles: 0 };
    currentProject.count += 1;
    currentProject.price += unitPrice;
    if (statusName === "Disponible") {
      disponibles += 1;
      disponiblePrice += unitPrice;
      currentProject.disponibles += 1;
    }
    projects.set(project, currentProject);
    const bedroomKey = String(bedroomCount);
    const currentBedroom = bedrooms.get(bedroomKey) ?? { bedrooms: bedroomCount, count: 0 };
    currentBedroom.count += 1;
    bedrooms.set(bedroomKey, currentBedroom);
    units.push({
      project,
      level,
      number,
      type,
      area,
      bedrooms: bedroomCount,
      status: statusName,
      reserved: typeof day === "number" ? isoFrom(INV_EPOCH_MS, day) : null,
      price: unitPrice,
    });
  }

  const unitCount = units.length;
  const byStatus = counts([...status.entries()].map(([name, row]) => ({
    name,
    count: row.count,
    share: unitCount === 0 ? 0 : row.count / unitCount,
    price: row.price,
  })));
  const byType = counts([...types.entries()].map(([name, row]) => ({ name, ...row }))).slice(0, 24);
  const byProject = counts([...projects.entries()].map(([name, row]) => ({ name, ...row })));
  const byBedrooms = [...bedrooms.entries()]
    .map(([name, row]) => ({ name: `${name} hab`, bedrooms: row.bedrooms, count: row.count }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const allowedAccounts = accounts == null
    ? null
    : new Set(accounts.map((name) => adsGrain.accounts.indexOf(name)).filter((index) => index >= 0));
  let actualCents = 0;
  for (const row of adsGrain.daily) {
    const offset = row[0] ?? 0;
    const account = row[1] ?? 0;
    const month = isoFrom(ADS_EPOCH_MS, offset).slice(0, 7);
    if (!SPEND_MONTHS.has(month)) continue;
    if (allowedAccounts && !allowedAccounts.has(account)) continue;
    actualCents += row[5] ?? 0;
  }

  const lines = budgetGrain.lines.filter((line) => line.project !== "" && allowed(line.project, accounts));
  const plan = round2(lines.reduce((sum, line) => sum + line.inversion, 0));
  const byBudgetProject = new Map<string, number>();
  const byConcepto = new Map<string, number>();
  for (const line of lines) {
    byBudgetProject.set(line.project, (byBudgetProject.get(line.project) ?? 0) + line.inversion);
    byConcepto.set(line.concepto, (byConcepto.get(line.concepto) ?? 0) + line.inversion);
  }

  return {
    inventario: {
      units: unitCount,
      disponibles,
      price,
      disponiblePrice,
      byStatus,
      byType,
      byProject,
      byBedrooms,
      shown: units.sort((a, b) => b.price - a.price).slice(0, 200),
    },
    presupuesto: {
      plan,
      lines: lines.length,
      actual: round2(actualCents / 100),
      byProject: [...byBudgetProject.entries()]
        .map(([name, inversion]) => ({ name, inversion: round2(inversion) }))
        .sort((a, b) => b.inversion - a.inversion || a.name.localeCompare(b.name, "es")),
      byConcepto: [...byConcepto.entries()]
        .map(([name, inversion]) => ({ name, inversion: round2(inversion) }))
        .sort((a, b) => b.inversion - a.inversion || a.name.localeCompare(b.name, "es")),
      rows: lines.map((line) => ({ ...line, badDate: /31\/11/.test(line.fecha) })),
    },
  };
}
