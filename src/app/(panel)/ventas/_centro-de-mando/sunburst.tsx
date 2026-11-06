"use client";

import { arc } from "d3-shape";
import { FIXTURE } from "./fixture";
import { readoutFor } from "./format";
import { drawable, shownTarget, textOn, type Geom, type SunArc } from "./model";
import { useRove, useTweenedSunburst } from "./motion";
import type { Target } from "./state";
import styles from "./centro.module.css";

const OUTER = 46;
const UNIT = OUTER / 3;

const SUN_ARC = arc<Geom>()
  .startAngle((geom) => geom.x0)
  .endAngle((geom) => geom.x1)
  .padAngle((geom) => Math.min(0.012, Math.max(0, geom.x1 - geom.x0) / 5))
  .padRadius(OUTER)
  .innerRadius((geom) => Math.max(0, geom.y0) * UNIT)
  .outerRadius((geom) => {
    const inner = Math.max(0, geom.y0) * UNIT;
    return Math.max(inner, Math.max(0, geom.y1) * UNIT - 0.6);
  });

type SunburstProps = {
  focusProjectId: string | null;
  spotlight: Target | null;
  selected: readonly string[];
  opacityFor: (arc: SunArc) => number;
  centerValue: number;
  centerShare: string;
  onProject: (projectId: string, shift: boolean) => void;
  onAdvisor: (advisorId: string, projectId: string) => void;
  onTotal: () => void;
  onHover: (target: Target | null) => void;
  onKbd: (target: Target | null) => void;
};

function targetOf(arc: SunArc): Target {
  if (arc.kind === "advisor" && arc.advisorId) {
    return { kind: "advisor", projectId: arc.projectId, advisorId: arc.advisorId };
  }
  return { kind: "project", projectId: arc.projectId };
}

export default function Sunburst({
  focusProjectId,
  opacityFor,
  centerValue,
  centerShare,
  onProject,
  onAdvisor,
  onTotal,
  onHover,
  onKbd,
}: SunburstProps) {
  const { arcs, geoms, targets } = useTweenedSunburst(focusProjectId);
  const visible = arcs.filter((item) => {
    const goal = targets.get(item.id);
    return goal ? shownTarget(goal) : false;
  });
  const rove = useRove<SVGElement>(visible.length + 1, focusProjectId ?? "");

  function activate(arc: SunArc, shift: boolean) {
    if (arc.kind === "project") onProject(arc.projectId, shift);
    else if (arc.advisorId) onAdvisor(arc.advisorId, arc.projectId);
  }

  return (
    <svg
      className={styles.sun}
      viewBox="-52 -52 104 104"
      role="group"
      aria-label="Gráfico de la captura por proyecto y asesor"
    >
      <rect
        x={-52}
        y={-52}
        width={104}
        height={104}
        fill="transparent"
        onMouseEnter={() => onHover(null)}
      />
      {arcs.map((item) => {
        const geom = geoms.get(item.id);
        if (!geom || !drawable(geom)) return null;
        const path = SUN_ARC(geom);
        if (!path) return null;
        const position = visible.findIndex((entry) => entry.id === item.id);
        const inTabOrder = position >= 0;
        const tabAt = position + 1;
        const span = geom.x1 - geom.x0;
        const showName = span > 0.9 && geom.y0 >= 0.85 && geom.y1 <= 3.05;
        const showValue = span > 0.4 && geom.y0 >= 0.85 && geom.y1 <= 3.05;
        const angle = (geom.x0 + geom.x1) / 2;
        const radius = ((Math.max(geom.y0, 1) + Math.min(geom.y1, 3)) / 2) * UNIT;
        const lx = Math.sin(angle) * radius;
        const ly = -Math.cos(angle) * radius;
        const label = item.name.split(" ")[0] ?? item.name;
        return (
          <g key={item.id} className={styles.mark} style={{ opacity: opacityFor(item) }}>
            <path
              ref={(node) => {
                if (inTabOrder) rove.refs.current[tabAt] = node;
              }}
              className={styles.arc}
              d={path}
              fill={item.fill}
              stroke="#ffffff"
              strokeWidth={0.45}
              tabIndex={inTabOrder && rove.index === tabAt ? 0 : -1}
              role="button"
              aria-label={readoutFor(targetOf(item))}
              onMouseEnter={() => onHover(targetOf(item))}
              onFocus={() => {
                if (inTabOrder) rove.setIndex(tabAt);
                onKbd(targetOf(item));
              }}
              onBlur={() => onKbd(null)}
              onClick={(event) => activate(item, event.shiftKey)}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && event.shiftKey && item.kind === "project") {
                  event.preventDefault();
                  onProject(item.projectId, true);
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate(item, false);
                  return;
                }
                if (inTabOrder) rove.onKeyDown(event, tabAt);
              }}
            />
            {showName || showValue ? (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={textOn(item.fill)}
                fontSize={showName ? 3.1 : 3.4}
                fontWeight={700}
                pointerEvents="none"
              >
                {showName ? label : item.reservas}
              </text>
            ) : null}
          </g>
        );
      })}
      <circle
        ref={(node) => {
          rove.refs.current[0] = node;
        }}
        className={styles.arc}
        r={UNIT * 0.92}
        fill="#ffffff"
        stroke="#e2e8f0"
        strokeWidth={0.4}
        tabIndex={rove.index === 0 ? 0 : -1}
        role="button"
        aria-label={`${readoutFor({ kind: "total" })} Centro: alejar.`}
        onMouseEnter={() => onHover({ kind: "total" })}
        onFocus={() => {
          rove.setIndex(0);
          onKbd({ kind: "total" });
        }}
        onBlur={() => onKbd(null)}
        onClick={onTotal}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onTotal();
            return;
          }
          rove.onKeyDown(event, 0);
        }}
      />
      <text y={-3} textAnchor="middle" fill="#0d2041" fontSize={8} fontWeight={700} pointerEvents="none">
        {centerValue}
      </text>
      <text y={3.2} textAnchor="middle" fill="#0d2041" fontSize={2.7} fontWeight={600} pointerEvents="none">
        reservas
      </text>
      <text y={7.2} textAnchor="middle" fill="#64748b" fontSize={2.5} pointerEvents="none">
        {centerShare}
      </text>
      <text y={10.4} textAnchor="middle" fill="#64748b" fontSize={2.2} pointerEvents="none">
        captura
      </text>
      <title>{`Captura ${FIXTURE.badge}`}</title>
    </svg>
  );
}
