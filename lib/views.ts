import type { LayoutMode } from "./settings";

export type Resolved = "single" | "spread" | "scroll";

/** Pages shown together. Single: [page]. Spread: [left, right], either may be null. */
export type View = (number | null)[];

export const MIN_PAGE_WIDTH = 360;
export const SPREAD_GUTTER = 48;

/** Auto shows a spread only when two readable pages fit side by side in landscape. */
export function resolveLayout(mode: LayoutMode, size: { width: number; height: number }): Resolved {
  if (mode !== "auto") return mode;
  const roomForTwo = size.width >= 2 * MIN_PAGE_WIDTH + SPREAD_GUTTER;
  return roomForTwo && size.width > size.height ? "spread" : "single";
}

/**
 * Splits pages into views. Spreads open like a book: the first page (the cover)
 * sits alone on the right, then pages pair up as [1,2], [3,4]...
 */
export function buildViews(pageCount: number, layout: Resolved): View[] {
  const views: View[] = [];
  if (pageCount <= 0) return views;
  if (layout !== "spread") {
    for (let i = 0; i < pageCount; i++) views.push([i]);
    return views;
  }
  views.push([null, 0]);
  for (let left = 1; left < pageCount; left += 2) {
    views.push([left, left + 1 < pageCount ? left + 1 : null]);
  }
  return views;
}

export function viewIndexOfPage(views: View[], page: number): number {
  const index = views.findIndex((v) => v.includes(page));
  return index === -1 ? Math.max(0, views.length - 1) : index;
}

/** The page a view "is on": its left page, or its only page. */
export function primaryPage(view: View): number {
  return (view.find((p) => p !== null) ?? 0) as number;
}
