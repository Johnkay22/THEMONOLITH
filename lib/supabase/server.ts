import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let serviceRoleClient: SupabaseClient | null | undefined;

export function getServerSupabaseClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    return null;
  }

  // Prefer anon for read parity with browser policy behavior.
  // If anon is misconfigured, fall back to service role so server snapshots still work.
  const readKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!readKey) {
    return null;
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    readKey,
    {
      auth: {
        persistSession: false,
      },
    },
  );
}

export function getServiceRoleSupabaseClient() {
  if (serviceRoleClient !== undefined) {
    return serviceRoleClient;
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    serviceRoleClient = null;
    return serviceRoleClient;
  }

  serviceRoleClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
      },
    },
  );

  return serviceRoleClient;
}
