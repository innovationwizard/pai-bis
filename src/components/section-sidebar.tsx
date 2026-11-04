"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DEPARTMENT_LABEL,
  departmentFromPath,
  iconsFor,
  type DepartmentIcon,
} from "@/app/pabi/department-icons";
import { useDashboardTier } from "@/lib/dashboard-tier";

const STORAGE_KEY = "pai-section-nav-expanded";

/**
 * Width reference for the expanded rail. The column fits the icon, the gap,
 * and whichever of these two labels is wider, plus the rail's own padding.
 */
const WIDTH_LABELS = ["Control de incrementos", "Control de promociones"] as const;

function readExpanded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href
    || (pathname === "/ventas" && href === "/ventas/ventas-totales")
    || (pathname === "/cobros" && href === "/cobros/cobros-por-proyecto");
}

export default function SectionSidebar({
  label,
  items,
}: {
  label: string;
  items: readonly DepartmentIcon[];
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(readExpanded());
  }, []);

  if (items.length === 0) return null;

  function toggle() {
    const next = !expanded;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* keep the in-memory value for this view */
    }
    setExpanded(next);
  }

  return (
    <nav
      className="section-sidebar rounded-2xl border border-border backdrop-blur-sm bg-gradient-to-b from-panel-gradient-from/85 to-panel-gradient-to/70"
      data-expanded={expanded ? "true" : "false"}
      aria-label={label}
    >
      <span className="section-sidebar-sizer" aria-hidden="true">
        <span className="section-sidebar-sizer-icon" />
        <span className="section-sidebar-sizer-labels">
          {WIDTH_LABELS.map((text) => (
            <span key={text}>{text}</span>
          ))}
        </span>
      </span>
      <button
        type="button"
        className="glass-chevron section-sidebar-toggle"
        aria-expanded={expanded}
        aria-label={expanded ? "Contraer secciones" : "Expandir secciones"}
        onClick={toggle}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
          <path d="M5.25 3 9.25 7 5.25 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="section-sidebar-list">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.slug}
              href={item.href}
              aria-label={item.title}
              aria-current={current ? "page" : undefined}
              className="section-sidebar-link"
            >
              <span className="section-sidebar-glyph">
                <Icon size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="section-sidebar-label">{item.title}</span>
              <span className="section-sidebar-tip" aria-hidden="true">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DepartmentSectionSidebar() {
  const pathname = usePathname();
  const { tier } = useDashboardTier();
  const department = departmentFromPath(pathname);
  const icons = department ? iconsFor(department, tier) : [];
  if (!department || icons.length === 0) return null;
  return <SectionSidebar label={DEPARTMENT_LABEL[department]} items={icons} />;
}
