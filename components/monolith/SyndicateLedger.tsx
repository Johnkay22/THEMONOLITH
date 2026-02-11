"use client";

import { AnimatePresence, motion } from "framer-motion";
import { formatUsd } from "@/lib/protocol/pricing";
import type { SyndicateLedgerRow } from "@/types/monolith";

type SyndicateLedgerProps = {
  syndicates: SyndicateLedgerRow[];
  onSelect?: (syndicate: SyndicateLedgerRow) => void;
};

export function SyndicateLedger({ syndicates, onSelect }: SyndicateLedgerProps) {
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
              className={`ledger-row !block space-y-3 ${onSelect ? "cursor-pointer" : ""}`}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={() => onSelect?.(syndicate)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.(syndicate);
                }
              }}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
            >
              <p className="truncate text-[0.68rem] tracking-[0.13em] text-white/92">
                {syndicate.proposedContent}
              </p>
              <div className="h-1.5 w-full border border-white/35">
                <div
                  className="h-full bg-white"
                  style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                />
              </div>
              <p className="text-right text-[0.62rem] tracking-[0.13em] text-white/76">
                {formatUsd(syndicate.totalRaised)} / {formatUsd(syndicate.target)}
              </p>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </motion.ul>
  );
}
