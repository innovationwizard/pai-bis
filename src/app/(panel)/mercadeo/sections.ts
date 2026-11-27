import type { LucideIcon } from "lucide-react";
import { Building2, ClipboardList, LineChart, Megaphone, Wallet } from "lucide-react";

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
  { slug: "integracion-de-inventarios", title: "Integración de Inventarios", icon: Building2 },
  { slug: "presupuesto-mercadeo", title: "Presupuesto Mercadeo", icon: Wallet },
];

export function mercadeoSectionPath(slug: string): string {
  return `/mercadeo#${slug}`;
}
