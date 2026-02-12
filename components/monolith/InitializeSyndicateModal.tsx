"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatUsd } from "@/lib/protocol/pricing";

type SyndicateDraft = {
  proposedContent: string;
  initialContribution: number;
  authorName: string;
  notifyEmail: string;
  notifyOnFunded: boolean;
  notifyOnEveryContribution: boolean;
};

type InitializeSyndicateModalProps = {
  open: boolean;
  minimumContribution: number;
  onClose: () => void;
  onDeploy?: (draft: SyndicateDraft) => Promise<void> | void;
};

export function InitializeSyndicateModal({
  open,
  minimumContribution,
  onClose,
  onDeploy,
}: InitializeSyndicateModalProps) {
  const [proposedContent, setProposedContent] = useState("");
  const [initialContribution, setInitialContribution] = useState(
    minimumContribution.toFixed(2),
  );
  const [authorName, setAuthorName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyOnFunded, setNotifyOnFunded] = useState(true);
  const [notifyOnEveryContribution, setNotifyOnEveryContribution] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setProposedContent("");
      setInitialContribution(minimumContribution.toFixed(2));
      setAuthorName("");
      setNotifyEmail("");
      setNotifyOnFunded(true);
      setNotifyOnEveryContribution(false);
      setIsSubmitting(false);
      setSubmissionError(null);
    }
  }, [open, minimumContribution]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const contribution = Number(initialContribution);
    if (Number.isNaN(contribution) || contribution < minimumContribution) {
      setSubmissionError(
        `Initial contribution must be at least ${formatUsd(minimumContribution)}.`,
      );
      return;
    }

    if (!proposedContent.trim()) {
      setSubmissionError("Proposed inscription is required.");
      return;
    }

    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      await onDeploy?.({
        proposedContent: proposedContent.trim(),
        initialContribution: Number(contribution.toFixed(2)),
        authorName: authorName.trim(),
        notifyEmail: notifyEmail.trim(),
        notifyOnFunded,
        notifyOnEveryContribution,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to deploy funds. Please try again.";
      setSubmissionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
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
            aria-label="Initialize Syndicate"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="ui-label text-sm">INITIALIZE SYNDICATE</h2>
              <button
                type="button"
                className="ui-label text-xs text-white/70 transition-colors hover:text-white"
                onClick={onClose}
                aria-label="Close syndicate modal"
              >
                [ CLOSE ]
              </button>
            </div>

            <ol className="mb-5 space-y-2 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white/75">
              <li>1. Funds are held in escrow.</li>
              <li>2. Funds do not expire.</li>
              <li>3. Displacement occurs automatically when target is met.</li>
            </ol>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="ui-label text-[0.65rem]">
                  Proposed Inscription
                </span>
                <textarea
                  rows={4}
                  maxLength={180}
                  value={proposedContent}
                  onChange={(event) => {
                    setProposedContent(event.target.value);
                    if (submissionError) {
                      setSubmissionError(null);
                    }
                  }}
                  className="field-input resize-none"
                  placeholder="YOUR MESSAGE HERE"
                />
              </label>

              <label className="block space-y-2">
                <span className="ui-label text-[0.65rem]">
                  Author Name / Alias (optional)
                </span>
                <input
                  type="text"
                  maxLength={40}
                  value={authorName}
                  onChange={(event) => {
                    setAuthorName(event.target.value);
                    if (submissionError) {
                      setSubmissionError(null);
                    }
                  }}
                  className="field-input"
                  placeholder="Anonymous"
                />
              </label>

              <label className="block space-y-2">
                <span className="ui-label text-[0.65rem]">
                  Notify Email (optional)
                </span>
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(event) => {
                    setNotifyEmail(event.target.value);
                    if (submissionError) {
                      setSubmissionError(null);
                    }
                  }}
                  className="field-input"
                  placeholder="you@example.com"
                />
              </label>

              <label className="flex items-center gap-3 border border-white/25 px-3 py-2">
                <input
                  type="checkbox"
                  checked={notifyOnFunded}
                  onChange={(event) => setNotifyOnFunded(event.target.checked)}
                />
                <span className="ui-label text-[0.6rem]">
                  Notify me when fully funded
                </span>
              </label>

              <label className="flex items-center gap-3 border border-white/25 px-3 py-2">
                <input
                  type="checkbox"
                  checked={notifyOnEveryContribution}
                  onChange={(event) =>
                    setNotifyOnEveryContribution(event.target.checked)
                  }
                />
                <span className="ui-label text-[0.6rem]">
                  Notify me for every contribution
                </span>
              </label>

              <label className="block space-y-2">
                <span className="ui-label text-[0.65rem]">
                  Initial Contribution (min {formatUsd(minimumContribution)})
                </span>
                <input
                  type="number"
                  min={minimumContribution}
                  step="0.01"
                  value={initialContribution}
                  onChange={(event) => {
                    setInitialContribution(event.target.value);
                    if (submissionError) {
                      setSubmissionError(null);
                    }
                  }}
                  className="field-input"
                  placeholder="1.00"
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
                [ {isSubmitting ? "PROCESSING..." : "DEPLOY FUNDS"} ]
              </button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
