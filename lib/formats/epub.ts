import ePub from "epubjs";
import type { ParsedBook } from "../db";
import type { Location } from "../location";
import { downscaleImage } from "./image";
import { prepareCss, resolvePath, sanitizeHtml, type ResolveUrl } from "./sanitize";
import { BookError, excerpt, type Box, type PageSource, type TocEntry } from "./types";

type Book = ReturnType<typeof ePub>;
interface ZipEntry {
  async(type: "string"): Promise<string>;
  async(type: "uint8array"): Promise<Uint8Array>;
}
interface Zip {
  file(name: string): ZipEntry | null;
}
interface ManifestItem {
  href: string;
  type: string;
}
interface NavItem {
  label: string;
  href: string;
  subitems?: NavItem[];
}

/** Offset used for "the start of a chapter", before any character. */
const CHAPTER_START = -1;
const OPEN_TIMEOUT = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function openBook(bytes: ArrayBuffer): Promise<{ book: Book; zip: Zip; opf: string }> {
  const book = ePub();
  try {
    await withTimeout(book.open(bytes.slice(0), "binary"), OPEN_TIMEOUT);
    await withTimeout(book.ready, OPEN_TIMEOUT);
    const zip = (book.archive as unknown as { zip: Zip }).zip;
    const opf = `/${(book.container as unknown as { packagePath: string }).packagePath}`;
    return { book, zip, opf };
  } catch (cause) {
    book.destroy();
    throw new BookError("unreadable", { cause });
  }
}

const zipName = (path: string) => path.replace(/^\//, "");

export async function parseEpub(bytes: ArrayBuffer): Promise<ParsedBook> {
  const { book, zip, opf } = await openBook(bytes);
  try {
    const meta = book.packaging.metadata as { title?: string; creator?: string };
    let cover: Blob | undefined;
    const coverPath = book.packaging.coverPath ? resolvePath(opf, book.packaging.coverPath) : null;
    const entry = coverPath ? zip.file(zipName(coverPath)) : null;
    if (entry) cover = await downscaleImage(new Blob([(await entry.async("uint8array")) as BlobPart]));
    return { format: "epub", title: meta.title, author: meta.creator, cover };
  } finally {
    book.destroy();
  }
}

interface Chapter {
  path: string;
  html: string;
  css: string;
  bodyClass: string;
  text: string;
  /** Text offset of each element id, for table-of-contents fragments. */
  ids: Map<string, number>;
}

interface Pagination {
  /** Per chapter, the text offset at which each page begins. */
  starts: number[][];
  firstPage: number[];
  pageCount: number;
}

interface Geometry {
  marginX: number;
  marginY: number;
  width: number;
  height: number;
  gap: number;
}

function geometry(box: Box): Geometry {
  const marginX = Math.round(Math.min(64, Math.max(18, box.width * 0.07)));
  const marginY = Math.round(Math.min(56, Math.max(22, box.height * 0.05)));
  return {
    marginX,
    marginY,
    width: Math.max(80, Math.floor(box.width - 2 * marginX)),
    height: Math.max(80, Math.floor(box.height - 2 * marginY)),
    gap: 40,
  };
}

function readerCss(g: Geometry, fontSize: number): string {
  return `
:host{all:initial;display:block;position:relative;width:100%;height:100%}
.viewport{position:absolute;left:${g.marginX}px;top:${g.marginY}px;width:${g.width}px;height:${g.height}px;overflow:hidden}
.flow{width:${g.width}px;height:${g.height}px;column-width:${g.width}px;column-gap:${g.gap}px;column-fill:auto;
  transform:translateX(0);will-change:transform}
.epub-root{font-family:var(--font-reading),Georgia,serif;font-size:${fontSize}% !important;line-height:1.6;
  color:var(--ink);overflow-wrap:break-word;hyphens:auto;-webkit-font-smoothing:antialiased}
.epub-root *{color:var(--ink) !important;background-color:transparent !important;
  border-color:color-mix(in srgb,var(--ink) 25%,transparent) !important}
.epub-body{margin:0 !important;padding:0 !important;max-width:none !important}
.epub-root img,.epub-root svg,.epub-root video{max-width:100% !important;max-height:${g.height}px !important;
  height:auto;object-fit:contain;break-inside:avoid}
.epub-root svg{height:auto !important}
.epub-root figure{break-inside:avoid}
.epub-root pre{white-space:pre-wrap !important}
.epub-root table{max-width:100%}`;
}

function chapterMarkup(chapter: Chapter, g: Geometry, fontSize: number, wrap: boolean): string {
  const flow = `<div class="flow epub-root"><div class="epub-body ${chapter.bodyClass}">${chapter.html}</div></div>`;
  return `<style>${readerCss(g, fontSize)}${chapter.css}</style>${wrap ? `<div class="viewport">${flow}</div>` : flow}`;
}

function textInfo(html: string): { text: string; ids: Map<string, number> } {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const ids = new Map<string, number>();
  let offset = 0;
  let text = "";
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = (node as Text).data;
      text += data;
      offset += data.length;
    } else if ((node as Element).id && !ids.has((node as Element).id)) {
      ids.set((node as Element).id, offset);
    }
  }
  return { text, ids };
}

function parseDocument(source: string): Document {
  const parser = new DOMParser();
  const xml = parser.parseFromString(source, "application/xhtml+xml");
  return xml.getElementsByTagName("parsererror").length ? parser.parseFromString(source, "text/html") : xml;
}

async function decodeImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await withTimeout(Promise.allSettled(images.map((img) => img.decode())), 4000).catch(() => {});
}

/**
 * Finds the text offset at which each column begins. Columns without text
 * (full-page images) get offsets between their neighbours so every page keeps
 * a distinct, ordered location.
 */
function measureColumns(flow: HTMLElement, g: Geometry, length: number): number[] {
  const step = g.width + g.gap;
  const origin = flow.getBoundingClientRect().left;
  const columnAt = (x: number) => Math.max(0, Math.floor((x - origin + g.gap / 2) / step));
  const range = document.createRange();
  const charColumn = (node: Text, k: number): number | null => {
    for (let i = k; i < node.data.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getClientRects()[0];
      if (rect) return columnAt(rect.left + rect.width / 2);
    }
    return null;
  };

  let count = Math.max(1, Math.round((flow.scrollWidth + g.gap) / step));
  const starts: number[] = [];
  const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
  let pos = 0;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const len = node.data.length;
    const first = len ? charColumn(node, 0) : null;
    if (first !== null) {
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects());
      const last = Math.max(first, ...rects.map((r) => columnAt(r.left + r.width / 2)));
      for (let c = first; c <= last; c++) {
        if (starts[c] !== undefined) continue;
        // Smallest k whose character sits in column c or later.
        let lo = 0;
        let hi = len - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          const col = charColumn(node, mid);
          if (col === null || col >= c) hi = mid;
          else lo = mid + 1;
        }
        starts[c] = pos + lo;
      }
      count = Math.max(count, last + 1);
    }
    pos += len;
  }

  const result: number[] = new Array(count);
  for (let c = 0; c < count; c++) result[c] = starts[c] ?? NaN;
  for (let c = 0; c < count; c++) {
    if (!Number.isNaN(result[c])) continue;
    let end = c;
    while (end < count && Number.isNaN(result[end])) end++;
    const a = c === 0 ? CHAPTER_START - 1 : result[c - 1];
    const b = end < count ? result[end] : length + 1;
    const n = end - c;
    for (let k = 0; k < n; k++) result[c + k] = a + ((b - a) * (k + 1)) / (n + 1);
    c = end;
  }
  return result;
}

const IMAGE_OR_FONT = /^(image\/|font\/|application\/(font|x-font|vnd\.ms-opentype))/;

export async function openEpub(bytes: ArrayBuffer): Promise<PageSource> {
  const { book, zip, opf } = await openBook(bytes);
  const manifest = Object.values(book.packaging.manifest as Record<string, ManifestItem>);
  const blobUrls = new Map<string, string>();
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;contain:strict";

  try {
    await Promise.all(
      manifest
        .filter((item) => IMAGE_OR_FONT.test(item.type))
        .map(async (item) => {
          const path = resolvePath(opf, item.href);
          const entry = path ? zip.file(zipName(path)) : null;
          if (!path || !entry) return;
          const data = await entry.async("uint8array");
          blobUrls.set(path, URL.createObjectURL(new Blob([data as BlobPart], { type: item.type })));
        }),
    );

    const resolverFor =
      (base: string): ResolveUrl =>
      (raw) => {
        const path = resolvePath(base, raw);
        return path ? (blobUrls.get(path) ?? null) : null;
      };

    const rawCss = new Map<string, string>();
    await Promise.all(
      manifest
        .filter((item) => item.type === "text/css")
        .map(async (item) => {
          const path = resolvePath(opf, item.href);
          const entry = path ? zip.file(zipName(path)) : null;
          if (path && entry) rawCss.set(path, await entry.async("string"));
        }),
    );
    const cssFor = (path: string, seen = new Set<string>()): string => {
      const raw = rawCss.get(path);
      if (raw === undefined || seen.has(path)) return "";
      seen.add(path);
      return prepareCss(raw, resolverFor(path), (href) => {
        const target = resolvePath(path, href);
        return target ? cssFor(target, seen) : null;
      });
    };

    const manifestById = book.packaging.manifest as Record<string, ManifestItem>;
    const spine = (book.packaging.spine as unknown as { idref: string; linear: string }[])
      .filter((item) => item.linear !== "no" && manifestById[item.idref])
      .map((item) => resolvePath(opf, manifestById[item.idref].href))
      .filter((path): path is string => Boolean(path && zip.file(zipName(path))));
    if (spine.length === 0) throw new BookError("unreadable");

    const chapters: Chapter[] = [];
    for (const path of spine) {
      const doc = parseDocument(await zip.file(zipName(path))!.async("string"));
      const styles: string[] = [];
      for (const el of Array.from(doc.querySelectorAll("link, style"))) {
        if (el.localName === "style") {
          styles.push(prepareCss(el.textContent ?? "", resolverFor(path)));
        } else if (/\bstylesheet\b/i.test(el.getAttribute("rel") ?? "")) {
          const href = resolvePath(path, el.getAttribute("href") ?? "");
          if (href) styles.push(cssFor(href));
        }
      }
      const body = doc.querySelector("body");
      const html = sanitizeHtml(body ? body.innerHTML : doc.documentElement.innerHTML, resolverFor(path));
      const bodyClass = (body?.getAttribute("class") ?? "").replace(/[^\w\s-]/g, "");
      chapters.push({ path, html, css: styles.join("\n"), bodyClass, ...textInfo(html) });
    }

    const lengths = chapters.map((c) => c.text.length);
    const before: number[] = [];
    lengths.reduce((sum, len, i) => ((before[i] = sum), sum + len), 0);
    const total = lengths.reduce((a, b) => a + b, 0);
    const percentAt = (spineIndex: number, offset: number) =>
      total ? (before[spineIndex] + Math.min(lengths[spineIndex], Math.max(0, offset))) / total : 0;

    const navBase = resolvePath(opf, book.packaging.navPath || book.packaging.ncxPath || "") ?? opf;
    const chapterIndex = new Map(chapters.map((c, i) => [c.path, i]));
    const tocLocation = (href: string): Location | null => {
      const [, fragment] = href.split("#");
      const path = resolvePath(navBase, href);
      const fallback = resolvePath(opf, href);
      const spineIndex = chapterIndex.get(path ?? "") ?? chapterIndex.get(fallback ?? "");
      if (spineIndex === undefined) return null;
      const offset = (fragment ? chapters[spineIndex].ids.get(decodeURIComponent(fragment)) : undefined) ?? CHAPTER_START;
      return { kind: "epub", spine: spineIndex, offset, percent: percentAt(spineIndex, offset) };
    };
    const buildToc = (items: NavItem[] = []): TocEntry[] =>
      items.flatMap((item) => {
        const location = tocLocation(item.href ?? "");
        const children = buildToc(item.subitems);
        if (!location) return children;
        return [{ label: item.label?.trim() || "—", location, children }];
      });
    const toc = buildToc(book.navigation?.toc as NavItem[] | undefined);
    const flatToc: { spine: number; offset: number; label: string }[] = [];
    const flattenToc = (entries: TocEntry[]) => {
      for (const e of entries) {
        if (e.location.kind === "epub") flatToc.push({ spine: e.location.spine, offset: e.location.offset, label: e.label });
        flattenToc(e.children);
      }
    };
    flattenToc(toc);
    flatToc.sort((a, b) => a.spine - b.spine || a.offset - b.offset);

    book.destroy();
    document.body.append(host);
    const measureRoot = host.attachShadow({ mode: "open" });

    let geom = geometry({ width: 600, height: 800 });
    let font = 100;
    let pagination: Pagination = { starts: chapters.map(() => [CHAPTER_START]), firstPage: [], pageCount: 0 };
    const cache = new Map<string, Pagination>();
    let generation = 0;

    const locate = (index: number) => {
      const { firstPage, starts } = pagination;
      let c = 0;
      while (c + 1 < firstPage.length && firstPage[c + 1] <= index) c++;
      return { chapter: c, column: Math.max(0, Math.min(starts[c].length - 1, index - firstPage[c])) };
    };

    const source: PageSource = {
      format: "epub",
      get pageCount() {
        return pagination.pageCount;
      },
      toc,
      async layout(box, fontSize) {
        const g = geometry(box);
        const key = `${g.width}x${g.height}@${fontSize}`;
        const run = ++generation;
        let next = cache.get(key);
        if (!next) {
          await document.fonts?.ready;
          host.style.width = `${g.width}px`;
          host.style.height = `${g.height}px`;
          const starts: number[][] = [];
          for (const chapter of chapters) {
            if (run !== generation) return;
            measureRoot.innerHTML = chapterMarkup(chapter, g, fontSize, false);
            await decodeImages(measureRoot);
            starts.push(measureColumns(measureRoot.querySelector<HTMLElement>(".flow")!, g, chapter.text.length));
            // Let the page stay responsive between chapters.
            await new Promise((r) => setTimeout(r));
          }
          measureRoot.innerHTML = "";
          if (run !== generation) return;
          const firstPage: number[] = [];
          let count = 0;
          for (const s of starts) {
            firstPage.push(count);
            count += s.length;
          }
          next = { starts, firstPage, pageCount: count };
          cache.set(key, next);
        }
        if (run !== generation) return;
        geom = g;
        font = fontSize;
        pagination = next;
      },
      async renderPage(index, el) {
        const { chapter, column } = locate(index);
        const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
        const key = `${chapter}|${geom.width}x${geom.height}@${font}`;
        if (el.dataset.epubKey !== key) {
          root.innerHTML = chapterMarkup(chapters[chapter], geom, font, true);
          el.dataset.epubKey = key;
        }
        const flow = root.querySelector<HTMLElement>(".flow");
        if (flow) flow.style.transform = `translateX(${-column * (geom.width + geom.gap)}px)`;
      },
      locationOf(index) {
        const { chapter, column } = locate(index);
        const offset = pagination.starts[chapter][column];
        return { kind: "epub", spine: chapter, offset, percent: percentAt(chapter, offset) };
      },
      pageOf(loc) {
        if (loc.kind !== "epub" || !pagination.pageCount) return 0;
        const c = Math.min(chapters.length - 1, Math.max(0, loc.spine));
        const starts = pagination.starts[c];
        let column = 0;
        for (let k = 0; k < starts.length; k++) if (starts[k] <= loc.offset) column = k;
        return pagination.firstPage[c] + column;
      },
      percentOf(index) {
        const { chapter, column } = locate(index);
        return percentAt(chapter, pagination.starts[chapter][column]);
      },
      chapterOf(index) {
        const { chapter, column } = locate(index);
        const offset = pagination.starts[chapter][column];
        let label: string | undefined;
        for (const e of flatToc) {
          if (e.spine < chapter || (e.spine === chapter && e.offset <= offset)) label = e.label;
        }
        return label;
      },
      async excerptOf(index) {
        const { chapter, column } = locate(index);
        const start = Math.max(0, pagination.starts[chapter][column]);
        return excerpt(chapters[chapter].text.slice(start, start + 400));
      },
      destroy() {
        generation++;
        host.remove();
        blobUrls.forEach((url) => URL.revokeObjectURL(url));
        blobUrls.clear();
      },
    };
    return source;
  } catch (error) {
    host.remove();
    blobUrls.forEach((url) => URL.revokeObjectURL(url));
    book.destroy();
    throw error instanceof BookError ? error : new BookError("unreadable", { cause: error });
  }
}
