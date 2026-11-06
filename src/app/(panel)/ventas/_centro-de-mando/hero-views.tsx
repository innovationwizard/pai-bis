"use client";

import { useEffect, useMemo, useState, type KeyboardEvent as ReactKey, type ReactElement, type SVGProps } from "react";
import { ResponsiveContainer, Sankey, Treemap, type TreemapNode } from "recharts";
import type { LinkProps, NodeProps } from "recharts/types/chart/Sankey";
import { readoutFor } from "./format";
import { flowData, markOpacity, textOn, treemapCells, type FlowNodeDatum } from "./model";
import type { Target } from "./state";
import styles from "./centro.module.css";

type ChartHandlers = {
  spotlight: Target | null;
  focusProjectId: string | null;
  selected: readonly string[];
  onProject: (projectId: string, shift: boolean) => void;
  onAdvisor: (advisorId: string, projectId: string) => void;
  onTotal: () => void;
  onHover: (target: Target | null) => void;
  onKbd: (target: Target | null) => void;
};

function useChartReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready;
}

function targetOf(kind: FlowNodeDatum["kind"], projectId: string | null, advisorId: string | null): Target | null {
  if (kind === "total") return { kind: "total" };
  if (kind === "project" && projectId) return { kind: "project", projectId };
  if (kind === "advisor" && projectId && advisorId) return { kind: "advisor", projectId, advisorId };
  return null;
}

function activate(target: Target, shift: boolean, handlers: ChartHandlers) {
  if (target.kind === "total") handlers.onTotal();
  else if (target.kind === "project") handlers.onProject(target.projectId, shift);
  else handlers.onAdvisor(target.advisorId, target.projectId);
}

function moveFocus(event: ReactKey<SVGElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }
  const group = event.currentTarget.closest("[data-rove]");
  if (!group) return;
  const items = [...group.querySelectorAll<SVGElement>("[data-rove-item]")];
  const index = items.indexOf(event.currentTarget);
  if (index < 0 || items.length === 0) return;
  event.preventDefault();
  const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
  items[(index + direction + items.length) % items.length]?.focus();
}

export function TreemapView(handlers: ChartHandlers) {
  const ready = useChartReady();
  const cells = useMemo(
    () => treemapCells(handlers.focusProjectId, handlers.selected),
    [handlers.focusProjectId, handlers.selected],
  );

  function renderCell(node: TreemapNode): ReactElement {
    const cell = cells.find((item) => item.name === node.name);
    if (!cell || node.depth === 0) return <g />;
    const target = targetOf(cell.kind, cell.projectId, cell.advisorId);
    if (!target) return <g />;
    const fade = markOpacity(
      { kind: cell.kind, projectId: cell.projectId, advisorId: cell.advisorId },
      handlers.spotlight,
      handlers.focusProjectId,
      handlers.selected,
    );
    const index = cells.findIndex((item) => item.name === cell.name);
    const wide = node.width > 56 && node.height > 28;
    return (
      <g className={styles.mark} style={{ opacity: fade }}>
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          fill={cell.fill}
          stroke="#ffffff"
          strokeWidth={1}
          data-rove-item=""
          tabIndex={index === 0 ? 0 : -1}
          role="button"
          aria-label={readoutFor(target)}
          onMouseEnter={() => handlers.onHover(target)}
          onFocus={() => handlers.onKbd(target)}
          onBlur={() => handlers.onKbd(null)}
          onClick={(event) => activate(target, event.shiftKey, handlers)}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && event.shiftKey && target.kind === "project") {
              event.preventDefault();
              handlers.onProject(target.projectId, true);
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              activate(target, false, handlers);
              return;
            }
            moveFocus(event);
          }}
        />
        {wide ? (
          <text
            x={node.x + 6}
            y={node.y + 16}
            fill={textOn(cell.fill)}
            fontSize={11}
            fontWeight={700}
            pointerEvents="none"
          >
            {cell.name} {cell.value}
          </text>
        ) : null}
      </g>
    );
  }

  return (
    <div className={styles.chartSlot} data-rove="" style={{ minHeight: 180 }} role="group" aria-label="Treemap de la captura">
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={cells}
            dataKey="value"
            nameKey="name"
            type="flat"
            isAnimationActive={false}
            isUpdateAnimationActive={false}
            content={renderCell}
          />
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export function FlowView(handlers: ChartHandlers) {
  const ready = useChartReady();
  const data = useMemo(
    () => flowData(handlers.focusProjectId, handlers.selected),
    [handlers.focusProjectId, handlers.selected],
  );
  const byName = useMemo(() => new Map(data.nodes.map((node) => [node.name, node])), [data.nodes]);

  function fadeFor(datum: FlowNodeDatum | undefined): number {
    if (!datum) return 0.35;
    return markOpacity(
      { kind: datum.kind, projectId: datum.projectId, advisorId: datum.advisorId },
      handlers.spotlight,
      handlers.focusProjectId,
      handlers.selected,
    );
  }

  function renderNode(props: NodeProps): ReactElement {
    const datum = byName.get(props.payload.name);
    const target = datum ? targetOf(datum.kind, datum.projectId, datum.advisorId) : null;
    const fade = fadeFor(datum);
    const index = data.nodes.findIndex((node) => node.name === props.payload.name);
    const fill = datum?.fill ?? "#0d2041";
    return (
      <g className={styles.mark} style={{ opacity: fade }}>
        <rect
          x={props.x}
          y={props.y}
          width={props.width}
          height={props.height}
          fill={fill}
          stroke="#ffffff"
          strokeWidth={1}
          data-rove-item=""
          tabIndex={index === 0 ? 0 : -1}
          role="button"
          aria-label={target ? readoutFor(target) : props.payload.name}
          onMouseEnter={() => {
            if (target) handlers.onHover(target);
          }}
          onFocus={() => {
            if (target) handlers.onKbd(target);
          }}
          onBlur={() => handlers.onKbd(null)}
          onClick={(event) => {
            if (target) activate(target, event.shiftKey, handlers);
          }}
          onKeyDown={(event) => {
            if (!target) return;
            if ((event.key === "Enter" || event.key === " ") && event.shiftKey && target.kind === "project") {
              event.preventDefault();
              handlers.onProject(target.projectId, true);
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              activate(target, false, handlers);
              return;
            }
            moveFocus(event);
          }}
        />
        {props.height > 14 ? (
          <text
            x={props.x + props.width + 4}
            y={props.y + props.height / 2}
            dominantBaseline="middle"
            fill="#0d2041"
            fontSize={10}
            pointerEvents="none"
          >
            {props.payload.name}
          </text>
        ) : null}
      </g>
    );
  }

  function renderLink(props: LinkProps): ReactElement<SVGProps<SVGPathElement>> {
    const source = byName.get(props.payload.source.name);
    const target = byName.get(props.payload.target.name);
    const fade = Math.max(fadeFor(source), fadeFor(target));
    const d = `M${props.sourceX},${props.sourceY}C${props.sourceControlX},${props.sourceY} ${props.targetControlX},${props.targetY} ${props.targetX},${props.targetY}`;
    return (
      <path
        d={d}
        fill="none"
        stroke={source?.fill ?? "#94a3b8"}
        strokeWidth={props.linkWidth}
        strokeOpacity={fade === 1 ? 0.55 : 0.16}
        className={styles.mark}
      />
    );
  }

  return (
    <div className={styles.chartSlot} data-rove="" style={{ minHeight: 180 }} role="group" aria-label="Flujo de la captura">
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={data}
            node={renderNode}
            link={renderLink}
            nodeWidth={10}
            nodePadding={14}
            sort={false}
            margin={{ top: 8, right: 96, bottom: 8, left: 8 }}
          />
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
