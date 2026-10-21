import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addBookmark,
  closeDB,
  deleteBookmark,
  getBook,
  getFile,
  importBook,
  listBookmarks,
  listBooks,
  markOpened,
  removeBook,
  savePosition,
  setFinished,
  StorageFullError,
  type ParsedBook,
} from "./db";

const pdf = (content: string, name = "book.pdf") => new File([content], name, { type: "application/pdf" });
const parseAs =
  (meta: Partial<ParsedBook> = {}) =>
  async (): Promise<ParsedBook> => ({ format: "pdf", ...meta });

beforeEach(async () => {
  await closeDB();
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => vi.restoreAllMocks());

describe("importBook", () => {
  it("stores metadata and the file", async () => {
    const { book, duplicate } = await importBook(pdf("one"), parseAs({ title: " Dune ", author: "Herbert" }));
    expect(duplicate).toBe(false);
    expect(book).toMatchObject({ format: "pdf", title: "Dune", author: "Herbert", progress: 0, finished: false });
    expect(book.id).toMatch(/^[0-9a-f]{64}$/);
    expect(await (await getFile(book.id))!.text()).toBe("one");
    expect(await listBooks()).toHaveLength(1);
  });

  it("falls back to the file name for a missing title", async () => {
    const { book } = await importBook(pdf("x", "My Notes.v2.pdf"), parseAs({ title: "  " }));
    expect(book.title).toBe("My Notes.v2");
  });

  it("recognizes duplicates by content and keeps their state", async () => {
    const { book } = await importBook(pdf("same", "a.pdf"), parseAs());
    await savePosition(book.id, { kind: "pdf", page: 4 }, 0.4, false);
    await addBookmark({ bookId: book.id, location: { kind: "pdf", page: 2 }, label: { percent: 0.2 } });

    const parse = vi.fn(parseAs());
    const again = await importBook(pdf("same", "renamed.pdf"), parse);

    expect(again.duplicate).toBe(true);
    expect(parse).not.toHaveBeenCalled();
    expect(await listBooks()).toHaveLength(1);
    expect((await getBook(book.id))!.position).toEqual({ kind: "pdf", page: 4 });
    expect(await listBookmarks(book.id)).toHaveLength(1);
  });

  it("does not store anything when parsing fails", async () => {
    await expect(importBook(pdf("bad"), () => Promise.reject(new Error("unreadable")))).rejects.toThrow("unreadable");
    expect(await listBooks()).toEqual([]);
  });

  it("maps a quota error to StorageFullError and leaves the stores unchanged", async () => {
    await importBook(pdf("first"), parseAs());
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await expect(importBook(pdf("second"), parseAs())).rejects.toBeInstanceOf(StorageFullError);
    vi.restoreAllMocks();
    expect(await listBooks()).toHaveLength(1);
  });
});

describe("reading state", () => {
  it("marks finished on reaching the end and keeps it until toggled", async () => {
    const { book } = await importBook(pdf("b"), parseAs());
    await savePosition(book.id, { kind: "pdf", page: 10 }, 1, true);
    expect((await getBook(book.id))!.finished).toBe(true);

    await savePosition(book.id, { kind: "pdf", page: 3 }, 0.3, false);
    expect((await getBook(book.id))!.finished).toBe(true);
  });

  it("manual toggle leaves the position unchanged, and reaching the end again re-marks", async () => {
    const { book } = await importBook(pdf("c"), parseAs());
    await savePosition(book.id, { kind: "pdf", page: 10 }, 1, true);
    await setFinished(book.id, false);
    const after = (await getBook(book.id))!;
    expect(after.finished).toBe(false);
    expect(after.position).toEqual({ kind: "pdf", page: 10 });

    await savePosition(book.id, { kind: "pdf", page: 10 }, 1, true);
    expect((await getBook(book.id))!.finished).toBe(true);
  });

  it("records when a book was opened", async () => {
    const { book } = await importBook(pdf("d"), parseAs());
    await markOpened(book.id);
    expect((await getBook(book.id))!.openedAt).toBeTypeOf("number");
  });
});

describe("removeBook", () => {
  it("deletes the book, its file and only its bookmarks", async () => {
    const { book: a } = await importBook(pdf("a"), parseAs());
    const { book: b } = await importBook(pdf("b"), parseAs());
    await addBookmark({ bookId: a.id, location: { kind: "pdf", page: 1 }, label: { percent: 0 } });
    await addBookmark({ bookId: b.id, location: { kind: "pdf", page: 1 }, label: { percent: 0 } });

    await removeBook(a.id);

    expect(await getBook(a.id)).toBeUndefined();
    expect(await getFile(a.id)).toBeUndefined();
    expect(await listBookmarks(a.id)).toEqual([]);
    expect(await listBookmarks(b.id)).toHaveLength(1);
  });
});

describe("bookmarks", () => {
  it("lists in reading order and round-trips add/delete", async () => {
    const { book } = await importBook(pdf("e"), parseAs({ format: "epub" }));
    const loc = (spine: number, offset: number) => ({ kind: "epub" as const, spine, offset, percent: 0 });
    await addBookmark({ bookId: book.id, location: loc(2, 5), label: { percent: 0.5 } });
    const first = await addBookmark({ bookId: book.id, location: loc(0, 900), label: { percent: 0.1 } });
    await addBookmark({ bookId: book.id, location: loc(2, 1), label: { percent: 0.4 } });

    const listed = await listBookmarks(book.id);
    expect(listed.map((b) => b.location)).toEqual([loc(0, 900), loc(2, 1), loc(2, 5)]);

    await deleteBookmark(first.id);
    expect(await listBookmarks(book.id)).toHaveLength(2);
  });

  it("orders PDF bookmarks by page", async () => {
    const { book } = await importBook(pdf("f"), parseAs());
    for (const page of [9, 2, 5]) {
      await addBookmark({ bookId: book.id, location: { kind: "pdf", page }, label: { percent: 0 } });
    }
    const pages = (await listBookmarks(book.id)).map((b) => (b.location.kind === "pdf" ? b.location.page : 0));
    expect(pages).toEqual([2, 5, 9]);
  });
});
