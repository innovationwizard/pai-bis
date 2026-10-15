import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createUserClient } from "@/lib/auth";
import { can } from "@/lib/permissions";
import EntregasClient from "./entregas-client";

export const metadata: Metadata = {
  title: "Entregas | Boulevard 5",
  description:
    "Cronograma de escrituración y entrega de unidades de Boulevard 5 — agenda semanal, estado por hito y titular por apartamento",
};

async function getRole(): Promise<string | null> {
  const supabase = await createUserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return (data.user.app_metadata?.role as string | undefined) ?? null;
}

export default async function EntregasPage() {
  const role = await getRole();

  if (!role) redirect("/login");
  if (!can(role, "entregas", "view")) redirect("/login");

  return (
    <Suspense>
      <EntregasClient
        canEdit={can(role, "entregas", "update")}
        canPublish={can(role, "entregas", "publish")}
      />
    </Suspense>
  );
}
