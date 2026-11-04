import type { Metadata } from "next";
import SectionPage from "@/components/section-page";
import OperativoView from "./operativo-view";

export const metadata: Metadata = { title: "Mercadeo | Puerta Abierta" };

export default function MercadeoPage() {
  return (
    <SectionPage>
      <OperativoView />
    </SectionPage>
  );
}
