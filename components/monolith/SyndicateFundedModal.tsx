"use client";

import { AnimatePresence, motion } from "framer-motion";

type SyndicateFundedModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SyndicateFundedModal({
  open,
  onClose,
}: SyndicateFundedModalProps) {
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
            className="w-full max-w-md border border-white bg-[#050505] p-5 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Syndicate funded"
          >
            <h2 className="ui-label mb-4 text-sm">SYNDICATE FUNDED</h2>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.17em] text-white/88">
              Congratulations.
            </p>
            <button
              type="button"
              className="deck-button mt-5 w-full"
              onClick={onClose}
            >
              [ CONTINUE ]
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
