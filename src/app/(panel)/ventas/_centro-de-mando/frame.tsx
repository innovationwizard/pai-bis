import type { KeyboardEvent, ReactNode } from "react";
import styles from "./centro.module.css";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function trapTab(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const root = event.currentTarget;
  const items = [...root.querySelectorAll<HTMLElement>("button, [href], input, select, textarea")].filter(
    (item) => !item.hasAttribute("disabled"),
  );
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function Panel({
  className,
  children,
  labelledBy,
}: {
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section className={cx(styles.panel, className)} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}
