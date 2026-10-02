import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SectionPage from "@/components/section-page";
import { VENTAS_SECTIONS } from "../sections";

type VentasSectionPageProps = {
  params: Promise<{ section: string }>;
};

export function generateStaticParams(): { section: string }[] {
  return VENTAS_SECTIONS.map((section) => ({ section: section.slug }));
}

export async function generateMetadata({ params }: VentasSectionPageProps): Promise<Metadata> {
  const { section } = await params;
  const match = VENTAS_SECTIONS.find((item) => item.slug === section);
  if (!match) return { title: "Ventas | Puerta Abierta" };
  return { title: `${match.title} | Puerta Abierta` };
}

export default async function VentasSectionPage({ params }: VentasSectionPageProps) {
  const { section } = await params;
  const match = VENTAS_SECTIONS.find((item) => item.slug === section);
  if (!match) notFound();
  return <SectionPage title={match.title} />;
}
