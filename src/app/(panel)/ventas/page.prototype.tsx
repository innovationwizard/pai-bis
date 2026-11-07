import type { Metadata } from "next";
import SectionPage from "@/components/section-page";
import CentroDeMando from "./_centro-de-mando/centro";

export const metadata: Metadata = { title: "Ventas | Puerta Abierta" };

/** Prototype Centro de mando. The previous page is page.legacy.tsx. */
export default function VentasPage() {
  return (
    <SectionPage>
      <CentroDeMando />
    </SectionPage>
  );
}
