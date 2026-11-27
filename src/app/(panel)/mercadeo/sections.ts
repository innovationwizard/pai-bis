import type { LucideIcon } from "lucide-react";
import { ClipboardList, LineChart, Megaphone } from "lucide-react";

export type MercadeoSection = {
  slug: string;
  title: string;
  icon: LucideIcon;
};

/** Report bands on the one scroll, in the order the rail follows. */
export const MERCADEO_SECTIONS: readonly MercadeoSection[] = [
  { slug: "performance-ads", title: "Performance Ads", icon: Megaphone },
  { slug: "performance-s", title: "Performance S", icon: LineChart },
  { slug: "reporte-reservas", title: "Reporte Reservas", icon: ClipboardList },
];

export function mercadeoSectionPath(slug: string): string {
  return `/mercadeo#${slug}`;
}
