"use client";

import { usePathname } from "next/navigation";
import { VENTAS_SECTIONS, ventasSectionPath } from "./sections";

export default function VentasIconNav() {
  const pathname = usePathname();

  return (
    <nav className="ventas-icons" aria-label="Ventas">
      {VENTAS_SECTIONS.map((section) => {
        const href = ventasSectionPath(section.slug);
        const current = pathname === href;
        const Icon = section.icon;
        return (
          <a
            key={section.slug}
            href={href}
            aria-label={section.title}
            aria-current={current ? "page" : undefined}
            className="ventas-icon"
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden />
            <span className="ventas-icon-tip" aria-hidden="true">
              {section.title}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
