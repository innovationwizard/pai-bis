import type { Metadata } from "next";
import DepartmentSectionPage, { metadataFor, staticParamsFor } from "@/app/pabi/department-section";

type Props = { params: Promise<{ section: string }> };

export function generateStaticParams(): { section: string }[] {
  return staticParamsFor("cobros");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  return metadataFor("cobros", section);
}

export default async function CobrosSectionPage({ params }: Props) {
  const { section } = await params;
  return <DepartmentSectionPage department="cobros" section={section} />;
}
