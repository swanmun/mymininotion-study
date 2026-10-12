import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

// localStorage key holding the Supabase session (access + refresh token).
export const AUTH_STORAGE_KEY = "mini-notion:auth";

// Browser-only client. The session is kept in localStorage, so login survives a
// closed browser (F-02) and is shared across tabs. PKCE: Google redirects back
// with ?code=, which the client exchanges on load. Returns null when env vars
// are missing (e.g. tests).
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined" || !url || !key) return null;
  client ??= createClient(url, key, {
    auth: {
      flowType: "pkce",
      storage: window.localStorage,
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
