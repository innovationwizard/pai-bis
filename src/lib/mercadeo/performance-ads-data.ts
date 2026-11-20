import { adsGrain } from "./performance-ads-grain";

export type PerformanceAdsAccount = {
  name: string;
  alcance: number;
  impresiones: number;
  leads: number;
  spendUsd: number;
  frecuencia: number | null;
  cpl: number | null;
};

export type PerformanceAdsReport = {
  desde: string;
  hasta: string;
  loadedThrough: string;
  alcance: number;
  impresiones: number;
  leads: number;
  spendUsd: number;
  accounts: PerformanceAdsAccount[];
  weekdays: { name: string; leads: number }[];
  days: { date: string; cpl: number | null }[];
  months: { label: string; spendUsd: number }[];
  campaigns: { account: string; name: string; leads: number }[];
};

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;

const EPOCH_MS = Date.parse(`${adsGrain.epoch}T00:00:00Z`);

function isoFromOffset(offset: number): string {
  return new Date(EPOCH_MS + offset * 86_400_000).toISOString().slice(0, 10);
}

function offsetOf(iso: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - EPOCH_MS) / 86_400_000);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function weekdayName(iso: string): string {
  return WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? "domingo";
}

export function buildPerformanceAds(
  from: string,
  to: string,
  accounts: readonly string[] | null,
): PerformanceAdsReport {
  const fromOffset = offsetOf(from);
  const toOffset = offsetOf(to);
  const allowed = accounts == null ? null : new Set(
    accounts.map((name) => adsGrain.accounts.indexOf(name)).filter((index) => index >= 0),
  );

  const byAccount = new Map<number, {
    alcance: number;
    impresiones: number;
    leads: number;
    spendCents: number;
    frqMilli: number;
    frqN: number;
    cplTenThou: number;
    cplN: number;
  }>();
  const byWeekday = new Map<string, number>();
  const byDay = new Map<number, { cplTenThou: number; cplN: number }>();
  const byMonth = new Map<string, number>();

  for (const row of adsGrain.daily) {
    const offset = row[0] ?? 0;
    const account = row[1] ?? 0;
    if (offset < fromOffset || offset > toOffset) continue;
    if (allowed && !allowed.has(account)) continue;
    const current = byAccount.get(account) ?? {
      alcance: 0, impresiones: 0, leads: 0, spendCents: 0, frqMilli: 0, frqN: 0, cplTenThou: 0, cplN: 0,
    };
    current.alcance += row[2] ?? 0;
    current.impresiones += row[3] ?? 0;
    current.leads += row[4] ?? 0;
    current.spendCents += row[5] ?? 0;
    current.frqMilli += row[6] ?? 0;
    current.frqN += row[7] ?? 0;
    current.cplTenThou += row[8] ?? 0;
    current.cplN += row[9] ?? 0;
    byAccount.set(account, current);

    const date = isoFromOffset(offset);
    byWeekday.set(weekdayName(date), (byWeekday.get(weekdayName(date)) ?? 0) + (row[4] ?? 0));
    const day = byDay.get(offset) ?? { cplTenThou: 0, cplN: 0 };
    day.cplTenThou += row[8] ?? 0;
    day.cplN += row[9] ?? 0;
    byDay.set(offset, day);
    byMonth.set(date.slice(0, 7), (byMonth.get(date.slice(0, 7)) ?? 0) + (row[5] ?? 0));
  }

  const byCampaign = new Map<string, { account: string; name: string; leads: number }>();
  for (const row of adsGrain.campaignDays) {
    const offset = row[0] ?? 0;
    const accountIndex = row[1] ?? 0;
    if (offset < fromOffset || offset > toOffset) continue;
    if (allowed && !allowed.has(accountIndex)) continue;
    const account = adsGrain.accounts[accountIndex] ?? "";
    const name = adsGrain.campaignNames[row[2] ?? 0] ?? "";
    const key = `${account}\t${name}`;
    const current = byCampaign.get(key) ?? { account, name, leads: 0 };
    current.leads += row[3] ?? 0;
    byCampaign.set(key, current);
  }

  const accountRows: PerformanceAdsAccount[] = [...byAccount.entries()].map(([index, row]) => ({
    name: adsGrain.accounts[index] ?? "",
    alcance: row.alcance,
    impresiones: row.impresiones,
    leads: row.leads,
    spendUsd: round2(row.spendCents / 100),
    frecuencia: row.frqN === 0 ? null : round2(row.frqMilli / row.frqN / 1000),
    cpl: row.cplN === 0 ? null : round2(row.cplTenThou / row.cplN / 10000),
  })).sort((a, b) => b.alcance - a.alcance);

  const totals = accountRows.reduce(
    (sum, row) => ({
      alcance: sum.alcance + row.alcance,
      impresiones: sum.impresiones + row.impresiones,
      leads: sum.leads + row.leads,
      spendUsd: sum.spendUsd + row.spendUsd,
    }),
    { alcance: 0, impresiones: 0, leads: 0, spendUsd: 0 },
  );

  return {
    desde: from,
    hasta: to,
    loadedThrough: adsGrain.loadedThrough,
    alcance: totals.alcance,
    impresiones: totals.impresiones,
    leads: totals.leads,
    spendUsd: round2(totals.spendUsd),
    accounts: accountRows,
    weekdays: [...byWeekday.entries()]
      .map(([name, leads]) => ({ name, leads }))
      .sort((a, b) => b.leads - a.leads),
    days: [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([offset, row]) => ({
        date: isoFromOffset(offset),
        cpl: row.cplN === 0 ? null : round2(row.cplTenThou / row.cplN / 10000),
      })),
    months: [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, cents]) => ({
        label: MONTHS[Number(key.slice(5, 7)) - 1] ?? key,
        spendUsd: round2(cents / 100),
      })),
    campaigns: [...byCampaign.values()]
      .filter((row) => row.leads > 0)
      .sort((a, b) => b.leads - a.leads),
  };
}
