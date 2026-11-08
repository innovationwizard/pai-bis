import type { Metadata } from "next";
import SectionPage from "@/components/section-page";
import { EntregasLanding } from "./board";

export const metadata: Metadata = { title: "Entregas | Puerta Abierta" };

export default function EntregasPage() {
  return (
    <SectionPage title="Entregas">
      <EntregasLanding />
    </SectionPage>
  );
}
