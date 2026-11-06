"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { easeCubicInOut } from "d3-ease";
import { interpolateNumber } from "d3-interpolate";
import { sunburstArcs, targetsFor, type Geom, type SunArc } from "./model";

export function useRafProgress(key: string, durationMs: number): number {
  const [progress, setProgress] = useState(1);
  const seen = useRef(key);
  const skipMount = useRef(true);

  if (seen.current !== key) {
    seen.current = key;
    setProgress(0);
  }

  useEffect(() => {
    if (skipMount.current) {
      skipMount.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - started) / durationMs);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key, durationMs]);

  return progress;
}

export function useTweenedSunburst(focusId: string | null): {
  arcs: SunArc[];
  geoms: Map<string, Geom>;
  targets: Map<string, Geom>;
} {
  const arcs = useMemo(() => sunburstArcs(), []);
  const key = focusId ?? "";
  const to = useMemo(() => targetsFor(arcs, focusId), [arcs, focusId]);
  const [pair, setPair] = useState(() => ({ key, from: to, to }));
  if (pair.key !== key) setPair({ key, from: pair.to, to });
  const progress = useRafProgress(key, 450);
  const eased = easeCubicInOut(progress);

  const geoms = useMemo(() => {
    const map = new Map<string, Geom>();
    for (const [id, goal] of pair.to) {
      const start = pair.from.get(id) ?? goal;
      map.set(id, {
        x0: interpolateNumber(start.x0, goal.x0)(eased),
        x1: interpolateNumber(start.x1, goal.x1)(eased),
        y0: interpolateNumber(start.y0, goal.y0)(eased),
        y1: interpolateNumber(start.y1, goal.y1)(eased),
      });
    }
    return map;
  }, [pair, eased]);

  return { arcs, geoms, targets: pair.to };
}

export function useCountUp(target: number): number {
  const [shown, setShown] = useState(target);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      setShown(target);
      return;
    }
    started.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const duration = 700;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

export function useRove<T extends HTMLElement | SVGElement>(count: number, resetKey: string) {
  const [index, setIndex] = useState(0);
  const refs = useRef<Array<T | null>>([]);

  useEffect(() => {
    setIndex(0);
  }, [resetKey]);

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  function onKeyDown(event: KeyboardEvent<Element>, position: number) {
    if (count <= 0) return;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const next = (position + direction + count) % count;
    setIndex(next);
    refs.current[next]?.focus();
  }

  return { index, setIndex, refs, onKeyDown };
}

export function useFlip(signature: string): RefObject<Map<string, HTMLElement>> {
  const refs = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    refs.current.forEach((element, id) => {
      const top = element.getBoundingClientRect().top;
      const previous = tops.current.get(id);
      next.set(id, top);
      if (!reduce && previous != null && Math.abs(previous - top) > 0.5) {
        element.animate(
          [{ transform: `translateY(${previous - top}px)` }, { transform: "translateY(0)" }],
          { duration: 450, easing: "cubic-bezier(0.45, 0, 0.2, 1)" },
        );
      }
    });
    tops.current = next;
  }, [signature]);

  return refs;
}
