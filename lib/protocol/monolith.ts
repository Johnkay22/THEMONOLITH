import "server-only";

import { calculateDisplacementCost } from "@/lib/protocol/pricing";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import type { MonolithOccupant, SyndicateLedgerRow } from "@/types/monolith";

const FALLBACK_MONOLITH: MonolithOccupant = {
  id: "seed-monolith",
  content: "WHO WILL BE FIRST?",
  valuation: 1,
  ownerId: null,
  createdAt: new Date(0).toISOString(),
  active: true,
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCurrentMonolith(
  row: Record<string, unknown> | null,
): MonolithOccupant {
  if (!row) {
    return FALLBACK_MONOLITH;
  }

  return {
    id: typeof row.id === "string" ? row.id : FALLBACK_MONOLITH.id,
    content:
      typeof row.content === "string" ? row.content : FALLBACK_MONOLITH.content,
    valuation: toNumber(row.valuation),
    ownerId: typeof row.owner_id === "string" ? row.owner_id : null,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : FALLBACK_MONOLITH.createdAt,
    active: row.active === true,
  };
}

export async function getCurrentMonolith() {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return FALLBACK_MONOLITH;
  }

  const { data, error } = await supabase
    .from("monolith_history")
    .select("id, content, valuation, owner_id, created_at, active")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return FALLBACK_MONOLITH;
  }

  return normalizeCurrentMonolith(data as Record<string, unknown> | null);
}

export async function getActiveSyndicates(
  displacementCost: number,
): Promise<SyndicateLedgerRow[]> {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("syndicates")
    .select("id, proposed_content, total_raised, status, created_at")
    .eq("status", "active")
    .order("total_raised", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const totalRaised = toNumber(row.total_raised);
    return {
      id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
      proposedContent:
        typeof row.proposed_content === "string"
          ? row.proposed_content
          : "UNTITLED SYNDICATE",
      totalRaised,
      status: row.status === "active" ? "active" : "archived",
      createdAt:
        typeof row.created_at === "string"
          ? row.created_at
          : new Date().toISOString(),
      target: displacementCost,
      progressRatio:
        displacementCost > 0 ? Math.min(1, totalRaised / displacementCost) : 0,
    } satisfies SyndicateLedgerRow;
  });
}

export async function getLandingSnapshot() {
  const monolith = await getCurrentMonolith();
  const displacementCost = calculateDisplacementCost(monolith.valuation);
  const syndicates = await getActiveSyndicates(displacementCost);

  return {
    monolith,
    displacementCost,
    syndicates,
  };
}
