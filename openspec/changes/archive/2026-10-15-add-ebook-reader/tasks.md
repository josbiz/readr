# Tasks

## 1. Foundation

- [x] 1.1 Add dependencies `pdfjs-dist`, `epubjs`, `dompurify`, `idb` and dev dependencies `vitest`, `fake-indexeddb` with pnpm (respecting `minimumReleaseAge`), and add a `test` script (`vitest run --passWithNoTests`); verify `pnpm install` and `pnpm test` succeed
- [x] 1.2 Create the routes `/` (library) and `/read` (reader, reading `?book=` via `useSearchParams` inside `<Suspense>`) as server pages that render client-only components via `next/dynamic({ ssr: false })`, with placeholder content; verify `pnpm build` succeeds with `cacheComponents` on and both routes load in `pnpm dev`
- [x] 1.3 Replace the scaffold metadata, fonts and styles: Literata (reading) + Geist (UI), and light/sepia/dark color tokens on `html[data-theme]` with a `prefers-color-scheme` fallback, mapped through Tailwind `@theme inline`; verify `pnpm lint` passes and both routes render with the new tokens

## 2. Settings, theme and localization

- [x] 2.1 Implement `lib/settings`: read/write `readr:settings` in localStorage with the full schema (theme, pdfOriginalColors, layout, fontSize, locale, librarySort, libraryView), field-level validation, defaults, and try/catch fallback, plus a React hook that updates on change; verify unit tests cover defaults, invalid JSON, invalid enum values and out-of-range font size
- [x] 2.2 Implement `lib/i18n`: `en.ts` source dictionary, `es.ts` typed with the same keys as `en`, `I18nProvider`/`useI18n()` with interpolation, locale-aware date/number helpers, and initial locale detection (`es*` → Spanish, otherwise English); verify unit tests cover detection for `es-MX`, `es`, `fr`, `en-US`, and a key-parity test between dictionaries
- [x] 2.3 Add the pre-paint inline script in `app/layout.tsx` that sets `data-theme` and `lang` from settings, and a settings panel offering theme (system/light/sepia/dark) and language (English/Español) that apply live, including following OS changes in system mode; verify manually that reloading in dark or sepia shows no flash of another theme, that switching language updates all visible text and `<html lang>` without a reload, and that a Spanish-browser profile starts in Spanish

## 3. Local storage

- [x] 3.1 Implement `lib/db` with `idb`: schema v1 (`books`, `files`, `bookmarks` with `byBook` index) and functions `listBooks`, `getBook`, `getFile`, `savePosition` (with progress and the finished flag), `setFinished`, `savePdfZoom`, `markOpened`, `removeBook` (single-transaction cascade); verify unit tests with `fake-indexeddb` cover cascade delete, finished set by position and by manual toggle, and that toggling finished leaves the position unchanged
- [x] 3.2 Implement `importBook(file, parse)`: SHA-256 id, returns the existing book on duplicate without overwriting position/bookmarks/finished, stores metadata and blob in one transaction, requests `navigator.storage.persist()` on first import, and maps `QuotaExceededError` to a typed "storage full" error; verify unit tests cover dedupe, quota failure leaving stores unchanged, and the stored shape
- [x] 3.3 Implement bookmark functions `listBookmarks(bookId)` (sorted by location), `addBookmark`, `deleteBookmark`, and the `Location` type with a comparator (PDF by page, EPUB by spine index then text offset); verify unit tests cover sorting across both kinds and add/delete round trips

## 4. Document sources

- [x] 4.1 Define `PageSource`/`TocEntry` and `parseBook(file)` that detects the format by content (`%PDF-` header / EPUB zip with `application/epub+zip` mimetype) and throws typed `unsupported`/`unreadable` errors; verify unit tests cover each format, a text file and a truncated file
- [x] 4.2 Implement the PDF source with `pdfjs-dist` (worker via `new URL(..., import.meta.url)`): title/author, page-1 cover JPEG, HiDPI canvas rendering at fit or custom scale with the 16MP canvas cap, canvas LRU, outline TOC, text-content excerpts; verify manually with a 100+ page PDF that pages are crisp, the outline navigates and memory stays bounded while paging
- [x] 4.3 Implement the EPUB sanitizer (DOMPurify: no scripts, handlers, iframe/object/embed/form, `javascript:` or non-book URLs) and resource rewriting to revocable `blob:` URLs; verify unit tests feed hostile markup (script, `onerror`, remote `img`/`link`, `javascript:` href) and assert it is stripped
- [x] 4.4 Implement the EPUB source: epub.js parsing (metadata, spine, nav, cover), shadow-DOM chapter mounting with the reader stylesheet (theme colors, font size, `column-width`, image caps, fixed-position neutralizing), per-chapter page counts measured after each layout, `renderPage`, text-offset `locationOf`/`pageOf` on the sanitized DOM, and percent from sanitized text lengths; verify manually with two real EPUBs (one image-heavy) that pages fit without horizontal scroll, chapters flow in order and the TOC navigates

## 5. Library

- [x] 5.1 Implement the library comparators (recent, title, author with author-less last, progress) using `Intl.Collator` for the active locale; verify unit tests cover each key, accented and mixed-case titles, and never-opened books in recent order
- [x] 5.2 Build the library view: grid of cover cards and compact list (toggle remembered), sort selector (remembered), entries with cover or generated title cover, title, author, format badge, progress %, finished badge, an empty state explaining that books stay on this device, and keyboard/touch activation opening `/read?book=<id>`; verify manually with zero, one and several books in both views and each sort, in both languages, at phone and desktop widths
- [x] 5.3 Add import via file picker (multiple, `.pdf,.epub`) and drag-and-drop with a drop indicator, per-file progress, and localized per-file errors for unsupported, unreadable and storage-full; verify manually by importing valid files, a duplicate (no new entry), a `.txt` and a corrupt PDF
- [x] 5.4 Add an entry menu with mark finished/unfinished and remove (accessible, focus-trapped confirmation dialog calling `removeBook`); verify manually that the finished toggle updates the badge, that confirmed removal persists after reload, and that cancel changes nothing

## 6. Reader

- [x] 6.1 Implement `views(pageCount, mode, size)` resolving single/spread/auto (spread when width ≥ 2×360px + gutter and landscape, cover alone) and page↔view mapping; verify unit tests cover odd/even counts, cover placement, auto thresholds and lookups
- [x] 6.2 Build the reader shell: load book and source, open at the saved position or the start, resize via `ResizeObserver` triggering `layout()` while keeping the current location, auto-hiding toolbar and progress bar (center tap, edge hover, focus keeps them visible), and back-to-library; verify manually that resizing, rotating an Android device and switching layouts keep the same text in view
- [x] 6.3 Implement page turning: tap zones (30/40/30), keys (←/→, PageUp/PageDown, Space/Shift+Space), swipe (≥40px, horizontal-dominant), boundary no-ops, and the turn queue landing on the final target; verify manually every input, first/last page boundaries, and rapid key presses ending on the correct page
- [x] 6.4 Implement the 3D page-turn leaf with the Web Animations API (front/back faces, spine origin for spreads, left-edge origin for single, shading, ~450ms) and the instant path under `prefers-reduced-motion`; verify manually in both layouts, in all three themes and with reduced motion enabled
- [x] 6.5 Implement continuous-scroll layout as a virtualized list with `IntersectionObserver` tracking the current location; verify manually smooth scrolling through a large PDF and an EPUB, and that switching back to a paged layout keeps the position
- [ ] 6.6 Implement PDF zoom: fit page/fit width/50–400% steps, Ctrl+=/Ctrl+-, pinch with live CSS scale and re-render on gesture end keeping the pinch point fixed, panning instead of swipe-turning while zoomed, the zoom level kept across turns (scrolled to the top), zoom saved per book, controls hidden for EPUB; verify manually on Android with pinch, pan, and turns while zoomed, and that reopening the book restores the zoom
- [x] 6.7 Add fullscreen (toolbar button and `F` key, hidden when unsupported, exited on leaving the reader) and history-backed panels so the browser/Android back button closes an open panel before leaving the reader; verify manually on Android that back closes the contents panel first, then returns to the library, and that fullscreen enters and exits correctly
- [x] 6.8 Add the progress display (page X of Y, %, EPUB chapter title), contents panel (nested, empty state, closes on navigate), EPUB font size controls with min/max disabled states, the layout selector, and debounced position saving with `pagehide` flush, `markOpened` and finished-on-last-view; verify manually that reopening resumes at the same place, and that the library shows updated progress, recent ordering, and the finished badge after reading to the end
- [x] 6.9 Apply themes to page content: EPUB forced colors per theme in the shadow stylesheet; PDF dark invert filter and sepia multiply overlay; and the original-colors setting (shown only for PDF) that removes them; verify manually with an EPUB whose CSS sets black text on white, and with a PDF containing a photo in light, sepia and dark, with original colors on and off

## 7. Bookmarks

- [x] 7.1 Add the bookmark toggle (toolbar button with pressed state and `B` key) for the current page (left page in spreads), storing location, chapter, page, percent and an excerpt; verify manually add/remove toggling and the correct state after turning away and back
- [x] 7.2 Render the ribbon marker on visible pages containing a bookmarked location, recomputed after re-pagination; verify manually that after changing EPUB font size the ribbon moves to the page now holding the bookmarked text
- [x] 7.3 Build the bookmarks panel (history-backed like other panels) listing bookmarks in reading order with chapter, page/percent, excerpt and a locale-formatted created date, jump-to (closes the panel), delete, and an empty-state hint; verify manually navigation, that deletion removes the ribbon, and persistence after reload

## 8. Installable offline app

- [x] 8.1 Add `app/manifest.ts` (name, standalone display, start URL, theme/background colors) and icons (192, 512, maskable 512) generated by `app/icon.tsx`; verify the manifest at `/manifest.webmanifest` lists all icons and the Chrome DevTools Application panel reports it as installable
- [x] 8.2 Implement `public/sw.js` (versioned cache; install precaches `/`, `/read` and their referenced `/_next/static` assets; network-first navigations falling back to the cached pathname document; cache-first `/_next/static/*`; old caches deleted on activate; no `skipWaiting`), set `NEXT_PUBLIC_APP_VERSION` at build in `next.config.ts`, register `/sw.js?v=<version>` in production only, and pre-import the reader module and pdf.js worker when idle; verify with `pnpm build && pnpm start` that after one online visit, DevTools "Offline" still loads the library and opens both a PDF and an EPUB in a fresh tab
- [x] 8.3 Verify updates: rebuild with a new version while a reader tab is open; confirm the tab is not reloaded, the new worker waits, and after closing all tabs and reopening, the new version is active with books, positions, bookmarks and settings intact

## 9. Integration checks

- [x] 9.1 Run `pnpm test`, `pnpm lint` and `pnpm build`, and verify all pass
- [ ] 9.2 Walk the full flow on desktop Chrome and on an Android device (installed PWA): import PDF + EPUB → sort and switch views → read in every layout with turns, zoom (PDF) and font size (EPUB) → bookmark → switch theme and language → reload offline → resume → finish a book → remove a book; verify every spec scenario's observable outcome holds, there are no console errors, and the library, reader controls and panels are fully usable by keyboard on desktop
