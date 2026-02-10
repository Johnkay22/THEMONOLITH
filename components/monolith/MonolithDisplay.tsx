"use client";

import { AnimatePresence, motion } from "framer-motion";

type MonolithDisplayProps = {
  content: string;
  transitionKey: string;
};

export function MonolithDisplay({ content, transitionKey }: MonolithDisplayProps) {
  const normalizedContent = content.replace(/\s+/g, " ").trim();
  const variantClass =
    normalizedContent.length > 90
      ? "monolith-display--dense"
      : normalizedContent.length > 55
        ? "monolith-display--balanced"
        : "monolith-display--hero";

  return (
    <section className="flex min-h-[58svh] items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.h1
          key={transitionKey}
          className={`monolith-display ${variantClass} text-center`}
          initial={{ opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.38, ease: "easeOut" }}
        >
          {content}
        </motion.h1>
      </AnimatePresence>
    </section>
  );
}
