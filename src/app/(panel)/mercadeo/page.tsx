import type { Metadata } from "next";
import SectionPage from "@/components/section-page";
import { loadPerformanceAdsSums, type PerformanceAdsSums } from "@/lib/mercadeo/performance-ads";
import MercadeoReport from "./report";

export const metadata: Metadata = { title: "Mercadeo | Puerta Abierta" };

export default function MercadeoPage() {
  let sums: PerformanceAdsSums | null = null;
  let readError = false;
  try {
    sums = loadPerformanceAdsSums();
  } catch (error) {
    console.error(error);
    readError = true;
  }
  return (
    <SectionPage>
      <MercadeoReport sums={sums} readError={readError} />
    </SectionPage>
  );
}
