"use client";

import { AnimatePresence, motion } from "framer-motion";

type ProtocolModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ProtocolModal({ open, onClose }: ProtocolModalProps) {
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Protocol"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="ui-label text-sm">PROTOCOL</h2>
              <button
                type="button"
                className="ui-label text-xs text-white/70 transition-colors hover:text-white"
                onClick={onClose}
              >
                [ CLOSE ]
              </button>
            </div>

            <ul className="space-y-3 font-mono text-[0.62rem] uppercase tracking-[0.17em] text-white/78">
              <li>The Monolith displays one message at a time.</li>
              <li>
                To overwrite the current message, you must pay at least $1.00 USD
                more than the current valuation.
              </li>
              <li>There are no refunds. Only glory.</li>
            </ul>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
