import type { LucideIcon } from "lucide-react";
import { Building2, ClipboardList, FileText, LineChart, Megaphone, Wallet } from "lucide-react";

export type MercadeoSection = {
  slug: string;
  title: string;
  icon: LucideIcon;
};

/** Report pages, in the Power BI page order. The rail scrolls to these bands. */
export const MERCADEO_SECTIONS: readonly MercadeoSection[] = [
  { slug: "performance-ads", title: "Performance Ads", icon: Megaphone },
  { slug: "performance-s", title: "Performance S", icon: LineChart },
  { slug: "reporte-reservas", title: "Reporte Reservas", icon: ClipboardList },
  { slug: "integracion-de-inventarios", title: "Integración de Inventarios", icon: Building2 },
  { slug: "presupuesto-mercadeo", title: "Presupuesto Mercadeo", icon: Wallet },
  { slug: "pagina-1", title: "Página 1", icon: FileText },
];

export function mercadeoSectionPath(slug: string): string {
  return `/mercadeo#${slug}`;
}
