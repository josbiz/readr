# Proposal

## Why

readr's interface is only available in English and Spanish, so users who read in other common languages get an English interface by default. Adding the most widely used Latin-script languages reaches far more readers at low cost, since the i18n layer already handles dictionaries, formatting and switching.

## What Changes

- Add four interface languages: **French (`fr`)**, **Portuguese (`pt`)**, **German (`de`)** and **Italian (`it`)**, alongside English and Spanish. Each gets a complete dictionary covering every existing message key.
- Portuguese is written in Brazilian Portuguese and serves every `pt*` browser language (including `pt-PT`).
- First-use detection picks the browser's preferred language when its primary subtag is any supported language (any region), and falls back to English otherwise. This applies both to the React detection and to the pre-paint script that sets `<html lang>`.
- The language setting becomes a dropdown listing each language by its own name (English, Español, Français, Português, Deutsch, Italiano). Six options no longer fit a segmented control.
- Dates, percentages and library sorting follow the chosen language, as they already do for Spanish.
- Assumption: "common languages" means these four, based on the examples given (French, Portuguese). More can be added later the same way.

Non-goals:
- Right-to-left languages (Arabic, Hebrew) and CJK languages. They need layout, font and line-breaking work that this change does not cover.
- Regional variants as separate choices (e.g. `pt-PT` vs `pt-BR`, `fr-CA`).
- Translating book content or metadata.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `localization`: the supported language set grows from English and Spanish to six languages. Initial-language detection and the language switch cover all of them.

## Impact

- `lib/settings.ts`: `Locale` type, the allowed-locale list, and the pre-paint script, which currently hard-codes `en`/`es`.
- `lib/i18n/`: four new dictionaries (`fr.ts`, `pt.ts`, `de.ts`, `it.ts`), `dictionaries` map, `detectLocale`, and tests extended to every dictionary.
- `components/ui.tsx`: the language control in `AppearanceControls`.
- No new dependencies; formatting and collation use the built-in `Intl` APIs.
