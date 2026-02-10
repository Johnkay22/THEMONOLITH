"use client";

import { formatUsd } from "@/lib/protocol/pricing";

type ControlDeckProps = {
  displacementCost: number;
  onAcquireSolo: () => void;
  onInitializeSyndicate: () => void;
};

export function ControlDeck({
  displacementCost,
  onAcquireSolo,
  onInitializeSyndicate,
}: ControlDeckProps) {
  return (
    <section className="space-y-3 pb-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="deck-button"
          onClick={onAcquireSolo}
          aria-label={`Acquire the Monolith solo for ${formatUsd(displacementCost)}`}
        >
          [ ACQUIRE SOLO — {formatUsd(displacementCost)} ]
        </button>
        <button
          type="button"
          className="deck-button"
          onClick={onInitializeSyndicate}
        >
          [ INITIALIZE SYNDICATE ]
        </button>
      </div>
    </section>
  );
}
