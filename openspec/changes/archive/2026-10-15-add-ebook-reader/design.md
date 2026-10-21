# Design

## Context

The repository is an unmodified `create-next-app` scaffold: Next.js 16.4 (App Router, `cacheComponents: true`), React 19.3, Tailwind 4 through the Turbopack loader, and pnpm with a `minimumReleaseAge` policy. It has no tests, no state library and no backend, and it is not a git repository yet.

All of the app's data comes from files the user picks and lives in their browser (see proposal.md, "Why"), so nearly everything runs as client code. The server only delivers the app.

Target platforms are desktop Chrome/Edge and Chrome on Android phones and tablets. Touch and small screens are first-class, and Safari and Firefox are not tested.

## Goals / Non-Goals

**Goals:**
- One reader component that drives both formats through a single page-source contract, so layouts, page turns, bookmarks and progress don't branch on format.
- Page turns animated with CSS 3D transforms only, using real rendered pages: no screenshots and no WebGL.
- A storage layer behind one module, so a later sync feature replaces one seam.
- After the first online visit, everything works offline.

**Non-Goals:**
- Text selection, highlights, notes (including bookmark notes), dictionary, search inside books and text-to-speech.
- Library search (sort, view and finished are in scope).
- Drag-to-curl page physics.
- Typeface, margin and line-height choices (EPUB font size only).
- Fixed-layout EPUB (`rendition:layout pre-paginated`). Such books are shown reflowed as far as their markup allows.
- DRM-protected files (they fail import as unreadable).
- Safari, iOS and Firefox support (not blocked, but not tested or worked around).
- Languages beyond English and Spanish, and translating book content.
- A wake lock (keeping the screen awake).

## Decisions

### 1. Routes and rendering boundary
- `/` is the library. `/read?book=<id>` is the reader.
- A query parameter is used instead of `/read/[id]`, so the reader is one fixed URL path that the service worker can cache once and serve offline for every book (decision 12). A dynamic segment would make each book a different, uncached document.
- Both pages are thin server components that render one client component, loaded with `next/dynamic({ ssr: false })`. The reason is that pdf.js, epub.js, IndexedDB and `DOMParser` all need the browser.
- `cacheComponents` stays on. The reader reads `useSearchParams()` inside a `<Suspense>` boundary, as Next requires, so the server never touches the parameter.
- *Alternatives:* `/read/[bookId]`, rejected for the offline reason above; a single page with a hash, rejected because it loses Back-button semantics between the library and the reader.

### 2. Storage: IndexedDB via `idb` for data, `localStorage` for settings
IndexedDB database `readr`, version 1:

| store | key | value |
|---|---|---|
| `books` | `id` (SHA-256 of file bytes, hex) | `{ id, format: 'pdf'\|'epub', title, author?, fileName, size, addedAt, openedAt?, position?: Location, progress: 0..1, finished: boolean, pdfZoom?: Zoom, cover?: Blob }` |
| `files` | `id` | `Blob` (the original file) |
| `bookmarks` | `id` (uuid), index `byBook` on `bookId` | `{ id, bookId, location: Location, label: { chapter?, page?, percent, excerpt? }, createdAt }` |

- File blobs are kept separate from book metadata, so listing the library never loads book bytes.
- Removing a book deletes its `books`, `files` and `bookmarks` rows in one readwrite transaction.
- Using the content hash as the id makes duplicate import a key lookup. It's computed with `crypto.subtle.digest`.
- `navigator.storage.persist()` is requested on the first import, to reduce the chance of the browser evicting the library. Chrome grants it to installed PWAs.
- A `QuotaExceededError` on write is surfaced as "storage full", and the transaction aborts, so nothing is half-written.
- **Settings** live in `localStorage` under `readr:settings`:

  ```ts
  { theme: 'system'|'light'|'sepia'|'dark', pdfOriginalColors: boolean,
    layout: 'auto'|'single'|'spread'|'scroll', fontSize: number,
    locale?: 'en'|'es', librarySort: 'recent'|'title'|'author'|'progress',
    libraryView: 'grid'|'list' }
  ```

  They live there because the theme and locale must be readable synchronously before first paint (decision 8), and the object is tiny. A missing `locale` means "not chosen yet". Every field is validated, and defaults are used on failure.
- One module, `lib/db`, owns the schema and exposes intent-level functions. UI code never touches IndexedDB directly.
- *Alternatives:* raw IndexedDB (verbose); Dexie (larger than needed); the File System Access API (needs a permission prompt on every reopen, and Android Chrome lacks the directory picker).

### 3. Location model
```ts
type Location =
  | { kind: 'pdf'; page: number }            // 1-based
  | { kind: 'epub'; spine: number; offset: number; percent: number }
```
- A PDF page is stable. An EPUB position is a spine index plus a character offset into that section's sanitized text, so it survives re-pagination, layout changes and font size changes.
- `percent` is stored alongside, for library progress and sorting without opening the book.
- Bookmarks and the saved position both use `Location`.
- Sorting is by page, or by `(spine, offset)`.
- *Alternative:* EPUB CFIs. Rejected during implementation: every position is computed against our sanitized DOM anyway, so a CFI would add epub.js's `EpubCFI` and `locations` machinery without being interchangeable with other apps. Offsets are simpler and just as stable here.
- **Finished** is set when the reader shows the last view (the last page index is visible). The manual toggle writes the same flag.

### 4. Page-source contract
```ts
interface PageSource {
  pageCount: number                      // current pagination
  renderPage(i: number, el: HTMLElement, opts: { scale?: number }): Promise<void>
  locationOf(i: number): Location
  pageOf(loc: Location): number
  toc: TocEntry[]                        // { label, location, children }
  layout(size: { width; height }, fontSize): Promise<void> // EPUB re-paginates; PDF re-scales
  destroy(): void
}
```
The reader works only with page indexes. Layouts, page-turn animation, bookmark markers and progress are format-agnostic. `scale` is used only by PDF zoom.

### 5. PDF source: `pdfjs-dist`
- Each page renders to a `<canvas>` at `devicePixelRatio × zoom`, sized to the page box.
- The worker is set up with `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`.
- An LRU keeps about 6 rendered canvases, and other canvases are released.
- Text for bookmark excerpts comes from `page.getTextContent()`.
- The cover is page 1 rendered to a 300px-wide JPEG blob at import.
- **Zoom** is `{ mode: 'page'|'width'|'custom', value?: number }`, saved per book. The custom range is 50–400% in 25% steps, plus Ctrl+=/Ctrl+-.
- While zoomed, the page container is an `overflow: auto` scroller.
- During a pinch, two-pointer `PointerEvent`s apply a CSS `transform: scale()` around the pinch midpoint for 60fps feedback. On gesture end, the page re-renders at the new scale and the scroll offset is adjusted so the content under the fingers stays put.
- Canvas size is capped at 16 megapixels, because Android Chrome fails on larger canvases. Beyond the cap, CSS upscales, so extreme zoom on large pages is slightly soft.
- The page area sets `touch-action: none`, so the reader owns pinch and swipe there. Browser zoom elsewhere is untouched (no `user-scalable=no`).

### 6. EPUB source: `epubjs` for parsing, own paginator for display
epub.js parses the container (OPF metadata, spine, navigation, cover, resources). Its `Rendition`, `EpubCFI` and `locations` are not used. That renderer scrolls one iframe across CSS columns, so there is no separate page element to rotate in 3D.

The paginator works like this:
1. Load a spine section as a document, and sanitize it with DOMPurify. That removes scripts, event-handler attributes, `<iframe>`/`<object>`/`<embed>`/`<form>`, `javascript:` URLs and any URL that isn't a book resource.
2. Rewrite resource URLs to `blob:` URLs created from the archive. They are revoked in `destroy()`.
3. Measure the chapter in a hidden Shadow DOM host. That host contains the book CSS plus a reader stylesheet, which sets theme colors, the font size, `column-width = page width`, image caps and fixed-position neutralizing. The page count is `scrollWidth / pageWidth`.
4. `renderPage(i)` clones the sanitized chapter into the target's own shadow root, translated to column `i`. Every visible page is an independent subtree that can be transformed.

Further details:
- All chapters are sanitized once when the book opens, which also gives each chapter's text length.
- `locationOf(i)` is the text offset of the first character in column `i`. `pageOf` turns an offset into a range and maps its column back to a page.
- Global page numbers add up per-chapter counts. Every chapter is measured after each layout or font size change (waiting for its images to decode) behind a "Preparing pages…" state. That keeps page numbers exact and avoids re-numbering pages mid-read. Measuring a typical book takes well under a second.
- Percent is `(text before this chapter + offset) / total text`.
- *Alternatives:* epub.js `Rendition`, which has no per-page element to flip; and foliate-js, which isn't on npm and uses the same iframe and scroll model.

### 7. Layouts, input and page-turn animation
- The view model is a spread `[left?, right?]`.
- Single layout shows `[i]`. Spread pairs pages as `[–,0], [1,2]…`, so the cover stands alone.
- Auto resolves to spread when the reader area is at least `2 × 360px` plus the gutter, and in landscape. On Android tablets this means landscape shows a spread and portrait a single page.
- The resolved layout is the pure function `views(pageCount, mode, size)`.
- **Turn:** a `leaf` element with front and back faces (`backface-visibility: hidden`) rotates `rotateY(0 → -180deg)` around the spine, while the target spread is already rendered underneath. Single layout rotates around the left edge.
  - A gradient shade overlay follows the rotation.
  - The turn takes about 450ms with `cubic-bezier(.3,.7,.4,1)`, run with the Web Animations API.
  - Turns queue: extra requests made during an animation are combined into one final jump.
  - `prefers-reduced-motion` swaps the turn for an instant change.
- **Scroll layout:** a virtualized vertical list of the same page boxes, for both formats. Boxes have a fixed height, so the visible range and the current page (the topmost visible one) come from the scroll offset. Reusing page boxes keeps one `PageSource` contract for every layout.
- **Input:**
  - tap zones: left 30% / center 40% (toggles chrome) / right 30%
  - keys: ←/→, PageUp/PageDown, Space/Shift+Space, `B` (bookmark), `F` (fullscreen)
  - swipe: pointer gesture of 40px or more, horizontal-dominant
  - When the PDF is zoomed past fit page, drags pan the scroller and swipe turning is disabled. Taps and keys still turn.
- **Fullscreen:** `element.requestFullscreen()` on the reader root, with `document.exitFullscreen()` on unmount. The control is hidden when `document.fullscreenEnabled` is false.
- **Back closes panels:** opening a panel calls `history.pushState({ panel })`. A `popstate` with a panel open closes it, and closing via the UI calls `history.back()`. History stays balanced, and the Android back button behaves as the spec requires.
- *Alternative:* the StPageFlip library. Rejected: it works on images or its own DOM, has no React 19 typings, and isn't maintained.

### 8. Theming
- Tokens are CSS custom properties (`--paper`, `--ink`, `--chrome`, `--accent`, ...), in light, sepia and dark sets selected by `html[data-theme]`. Tailwind 4 maps them through `@theme inline`.
- `system` sets no attribute, so `prefers-color-scheme` picks light or dark.
- An inline `<script>` in `app/layout.tsx`, before first paint, reads `readr:settings` and sets `data-theme` and `lang` (decision 11). `<html suppressHydrationWarning>` avoids a mismatch warning.
- **EPUB pages:** the reader stylesheet forces `color` and `background` with `!important` inside the shadow root, for every theme.
- **PDF pages:**
  - Dark uses `filter: invert(1) hue-rotate(180deg)`.
  - Sepia overlays a `--paper` layer with `mix-blend-mode: multiply`, which tints white to paper and keeps dark ink.
  - Original colors removes both.
- Typography is Literata (reading, via `next/font/google`) and Geist (chrome). Kindle-like restraint: neutral paper tones and one muted accent.

### 9. Saving position and finished state
- Position is written (debounced by 500ms) on each view change, and flushed on `pagehide` and on leaving the reader.
- `openedAt` is set when the reader opens.
- Reaching the last view sets `finished: true` in the same write.

### 10. Library sorting and views
- Sorting is a pure comparator per key.
- Title and author use `Intl.Collator(locale, { sensitivity: 'base' })`, so case and accents are ignored. Books without an author sort last.
- Progress sorts descending. Recent sorts by `openedAt` descending, then `addedAt` descending for books never opened.
- Grid and list are two renderings of the same data. Each list row has a menu (mark finished/unfinished, remove) that is reachable by keyboard and touch.

### 11. Localization: typed dictionaries, no i18n library
- `lib/i18n/en.ts` is the source dictionary. `es.ts` is typed as `typeof en`, so a missing Spanish key fails the TypeScript build.
- A small `I18nProvider` with `useT()` supplies `t(key, params)` for ICU-free interpolation. Plural cases are separate keys.
- Dates and numbers use `Intl.DateTimeFormat` and `Intl.NumberFormat` with the active locale.
- Initial locale comes from `settings.locale ?? (navigator.languages[0].startsWith('es') ? 'es' : 'en')`. It is applied to `document.documentElement.lang` by the pre-paint script and on every change.
- There is no locale in the URL: the app is client-only, behind no search engine, and a URL locale would multiply the offline routes.
- *Alternative:* `next-intl`. Rejected: its value lies in server rendering and locale routing, which this client-only app doesn't use, and it adds a dependency.

### 12. Installable, offline app: native manifest + hand-written service worker
- `app/manifest.ts` (Next's native metadata route) sets: name `readr`, `display: standalone`, `start_url: '/'`, theme and background colors, and 192/512 px icons plus a maskable icon.
- The icons are generated at build by `app/icon.tsx` with `generateImageMetadata` and `ImageResponse`, served at `/icon/<id>`, so there are no binary assets to maintain.
- `public/sw.js` is about 80 lines with no dependency. It is registered from the client in production only, as `/sw.js?v=<NEXT_PUBLIC_APP_VERSION>`, where `next.config.ts` sets `env.NEXT_PUBLIC_APP_VERSION` to the build timestamp.
- The cache name includes the version.
  - **install:** precache `/` and `/read`, plus every `/_next/static` asset referenced by those two HTML responses.
  - **fetch:** navigations are network-first, falling back to the cached document for the pathname (`/read?book=…` → `/read`). `/_next/static/*` is cache-first, since the files are immutable and hashed. Everything else goes to the network.
  - **activate:** delete caches from other versions.
- There is no `skipWaiting`. A new worker waits until all readr windows close, so a reading session is never reloaded or mixed between versions.
- The reader's dynamically imported chunks and the pdf.js worker are not in the HTML. After the library first loads online, the app pre-imports the reader module and requests the worker URL when idle, so the runtime cache stores them.
- Book data already lives in IndexedDB, and the service worker never touches it.
- *Alternatives:* Serwist or next-pwa. Rejected: they depend on the webpack build, while this project builds with Turbopack, and a short worker is easier to reason about than generated precache manifests.

### 13. Testing
Vitest with `fake-indexeddb/auto` covers the logic that can be tested without a renderer:
- `lib/db` (import dedupe, cascade delete, quota path, finished flag)
- `views()` spread math
- location sorting and library comparators (including accented titles)
- settings parsing and defaults, and initial locale detection
- sanitizer stripping
- a key-parity test between `en` and `es`, as runtime backup to the type check

Rendering, animation, zoom, theming and offline behavior are checked with `pnpm build`, `pnpm lint` and the manual checks in tasks.md, on desktop Chrome and on a real Android device (or Chrome DevTools device mode plus the Lighthouse PWA audit).

*Alternative:* Playwright end-to-end tests. Deferred to avoid adding a browser toolchain now.

## Risks / Trade-offs

- [epub.js is in slow maintenance] → We use only its parser, `EpubCFI` and locations. The `PageSource` seam allows replacing them later.
- [EPUB CSS breaks column pagination] → The reader stylesheet caps image size, neutralizes fixed positioning and avoids breaks inside figures. Remaining overflow is clipped, never scrolled horizontally.
- [Sanitized-DOM CFIs differ from other apps' CFIs] → CFIs are internal only, with no import or export.
- [Large PDFs and zoom use lots of memory on Android] → Canvas LRU and the 16MP canvas cap. The whole file is loaded into memory while the book is open (pdf.js has no Blob range loading without a custom transport).
- [Browser evicts IndexedDB] → Persistent storage is requested, and installed PWAs are usually granted it. The empty state explains that books live on this device. Backup is out of scope.
- [Offline misses a chunk never loaded online] → Shell assets are precached at install, and the reader module and worker are pre-imported when idle. The manual offline check covers opening a book in a fresh offline session.
- [Pinch and swipe conflict with browser gestures] → `touch-action: none` is set on the page area only, so the rest of the app keeps native zoom for accessibility.
- [Dark and sepia PDF recoloring distorts photos] → The original colors option.
- [The service worker serves a stale app] → The versioned URL plus waiting worker means the update applies on the next launch. Bumping the version on every build guarantees a new worker.
- [New packages blocked by pnpm `minimumReleaseAge`] → Install the latest versions that pass the policy; never bypass it.

## Migration Plan

This is a new app on the scaffold, so there are no user data or schema migrations. IndexedDB starts at version 1, and later changes bump it in `lib/db`'s `upgrade` callback.

Rollback means reverting and redeploying. Because of the waiting-worker policy, clients pick up the rollback on their next launch. Data a user already stored stays in their browser.
