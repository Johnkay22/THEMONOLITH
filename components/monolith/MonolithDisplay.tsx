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

    const measureTextBounds = () => {
      const renderedBox = text.getBoundingClientRect();
      return {
        width: Math.max(text.scrollWidth, Math.ceil(renderedBox.width)),
        height: Math.max(text.scrollHeight, Math.ceil(renderedBox.height)),
      };
    };

    const maxSize =
      variantClass === "monolith-display--hero"
        ? 320
        : variantClass === "monolith-display--balanced"
          ? 240
          : 170;
    const minSize = 8;

    let low = minSize;
    let high = maxSize;
    let best = minSize;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      text.style.fontSize = `${mid}px`;
      const horizontalSafety = Math.max(18, Math.floor(mid * 0.14));
      const verticalSafety = Math.max(12, Math.floor(mid * 0.1));
      const measured = measureTextBounds();

      const fits =
        measured.width + horizontalSafety <= container.clientWidth &&
        measured.height + verticalSafety <= container.clientHeight;

      if (fits) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    let finalSize = best;
    text.style.fontSize = `${finalSize}px`;
    while (finalSize > minSize) {
      const horizontalSafety = Math.max(18, Math.floor(finalSize * 0.14));
      const verticalSafety = Math.max(12, Math.floor(finalSize * 0.1));
      const measured = measureTextBounds();
      const overflows =
        measured.width + horizontalSafety > container.clientWidth ||
        measured.height + verticalSafety > container.clientHeight;
      if (!overflows) {
        break;
      }

      finalSize -= 1;
      text.style.fontSize = `${finalSize}px`;
    }
  }, [variantClass]);

  useEffect(() => {
    fitDisplayText();
  }, [fitDisplayText, transitionKey]);

  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) {
      return;
    }

    const fonts = document.fonts;
    void fonts.ready.then(() => {
      fitDisplayText();
    });

    const handleFontsLoaded = () => {
      fitDisplayText();
    };

    fonts.addEventListener?.("loadingdone", handleFontsLoaded);

    return () => {
      fonts.removeEventListener?.("loadingdone", handleFontsLoaded);
    };
  }, [fitDisplayText]);

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
      className="relative flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-1 sm:px-2"
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
