# Spec Delta

## Purpose

The offline app capability lets readr be installed to a device's home screen and open with no network connection, so the locally stored library is always available like a native reading app.

## ADDED Requirements

### Requirement: Installable app
The system SHALL be installable from supported browsers to the home screen or app list, with the name "readr", an app icon, and a standalone display without browser controls.

#### Scenario: Install on Android
- **WHEN** the user installs readr from Chrome on Android
- **THEN** a readr icon appears on the home screen, and opening it shows the library in a standalone window

### Requirement: Works offline after first visit
After the app has been loaded once while online, the system SHALL open the library and reader, and read any stored book, with no network connection.

#### Scenario: Open offline
- **WHEN** the device has no connection and the user opens readr
- **THEN** the library loads and lists the stored books

#### Scenario: Read offline
- **WHEN** the device has no connection and the user opens a stored book
- **THEN** the book opens at its saved position and all reader features work

#### Scenario: Never loaded online
- **WHEN** the device has never loaded readr while online
- **THEN** the browser's own offline error is shown, since the app cannot work offline yet

### Requirement: App updates
When a newer version of the app is available, the system SHALL download it in the background and use it the next time the app is opened. It SHALL NOT reload while the user is reading, and it SHALL keep all stored books, positions, bookmarks and settings.

#### Scenario: Update while reading
- **WHEN** a new version is deployed while the user is reading
- **THEN** the current session continues uninterrupted, and the next launch uses the new version with all data intact
