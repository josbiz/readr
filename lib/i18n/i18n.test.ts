import { describe, expect, it } from "vitest";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { LOCALES } from "../settings";
import { detectLocale, dictionaries, LOCALE_NAMES, translate } from "./index";

describe("detectLocale", () => {
  it.each([
    [["es-MX"], "es"],
    [["es"], "es"],
    [["ES-es", "en"], "es"],
    [["fr-CA"], "fr"],
    [["pt-PT"], "pt"],
    [["pt-BR"], "pt"],
    [["DE"], "de"],
    [["it"], "it"],
    [["ja", "fr"], "en"],
    [["en-US"], "en"],
    [[], "en"],
  ])("%j -> %s", (languages, expected) => {
    expect(detectLocale(languages)).toBe(expected);
  });
});

describe("dictionaries", () => {
  const others = Object.entries(dictionaries).filter(([locale]) => locale !== "en");
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

  it.each(others)("%s has the same keys as en", (_, dict) => {
    expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(Object.entries(dictionaries))("%s has no empty strings", (_, dict) => {
    for (const [key, value] of Object.entries(dict)) expect(value, key).not.toBe("");
  });

  it.each(others)("%s uses the same placeholders as en", (_, dict) => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(dict[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe("translate", () => {
  it("interpolates parameters and leaves unknown ones visible", () => {
    expect(translate(en, "reader.pageOf", { page: 3, total: 10 })).toBe("Page 3 of 10");
    expect(translate(es, "reader.pageOf", { page: 3 })).toBe("Página 3 de {total}");
    expect(translate(fr, "reader.pageOf", { page: 3, total: 10 })).toBe("Page 3 sur 10");
  });
});

describe("LOCALE_NAMES", () => {
  it.each(LOCALES)("%s has a name", (locale) => {
    expect(LOCALE_NAMES[locale]).toBeTruthy();
  });
});
