"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addBookmark,
  deleteBookmark,
  getBook,
  getFile,
  listBookmarks,
  markOpened,
  savePdfZoom,
  savePosition,
  type Bookmark,
  type BookRecord,
  type PdfZoom,
} from "@/lib/db";
import { openSource, type Box, type PageSource, type PdfSource } from "@/lib/formats";
import { useI18n } from "@/lib/i18n";
import type { Location } from "@/lib/location";
import { useSettings } from "@/lib/use-settings";
import { buildViews, primaryPage, resolveLayout, viewIndexOfPage, type Resolved } from "@/lib/views";
import {
  BackIcon,
  BookmarkIcon,
  BookmarksIcon,
  CompressIcon,
  ContentsIcon,
  ExpandIcon,
  NextIcon,
  TypeIcon,
} from "../icons";
import { IconButton, Splash } from "../ui";
import { BookmarksPanel, ContentsPanel, DisplayPanel, usePanelHistory, ZOOM_MAX, ZOOM_MIN } from "./panels";
import { ScrollView } from "./scroll-view";
import { Stage, type StageHandle } from "./stage";

type Status = "loading" | "ready" | "notfound" | "failed";

/** Matches the stage's padding around the pages. */
const AREA_PAD = 12;
const MAX_EPUB_PAGE_WIDTH = 760;
const CHROME_HIDE_MS = 3500;
const EDGE_PX = 80;

function computeBox(area: Box, layout: Resolved, format: "pdf" | "epub", aspect: number) {
  const width = Math.max(160, area.width - 2 * AREA_PAD);
  const height = Math.max(160, area.height - 2 * AREA_PAD);
  const perPage = layout === "spread" ? width / 2 : width;
  if (format === "epub") {
    const pageWidth = Math.min(perPage, Math.max(320, Math.min(MAX_EPUB_PAGE_WIDTH, height * 0.75)));
    return { box: { width: Math.floor(pageWidth), height: Math.floor(height) }, fitWidth: 1 };
  }
  const pageWidth = layout === "scroll" ? Math.min(width, 1000) : Math.min(perPage, height * aspect);
  const box = { width: Math.floor(pageWidth), height: Math.floor(pageWidth / aspect) };
  return { box, fitWidth: perPage / box.width };
}

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

function useFullscreen(target: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // Only known in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(document.fullscreenEnabled);
    const onChange = () => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void target.current?.requestFullscreen().catch(() => {});
  }, [target]);
  return { active, supported, toggle };
}

export function Reader({ bookId }: { bookId: string }) {
  const { t, percent } = useI18n();
  const { layout, fontSize, pdfOriginalColors } = useSettings();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageHandle>(null);

  const [status, setStatus] = useState<Status>("loading");
  const [book, setBook] = useState<BookRecord | null>(null);
  const [source, setSource] = useState<PageSource | null>(null);
  const [area, setArea] = useState<Box | null>(null);
  const [version, setVersion] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [page, setPage] = useState(0);
  const [scrollAtEnd, setScrollAtEnd] = useState(false);
  const [jumpToken, setJumpToken] = useState(0);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [zoom, setZoom] = useState<PdfZoom>({ mode: "page" });
  const [aspect, setAspect] = useState(0.75);
  const [chrome, setChrome] = useState(true);
  /** The reading position; pages are re-derived from it after every re-pagination. */
  const anchor = useRef<Location | null>(null);

  const { panel, open: openPanel, close: closePanel } = usePanelHistory();
  const fullscreen = useFullscreen(rootRef);

  // Open the book.
  useEffect(() => {
    let cancelled = false;
    let opened: PageSource | null = null;
    void (async () => {
      const [record, file] = await Promise.all([getBook(bookId), getFile(bookId)]);
      if (cancelled) return;
      if (!record || !file) return setStatus("notfound");
      try {
        opened = await openSource(record.format, file);
      } catch {
        if (!cancelled) setStatus("failed");
        return;
      }
      if (cancelled) return opened.destroy();
      anchor.current = record.position ?? null;
      setBook(record);
      setZoom(record.pdfZoom ?? { mode: "page" });
      setBookmarks(await listBookmarks(bookId));
      setSource(opened);
      setStatus("ready");
      document.title = `${record.title} · readr`;
      void markOpened(bookId);
    })();
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [bookId]);

  // Track the reading area. Re-pagination is debounced while resizing.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let timer = 0;
    const measure = () => setArea({ width: Math.round(el.clientWidth), height: Math.round(el.clientHeight) });
    measure();
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(measure, 150);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const format = source?.format ?? "epub";
  const resolved: Resolved = area ? resolveLayout(layout, area) : "single";
  const { box, fitWidth } = area ? computeBox(area, resolved, format, aspect) : { box: null, fitWidth: 1 };
  const layoutFont = format === "epub" ? fontSize : 100;

  // Paginate whenever the page box or font size changes, keeping the position.
  useEffect(() => {
    if (!source || !box) return;
    let stale = false;
    void (async () => {
      if (source.format === "epub") setPreparing(true);
      await source.layout(box, layoutFont);
      if (stale) return;
      setPage(anchor.current ? source.pageOf(anchor.current) : 0);
      setVersion((v) => v + 1);
      setJumpToken((j) => j + 1);
      setPreparing(false);
    })();
    return () => {
      stale = true;
    };
    // `box` is a fresh object each render; its size is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, box?.width, box?.height, layoutFont]);

  const views = useMemo(
    () => (source && version ? buildViews(source.pageCount, resolved === "scroll" ? "single" : resolved) : []),
    [source, version, resolved],
  );
  const viewIndex = viewIndexOfPage(views, page);
  const visible = resolved === "scroll" ? [page] : (views[viewIndex] ?? [page]).filter((p): p is number => p !== null);
  const currentPage = resolved === "scroll" ? page : primaryPage(views[viewIndex] ?? [page]);
  const atEnd = resolved === "scroll" ? scrollAtEnd : views.length > 0 && viewIndex === views.length - 1;

  // PDF page boxes follow the current page's shape (a fixed one while scrolling).
  const aspectPage = resolved === "scroll" ? 0 : currentPage;
  useEffect(() => {
    if (source?.format !== "pdf") return;
    let ok = true;
    void (source as PdfSource).aspectOf(aspectPage).then((a) => ok && setAspect(a));
    return () => {
      ok = false;
    };
  }, [source, aspectPage]);

  const goToPage = useCallback(
    (index: number) => {
      if (!source) return;
      anchor.current = source.locationOf(index);
      setPage(index);
    },
    [source],
  );
  const jumpTo = (location: Location) => {
    if (!source) return;
    goToPage(source.pageOf(location));
    setJumpToken((j) => j + 1);
  };
  const onViewChange = useCallback((index: number) => views[index] && goToPage(primaryPage(views[index])), [views, goToPage]);
  const onScrollPage = useCallback(
    (index: number, end: boolean) => {
      setScrollAtEnd(end);
      setPage((current) => {
        if (current !== index && source) anchor.current = source.locationOf(index);
        return index;
      });
    },
    [source],
  );

  // Save the position shortly after it changes, and immediately when leaving.
  const pendingSave = useRef<(() => void) | null>(null);
  const flushSave = useCallback(() => {
    const save = pendingSave.current;
    pendingSave.current = null;
    save?.();
  }, []);
  useEffect(() => {
    if (!source || !book || !version) return;
    const location = source.locationOf(currentPage);
    const progress = atEnd ? 1 : source.percentOf(currentPage);
    pendingSave.current = () => void savePosition(book.id, location, progress, atEnd);
    const timer = setTimeout(flushSave, 500);
    return () => clearTimeout(timer);
  }, [source, book, version, currentPage, atEnd, flushSave]);
  useEffect(() => {
    window.addEventListener("pagehide", flushSave);
    return () => {
      window.removeEventListener("pagehide", flushSave);
      flushSave();
    };
  }, [flushSave]);

  // PDF zoom, relative to "fit page".
  const isPdf = format === "pdf";
  const zoomFactor = !isPdf
    ? 1
    : zoom.mode === "page"
      ? 1
      : zoom.mode === "width"
        ? fitWidth
        : zoom.value / 100;
  const scaledBox = box && { width: Math.round(box.width * zoomFactor), height: Math.round(box.height * zoomFactor) };
  const applyZoom = useCallback(
    (next: PdfZoom) => {
      setZoom(next);
      if (book) void savePdfZoom(book.id, next);
    },
    [book],
  );
  const stepZoom = (direction: 1 | -1) => {
    const steps = zoomFactor * 4;
    const next = direction > 0 ? Math.floor(steps + 1e-6) + 1 : Math.ceil(steps - 1e-6) - 1;
    applyZoom({ mode: "custom", value: Math.round(clampZoom(next / 4) * 100) });
  };
  const onPinch = (scale: number) => applyZoom({ mode: "custom", value: Math.round(clampZoom(zoomFactor * scale) * 100) });
  const canPan =
    !!area &&
    !!scaledBox &&
    zoomFactor > 1.001 &&
    (scaledBox.width * (resolved === "spread" ? 2 : 1) > area.width - 2 * AREA_PAD + 1 ||
      scaledBox.height > area.height - 2 * AREA_PAD + 1);

  // Bookmarks. In a spread, the bookmark applies to the left-hand page.
  const bookmarkedPages = useMemo(
    () => new Set(source && version ? bookmarks.map((b) => source.pageOf(b.location)) : []),
    [bookmarks, source, version],
  );
  const currentBookmark = source ? bookmarks.find((b) => visible.includes(source.pageOf(b.location))) : undefined;
  const toggleBookmark = async () => {
    if (!source || !book) return;
    if (currentBookmark) {
      await deleteBookmark(currentBookmark.id);
    } else {
      await addBookmark({
        bookId: book.id,
        location: source.locationOf(currentPage),
        label: {
          chapter: source.chapterOf(currentPage),
          page: source.format === "pdf" ? currentPage + 1 : undefined,
          percent: source.percentOf(currentPage),
          excerpt: await source.excerptOf(currentPage),
        },
      });
    }
    setBookmarks(await listBookmarks(book.id));
  };
  const removeBookmark = async (bookmark: Bookmark) => {
    await deleteBookmark(bookmark.id);
    setBookmarks(await listBookmarks(bookId));
  };

  // Reader chrome: hidden while reading, shown on demand.
  const hideTimer = useRef(0);
  const chromeHasFocus = useRef(false);
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => !chromeHasFocus.current && setChrome(false), CHROME_HIDE_MS);
  }, []);
  const showChrome = useCallback(() => {
    setChrome(true);
    scheduleHide();
  }, [scheduleHide]);
  const toggleChrome = useCallback(() => {
    setChrome((visibleNow) => {
      if (!visibleNow) scheduleHide();
      return !visibleNow;
    });
  }, [scheduleHide]);
  useEffect(() => {
    scheduleHide();
    return () => clearTimeout(hideTimer.current);
  }, [scheduleHide]);
  const chromeVisible = chrome || panel !== null;
  const chromeFocusProps = {
    onFocus: () => {
      chromeHasFocus.current = true;
      setChrome(true);
    },
    onBlur: () => {
      chromeHasFocus.current = false;
      scheduleHide();
    },
  };

  const turn = (delta: number) => stageRef.current?.turn(delta);

  const goLibrary = () => {
    flushSave();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    let fromLibrary = false;
    try {
      const referrer = new URL(document.referrer);
      fromLibrary = referrer.origin === location.origin && referrer.pathname === "/";
    } catch {
      fromLibrary = false;
    }
    if (fromLibrary && history.length > 1) history.go(panel ? -2 : -1);
    // A document navigation (not a client transition) so the service worker can serve it offline.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    else location.assign("/");
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || !source) return;
      if (panel) {
        if (e.key === "Escape") {
          e.preventDefault();
          closePanel();
        }
        return;
      }
      if (e.ctrlKey) {
        if (isPdf && (e.key === "=" || e.key === "+")) {
          e.preventDefault();
          stepZoom(1);
        } else if (isPdf && e.key === "-") {
          e.preventDefault();
          stepZoom(-1);
        }
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest("input, select, textarea, [contenteditable='true']")) return;
      const paged = resolved !== "scroll";
      const onControl = target.closest("button, a") !== null;
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
          if (paged) {
            e.preventDefault();
            turn(1);
          }
          break;
        case "ArrowLeft":
        case "PageUp":
          if (paged) {
            e.preventDefault();
            turn(-1);
          }
          break;
        case " ":
          if (paged && !onControl) {
            e.preventDefault();
            turn(e.shiftKey ? -1 : 1);
          }
          break;
        case "b":
        case "B":
          e.preventDefault();
          void toggleBookmark();
          break;
        case "f":
        case "F":
          if (fullscreen.supported) {
            e.preventDefault();
            fullscreen.toggle();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (status !== "ready" || !source || !book) {
    return (
      <div ref={rootRef} className="fixed inset-0 bg-bg">
        {status === "loading" ? (
          <Splash label={t("reader.loading")} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="font-serif text-xl text-ink">{t(status === "notfound" ? "reader.notFound" : "reader.failed")}</p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- document navigation works offline */}
            <a href="/" className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper">
              {t("reader.library")}
            </a>
          </div>
        )}
      </div>
    );
  }

  const chapter = source.chapterOf(currentPage);
  const progress = atEnd ? 1 : source.percentOf(currentPage);
  const barClass = `pointer-events-none absolute inset-x-0 z-20 transition-[opacity,translate] duration-300 ${
    chromeVisible ? "opacity-100 translate-y-0" : "opacity-0"
  }`;

  return (
    <div
      ref={rootRef}
      className={`reader fixed inset-0 overflow-hidden bg-bg text-ink ${pdfOriginalColors ? "original-colors" : ""}`}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !area) return;
        if (e.clientY < EDGE_PX || e.clientY > area.height - EDGE_PX) showChrome();
      }}
    >
      <main aria-label={book.title} className="absolute inset-0">
        {version > 0 && scaledBox && (resolved === "scroll" ? (
          <ScrollView
            source={source}
            pageCount={source.pageCount}
            box={scaledBox}
            version={version}
            page={page}
            jumpToken={jumpToken}
            bookmarked={bookmarkedPages}
            onPageChange={onScrollPage}
            onCenterTap={toggleChrome}
          />
        ) : (
          <Stage
            ref={stageRef}
            source={source}
            views={views}
            viewIndex={viewIndex}
            box={scaledBox}
            spread={resolved === "spread"}
            version={version}
            bookmarked={bookmarkedPages}
            canPan={canPan}
            onViewChange={onViewChange}
            onCenterTap={toggleChrome}
            onPinch={isPdf ? onPinch : undefined}
          />
        ))}
      </main>

      {preparing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/70 backdrop-blur-[2px]" role="status">
          <span className="font-serif text-muted">{t("reader.preparing")}</span>
        </div>
      )}

      <header className={`${barClass} top-0 -translate-y-0`} {...chromeFocusProps}>
        <div
          className={`flex items-center gap-1 border-b border-line bg-chrome/95 px-2 pt-[max(0.25rem,env(safe-area-inset-top))] pb-1 backdrop-blur ${
            chromeVisible ? "pointer-events-auto" : ""
          }`}
        >
          <button
            type="button"
            onClick={goLibrary}
            className="inline-flex h-10 items-center gap-1 rounded-full pr-3 pl-2 text-sm hover:bg-line"
          >
            <BackIcon />
            <span className="hidden sm:inline">{t("reader.library")}</span>
            <span className="sr-only sm:hidden">{t("reader.library")}</span>
          </button>
          <h1 className="min-w-0 flex-1 truncate px-2 text-center font-serif text-sm text-muted">{book.title}</h1>
          <IconButton label={t("reader.contents")} onClick={() => openPanel("contents")}>
            <ContentsIcon />
          </IconButton>
          <IconButton label={t("reader.bookmarks")} onClick={() => openPanel("bookmarks")}>
            <BookmarksIcon />
          </IconButton>
          <IconButton
            label={currentBookmark ? t("reader.removeBookmark") : t("reader.addBookmark")}
            pressed={Boolean(currentBookmark)}
            onClick={() => void toggleBookmark()}
            className={currentBookmark ? "text-accent" : ""}
          >
            <BookmarkIcon filled={Boolean(currentBookmark)} />
          </IconButton>
          <IconButton label={t("reader.display")} onClick={() => openPanel("display")}>
            <TypeIcon />
          </IconButton>
          {fullscreen.supported && (
            <IconButton label={fullscreen.active ? t("reader.exitFullscreen") : t("reader.fullscreen")} onClick={fullscreen.toggle}>
              {fullscreen.active ? <CompressIcon /> : <ExpandIcon />}
            </IconButton>
          )}
        </div>
      </header>

      <footer className={`${barClass} bottom-0`} {...chromeFocusProps}>
        <div
          className={`flex items-center gap-2 border-t border-line bg-chrome/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur ${
            chromeVisible ? "pointer-events-auto" : ""
          }`}
        >
          {resolved !== "scroll" && (
            <IconButton label={t("reader.previous")} onClick={() => turn(-1)} disabled={viewIndex === 0}>
              <BackIcon />
            </IconButton>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-2 py-1">
            <div className="flex items-baseline gap-3 text-xs text-muted">
              <span className="min-w-0 flex-1 truncate">{chapter ?? ""}</span>
              <span className="shrink-0 tabular-nums">
                {t("reader.pageOf", { page: currentPage + 1, total: source.pageCount })} · {percent(progress)}
              </span>
            </div>
            <div
              className="h-1 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label={t("reader.pageOf", { page: currentPage + 1, total: source.pageCount })}
            >
              <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
          {resolved !== "scroll" && (
            <IconButton label={t("reader.next")} onClick={() => turn(1)} disabled={viewIndex >= views.length - 1}>
              <NextIcon />
            </IconButton>
          )}
        </div>
      </footer>

      {panel === "contents" && (
        <ContentsPanel
          toc={source.toc}
          onClose={closePanel}
          onSelect={(location) => {
            jumpTo(location);
            closePanel();
          }}
        />
      )}
      {panel === "bookmarks" && (
        <BookmarksPanel
          bookmarks={bookmarks}
          onClose={closePanel}
          onDelete={(b) => void removeBookmark(b)}
          onSelect={(b) => {
            jumpTo(b.location);
            closePanel();
          }}
        />
      )}
      {panel === "display" && (
        <DisplayPanel
          format={format}
          zoom={zoom}
          zoomFactor={zoomFactor}
          onZoom={applyZoom}
          onZoomStep={stepZoom}
          onClose={closePanel}
        />
      )}
    </div>
  );
}
