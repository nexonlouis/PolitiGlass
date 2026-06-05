import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function resolveSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function resolveServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Reject anon/publishable keys — ingest must use the service_role secret from
 * Supabase Dashboard → Project Settings → API → service_role (secret).
 */
export function assertServiceRoleKey(key: string): void {
  const anonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (anonKey && key === anonKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be the service_role secret, not the anon/publishable key. " +
        "In Supabase Dashboard → Settings → API, copy the service_role key (sb_secret_… or legacy JWT).",
    );
  }

  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY looks like a publishable (anon) key (sb_publishable_…). " +
        "Use the service_role secret (sb_secret_…) from Supabase Dashboard → Settings → API.",
    );
  }

  if (key.startsWith("eyJ") && key.length < 180) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY looks too short for a service_role JWT. " +
        "Copy the full service_role secret from Supabase Dashboard → Settings → API.",
    );
  }
}

export function createAdminClient(): SupabaseClient {
  const url = resolveSupabaseUrl();
  const key = resolveServiceRoleKey();

  if (!url || !key) {
    throw new Error(
      "Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in scripts/ingest-congress/.env",
    );
  }

  assertServiceRoleKey(key);

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
