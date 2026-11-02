import type { Metadata } from "next";
import SectionPage from "@/components/section-page";
import CreditosBoard from "./board";

export const metadata: Metadata = { title: "Créditos | Puerta Abierta" };

export default function CreditosPage() {
  return (
    <SectionPage>
      <CreditosBoard section="resumen" title="Créditos" />
    </SectionPage>
  );
}
