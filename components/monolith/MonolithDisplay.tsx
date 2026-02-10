"use client";

import { AnimatePresence, motion } from "framer-motion";

type MonolithDisplayProps = {
  content: string;
};

export function MonolithDisplay({ content }: MonolithDisplayProps) {
  return (
    <section className="flex min-h-[52svh] items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.h1
          key={content}
          className="monolith-display text-center"
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
