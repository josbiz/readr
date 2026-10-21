import type { BookFormat } from "../db";
import type { Location } from "../location";

export interface TocEntry {
  label: string;
  location: Location;
  children: TocEntry[];
}

export interface Box {
  width: number;
  height: number;
}

/**
 * One contract for every format. The reader only deals with page indexes;
 * each source decides what a page is for the current box and font size.
 */
export interface PageSource {
  readonly format: BookFormat;
  readonly pageCount: number;
  readonly toc: TocEntry[];
  /** Paginates (EPUB) or rescales (PDF) for a page box of this size. */
  layout(box: Box, fontSize: number): Promise<void>;
  /** Draws page `index` into `el`, which is laid out at `box` (zoom included). */
  renderPage(index: number, el: HTMLElement, box: Box): Promise<void>;
  locationOf(index: number): Location;
  pageOf(location: Location): number;
  /** 0..1 position of a page within the book. */
  percentOf(index: number): number;
  chapterOf(index: number): string | undefined;
  excerptOf(index: number): Promise<string | undefined>;
  destroy(): void;
}

export type BookErrorKind = "unsupported" | "unreadable";

export class BookError extends Error {
  constructor(
    readonly kind: BookErrorKind,
    options?: { cause?: unknown },
  ) {
    super(kind, options);
    this.name = "BookError";
  }
}

/** Collapses whitespace and trims an excerpt to a readable length. */
export function excerpt(text: string, max = 140): string | undefined {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return clean.length > max ? `${clean.slice(0, max).replace(/\s\S*$/, "")}…` : clean;
}
