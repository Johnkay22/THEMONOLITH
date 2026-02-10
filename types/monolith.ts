export type MonolithOccupant = {
  id: string;
  content: string;
  valuation: number;
  ownerId: string | null;
  createdAt: string;
  active: boolean;
};

export type SyndicateStatus = "active" | "won" | "archived";

export type Syndicate = {
  id: string;
  proposedContent: string;
  totalRaised: number;
  status: SyndicateStatus;
  createdAt: string;
};

export type SyndicateLedgerRow = Syndicate & {
  target: number;
  progressRatio: number;
};
