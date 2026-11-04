import type { Metadata } from "next";
import SectionPage from "@/components/section-page";
import CobrosView from "./cobros-view";

export const metadata: Metadata = { title: "Cobros | Puerta Abierta" };

export default function CobrosPage() {
  return (
    <SectionPage>
      <CobrosView section="cobros-por-proyecto" />
    </SectionPage>
  );
}
