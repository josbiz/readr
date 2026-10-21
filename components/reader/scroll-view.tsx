"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Box, PageSource } from "@/lib/formats";
import { PageView, Ribbon } from "./page-view";

const GAP = 16;
const OVERSCAN = 2;

/** Continuous-scroll layout: pages in one column, only nearby pages rendered. */
export function ScrollView({
  source,
  pageCount,
  box,
  version,
  page,
  jumpToken,
  bookmarked,
  onPageChange,
  onCenterTap,
}: {
  source: PageSource;
  pageCount: number;
  box: Box;
  version: number;
  page: number;
  /** Changes when the reader jumps (contents, bookmarks, layout switch). */
  jumpToken: number;
  bookmarked: Set<number>;
  onPageChange: (page: number, atEnd: boolean) => void;
  onCenterTap: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const itemHeight = box.height + GAP;
  const total = pageCount * itemHeight + GAP;
  const frame = useRef(0);
  const down = useRef<{ x: number; y: number } | null>(null);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el || !pageCount) return;
    const top = el.scrollTop;
    const height = el.clientHeight;
    setRange({
      start: Math.max(0, Math.floor(top / itemHeight) - OVERSCAN),
      end: Math.min(pageCount, Math.ceil((top + height) / itemHeight) + OVERSCAN),
    });
    const current = Math.min(pageCount - 1, Math.max(0, Math.floor((top + itemHeight * 0.4) / itemHeight)));
    onPageChange(current, top + height >= total - 4);
  }, [itemHeight, pageCount, total, onPageChange]);

  // Position on open, after re-pagination and on explicit jumps.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = page * itemHeight;
    update();
    // `page` is read only when one of these changes; scrolling updates it otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToken, version, itemHeight]);

  const pages: number[] = [];
  for (let i = range.start; i < range.end; i++) pages.push(i);

  return (
    <div
      ref={scroller}
      className="absolute inset-0 overflow-auto"
      onScroll={() => {
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(update);
      }}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onClick={(e) => {
        const start = down.current;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) onCenterTap();
      }}
    >
      <div className="relative mx-auto" style={{ height: total, width: Math.max(box.width + 2 * GAP, 0) }}>
        {pages.map((i) => (
          <div
            key={i}
            className="absolute shadow-[0_8px_30px_-16px_var(--shade)]"
            style={{ top: GAP + i * itemHeight, left: GAP, width: box.width, height: box.height }}
          >
            <PageView source={source} index={i} box={box} version={version} />
            {bookmarked.has(i) && <Ribbon />}
          </div>
        ))}
      </div>
    </div>
  );
}
