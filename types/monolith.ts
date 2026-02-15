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
  contributorCount: number;
  recentContributorCount: number;
  createdAt: string;
};

export type SyndicateLedgerRow = Syndicate & {
  target: number;
  progressRatio: number;
};

export type MonolithSnapshot = {
  monolith: MonolithOccupant;
  syndicates: Syndicate[];
  latestDisplacement: MonolithDisplacementEvent | null;
};

export type SyndicateContributor = {
  name: string;
};

export type MonolithDisplacementEvent = {
  previousContent: string;
  previousValuation: number;
  currentContent: string;
  currentValuation: number;
  displacedAt: string;
};
