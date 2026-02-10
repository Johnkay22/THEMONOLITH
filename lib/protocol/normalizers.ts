import { INITIAL_MONOLITH_CONTENT } from "@/lib/protocol/constants";
import type {
  MonolithOccupant,
  Syndicate,
  SyndicateLedgerRow,
  SyndicateStatus,
} from "@/types/monolith";

export const FALLBACK_MONOLITH: MonolithOccupant = {
  id: "seed-monolith",
  content: INITIAL_MONOLITH_CONTENT,
  valuation: 1,
  ownerId: null,
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
    ownerId: typeof row.owner_id === "string" ? row.owner_id : null,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
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

  if (
    typeof row.id !== "string" ||
    typeof row.proposed_content !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    proposedContent: row.proposed_content,
    totalRaised: toNumber(row.total_raised),
    status: resolveSyndicateStatus(row.status),
    createdAt: row.created_at,
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
