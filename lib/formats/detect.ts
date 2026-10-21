import type { BookFormat } from "../db";

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/**
 * Detects the format from the file's bytes, not its name. PDFs may carry a few
 * junk bytes before the header; EPUBs are zips that should store a `mimetype`
 * entry first, but some tools don't, so a zip named `.epub` is also accepted.
 */
export function detectFormat(bytes: ArrayBuffer, fileName: string): BookFormat | null {
  const head = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 1024));
  if (ascii(head, 0, head.length).includes("%PDF-")) return "pdf";

  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  if (!isZip) return null;
  const firstEntry = ascii(head, 30, 8);
  const firstContent = ascii(head, 38, 20);
  if (firstEntry === "mimetype" && firstContent === "application/epub+zip") return "epub";
  return /\.epub$/i.test(fileName) ? "epub" : null;
}
