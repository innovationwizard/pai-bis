import type { Metadata } from "next";
import SectionPage from "@/components/section-page";
import CommandCenter from "./command-center";

export const metadata: Metadata = { title: "Ventas | Puerta Abierta" };

export default function VentasPage() {
  return (
    <SectionPage>
      <CommandCenter />
    </SectionPage>
  );
}
