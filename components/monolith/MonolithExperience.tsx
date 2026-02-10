"use client";

import { useMemo, useState } from "react";
import { ControlDeck } from "@/components/monolith/ControlDeck";
import { InitializeSyndicateModal } from "@/components/monolith/InitializeSyndicateModal";
import { MonolithDisplay } from "@/components/monolith/MonolithDisplay";
import { SyndicateLedger } from "@/components/monolith/SyndicateLedger";
import { useMonolithRealtime } from "@/hooks/useMonolithRealtime";
import { calculateDisplacementCost } from "@/lib/protocol/pricing";
import type { MonolithOccupant, SyndicateLedgerRow } from "@/types/monolith";

type MonolithExperienceProps = {
  initialMonolith: MonolithOccupant;
  initialSyndicates: SyndicateLedgerRow[];
};

export function MonolithExperience({
  initialMonolith,
  initialSyndicates,
}: MonolithExperienceProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const monolith = useMonolithRealtime(initialMonolith);

  const displacementCost = useMemo(
    () => calculateDisplacementCost(monolith.valuation),
    [monolith.valuation],
  );

  const ledgerRows = useMemo(
    () =>
      initialSyndicates.map((syndicate) => ({
        ...syndicate,
        target: displacementCost,
        progressRatio: Math.min(
          1,
          displacementCost > 0 ? syndicate.totalRaised / displacementCost : 0,
        ),
      })),
    [displacementCost, initialSyndicates],
  );

  return (
    <>
      <main className="mx-auto flex min-h-svh w-full max-w-screen-sm flex-col px-5 pb-7 pt-5">
        <header className="ui-label mb-4">THE MONOLITH</header>

        <div className="flex flex-1 flex-col justify-center">
          <MonolithDisplay content={monolith.content} />
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
      />
    </>
  );
}
