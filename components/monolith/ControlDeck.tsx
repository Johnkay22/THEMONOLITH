"use client";

import { AnimatePresence, motion } from "framer-motion";
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
          [ ACQUIRE SOLO —{" "}
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={displacementCost}
              className="inline-block min-w-[4.8rem] text-right"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {formatUsd(displacementCost)}
            </motion.span>
          </AnimatePresence>{" "}
          ]
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
