# Proposal

## Why

readr is still the default Next.js scaffold. The goal is a calm, Kindle-like reader for the user's own PDF and EPUB files that feels like a physical book: pages that turn, a layout that can show one or two pages, and light and dark themes. A library of recent books is the home screen, and bookmarks let the reader return to passages. Everything stays on the user's device, so there is no backend to run and nothing leaves the browser.

## What Changes

- Replace the scaffold home page with a **Library** that lists books, most recently opened first by default, with other sort orders and a grid or list view. Each entry shows a cover, title, author, reading progress and a finished badge. Books are added with a file picker or by dropping files onto the page, can be marked finished or unfinished, and can be removed.
- Store imported files, reading positions, bookmarks and settings locally in the browser. No accounts or server. The same file imported twice is recognized and not duplicated.
- Add a **Reader** view for PDF (fixed layout) and EPUB (reflowable) with:
  - layouts: single page, two-page spread, auto (spread on wide screens, single on narrow) and continuous scroll
  - a 3D page-turn animation in the paged layouts, which is disabled when the user prefers reduced motion
  - page turns by click/tap zones, keyboard and swipe; a table of contents; and progress display
  - PDF zoom (fit page, fit width, zoom steps, pinch) and a fullscreen mode
  - reopening a book at the last read position
- Add **bookmarks**: toggle a bookmark at the current page, see a bookmark marker on that page, list a book's bookmarks and jump to them.
- Add **appearance** settings: light, sepia, dark or system theme across the app and page content, a PDF "original colors" option, and font size for EPUB books.
- Add **localization**: the interface is available in English and Spanish, starts in the browser's language and can be switched.
- Make readr an **installable, offline-capable app** (PWA) so it can be added to an Android home screen and opened with no connection.
- Target desktop Chrome/Edge and Chrome on Android phones and tablets. Other browsers aren't tested.
- Add a unit test runner for the domain logic, since the project has no tests yet.

## Capabilities

### New Capabilities
- `library`: importing PDF/EPUB files into local storage; listing books with cover, metadata, progress and finished state, with sorting and grid/list views; opening and removing books.
- `reader`: rendering PDF and EPUB books, page layouts, page-turn interaction and animation, PDF zoom, fullscreen, table of contents, progress, and restoring the reading position.
- `bookmarks`: creating, displaying, listing, navigating to and deleting bookmarks within a book.
- `appearance`: theme (light/sepia/dark/system) for the app and page content, PDF original colors, and EPUB font size, saved across sessions.
- `localization`: English and Spanish interface text, the initial language choice and switching between languages.
- `offline-app`: installing readr to the home screen and loading it without a network connection.

### Modified Capabilities
_None. No specs exist yet._

## Impact

- **Code**: replaces `app/page.tsx` and the scaffold styling in `app/globals.css` and `app/layout.tsx`; adds a reader route, a web app manifest, icons, a service worker and client-side modules for storage, document rendering, translations and UI.
- **Dependencies**: adds `pdfjs-dist` (PDF rendering), `epubjs` (EPUB parsing and locations), `dompurify` (sanitizing EPUB HTML) and `idb` (IndexedDB wrapper); adds dev dependencies `vitest` and `fake-indexeddb`.
- **Data**: the browser's IndexedDB holds the user's books. Clearing site data deletes the library, and there is no cross-device sync.
- **Security**: EPUB files contain untrusted HTML that is rendered in the app's origin, so it must be sanitized before display.
