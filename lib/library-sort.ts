import type { BookRecord } from "./db";
import type { LibrarySort } from "./settings";

type Sortable = Pick<BookRecord, "title" | "author" | "progress" | "addedAt" | "openedAt">;

export function sortBooks<T extends Sortable>(books: readonly T[], sort: LibrarySort, locale: string): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const byTitle = (a: T, b: T) => collator.compare(a.title, b.title);
  const compare: Record<LibrarySort, (a: T, b: T) => number> = {
    // Opened books first (newest first), then never-opened books by import time.
    recent: (a, b) =>
      (b.openedAt ?? -1) - (a.openedAt ?? -1) || b.addedAt - a.addedAt,
    title: byTitle,
    // Books without an author go last.
    author: (a, b) =>
      (a.author ? 0 : 1) - (b.author ? 0 : 1) ||
      collator.compare(a.author ?? "", b.author ?? "") ||
      byTitle(a, b),
    progress: (a, b) => b.progress - a.progress || byTitle(a, b),
  };
  return [...books].sort(compare[sort]);
}
