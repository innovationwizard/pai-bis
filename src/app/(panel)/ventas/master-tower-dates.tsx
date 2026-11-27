"use client";

import { SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useRole } from "@/hooks/use-role";
import styles from "./master-tower-dates.module.css";

const EDITORS = new Set(["master", "torredecontrol"]);

type TowerDateRow = {
  id: string;
  projectName: string;
  towerName: string;
  initialDate: string | null;
  finalDate: string | null;
};

function sameDate(left: string | null, right: string | null): boolean {
  return left === right;
}

function pendingRows(current: readonly TowerDateRow[], saved: readonly TowerDateRow[]): TowerDateRow[] {
  const baseline = new Map(saved.map((row) => [row.id, row]));
  return current.filter((row) => {
    const original = baseline.get(row.id);
    if (!original) return true;
    return !sameDate(row.initialDate, original.initialDate) || !sameDate(row.finalDate, original.finalDate);
  });
}

export function MasterTowerDatesButton() {
  const role = useRole();
  const [open, setOpen] = useState(false);
  if (!role || !EDITORS.has(role)) return null;
  return (
    <>
      <button
        type="button"
        className={styles.button}
        aria-label="Fechas de las torres"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal size={16} color="#DB2777" aria-hidden="true" />
      </button>
      {open ? <TowerDatesModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function TowerDatesModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const [rows, setRows] = useState<TowerDateRow[] | null>(null);
  const [saved, setSaved] = useState<TowerDateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    function blockEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
    }
    window.addEventListener("keydown", blockEscape, true);
    return () => window.removeEventListener("keydown", blockEscape, true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ventas/torre-fechas", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { error?: string; rows?: TowerDateRow[] } | null;
        if (!response.ok) throw new Error(body?.error ?? "No se pudieron leer las torres.");
        if (!Array.isArray(body?.rows)) throw new Error("No se pudieron leer las torres.");
        return body.rows;
      })
      .then((next) => {
        if (cancelled) return;
        setRows(next);
        setSaved(next);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "No se pudieron leer las torres.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function edit(id: string, field: "initialDate" | "finalDate", value: string) {
    setNotice(null);
    setRows((current) =>
      (current ?? []).map((row) => (row.id === id ? { ...row, [field]: value === "" ? null : value } : row)),
    );
  }

  async function save() {
    if (!rows || savingRef.current) return;
    const pending = pendingRows(rows, saved);
    if (pending.length === 0) {
      setNotice("No hay cambios pendientes.");
      setError(null);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/ventas/torre-fechas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: pending.map((row) => ({
            id: row.id,
            initialDate: row.initialDate,
            finalDate: row.finalDate,
          })),
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "No se pudieron guardar los cambios.");
      setSaved(rows.map((row) => ({ ...row })));
      setNotice("Cambios guardados.");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No se pudieron guardar los cambios.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h3 id={titleId}>Fechas de las torres</h3>
        {loading ? <p className={styles.message}>Cargando torres…</p> : null}
        {error ? (
          <p className={styles.message} data-tone="danger" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p className={styles.message}>{notice}</p> : null}
        {rows && rows.length === 0 ? <p className={styles.message}>No hay torres en los proyectos activos.</p> : null}
        {rows && rows.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Proyecto</th>
                <th scope="col">Torre</th>
                <th scope="col">Fecha inicial</th>
                <th scope="col">Fecha final</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.projectName}</td>
                  <td>{row.towerName}</td>
                  <td>
                    <input
                      type="date"
                      className={styles.date}
                      aria-label={`Fecha inicial de ${row.towerName} en ${row.projectName}`}
                      value={row.initialDate ?? ""}
                      onChange={(event) => edit(row.id, "initialDate", event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      className={styles.date}
                      aria-label={`Fecha final de ${row.towerName} en ${row.projectName}`}
                      value={row.finalDate ?? ""}
                      onChange={(event) => edit(row.id, "finalDate", event.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void save()} disabled={loading || saving || rows === null}>
            Guardar cambios
          </button>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Salir sin guardar
          </button>
        </div>
      </div>
    </div>
  );
}
