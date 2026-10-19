import { combineChunks, stringFromBase64URL } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

const BASE64_PREFIX = "base64-";

export type StoredAuthSession = {
  access_token: string;
  user: User;
};

/** Same key createBrowserClient derives from the project URL. */
export function authStorageKey(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname.split(".")[0];
    return host ? `sb-${host}-auth-token` : null;
  } catch {
    return null;
  }
}

/**
 * A router prefetch must not call getUser(). That rotates the refresh token
 * into a response the browser may not store, and the next real request is 401.
 */
export function isPrefetchRequest(headerList: { get(name: string): string | null }): boolean {
  if (headerList.get("next-router-prefetch")) return true;
  if (headerList.get("next-router-segment-prefetch")) return true;
  return headerList.get("purpose") === "prefetch";
}

/** Read the session cookie without contacting Auth and without rotating it. */
export async function readStoredSession(
  cookieList: { name: string; value: string }[],
  supabaseUrl: string,
): Promise<StoredAuthSession | null> {
  const key = authStorageKey(supabaseUrl);
  if (!key) return null;
  const values = new Map(cookieList.map((cookie) => [cookie.name, cookie.value]));
  const combined = await combineChunks(key, (name) => values.get(name) ?? null);
  if (!combined) return null;
  let json = combined;
  if (combined.startsWith(BASE64_PREFIX)) {
    try {
      json = stringFromBase64URL(combined.slice(BASE64_PREFIX.length));
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(json) as { access_token?: unknown; user?: User };
    if (typeof parsed.access_token !== "string" || !parsed.user) return null;
    return { access_token: parsed.access_token, user: parsed.user };
  } catch {
    return null;
  }
}
