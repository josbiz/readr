import { describe, expect, it } from "vitest";
import { detectFormat } from "./detect";

const bytes = (...parts: (string | number[])[]) => {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") for (const ch of part) out.push(ch.charCodeAt(0));
    else out.push(...part);
  }
  return new Uint8Array(out).buffer;
};

// A zip local file header: signature, 26 bytes of fields, then the entry name.
const zipEntry = (name: string, content: string) =>
  bytes([0x50, 0x4b, 0x03, 0x04], new Array(26).fill(0), name, content);

describe("detectFormat", () => {
  it("detects a PDF by its header", () => {
    expect(detectFormat(bytes("%PDF-1.7\n..."), "x.bin")).toBe("pdf");
  });

  it("detects a PDF with leading junk", () => {
    expect(detectFormat(bytes("\n\n  %PDF-1.4"), "x.pdf")).toBe("pdf");
  });

  it("detects an EPUB by its mimetype entry, whatever the name", () => {
    expect(detectFormat(zipEntry("mimetype", "application/epub+zip"), "book.zip")).toBe("epub");
  });

  it("accepts a zip named .epub without a leading mimetype entry", () => {
    expect(detectFormat(zipEntry("META-INF/", ""), "book.epub")).toBe("epub");
  });

  it("rejects other zips", () => {
    expect(detectFormat(zipEntry("word/document.xml", ""), "report.docx")).toBeNull();
  });

  it("rejects a text file even when named .pdf", () => {
    expect(detectFormat(bytes("just some notes"), "notes.pdf")).toBeNull();
  });

  it("rejects empty and truncated files", () => {
    expect(detectFormat(new ArrayBuffer(0), "empty.epub")).toBeNull();
    expect(detectFormat(bytes([0x50, 0x4b]), "cut.epub")).toBeNull();
  });
});
