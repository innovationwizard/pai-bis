import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SectionPage from "@/components/section-page";
import MercadeoBoard from "../board";
import { MERCADEO_SECTIONS } from "../sections";

type MercadeoSectionPageProps = {
  params: Promise<{ section: string }>;
};

export function generateStaticParams(): { section: string }[] {
  return MERCADEO_SECTIONS.map((section) => ({ section: section.slug }));
}

export async function generateMetadata({ params }: MercadeoSectionPageProps): Promise<Metadata> {
  const { section } = await params;
  const match = MERCADEO_SECTIONS.find((item) => item.slug === section);
  if (!match) return { title: "Mercadeo | Puerta Abierta" };
  return { title: `${match.title} | Puerta Abierta` };
}

export default async function MercadeoSectionPage({ params }: MercadeoSectionPageProps) {
  const { section } = await params;
  const match = MERCADEO_SECTIONS.find((item) => item.slug === section);
  if (!match) notFound();
  const index = MERCADEO_SECTIONS.findIndex((item) => item.slug === section);
  return (
    <SectionPage title={`${index + 1}. ${match.title}`}>
      <MercadeoBoard section={match.slug} />
    </SectionPage>
  );
}
