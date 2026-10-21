import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, FONT_MAX, FONT_MIN, PRE_PAINT_SCRIPT, parseSettings } from "./settings";

describe("parseSettings", () => {
  it("returns defaults when nothing is stored", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults for invalid JSON and non-objects", () => {
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("[1,2]")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('"dark"')).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid fields and replaces invalid enum values field by field", () => {
    const s = parseSettings(
      JSON.stringify({
        theme: "sepia",
        layout: "sideways",
        locale: "ja",
        librarySort: "title",
        libraryView: "table",
        pdfOriginalColors: "yes",
      }),
    );
    expect(s.theme).toBe("sepia");
    expect(s.layout).toBe(DEFAULT_SETTINGS.layout);
    expect(s.locale).toBeUndefined();
    expect(s.librarySort).toBe("title");
    expect(s.libraryView).toBe(DEFAULT_SETTINGS.libraryView);
    expect(s.pdfOriginalColors).toBe(false);
  });

  it("clamps out-of-range font sizes and rejects non-numbers", () => {
    expect(parseSettings('{"fontSize":999}').fontSize).toBe(FONT_MAX);
    expect(parseSettings('{"fontSize":1}').fontSize).toBe(FONT_MIN);
    expect(parseSettings('{"fontSize":"big"}').fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(parseSettings('{"fontSize":125}').fontSize).toBe(125);
  });

  it("keeps an explicit locale", () => {
    expect(parseSettings('{"locale":"es"}').locale).toBe("es");
    expect(parseSettings('{"locale":"fr"}').locale).toBe("fr");
  });
});

describe("PRE_PAINT_SCRIPT", () => {
  function run(stored: object | null, languages: string[]) {
    const root = { lang: "", attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } };
    const env = {
      document: { documentElement: root },
      localStorage: { getItem: () => (stored ? JSON.stringify(stored) : null) },
      navigator: { languages, language: languages[0] },
    };
    new Function("document", "localStorage", "navigator", PRE_PAINT_SCRIPT)(env.document, env.localStorage, env.navigator);
    return root;
  }

  it("uses a stored locale", () => {
    expect(run({ locale: "it" }, ["en-US"]).lang).toBe("it");
  });

  it("detects a supported browser language by its primary subtag", () => {
    expect(run(null, ["de-AT"]).lang).toBe("de");
    expect(run({ locale: "xx" }, ["PT-pt"]).lang).toBe("pt");
  });

  it("falls back to English for unsupported languages", () => {
    expect(run(null, ["ja"]).lang).toBe("en");
  });

  it("applies a stored theme", () => {
    expect(run({ theme: "sepia" }, ["en"]).attrs["data-theme"]).toBe("sepia");
  });
});
