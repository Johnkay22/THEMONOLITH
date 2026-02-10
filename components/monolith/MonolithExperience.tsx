"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AcquireSoloModal } from "@/components/monolith/AcquireSoloModal";
import { ControlDeck } from "@/components/monolith/ControlDeck";
import { InitializeSyndicateModal } from "@/components/monolith/InitializeSyndicateModal";
import { MonolithDisplay } from "@/components/monolith/MonolithDisplay";
import { ProtocolModal } from "@/components/monolith/ProtocolModal";
import { SyndicateLedger } from "@/components/monolith/SyndicateLedger";
import { useMonolithRealtime } from "@/hooks/useMonolithRealtime";
import { buildSyndicateLedgerRows } from "@/lib/protocol/normalizers";
import { calculateDisplacementCost, formatUsd } from "@/lib/protocol/pricing";
import type { MonolithOccupant, Syndicate } from "@/types/monolith";

type MonolithExperienceProps = {
  initialMonolith: MonolithOccupant;
  initialSyndicates: Syndicate[];
};

export function MonolithExperience({
  initialMonolith,
  initialSyndicates,
}: MonolithExperienceProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAcquireSoloModalOpen, setIsAcquireSoloModalOpen] = useState(false);
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const snapshot = useMonolithRealtime(initialMonolith, initialSyndicates);

  const displacementCost = useMemo(
    () => calculateDisplacementCost(snapshot.monolith.valuation),
    [snapshot.monolith.valuation],
  );

  const ledgerRows = useMemo(
    () => buildSyndicateLedgerRows(snapshot.syndicates, displacementCost),
    [displacementCost, snapshot.syndicates],
  );

  const handleInitializeSyndicate = async (draft: {
    proposedContent: string;
    initialContribution: number;
  }) => {
    const response = await fetch("/api/syndicates/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });

    let payload: { error?: string } | null = null;
    try {
      payload = (await response.json()) as { error?: string };
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.error ?? "Failed to initialize syndicate. Please try again.",
      );
    }

    setIsModalOpen(false);
    router.refresh();
  };

  const handleAcquireSolo = async (draft: { content: string; bidAmount: number }) => {
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

    let payload: { error?: string } | null = null;
    try {
      payload = (await response.json()) as { error?: string };
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.error ?? "Failed to acquire the monolith. Please try again.",
      );
    }

    setIsAcquireSoloModalOpen(false);
    router.refresh();
  };

  return (
    <>
      <main className="mx-auto flex min-h-svh w-full max-w-screen-sm flex-col px-4 pb-[calc(1.6rem+env(safe-area-inset-bottom))] pt-4 sm:px-5">
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
          <SyndicateLedger syndicates={ledgerRows} />
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
    </>
  );
}
