# reader Specification

## Purpose

The reader displays a PDF or EPUB book with a calm, book-like interface. The user can choose how pages are laid out, turn pages with a physical page-turn effect, navigate by contents, and always come back to where they stopped.

## Requirements

### Requirement: Render PDF and EPUB books
The system SHALL display PDF books with their original fixed page layout. It SHALL display EPUB books as reflowed text paginated to fit the available page area.

#### Scenario: Open a PDF
- **WHEN** the user opens a PDF book
- **THEN** its pages are shown with their original layout, scaled to fit the page area without distortion

#### Scenario: Open an EPUB
- **WHEN** the user opens an EPUB book
- **THEN** its text is shown in pages that fit the page area, with no horizontal scrolling inside a page

#### Scenario: EPUB re-pagination
- **WHEN** the window size, layout or font size changes while an EPUB is open
- **THEN** the book is paginated again and the text that was at the start of the current page stays visible

### Requirement: EPUB content cannot run code
The system SHALL display EPUB content without executing scripts or event handlers that the book contains, and without loading resources from outside the book.

#### Scenario: Book with embedded script
- **WHEN** an EPUB chapter contains script elements or inline event handlers
- **THEN** the chapter is shown with that code removed and none of it runs

#### Scenario: Book referencing remote resources
- **WHEN** an EPUB chapter references an image or stylesheet at a remote URL
- **THEN** that resource is not requested

### Requirement: Page layouts
The system SHALL offer single-page, two-page spread, auto and continuous-scroll layouts. It SHALL remember the chosen layout across sessions and apply it to every book.

#### Scenario: Single page
- **WHEN** the layout is single page
- **THEN** one page is shown at a time

#### Scenario: Two-page spread
- **WHEN** the layout is two-page spread
- **THEN** two facing pages are shown side by side, with the first page of the book shown alone on the right like a cover

#### Scenario: Auto on a wide screen
- **WHEN** the layout is auto and the reading area is wide enough for two readable pages
- **THEN** a two-page spread is shown

#### Scenario: Auto on a narrow screen
- **WHEN** the layout is auto and the reading area is too narrow for two readable pages
- **THEN** a single page is shown

#### Scenario: Continuous scroll
- **WHEN** the layout is continuous scroll
- **THEN** pages are shown in one vertical column that the user scrolls

#### Scenario: Layout change keeps position
- **WHEN** the user changes the layout while reading
- **THEN** the page being read remains visible in the new layout

### Requirement: Turning pages
In the paged layouts, the system SHALL move forward or back by one view (one page, or one spread) when the user clicks or taps the right or left side of the page area, presses the arrow keys, Page Up/Page Down or Space, or swipes horizontally.

#### Scenario: Next view
- **WHEN** the user clicks the right side of the page area or presses the right arrow
- **THEN** the next page or spread is shown

#### Scenario: Previous view
- **WHEN** the user clicks the left side of the page area or presses the left arrow
- **THEN** the previous page or spread is shown

#### Scenario: Swipe
- **WHEN** the user swipes left or right on a touch screen
- **THEN** the next or previous page or spread is shown, respectively

#### Scenario: Book boundaries
- **WHEN** the user tries to turn forward on the last view or back on the first view
- **THEN** the view does not change and no turn animation plays

### Requirement: Page-turn animation
In the paged layouts, the system SHALL animate each page turn as a page rotating around the book's spine, with shading that suggests a physical sheet. It SHALL show the turn instantly when the user's system asks for reduced motion.

#### Scenario: Animated turn
- **WHEN** the user turns a page in single or spread layout
- **THEN** the outgoing page rotates over to reveal the next content, which is already displayed underneath when the turn finishes

#### Scenario: Rapid turns
- **WHEN** the user triggers several turns quickly
- **THEN** each requested turn is applied in order and the view ends on the correct page

#### Scenario: Reduced motion
- **WHEN** the operating system or browser requests reduced motion
- **THEN** pages change without the rotation animation

### Requirement: PDF zoom
For PDF books the system SHALL offer fit page (default), fit width, zoom in and out in steps between 50% and 400%, and pinch-to-zoom on touch screens. The zoom level SHALL be remembered per book.

#### Scenario: Fit width
- **WHEN** the user selects fit width
- **THEN** each page fills the width of the page area and can be scrolled vertically within the page

#### Scenario: Pinch zoom
- **WHEN** the user pinches on a PDF page on a touch screen
- **THEN** the page zooms around the pinch point and stays sharp after the gesture ends

#### Scenario: Panning while zoomed
- **WHEN** the page is zoomed beyond fit page and the user drags or swipes
- **THEN** the page pans instead of turning, and keys, toolbar buttons and the tap zones still turn pages

#### Scenario: Turning while zoomed
- **WHEN** the user turns the page while zoomed
- **THEN** the next page is shown at the same zoom level, scrolled to its top

#### Scenario: EPUB open
- **WHEN** an EPUB is open
- **THEN** no zoom control is shown

### Requirement: Fullscreen
The system SHALL offer a fullscreen control in the reader that hides the browser interface, and SHALL leave fullscreen when the user exits it or returns to the library.

#### Scenario: Enter fullscreen
- **WHEN** the user activates the fullscreen control
- **THEN** the reader fills the whole screen and the control changes to exit fullscreen

#### Scenario: Leave reader
- **WHEN** the user returns to the library while in fullscreen
- **THEN** fullscreen ends

### Requirement: Back navigation closes panels first
When a panel (contents, bookmarks or settings) is open in the reader, the browser or device back action SHALL close the panel instead of leaving the reader.

#### Scenario: Back with panel open
- **WHEN** the contents panel is open and the user presses the Android back button
- **THEN** the panel closes and the reader stays on the same page

#### Scenario: Back with no panel
- **WHEN** no panel is open and the user presses back
- **THEN** the library is shown

### Requirement: Reader chrome stays out of the way
The system SHALL show only the book's pages while reading. The toolbar and progress bar SHALL appear when the user taps the center of the page area or moves the pointer to the top or bottom edge, and SHALL hide again after a short period without interaction.

#### Scenario: Reveal controls
- **WHEN** the user taps or clicks the center of the page area
- **THEN** the toolbar and progress bar become visible

#### Scenario: Keyboard access
- **WHEN** the user moves keyboard focus into the reader controls
- **THEN** the controls become visible and stay visible while they have focus

#### Scenario: Back to library
- **WHEN** the user chooses the library control in the toolbar
- **THEN** the library is shown

### Requirement: Progress display
The system SHALL show the reader's position as a percentage of the book and as the current page number out of the total. For EPUB, the current chapter title SHALL also be shown.

#### Scenario: PDF progress
- **WHEN** the user is on page 30 of a 120-page PDF
- **THEN** the progress shows page 30 of 120 and 25%

#### Scenario: EPUB progress
- **WHEN** the user is reading an EPUB
- **THEN** the progress shows a percentage, the page out of the total for the current layout and font size, and the current chapter title

### Requirement: Table of contents
The system SHALL show the book's table of contents when the book has one, and SHALL go to the selected entry.

#### Scenario: Navigate by contents
- **WHEN** the user opens the contents panel and selects an entry
- **THEN** the reader shows the start of that entry and the panel closes

#### Scenario: Book without contents
- **WHEN** the book has no table of contents
- **THEN** the contents panel says no contents are available

### Requirement: Resume reading position
The system SHALL save the reading position whenever it changes, and SHALL reopen each book at its last saved position.

#### Scenario: Resume after closing
- **WHEN** the user closes a book and later opens it again
- **THEN** the reader opens at the position where the user stopped

#### Scenario: First open
- **WHEN** the user opens a book for the first time
- **THEN** the reader opens at the start of the book
