"use client";

import { useMemo, useState } from "react";
import { AcquireSoloModal } from "@/components/monolith/AcquireSoloModal";
import { ContributeSyndicateModal } from "@/components/monolith/ContributeSyndicateModal";
import { ControlDeck } from "@/components/monolith/ControlDeck";
import { InitializeSyndicateModal } from "@/components/monolith/InitializeSyndicateModal";
import { MonolithDisplay } from "@/components/monolith/MonolithDisplay";
import { ProtocolModal } from "@/components/monolith/ProtocolModal";
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
};

export function MonolithExperience({
  initialMonolith,
  initialSyndicates,
}: MonolithExperienceProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAcquireSoloModalOpen, setIsAcquireSoloModalOpen] = useState(false);
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [selectedSyndicateId, setSelectedSyndicateId] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const { snapshot, refreshSnapshot, applySnapshot, applyMonolith, applySyndicate } =
    useMonolithRealtime(
    initialMonolith,
    initialSyndicates,
  );

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

  const showTransactionFailedToast = (details?: string) => {
    const message = details?.trim()
      ? `Transaction Failed: ${details}`
      : "Transaction Failed";
    const nextToast = {
      id: crypto.randomUUID(),
      message,
    };
    setToast(nextToast);
    window.setTimeout(() => {
      setToast((currentToast) =>
        currentToast?.id === nextToast.id ? null : currentToast,
      );
    }, 3600);
  };

  const handleInitializeSyndicate = async (draft: {
    proposedContent: string;
    initialContribution: number;
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

      const snapshotMonolithTimestamp =
        payload?.snapshot && payload.snapshot.monolith.id !== "seed-monolith"
          ? Date.parse(payload.snapshot.monolith.createdAt)
          : Number.NaN;
      const currentMonolithTimestamp = Date.parse(snapshot.monolith.createdAt);
      if (
        payload?.snapshot &&
        !Number.isNaN(snapshotMonolithTimestamp) &&
        snapshotMonolithTimestamp >= currentMonolithTimestamp
      ) {
        applySnapshot(payload.snapshot);
      }

      setIsModalOpen(false);
      queueSnapshotReconciliation();
    } catch (error) {
      applySnapshot(previousSnapshot);
      const message =
        error instanceof Error ? error.message : "Failed to initialize syndicate.";
      showTransactionFailedToast(message);
      throw error;
    }
  };

  const handleAcquireSolo = async (draft: { content: string; bidAmount: number }) => {
    const previousSnapshot = cloneSnapshot(snapshot);
    const optimisticMonolith: MonolithOccupant = {
      id: `optimistic-${crypto.randomUUID()}`,
      content: draft.content,
      valuation: draft.bidAmount,
      ownerId: null,
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

      const payloadMonolithTimestamp =
        payload?.monolith && typeof payload.monolith.createdAt === "string"
          ? Date.parse(payload.monolith.createdAt)
          : Number.NaN;
      const snapshotMonolithTimestamp =
        payload?.snapshot && payload.snapshot.monolith.id !== "seed-monolith"
          ? Date.parse(payload.snapshot.monolith.createdAt)
          : Number.NaN;
      if (
        payload?.snapshot &&
        !Number.isNaN(snapshotMonolithTimestamp) &&
        (Number.isNaN(payloadMonolithTimestamp) ||
          snapshotMonolithTimestamp >= payloadMonolithTimestamp)
      ) {
        applySnapshot(payload.snapshot);
      }

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

      const snapshotMonolithTimestamp =
        payload?.snapshot && payload.snapshot.monolith.id !== "seed-monolith"
          ? Date.parse(payload.snapshot.monolith.createdAt)
          : Number.NaN;
      const currentMonolithTimestamp = Date.parse(snapshot.monolith.createdAt);
      if (
        payload?.snapshot &&
        !Number.isNaN(snapshotMonolithTimestamp) &&
        snapshotMonolithTimestamp >= currentMonolithTimestamp
      ) {
        applySnapshot(payload.snapshot);
      }

      setSelectedSyndicateId(null);
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
      <main className="mx-auto flex min-h-svh w-full max-w-screen-sm flex-col px-4 pb-[calc(1.6rem+env(safe-area-inset-bottom))] pt-4 sm:px-5">
        {toast ? (
          <div className="mb-3 border border-white bg-black/90 px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.15em] text-white/90">
            [ {toast.message} ]
          </div>
        ) : null}
        <header className="ui-label mb-3">THE MONOLITH</header>

        <div className="flex flex-1 flex-col justify-center">
          <div className="valuation-plaque mb-6">
            <p className="ui-label text-[0.62rem] text-white/70">
              CURRENT VALUATION: {formatUsd(snapshot.monolith.valuation)}
            </p>
            <p className="ui-label text-[0.62rem] text-white/55">
              MINIMUM BID: {formatUsd(displacementCost)}
            </p>
          </div>

          <MonolithDisplay
            content={snapshot.monolith.content}
            transitionKey={snapshot.monolith.id}
          />
        </div>

        <ControlDeck
          displacementCost={displacementCost}
          onAcquireSolo={() => setIsAcquireSoloModalOpen(true)}
          onInitializeSyndicate={() => setIsModalOpen(true)}
        />

        <div className="mb-4 flex justify-end">
          <button
            type="button"
            className="ui-label text-[0.62rem] text-white/70 transition-colors hover:text-white"
            onClick={() => setIsProtocolModalOpen(true)}
          >
            PROTOCOL
          </button>
        </div>

        <section className="mt-3 space-y-3 border-t border-white/20 pt-4">
          <h2 className="ui-label">ACTIVE SYNDICATES ({ledgerRows.length})</h2>
          <SyndicateLedger
            syndicates={ledgerRows}
            onSelect={(syndicate: SyndicateLedgerRow) =>
              setSelectedSyndicateId(syndicate.id)
            }
          />
        </section>
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

      <ContributeSyndicateModal
        open={Boolean(selectedSyndicateId)}
        syndicate={selectedSyndicate}
        minimumContribution={1}
        onClose={() => setSelectedSyndicateId(null)}
        onContribute={handleContributeSyndicate}
      />
    </>
  );
}
