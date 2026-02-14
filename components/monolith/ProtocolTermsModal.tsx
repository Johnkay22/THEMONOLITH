"use client";

import { AnimatePresence, motion } from "framer-motion";

type ProtocolTermsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ProtocolTermsModal({ open, onClose }: ProtocolTermsModalProps) {
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
            className="w-full max-w-2xl border border-white bg-[#050505] p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Protocol and Terms"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="ui-label text-sm">PROTOCOL &amp; TERMS</h2>
              <button
                type="button"
                className="ui-label text-xs text-white/70 transition-colors hover:text-white"
                onClick={onClose}
              >
                [ CLOSE ]
              </button>
            </div>

            <div className="max-h-[72svh] space-y-5 overflow-y-auto pr-1 text-white/84">
              <div className="space-y-1">
                <p className="ui-label text-[0.65rem]">
                  THE MONOLITH // PROTOCOL &amp; TERMS
                </p>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em]">
                  Last Updated: February 13, 2026
                </p>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em]">
                  Contact: oracle@themonolith.app
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="ui-label text-[0.66rem]">1. THE COVENANT (Terms of Service)</h3>
                <p className="text-[0.72rem] leading-relaxed">
                  By inscribing upon The Monolith, you acknowledge that you are entering a space of ephemeral permanence.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  The Mechanism: You understand that paying to &quot;Acquire Solo&quot; or &quot;Fund a Syndicate&quot; grants you temporary control of the display.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Displacement: You acknowledge that your message will be displaced by future contributors. There is no guaranteed duration of visibility. A displacement occurring 1 second after your purchase is a feature of the system, not a defect.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Finality: All transactions are final. We do not offer refunds for messages that are displaced, regardless of how quickly it happens.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="ui-label text-[0.66rem]">2. THE LAW (Content Policy)</h3>
                <p className="text-[0.72rem] leading-relaxed">
                  The Monolith is a monument to expression, but it is not a lawless void. To ensure the survival of the platform, the following inscriptions are strictly prohibited and will result in immediate Exile (deletion) without refund:
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Hate Speech: Any content promoting violence, harassment, or discrimination against individuals or groups based on race, ethnicity, religion, gender, or orientation.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Illegal Acts: Promotion of illegal activities, including the sale of regulated goods or services.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Doxxing: Sharing private personal information of others without consent.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Malicious Code: Any attempt to inject scripts, exploits, or destabilize the display.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Enforcement: The Monolith reserves the absolute right to redact, censor, or delete any message that violates these terms.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="ui-label text-[0.66rem]">3. THE DATA (Privacy Policy)</h3>
                <p className="text-[0.72rem] leading-relaxed">
                  We believe in anonymity. We do not require account registration.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  What We Collect:
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Payment Data: Processed securely via Stripe. We do not store your credit card details.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Optional Identity: If you choose to provide an Author Name, it will be publicly displayed.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Optional Contact: If you choose to provide an Email Address, it is used solely for transactional notifications. We do not sell your data.
                </p>
                <p className="text-[0.72rem] leading-relaxed">
                  Cookies: We use minimal local storage only to maintain the state of your session.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="ui-label text-[0.66rem]">4. LIMITATION OF LIABILITY</h3>
                <p className="text-[0.72rem] leading-relaxed">
                  The Monolith is provided &quot;as is.&quot; We are not liable for any damages arising from your use of the platform, including but not limited to loss of data, loss of visibility, or the psychological weight of impermanence.
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
