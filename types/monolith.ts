export type MonolithSourceType = "solo" | "syndicate";

export type MonolithOccupant = {
  id: string;
  content: string;
  valuation: number;
  ownerId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  sourceType: MonolithSourceType;
  sourceSyndicateId: string | null;
  fundedByCount: number | null;
  fundedInDays: number | null;
  createdAt: string;
  active: boolean;
};

export type SyndicateStatus = "active" | "won" | "archived";

export type Syndicate = {
  id: string;
  proposedContent: string;
  totalRaised: number;
  status: SyndicateStatus;
  creatorName: string | null;
  creatorEmail: string | null;
  notifyOnFunded: boolean;
  notifyOnEveryContribution: boolean;
  wonAt: string | null;
  createdAt: string;
};

export type SyndicateLedgerRow = Syndicate & {
  target: number;
  progressRatio: number;
};

export type MonolithSnapshot = {
  monolith: MonolithOccupant;
  syndicates: Syndicate[];
};

export type SyndicateContributor = {
  name: string;
};
