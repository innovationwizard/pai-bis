import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { accessTokenUsable, readStoredSession } from "@/lib/auth-cookie";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const CRAWLER_USER_AGENTS = [
  "WhatsApp",
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "TelegramBot",
  "Discordbot",
  "Googlebot",
  "bingbot"
];

function isCrawler(request: NextRequest): boolean {
  const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot.toLowerCase()));
}

function isPrefetch(request: NextRequest): boolean {
  if (request.headers.get("next-router-prefetch")) return true;
  if (request.headers.get("next-router-segment-prefetch")) return true;
  return request.headers.get("purpose") === "prefetch";
}

const PRIVATE = "private, no-store";

function seal(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", PRIVATE);
  return response;
}

/** A 304 cannot carry Set-Cookie. Drop the validators before any session work. */
function stripConditional(request: NextRequest) {
  request.headers.delete("if-none-match");
  request.headers.delete("if-modified-since");
}

export async function proxy(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  // Let crawlers (e.g. WhatsApp link preview) receive the page with OG meta
  if (isCrawler(request)) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const isApi = pathname === "/api" || pathname.startsWith("/api/");
  const isPublicApi = pathname.startsWith("/api/public/");

  // A prefetch must not rotate the refresh token. The browser may drop
  // Set-Cookie on that response, and the next real request is then 401.
  // The marker is ours: Next hides next-router-prefetch from server components.
  if (!isApi && isPrefetch(request)) {
    const headers = new Headers(request.headers);
    headers.set("x-auth-prefetch", "1");
    headers.delete("if-none-match");
    headers.delete("if-modified-since");
    return seal(NextResponse.next({ request: { headers } }));
  }
  request.headers.delete("x-auth-prefetch");
  stripConditional(request);

  // Recreate the response inside setAll so the forwarded request carries the
  // rotated session. Server Components and route handlers then see a current
  // access token and do not refresh it a second time.
  let supabaseResponse = NextResponse.next({ request });
  if (!isPublicApi) seal(supabaseResponse);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // The new refresh token has already been issued. This response must be
        // a 200 the browser is allowed to store, or the next call reuses the
        // old token and Supabase revokes the login.
        stripConditional(request);
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
        seal(supabaseResponse);
      },
    },
  });

  // getUser() with no argument refreshes during the last 90 seconds of the
  // access token. That rotation, lost on a later response, signs the user out.
  // While the token is still valid, only check it. Refresh once it has expired,
  // and keep the new cookie on this response.
  const stored = await readStoredSession(request.cookies.getAll(), supabaseUrl);
  const { data } = stored && accessTokenUsable(stored.access_token)
    ? await supabase.auth.getUser(stored.access_token)
    : await supabase.auth.getUser();

  /** Create a redirect that preserves any cookies set during getUser() (token refresh). */
  function redirectTo(pathname: string): NextResponse {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const redir = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redir.cookies.set(cookie);
    }
    return seal(redir);
  }

  // API routes authenticate themselves and answer 401 JSON. Refresh the
  // session here, then let the handler run. Do not send them to /login.
  if (isApi) {
    return supabaseResponse;
  }

  const isLoginRoute = pathname.startsWith("/login");
  const isAuthCallback = pathname === "/auth/callback";
  const isAuthConfirm = pathname === "/auth/confirm";
  const isSetPassword = pathname === "/auth/set-password";

  // Public reservation system pages (no auth required — availability board + calculator)
  // Note: /reservar was removed — now requires auth (salesperson must be logged in)
  const isPublicReservasPage =
    pathname.startsWith("/disponibilidad") ||
    pathname.startsWith("/cotizador");

  // Allow /auth/callback so invite/magic-link can land and client can set session from hash
  if (!data.user && !isLoginRoute && !isAuthCallback && !isAuthConfirm && !isSetPassword && !isPublicReservasPage) {
    return redirectTo("/login");
  }

  // Role-based routing for authenticated users
  if (data.user) {
    const role = (data.user.app_metadata?.role as string | undefined) ?? null;

    // These mirror ADMIN_ROLES and DATA_VIEWER_ROLES from src/lib/auth.ts.
    // Kept here so this file does not import src/lib/auth.ts. Keep in sync.
    // DATA_PAGE_ROLES excludes master/torredecontrol because those are
    // handled by ADMIN_PAGE_ROLES in the if/else chain above.
    const ADMIN_PAGE_ROLES = ["master", "torredecontrol"];
    const DATA_PAGE_ROLES = ["gerencia", "financiero", "contabilidad"];

    // Redirect logged-in users from /login to their home page
    if (isLoginRoute) {
      if (role === "creditos") return redirectTo("/creditos");
      if (role === "ventas") return redirectTo("/ventas");
      if (role === "entregas_viewer" || role === "entregas_editor") return redirectTo("/entregas");
      if (role && [...ADMIN_PAGE_ROLES, ...DATA_PAGE_ROLES, "marketing"].includes(role)) {
        return redirectTo("/");
      }
      // Unknown/unhandled role: stay on login page
      return supabaseResponse;
    }

    if (role === "ventas") {
      // Force password setup before any app access
      // app_metadata is authoritative; user_metadata fallback covers users who set password before this change
      const passwordSet =
        data.user.app_metadata?.password_set === true ||
        data.user.user_metadata?.password_set === true;
      if (!passwordSet && !isSetPassword && !isAuthCallback && !isAuthConfirm) {
        return redirectTo("/auth/set-password");
      }

      // Restrict to allowed pages
      const allowedPrefixes = [
        "/reservar",
        "/disponibilidad",
        "/cotizador",
        "/auth",
        "/login",
        "/ventas",
        "/mercadeo",
        "/cobros",
        "/creditos",
        "/entregas",
      ];
      if (!allowedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
        return redirectTo("/ventas");
      }
    } else if (role === "creditos") {
      const sectionPrefixes = ["/ventas", "/mercadeo", "/cobros", "/creditos", "/entregas"];
      const allowed =
        pathname.startsWith("/auth/") ||
        sectionPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
      if (!allowed) return redirectTo("/creditos");
    } else if (role === "entregas_viewer" || role === "entregas_editor") {
      // entregas_editor differs from entregas_viewer only in write permissions
      // (see PERMISSIONS.entregas), not in which pages it may open.
      const allowedPrefixes = [
        "/auth",
        "/login",
        "/ventas",
        "/mercadeo",
        "/cobros",
        "/creditos",
        "/entregas",
      ];
      if (!allowedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
        return redirectTo("/entregas");
      }
    } else if (ADMIN_PAGE_ROLES.includes(role ?? "")) {
      // Full admin access — no page restrictions
    } else if (role === "marketing") {
      // Marketing: dashboard + lead sources management only
      const blockedPrefixes = [
        "/admin",
        "/referidos",
        "/valorizacion",
        "/cesion",
        "/buyer-persona",
        "/integracion",
      ];
      const marketingExceptions = ["/admin/lead-sources"];
      if (
        blockedPrefixes.some((p) => pathname.startsWith(p)) &&
        !marketingExceptions.some((p) => pathname.startsWith(p))
      ) {
        return redirectTo("/");
      }
    } else if (DATA_PAGE_ROLES.includes(role ?? "")) {
      // Data viewer roles: block admin-only pages, allow analytics + public
      const adminOnlyPrefixes = [
        "/admin",
        "/referidos",
        "/valorizacion",
        "/cesion",
        "/buyer-persona",
        "/integracion",
      ];
      if (adminOnlyPrefixes.some((p) => pathname.startsWith(p))) {
        return redirectTo("/");
      }
    } else {
      // Unknown/unhandled role (inventario, null, or unrecognized):
      // only allow public pages + auth routes
      if (!isPublicReservasPage && !isAuthCallback && !isAuthConfirm && !isSetPassword) {
        return redirectTo("/login");
      }
    }
  }

  return isPublicApi ? supabaseResponse : seal(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|favicon.png|og-image.png|og-image.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)"
  ]
};
