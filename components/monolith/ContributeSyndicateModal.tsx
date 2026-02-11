"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatUsd } from "@/lib/protocol/pricing";
import type { SyndicateLedgerRow } from "@/types/monolith";

type ContributeSyndicateDraft = {
  syndicateId: string;
  amount: number;
};

type ContributeSyndicateModalProps = {
  open: boolean;
  syndicate: SyndicateLedgerRow | null;
  minimumContribution: number;
  onClose: () => void;
  onContribute?: (draft: ContributeSyndicateDraft) => Promise<void> | void;
};

export function ContributeSyndicateModal({
  open,
  syndicate,
  minimumContribution,
  onClose,
  onContribute,
}: ContributeSyndicateModalProps) {
  const [amount, setAmount] = useState(minimumContribution.toFixed(2));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAmount(minimumContribution.toFixed(2));
      setIsSubmitting(false);
      setSubmissionError(null);
    }
  }, [open, minimumContribution]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!syndicate) {
      setSubmissionError("Syndicate context is missing.");
      return;
    }

    const numericAmount = Number(amount);
    if (
      Number.isNaN(numericAmount) ||
      !Number.isFinite(numericAmount) ||
      numericAmount < minimumContribution
    ) {
      setSubmissionError(
        `Contribution must be at least ${formatUsd(minimumContribution)}.`,
      );
      return;
    }

    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      await onContribute?.({
        syndicateId: syndicate.id,
        amount: Number(numericAmount.toFixed(2)),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to commit contribution. Please try again.";
      setSubmissionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && syndicate ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          aria-hidden="true"
        >
          <motion.div
            className="w-full max-w-lg border border-white bg-[#050505] p-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Contribute to syndicate"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="ui-label text-sm">CONTRIBUTE TO SYNDICATE</h2>
              <button
                type="button"
                className="ui-label text-xs text-white/70 transition-colors hover:text-white"
                onClick={onClose}
              >
                [ CLOSE ]
              </button>
            </div>

            <p className="mb-2 text-[0.7rem] uppercase tracking-[0.13em] text-white/92">
              {syndicate.proposedContent}
            </p>
            <p className="mb-5 font-mono text-[0.6rem] uppercase tracking-[0.17em] text-white/72">
              Current Pool: {formatUsd(syndicate.totalRaised)} /{" "}
              {formatUsd(syndicate.target)}
            </p>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="ui-label text-[0.65rem]">
                  Contribution (min {formatUsd(minimumContribution)})
                </span>
                <input
                  type="number"
                  min={minimumContribution}
                  step="0.01"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    if (submissionError) {
                      setSubmissionError(null);
                    }
                  }}
                  className="field-input"
                  placeholder={minimumContribution.toFixed(2)}
                />
              </label>

              {submissionError ? (
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.17em] text-white/70">
                  [ {submissionError} ]
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="deck-button w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                [ {isSubmitting ? "PROCESSING..." : "COMMIT FUNDS"} ]
              </button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
