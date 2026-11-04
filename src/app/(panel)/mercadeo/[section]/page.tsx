import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SectionPage from "@/components/section-page";
import { departmentStaticParams, locateIcon } from "@/app/pabi/department-icons";
import TierDrill from "@/app/pabi/tier-drill";
import { isGlanceSection } from "@/lib/mercadeo/glance-types";
import GlanceView from "../glance-view";
import OperativoView from "../operativo-view";
import { MERCADEO_SECTIONS } from "../sections";

type MercadeoSectionPageProps = {
  params: Promise<{ section: string }>;
};

export function generateStaticParams(): { section: string }[] {
  const seen = new Set(MERCADEO_SECTIONS.map((section) => section.slug));
  const extras = departmentStaticParams("mercadeo").filter((item) => !seen.has(item.section));
  return [...MERCADEO_SECTIONS.map((section) => ({ section: section.slug })), ...extras];
}

export async function generateMetadata({ params }: MercadeoSectionPageProps): Promise<Metadata> {
  const { section } = await params;
  const match = MERCADEO_SECTIONS.find((item) => item.slug === section);
  if (match) return { title: `${match.title} | Puerta Abierta` };
  const located = locateIcon("mercadeo", section);
  if (!located) return { title: "Mercadeo | Puerta Abierta" };
  return { title: `${located.item.title} | Puerta Abierta` };
}

export default async function MercadeoSectionPage({ params }: MercadeoSectionPageProps) {
  const { section } = await params;
  const match = MERCADEO_SECTIONS.find((item) => item.slug === section);
  if (match) {
    if (match.slug === "reporte-maestro") {
      return (
        <SectionPage>
          <OperativoView variant="reporte" />
        </SectionPage>
      );
    }
    if (isGlanceSection(match.slug)) {
      return (
        <SectionPage>
          <GlanceView section={match.slug} />
        </SectionPage>
      );
    }
  }
  const located = locateIcon("mercadeo", section);
  if (!located?.item.drill) notFound();
  return (
    <SectionPage title={`${located.index + 1}. ${located.item.title}`}>
      <TierDrill drill={located.item.drill} />
    </SectionPage>
  );
}
