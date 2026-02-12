"use client";

import { AnimatePresence, motion } from "framer-motion";

type SyndicateContributorsModalProps = {
  open: boolean;
  contributors: string[];
  onClose: () => void;
};

export function SyndicateContributorsModal({
  open,
  contributors,
  onClose,
}: SyndicateContributorsModalProps) {
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
            aria-label="Syndicate contributors"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="ui-label text-sm">SYNDICATE CONTRIBUTORS</h2>
              <button
                type="button"
                className="ui-label text-xs text-white/70 transition-colors hover:text-white"
                onClick={onClose}
              >
                [ CLOSE ]
              </button>
            </div>

            {contributors.length === 0 ? (
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white/72">
                [ No contributors recorded. ]
              </p>
            ) : (
              <ul className="space-y-2">
                {contributors.map((name, index) => (
                  <li
                    key={`${name}-${index}`}
                    className="border border-white/20 px-3 py-2 text-[0.66rem] uppercase tracking-[0.14em] text-white/90"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
