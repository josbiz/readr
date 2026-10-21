// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { prepareCss, resolvePath, sanitizeHtml, type ResolveUrl } from "./sanitize";

const BOOK: Record<string, string> = {
  "/OEBPS/images/cover.jpg": "blob:cover",
  "/OEBPS/fonts/serif.woff2": "blob:font",
};
const resolve: ResolveUrl = (raw) => {
  const path = resolvePath("/OEBPS/text/ch1.xhtml", raw);
  return path ? (BOOK[path] ?? null) : null;
};

describe("sanitizeHtml", () => {
  it("removes scripts and inline event handlers", () => {
    const out = sanitizeHtml(
      `<p onclick="steal()">Hi</p><script>alert(1)</script><img src="../images/cover.jpg" onerror="alert(2)">`,
      resolve,
    );
    expect(out).not.toMatch(/script|onclick|onerror|alert/);
    expect(out).toContain("Hi");
  });

  it("rewrites book images to local URLs and drops remote ones", () => {
    const out = sanitizeHtml(
      `<img src="../images/cover.jpg"><img src="https://tracker.example/pixel.gif"><img src="//cdn.example/x.png">`,
      resolve,
    );
    expect(out).toContain('src="blob:cover"');
    expect(out).not.toContain("example");
  });

  it("removes embedded documents, forms, media and stylesheet links", () => {
    const out = sanitizeHtml(
      `<iframe src="https://evil.example"></iframe><object data="x.swf"></object><embed src="x">
       <form action="https://evil.example"><input name="q"></form><video src="v.mp4"></video>
       <link rel="stylesheet" href="https://evil.example/a.css"><p>ok</p>`,
      resolve,
    );
    expect(out).not.toMatch(/iframe|object|embed|form|input|video|link|evil/);
    expect(out).toContain("<p>ok</p>");
  });

  it("removes javascript: and other link targets", () => {
    const out = sanitizeHtml(
      `<a href="javascript:alert(1)">a</a><a href="https://example.com">b</a><a href="ch2.xhtml#n1">c</a>`,
      resolve,
    );
    expect(out).not.toMatch(/href|javascript|example/);
    expect(out).toContain(">c</a>");
  });

  it("removes remote URLs from SVG images and inline styles", () => {
    const out = sanitizeHtml(
      `<svg><image xlink:href="https://evil.example/i.png"></image></svg>
       <div style="background: url('https://evil.example/bg.png') no-repeat">x</div>`,
      resolve,
    );
    expect(out).not.toContain("evil");
    expect(out).toContain("no-repeat");
  });
});

describe("prepareCss", () => {
  it("rewrites URLs, drops remote ones and targets reader wrappers", () => {
    const css = prepareCss(
      `@font-face { src: url("../fonts/serif.woff2") }
       body { background: url(https://evil.example/bg.png) }
       html, body > p { color: black }`,
      (raw) => {
        const path = resolvePath("/OEBPS/styles/main.css", raw);
        return path ? (BOOK[path] ?? null) : null;
      },
    );
    expect(css).toContain('url("blob:font")');
    expect(css).not.toContain("evil");
    expect(css).toContain(".epub-body { background: none }");
    expect(css).toContain(".epub-root, .epub-body > p");
  });

  it("inlines book imports and drops remote ones", () => {
    const css = prepareCss(
      `@import url("base.css"); @import "https://evil.example/x.css"; p { margin: 0 }`,
      () => null,
      (raw) => (raw === "base.css" ? "h1 { font-weight: bold }" : null),
    );
    expect(css).toContain("h1 { font-weight: bold }");
    expect(css).not.toContain("evil");
    expect(css).toContain("p { margin: 0 }");
  });
});

describe("resolvePath", () => {
  it("resolves relative paths against the base directory", () => {
    expect(resolvePath("/OEBPS/text/ch1.xhtml", "../images/a%20b.jpg#x")).toBe("/OEBPS/images/a b.jpg");
    expect(resolvePath("/OEBPS/text/ch1.xhtml", "./ch2.xhtml")).toBe("/OEBPS/text/ch2.xhtml");
    expect(resolvePath("/OEBPS/text/ch1.xhtml", "/root.css")).toBe("/root.css");
  });

  it("returns null for fragments and absolute URLs", () => {
    expect(resolvePath("/a/b.xhtml", "#note")).toBeNull();
    expect(resolvePath("/a/b.xhtml", "data:image/png;base64,xx")).toBeNull();
    expect(resolvePath("/a/b.xhtml", "https://x.y/z")).toBeNull();
    expect(resolvePath("/a/b.xhtml", "//x.y/z")).toBeNull();
  });
});
