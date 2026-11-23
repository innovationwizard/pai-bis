import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeDollarSign,
  Ban,
  Boxes,
  Building2,
  Megaphone,
  PackageSearch,
  Percent,
  PieChart,
  Tags,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

export type VentasSection = {
  slug: string;
  title: string;
  icon: LucideIcon;
};

export const VENTAS_SECTIONS: readonly VentasSection[] = [
  { slug: "ventas-totales", title: "Ventas totales", icon: BadgeDollarSign },
  { slug: "objetivos-de-ventas", title: "Objetivos de ventas", icon: Target },
  { slug: "status-de-ventas", title: "Status de ventas", icon: Activity },
  { slug: "ventas-por-canales", title: "Ventas por canales", icon: PieChart },
  { slug: "analisis-de-inventario", title: "Análisis de inventario", icon: PackageSearch },
  { slug: "inventario-general", title: "Inventario general", icon: Boxes },
  { slug: "valor-del-proyecto", title: "Valor de proyecto", icon: Building2 },
  { slug: "desistimientos", title: "Desistimientos", icon: Ban },
  { slug: "tasa-de-conversion", title: "Tasa de conversión", icon: Percent },
  { slug: "descuentos", title: "Control de descuentos", icon: Tags },
  { slug: "subidas-de-precios", title: "Control de subidas de precios", icon: TrendingUp },
  { slug: "ff-y-casos-especiales", title: "F&F y casos especiales", icon: Users },
  { slug: "promociones", title: "Control de promociones", icon: Megaphone },
];

export function ventasSectionPath(slug: string): string {
  return `/ventas/${slug}`;
}
