# Design

## Context

Localization is built on typed dictionaries without an i18n library. `lib/i18n/en.ts` is the source; `es.ts` is typed as `Messages`, so a missing key fails the build. `I18nProvider` resolves `settings.locale ?? detectLocale(navigator.languages)` and formats dates and percentages with `Intl`. Library sorting uses `Intl.Collator(locale)`.

Three places hard-code `en`/`es` today and must stay in agreement:
- `Locale` and `LOCALES` in `lib/settings.ts` (validation of the stored setting),
- `detectLocale` in `lib/i18n/index.tsx` (`startsWith("es")`),
- `PRE_PAINT_SCRIPT` in `lib/settings.ts`, a hand-written ES5 string that repeats both the validation and the detection.

The language control in `components/ui.tsx` is a `Segmented` radio group with two literal options. There are no plural keys in the dictionaries, so no plural-rule handling is needed.

## Goals / Non-Goals

**Goals:**
- One list of supported locales that the type, validation, detection, pre-paint script and settings control all derive from, so adding a seventh language means adding a dictionary and one list entry.
- Keep the build-time guarantee that each dictionary has every key.

**Non-Goals:**
- An i18n library, lazy-loaded dictionaries, or locale routing (rejected in the original reader design, decision 11; still true).

## Decisions

### 1. `LOCALES` is the single source of truth
`lib/settings.ts` declares `export const LOCALES = ["en", "es", "fr", "pt", "de", "it"] as const` and derives `type Locale = (typeof LOCALES)[number]`. `parseSettings` already validates against it, so it needs no change.
- *Alternative:* derive the list from the `dictionaries` object keys. Rejected: `settings.ts` must not import the dictionaries, because the pre-paint script and settings parsing should stay light and dependency-free.

### 2. Detection matches the primary subtag
`detectLocale` takes the primary subtag of `languages[0]` (text before `-`, lower-cased) and returns it if it is in `LOCALES`, otherwise `"en"`. It still looks only at the first preferred language, as the existing behavior and spec do.
- *Alternative:* walk the whole `navigator.languages` list for the first supported entry. It would be friendlier for users like `["ja", "fr"]`, but it changes current behavior beyond this change's scope; it can be added later.

### 3. Generate the pre-paint script's locale check from `LOCALES`
The script embeds `JSON.stringify(LOCALES)` as an array literal and uses `indexOf` for both the stored-value check and the subtag match. That keeps it ES5 and dependency-free while removing the duplicated `"en"`/`"es"` literals. A unit test evaluates the script against a stubbed `document`/`localStorage`/`navigator` to confirm it sets `lang` correctly for a stored choice, a supported browser language and an unsupported one.

### 4. Language names live next to the locale list, not in the dictionaries
Each language is shown in its own name (an endonym), whatever the current interface language is. That is the usual convention and lets a user who switched by mistake find their language. A `LOCALE_NAMES: Record<Locale, string>` map in `lib/i18n/index.tsx` holds them. They are not dictionary keys, because they don't vary by interface language.
- *Alternative:* `Intl.DisplayNames(locale, { type: "language" })`. Rejected: output capitalization varies by locale and engine (e.g. "français" in lower case), and six fixed strings are simpler.

### 5. Settings control becomes a native `<select>`
Six options in the `Segmented` control would wrap into two or three rows in the narrow reader panel. A labelled native `<select>` styled like the other controls is accessible, compact and works with the keyboard and screen readers without extra code. If `ui.tsx` has no select primitive, add a small `Select` component next to `Segmented` with the same `label/value/options/onChange` shape, so it can be reused.

### 6. Portuguese is one `pt` dictionary in Brazilian Portuguese
Brazil is the large majority of Portuguese speakers. `pt-PT` users get Brazilian Portuguese, which is fully understandable. `Intl` formatting uses the `pt` locale (which defaults to Brazilian conventions).

### 7. Translations are written in-repo and checked by tests
The new dictionaries are typed as `Messages`. The existing tests (same keys, no empty strings, same placeholders) are generalized to loop over every entry in `dictionaries` instead of naming `es`. Translations keep the app's tone: short, calm, informal second person where the language allows it (`tu` in French, `você` in Portuguese, `du` in German, `tu` in Italian), matching Spanish's `tú`.

## Risks / Trade-offs

- [Machine-quality translations read awkwardly to native speakers] → Keep strings short and literal; list the four dictionaries in the task notes for a native-speaker review before release.
- [Longer German and French strings overflow buttons, chips or the reader toolbar] → Check the library header, book options menu, reader toolbar and settings panel at phone width in German, the longest of the four.
- [Pre-paint script and React detection drift apart] → Both derive from `LOCALES` (decision 3), and the script has its own test.
- [Stored settings from a future build contain a locale this build doesn't know] → `parseSettings` already drops unknown values and falls back to detection; covered by a spec scenario.

## Migration Plan

No data migration. Stored `en`/`es` choices remain valid. Rollback is reverting the change; a stored `fr`/`pt`/`de`/`it` value would then be ignored and the browser language used instead.
