# Spec Delta

## Purpose

Localization makes all of readr's own interface text available in English and Spanish, so users read the app in their language while book content stays as published.

## ADDED Requirements

### Requirement: Supported interface languages
The system SHALL provide all interface text in English and in Spanish. That covers labels, buttons, menus, messages, empty states, dialogs, accessible names and formatted dates and numbers. Book content and book metadata SHALL be shown as stored in the file and never translated.

#### Scenario: Spanish interface
- **WHEN** the interface language is Spanish
- **THEN** every interface string is in Spanish, and dates and percentages use Spanish formatting

#### Scenario: Book text untouched
- **WHEN** the interface language is Spanish and an English book is open
- **THEN** the book's title, chapters and text remain in English

### Requirement: Initial language
On first use, the system SHALL choose Spanish when the browser's preferred language is Spanish (any region), and English otherwise.

#### Scenario: Spanish browser
- **WHEN** the browser's preferred language is `es-MX` and the user has not chosen a language
- **THEN** the interface is in Spanish

#### Scenario: Other browser language
- **WHEN** the browser's preferred language is French and the user has not chosen a language
- **THEN** the interface is in English

### Requirement: Switch language
The system SHALL let the user switch between English and Spanish from the settings at any time. The change SHALL apply immediately without a reload and SHALL be remembered across sessions.

#### Scenario: Switch while reading
- **WHEN** the user switches the language while a book is open
- **THEN** the reader controls change language and the reading position is unchanged

#### Scenario: Choice remembered
- **WHEN** the user has chosen English on a Spanish-language browser and reloads
- **THEN** the interface is in English

### Requirement: Document language attribute
The system SHALL set the page's language attribute to the current interface language, so assistive technology reads the interface correctly.

#### Scenario: Language attribute follows choice
- **WHEN** the interface language is Spanish
- **THEN** the root element's `lang` attribute is `es`
