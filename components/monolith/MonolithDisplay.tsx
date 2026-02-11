"use client";

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

type MonolithDisplayProps = {
  content: string;
  transitionKey: string;
};

export function MonolithDisplay({ content, transitionKey }: MonolithDisplayProps) {
  const normalizedContent = content.replace(/\s+/g, " ").trim();
  const containerRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  const variantClass =
    normalizedContent.length > 90
      ? "monolith-display--dense"
      : normalizedContent.length > 55
        ? "monolith-display--balanced"
        : "monolith-display--hero";

  const fitDisplayText = useCallback(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) {
      return;
    }

    const maxSize =
      variantClass === "monolith-display--hero"
        ? 260
        : variantClass === "monolith-display--balanced"
          ? 200
          : 150;
    const minSize = 14;

    let low = minSize;
    let high = maxSize;
    let best = minSize;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      text.style.fontSize = `${mid}px`;
      const horizontalSafety = Math.max(12, Math.floor(mid * 0.11));
      const verticalSafety = Math.max(4, Math.floor(mid * 0.03));

      const fits =
        text.scrollWidth + horizontalSafety <= container.clientWidth &&
        text.scrollHeight + verticalSafety <= container.clientHeight;

      if (fits) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    text.style.fontSize = `${best}px`;
  }, [variantClass]);

  useEffect(() => {
    fitDisplayText();
  }, [fitDisplayText, transitionKey]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => {
        fitDisplayText();
      };

      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      fitDisplayText();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [fitDisplayText]);

  return (
    <section
      ref={containerRef}
      className="relative flex h-[58svh] min-h-[17rem] max-h-[65svh] items-center justify-center overflow-hidden px-2 sm:px-3"
    >
      <AnimatePresence mode="wait">
        <motion.h1
          ref={textRef}
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
