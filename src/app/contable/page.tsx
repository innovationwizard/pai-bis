import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPageUser } from "@/lib/auth";
import ContableClient from "@/app/pabi/contable/contable-client";

export const metadata: Metadata = {
  title: "Contable | Puerta Abierta",
  description:
    "Reportes de contabilidad para directiva — Cobros, Comisiones, Presupuestos, Desistimientos, Cesión de Derechos, PCV & Expedientes, Contabilidad General y Legal",
};

export default async function ContablePage() {
  // Verificación de sesión propia de la página, sin depender sólo del
  // middleware: quien no tenga sesión no ve el tablero. A propósito NO filtra
  // por rol todavía — cualquier usuario con sesión entra. Cuando se decida qué
  // roles corresponden, el filtro va aquí (ver src/app/page.tsx como ejemplo).
  const user = await getPageUser();
  if (!user) redirect("/login");

  return (
    <Suspense>
      <ContableClient />
    </Suspense>
  );
}
