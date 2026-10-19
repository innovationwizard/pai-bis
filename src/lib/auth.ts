import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { isPrefetchRequest, readStoredSession } from "@/lib/auth-cookie";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const superuserEmails = (process.env.SUPERUSER_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export async function createUserClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch (error) {
          // Server Components cannot write cookies. Middleware already published
          // the rotated session on this request, so getUser() must not rotate
          // again here. A route handler can write; hiding that failure discards
          // the new refresh token and the next request is 401.
          const message = error instanceof Error ? error.message : "";
          if (message.includes("Cookies can only be modified")) return;
          throw error;
        }
      },
    },
  });
}

export async function requireAuth() {
  const supabase = await createUserClient();
  if (!supabase) {
    return {
      response: NextResponse.json(
        { error: "Faltan variables de entorno de Supabase" },
        { status: 500 }
      )
    };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  return { user: data.user };
}

/**
 * User for a Server Component. On a real request middleware has already
 * refreshed the session and forwarded the new cookies, so getUser() only
 * validates. A prefetch reads the cookie and does not rotate.
 */
export async function getPageUser(): Promise<User | null> {
  const headerList = await headers();
  // Set by middleware only. next-router-prefetch is hidden from headers().
  if (headerList.get("x-auth-prefetch") === "1" || isPrefetchRequest(headerList)) {
    if (!supabaseUrl) return null;
    const jar = await cookies();
    const session = await readStoredSession(jar.getAll(), supabaseUrl);
    return session?.user ?? null;
  }
  const supabase = await createUserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export type Role =
  | "master"
  | "creditos"
  | "gerencia"
  | "financiero"
  | "contabilidad"
  | "marketing"
  | "ventas"
  | "inventario"
  | "entregas_viewer"
  | "entregas_editor"
  | "torredecontrol";

// Note: creditos, entregas_viewer and entregas_editor are single-purpose roles,
// so their levels carry no hierarchical meaning —
// they are listed only to satisfy the Record<Role, number> contract. Never
// grant access by comparing against them.
const ROLE_LEVEL: Record<Role, number> = {
  creditos: 15,
  ventas: 10,
  entregas_viewer: 15,
  entregas_editor: 16,
  inventario: 20,
  marketing: 25,
  contabilidad: 30,
  financiero: 40,
  gerencia: 50,
  torredecontrol: 60,
  master: 70,
};

/** Admin roles that can manage reservations and operational data. */
export const ADMIN_ROLES: Role[] = ["master", "torredecontrol"];

/** Roles that can view all analytics/financial data (admin + finance + marketing). */
export const DATA_VIEWER_ROLES: Role[] = ["master", "torredecontrol", "gerencia", "financiero", "contabilidad", "marketing"];

/** Check if user's role is at or above the required minimum level.
 * Currently unused — retained for future UI conditional rendering. */
export function hasMinimumRole(user: User | null, minimumRole: Role): boolean {
  const role = getUserRole(user);
  if (!role) return false;
  return (ROLE_LEVEL[role as Role] ?? 0) >= ROLE_LEVEL[minimumRole];
}

export function getUserRole(user: User | null) {
  return (user?.app_metadata?.role as string | undefined) ?? null;
}

export function isSuperuser(email?: string | null) {
  if (!email) {
    return false;
  }
  return superuserEmails.includes(email.toLowerCase());
}

export function hasRole(user: User | null, roles: Role[]) {
  const role = getUserRole(user);
  if (!role) {
    return false;
  }
  return roles.includes(role as Role);
}

export async function requireSuperuser() {
  const auth = await requireAuth();
  if (auth.response) {
    return auth;
  }
  const allowed =
    isSuperuser(auth.user?.email ?? null) ||
    hasRole(auth.user ?? null, ["master"]);
  if (!allowed) {
    return { response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return auth;
}

export async function requireRole(roles: Role[]) {
  const auth = await requireAuth();
  if (auth.response) {
    return auth;
  }
  const allowed =
    isSuperuser(auth.user?.email ?? null) ||
    hasRole(auth.user ?? null, roles);
  if (!allowed) {
    return { response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return auth;
}
