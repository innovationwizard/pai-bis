import { inclusiveDays, monthEnd, monthStart } from "./period";

export type DayWindow = { from: string; to: string };

/** Share of one calendar month's target that falls inside the window, stopping at today. */
export function monthFactor(month: string, range: DayWindow, today: string): number {
  const start = monthStart(month);
  const end = monthEnd(month);
  const overlapFrom = range.from > start ? range.from : start;
  const overlapTo = range.to < end ? range.to : end;
  if (overlapFrom > overlapTo) return 0;
  const paceTo = today < overlapTo ? today : overlapTo;
  if (paceTo < overlapFrom) return 0;
  const days = inclusiveDays(start, end);
  if (days <= 0) return 0;
  return inclusiveDays(overlapFrom, paceTo) / days;
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function eachDay(from: string, to: string): string[] {
  if (from > to) return [];
  const days: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) days.push(cursor);
  return days;
}

/** Collapse overlapping date islands so a year-ago comparison does not scan the months in between. */
export function mergeWindows(windows: readonly DayWindow[]): DayWindow[] {
  const sorted = [...windows].sort((a, b) => a.from.localeCompare(b.from));
  const merged: DayWindow[] = [];
  for (const window of sorted) {
    if (window.from > window.to) continue;
    const last = merged[merged.length - 1];
    if (!last || window.from > addDays(last.to, 1)) merged.push({ from: window.from, to: window.to });
    else if (window.to > last.to) last.to = window.to;
  }
  return merged;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function sumNullable(values: Array<number | null | undefined>): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    if (value == null) continue;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}
