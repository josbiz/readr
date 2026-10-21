import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { compareLocations, type Location } from "./location";

export type BookFormat = "pdf" | "epub";

export type PdfZoom = { mode: "page" } | { mode: "width" } | { mode: "custom"; value: number };

export interface BookRecord {
  /** SHA-256 of the file bytes, so importing the same file twice is a lookup. */
  id: string;
  format: BookFormat;
  title: string;
  author?: string;
  fileName: string;
  size: number;
  addedAt: number;
  openedAt?: number;
  position?: Location;
  /** 0..1 at the last saved position. */
  progress: number;
  finished: boolean;
  pdfZoom?: PdfZoom;
  cover?: Blob;
}

export interface BookmarkLabel {
  chapter?: string;
  /** 1-based page, shown for fixed-layout books. */
  page?: number;
  percent: number;
  excerpt?: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  location: Location;
  label: BookmarkLabel;
  createdAt: number;
}

/** What a format parser extracts from a file at import time. */
export interface ParsedBook {
  format: BookFormat;
  title?: string;
  author?: string;
  cover?: Blob;
}

export class StorageFullError extends Error {
  constructor() {
    super("storage full");
    this.name = "StorageFullError";
  }
}

interface ReadrDB extends DBSchema {
  books: { key: string; value: BookRecord };
  files: { key: string; value: Blob };
  bookmarks: { key: string; value: Bookmark; indexes: { byBook: string } };
}

let dbPromise: Promise<IDBPDatabase<ReadrDB>> | null = null;

function db(): Promise<IDBPDatabase<ReadrDB>> {
  dbPromise ??= openDB<ReadrDB>("readr", 1, {
    upgrade(d) {
      d.createObjectStore("books", { keyPath: "id" });
      d.createObjectStore("files");
      d.createObjectStore("bookmarks", { keyPath: "id" }).createIndex("byBook", "bookId");
    },
  });
  return dbPromise;
}

/** Closes the connection; the next call reopens it. Used by tests. */
export async function closeDB(): Promise<void> {
  if (!dbPromise) return;
  (await dbPromise).close();
  dbPromise = null;
}

function isQuotaError(error: unknown): boolean {
  return error instanceof Error && error.name === "QuotaExceededError";
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || name;
}

export async function importBook(
  file: File,
  parse: (file: File, bytes: ArrayBuffer) => Promise<ParsedBook>,
): Promise<{ book: BookRecord; duplicate: boolean }> {
  const bytes = await file.arrayBuffer();
  const id = await sha256Hex(bytes);
  const d = await db();
  const existing = await d.get("books", id);
  if (existing) return { book: existing, duplicate: true };

  const parsed = await parse(file, bytes);
  const isFirstBook = (await d.count("books")) === 0;
  const book: BookRecord = {
    id,
    format: parsed.format,
    title: parsed.title?.trim() || titleFromFileName(file.name),
    author: parsed.author?.trim() || undefined,
    fileName: file.name,
    size: file.size,
    addedAt: Date.now(),
    progress: 0,
    finished: false,
    cover: parsed.cover,
  };
  try {
    const tx = d.transaction(["books", "files"], "readwrite");
    await Promise.all([
      tx.objectStore("books").put(book),
      tx.objectStore("files").put(new Blob([bytes], { type: file.type }), id),
      tx.done,
    ]);
  } catch (error) {
    if (isQuotaError(error)) throw new StorageFullError();
    throw error;
  }
  if (isFirstBook) void navigator.storage?.persist?.().catch(() => false);
  return { book, duplicate: false };
}

export async function listBooks(): Promise<BookRecord[]> {
  return (await db()).getAll("books");
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  return (await db()).get("books", id);
}

export async function getFile(id: string): Promise<Blob | undefined> {
  return (await db()).get("files", id);
}

/** Read-modify-write of one book in a single transaction; no-op if it was removed. */
async function patchBook(id: string, patch: (book: BookRecord) => Partial<BookRecord>): Promise<void> {
  const tx = (await db()).transaction("books", "readwrite");
  const book = await tx.store.get(id);
  if (book) await tx.store.put({ ...book, ...patch(book) });
  await tx.done;
}

/** Saves the reading position. Reaching the end marks the book finished. */
export function savePosition(
  id: string,
  position: Location,
  progress: number,
  reachedEnd: boolean,
): Promise<void> {
  return patchBook(id, (book) => ({
    position,
    progress: Math.min(1, Math.max(0, progress)),
    finished: book.finished || reachedEnd,
  }));
}

export function markOpened(id: string): Promise<void> {
  return patchBook(id, () => ({ openedAt: Date.now() }));
}

export function setFinished(id: string, finished: boolean): Promise<void> {
  return patchBook(id, () => ({ finished }));
}

export function savePdfZoom(id: string, pdfZoom: PdfZoom): Promise<void> {
  return patchBook(id, () => ({ pdfZoom }));
}

/** Deletes the book, its file and its bookmarks atomically. */
export async function removeBook(id: string): Promise<void> {
  const tx = (await db()).transaction(["books", "files", "bookmarks"], "readwrite");
  const bookmarks = tx.objectStore("bookmarks");
  const bookmarkIds = await bookmarks.index("byBook").getAllKeys(id);
  await Promise.all([
    tx.objectStore("books").delete(id),
    tx.objectStore("files").delete(id),
    ...bookmarkIds.map((key) => bookmarks.delete(key)),
    tx.done,
  ]);
}

export async function listBookmarks(bookId: string): Promise<Bookmark[]> {
  const all = await (await db()).getAllFromIndex("bookmarks", "byBook", bookId);
  return all.sort((a, b) => compareLocations(a.location, b.location) || a.createdAt - b.createdAt);
}

export async function addBookmark(input: Omit<Bookmark, "id" | "createdAt">): Promise<Bookmark> {
  const bookmark: Bookmark = { ...input, id: crypto.randomUUID(), createdAt: Date.now() };
  try {
    await (await db()).put("bookmarks", bookmark);
  } catch (error) {
    if (isQuotaError(error)) throw new StorageFullError();
    throw error;
  }
  return bookmark;
}

export async function deleteBookmark(id: string): Promise<void> {
  await (await db()).delete("bookmarks", id);
}
