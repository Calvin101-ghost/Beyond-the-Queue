import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The ONLY two values you need to configure (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL       e.g. https://abcdxyz.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  the "anon" / "publishable" key
 *
 * Never put the service_role / secret key here. It bypasses Row Level
 * Security and would be shipped to every browser. This file refuses it.
 */
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

function jwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

/** Returns a human-readable problem with the configuration, or null if fine. */
export function getConfigProblem(): string | null {
  if (!url || !key || url.includes("YOUR-PROJECT") || key.startsWith("YOUR-")) {
    return "Supabase URL and anon key are not set.";
  }
  if (!/^https?:\/\//.test(url)) {
    return "NEXT_PUBLIC_SUPABASE_URL must start with https://";
  }
  if (key.startsWith("sb_secret_") || jwtRole(key) === "service_role") {
    return "You pasted a service-role / secret key. Use the anon (publishable) key instead. The service-role key must never be used in the browser.";
  }
  return null;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  const problem = getConfigProblem();
  if (problem) throw new Error(problem);
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
