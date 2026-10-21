"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  importBook,
  listBooks,
  removeBook,
  setFinished,
  StorageFullError,
  type BookRecord,
} from "@/lib/db";
import { BookError, parseBook } from "@/lib/formats";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { sortBooks } from "@/lib/library-sort";
import { updateSettings, type LibrarySort } from "@/lib/settings";
import { useSettings } from "@/lib/use-settings";
import { CloseIcon, GridIcon, ListIcon, PlusIcon, SettingsIcon } from "../icons";
import { AppearanceControls, IconButton, Segmented } from "../ui";
import { BookEntry } from "./book-entry";

interface Notice {
  id: number;
  key: MessageKey;
  name: string;
  tone: "progress" | "ok" | "error";
}

const ACCEPT = ".pdf,.epub,application/pdf,application/epub+zip";

function errorKey(error: unknown): MessageKey {
  if (error instanceof StorageFullError) return "import.storageFull";
  if (error instanceof BookError && error.kind === "unsupported") return "import.unsupported";
  return "import.unreadable";
}

export function Library() {
  const { t, locale } = useI18n();
  const { librarySort, libraryView } = useSettings();
  const [books, setBooks] = useState<BookRecord[] | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<BookRecord | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const removeDialog = useRef<HTMLDialogElement>(null);
  const noticeId = useRef(0);

  const refresh = useCallback(async () => setBooks(await listBooks()), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from IndexedDB on mount
    void refresh();
    // Returning from the reader via the back button may restore this page from
    // the back/forward cache, so reload progress and ordering then too.
    const onShow = (e: PageTransitionEvent) => e.persisted && void refresh();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [refresh]);

  const sorted = useMemo(() => (books ? sortBooks(books, librarySort, locale) : []), [books, librarySort, locale]);

  const notify = useCallback((key: MessageKey, name: string, tone: Notice["tone"], replace?: number) => {
    const id = replace ?? ++noticeId.current;
    setNotices((list) => [...list.filter((n) => n.id !== id), { id, key, name, tone }]);
    if (tone === "ok") setTimeout(() => setNotices((list) => list.filter((n) => n.id !== id)), 4000);
    return id;
  }, []);

  const importFiles = useCallback(
    async (files: Iterable<File>) => {
      for (const file of files) {
        const id = notify("import.adding", file.name, "progress");
        try {
          const { duplicate } = await importBook(file, parseBook);
          notify(duplicate ? "import.duplicate" : "import.added", file.name, "ok", id);
        } catch (error) {
          notify(errorKey(error), file.name, "error", id);
        }
        await refresh();
      }
    },
    [notify, refresh],
  );

  // Drop files anywhere on the page.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      void importFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [importFiles]);

  const toggleFinished = async (book: BookRecord) => {
    await setFinished(book.id, !book.finished);
    await refresh();
  };

  const askRemove = (book: BookRecord) => {
    setPendingRemove(book);
    removeDialog.current?.showModal();
  };

  const confirmRemove = async () => {
    const book = pendingRemove;
    removeDialog.current?.close();
    if (!book) return;
    await removeBook(book.id);
    await refresh();
  };

  const sortOptions: { value: LibrarySort; key: MessageKey }[] = [
    { value: "recent", key: "library.sortRecent" },
    { value: "title", key: "library.sortTitle" },
    { value: "author", key: "library.sortAuthor" },
    { value: "progress", key: "library.sortProgress" },
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-16 sm:px-8">
      <header className="flex items-center gap-2 py-4 sm:py-6">
        <h1 className="flex-1 font-serif text-3xl tracking-tight text-ink sm:text-4xl">
          readr <span className="sr-only">— {t("library.title")}</span>
        </h1>
        <IconButton label={t("settings.title")} onClick={() => settingsDialog.current?.showModal()}>
          <SettingsIcon />
        </IconButton>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-paper transition-opacity hover:opacity-85"
        >
          <PlusIcon width={18} height={18} />
          <span>{t("library.add")}</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void importFiles(files);
          }}
        />
      </header>

      {books && books.length > 0 && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <label className="flex flex-col gap-1 text-xs font-medium tracking-wider text-muted uppercase">
            {t("library.sort")}
            <select
              value={librarySort}
              onChange={(e) => updateSettings({ librarySort: e.target.value as LibrarySort })}
              className="h-9 rounded-lg border border-line bg-chrome px-2 text-sm font-normal tracking-normal text-ink normal-case"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.key)}
                </option>
              ))}
            </select>
          </label>
          <div className="w-28">
            <Segmented
              label={t("library.view")}
              value={libraryView}
              onChange={(value) => updateSettings({ libraryView: value })}
              options={[
                { value: "grid", label: t("library.viewGrid"), icon: <GridIcon width={18} height={18} /> },
                { value: "list", label: t("library.viewList"), icon: <ListIcon width={18} height={18} /> },
              ]}
            />
          </div>
        </div>
      )}

      <main className="flex-1">
        {books === null ? null : books.length === 0 ? (
          <section className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 text-center">
            <div className="mb-2 flex h-28 w-20 items-center justify-center rounded-md border-2 border-dashed border-line text-muted">
              <PlusIcon />
            </div>
            <h2 className="font-serif text-2xl text-ink">{t("library.emptyTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted">{t("library.emptyBody")}</p>
          </section>
        ) : libraryView === "grid" ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-5 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] sm:gap-x-8">
            {sorted.map((book) => (
              <BookEntry key={book.id} book={book} view="grid" onToggleFinished={toggleFinished} onRemove={askRemove} />
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col">
            {sorted.map((book) => (
              <BookEntry key={book.id} book={book} view="list" onToggleFinished={toggleFinished} onRemove={askRemove} />
            ))}
          </ul>
        )}
      </main>

      <ul aria-live="polite" className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md flex-col gap-2">
        {notices.map((n) => (
          <li
            key={n.id}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
              n.tone === "error" ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100" : "border-line bg-chrome text-ink"
            }`}
          >
            <span className="flex-1">{t(n.key, { name: n.name })}</span>
            {n.tone !== "progress" && (
              <button
                type="button"
                aria-label={t("common.dismiss")}
                onClick={() => setNotices((list) => list.filter((x) => x.id !== n.id))}
                className="rounded-full p-1 opacity-70 hover:opacity-100"
              >
                <CloseIcon width={16} height={16} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-bg/80 p-6 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-accent px-10 py-16 text-center font-serif text-xl text-ink">
            {t("library.dropHint")}
          </div>
        </div>
      )}

      <dialog
        ref={settingsDialog}
        aria-labelledby="settings-title"
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-chrome p-6 text-ink shadow-2xl backdrop:bg-black/40"
        onClick={(e) => e.target === e.currentTarget && settingsDialog.current?.close()}
      >
        <div className="mb-5 flex items-center">
          <h2 id="settings-title" className="flex-1 font-serif text-xl">
            {t("settings.title")}
          </h2>
          <IconButton label={t("common.close")} onClick={() => settingsDialog.current?.close()}>
            <CloseIcon />
          </IconButton>
        </div>
        <AppearanceControls />
      </dialog>

      <dialog
        ref={removeDialog}
        aria-labelledby="remove-title"
        aria-describedby="remove-body"
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-chrome p-6 text-ink shadow-2xl backdrop:bg-black/40"
        onClose={() => setPendingRemove(null)}
      >
        <h2 id="remove-title" className="font-serif text-xl">
          {t("library.removeTitle", { title: pendingRemove?.title ?? "" })}
        </h2>
        <p id="remove-body" className="mt-2 text-sm leading-relaxed text-muted">
          {t("library.removeBody")}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => removeDialog.current?.close()}
            className="h-10 rounded-full px-4 text-sm hover:bg-line"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void confirmRemove()}
            className="h-10 rounded-full bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800"
          >
            {t("common.remove")}
          </button>
        </div>
      </dialog>
    </div>
  );
}
