import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SectionPage from "@/components/section-page";
import { locateIcon } from "@/app/pabi/department-icons";
import { isCreditoSection } from "@/lib/creditos/pipedrive-vista";
import CreditosBoard from "../board";

type Props = { params: Promise<{ section: string }> };

export function generateStaticParams(): { section: string }[] {
  return [
    "expediente-inicial",
    "scanners",
    "pcvs",
    "armado",
    "contado",
    "envio-analisis",
    "suspendidos",
    "reanalisis",
    "aprobacion",
    "expediente-tecnico",
    "aprobacion-final",
    "expedientes-por-fase",
  ].map((section) => ({ section }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const located = locateIcon("creditos", section);
  if (!located) return { title: "Puerta Abierta" };
  return { title: `${located.item.title} | Puerta Abierta` };
}

export default async function CreditosSectionPage({ params }: Props) {
  const { section } = await params;
  const located = locateIcon("creditos", section);
  if (!located || !isCreditoSection(section)) notFound();
  return (
    <SectionPage>
      <CreditosBoard section={section} title={`${located.index + 1}. ${located.item.title}`} />
    </SectionPage>
  );
}
