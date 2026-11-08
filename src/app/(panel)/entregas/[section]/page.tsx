import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SectionPage from "@/components/section-page";
import { locateIcon } from "@/app/pabi/department-icons";
import { metadataFor, staticParamsFor } from "@/app/pabi/department-section";
import { EntregasSection } from "../board";

type Props = { params: Promise<{ section: string }> };

export function generateStaticParams(): { section: string }[] {
  return staticParamsFor("entregas");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  return metadataFor("entregas", section);
}

export default async function EntregasSectionPage({ params }: Props) {
  const { section } = await params;
  const located = locateIcon("entregas", section);
  if (!located) notFound();
  return (
    <SectionPage title={`${located.index + 1}. ${located.item.title}`}>
      <EntregasSection slug={located.item.slug} />
    </SectionPage>
  );
}
