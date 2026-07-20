# Extractable components

The current implementation is vanilla HTML/CSS, so these candidates are reusable visual contracts rather than framework components.

## AppShell
- Source: `assets/course-materials/information-security/app/index.html`
- Category: layout
- Description: Centered responsive application shell containing the page header, panels, and status line.
- Extractable props: pageTitle (string, default: "Course App"), eyebrow (string, default: "TC2007B · Authenticated course app"), backHref (string, default: "/teaching/information-security/")
- Hardcoded: semantic main/header structure, shell width, background, typography, theme toggle behavior

## MissionTopHeader
- Source: `assets/course-materials/information-security/app/index.html`
- Category: layout
- Description: Back link, product eyebrow, page title, and descriptive lead.
- Extractable props: pageTitle (string, default: "Course App"), lead (string, default: "Your protected classroom workspace"), backHref (string, default: "/teaching/information-security/")
- Hardcoded: label hierarchy, spacing, divider, typography

## TeachingContextPanel
- Source: `assets/course-materials/information-security/app/index.html`
- Category: layout
- Description: Course, section, and session selectors plus contextual shortcuts for instructors.
- Extractable props: currentCourse (string, default: "TC2007B"), currentSection (string, default: "Section A"), currentSession (string, default: "Current class"), showShortcuts (boolean, default: true)
- Hardcoded: selector labels, shortcut categories, card layout

## ContextCard
- Source: `assets/course-materials/information-security/app/index.html`
- Category: basic
- Description: Labeled summary card used for identity, enrollment, roles, materials, and actions.
- Extractable props: isHighlighted (boolean, default: false), showBadge (boolean, default: true)
- Hardcoded: card padding, border, radius, label and heading styles

## ActionList
- Source: `assets/course-materials/information-security/app/index.html`
- Category: basic
- Description: Grouped navigation links for setup, teaching, and review tasks.
- Extractable props: activeItem (string, default: ""), badgeCount (number, default: 0)
- Hardcoded: action labels, grouping labels, link styling

## PanelHeader
- Source: `assets/course-materials/information-security/app/gradebook.html`
- Category: basic
- Description: Panel title area with eyebrow, heading, explanatory text, and optional actions.
- Extractable props: showActions (boolean, default: true)
- Hardcoded: heading hierarchy and spacing

## FieldStack
- Source: `assets/course-materials/information-security/app/index.html`
- Category: basic
- Description: Label, input/select, hint, and validation/status stack used across forms.
- Extractable props: isDisabled (boolean, default: false), showHint (boolean, default: true)
- Hardcoded: control sizing, border, focus ring, vertical rhythm

## StatusLine
- Source: `assets/course-materials/information-security/app/index.html`
- Category: basic
- Description: Live region for success, loading, warning, and error feedback.
- Extractable props: isVisible (boolean, default: true)
- Hardcoded: status dot, semantic color treatments, typography

## ThemeToggle
- Source: `assets/course-materials/information-security/app/app-theme.js`
- Category: layout
- Description: Fixed light/dark theme switch available on every page.
- Extractable props: isDark (boolean, default: false)
- Hardcoded: sun/moon icons, labels, persistence key, fixed placement