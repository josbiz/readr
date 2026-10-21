# Spec Delta

## Purpose

Bookmarks let the user mark places in a book and return to them later, and they stay valid when the layout or font size changes.

## ADDED Requirements

### Requirement: Toggle a bookmark at the current page
The system SHALL let the user add a bookmark at the current page from the reader toolbar or with the `B` key. If the current page is already bookmarked, the same action SHALL remove that bookmark. In a two-page spread, the bookmark SHALL apply to the left-hand page shown.

#### Scenario: Add bookmark
- **WHEN** the user activates the bookmark control on a page that has no bookmark
- **THEN** a bookmark is saved for that position and the control shows the page as bookmarked

#### Scenario: Remove bookmark from page
- **WHEN** the user activates the bookmark control on a bookmarked page
- **THEN** that bookmark is deleted and the control shows the page as not bookmarked

### Requirement: Bookmark marker on the page
The system SHALL show a ribbon marker on any visible page that contains a bookmarked position.

#### Scenario: Marker shown
- **WHEN** a visible page contains a bookmarked position
- **THEN** a ribbon marker appears at the top of that page

#### Scenario: Marker after re-pagination
- **WHEN** an EPUB is paginated again after a layout or font size change
- **THEN** the marker appears on whichever page now contains the bookmarked text

### Requirement: Bookmarks list
The system SHALL list a book's bookmarks in reading order. Each entry SHALL show its chapter title when known, its page number or percentage, a short excerpt of the text there when available, and when it was created.

#### Scenario: View bookmarks
- **WHEN** the user opens the bookmarks panel
- **THEN** the book's bookmarks are listed in reading order with their details

#### Scenario: No bookmarks
- **WHEN** the user opens the bookmarks panel for a book with no bookmarks
- **THEN** the panel explains how to add one

### Requirement: Navigate to and delete bookmarks
The system SHALL go to a bookmark's position when it is selected in the list, and SHALL let the user delete a bookmark from the list.

#### Scenario: Jump to bookmark
- **WHEN** the user selects a bookmark in the list
- **THEN** the reader shows the page containing that position and the panel closes

#### Scenario: Delete from list
- **WHEN** the user deletes a bookmark from the list
- **THEN** it is removed from the list and its page marker disappears

### Requirement: Bookmarks persist
The system SHALL keep bookmarks on the device for each book across sessions until the user deletes them or removes the book.

#### Scenario: Bookmarks after reload
- **WHEN** the user reloads the app and opens a book with bookmarks
- **THEN** the same bookmarks are listed and marked
