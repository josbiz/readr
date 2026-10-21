import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { ParsedBook } from "../db";
import { toJpeg } from "./image";
import { BookError, excerpt, type Box, type PageSource, type TocEntry } from "./types";

export const PDF_WORKER_URL = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url);

/** Android Chrome fails to allocate canvases much larger than this. */
const MAX_CANVAS_PIXELS = 16_000_000;
const CACHE_SIZE = 6;

function ensureWorker() {
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(PDF_WORKER_URL, { type: "module" });
  }
}

async function load(bytes: ArrayBuffer): Promise<{ doc: PDFDocumentProxy; close: () => Promise<void> }> {
  ensureWorker();
  // pdf.js takes ownership of the buffer it is given, so pass a copy.
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) });
  try {
    return { doc: await task.promise, close: () => task.destroy() };
  } catch (cause) {
    void task.destroy();
    throw new BookError("unreadable", { cause });
  }
}

function metaString(info: unknown, key: string): string | undefined {
  const value = (info as Record<string, unknown> | undefined)?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function renderToCanvas(page: PDFPageProxy, cssWidth: number): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 });
  const dpr = window.devicePixelRatio || 1;
  let scale = (cssWidth / base.width) * dpr;
  const pixels = base.width * base.height * scale * scale;
  if (pixels > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvas;
}

export async function parsePdf(bytes: ArrayBuffer): Promise<ParsedBook> {
  const { doc, close } = await load(bytes);
  try {
    const { info } = await doc.getMetadata().catch(() => ({ info: undefined }));
    let cover: Blob | undefined;
    try {
      cover = await toJpeg(await renderToCanvas(await doc.getPage(1), 300));
    } catch {
      cover = undefined;
    }
    return { format: "pdf", title: metaString(info, "Title"), author: metaString(info, "Author"), cover };
  } finally {
    await close();
  }
}

type OutlineItem = Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>[number];

async function resolveOutline(doc: PDFDocumentProxy, items: OutlineItem[] | null): Promise<TocEntry[]> {
  const entries: TocEntry[] = [];
  for (const item of items ?? []) {
    let page: number | null = null;
    try {
      const dest = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
      const ref = dest?.[0];
      if (typeof ref === "number") page = ref;
      else if (ref) page = await doc.getPageIndex(ref);
    } catch {
      page = null;
    }
    const children = await resolveOutline(doc, item.items);
    // Entries without a page (external links) still group their children.
    if (page === null && children.length === 0) continue;
    entries.push({
      label: item.title?.trim() || "—",
      location: { kind: "pdf", page: (page ?? 0) + 1 },
      children,
    });
  }
  return entries;
}

function flatten(entries: TocEntry[], out: { page: number; label: string }[] = []) {
  for (const e of entries) {
    if (e.location.kind === "pdf") out.push({ page: e.location.page - 1, label: e.label });
    flatten(e.children, out);
  }
  return out;
}

export interface PdfSource extends PageSource {
  readonly format: "pdf";
  /** Page width / height, used for fit-width zoom. */
  aspectOf(index: number): Promise<number>;
}

export async function openPdf(bytes: ArrayBuffer): Promise<PdfSource> {
  const { doc, close } = await load(bytes);
  const toc = await resolveOutline(doc, await doc.getOutline().catch(() => null));
  const chapters = flatten(toc).sort((a, b) => a.page - b.page);
  const pageCount = doc.numPages;

  // Rendered pages keyed by page and CSS width, most recently used last.
  const cache = new Map<string, Promise<HTMLCanvasElement>>();
  const tokens = new WeakMap<HTMLElement, number>();
  let nextToken = 0;

  function rendered(index: number, cssWidth: number): Promise<HTMLCanvasElement> {
    const key = `${index}@${Math.round(cssWidth)}`;
    let entry = cache.get(key);
    if (entry) {
      cache.delete(key);
    } else {
      entry = doc.getPage(index + 1).then((page) => renderToCanvas(page, cssWidth));
      entry.catch(() => cache.delete(key));
    }
    cache.set(key, entry);
    while (cache.size > CACHE_SIZE) {
      const oldest = cache.keys().next().value as string;
      void cache.get(oldest)?.then((c) => {
        c.width = 0;
        c.height = 0;
      }, () => {});
      cache.delete(oldest);
    }
    return entry;
  }

  return {
    format: "pdf",
    pageCount,
    toc,
    async layout() {
      // PDF pages scale to whatever box they are drawn into.
    },
    async renderPage(index, el, box: Box) {
      const token = ++nextToken;
      tokens.set(el, token);
      const page = await doc.getPage(index + 1);
      const { width, height } = page.getViewport({ scale: 1 });
      const fit = Math.min(box.width / width, box.height / height);
      const cssWidth = width * fit;
      const source = await rendered(index, cssWidth);
      if (tokens.get(el) !== token) return;
      // Copy so the same page can be shown in several places at once.
      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      canvas.getContext("2d")?.drawImage(source, 0, 0);
      canvas.className = "pdf-canvas";
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${height * fit}px`;
      const holder = document.createElement("div");
      holder.className = "pdf-page";
      holder.append(canvas);
      el.replaceChildren(holder);
    },
    async aspectOf(index) {
      const { width, height } = (await doc.getPage(index + 1)).getViewport({ scale: 1 });
      return width / height;
    },
    locationOf: (index) => ({ kind: "pdf", page: index + 1 }),
    pageOf: (loc) => (loc.kind === "pdf" ? Math.min(pageCount - 1, Math.max(0, loc.page - 1)) : 0),
    percentOf: (index) => (index + 1) / pageCount,
    chapterOf(index) {
      let label: string | undefined;
      for (const c of chapters) if (c.page <= index) label = c.label;
      return label;
    },
    async excerptOf(index) {
      try {
        const content = await (await doc.getPage(index + 1)).getTextContent();
        return excerpt(content.items.map((i) => ("str" in i ? i.str : "")).join(" "));
      } catch {
        return undefined;
      }
    },
    destroy() {
      cache.clear();
      void close();
    },
  };
}
