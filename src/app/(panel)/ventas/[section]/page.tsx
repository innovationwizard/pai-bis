import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SectionPage from "@/components/section-page";
import VentasBoard from "../board";
import GlanceView from "../glance-view";
import { VENTAS_SECTIONS } from "../sections";
import { departmentStaticParams, locateIcon } from "@/app/pabi/department-icons";
import GhostCard from "@/app/pabi/ghost-card";
import TierDrill from "@/app/pabi/tier-drill";
import { isVistaSection } from "@/lib/ventas/vista-types";

function drillMissing(slug: string): string | null {
  if (slug === "cierre-mensual-de-ventas") return "comisiones de ventas, sin fuente en vivo";
  if (slug === "cesion-clientes" || slug === "cesion-directivo") {
    return "cesión de derechos, sin fuente en vivo";
  }
  return null;
}

type VentasSectionPageProps = {
  params: Promise<{ section: string }>;
};

export function generateStaticParams(): { section: string }[] {
  const seen = new Set(VENTAS_SECTIONS.map((section) => section.slug));
  const extras = departmentStaticParams("ventas").filter((item) => !seen.has(item.section));
  return [...VENTAS_SECTIONS.map((section) => ({ section: section.slug })), ...extras];
}

export async function generateMetadata({ params }: VentasSectionPageProps): Promise<Metadata> {
  const { section } = await params;
  const match = VENTAS_SECTIONS.find((item) => item.slug === section);
  if (match) return { title: `${match.title} | Puerta Abierta` };
  const located = locateIcon("ventas", section);
  if (!located) return { title: "Ventas | Puerta Abierta" };
  return { title: `${located.item.title} | Puerta Abierta` };
}

export default async function VentasSectionPage({ params }: VentasSectionPageProps) {
  const { section } = await params;
  const match = VENTAS_SECTIONS.find((item) => item.slug === section);
  if (match) {
    if (isVistaSection(match.slug)) {
      return (
        <SectionPage>
          <GlanceView section={match.slug} />
        </SectionPage>
      );
    }
    const index = VENTAS_SECTIONS.findIndex((item) => item.slug === section);
    return (
      <SectionPage title={`${index + 1}. ${match.title}`}>
        <VentasBoard section={match.slug} />
      </SectionPage>
    );
  }
  const located = locateIcon("ventas", section);
  if (!located?.item.drill) notFound();
  const missing = drillMissing(section);
  return (
    <SectionPage title={`${located.index + 1}. ${located.item.title}`}>
      {missing === null ? <TierDrill drill={located.item.drill} /> : <GhostCard missing={missing} />}
    </SectionPage>
  );
}
