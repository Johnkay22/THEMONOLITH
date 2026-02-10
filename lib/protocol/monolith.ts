import "server-only";

import {
  MAX_INSCRIPTION_CHARACTERS,
  MINIMUM_CONTRIBUTION_USD,
} from "@/lib/protocol/constants";
import {
  FALLBACK_MONOLITH,
  normalizeMonolithRecord,
  normalizeSyndicateRecord,
} from "@/lib/protocol/normalizers";
import {
  getServerSupabaseClient,
  getServiceRoleSupabaseClient,
} from "@/lib/supabase/server";
import type { MonolithSnapshot, Syndicate } from "@/types/monolith";

type InitializeSyndicateInput = {
  proposedContent: string;
  initialContribution: number;
  stripeSessionId?: string;
};

type InitializeSyndicateResult = {
  syndicate: Syndicate;
  coupExecuted: boolean;
};

export class MonolithValidationError extends Error {}

function normalizeProposedContent(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeContribution(value: number) {
  return Number(value.toFixed(2));
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

  return normalizeMonolithRecord(data as Record<string, unknown> | null);
}

export async function getActiveSyndicates(): Promise<Syndicate[]> {
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

  return data
    .map((row) => normalizeSyndicateRecord(row as Record<string, unknown>))
    .filter((row): row is Syndicate => row !== null && row.status === "active");
}

export async function getLandingSnapshot() {
  const monolith = await getCurrentMonolith();
  const syndicates = await getActiveSyndicates();

  return {
    monolith,
    syndicates,
  } satisfies MonolithSnapshot;
}

async function resolveCoupIfEligible(syndicate: Syndicate) {
  const supabase = getServiceRoleSupabaseClient();
  if (!supabase) {
    return false;
  }

  const { data: currentMonolithRow, error: currentMonolithError } = await supabase
    .from("monolith_history")
    .select("id, content, valuation, owner_id, created_at, active")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (currentMonolithError || !currentMonolithRow) {
    throw new Error("Failed to read current monolith valuation.");
  }

  const currentMonolith = normalizeMonolithRecord(
    currentMonolithRow as Record<string, unknown>,
  );
  if (syndicate.totalRaised <= currentMonolith.valuation) {
    return false;
  }

  const { data: archivedRows, error: deactivateError } = await supabase
    .from("monolith_history")
    .update({ active: false })
    .eq("id", currentMonolith.id)
    .eq("active", true)
    .select("id");

  if (deactivateError || !archivedRows || archivedRows.length === 0) {
    throw new Error("Failed to archive current monolith occupant.");
  }

  const { error: activateError } = await supabase.from("monolith_history").insert({
    content: syndicate.proposedContent,
    valuation: normalizeContribution(syndicate.totalRaised),
    active: true,
  });

  if (activateError) {
    await supabase
      .from("monolith_history")
      .update({ active: true })
      .eq("id", currentMonolith.id);
    throw new Error("Failed to activate syndicate as the monolith.");
  }

  const { error: markWinnerError } = await supabase
    .from("syndicates")
    .update({ status: "won" })
    .eq("id", syndicate.id);

  if (markWinnerError) {
    throw new Error("Failed to mark syndicate as won.");
  }

  return true;
}

export async function initializeSyndicate(
  input: InitializeSyndicateInput,
): Promise<InitializeSyndicateResult> {
  const supabase = getServiceRoleSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Supabase service role key is missing. Set SUPABASE_SERVICE_ROLE_KEY to enable syndicate creation.",
    );
  }

  const proposedContent = normalizeProposedContent(input.proposedContent);
  const initialContribution = normalizeContribution(input.initialContribution);
  if (!proposedContent) {
    throw new MonolithValidationError("Proposed inscription is required.");
  }

  if (proposedContent.length > MAX_INSCRIPTION_CHARACTERS) {
    throw new MonolithValidationError(
      `Proposed inscription must be ${MAX_INSCRIPTION_CHARACTERS} characters or fewer.`,
    );
  }

  if (
    Number.isNaN(initialContribution) ||
    !Number.isFinite(initialContribution) ||
    initialContribution < MINIMUM_CONTRIBUTION_USD
  ) {
    throw new MonolithValidationError(
      `Initial contribution must be at least $${MINIMUM_CONTRIBUTION_USD.toFixed(2)}.`,
    );
  }

  const { data: syndicateRow, error: createSyndicateError } = await supabase
    .from("syndicates")
    .insert({
      proposed_content: proposedContent,
      total_raised: initialContribution,
      status: "active",
    })
    .select("id, proposed_content, total_raised, status, created_at")
    .single();

  if (createSyndicateError || !syndicateRow) {
    throw new Error("Failed to initialize syndicate.");
  }

  const stripeSessionId =
    input.stripeSessionId?.trim() || `prototype_${crypto.randomUUID()}`;
  const { error: contributionError } = await supabase.from("contributions").insert({
    syndicate_id: syndicateRow.id,
    amount: initialContribution,
    stripe_session_id: stripeSessionId,
  });

  if (contributionError) {
    await supabase.from("syndicates").update({ status: "archived" }).eq("id", syndicateRow.id);
    throw new Error("Failed to record initial contribution.");
  }

  const syndicate = normalizeSyndicateRecord(
    syndicateRow as Record<string, unknown>,
  );
  if (!syndicate) {
    throw new Error("Initialized syndicate payload was malformed.");
  }

  const coupExecuted = await resolveCoupIfEligible(syndicate);

  return {
    syndicate,
    coupExecuted,
  };
}
