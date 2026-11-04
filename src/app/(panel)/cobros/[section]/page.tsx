import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SectionPage from "@/components/section-page";
import { locateIcon } from "@/app/pabi/department-icons";
import { isCobrosSection } from "@/lib/cobros/types";
import CobrosView from "../cobros-view";

type Props = { params: Promise<{ section: string }> };

export function generateStaticParams(): { section: string }[] {
  return [
    "cobros-por-proyecto",
    "cobros-acumulados",
    "cobros-del-mes",
    "deficit",
    "superavit",
    "reporte-deficit-superavit",
    "alertas",
    "decisiones-desistimientos",
    "casos-especiales",
    "reporte-recurrente",
    "alertas-desistimiento",
    "cierre-mensual-de-cobros",
  ].map((section) => ({ section }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const located = locateIcon("cobros", section);
  if (!located) return { title: "Cobros | Puerta Abierta" };
  return { title: `${located.item.title} | Puerta Abierta` };
}

export default async function CobrosSectionPage({ params }: Props) {
  const { section } = await params;
  if (!isCobrosSection(section) || !locateIcon("cobros", section)) notFound();
  return (
    <SectionPage>
      <CobrosView section={section} />
    </SectionPage>
  );
}
