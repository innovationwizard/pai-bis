// Odoo 19 short torre labels locked in SDD §4.2.1.
// "A" and "Torre A" are "TA". "Principal" stays as written.

export function towerIdentity(name: string): string {
  const folded = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (folded === "principal") return "Principal";
  const letter = folded.match(/^(?:torre\s+)?([a-e])$/);
  return letter ? letter[1].toUpperCase() : "";
}

export function odooTowerLabel(name: string): string {
  const trimmed = name.trim();
  const body = trimmed.replace(/^torre\s+/i, "").trim();
  if (!body || body === trimmed && !/^[A-Za-z0-9]{1,3}$/.test(body)) return trimmed;
  if (/^[A-Za-z0-9]{1,3}$/.test(body)) return `T${body.toUpperCase()}`;
  return trimmed;
}
