import { redirect } from "next/navigation";
import { createUserClient, DATA_VIEWER_ROLES } from "@/lib/auth";
import SiteNav from "@/components/site-nav";

async function getUser() {
  const supabase = await createUserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) redirect("/login");

  const role = user.app_metadata?.role as string | undefined;
  if (role === "ventas") redirect("/old/ventas/dashboard");
  if (role === "entregas_viewer" || role === "entregas_editor") redirect("/old/entregas");
  if (!role || !(DATA_VIEWER_ROLES as string[]).includes(role)) redirect("/login");

  return <SiteNav />;
}
