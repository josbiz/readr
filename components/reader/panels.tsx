"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Bookmark, PdfZoom } from "@/lib/db";
import type { TocEntry } from "@/lib/formats";
import { useI18n } from "@/lib/i18n";
import type { Location } from "@/lib/location";
import { FONT_MAX, FONT_MIN, FONT_STEP, updateSettings, type LayoutMode } from "@/lib/settings";
import { useSettings } from "@/lib/use-settings";
import { CloseIcon, MinusIcon, PlusIcon, TrashIcon } from "../icons";
import { AppearanceControls, IconButton, Segmented } from "../ui";

export type PanelName = "contents" | "bookmarks" | "display";

/**
 * Panels live in browser history, so the back button (Android's included)
 * closes an open panel before it leaves the reader.
 */
export function usePanelHistory() {
  const [panel, setPanel] = useState<PanelName | null>(null);

  useEffect(() => {
    const stateOf = () => (history.state as { readrPanel?: PanelName } | null)?.readrPanel ?? null;
    // A reload can restore an entry that still names a panel; start closed.
    if (stateOf()) {
      const rest = { ...history.state };
      delete rest.readrPanel;
      history.replaceState(rest, "");
    }
    const onPop = () => setPanel(stateOf());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = useCallback((name: PanelName) => {
    const state = { ...history.state, readrPanel: name };
    if ((history.state as { readrPanel?: string } | null)?.readrPanel) history.replaceState(state, "");
    else history.pushState(state, "");
    setPanel(name);
  }, []);

  const close = useCallback(() => {
    if ((history.state as { readrPanel?: string } | null)?.readrPanel) history.back();
    else setPanel(null);
  }, []);

  return { panel, open, close };
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => previous?.focus?.();
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-panel
        className="fixed inset-y-0 right-0 z-40 flex w-[min(24rem,100vw)] flex-col border-l border-line bg-chrome pt-[env(safe-area-inset-top)] text-ink shadow-2xl outline-none"
      >
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <h2 id={titleId} className="flex-1 font-serif text-lg">
            {title}
          </h2>
          <IconButton label={t("common.close")} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">{children}</div>
      </div>
    </>
  );
}

function TocList({ entries, depth, onSelect }: { entries: TocEntry[]; depth: number; onSelect: (loc: Location) => void }) {
  return (
    <ul>
      {entries.map((entry, i) => (
        <li key={`${depth}-${i}`}>
          <button
            type="button"
            onClick={() => onSelect(entry.location)}
            className="block w-full py-2.5 pr-5 text-left text-sm leading-snug hover:bg-line focus-visible:bg-line focus-visible:outline-none"
            style={{ paddingLeft: `${1.25 + depth}rem` }}
          >
            {entry.label}
          </button>
          {entry.children.length > 0 && <TocList entries={entry.children} depth={depth + 1} onSelect={onSelect} />}
        </li>
      ))}
    </ul>
  );
}

export function ContentsPanel({ toc, onSelect, onClose }: { toc: TocEntry[]; onSelect: (loc: Location) => void; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Panel title={t("reader.contents")} onClose={onClose}>
      {toc.length ? (
        <nav aria-label={t("reader.contents")} className="py-2">
          <TocList entries={toc} depth={0} onSelect={onSelect} />
        </nav>
      ) : (
        <p className="p-5 text-sm text-muted">{t("reader.noContents")}</p>
      )}
    </Panel>
  );
}

export function BookmarksPanel({
  bookmarks,
  onSelect,
  onDelete,
  onClose,
}: {
  bookmarks: Bookmark[];
  onSelect: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onClose: () => void;
}) {
  const { t, percent, date } = useI18n();
  return (
    <Panel title={t("reader.bookmarks")} onClose={onClose}>
      {bookmarks.length ? (
        <ul className="divide-y divide-line">
          {bookmarks.map((b) => (
            <li key={b.id} className="flex items-start gap-1 pr-2">
              <button
                type="button"
                onClick={() => onSelect(b)}
                className="flex min-w-0 flex-1 flex-col gap-1 py-3 pl-5 text-left hover:bg-line/50 focus-visible:bg-line/50 focus-visible:outline-none"
              >
                <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                  {b.label.chapter && <span className="font-medium text-ink">{b.label.chapter}</span>}
                  <span>{b.label.page ? t("reader.bookmarkPage", { page: b.label.page }) : percent(b.label.percent)}</span>
                </span>
                {b.label.excerpt && <span className="line-clamp-3 font-serif text-sm leading-snug">{b.label.excerpt}</span>}
                <span className="text-xs text-muted">{t("reader.bookmarkAdded", { date: date(b.createdAt) })}</span>
              </button>
              <IconButton label={t("reader.deleteBookmark")} className="mt-2 text-muted" onClick={() => onDelete(b)}>
                <TrashIcon width={18} height={18} />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-5 text-sm leading-relaxed text-muted">{t("reader.noBookmarks")}</p>
      )}
    </Panel>
  );
}

function Stepper({
  label,
  value,
  decrease,
  increase,
  onDecrease,
  onIncrease,
  canDecrease,
  canIncrease,
}: {
  label: string;
  value: string;
  decrease: string;
  increase: string;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease: boolean;
  canIncrease: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium tracking-wider text-muted uppercase">{label}</div>
      <div className="flex items-center gap-2 rounded-xl bg-line/60 p-1">
        <IconButton label={decrease} onClick={onDecrease} disabled={!canDecrease}>
          <MinusIcon />
        </IconButton>
        <output className="flex-1 text-center text-sm tabular-nums" aria-live="polite">
          {value}
        </output>
        <IconButton label={increase} onClick={onIncrease} disabled={!canIncrease}>
          <PlusIcon />
        </IconButton>
      </div>
    </div>
  );
}

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;

export function DisplayPanel({
  format,
  zoom,
  zoomFactor,
  onZoom,
  onZoomStep,
  onClose,
}: {
  format: "pdf" | "epub";
  zoom: PdfZoom;
  zoomFactor: number;
  onZoom: (zoom: PdfZoom) => void;
  onZoomStep: (direction: 1 | -1) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { layout, fontSize, pdfOriginalColors } = useSettings();
  const layouts: { value: LayoutMode; label: string }[] = [
    { value: "auto", label: t("reader.layoutAuto") },
    { value: "single", label: t("reader.layoutSingle") },
    { value: "spread", label: t("reader.layoutSpread") },
    { value: "scroll", label: t("reader.layoutScroll") },
  ];
  return (
    <Panel title={t("reader.display")} onClose={onClose}>
      <div className="flex flex-col gap-6 p-5">
        <Segmented label={t("reader.layout")} value={layout} options={layouts} onChange={(v) => updateSettings({ layout: v })} />

        {format === "epub" ? (
          <Stepper
            label={t("reader.textSize")}
            value={`${fontSize}%`}
            decrease={t("reader.textSmaller")}
            increase={t("reader.textLarger")}
            canDecrease={fontSize > FONT_MIN}
            canIncrease={fontSize < FONT_MAX}
            onDecrease={() => updateSettings({ fontSize: Math.max(FONT_MIN, fontSize - FONT_STEP) })}
            onIncrease={() => updateSettings({ fontSize: Math.min(FONT_MAX, fontSize + FONT_STEP) })}
          />
        ) : (
          <>
            <Stepper
              label={t("reader.zoom")}
              value={`${Math.round(zoomFactor * 100)}%`}
              decrease={t("reader.zoomOut")}
              increase={t("reader.zoomIn")}
              canDecrease={zoomFactor > ZOOM_MIN + 1e-6}
              canIncrease={zoomFactor < ZOOM_MAX - 1e-6}
              onDecrease={() => onZoomStep(-1)}
              onIncrease={() => onZoomStep(1)}
            />
            <div className="-mt-3 flex gap-2">
              {(["page", "width"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={zoom.mode === mode}
                  onClick={() => onZoom({ mode })}
                  className="h-9 flex-1 rounded-lg border border-line text-sm aria-pressed:border-accent aria-pressed:text-accent"
                >
                  {t(mode === "page" ? "reader.fitPage" : "reader.fitWidth")}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
              {t("reader.originalColors")}
              <input
                type="checkbox"
                role="switch"
                checked={pdfOriginalColors}
                onChange={(e) => updateSettings({ pdfOriginalColors: e.target.checked })}
                className="size-5 accent-[var(--accent)]"
              />
            </label>
          </>
        )}

        <AppearanceControls />
      </div>
    </Panel>
  );
}
