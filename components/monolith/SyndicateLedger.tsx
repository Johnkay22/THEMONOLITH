"use client";

import { AnimatePresence, motion } from "framer-motion";
import { formatUsd } from "@/lib/protocol/pricing";
import type { SyndicateLedgerRow } from "@/types/monolith";

type SyndicateLedgerProps = {
  syndicates: SyndicateLedgerRow[];
};

function previewText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 28) {
    return normalized;
  }

  return `${normalized.slice(0, 25)}...`;
}

export function SyndicateLedger({ syndicates }: SyndicateLedgerProps) {
  if (syndicates.length === 0) {
    return (
      <div className="ledger-row">
        <span className="text-white/70">[ No active syndicates. ]</span>
      </div>
    );
  }

  return (
    <motion.ul className="space-y-2" layout>
      <AnimatePresence initial={false}>
        {syndicates.map((syndicate) => {
          const percentage = Math.floor(syndicate.progressRatio * 100);
          return (
            <motion.li
              key={syndicate.id}
              className="ledger-row"
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <span className="truncate">
                [{` ${previewText(syndicate.proposedContent)} `}]
              </span>
              <span className="ml-2 whitespace-nowrap text-right text-white/85">
                {formatUsd(syndicate.totalRaised)} / {formatUsd(syndicate.target)} (
                {percentage}%)
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </motion.ul>
  );
}
