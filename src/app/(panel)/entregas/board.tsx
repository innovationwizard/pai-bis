"use client";

import { useEffect, useMemo, useState } from "react";
import DataAsOf from "@/app/pabi/data-as-of";
import { ESTADO_LABELS, ESTADOS, MILESTONE_LABELS } from "@/lib/entregas/constants";
import type { EntregaCitaFull, EntregaEstado, EntregaMilestone } from "@/lib/entregas/types";
import GhostCard from "@/app/pabi/ghost-card";

const ZONE = "America/Guatemala";

const PROJECTS = [
  { key: "boulevard-5", name: "Boulevard 5", match: ["boulevard 5"] },
  { key: "benestare", name: "Benestare", match: ["benestare"] },
  { key: "bosque-las-tapias", name: "Bosque Las Tapias", match: ["bosque las tapias"] },
  { key: "santa-elena", name: "Santa Elena", match: ["santa elena"] },
] as const;

const STAGES: { milestone: EntregaMilestone; title: string }[] = [
  { milestone: "ESCRITURA", title: "Escrituración" },
  { milestone: "LLAVES", title: "Llaves" },
];

const GHOST_MISSING: Record<string, string> = {
  firmas: "tabla de firmas sin crear",
  impuestos: "tabla de impuestos sin crear",
  registro: "tabla de ingreso al registro sin crear",
  desembolso: "tabla de desembolsos sin crear",
  liquidacion: "tabla de liquidación sin crear",
  archivado: "tabla de archivado sin crear",
};

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

type DrawerState = { title: string; citas: EntregaCitaFull[] };

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function projectOf(cita: EntregaCitaFull): (typeof PROJECTS)[number] | null {
  const slug = normalizeName(cita.project_slug);
  const name = normalizeName(cita.project_name);
  return PROJECTS.find((project) => project.match.some((item) => item === slug || item === name)) ?? null;
}

function pad2(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.padStart(2, "0").slice(-2);
}

function guatemalaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year").replace(/\D/g, "")}-${pad2(pick("month"))}-${pad2(pick("day"))}`;
}

function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function weekdayName(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const index = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const name = WEEKDAYS[index] ?? "";
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : iso;
}

function hourLabel(hora: string): string {
  return hora.slice(0, 5);
}

function byFechaHora(a: EntregaCitaFull, b: EntregaCitaFull): number {
  if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
  if (a.hora !== b.hora) return a.hora.localeCompare(b.hora);
  return a.unit_number.localeCompare(b.unit_number, "es");
}

function latestUpdatedAt(citas: EntregaCitaFull[]): string | null {
  let best: string | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const cita of citas) {
    const ms = Date.parse(cita.cita_updated_at);
    if (Number.isNaN(ms) || ms < bestMs) continue;
    bestMs = ms;
    best = cita.cita_updated_at;
  }
  return best;
}

function useEntregas() {
  const [citas, setCitas] = useState<EntregaCitaFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/entregas", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { citas?: EntregaCitaFull[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? `Error ${response.status}`);
        if (!Array.isArray(body.citas)) throw new Error("La respuesta no trae el cronograma");
        if (!cancelled) setCitas(body.citas);
      })
      .catch((reason: unknown) => {
        if (cancelled || (reason instanceof DOMException && reason.name === "AbortError")) return;
        if (!cancelled) {
          setCitas(null);
          setError(reason instanceof Error ? reason.message : "No se pudo cargar Entregas");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [request]);

  return {
    citas,
    error,
    loading,
    reload: () => setRequest((current) => current + 1),
  };
}

function CitasDrawer({ drawer, onClose }: { drawer: DrawerState; onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => [...drawer.citas].sort(byFechaHora), [drawer.citas]);

  return (
    <div className="op-overlay">
      <button type="button" className="op-backdrop" aria-label="Cerrar" onClick={onClose} />
      <aside className="op-drawer" role="dialog" aria-modal="true" aria-label={drawer.title}>
        <header>
          <h2>{drawer.title}</h2>
          <button type="button" onClick={onClose}>Cerrar</button>
        </header>
        <p className="op-note">{rows.length === 1 ? "1 cita" : `${rows.length} citas`}</p>
        {rows.length === 0 ? (
          <p className="op-note">Sin citas.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Apartamento</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cita) => (
                <tr key={cita.cita_id}>
                  <td>{cita.unit_number}</td>
                  <td>{dotted(cita.fecha)}</td>
                  <td>{ESTADO_LABELS[cita.estado]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </aside>
    </div>
  );
}

function StatusMessage({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="ventas-board" role="alert">
      <p className="op-note op-warn">{error}</p>
      <button type="button" className="op-text" onClick={onRetry}>Reintentar</button>
    </div>
  );
}

function EstadoCounts({
  citas,
  onOpen,
}: {
  citas: EntregaCitaFull[];
  onOpen: (estado: EntregaEstado, rows: EntregaCitaFull[]) => void;
}) {
  return (
    <div className="op-kpis">
      {ESTADOS.map((estado) => {
        const rows = citas.filter((cita) => cita.estado === estado);
        return (
          <p key={estado}>
            <button
              type="button"
              className="op-count"
              onClick={() => onOpen(estado, rows)}
            >
              {rows.length}
            </button>
            <span>{ESTADO_LABELS[estado]}</span>
          </p>
        );
      })}
    </div>
  );
}

function CitaTable({
  citas,
  onOpen,
}: {
  citas: EntregaCitaFull[];
  onOpen: (cita: EntregaCitaFull) => void;
}) {
  const rows = useMemo(() => [...citas].sort(byFechaHora), [citas]);
  if (rows.length === 0) return <p className="op-note">Sin citas.</p>;
  return (
    <table className="ventas-table">
      <thead>
        <tr>
          <th>Proyecto</th>
          <th>Apartamento</th>
          <th>Fecha</th>
          <th>Hora</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((cita) => (
          <tr key={cita.cita_id}>
            <td>{projectOf(cita)?.name ?? cita.project_name}</td>
            <td>
              <button type="button" className="op-text" onClick={() => onOpen(cita)}>
                {cita.unit_number}
              </button>
            </td>
            <td>{dotted(cita.fecha)}</td>
            <td>{hourLabel(cita.hora)}</td>
            <td>{ESTADO_LABELS[cita.estado]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EntregasLanding() {
  const { citas, error, loading, reload } = useEntregas();
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const view = useMemo(() => {
    const rows = citas ?? [];
    const today = guatemalaToday();
    const month = today.slice(0, 7);
    const year = today.slice(0, 4);
    const weekEnd = addIsoDays(today, 6);
    const agendaEnd = addIsoDays(today, 13);
    const escriturasMes = rows.filter(
      (cita) => cita.milestone === "ESCRITURA" && cita.estado === "COMPLETADA" && cita.fecha.startsWith(month),
    ).length;
    const escriturasAnio = rows.filter(
      (cita) => cita.milestone === "ESCRITURA" && cita.estado === "COMPLETADA" && cita.fecha.startsWith(year),
    ).length;
    const llaves = rows.filter((cita) => cita.milestone === "LLAVES" && cita.estado === "COMPLETADA").length;
    const proximas = rows.filter(
      (cita) => cita.estado !== "CANCELADA" && cita.fecha >= today && cita.fecha <= weekEnd,
    ).length;
    const reprogramaciones = rows.reduce((sum, cita) => {
      const veces = cita.reprogramaciones;
      return sum + (typeof veces === "number" && Number.isFinite(veces) ? veces : 0);
    }, 0);
    const days = Array.from({ length: 14 }, (_, index) => addIsoDays(today, index));
    const agenda = days.map((iso) => ({
      iso,
      citas: rows
        .filter((cita) => cita.fecha === iso && cita.estado !== "CANCELADA")
        .sort(byFechaHora),
    }));
    return { today, escriturasMes, escriturasAnio, llaves, proximas, reprogramaciones, agenda, agendaEnd };
  }, [citas]);

  if (loading) return <p className="ventas-caption">Cargando entregas…</p>;
  if (error || citas === null) return <StatusMessage error={error ?? "No se pudo cargar Entregas"} onRetry={reload} />;

  function openProject(projectName: string, stage: string, estado: EntregaEstado, rows: EntregaCitaFull[]) {
    setDrawer({ title: `${projectName} · ${stage} · ${ESTADO_LABELS[estado]}`, citas: rows });
  }

  return (
    <div className="ventas-board">
      <DataAsOf timestamp={latestUpdatedAt(citas)} />
      {citas.length === 0 ? <p className="ventas-notice">No hay citas cargadas.</p> : null}
      <div className="vt-kpis">
        <p className="vt-kpi">
          <span>Escrituras completadas del mes</span>
          <strong>{view.escriturasMes}</strong>
          <small>Estado Completada, fecha en el mes</small>
        </p>
        <p className="vt-kpi">
          <span>Escrituras completadas del año</span>
          <strong>{view.escriturasAnio}</strong>
          <small>Estado Completada, fecha en el año</small>
        </p>
        <p className="vt-kpi">
          <span>Llaves entregadas</span>
          <strong>{view.llaves}</strong>
          <small>Estado Completada</small>
        </p>
        <p className="vt-kpi">
          <span>Citas de los próximos 7 días</span>
          <strong>{view.proximas}</strong>
          <small>Sin canceladas</small>
        </p>
        <p className="vt-kpi">
          <span>Reprogramaciones</span>
          <strong>{view.reprogramaciones}</strong>
          <small>Veces que se movió una cita</small>
        </p>
      </div>

      {PROJECTS.map((project) => {
        const rows = citas.filter((cita) => projectOf(cita)?.key === project.key);
        return (
          <section key={project.key} className="vt-card" aria-label={project.name}>
            <header className="vt-card-head">
              <div>
                <h2>{project.name}</h2>
                <p>Escrituración → Llaves</p>
              </div>
              <p>{rows.length === 1 ? "1 cita" : `${rows.length} citas`}</p>
            </header>
            <div className="op-mid">
              {STAGES.map((stage) => {
                const stageRows = rows.filter((cita) => cita.milestone === stage.milestone);
                return (
                  <div key={stage.milestone}>
                    <h3>{stage.title}</h3>
                    <EstadoCounts
                      citas={stageRows}
                      onOpen={(estado, matching) => openProject(project.name, stage.title, estado, matching)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="vt-card" aria-label="Agenda de los próximos 14 días">
        <header className="vt-card-head">
          <div>
            <h2>Agenda</h2>
            <p>Próximos 14 días, del {dotted(view.today)} al {dotted(view.agendaEnd)}. Sin canceladas.</p>
          </div>
        </header>
        {view.agenda.map((day) => (
          <div key={day.iso}>
            <h3>{weekdayName(day.iso)} {dotted(day.iso)}</h3>
            {day.citas.length === 0 ? (
              <p className="op-note">Sin citas</p>
            ) : (
              <table className="ventas-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Proyecto</th>
                    <th>Apartamento</th>
                    <th>Hito</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {day.citas.map((cita) => (
                    <tr key={cita.cita_id}>
                      <td>{hourLabel(cita.hora)}</td>
                      <td>{projectOf(cita)?.name ?? cita.project_name}</td>
                      <td>
                        <button
                          type="button"
                          className="op-text"
                          onClick={() => setDrawer({
                            title: `${projectOf(cita)?.name ?? cita.project_name} · Apto. ${cita.unit_number}`,
                            citas: [cita],
                          })}
                        >
                          {cita.unit_number}
                        </button>
                      </td>
                      <td>{MILESTONE_LABELS[cita.milestone]}</td>
                      <td>{ESTADO_LABELS[cita.estado]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </section>

      {drawer ? <CitasDrawer drawer={drawer} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
}

function MilestoneList({ milestone }: { milestone: EntregaMilestone }) {
  const { citas, error, loading, reload } = useEntregas();
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  if (loading) return <p className="ventas-caption">Cargando entregas…</p>;
  if (error || citas === null) return <StatusMessage error={error ?? "No se pudo cargar Entregas"} onRetry={reload} />;

  const rows = citas.filter((cita) => cita.milestone === milestone);
  const stage = STAGES.find((item) => item.milestone === milestone)?.title ?? MILESTONE_LABELS[milestone];

  return (
    <div className="ventas-board">
      <DataAsOf timestamp={latestUpdatedAt(citas)} />
      {rows.length === 0 ? <p className="ventas-notice">Sin citas.</p> : null}
      <EstadoCounts
        citas={rows}
        onOpen={(estado, matching) => setDrawer({
          title: `${stage} · ${ESTADO_LABELS[estado]}`,
          citas: matching,
        })}
      />
      <CitaTable
        citas={rows}
        onOpen={(cita) => setDrawer({
          title: `${projectOf(cita)?.name ?? cita.project_name} · Apto. ${cita.unit_number}`,
          citas: [cita],
        })}
      />
      {drawer ? <CitasDrawer drawer={drawer} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
}

export function EntregasSection({ slug }: { slug: string }) {
  if (slug === "escrituracion") return <MilestoneList key="ESCRITURA" milestone="ESCRITURA" />;
  if (slug === "entrega") return <MilestoneList key="LLAVES" milestone="LLAVES" />;
  return <GhostCard missing={GHOST_MISSING[slug] ?? "vista sin conectar"} />;
}
