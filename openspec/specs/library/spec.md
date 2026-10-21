# library Specification

## Purpose

The library is the app's home screen. It stores the user's PDF and EPUB files on their device and shows recently read books so the user can pick up where they left off.

## Requirements

### Requirement: Library is the initial view
The system SHALL show the library when the app is opened at its root address.

#### Scenario: First launch with no books
- **WHEN** the user opens the app for the first time
- **THEN** the library is shown with an empty state that explains how to add a PDF or EPUB file

#### Scenario: Launch with books
- **WHEN** the user opens the app and the library contains books
- **THEN** the library lists those books

### Requirement: Import books from local files
The system SHALL let the user add PDF and EPUB files with a file picker and by dropping files onto the library, and SHALL keep each imported file on the device so it can be reopened without selecting it again.

#### Scenario: Import with file picker
- **WHEN** the user selects one or more `.pdf` or `.epub` files with the add-book control
- **THEN** each file appears in the library with its title and author, taken from the file's metadata when present

#### Scenario: Import by drag and drop
- **WHEN** the user drops PDF or EPUB files onto the library
- **THEN** each file is imported as if it had been selected with the file picker

#### Scenario: Title missing from metadata
- **WHEN** an imported file has no title in its metadata
- **THEN** the file name without its extension is used as the title

#### Scenario: Reopen after reload
- **WHEN** the user reloads the app or returns later in the same browser
- **THEN** previously imported books are still listed and can be opened without importing them again

### Requirement: Reject unsupported or unreadable files
The system SHALL reject files that are not readable PDF or EPUB documents and SHALL tell the user which file failed and why, without changing the library.

#### Scenario: Unsupported type
- **WHEN** the user imports a file that is not a PDF or EPUB
- **THEN** the file is not added and a message names the file as unsupported

#### Scenario: Corrupt file
- **WHEN** the user imports a PDF or EPUB that cannot be parsed
- **THEN** the file is not added and a message names the file as unreadable

#### Scenario: Storage full
- **WHEN** the device does not have enough storage left for an imported file
- **THEN** the file is not added and a message says storage is full, while existing books remain intact

### Requirement: Duplicate imports are recognized
The system SHALL identify a book by its file contents, so importing a file already in the library SHALL NOT create a second entry.

#### Scenario: Same file imported twice
- **WHEN** the user imports a file whose contents match a book already in the library
- **THEN** no new entry is created, and the existing entry keeps its reading position and bookmarks

### Requirement: Book entry details
Each library entry SHALL show a cover image, title, author when known, file format, reading progress as a percentage, and a finished badge when the book is finished.

#### Scenario: Cover fallback
- **WHEN** a book has no usable cover image
- **THEN** its entry shows a generated cover with the book's title

#### Scenario: Progress shown
- **WHEN** the user has read part of a book
- **THEN** its entry shows the percentage of the book read at the last saved position

### Requirement: Sorting the library
The system SHALL sort the library by recently opened by default, and SHALL also offer sorting by title, by author and by progress. The chosen sort SHALL be remembered across sessions.

#### Scenario: Default recent order
- **WHEN** the sort is recently opened and the user opens a book and returns to the library
- **THEN** that book is listed first, and books never opened are ordered by import time after the opened ones

#### Scenario: Sort by title
- **WHEN** the user selects sort by title
- **THEN** books are listed alphabetically by title using the interface language's collation, ignoring case and accents

#### Scenario: Sort by author
- **WHEN** the user selects sort by author
- **THEN** books are listed alphabetically by author, with books without an author last

#### Scenario: Sort by progress
- **WHEN** the user selects sort by progress
- **THEN** books are listed from most read to least read

### Requirement: Grid and list views
The system SHALL show the library either as a grid of covers or as a compact list, and SHALL remember the chosen view across sessions.

#### Scenario: Switch to list
- **WHEN** the user selects the list view
- **THEN** books are shown as rows with a small cover, title, author, progress and finished badge

#### Scenario: Switch to grid
- **WHEN** the user selects the grid view
- **THEN** books are shown as cover cards that fit the screen width

### Requirement: Finished books
The system SHALL mark a book as finished when the reader reaches its last page or view. The user SHALL be able to mark any book finished or not finished from the library.

#### Scenario: Reaching the end
- **WHEN** the user reaches the last page or view of a book
- **THEN** the book is marked finished and shows the finished badge in the library

#### Scenario: Manual toggle
- **WHEN** the user marks a book as finished or not finished from its library entry
- **THEN** the badge updates and the reading position is unchanged

#### Scenario: Unmarked book read to the end again
- **WHEN** the user has unmarked a finished book and reaches its last page again
- **THEN** the book is marked finished again

### Requirement: Open a book from the library
The system SHALL open a book in the reader when the user activates its entry with a pointer or the keyboard.

#### Scenario: Open book
- **WHEN** the user clicks or presses Enter on a book entry
- **THEN** the reader opens that book

### Requirement: Remove a book
The system SHALL let the user remove a book from the library after confirming, and SHALL delete its stored file, reading position and bookmarks.

#### Scenario: Confirmed removal
- **WHEN** the user chooses to remove a book and confirms
- **THEN** the book disappears from the library and its file, position and bookmarks are deleted from the device

#### Scenario: Cancelled removal
- **WHEN** the user chooses to remove a book and cancels
- **THEN** the book and its data are unchanged
