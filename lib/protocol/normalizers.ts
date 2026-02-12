import { INITIAL_MONOLITH_CONTENT } from "@/lib/protocol/constants";
import type {
  MonolithOccupant,
  MonolithSourceType,
  Syndicate,
  SyndicateLedgerRow,
  SyndicateStatus,
} from "@/types/monolith";

export const FALLBACK_MONOLITH: MonolithOccupant = {
  id: "seed-monolith",
  content: INITIAL_MONOLITH_CONTENT,
  valuation: 1,
  ownerId: null,
  authorName: null,
  authorEmail: null,
  sourceType: "solo",
  sourceSyndicateId: null,
  fundedByCount: null,
  fundedInDays: null,
  createdAt: new Date(0).toISOString(),
  active: true,
};

export function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveSyndicateStatus(value: unknown): SyndicateStatus {
  if (value === "active" || value === "won" || value === "archived") {
    return value;
  }

  return "archived";
}

function resolveMonolithSourceType(value: unknown): MonolithSourceType {
  return value === "syndicate" ? "syndicate" : "solo";
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeMonolithRecord(
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
    ownerId:
      typeof (row.owner_id ?? row.ownerId) === "string"
        ? (row.owner_id ?? row.ownerId) as string
        : null,
    authorName: normalizeOptionalText(row.author_name ?? row.authorName),
    authorEmail: normalizeOptionalText(row.author_email ?? row.authorEmail),
    sourceType: resolveMonolithSourceType(row.source_type ?? row.sourceType),
    sourceSyndicateId:
      typeof (row.source_syndicate_id ?? row.sourceSyndicateId) === "string"
        ? (row.source_syndicate_id ?? row.sourceSyndicateId) as string
        : null,
    fundedByCount: toNumber(row.funded_by_count ?? row.fundedByCount) || null,
    fundedInDays: toNumber(row.funded_in_days ?? row.fundedInDays) || null,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : typeof row.createdAt === "string"
          ? row.createdAt
        : FALLBACK_MONOLITH.createdAt,
    active: row.active === true,
  };
}

export function normalizeSyndicateRecord(
  row: Record<string, unknown> | null,
): Syndicate | null {
  if (!row) {
    return null;
  }

  const proposedContent =
    typeof row.proposed_content === "string"
      ? row.proposed_content
      : typeof row.proposedContent === "string"
        ? row.proposedContent
        : null;
  const createdAt =
    typeof row.created_at === "string"
      ? row.created_at
      : typeof row.createdAt === "string"
        ? row.createdAt
        : null;

  if (typeof row.id !== "string" || !proposedContent || !createdAt) {
    return null;
  }

  return {
    id: row.id,
    proposedContent,
    totalRaised: toNumber(row.total_raised ?? row.totalRaised),
    status: resolveSyndicateStatus(row.status),
    creatorName: normalizeOptionalText(row.creator_name ?? row.creatorName),
    creatorEmail: normalizeOptionalText(row.creator_email ?? row.creatorEmail),
    notifyOnFunded: row.notify_on_funded === true || row.notifyOnFunded === true,
    notifyOnEveryContribution:
      row.notify_on_every_contribution === true ||
      row.notifyOnEveryContribution === true,
    wonAt:
      typeof (row.won_at ?? row.wonAt) === "string"
        ? (row.won_at ?? row.wonAt) as string
        : null,
    createdAt,
  };
}

function sortSyndicatesForLedger(left: Syndicate, right: Syndicate) {
  if (left.totalRaised !== right.totalRaised) {
    return right.totalRaised - left.totalRaised;
  }

  if (left.createdAt === right.createdAt) {
    return 0;
  }

  return left.createdAt > right.createdAt ? -1 : 1;
}

export function buildSyndicateLedgerRows(
  syndicates: Syndicate[],
  displacementCost: number,
): SyndicateLedgerRow[] {
  return [...syndicates].sort(sortSyndicatesForLedger).map((syndicate) => ({
    ...syndicate,
    target: displacementCost,
    progressRatio:
      displacementCost > 0
        ? Math.min(1, syndicate.totalRaised / displacementCost)
        : 0,
  }));
}
