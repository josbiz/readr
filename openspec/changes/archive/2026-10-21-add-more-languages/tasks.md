# Tasks

## 1. Locale list and detection

- [x] 1.1 In `lib/settings.ts`, declare `export const LOCALES = ["en", "es", "fr", "pt", "de", "it"] as const` and derive `type Locale` from it (design decision 1); verify `lib/settings.test.ts` gains cases that keep a stored `"fr"` and still drop an unknown value like `"ja"`, and `pnpm test` passes
- [x] 1.2 Rewrite `detectLocale` in `lib/i18n/index.tsx` to match the primary subtag of the first preferred language against `LOCALES`, falling back to `"en"` (decision 2); verify `i18n.test.ts` covers `es-MX`→es, `fr-CA`→fr, `pt-PT`→pt, `pt-BR`→pt, `DE`→de, `it`→it, `ja`→en, `en-US`→en and `[]`→en
- [x] 1.3 Make `PRE_PAINT_SCRIPT` embed `JSON.stringify(LOCALES)` for both the stored-value check and the browser-language match, staying ES5 (decision 3); verify a new test evaluates the script with stubbed `document`, `localStorage` and `navigator` and gets `lang` = `it` for a stored `"it"`, `de` for a `de-AT` browser with nothing stored, and `en` for a `ja` browser

## 2. Dictionaries

- [x] 2.1 Generalize the dictionary tests in `lib/i18n/i18n.test.ts` (same keys, no empty strings, same placeholders) to loop over every entry in `dictionaries` instead of naming `es`; verify `pnpm test` still passes with only `en` and `es`
- [x] 2.2 Add `lib/i18n/fr.ts` (French, informal `tu`) typed as `Messages`, and register it in `dictionaries`; verify `pnpm exec tsc --noEmit` and the dictionary tests pass
- [x] 2.3 Add `lib/i18n/pt.ts` (Brazilian Portuguese, `você`) typed as `Messages`, and register it; verify `tsc` and the dictionary tests pass
- [x] 2.4 Add `lib/i18n/de.ts` (German, informal `du`) typed as `Messages`, and register it; verify `tsc` and the dictionary tests pass
- [x] 2.5 Add `lib/i18n/it.ts` (Italian, informal `tu`) typed as `Messages`, and register it; verify `tsc` and the dictionary tests pass, and that `translate(fr, "reader.pageOf", { page: 3, total: 10 })` gives a French string with both numbers filled in

## 3. Language setting

- [x] 3.1 Add `LOCALE_NAMES: Record<Locale, string>` (English, Español, Français, Português, Deutsch, Italiano) in `lib/i18n/index.tsx` (decision 4); verify a test checks that every locale in `LOCALES` has a non-empty name
- [x] 3.2 Add a labelled `Select` component to `components/ui.tsx` with the same `label/value/options/onChange` shape as `Segmented`, styled to match, and use it for the language control in `AppearanceControls`, with options built from `LOCALES` and `LOCALE_NAMES` (decision 5); verify `pnpm lint` passes and, in `pnpm dev`, the control lists all six languages in their own names in both the library settings and the reader display panel, can be changed with the keyboard, and switching updates the visible text and `<html lang>` without a reload

## 4. Integration check

- [x] 4.1 In `pnpm dev`, switch to each new language and check the library (empty state, header, book options menu, remove dialog), an open book (toolbar, panels, bookmarks) and import toasts at 375px width; verify nothing overflows or truncates badly (German first, as the longest), dates and percentages use the language's format, and the reading position is unchanged after switching mid-book
- [x] 4.2 Run `pnpm test`, `pnpm lint` and `pnpm build`; verify all pass

## Workflow follow-up

- Have a native speaker review `fr.ts`, `pt.ts`, `de.ts` and `it.ts` before release.
- Archive the change after review.
