import type { Metadata } from "next";
import SectionPage from "@/components/section-page";

export const metadata: Metadata = { title: "Ventas | Puerta Abierta" };

export default function VentasPage() {
  return <SectionPage title="Ventas" />;
}
