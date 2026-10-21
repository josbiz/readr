# appearance Specification

## Purpose

Appearance settings let the user read comfortably in any lighting: a light, sepia or dark theme for the whole app and the book pages, and an adjustable text size for reflowable books.

## Requirements

### Requirement: Theme selection
The system SHALL offer light, sepia, dark and system themes. The system theme SHALL follow the operating system's color scheme (light or dark), and SHALL be used until the user picks another.

#### Scenario: Default follows system
- **WHEN** the user has not chosen a theme and the operating system uses dark mode
- **THEN** the app is shown in the dark theme

#### Scenario: System changes while open
- **WHEN** the theme is system and the operating system switches between light and dark
- **THEN** the app switches theme without a reload

#### Scenario: Explicit choice
- **WHEN** the user chooses light, sepia or dark
- **THEN** the app uses that theme regardless of the operating system setting

### Requirement: Theme applies to pages
The system SHALL apply the theme to both the app chrome and book pages. In the dark theme, EPUB text SHALL be shown light on a dark page, and PDF pages SHALL be shown with inverted lightness while keeping their hues. In the sepia theme, pages SHALL have a warm paper background with dark brown text, and PDF pages SHALL be tinted to match.

#### Scenario: Sepia EPUB
- **WHEN** an EPUB is open in the sepia theme
- **THEN** pages have a warm paper background and dark brown text

#### Scenario: Dark EPUB
- **WHEN** an EPUB is open in the dark theme
- **THEN** pages have a dark background and light text, including chapters whose own styles set black text or a white background

#### Scenario: Dark PDF
- **WHEN** a PDF is open in the dark theme
- **THEN** page backgrounds appear dark and text appears light

### Requirement: PDF original colors
The system SHALL offer an "original colors" option that shows PDF pages exactly as the file defines them in every theme. The option SHALL apply to all PDF books and SHALL only be offered while a PDF is open.

#### Scenario: Original colors in dark theme
- **WHEN** original colors is on and a PDF is open in the dark theme
- **THEN** the pages are shown with their original colors while the reader chrome stays dark

#### Scenario: Original colors off
- **WHEN** original colors is off
- **THEN** PDF pages follow the theme's page coloring

### Requirement: Theme without flash
The system SHALL show the chosen theme from the first paint of every page, without briefly showing the other theme.

#### Scenario: Reload in dark theme
- **WHEN** the user has chosen dark and reloads the app
- **THEN** no light background is shown at any point during loading

### Requirement: EPUB font size
The system SHALL let the user increase and decrease EPUB text size in steps between a fixed minimum and maximum, and SHALL apply the size to all EPUB books. The control SHALL NOT be offered for PDF books.

#### Scenario: Increase font size
- **WHEN** the user increases the font size while reading an EPUB
- **THEN** the text gets larger, the book is paginated again and the reading position is kept

#### Scenario: Limit reached
- **WHEN** the font size is at its maximum or minimum
- **THEN** the control in that direction is disabled

#### Scenario: PDF open
- **WHEN** a PDF is open
- **THEN** no font size control is shown

### Requirement: Settings persist
The system SHALL keep the theme, PDF original colors, layout and font size settings on the device across sessions.

#### Scenario: Settings after reload
- **WHEN** the user changes settings and reloads the app
- **THEN** the same settings are in effect
