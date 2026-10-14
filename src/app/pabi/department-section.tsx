import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SectionPage from "@/components/section-page";
import TierDrill from "@/app/pabi/tier-drill";
import {
  locateIcon,
  departmentStaticParams,
  type DepartmentId,
} from "@/app/pabi/department-icons";

export function staticParamsFor(department: DepartmentId): { section: string }[] {
  return departmentStaticParams(department);
}

export function metadataFor(department: DepartmentId, section: string): Metadata {
  const located = locateIcon(department, section);
  if (!located) return { title: "Puerta Abierta" };
  return { title: `${located.item.title} | Puerta Abierta` };
}

export default function DepartmentSectionPage({
  department,
  section,
}: {
  department: DepartmentId;
  section: string;
}) {
  const located = locateIcon(department, section);
  if (!located) notFound();
  const { item, index } = located;
  return (
    <SectionPage title={`${index + 1}. ${item.title}`}>
      {item.drill ? (
        <TierDrill drill={item.drill} />
      ) : (
        <p className="ventas-caption">Este corte está en el recorrido. El gráfico se publica con el dato del departamento.</p>
      )}
    </SectionPage>
  );
}
