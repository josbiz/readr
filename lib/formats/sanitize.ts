import DOMPurify, { type DOMPurify as Purifier } from "dompurify";

/** Maps a URL found in book content to a local URL, or null to drop it. */
export type ResolveUrl = (raw: string) => string | null;

const URL_ATTRS = ["src", "href", "xlink:href", "poster", "data"];

const CONFIG = {
  FORBID_TAGS: [
    "script", "style", "link", "meta", "base", "iframe", "frame", "frameset",
    "object", "embed", "applet", "form", "input", "button", "select", "textarea",
    "audio", "video", "source", "track", "portal",
  ],
  FORBID_ATTR: ["srcset", "action", "formaction", "ping", "background"],
  ALLOW_DATA_ATTR: false,
};

let purifier: Purifier | null = null;
let activeResolve: ResolveUrl = () => null;

function getPurifier(): Purifier {
  if (purifier) return purifier;
  purifier = DOMPurify(window);
  purifier.addHook("afterSanitizeAttributes", (node) => {
    const el = node as Element;
    if (!el.getAttribute) return;
    // Links never navigate out of the reader.
    if (el.localName === "a") {
      el.removeAttribute("href");
      el.removeAttribute("xlink:href");
      el.removeAttribute("target");
    }
    for (const name of URL_ATTRS) {
      const raw = el.getAttribute(name);
      if (raw === null) continue;
      const local = activeResolve(raw.trim());
      if (local) el.setAttribute(name, local);
      else el.removeAttribute(name);
    }
    const style = el.getAttribute("style");
    if (style !== null) el.setAttribute("style", rewriteCssUrls(style, activeResolve));
  });
  return purifier;
}

/**
 * Sanitizes a chapter body: no scripts, event handlers, embedded documents,
 * forms, or URLs that leave the book. Book resources are rewritten through
 * `resolve` (to blob: URLs); anything it can't resolve is removed.
 */
export function sanitizeHtml(html: string, resolve: ResolveUrl): string {
  const p = getPurifier();
  activeResolve = resolve;
  try {
    return p.sanitize(html, CONFIG) as string;
  } finally {
    activeResolve = () => null;
  }
}

const CSS_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

export function rewriteCssUrls(css: string, resolve: ResolveUrl): string {
  return css.replace(CSS_URL, (_m, _q, raw: string) => {
    const local = resolve(raw.trim());
    return local ? `url("${local}")` : "none";
  });
}

const IMPORT = /@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1\s*\)?[^;]*;/gi;

/**
 * Prepares a book stylesheet for a shadow root: `@import`s are replaced by the
 * imported book stylesheet (via `loadImport`) or dropped, URLs are rewritten,
 * and `html`/`body`/`:root` selectors target the reader's wrapper elements.
 */
export function prepareCss(
  css: string,
  resolve: ResolveUrl,
  loadImport: (raw: string) => string | null = () => null,
): string {
  const inlined = css.replace(IMPORT, (_m, _q, raw: string) => loadImport(raw) ?? "");
  return rewriteCssUrls(inlined, resolve)
    .replace(/<\/?style[^>]*>/gi, "")
    .replace(/(^|[\s,>+~}(])(?::root|html)(?=[\s,.#:[>+~{)])/gi, "$1.epub-root")
    .replace(/(^|[\s,>+~}(])body(?=[\s,.#:[>+~{)])/gi, "$1.epub-body");
}

/** Joins a relative URL to the directory of `base` (both archive paths), without the fragment. */
export function resolvePath(base: string, raw: string): string | null {
  if (!raw || raw.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) return null;
  let path = raw.split("#")[0].split("?")[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep the raw path when it isn't valid percent-encoding.
  }
  const parts = path.startsWith("/") ? [] : base.split("/").slice(0, -1);
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return `/${parts.filter(Boolean).join("/")}`;
}
