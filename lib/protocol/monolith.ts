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
import { calculateDisplacementCost } from "@/lib/protocol/pricing";
import {
  getServerSupabaseClient,
  getServiceRoleSupabaseClient,
} from "@/lib/supabase/server";
import type { MonolithOccupant, MonolithSnapshot, Syndicate } from "@/types/monolith";

type InitializeSyndicateInput = {
  proposedContent: string;
  initialContribution: number;
  stripeSessionId?: string;
};

type InitializeSyndicateResult = {
  syndicate: Syndicate;
  coupExecuted: boolean;
};

type AcquireSoloInput = {
  content: string;
  bidAmount: number;
};

type AcquireSoloResult = {
  monolith: MonolithOccupant;
};

export class MonolithValidationError extends Error {}

function isLegacySchemaError(error: unknown) {
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return false;
  }

  const errorRow = error as Record<string, unknown>;
  const code = typeof errorRow.code === "string" ? errorRow.code : null;
  return code === "42P01" || code === "42703";
}

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
    .select("id, content, valuation, created_at, active")
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

export async function acquireSolo(input: AcquireSoloInput): Promise<AcquireSoloResult> {
  const supabase = getServiceRoleSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Supabase service role key is missing. Set SUPABASE_SERVICE_ROLE_KEY to enable solo acquisition.",
    );
  }

  const content = normalizeProposedContent(input.content);
  const bidAmount = normalizeContribution(input.bidAmount);
  if (!content) {
    throw new MonolithValidationError("Inscription is required.");
  }

  if (content.length > MAX_INSCRIPTION_CHARACTERS) {
    throw new MonolithValidationError(
      `Inscription must be ${MAX_INSCRIPTION_CHARACTERS} characters or fewer.`,
    );
  }

  if (Number.isNaN(bidAmount) || !Number.isFinite(bidAmount)) {
    throw new MonolithValidationError("Bid amount is invalid.");
  }

  const { data: activeRow, error: activeError } = await supabase
    .from("monolith_history")
    .select("id, content, valuation, created_at, active")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError || !activeRow) {
    throw new Error("Failed to read current monolith.");
  }

  const activeMonolith = normalizeMonolithRecord(
    activeRow as Record<string, unknown>,
  );
  const displacementCost = calculateDisplacementCost(activeMonolith.valuation);
  if (bidAmount < displacementCost) {
    throw new MonolithValidationError(
      `Bid must be at least ${displacementCost.toFixed(2)}.`,
    );
  }

  const { data: archivedRows, error: archiveError } = await supabase
    .from("monolith_history")
    .update({ active: false })
    .eq("id", activeMonolith.id)
    .eq("active", true)
    .select("id");

  if (archiveError || !archivedRows || archivedRows.length === 0) {
    throw new Error("Failed to archive the current monolith.");
  }

  const { data: insertedMonolith, error: insertError } = await supabase
    .from("monolith_history")
    .insert({
      content,
      valuation: bidAmount,
      active: true,
    })
    .select("id, content, valuation, created_at, active")
    .single();

  if (insertError || !insertedMonolith) {
    await supabase
      .from("monolith_history")
      .update({ active: true })
      .eq("id", activeMonolith.id);
    throw new Error("Failed to create new monolith occupant.");
  }

  return {
    monolith: normalizeMonolithRecord(
      insertedMonolith as Record<string, unknown>,
    ),
  };
}

async function resolveCoupIfEligible(syndicate: Syndicate) {
  const supabase = getServiceRoleSupabaseClient();
  if (!supabase) {
    return false;
  }

  const { data: currentMonolithRow, error: currentMonolithError } = await supabase
    .from("monolith_history")
    .select("id, content, valuation, created_at, active")
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

async function insertInitialContribution(
  supabase: NonNullable<ReturnType<typeof getServiceRoleSupabaseClient>>,
  syndicateId: string,
  amount: number,
  initialStripeSessionId: string,
) {
  let stripeSessionId = initialStripeSessionId;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await supabase.from("contributions").insert({
      syndicate_id: syndicateId,
      amount,
      stripe_session_id: stripeSessionId,
    });

    if (!error) {
      return {
        recorded: true,
      } as const;
    }

    if (isLegacySchemaError(error)) {
      return {
        recorded: false,
      } as const;
    }

    const errorCode =
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;
    if (errorCode === "23505") {
      stripeSessionId = `prototype_${crypto.randomUUID()}`;
      continue;
    }

    const message =
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "unknown database error";
    throw new Error(`Failed to record initial contribution: ${message}`);
  }

  throw new Error("Failed to record initial contribution after retry.");
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
  await insertInitialContribution(
    supabase,
    syndicateRow.id,
    initialContribution,
    stripeSessionId,
  );

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
