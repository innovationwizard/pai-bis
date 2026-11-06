"use client";

import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { FIXTURE } from "./fixture";
import { chartSummary, previousOf, projectById, readoutFor } from "./format";
import { INSIGHTS } from "./insights";
import { markOpacity, PROJECT_HUE, visibleProjects } from "./model";
import { useCountUp, useRove } from "./motion";
import { Comparison, Ranking, Waterfall } from "./panels";
import { Drawer, Origen, Shortcuts } from "./overlays";
import { FlowView, TreemapView } from "./hero-views";
import VerticalBars from "./bars";
import { Panel, Ticks, cx } from "./frame";
import { initialState, reducer, spotlightOf, type Target } from "./state";
import styles from "./centro.module.css";

function Count({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <>{shown}</>;
}

function Delta({ label, change }: { label: string; change: number }) {
  const tone = change > 0 ? styles.up : change < 0 ? styles.down : styles.flat;
  return <span className={tone}>{label}</span>;
}

function ShareRing({ share, color }: { share: number; color: string }) {
  const radius = 12;
  const turn = 2 * Math.PI * radius;
  const dash = Math.max(0, Math.min(1, share)) * turn;
  return (
    <svg className={styles.ring} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="3" />
      <circle
        cx="16"
        cy="16"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={`${dash} ${turn - dash}`}
        transform="rotate(-90 16 16)"
      />
    </svg>
  );
}

export default function CentroDeMando() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const spotlight = spotlightOf(state);
  const readout = readoutFor(spotlight);
  const projects = visibleProjects(state.focusProjectId, state.selected);
  const focus = state.focusProjectId ? projectById(state.focusProjectId) : null;
  const blocked = state.origen || state.shortcuts || state.drawerAdvisorId != null;
  const returnFocus = useRef<HTMLElement | SVGElement | null>(null);
  const drawerWas = useRef<string | null>(null);
  const origenWas = useRef(false);
  const helpWas = useRef(false);
  const tileRove = useRove<HTMLButtonElement>(FIXTURE.projects.length, "tiles");
  const heroRef = useRef<HTMLDivElement>(null);
  const [presentNote, setPresentNote] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      const tag = event.target instanceof HTMLElement ? event.target.tagName : "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (!typing && (event.key === "?" || (event.key === "/" && event.shiftKey))) {
        event.preventDefault();
        if (!document.getElementById("cdm-help-title")) {
          const active = document.activeElement;
          if (active instanceof HTMLElement || active instanceof SVGElement) returnFocus.current = active;
        }
        dispatch({ type: "toggle-shortcuts" });
        return;
      }
      if (event.key === "Escape") {
        if (document.fullscreenElement) return;
        event.preventDefault();
        dispatch({ type: "escape" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const id = state.drawerAdvisorId;
    if (id && !drawerWas.current) {
      document.querySelector<HTMLElement>("[data-autofocus='drawer']")?.focus();
    }
    if (!id && drawerWas.current) {
      returnFocus.current?.focus();
      returnFocus.current = null;
    }
    drawerWas.current = id;
  }, [state.drawerAdvisorId]);

  useEffect(() => {
    if (state.origen && !origenWas.current) {
      document.querySelector<HTMLElement>("[data-autofocus='origen']")?.focus();
    }
    if (!state.origen && origenWas.current) {
      returnFocus.current?.focus();
      returnFocus.current = null;
    }
    origenWas.current = state.origen;
  }, [state.origen]);

  useEffect(() => {
    if (state.shortcuts && !helpWas.current) {
      document.querySelector<HTMLElement>("[data-autofocus='ayuda']")?.focus();
    }
    if (!state.shortcuts && helpWas.current) {
      returnFocus.current?.focus();
      returnFocus.current = null;
    }
    helpWas.current = state.shortcuts;
  }, [state.shortcuts]);

  function rememberFocus() {
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement || active instanceof SVGElement ? active : null;
  }

  function onProject(projectId: string, shift: boolean) {
    dispatch(shift ? { type: "toggle-project", projectId } : { type: "zoom-project", projectId });
  }

  function onAdvisor(advisorId: string) {
    rememberFocus();
    dispatch({ type: "open-drawer", advisorId });
  }

  function onTotal() {
    dispatch({ type: "zoom-out" });
  }

  function onHover(target: Target | null) {
    dispatch({ type: "hover", target });
  }

  function onKbd(target: Target | null) {
    dispatch({ type: "kbd", target });
  }

  function presentHero() {
    const node = heroRef.current;
    if (!node || typeof node.requestFullscreen !== "function") {
      setPresentNote("Este navegador no abre pantalla completa.");
      return;
    }
    setPresentNote(null);
    void node.requestFullscreen().catch(() => {
      setPresentNote("No se pudo abrir pantalla completa.");
    });
  }

  const handlers = {
    spotlight,
    focusProjectId: state.focusProjectId,
    selected: state.selected,
    onProject,
    onAdvisor,
    onTotal,
    onHover,
    onKbd,
  };

  const trailAdvisor =
    (state.drawerAdvisorId
      ? FIXTURE.projects.flatMap((project) => project.advisors).find((advisor) => advisor.id === state.drawerAdvisorId)
      : null) ??
    (spotlight?.kind === "advisor"
      ? FIXTURE.projects.flatMap((project) => project.advisors).find((advisor) => advisor.id === spotlight.advisorId)
      : null);
  const trailProjectId =
    focus?.id ??
    (trailAdvisor
      ? FIXTURE.projects.find((project) => project.advisors.some((advisor) => advisor.id === trailAdvisor.id))?.id
      : null) ??
    (spotlight?.kind === "project" ? spotlight.projectId : null);
  const trailProject = trailProjectId ? projectById(trailProjectId) : null;

  const previous = previousOf(FIXTURE.total.reservas, FIXTURE.total.change);
  const gain = FIXTURE.total.change;

  return (
    <div className={styles.root}>
      <p className={styles.srOnly}>{chartSummary()}</p>
      <p className={styles.srOnly}>
        Flechas para moverse entre elementos del mismo grupo. Enter acerca un proyecto o abre un asesor. Escape aleja o cierra. Clic con Mayús selecciona varios proyectos.
      </p>
      <div
        className={styles.layout}
        inert={blocked ? true : undefined}
        onMouseLeave={() => onHover(null)}
      >
        <header className={cx(styles.panel, styles.status)} onMouseEnter={() => onHover(null)}>
          <Ticks />
          <div className={styles.titleBlock}>
            <h1 className={styles.h1}>Centro de mando · Reservas</h1>
            <span className={styles.chip}>{FIXTURE.periodChip}</span>
            <span className={styles.badge}>{FIXTURE.badge}</span>
          </div>
          <p className={styles.readout} role="status" title={readout}>
            {readout}
          </p>
          <div className={styles.tools}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                rememberFocus();
                dispatch({ type: "set-origen", open: true });
              }}
            >
              Origen de los datos
            </button>
            <button type="button" className={styles.btn} onClick={() => dispatch({ type: "reset" })}>
              Restablecer vista
            </button>
            <button
              type="button"
              className={styles.btn}
              aria-label="Atajos"
              onClick={() => {
                rememberFocus();
                dispatch({ type: "toggle-shortcuts" });
              }}
            >
              ?
            </button>
          </div>
        </header>

        <div className={styles.mid}>
          <div className={styles.rail}>
            <button
              type="button"
              className={styles.kpi}
              aria-label={readoutFor({ kind: "total" })}
              onMouseEnter={() => onHover({ kind: "total" })}
              onFocus={() => onKbd({ kind: "total" })}
              onBlur={() => onKbd(null)}
              onClick={onTotal}
            >
              <Ticks />
              <span className={styles.kpiValue}>
                <Count value={FIXTURE.total.reservas} />
                <span className={styles.kpiUnit}>reservas</span>
              </span>
              <Delta label={FIXTURE.total.changeLabel} change={FIXTURE.total.change} />
              <span className={styles.meter}>
                <span className={styles.meterBar} title="Mes anterior derivado">
                  <span className={styles.meterPrev} style={{ width: `${(previous / FIXTURE.total.reservas) * 100}%` }} />
                  <span className={styles.meterGain} style={{ width: `${(gain / FIXTURE.total.reservas) * 100}%` }} />
                </span>
                <span className={styles.meterScale}>
                  <span title="derivado">{previous} <span className={styles.tag}>derivado</span></span>
                  <span>{FIXTURE.total.reservas}</span>
                </span>
              </span>
              <span className={styles.caption}>{FIXTURE.metric}</span>
            </button>

            <div className={styles.tiles} role="group" aria-label="Proyectos">
              {FIXTURE.projects.map((project, index) => {
                const hue = PROJECT_HUE[project.id] ?? "#0d2041";
                const target: Target = { kind: "project", projectId: project.id };
                return (
                  <button
                    key={project.id}
                    ref={(node) => {
                      tileRove.refs.current[index] = node;
                    }}
                    type="button"
                    className={cx(styles.tile, styles.mark)}
                    style={{
                      opacity: markOpacity(
                        { kind: "project", projectId: project.id, advisorId: null },
                        spotlight,
                        state.focusProjectId,
                        state.selected,
                      ),
                      "--hue": hue,
                    } as CSSProperties}
                    data-zoom={state.focusProjectId === project.id ? "true" : undefined}
                    aria-pressed={state.selected.includes(project.id)}
                    tabIndex={tileRove.index === index ? 0 : -1}
                    aria-label={readoutFor(target)}
                    onMouseEnter={() => onHover(target)}
                    onFocus={() => {
                      tileRove.setIndex(index);
                      onKbd(target);
                    }}
                    onBlur={() => onKbd(null)}
                    onClick={(event) => onProject(project.id, event.shiftKey)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && event.shiftKey) {
                        event.preventDefault();
                        onProject(project.id, true);
                        return;
                      }
                      tileRove.onKeyDown(event, index);
                    }}
                  >
                    <Ticks />
                    <span className={styles.tileName}>{project.label}</span>
                    <ShareRing share={project.reservas / FIXTURE.total.reservas} color={hue} />
                    <span className={styles.tileMain}>
                      <span className={styles.tileValue}>
                        <Count value={project.reservas} />
                      </span>
                      <Delta label={project.changeLabel} change={project.change} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={heroRef} className={styles.heroWrap}>
          <Panel className={cx(styles.fill, styles.hero)} labelledBy="cdm-bar-title">
            <div className={styles.heroHead}>
              <h2 id="cdm-bar-title" className={styles.srOnly}>
                Barras por proyecto. Al elegir un proyecto, sus asesores.
              </h2>
              <nav className={styles.crumbs} aria-label="Total, proyecto y asesor">
                <button type="button" className={styles.crumb} aria-current={trailProject ? undefined : "page"} onClick={onTotal}>
                  Total
                </button>
                <span className={styles.crumbSep} aria-hidden="true">›</span>
                {trailProject ? (
                  <button
                    type="button"
                    className={styles.crumb}
                    aria-current={trailAdvisor ? undefined : "page"}
                    onClick={() => onProject(trailProject.id, false)}
                  >
                    {trailProject.label}
                  </button>
                ) : (
                  <span className={styles.crumbMuted}>Proyecto</span>
                )}
                <span className={styles.crumbSep} aria-hidden="true">›</span>
                {trailAdvisor && trailProject ? (
                  <button type="button" className={styles.crumb} aria-current="page" onClick={() => onAdvisor(trailAdvisor.id)}>
                    {trailAdvisor.name}
                  </button>
                ) : (
                  <span className={styles.crumbMuted}>Asesor</span>
                )}
              </nav>
              <div className={styles.heroTools}>
                <div className={styles.seg} role="group" aria-label="Vista del gráfico">
                  {(["barras", "treemap", "flujo"] as const).map((view) => (
                    <button
                      key={view}
                      type="button"
                      aria-pressed={state.view === view}
                      onClick={() => dispatch({ type: "set-view", view })}
                    >
                      {view === "barras" ? "Barras" : view === "treemap" ? "Treemap" : "Flujo"}
                    </button>
                  ))}
                </div>
                <button type="button" className={styles.btn} onClick={presentHero}>
                  Pantalla completa
                </button>
              </div>
              {presentNote ? <p className={styles.caption}>{presentNote}</p> : null}
            </div>
            <div className={styles.heroChart}>
              {state.view === "barras" ? <VerticalBars {...handlers} /> : null}
              {state.view === "treemap" ? <TreemapView {...handlers} /> : null}
              {state.view === "flujo" ? <FlowView {...handlers} /> : null}
            </div>
          </Panel>
          </div>

          <Panel className={cx(styles.fill, styles.scroll)} labelledBy="cdm-rank-title">
            <div className={styles.rankHead}>
              <h2 id="cdm-rank-title" className={styles.panelTitle}>Asesores</h2>
            </div>
            <div className={styles.metaBox}>
              <label className={styles.metaToggle}>
                <input
                  type="checkbox"
                  checked={state.metaOn}
                  onChange={(event) => dispatch({ type: "set-meta-on", on: event.target.checked })}
                />
                Meta de ejemplo
              </label>
              {state.metaOn ? (
                <label className={styles.metaSlider}>
                  <span className={styles.srOnly}>Meta de ejemplo por asesor</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={state.metaValue}
                    onChange={(event) => dispatch({ type: "set-meta-value", value: Number(event.target.value) })}
                  />
                  <span>{state.metaValue}</span>
                </label>
              ) : null}
              <p className={styles.caption}>valor ajustable, no es dato del SSOT</p>
              {state.metaOn ? (
                <p className={styles.caption}>
                  {FIXTURE.projects.flatMap((project) => project.advisors).filter((advisor) => advisor.reservas >= state.metaValue).length} de 6 asesores llegan a {state.metaValue}.
                </p>
              ) : null}
            </div>
            <Ranking projects={projects} meta={state.metaOn ? { value: state.metaValue } : null} {...handlers} />
          </Panel>
        </div>

        <div className={styles.bottom}>
          <Panel labelledBy="cdm-bridge-title">
            <h2 id="cdm-bridge-title" className={styles.panelTitle}>Puente del mes</h2>
            <Waterfall {...handlers} />
          </Panel>
          <Panel labelledBy="cdm-cmp-title">
            <h2 id="cdm-cmp-title" className={styles.panelTitle}>Mes pasado y mes anterior</h2>
            <Comparison {...handlers} />
          </Panel>
          <Panel labelledBy="cdm-insight-title">
            <h2 id="cdm-insight-title" className={styles.panelTitle}>Octubre 2026</h2>
            <ul className={styles.insightList}>
              {INSIGHTS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {state.drawerAdvisorId ? (
        <Drawer advisorId={state.drawerAdvisorId} onClose={() => dispatch({ type: "close-drawer" })} />
      ) : null}
      {state.origen ? <Origen onClose={() => dispatch({ type: "set-origen", open: false })} /> : null}
      {state.shortcuts ? <Shortcuts onClose={() => dispatch({ type: "toggle-shortcuts" })} /> : null}
    </div>
  );
}
