"use client";

import { useLayoutEffect, useRef } from "react";
import type { Box, PageSource } from "@/lib/formats";

/** Renders one page into a DOM node that React leaves alone. */
export function PageView({
  source,
  index,
  box,
  version,
}: {
  source: PageSource;
  index: number;
  box: Box;
  version: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = box;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    source.renderPage(index, el, { width, height }).catch(() => {});
  }, [source, index, width, height, version]);

  return <div ref={ref} className={`page-surface ${source.format === "pdf" ? "pdf-page-host" : ""}`} />;
}

export function Ribbon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 34"
      className="pointer-events-none absolute top-0 right-[8%] z-[1] h-9 w-5 drop-shadow-sm"
    >
      <path d="M0 0h20v34l-10-8-10 8z" fill="var(--accent)" />
    </svg>
  );
}
