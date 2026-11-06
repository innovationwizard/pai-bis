"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

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
