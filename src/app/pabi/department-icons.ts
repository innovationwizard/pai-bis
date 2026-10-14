import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowLeftRight,
  Ban,
  BadgeCheck,
  Banknote,
  Bell,
  Building2,
  Calendar,
  CalendarCheck,
  ClipboardList,
  FilePen,
  FileSearch,
  FileText,
  Files,
  FolderOpen,
  Gavel,
  KeyRound,
  Landmark,
  Layers,
  Pause,
  PenLine,
  Receipt,
  RefreshCw,
  Scale,
  ScanLine,
  ScrollText,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { MERCADEO_SECTIONS, mercadeoSectionPath } from "@/app/mercadeo/sections";
import { VENTAS_SECTIONS, ventasSectionPath } from "@/app/ventas/sections";
import type { DashboardTier } from "@/lib/dashboard-tier";

export type DepartmentId = "ventas" | "mercadeo" | "cobros" | "creditos" | "entregas";

export type TierDrill =
  | "gastos-mercadeo"
  | "fondeos"
  | "centros-de-costos"
  | "cierre-ventas"
  | "retencion-reembolso"
  | "gastos-administrativos"
  | "clientes-a-desistir"
  | "cesion-clientes"
  | "cesion-directivo"
  | "cobros-recurrente"
  | "cobros-alertas"
  | "cierre-cobros"
  | "expedientes";

export type DepartmentIcon = {
  slug: string;
  title: string;
  href: string;
  icon: LucideIcon;
  drill?: TierDrill;
};

export const DEPARTMENT_LABEL: Record<DepartmentId, string> = {
  ventas: "Ventas",
  mercadeo: "Mercadeo",
  cobros: "Cobros",
  creditos: "Créditos",
  entregas: "Entregas",
};

const DEPARTMENTS: readonly DepartmentId[] = ["ventas", "mercadeo", "cobros", "creditos", "entregas"];

function mapSections(
  sections: readonly { slug: string; title: string; icon: LucideIcon }[],
  hrefFor: (slug: string) => string,
): DepartmentIcon[] {
  return sections.map((section) => ({
    slug: section.slug,
    title: section.title,
    href: hrefFor(section.slug),
    icon: section.icon,
  }));
}

function path(department: DepartmentId, slug: string): string {
  return `/${department}/${slug}`;
}

const VENTAS_DIRECTIVO: readonly DepartmentIcon[] = [
  { slug: "cierre-mensual-de-ventas", title: "Cierre mensual de ventas", href: path("ventas", "cierre-mensual-de-ventas"), icon: CalendarCheck, drill: "cierre-ventas" },
  { slug: "reporte-desistimientos", title: "Reporte general de desistimientos", href: "/ventas/desistimientos", icon: Ban },
  { slug: "retencion-reembolso", title: "Retención, reembolso y neto compensado", href: path("ventas", "retencion-reembolso"), icon: Scale, drill: "retencion-reembolso" },
  { slug: "gastos-administrativos", title: "Gastos administrativos retenidos", href: path("ventas", "gastos-administrativos"), icon: Receipt, drill: "gastos-administrativos" },
  { slug: "clientes-a-desistir", title: "Reporte general de clientes a desistir", href: path("ventas", "clientes-a-desistir"), icon: Users, drill: "clientes-a-desistir" },
  { slug: "cesion-clientes", title: "Clientes para cesión de derechos", href: path("ventas", "cesion-clientes"), icon: ArrowLeftRight, drill: "cesion-clientes" },
  { slug: "cesion-directivo", title: "Cesión, desistimientos por bloque y monetario", href: path("ventas", "cesion-directivo"), icon: Landmark, drill: "cesion-directivo" },
];

const MERCADEO_DIRECTIVO: readonly DepartmentIcon[] = [
  { slug: "gastos-mercadeo", title: "Reporte general de gastos de mercadeo", href: path("mercadeo", "gastos-mercadeo"), icon: Wallet, drill: "gastos-mercadeo" },
  { slug: "fondeos", title: "Status de fondeos de mercadeo", href: path("mercadeo", "fondeos"), icon: Landmark, drill: "fondeos" },
  { slug: "centros-de-costos", title: "Presupuesto por centros de costos", href: path("mercadeo", "centros-de-costos"), icon: Layers, drill: "centros-de-costos" },
];

const COBROS_OPERATIVO: readonly DepartmentIcon[] = [
  { slug: "cobros-por-proyecto", title: "Cobros por proyecto", href: path("cobros", "cobros-por-proyecto"), icon: Building2 },
  { slug: "cobros-acumulados", title: "Cobros acumulados", href: path("cobros", "cobros-acumulados"), icon: TrendingUp },
  { slug: "cobros-del-mes", title: "Cobros del mes", href: path("cobros", "cobros-del-mes"), icon: Calendar },
  { slug: "deficit", title: "Déficit mensual y acumulado", href: path("cobros", "deficit"), icon: TrendingDown },
  { slug: "superavit", title: "Superávit mensual y acumulado", href: path("cobros", "superavit"), icon: TrendingUp },
  { slug: "reporte-deficit-superavit", title: "Reporte de déficit y superávit", href: path("cobros", "reporte-deficit-superavit"), icon: Scale },
  { slug: "alertas", title: "Reporte de alertas", href: path("cobros", "alertas"), icon: Bell },
  { slug: "decisiones-desistimientos", title: "Analítica de decisiones de desistimientos", href: path("cobros", "decisiones-desistimientos"), icon: Gavel },
  { slug: "casos-especiales", title: "Casos especiales", href: path("cobros", "casos-especiales"), icon: Users },
];

const COBROS_DIRECTIVO: readonly DepartmentIcon[] = [
  { slug: "reporte-recurrente", title: "Reporte recurrente en tiempo real", href: path("cobros", "reporte-recurrente"), icon: CalendarCheck, drill: "cobros-recurrente" },
  { slug: "alertas-desistimiento", title: "Revisión de alertas para posible desistimiento", href: path("cobros", "alertas-desistimiento"), icon: Bell, drill: "cobros-alertas" },
  { slug: "cierre-mensual-de-cobros", title: "Cierre mensual de cobros", href: path("cobros", "cierre-mensual-de-cobros"), icon: Receipt, drill: "cierre-cobros" },
];

const CREDITOS_OPERATIVO: readonly DepartmentIcon[] = [
  { slug: "expediente-inicial", title: "Control de expediente inicial", href: path("creditos", "expediente-inicial"), icon: ClipboardList },
  { slug: "scanners", title: "Control de scanners de expediente inicial", href: path("creditos", "scanners"), icon: ScanLine },
  { slug: "pcvs", title: "Control de PCVs", href: path("creditos", "pcvs"), icon: FileText },
  { slug: "armado", title: "Armado de expediente", href: path("creditos", "armado"), icon: FolderOpen },
  { slug: "contado", title: "Autorización de ventas al contado", href: path("creditos", "contado"), icon: Banknote },
  { slug: "envio-analisis", title: "Envío a análisis", href: path("creditos", "envio-analisis"), icon: Send },
  { slug: "suspendidos", title: "Suspendidos", href: path("creditos", "suspendidos"), icon: Pause },
  { slug: "reanalisis", title: "Re análisis", href: path("creditos", "reanalisis"), icon: RefreshCw },
  { slug: "aprobacion", title: "Aprobación", href: path("creditos", "aprobacion"), icon: BadgeCheck },
  { slug: "expediente-tecnico", title: "Expediente técnico", href: path("creditos", "expediente-tecnico"), icon: FileSearch },
  { slug: "aprobacion-final", title: "Aprobación final", href: path("creditos", "aprobacion-final"), icon: BadgeCheck },
];

const CREDITOS_DIRECTIVO: readonly DepartmentIcon[] = [
  { slug: "expedientes-por-fase", title: "Expedientes por fase y PCV", href: path("creditos", "expedientes-por-fase"), icon: Files, drill: "expedientes" },
];

const ENTREGAS_OPERATIVO: readonly DepartmentIcon[] = [
  { slug: "escrituracion", title: "Escrituración", href: path("entregas", "escrituracion"), icon: FilePen },
  { slug: "entrega", title: "Entrega", href: path("entregas", "entrega"), icon: KeyRound },
  { slug: "firmas", title: "Recaudación de firmas", href: path("entregas", "firmas"), icon: PenLine },
  { slug: "impuestos", title: "Pago de impuestos", href: path("entregas", "impuestos"), icon: Receipt },
  { slug: "registro", title: "Ingreso al registro", href: path("entregas", "registro"), icon: Landmark },
  { slug: "desembolso", title: "Desembolso", href: path("entregas", "desembolso"), icon: Banknote },
  { slug: "liquidacion", title: "Liquidación", href: path("entregas", "liquidacion"), icon: ScrollText },
  { slug: "archivado", title: "Archivado", href: path("entregas", "archivado"), icon: Archive },
];

const CATALOG: Record<DepartmentId, Record<DashboardTier, readonly DepartmentIcon[]>> = {
  ventas: {
    operativo: mapSections(VENTAS_SECTIONS, ventasSectionPath),
    directivo: VENTAS_DIRECTIVO,
  },
  mercadeo: {
    operativo: mapSections(MERCADEO_SECTIONS, mercadeoSectionPath),
    directivo: MERCADEO_DIRECTIVO,
  },
  cobros: {
    operativo: COBROS_OPERATIVO,
    directivo: COBROS_DIRECTIVO,
  },
  creditos: {
    operativo: CREDITOS_OPERATIVO,
    directivo: CREDITOS_DIRECTIVO,
  },
  entregas: {
    operativo: ENTREGAS_OPERATIVO,
    directivo: [],
  },
};

export function departmentFromPath(pathname: string): DepartmentId | null {
  for (const department of DEPARTMENTS) {
    if (pathname === `/${department}` || pathname.startsWith(`/${department}/`)) return department;
  }
  return null;
}

export function iconsFor(department: DepartmentId, tier: DashboardTier): readonly DepartmentIcon[] {
  return CATALOG[department][tier];
}

export function locateIcon(
  department: DepartmentId,
  slug: string,
): { item: DepartmentIcon; index: number } | null {
  for (const tier of ["operativo", "directivo"] as const) {
    const items = iconsFor(department, tier);
    const index = items.findIndex((item) => item.slug === slug);
    if (index >= 0) return { item: items[index], index };
  }
  return null;
}

export function departmentStaticParams(department: DepartmentId): { section: string }[] {
  const seen = new Set<string>();
  const params: { section: string }[] = [];
  for (const tier of ["operativo", "directivo"] as const) {
    for (const item of iconsFor(department, tier)) {
      if (item.href !== `/${department}/${item.slug}`) continue;
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      params.push({ section: item.slug });
    }
  }
  return params;
}
