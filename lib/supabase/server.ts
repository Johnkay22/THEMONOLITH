import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, hasPublicSupabaseEnv } from "@/lib/env";

let serviceRoleClient: SupabaseClient | null | undefined;

export function getServerSupabaseClient() {
  if (!hasPublicSupabaseEnv) {
    return null;
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
