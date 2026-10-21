export type Theme = "system" | "light" | "sepia" | "dark";
export type LayoutMode = "auto" | "single" | "spread" | "scroll";
export const LOCALES = ["en", "es", "fr", "pt", "de", "it"] as const;
export type Locale = (typeof LOCALES)[number];
export type LibrarySort = "recent" | "title" | "author" | "progress";
export type LibraryView = "grid" | "list";

export interface Settings {
  theme: Theme;
  pdfOriginalColors: boolean;
  layout: LayoutMode;
  /** EPUB text size as a percentage of the book's base size. */
  fontSize: number;
  /** Undefined until the user picks a language explicitly. */
  locale?: Locale;
  librarySort: LibrarySort;
  libraryView: LibraryView;
}

export const SETTINGS_KEY = "readr:settings";
export const FONT_MIN = 70;
export const FONT_MAX = 200;
export const FONT_STEP = 10;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  pdfOriginalColors: false,
  layout: "auto",
  fontSize: 100,
  librarySort: "recent",
  libraryView: "grid",
};

const THEMES: readonly Theme[] = ["system", "light", "sepia", "dark"];
const LAYOUTS: readonly LayoutMode[] = ["auto", "single", "spread", "scroll"];
const SORTS: readonly LibrarySort[] = ["recent", "title", "author", "progress"];
const VIEWS: readonly LibraryView[] = ["grid", "list"];

function oneOf<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Parses stored settings, keeping each valid field and defaulting the rest. */
export function parseSettings(raw: string | null): Settings {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    // Corrupt JSON falls back to defaults.
  }
  const d = DEFAULT_SETTINGS;
  const size = data.fontSize;
  const settings: Settings = {
    theme: oneOf(THEMES, data.theme, d.theme),
    pdfOriginalColors:
      typeof data.pdfOriginalColors === "boolean" ? data.pdfOriginalColors : d.pdfOriginalColors,
    layout: oneOf(LAYOUTS, data.layout, d.layout),
    fontSize:
      typeof size === "number" && Number.isFinite(size)
        ? Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(size)))
        : d.fontSize,
    librarySort: oneOf(SORTS, data.librarySort, d.librarySort),
    libraryView: oneOf(VIEWS, data.libraryView, d.libraryView),
  };
  if ((LOCALES as readonly unknown[]).includes(data.locale)) settings.locale = data.locale as Locale;
  return settings;
}

function readStorage(): string | null {
  try {
    return localStorage.getItem(SETTINGS_KEY);
  } catch {
    return null;
  }
}

let cached: Settings | null = null;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  if (!cached) cached = parseSettings(readStorage());
  return cached;
}

export function updateSettings(patch: Partial<Settings>): void {
  cached = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(cached));
  } catch {
    // Storage unavailable: the change still applies for this session.
  }
  listeners.forEach((l) => l());
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== SETTINGS_KEY) return;
    cached = parseSettings(e.newValue);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Runs before first paint (inlined in the root layout) so the stored theme and
 * language apply without a flash. Must stay dependency-free ES5.
 */
export const PRE_PAINT_SCRIPT = `(function(){try{var d=document.documentElement,s={},L=${JSON.stringify(
  LOCALES,
)};try{s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_KEY,
)})||"{}")||{}}catch(e){}if(s.theme==="light"||s.theme==="sepia"||s.theme==="dark")d.setAttribute("data-theme",s.theme);var l=s.locale;if(L.indexOf(l)<0){var n=((navigator.languages&&navigator.languages[0])||navigator.language||"en").toLowerCase().split("-")[0];l=L.indexOf(n)<0?"en":n}d.lang=l}catch(e){}})()`;
