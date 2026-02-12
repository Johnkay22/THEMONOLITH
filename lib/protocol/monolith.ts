import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMonolithEmail } from "@/lib/notifications/email";
import {
  MAX_ALIAS_CHARACTERS,
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
import type {
  MonolithOccupant,
  MonolithSnapshot,
  Syndicate,
  SyndicateContributor,
} from "@/types/monolith";

type InitializeSyndicateInput = {
  proposedContent: string;
  initialContribution: number;
  authorName?: string;
  notifyEmail?: string;
  notifyOnFunded?: boolean;
  notifyOnEveryContribution?: boolean;
  stripeSessionId?: string;
};

type InitializeSyndicateResult = {
  syndicate: Syndicate;
  coupExecuted: boolean;
};

type ContributeToSyndicateInput = {
  syndicateId: string;
  amount: number;
  authorName?: string;
  notifyEmail?: string;
  notifyOnFunded?: boolean;
  stripeSessionId?: string;
};

type ContributeToSyndicateResult = {
  syndicate: Syndicate;
  coupExecuted: boolean;
};

type AcquireSoloInput = {
  content: string;
  bidAmount: number;
  authorName?: string;
  notifyEmail?: string;
};

type AcquireSoloResult = {
  monolith: MonolithOccupant;
};

type ContributionInsertInput = {
  syndicateId: string;
  amount: number;
  contributorName: string | null;
  contributorEmail: string | null;
  notifyOnFunded: boolean;
  initialStripeSessionId: string;
};

type ContributionInsertResult = {
  recorded: boolean;
  stripeSessionId: string;
};

type ContributorContact = {
  id: string;
  displayName: string;
  email: string | null;
  notifyOnFunded: boolean;
};

type NotificationKind =
  | "solo_displaced"
  | "syndicate_funded"
  | "syndicate_contribution";

type SendNotificationInput = {
  supabase: ServiceRoleSupabaseClient;
  eventKey: string;
  kind: NotificationKind;
  recipientEmail: string | null;
  subject: string;
  text: string;
};

type ServiceRoleSupabaseClient = NonNullable<
  ReturnType<typeof getServiceRoleSupabaseClient>
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function normalizeOptionalAlias(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_ALIAS_CHARACTERS) {
    throw new MonolithValidationError(
      `${label} must be ${MAX_ALIAS_CHARACTERS} characters or fewer.`,
    );
  }

  return normalized;
}

function normalizeOptionalEmail(value: string | undefined, label: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.length > 320 || !EMAIL_PATTERN.test(normalized)) {
    throw new MonolithValidationError(`${label} must be a valid email address.`);
  }

  return normalized;
}

function contributionDisplayName(value: string | null) {
  return value?.trim() || "Anonymous";
}

function computeFundedInDays(startedAt: string) {
  const startTimestamp = Date.parse(startedAt);
  if (Number.isNaN(startTimestamp)) {
    return 1;
  }

  const elapsedMs = Math.max(0, Date.now() - startTimestamp);
  return Math.max(1, Math.ceil(elapsedMs / 86_400_000));
}

function contributorDedupKey(contact: ContributorContact) {
  if (contact.email) {
    return `email:${contact.email.toLowerCase()}`;
  }

  const normalizedName = contact.displayName.trim().toLowerCase();
  if (normalizedName && normalizedName !== "anonymous") {
    return `name:${normalizedName}`;
  }

  return `anonymous:${contact.id}`;
}

function dedupeContributorContacts(contacts: ContributorContact[]) {
  const deduped: ContributorContact[] = [];
  const seen = new Set<string>();

  for (const contact of contacts) {
    const key = contributorDedupKey(contact);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(contact);
  }

  return deduped;
}

async function recordNotificationEvent(
  supabase: ServiceRoleSupabaseClient,
  eventKey: string,
  recipientEmail: string,
  kind: NotificationKind,
) {
  const { error } = await supabase.from("notification_events").insert({
    event_key: eventKey,
    recipient_email: recipientEmail,
    kind,
  });

  if (!error) {
    return true;
  }

  const code =
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : null;
  if (code === "23505") {
    return false;
  }

  if (isLegacySchemaError(error)) {
    // notification_events table may not exist yet; proceed without dedupe.
    return true;
  }

  console.error("[notifications] failed to record notification event", {
    eventKey,
    recipientEmail,
    kind,
    error,
  });
  return true;
}

async function sendNotificationEmail(input: SendNotificationInput) {
  if (!input.recipientEmail) {
    return;
  }

  const shouldSend = await recordNotificationEvent(
    input.supabase,
    input.eventKey,
    input.recipientEmail,
    input.kind,
  );
  if (!shouldSend) {
    return;
  }

  try {
    await sendMonolithEmail({
      to: input.recipientEmail,
      subject: input.subject,
      text: input.text,
    });
  } catch (error) {
    console.error("[notifications] failed to send email", {
      eventKey: input.eventKey,
      recipientEmail: input.recipientEmail,
      kind: input.kind,
      error,
    });
  }
}

async function listSyndicateContributionContacts(
  supabase: SupabaseClient,
  syndicateId: string,
) {
  const { data, error } = await supabase
    .from("contributions")
    .select("id, contributor_name, contributor_email, notify_on_funded, created_at")
    .eq("syndicate_id", syndicateId)
    .order("created_at", { ascending: true });

  if (!error && data) {
    return data.map((row) => ({
      id: String(row.id),
      displayName: contributionDisplayName(
        typeof row.contributor_name === "string" ? row.contributor_name : null,
      ),
      email:
        typeof row.contributor_email === "string"
          ? row.contributor_email.toLowerCase()
          : null,
      notifyOnFunded: row.notify_on_funded === true,
    })) satisfies ContributorContact[];
  }

  if (isLegacySchemaError(error)) {
    const fallbackQuery = await supabase
      .from("contributions")
      .select("id")
      .eq("syndicate_id", syndicateId);

    if (fallbackQuery.error || !fallbackQuery.data) {
      return [];
    }

    return fallbackQuery.data.map((row) => ({
      id: String(row.id),
      displayName: "Anonymous",
      email: null,
      notifyOnFunded: false,
    })) satisfies ContributorContact[];
  }

  console.error("[syndicates] failed to list contributor contacts", {
    syndicateId,
    error,
  });
  return [];
}

async function maybeNotifyDisplacedSolo(
  supabase: ServiceRoleSupabaseClient,
  displacedMonolith: MonolithOccupant,
  replacementMonolith: MonolithOccupant,
) {
  if (
    displacedMonolith.sourceType !== "solo" ||
    !displacedMonolith.authorEmail
  ) {
    return;
  }

  await sendNotificationEmail({
    supabase,
    eventKey: `solo-displaced:${displacedMonolith.id}:${displacedMonolith.authorEmail}`,
    kind: "solo_displaced",
    recipientEmail: displacedMonolith.authorEmail,
    subject: "You were displaced on The Monolith",
    text:
      `Your inscription was displaced.\n\n` +
      `Previous inscription: "${displacedMonolith.content}"\n` +
      `New inscription: "${replacementMonolith.content}"\n` +
      `Current valuation: $${replacementMonolith.valuation.toFixed(2)}\n\n` +
      `Return to The Monolith to reclaim the summit.`,
  });
}

async function maybeNotifySyndicateFunded(
  supabase: ServiceRoleSupabaseClient,
  syndicate: Syndicate,
  contacts: ContributorContact[],
  newMonolith: MonolithOccupant,
) {
  const recipients = new Set<string>();
  if (syndicate.notifyOnFunded && syndicate.creatorEmail) {
    recipients.add(syndicate.creatorEmail.toLowerCase());
  }

  for (const contact of contacts) {
    if (!contact.notifyOnFunded || !contact.email) {
      continue;
    }
    recipients.add(contact.email.toLowerCase());
  }

  for (const recipient of recipients) {
    await sendNotificationEmail({
      supabase,
      eventKey: `syndicate-funded:${syndicate.id}:${recipient}`,
      kind: "syndicate_funded",
      recipientEmail: recipient,
      subject: "Syndicate Funded on The Monolith",
      text:
        `A syndicate you backed has taken over The Monolith.\n\n` +
        `Live inscription: "${newMonolith.content}"\n` +
        `New valuation: $${newMonolith.valuation.toFixed(2)}\n\n` +
        `The monument is live now.`,
    });
  }
}

async function maybeNotifySyndicateContribution(
  supabase: ServiceRoleSupabaseClient,
  syndicate: Syndicate,
  contributionAmount: number,
  contributorDisplayName: string,
  stripeSessionId: string,
) {
  if (!syndicate.notifyOnEveryContribution || !syndicate.creatorEmail) {
    return;
  }

  await sendNotificationEmail({
    supabase,
    eventKey: `syndicate-contribution:${syndicate.id}:${stripeSessionId}:${syndicate.creatorEmail}`,
    kind: "syndicate_contribution",
    recipientEmail: syndicate.creatorEmail,
    subject: "New Syndicate Contribution",
    text:
      `Your syndicate received a new contribution.\n\n` +
      `Contributor: ${contributorDisplayName}\n` +
      `Amount: $${contributionAmount.toFixed(2)}\n` +
      `Syndicate inscription: "${syndicate.proposedContent}"`,
  });
}

async function insertContributionRecord(
  supabase: ServiceRoleSupabaseClient,
  input: ContributionInsertInput,
): Promise<ContributionInsertResult> {
  let stripeSessionId = input.initialStripeSessionId;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const fullInsert = await supabase.from("contributions").insert({
      syndicate_id: input.syndicateId,
      amount: input.amount,
      stripe_session_id: stripeSessionId,
      contributor_name: input.contributorName,
      contributor_email: input.contributorEmail,
      notify_on_funded: input.notifyOnFunded,
    });

    if (!fullInsert.error) {
      return {
        recorded: true,
        stripeSessionId,
      };
    }

    const errorCode =
      typeof (fullInsert.error as { code?: unknown }).code === "string"
        ? (fullInsert.error as { code: string }).code
        : null;

    if (errorCode === "23505") {
      stripeSessionId = `prototype_${crypto.randomUUID()}`;
      continue;
    }

    if (errorCode === "42703") {
      const legacyInsert = await supabase.from("contributions").insert({
        syndicate_id: input.syndicateId,
        amount: input.amount,
        stripe_session_id: stripeSessionId,
      });

      if (!legacyInsert.error) {
        return {
          recorded: true,
          stripeSessionId,
        };
      }

      const legacyCode =
        typeof (legacyInsert.error as { code?: unknown }).code === "string"
          ? (legacyInsert.error as { code: string }).code
          : null;
      if (legacyCode === "23505") {
        stripeSessionId = `prototype_${crypto.randomUUID()}`;
        continue;
      }

      if (isLegacySchemaError(legacyInsert.error)) {
        return {
          recorded: false,
          stripeSessionId,
        };
      }

      throw new Error(
        `Failed to record contribution: ${legacyInsert.error.message ?? "unknown database error"}`,
      );
    }

    if (isLegacySchemaError(fullInsert.error)) {
      return {
        recorded: false,
        stripeSessionId,
      };
    }

    throw new Error(
      `Failed to record contribution: ${fullInsert.error.message ?? "unknown database error"}`,
    );
  }

  throw new Error("Failed to record contribution after retry.");
}

export async function getCurrentMonolith() {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return FALLBACK_MONOLITH;
  }

  const { data, error } = await supabase
    .from("monolith_history")
    .select(
      "id, content, valuation, created_at, active, author_name, author_email, source_type, source_syndicate_id, funded_by_count, funded_in_days",
    )
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
    .select(
      "id, proposed_content, total_raised, status, created_at, creator_name, creator_email, notify_on_funded, notify_on_every_contribution, won_at",
    )
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
  const authorName = normalizeOptionalAlias(input.authorName, "Author name");
  const authorEmail = normalizeOptionalEmail(input.notifyEmail, "Notify email");

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
    .select(
      "id, content, valuation, created_at, active, author_name, author_email, source_type, source_syndicate_id, funded_by_count, funded_in_days",
    )
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
      source_type: "solo",
      source_syndicate_id: null,
      author_name: authorName,
      author_email: authorEmail,
      funded_by_count: null,
      funded_in_days: null,
    })
    .select(
      "id, content, valuation, created_at, active, author_name, author_email, source_type, source_syndicate_id, funded_by_count, funded_in_days",
    )
    .single();

  if (insertError || !insertedMonolith) {
    await supabase
      .from("monolith_history")
      .update({ active: true })
      .eq("id", activeMonolith.id);
    throw new Error("Failed to create new monolith occupant.");
  }

  const nextMonolith = normalizeMonolithRecord(
    insertedMonolith as Record<string, unknown>,
  );

  await maybeNotifyDisplacedSolo(supabase, activeMonolith, nextMonolith);

  return {
    monolith: nextMonolith,
  };
}

async function resolveCoupIfEligible(syndicate: Syndicate) {
  const supabase = getServiceRoleSupabaseClient();
  if (!supabase) {
    return false;
  }

  const { data: currentMonolithRow, error: currentMonolithError } = await supabase
    .from("monolith_history")
    .select(
      "id, content, valuation, created_at, active, author_name, author_email, source_type, source_syndicate_id, funded_by_count, funded_in_days",
    )
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

  const contributorContacts = dedupeContributorContacts(
    await listSyndicateContributionContacts(supabase, syndicate.id),
  );
  const fundedByCount = contributorContacts.length || null;
  const fundedInDays = computeFundedInDays(syndicate.createdAt);

  const { data: archivedRows, error: deactivateError } = await supabase
    .from("monolith_history")
    .update({ active: false })
    .eq("id", currentMonolith.id)
    .eq("active", true)
    .select("id");

  if (deactivateError || !archivedRows || archivedRows.length === 0) {
    throw new Error("Failed to archive current monolith occupant.");
  }

  const { data: activatedMonolithRow, error: activateError } = await supabase
    .from("monolith_history")
    .insert({
      content: syndicate.proposedContent,
      valuation: normalizeContribution(syndicate.totalRaised),
      active: true,
      source_type: "syndicate",
      source_syndicate_id: syndicate.id,
      author_name: syndicate.creatorName,
      author_email: syndicate.creatorEmail,
      funded_by_count: fundedByCount,
      funded_in_days: fundedInDays,
    })
    .select(
      "id, content, valuation, created_at, active, author_name, author_email, source_type, source_syndicate_id, funded_by_count, funded_in_days",
    )
    .single();

  if (activateError || !activatedMonolithRow) {
    await supabase
      .from("monolith_history")
      .update({ active: true })
      .eq("id", currentMonolith.id);
    throw new Error("Failed to activate syndicate as the monolith.");
  }

  const { error: markWinnerError } = await supabase
    .from("syndicates")
    .update({ status: "won", won_at: new Date().toISOString() })
    .eq("id", syndicate.id);

  if (markWinnerError) {
    throw new Error("Failed to mark syndicate as won.");
  }

  const activatedMonolith = normalizeMonolithRecord(
    activatedMonolithRow as Record<string, unknown>,
  );
  await maybeNotifySyndicateFunded(
    supabase,
    syndicate,
    contributorContacts,
    activatedMonolith,
  );

  return true;
}

export async function getSyndicateContributorNames(
  syndicateId: string,
): Promise<SyndicateContributor[]> {
  const supabase = getServiceRoleSupabaseClient() ?? getServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const contacts = dedupeContributorContacts(
    await listSyndicateContributionContacts(supabase, syndicateId),
  );

  return contacts.map((contact) => ({
    name: contact.displayName,
  }));
}

export async function contributeToSyndicate(
  input: ContributeToSyndicateInput,
): Promise<ContributeToSyndicateResult> {
  const supabase = getServiceRoleSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Supabase service role key is missing. Set SUPABASE_SERVICE_ROLE_KEY to enable syndicate contributions.",
    );
  }

  const amount = normalizeContribution(input.amount);
  const contributorName = normalizeOptionalAlias(input.authorName, "Author name");
  const contributorEmail = normalizeOptionalEmail(
    input.notifyEmail,
    "Notify email",
  );
  const notifyOnFunded = input.notifyOnFunded === true;

  if (
    Number.isNaN(amount) ||
    !Number.isFinite(amount) ||
    amount < MINIMUM_CONTRIBUTION_USD
  ) {
    throw new MonolithValidationError(
      `Contribution must be at least $${MINIMUM_CONTRIBUTION_USD.toFixed(2)}.`,
    );
  }

  const { data: currentSyndicateRow, error: readSyndicateError } = await supabase
    .from("syndicates")
    .select(
      "id, proposed_content, total_raised, status, created_at, creator_name, creator_email, notify_on_funded, notify_on_every_contribution, won_at",
    )
    .eq("id", input.syndicateId)
    .maybeSingle();

  if (readSyndicateError || !currentSyndicateRow) {
    throw new Error("Syndicate not found.");
  }

  const currentSyndicate = normalizeSyndicateRecord(
    currentSyndicateRow as Record<string, unknown>,
  );
  if (!currentSyndicate) {
    throw new Error("Syndicate payload is malformed.");
  }

  if (currentSyndicate.status !== "active") {
    throw new MonolithValidationError("This syndicate is no longer active.");
  }

  const nextRaisedTotal = normalizeContribution(currentSyndicate.totalRaised + amount);
  const { data: updatedSyndicateRow, error: updateSyndicateError } = await supabase
    .from("syndicates")
    .update({
      total_raised: nextRaisedTotal,
    })
    .eq("id", currentSyndicate.id)
    .eq("status", "active")
    .select(
      "id, proposed_content, total_raised, status, created_at, creator_name, creator_email, notify_on_funded, notify_on_every_contribution, won_at",
    )
    .single();

  if (updateSyndicateError || !updatedSyndicateRow) {
    throw new Error("Failed to update syndicate total.");
  }

  const stripeSessionId =
    input.stripeSessionId?.trim() || `prototype_${crypto.randomUUID()}`;
  let contributionWriteResult: ContributionInsertResult;
  try {
    contributionWriteResult = await insertContributionRecord(supabase, {
      syndicateId: currentSyndicate.id,
      amount,
      contributorName,
      contributorEmail,
      notifyOnFunded,
      initialStripeSessionId: stripeSessionId,
    });
  } catch (error) {
    await supabase
      .from("syndicates")
      .update({ total_raised: currentSyndicate.totalRaised })
      .eq("id", currentSyndicate.id);
    throw error;
  }

  const updatedSyndicate = normalizeSyndicateRecord(
    updatedSyndicateRow as Record<string, unknown>,
  );
  if (!updatedSyndicate) {
    throw new Error("Updated syndicate payload is malformed.");
  }

  await maybeNotifySyndicateContribution(
    supabase,
    updatedSyndicate,
    amount,
    contributionDisplayName(contributorName),
    contributionWriteResult.stripeSessionId,
  );

  const coupExecuted = await resolveCoupIfEligible(updatedSyndicate);

  return {
    syndicate: updatedSyndicate,
    coupExecuted,
  };
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
  const creatorName = normalizeOptionalAlias(input.authorName, "Author name");
  const creatorEmail = normalizeOptionalEmail(input.notifyEmail, "Notify email");
  const notifyOnFunded = input.notifyOnFunded === true;
  const notifyOnEveryContribution = input.notifyOnEveryContribution === true;

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
      creator_name: creatorName,
      creator_email: creatorEmail,
      notify_on_funded: notifyOnFunded,
      notify_on_every_contribution: notifyOnEveryContribution,
    })
    .select(
      "id, proposed_content, total_raised, status, created_at, creator_name, creator_email, notify_on_funded, notify_on_every_contribution, won_at",
    )
    .single();

  if (createSyndicateError || !syndicateRow) {
    throw new Error("Failed to initialize syndicate.");
  }

  const stripeSessionId =
    input.stripeSessionId?.trim() || `prototype_${crypto.randomUUID()}`;
  await insertContributionRecord(supabase, {
    syndicateId: String(syndicateRow.id),
    amount: initialContribution,
    contributorName: creatorName,
    contributorEmail: creatorEmail,
    notifyOnFunded,
    initialStripeSessionId: stripeSessionId,
  });

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
