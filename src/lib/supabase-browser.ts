import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { readStoredSession } from "@/lib/auth-cookie";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey);

// createBrowserClient forces autoRefreshToken on in the browser. That timer
// rotates the refresh token on its own, in parallel with middleware, and the
// loser of the race deletes the session. Middleware is the only refresher.
if (typeof window !== "undefined") {
  const auth = supabaseBrowser.auth as typeof supabaseBrowser.auth & {
    autoRefreshToken: boolean;
  };
  auth.autoRefreshToken = false;
  void auth.stopAutoRefresh();
}

function browserCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie.split("; ").flatMap((part) => {
    const eq = part.indexOf("=");
    if (eq <= 0) return [];
    return [{ name: decodeCookie(part.slice(0, eq)), value: decodeCookie(part.slice(eq + 1)) }];
  });
}

function decodeCookie(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Role and email for the header. getUser(jwt) validates the access token and
 * does not rotate the refresh token. An expired access token falls back to
 * the user already stored in the cookie; the next request through middleware
 * refreshes the session.
 */
export async function loadDisplayedUser(): Promise<User | null> {
  if (!supabaseUrl) return null;
  const session = await readStoredSession(browserCookies(), supabaseUrl);
  if (!session) return null;
  const { data, error } = await supabaseBrowser.auth.getUser(session.access_token);
  if (!error && data.user) return data.user;
  return session.user;
}
