"use client";

import { useMemo, useState } from "react";
import { AcquireSoloModal } from "@/components/monolith/AcquireSoloModal";
import { ContributeSyndicateModal } from "@/components/monolith/ContributeSyndicateModal";
import { ControlDeck } from "@/components/monolith/ControlDeck";
import { InitializeSyndicateModal } from "@/components/monolith/InitializeSyndicateModal";
import { MonolithDisplay } from "@/components/monolith/MonolithDisplay";
import { ProtocolModal } from "@/components/monolith/ProtocolModal";
import { ProtocolTermsModal } from "@/components/monolith/ProtocolTermsModal";
import { SyndicateContributorsModal } from "@/components/monolith/SyndicateContributorsModal";
import { SyndicateFundedModal } from "@/components/monolith/SyndicateFundedModal";
import { SyndicateLedger } from "@/components/monolith/SyndicateLedger";
import { useMonolithRealtime } from "@/hooks/useMonolithRealtime";
import { buildSyndicateLedgerRows } from "@/lib/protocol/normalizers";
import { calculateDisplacementCost, formatUsd } from "@/lib/protocol/pricing";
import type {
  MonolithOccupant,
  MonolithSnapshot,
  Syndicate,
  SyndicateLedgerRow,
} from "@/types/monolith";

type MonolithExperienceProps = {
  initialMonolith: MonolithOccupant;
  initialSyndicates: Syndicate[];
};

type ToastState = {
  id: string;
  message: string;
  variant: "error" | "success";
};

export function MonolithExperience({
  initialMonolith,
  initialSyndicates,
}: MonolithExperienceProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAcquireSoloModalOpen, setIsAcquireSoloModalOpen] = useState(false);
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [isProtocolTermsModalOpen, setIsProtocolTermsModalOpen] = useState(false);
  const [selectedSyndicateId, setSelectedSyndicateId] = useState<string | null>(
    null,
  );
  const [isContributorModalOpen, setIsContributorModalOpen] = useState(false);
  const [contributors, setContributors] = useState<string[]>([]);
  const [isLoadingContributors, setIsLoadingContributors] = useState(false);
  const [isFundedCongratsOpen, setIsFundedCongratsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const { snapshot, refreshSnapshot, applySnapshot, applyMonolith, applySyndicate } =
    useMonolithRealtime(initialMonolith, initialSyndicates);

  const displacementCost = useMemo(
    () => calculateDisplacementCost(snapshot.monolith.valuation),
    [snapshot.monolith.valuation],
  );

  const ledgerRows = useMemo(
    () => buildSyndicateLedgerRows(snapshot.syndicates, displacementCost),
    [displacementCost, snapshot.syndicates],
  );
  const selectedSyndicate = useMemo(
    () =>
      selectedSyndicateId
        ? ledgerRows.find((row) => row.id === selectedSyndicateId) ?? null
        : null,
    [ledgerRows, selectedSyndicateId],
  );

  const queueSnapshotReconciliation = () => {
    window.setTimeout(() => {
      void refreshSnapshot();
    }, 900);
  };

  const cloneSnapshot = (value: MonolithSnapshot): MonolithSnapshot => ({
    monolith: { ...value.monolith },
    syndicates: value.syndicates.map((syndicate) => ({ ...syndicate })),
  });

  const showToast = (
    variant: "error" | "success",
    message: string,
    autoHideDelayMs = 3600,
  ) => {
    const nextToast = {
      id: crypto.randomUUID(),
      message,
      variant,
    };
    setToast(nextToast);
    window.setTimeout(() => {
      setToast((currentToast) =>
        currentToast?.id === nextToast.id ? null : currentToast,
      );
    }, autoHideDelayMs);
  };

  const showTransactionFailedToast = (details?: string) => {
    const message = details?.trim()
      ? `Transaction Failed: ${details}`
      : "Transaction Failed";
    showToast("error", message);
  };

  const applySnapshotIfFresh = (nextSnapshot: MonolithSnapshot | undefined) => {
    if (!nextSnapshot || nextSnapshot.monolith.id === "seed-monolith") {
      return;
    }

    const nextTimestamp = Date.parse(nextSnapshot.monolith.createdAt);
    const currentTimestamp = Date.parse(snapshot.monolith.createdAt);
    if (
      !Number.isNaN(nextTimestamp) &&
      !Number.isNaN(currentTimestamp) &&
      nextTimestamp < currentTimestamp
    ) {
      return;
    }

    applySnapshot(nextSnapshot);
  };

  const handleOpenContributors = async () => {
    const sourceSyndicateId = snapshot.monolith.sourceSyndicateId;
    if (!sourceSyndicateId) {
      return;
    }

    setIsContributorModalOpen(true);
    setIsLoadingContributors(true);
    try {
      const response = await fetch(
        `/api/syndicates/contributors?syndicateId=${encodeURIComponent(sourceSyndicateId)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      if (!response.ok) {
        setContributors([]);
        return;
      }

      const payload = (await response.json()) as {
        contributors?: Array<{ name?: string }>;
      };
      const names = Array.isArray(payload.contributors)
        ? payload.contributors.map((entry) =>
            typeof entry.name === "string" && entry.name.trim()
              ? entry.name.trim()
              : "Anonymous",
          )
        : [];
      setContributors(names);
    } catch {
      setContributors([]);
    } finally {
      setIsLoadingContributors(false);
    }
  };

  const handleInitializeSyndicate = async (draft: {
    proposedContent: string;
    initialContribution: number;
    authorName: string;
    notifyEmail: string;
    notifyOnFunded: boolean;
    notifyOnEveryContribution: boolean;
  }) => {
    const previousSnapshot = cloneSnapshot(snapshot);
    try {
      const response = await fetch("/api/syndicates/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      let payload:
        | {
            error?: string;
            syndicate?: Syndicate;
            snapshot?: MonolithSnapshot;
            coupExecuted?: boolean;
          }
        | null = null;
      try {
        payload = (await response.json()) as {
          error?: string;
          syndicate?: Syndicate;
          snapshot?: MonolithSnapshot;
        };
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Failed to initialize syndicate. Please try again.",
        );
      }

      if (payload?.syndicate) {
        applySyndicate(payload.syndicate);
      }
      applySnapshotIfFresh(payload?.snapshot);

      setIsModalOpen(false);
      if (payload?.coupExecuted) {
        setIsFundedCongratsOpen(true);
      }
      queueSnapshotReconciliation();
    } catch (error) {
      applySnapshot(previousSnapshot);
      const message =
        error instanceof Error ? error.message : "Failed to initialize syndicate.";
      showTransactionFailedToast(message);
      throw error;
    }
  };

  const handleAcquireSolo = async (draft: {
    content: string;
    bidAmount: number;
    authorName: string;
    notifyEmail: string;
  }) => {
    const previousSnapshot = cloneSnapshot(snapshot);
    const optimisticMonolith: MonolithOccupant = {
      id: `optimistic-${crypto.randomUUID()}`,
      content: draft.content,
      valuation: draft.bidAmount,
      ownerId: null,
      authorName: draft.authorName.trim() || null,
      authorEmail: draft.notifyEmail.trim().toLowerCase() || null,
      sourceType: "solo",
      sourceSyndicateId: null,
      fundedByCount: null,
      fundedInDays: null,
      createdAt: new Date().toISOString(),
      active: true,
    };
    applyMonolith(optimisticMonolith);

    try {
      const response = await fetch("/api/monolith/acquire-solo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: draft.content,
          bidAmount: draft.bidAmount,
          authorName: draft.authorName,
          notifyEmail: draft.notifyEmail,
        }),
      });

      let payload:
        | {
            error?: string;
            monolith?: MonolithOccupant;
            snapshot?: MonolithSnapshot;
          }
        | null = null;
      try {
        payload = (await response.json()) as {
          error?: string;
          monolith?: MonolithOccupant;
          snapshot?: MonolithSnapshot;
        };
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Failed to acquire the monolith. Please try again.",
        );
      }

      if (payload?.monolith) {
        applyMonolith(payload.monolith);
      }
      applySnapshotIfFresh(payload?.snapshot);

      setIsAcquireSoloModalOpen(false);
      queueSnapshotReconciliation();
    } catch (error) {
      applySnapshot(previousSnapshot);
      const message =
        error instanceof Error ? error.message : "Failed to acquire the monolith.";
      showTransactionFailedToast(message);
      throw error;
    }
  };

  const handleContributeSyndicate = async (draft: {
    syndicateId: string;
    amount: number;
    authorName: string;
    notifyEmail: string;
    notifyOnFunded: boolean;
  }) => {
    const previousSnapshot = cloneSnapshot(snapshot);
    try {
      const response = await fetch("/api/syndicates/contribute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      let payload:
        | {
            error?: string;
            syndicate?: Syndicate;
            snapshot?: MonolithSnapshot;
            coupExecuted?: boolean;
          }
        | null = null;
      try {
        payload = (await response.json()) as {
          error?: string;
          syndicate?: Syndicate;
          snapshot?: MonolithSnapshot;
        };
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Failed to contribute to syndicate. Please try again.",
        );
      }

      if (payload?.syndicate) {
        applySyndicate(payload.syndicate);
      }
      applySnapshotIfFresh(payload?.snapshot);

      setSelectedSyndicateId(null);
      if (payload?.coupExecuted === true) {
        setIsFundedCongratsOpen(true);
        showToast("success", "Syndicate Funded. Congratulations.", 4200);
      }
      queueSnapshotReconciliation();
    } catch (error) {
      applySnapshot(previousSnapshot);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to contribute to syndicate.";
      showTransactionFailedToast(message);
      throw error;
    }
  };

  return (
    <>
      <main className="mx-auto flex min-h-svh w-full max-w-[1400px] flex-col px-4 pb-[calc(1.4rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8">
        {toast ? (
          <div
            className={`mb-3 border px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.15em] ${
              toast.variant === "success"
                ? "border-white/60 bg-white text-black"
                : "border-white bg-black/90 text-white/90"
            }`}
          >
            [ {toast.message} ]
          </div>
        ) : null}

        <header className="mb-2 flex items-center justify-between border border-white bg-white px-4 py-3 text-black">
          <h1
            className="text-[1.9rem] font-semibold leading-none sm:text-[2.1rem]"
            style={{ fontFamily: 'var(--font-display), "Times New Roman", serif' }}
          >
            THE MONOLITH
          </h1>
          <button
            type="button"
            className="font-mono text-[0.82rem] uppercase tracking-[0.14em] text-black transition-opacity hover:opacity-70"
            onClick={() => setIsProtocolModalOpen(true)}
          >
            [ THE WAY ]
          </button>
        </header>

        <div className="mb-2 border-y border-white/25 py-2 text-center font-mono text-xs uppercase tracking-[0.14em] text-white/86">
          CURRENT VALUATION: {formatUsd(snapshot.monolith.valuation)}
          <span className="px-2 text-white/45">|</span>
          MINIMUM BID: {formatUsd(displacementCost)}
        </div>

        <div className="flex flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(23rem,0.8fr)] lg:gap-6">
          <section className="relative flex min-h-[42svh] flex-1 flex-col justify-center py-3 lg:min-h-[64vh]">
            <div className="min-h-[14rem] flex-1">
              <MonolithDisplay
                content={snapshot.monolith.content}
                transitionKey={snapshot.monolith.id}
              />
            </div>
            {snapshot.monolith.sourceType === "solo" &&
            snapshot.monolith.authorName ? (
              <p className="mt-2 text-right text-[0.9rem] italic tracking-[0.05em] text-white/72">
                - {snapshot.monolith.authorName}
              </p>
            ) : null}
            {snapshot.monolith.sourceType === "syndicate" ? (
              <div className="mt-2 space-y-1 text-right">
                <p className="text-[0.9rem] italic tracking-[0.05em] text-white/72">
                  - {snapshot.monolith.authorName ?? "Anonymous"}
                </p>
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.13em] text-white/66">
                  Funded by {snapshot.monolith.fundedByCount ?? 0}{" "}
                  {snapshot.monolith.sourceSyndicateId ? (
                    <button
                      type="button"
                      className="underline decoration-white/50 underline-offset-2 transition-colors hover:text-white"
                      onClick={handleOpenContributors}
                    >
                      users
                    </button>
                  ) : (
                    "users"
                  )}{" "}
                  in {snapshot.monolith.fundedInDays ?? 1} days.
                </p>
              </div>
            ) : null}

            <div className="mt-4">
              <ControlDeck
                displacementCost={displacementCost}
                onAcquireSolo={() => setIsAcquireSoloModalOpen(true)}
                onInitializeSyndicate={() => setIsModalOpen(true)}
              />
            </div>
          </section>

          <section className="space-y-2 border-t border-white/20 pt-3 lg:border lg:border-white/20 lg:px-4 lg:py-3">
            <h2 className="ui-label text-[0.68rem]">
              ACTIVE SYNDICATES ({ledgerRows.length})
            </h2>
            <SyndicateLedger
              syndicates={ledgerRows}
              onSelect={(syndicate: SyndicateLedgerRow) =>
                setSelectedSyndicateId(syndicate.id)
              }
            />
          </section>
        </div>

        <footer className="mt-4 border-t border-white/20 pt-3 text-center">
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/62 transition-colors hover:text-white"
            onClick={() => setIsProtocolTermsModalOpen(true)}
          >
            PROTOCOL &amp; TERMS
          </button>
        </footer>
      </main>

      <InitializeSyndicateModal
        open={isModalOpen}
        minimumContribution={1}
        onClose={() => setIsModalOpen(false)}
        onDeploy={handleInitializeSyndicate}
      />

      <AcquireSoloModal
        open={isAcquireSoloModalOpen}
        minimumBid={displacementCost}
        onClose={() => setIsAcquireSoloModalOpen(false)}
        onAcquire={handleAcquireSolo}
      />

      <ProtocolModal
        open={isProtocolModalOpen}
        onClose={() => setIsProtocolModalOpen(false)}
      />

      <ProtocolTermsModal
        open={isProtocolTermsModalOpen}
        onClose={() => setIsProtocolTermsModalOpen(false)}
      />

      <ContributeSyndicateModal
        open={Boolean(selectedSyndicateId)}
        syndicate={selectedSyndicate}
        minimumContribution={1}
        onClose={() => setSelectedSyndicateId(null)}
        onContribute={handleContributeSyndicate}
      />

      <SyndicateContributorsModal
        open={isContributorModalOpen}
        contributors={
          isLoadingContributors ? ["Loading contributors..."] : contributors
        }
        onClose={() => setIsContributorModalOpen(false)}
      />

      <SyndicateFundedModal
        open={isFundedCongratsOpen}
        onClose={() => setIsFundedCongratsOpen(false)}
      />
    </>
  );
}
