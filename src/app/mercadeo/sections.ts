import type { LucideIcon } from "lucide-react";
import { LineChart, Megaphone, Radio, Target, TrendingUp } from "lucide-react";

export type MercadeoSection = {
  slug: string;
  title: string;
  icon: LucideIcon;
};

export const MERCADEO_SECTIONS: readonly MercadeoSection[] = [
  { slug: "reporte-maestro", title: "Reporte maestro", icon: Target },
  { slug: "efectividad", title: "Efectividad de campañas", icon: Megaphone },
  { slug: "costo-por-lead", title: "Evolución de costos por lead mensual", icon: LineChart },
  { slug: "inversion-acumulada", title: "Evolución de inversiones en pauta acumulada mensual", icon: TrendingUp },
  { slug: "canales", title: "Operatividad de canales", icon: Radio },
];

export function mercadeoSectionPath(slug: string): string {
  return `/mercadeo/${slug}`;
}
