"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { BookRecord } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { MoreIcon } from "../icons";
import { Cover } from "./cover";

interface EntryProps {
  book: BookRecord;
  view: "grid" | "list";
  onToggleFinished: (book: BookRecord) => void;
  onRemove: (book: BookRecord) => void;
}

/**
 * Library and reader link with plain anchors: full document navigations are
 * served by the service worker offline, while client-side transitions would
 * need a network fetch.
 */
export const readerHref = (id: string) => `/read?book=${encodeURIComponent(id)}`;

function EntryMenu({ book, onToggleFinished, onRemove }: Omit<EntryProps, "view">) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      items[(index + delta + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const choose = (action: () => void) => {
    close();
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("library.options", { title: book.title })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-line hover:text-ink"
      >
        <MoreIcon />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          onKeyDown={onMenuKey}
          className="absolute right-0 bottom-full z-20 mb-1 min-w-52 overflow-hidden rounded-xl border border-line bg-chrome py-1 shadow-xl"
        >
          <button
            role="menuitem"
            type="button"
            className="block w-full px-4 py-2.5 text-left text-sm hover:bg-line focus:bg-line focus:outline-none"
            onClick={() => choose(() => onToggleFinished(book))}
          >
            {book.finished ? t("library.markUnfinished") : t("library.markFinished")}
          </button>
          <button
            role="menuitem"
            type="button"
            className="block w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-line focus:bg-line focus:outline-none dark:text-red-400"
            onClick={() => choose(() => onRemove(book))}
          >
            {t("library.remove")}
          </button>
        </div>
      )}
    </div>
  );
}

function Meta({ book }: { book: BookRecord }) {
  const { t, percent } = useI18n();
  const started = book.progress > 0;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span className="rounded border border-line px-1.5 py-px text-[0.65rem] font-medium tracking-wider">
        {t(book.format === "pdf" ? "format.pdf" : "format.epub")}
      </span>
      {book.finished ? (
        <span className="rounded bg-accent/15 px-1.5 py-px font-medium text-accent">{t("library.finished")}</span>
      ) : (
        <span>{started ? t("library.progress", { percent: percent(book.progress) }) : t("library.notStarted")}</span>
      )}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-0.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
      <div className="h-full bg-accent" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function BookEntry({ book, view, onToggleFinished, onRemove }: EntryProps) {
  const progress = book.finished ? 1 : book.progress;
  if (view === "list") {
    return (
      <li className="flex items-center gap-4 border-b border-line py-3 last:border-b-0">
        <a
          href={readerHref(book.id)}
          className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline-offset-4"
        >
          <div className="@container h-16 w-11 shrink-0 overflow-hidden rounded-sm shadow-md">
            <Cover book={book} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-serif text-base text-ink">{book.title}</span>
            {book.author && <span className="truncate text-sm text-muted">{book.author}</span>}
            <Meta book={book} />
          </div>
        </a>
        <EntryMenu book={book} onToggleFinished={onToggleFinished} onRemove={onRemove} />
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2">
      <a
        href={readerHref(book.id)}
        className="group @container block aspect-[2/3] overflow-hidden rounded-md shadow-[0_6px_20px_-8px_var(--shade)] transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-offset-4"
        aria-label={book.author ? `${book.title}, ${book.author}` : book.title}
      >
        <Cover book={book} />
      </a>
      <ProgressBar value={progress} />
      <div className="flex items-start gap-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 font-serif text-sm leading-snug text-ink">{book.title}</span>
          {book.author && <span className="truncate text-xs text-muted">{book.author}</span>}
          <Meta book={book} />
        </div>
        <EntryMenu book={book} onToggleFinished={onToggleFinished} onRemove={onRemove} />
      </div>
    </li>
  );
}
