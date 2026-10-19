import { redirect } from "next/navigation";
import { getPageUser, DATA_VIEWER_ROLES } from "@/lib/auth";
import SiteNav from "@/components/site-nav";

export default async function DashboardPage() {
  const user = await getPageUser();

  if (!user) redirect("/login");

  const role = user.app_metadata?.role as string | undefined;
  if (role === "ventas") redirect("/old/ventas/dashboard");
  if (role === "entregas_viewer" || role === "entregas_editor") redirect("/old/entregas");
  if (!role || !(DATA_VIEWER_ROLES as string[]).includes(role)) redirect("/login");

  return <SiteNav />;
}
