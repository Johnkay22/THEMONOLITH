"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatUsd } from "@/lib/protocol/pricing";

type AcquireSoloDraft = {
  content: string;
};

type AcquireSoloModalProps = {
  open: boolean;
  displacementCost: number;
  onClose: () => void;
  onAcquire?: (draft: AcquireSoloDraft) => Promise<void> | void;
};

export function AcquireSoloModal({
  open,
  displacementCost,
  onClose,
  onAcquire,
}: AcquireSoloModalProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setContent("");
      setIsSubmitting(false);
      setSubmissionError(null);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) {
      setSubmissionError("Inscription is required.");
      return;
    }

    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      await onAcquire?.({ content: content.trim() });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to acquire the monolith. Please try again.";
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
        >
          <motion.div
            className="w-full max-w-lg border border-white bg-[#050505] p-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="ui-label text-sm">ACQUIRE SOLO</h2>
              <button
                type="button"
                className="ui-label text-xs text-white/70 transition-colors hover:text-white"
                onClick={onClose}
                aria-label="Close solo acquisition modal"
              >
                [ CLOSE ]
              </button>
            </div>

            <p className="mb-4 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white/75">
              Displacement cost is fixed at {formatUsd(displacementCost)} for this
              acquisition.
            </p>
            <p className="mb-5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-white/60">
              Prototype mode: payment settlement will be attached in Stripe Step 4.
            </p>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="ui-label text-[0.65rem]">New Inscription</span>
                <textarea
                  required
                  rows={4}
                  maxLength={180}
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    if (submissionError) {
                      setSubmissionError(null);
                    }
                  }}
                  className="field-input resize-none"
                  placeholder="YOUR MESSAGE HERE"
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
                [ {isSubmitting ? "PROCESSING..." : "EXECUTE ACQUISITION"} ]
              </button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
