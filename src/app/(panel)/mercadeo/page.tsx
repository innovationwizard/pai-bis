import type { Metadata } from "next";
import SectionPage from "@/components/section-page";
import MercadeoReport from "./report";

export const metadata: Metadata = { title: "Mercadeo | Puerta Abierta" };

export default function MercadeoPage() {
  return (
    <SectionPage>
      <MercadeoReport />
    </SectionPage>
  );
}
