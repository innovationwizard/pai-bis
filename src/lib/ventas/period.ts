export type PeriodPreset = "este-mes" | "mes-anterior" | "este-trimestre" | "este-ano" | "custom";

export type DateWindow = { from: string; to: string; label: string };

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function guatemalaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala" }).format(now);
}

function parse(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = parse(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: string): string {
  const date = parse(monthStart(iso));
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return format(date);
}

function quarterStart(iso: string): string {
  const month = Number(iso.slice(5, 7));
  const start = Math.floor((month - 1) / 3) * 3 + 1;
  return `${iso.slice(0, 4)}-${String(start).padStart(2, "0")}-01`;
}

function quarterEnd(iso: string): string {
  const start = quarterStart(iso);
  const date = parse(start);
  date.setUTCMonth(date.getUTCMonth() + 3);
  date.setUTCDate(0);
  return format(date);
}

function dayOf(iso: string): number {
  return Number(iso.slice(8, 10));
}

function sameDayNext(start: string, day: number): string {
  const end = monthEnd(start);
  return `${start.slice(0, 8)}${String(Math.min(day, dayOf(end))).padStart(2, "0")}`;
}

function shiftMonths(iso: string, months: number): string {
  const date = parse(monthStart(iso));
  date.setUTCMonth(date.getUTCMonth() + months);
  return format(date);
}

export function shiftYears(iso: string, years: number): string {
  const year = Number(iso.slice(0, 4)) + years;
  const month = iso.slice(5, 7);
  const day = dayOf(iso);
  const last = dayOf(monthEnd(`${year}-${month}-01`));
  return `${year}-${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

export function inclusiveDays(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000) + 1;
}

export function resolveRange(
  preset: PeriodPreset,
  customFrom: string | null,
  customTo: string | null,
  today = guatemalaToday(),
): DateWindow {
  if (preset === "mes-anterior") {
    const last = addDays(monthStart(today), -1);
    return { from: monthStart(last), to: monthEnd(last), label: "Mes anterior" };
  }
  if (preset === "este-trimestre") {
    return { from: quarterStart(today), to: today, label: "Este trimestre" };
  }
  if (preset === "este-ano") {
    return { from: `${today.slice(0, 4)}-01-01`, to: today, label: "Este año" };
  }
  if (preset === "custom" && customFrom && customTo && customFrom <= customTo) {
    return { from: customFrom, to: customTo, label: `${customFrom} – ${customTo}` };
  }
  return { from: monthStart(today), to: today, label: "Este mes" };
}

export function previousWindows(range: DateWindow, count: number): DateWindow[] {
  const windows: DateWindow[] = [];
  let cursor = range;
  const monthAligned = cursor.from === monthStart(cursor.from) && cursor.from.slice(0, 7) === cursor.to.slice(0, 7);
  const fullMonth = monthAligned && cursor.to === monthEnd(cursor.from);
  for (let index = 0; index < count; index += 1) {
    let next: DateWindow;
    if (fullMonth || (monthAligned && cursor.to !== monthEnd(cursor.from))) {
      const prevStart = shiftMonths(cursor.from, -1);
      next = {
        from: prevStart,
        to: fullMonth ? monthEnd(prevStart) : sameDayNext(prevStart, dayOf(cursor.to)),
        label: "",
      };
    } else {
      const length = inclusiveDays(cursor.from, cursor.to);
      const to = addDays(cursor.from, -1);
      next = { from: addDays(to, -(length - 1)), to, label: "" };
    }
    next.label = windowLabel(next);
    windows.push(next);
    cursor = next;
  }
  return windows;
}

export function yearAgoWindow(range: DateWindow): DateWindow {
  const next = { from: shiftYears(range.from, -1), to: shiftYears(range.to, -1), label: "" };
  next.label = `Mismo período del año anterior (${windowLabel(next)})`;
  return next;
}

export function windowLabel(range: DateWindow): string {
  if (range.from === monthStart(range.from) && range.to === monthEnd(range.from)) {
    const month = Number(range.from.slice(5, 7)) - 1;
    return `${MONTHS[month]} ${range.from.slice(0, 4)}`;
  }
  return `${range.from} – ${range.to}`;
}

export function monthsTouched(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = monthStart(from);
  while (cursor <= to) {
    months.push(cursor);
    cursor = shiftMonths(cursor, 1);
  }
  return months;
}

export function monthName(monthStartIso: string): string {
  const month = Number(monthStartIso.slice(5, 7)) - 1;
  return `${MONTHS[month]} ${monthStartIso.slice(0, 4)}`;
}
