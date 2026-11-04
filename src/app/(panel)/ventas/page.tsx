import type { Metadata } from "next";
import SectionPage from "@/components/section-page";
import GlanceView from "./glance-view";

export const metadata: Metadata = { title: "Ventas | Puerta Abierta" };

export default function VentasPage() {
  return (
    <SectionPage>
      <GlanceView section="ventas-totales" />
    </SectionPage>
  );
}
