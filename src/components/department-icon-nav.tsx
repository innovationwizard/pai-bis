"use client";

import { usePathname } from "next/navigation";
import type { DepartmentIcon } from "@/app/pabi/department-icons";

export default function DepartmentIconNav({
  label,
  items,
}: {
  label: string;
  items: readonly DepartmentIcon[];
}) {
  const pathname = usePathname();
  if (items.length === 0) return null;

  return (
    <nav className="ventas-icons" aria-label={label}>
      {items.map((item) => {
        const current = pathname === item.href;
        const Icon = item.icon;
        return (
          <a
            key={item.slug}
            href={item.href}
            aria-label={item.title}
            aria-current={current ? "page" : undefined}
            className="ventas-icon"
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden />
            <span className="ventas-icon-tip" aria-hidden="true">
              {item.title}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
