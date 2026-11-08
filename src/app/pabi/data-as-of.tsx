const ZONE = "America/Guatemala";

function pad2(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 2) return digits.slice(-2);
  return digits.padStart(2, "0");
}

/** "Datos al DD.MM.YYYY HH:mm" in Guatemala, or "Sin datos cargados". */
export function formatDataAsOf(timestamp: string | null | undefined): string {
  if (timestamp == null || timestamp.trim() === "") return "Sin datos cargados";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Sin datos cargados";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const day = pad2(pick("day"));
  const month = pad2(pick("month"));
  const year = pick("year").replace(/\D/g, "");
  let hour = pad2(pick("hour"));
  const minute = pad2(pick("minute"));
  if (hour === "24") hour = "00";
  if (day.length !== 2 || month.length !== 2 || year.length !== 4 || hour.length !== 2 || minute.length !== 2) {
    return "Sin datos cargados";
  }
  return `Datos al ${day}.${month}.${year} ${hour}:${minute}`;
}

export default function DataAsOf({ timestamp }: { timestamp: string | null | undefined }) {
  return (
    <p className="op-range">
      <span className="op-fresh">{formatDataAsOf(timestamp)}</span>
    </p>
  );
}
