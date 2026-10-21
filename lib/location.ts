/**
 * A position in a book. PDF positions are pages. EPUB positions are a
 * character offset into a spine section's sanitized text, which survives
 * re-pagination when the layout or font size changes.
 */
export type Location =
  | { kind: "pdf"; page: number } // 1-based
  | { kind: "epub"; spine: number; offset: number; percent: number };

/** Orders two locations of the same book in reading order. */
export function compareLocations(a: Location, b: Location): number {
  if (a.kind === "pdf" && b.kind === "pdf") return a.page - b.page;
  if (a.kind === "epub" && b.kind === "epub") return a.spine - b.spine || a.offset - b.offset;
  // Locations from different formats never share a book; keep the order stable.
  return a.kind === "pdf" ? -1 : 1;
}
