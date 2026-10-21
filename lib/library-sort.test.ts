import { describe, expect, it } from "vitest";
import { sortBooks } from "./library-sort";

const book = (title: string, extra: Partial<{ author: string; progress: number; addedAt: number; openedAt: number }> = {}) => ({
  title,
  progress: 0,
  addedAt: 0,
  ...extra,
});

const titles = (books: { title: string }[]) => books.map((b) => b.title);

describe("sortBooks", () => {
  it("recent: opened books newest first, then never-opened by import time", () => {
    const books = [
      book("old import", { addedAt: 1 }),
      book("read yesterday", { addedAt: 2, openedAt: 10 }),
      book("new import", { addedAt: 5 }),
      book("read today", { addedAt: 3, openedAt: 20 }),
    ];
    expect(titles(sortBooks(books, "recent", "en"))).toEqual([
      "read today",
      "read yesterday",
      "new import",
      "old import",
    ]);
  });

  it("title: ignores case and accents", () => {
    const books = [book("zebra"), book("Éclair"), book("apple"), book("eagle")];
    expect(titles(sortBooks(books, "title", "es"))).toEqual(["apple", "eagle", "Éclair", "zebra"]);
  });

  it("title: sorts numbers naturally", () => {
    expect(titles(sortBooks([book("Part 10"), book("Part 2")], "title", "en"))).toEqual(["Part 2", "Part 10"]);
  });

  it("author: alphabetical with author-less books last", () => {
    const books = [book("A", {}), book("B", { author: "Ñúñez" }), book("C", { author: "álvarez" })];
    expect(titles(sortBooks(books, "author", "es"))).toEqual(["C", "B", "A"]);
  });

  it("progress: most read first", () => {
    const books = [book("half", { progress: 0.5 }), book("done", { progress: 1 }), book("new")];
    expect(titles(sortBooks(books, "progress", "en"))).toEqual(["done", "half", "new"]);
  });

  it("does not mutate the input", () => {
    const books = [book("b"), book("a")];
    sortBooks(books, "title", "en");
    expect(titles(books)).toEqual(["b", "a"]);
  });
});
