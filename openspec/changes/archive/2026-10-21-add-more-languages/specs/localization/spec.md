## MODIFIED Requirements

### Requirement: Supported interface languages
The system SHALL provide all interface text in English, Spanish, French, Portuguese, German and Italian. That covers labels, buttons, menus, messages, empty states, dialogs, accessible names and formatted dates and numbers. Book content and book metadata SHALL be shown as stored in the file and never translated.

#### Scenario: Spanish interface
- **WHEN** the interface language is Spanish
- **THEN** every interface string is in Spanish, and dates and percentages use Spanish formatting

#### Scenario: French interface
- **WHEN** the interface language is French
- **THEN** every interface string is in French, and dates and percentages use French formatting

#### Scenario: Portuguese interface
- **WHEN** the interface language is Portuguese
- **THEN** every interface string is in Brazilian Portuguese, and dates and percentages use Portuguese formatting

#### Scenario: German interface
- **WHEN** the interface language is German
- **THEN** every interface string is in German, and dates and percentages use German formatting

#### Scenario: Italian interface
- **WHEN** the interface language is Italian
- **THEN** every interface string is in Italian, and dates and percentages use Italian formatting

#### Scenario: Book text untouched
- **WHEN** the interface language is French and an English book is open
- **THEN** the book's title, chapters and text remain in English

### Requirement: Initial language
On first use, the system SHALL choose the browser's preferred language when its primary language is one of the supported languages (any region), and English otherwise.

#### Scenario: Spanish browser
- **WHEN** the browser's preferred language is `es-MX` and the user has not chosen a language
- **THEN** the interface is in Spanish

#### Scenario: French browser
- **WHEN** the browser's preferred language is `fr-CA` and the user has not chosen a language
- **THEN** the interface is in French

#### Scenario: European Portuguese browser
- **WHEN** the browser's preferred language is `pt-PT` and the user has not chosen a language
- **THEN** the interface is in Portuguese

#### Scenario: Other browser language
- **WHEN** the browser's preferred language is Japanese and the user has not chosen a language
- **THEN** the interface is in English

#### Scenario: No flash of the wrong language attribute
- **WHEN** the browser's preferred language is German, the user has not chosen a language, and the page loads
- **THEN** the root element's `lang` attribute is `de` before the first paint

### Requirement: Switch language
The system SHALL let the user switch to any supported language from the settings at any time, with each language listed by its own name. The change SHALL apply immediately without a reload and SHALL be remembered across sessions.

#### Scenario: Switch while reading
- **WHEN** the user switches the language while a book is open
- **THEN** the reader controls change language and the reading position is unchanged

#### Scenario: Languages listed in their own names
- **WHEN** the user opens the language setting while the interface is in English
- **THEN** the options read English, Español, Français, Português, Deutsch and Italiano

#### Scenario: Choice remembered
- **WHEN** the user has chosen Italian on a Spanish-language browser and reloads
- **THEN** the interface is in Italian

#### Scenario: Unknown stored language
- **WHEN** the stored language setting holds a value that is not a supported language
- **THEN** the system ignores it and chooses the initial language from the browser
