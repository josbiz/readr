import type { BookFormat, ParsedBook } from "../db";
import { detectFormat } from "./detect";
import { BookError, type PageSource } from "./types";

export { BookError };
export type { PageSource, TocEntry, Box } from "./types";
export type { PdfSource } from "./pdf";

/** Validates and reads metadata at import. Throws BookError for bad files. */
export async function parseBook(file: File, bytes: ArrayBuffer): Promise<ParsedBook> {
  const format = detectFormat(bytes, file.name);
  if (!format) throw new BookError("unsupported");
  return format === "pdf"
    ? (await import("./pdf")).parsePdf(bytes)
    : (await import("./epub")).parseEpub(bytes);
}

export async function openSource(format: BookFormat, file: Blob): Promise<PageSource> {
  const bytes = await file.arrayBuffer();
  return format === "pdf"
    ? (await import("./pdf")).openPdf(bytes)
    : (await import("./epub")).openEpub(bytes);
}
