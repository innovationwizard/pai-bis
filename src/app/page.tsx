import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { DATA_VIEWER_ROLES } from "@/lib/auth";
import SiteNav from "@/components/site-nav";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function getUser() {
  const cookieStore = await cookies();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (_name: string, _value: string, _options: CookieOptions) => {},
      remove: (_name: string, _options: CookieOptions) => {},
    },
  });

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
