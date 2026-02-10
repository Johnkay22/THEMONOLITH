"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ControlDeck } from "@/components/monolith/ControlDeck";
import { InitializeSyndicateModal } from "@/components/monolith/InitializeSyndicateModal";
import { MonolithDisplay } from "@/components/monolith/MonolithDisplay";
import { SyndicateLedger } from "@/components/monolith/SyndicateLedger";
import { useMonolithRealtime } from "@/hooks/useMonolithRealtime";
import { buildSyndicateLedgerRows } from "@/lib/protocol/normalizers";
import { calculateDisplacementCost } from "@/lib/protocol/pricing";
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

  return (
    <>
      <main className="mx-auto flex min-h-svh w-full max-w-screen-sm flex-col px-5 pb-7 pt-5">
        <header className="ui-label mb-4">THE MONOLITH</header>

        <div className="flex flex-1 flex-col justify-center">
          <MonolithDisplay
            content={snapshot.monolith.content}
            transitionKey={snapshot.monolith.id}
          />
        </div>

        <ControlDeck
          displacementCost={displacementCost}
          onAcquireSolo={() => undefined}
          onInitializeSyndicate={() => setIsModalOpen(true)}
        />

        <section className="space-y-3 border-t border-white/20 pt-4">
          <h2 className="ui-label">
            LEDGER: PENDING ACQUISITIONS ({ledgerRows.length})
          </h2>
          <SyndicateLedger syndicates={ledgerRows} />
        </section>
      </main>

      <InitializeSyndicateModal
        open={isModalOpen}
        minimumContribution={1}
        onClose={() => setIsModalOpen(false)}
        onDeploy={handleInitializeSyndicate}
      />
    </>
  );
}
