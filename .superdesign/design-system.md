# Mahdi Zareei Academic Portfolio Design System

## Product context

This is the public academic portfolio of Mahdi Zareei, Research Professor at Tecnologico de Monterrey. It serves prospective students, research collaborators, academic peers, funding partners, and current students. The public Jekyll site includes the homepage, biography, research themes, publications, funded projects, students, teaching and course pages, CV, blog, news, and contact. Self-contained lecture microsites and the authenticated Course App retain their own design systems and are outside this redesign.

## Chosen direction

Use a modern editorial academic style: credible, calm, highly readable, and distinctive without resembling a corporate dashboard or generic portfolio template. The experience should feel like a strong research profile and a well-edited scholarly publication. Preserve all existing URLs, content collections, light/dark theme support, and accessible semantics.

## Design principles

1. Research first: visitors should understand expertise, current work, and scholarly credibility within the first viewport.
2. Editorial hierarchy: use strong display typography, measured line lengths, clear section rhythm, and restrained ornament.
3. Evidence over decoration: publication counts, active projects, research themes, courses, and profile links carry the visual weight.
4. Progressive depth: the homepage summarizes; subpages provide dense details without becoming visually flat.
5. Honest content: never display TODO placeholders, fabricated news, incomplete names, or broken image states.
6. One system across routes: shared navigation, page mastheads, cards, tags, lists, calls to action, and footer.
7. Accessible by default: AA contrast, visible focus, semantic landmarks, 44px mobile targets, reduced motion, and keyboard-safe navigation.

## Brand and visual language

The palette evolves the existing blue academic identity into ink navy, cobalt, and research teal on warm paper-like surfaces. Avoid purple, neon, glassmorphism, decorative gradients, and oversized marketing-style hero text.

### Typography

- Display and editorial headings: Source Serif 4, with Georgia and serif fallbacks.
- UI, navigation, labels, metadata, and body: Inter, with system sans-serif fallbacks.
- Homepage title: clamp(2.75rem, 4.8vw, 4rem), weight 650, tight line height.
- Subpage title: clamp(2.35rem, 4.2vw, 3.65rem), weight 650.
- Section title: clamp(1.65rem, 3vw, 2.45rem), weight 620.
- Card title: 1.1-1.3rem, weight 650.
- Body: 16-18px, 1.65-1.75 line-height, maximum 68 characters for prose.
- Eyebrow: 11-12px, weight 700, uppercase, 0.12em tracking.
- Metadata: 13-14px, medium weight.

### Light tokens

- Page background: #f7f8f6.
- Primary surface: #ffffff.
- Secondary surface: #f0f3f2.
- Ink: #10213a.
- Strong ink: #07162b.
- Muted text: #5e6b7c.
- Subtle text: #738093.
- Border: #dce3e2.
- Strong border: #c6d2d1.
- Primary cobalt: #2357d8.
- Primary hover: #183f9f.
- Primary soft: #e8eefc.
- Research teal: #087b72.
- Teal soft: #e1f2ef.
- Warm highlight: #d9772a.
- Warm soft: #fff0e4.
- Success: #177245.

### Dark tokens

- Page background: #0b1320.
- Primary surface: #111d2d.
- Secondary surface: #172537.
- Ink: #edf3f7.
- Strong ink: #ffffff.
- Muted text: #a8b5c3.
- Subtle text: #8594a7.
- Border: #29384a.
- Strong border: #3b4d62.
- Primary cobalt: #82a9ff.
- Primary hover: #adc5ff.
- Primary soft: rgba(80, 126, 235, 0.18).
- Research teal: #45d1c4.
- Teal soft: rgba(69, 209, 196, 0.14).
- Warm highlight: #f0a66b.
- Warm soft: rgba(240, 166, 107, 0.14).

### Layout and spacing

- Maximum site shell: 1180px; reading column: 720px.
- Header height: 72px desktop, 64px mobile.
- Base spacing unit: 4px; common spaces: 8, 12, 16, 24, 32, 48, 64, 88px.
- Standard page padding: clamp(36px, 4vw, 64px); larger section transitions may use up to 88px.
- Small radius: 10px; cards: 18px; feature panels: 24px; pills: 999px.
- Shadows: sparse and soft; rely primarily on border, surface, and spacing.
- Use a subtle 1px grid or hairline rule as an editorial motif, never a busy background texture.

## Shared layout

### Header

- Sticky, calm top bar with brand at left and primary navigation at right.
- Brand treatment: small monogram tile `MZ` plus full name.
- Desktop navigation: Home, Research, Publications, Projects, Teaching, People, CV; Contact is a compact outlined action.
- Mobile navigation is a full-width disclosure below the bar, closes on selection/outside/Escape, and preserves focus.
- Theme toggle remains available and clearly labeled to assistive technology.

### Homepage hero

- Two-column desktop layout: narrative and actions on the left; portrait and compact credibility card on the right.
- Eyebrow identifies role and institution.
- Main line communicates the research intersection: secure intelligent systems for people and connected environments.
- Include concise bio, primary CTA to Research, secondary CTA to Publications, and icon profile links.
- Portrait must use the real local profile image, with a restrained 4:5 crop.
- At a 1280 × 800 laptop viewport, the complete headline, portrait, introduction, actions, and profile links remain visible above the fold.
- A compact evidence rail below the hero shows publication count from data, active projects from data, IEEE Senior Member, and SNI Level I.

### Subpage masthead

- Eyebrow identifies the section; compact editorial title and concise subtitle.
- At laptop height, substantive page content begins within the first half of the viewport rather than below a presentation-style title field.
- Optional supporting stat or action aligned right on wide screens.
- Use the same masthead across page, course, and post layouts.

### Footer

- Three-part editorial footer: short identity statement, grouped navigation, academic profile links and copyright.
- Do not repeat every route as a tiny undifferentiated line.

## Components

### Buttons and links

- Primary button: cobalt fill, white text, 46px minimum height, 12px radius.
- Secondary: transparent or surface fill with strong border.
- Text arrow links: compact, strong ink/cobalt, animated underline only.
- All interactive states have a 3px visible focus ring.

### Research cards

- Numbered or labeled cards with title, concise description, and only verified connections.
- Do not render empty or TODO metadata rows.
- Use teal for research-area accents and cobalt for links.

### Publication list

- Preserve year accordions and source links.
- Strong title/author/venue hierarchy with compact type badges.
- Controls sit in a restrained toolbar; rows have generous but efficient vertical rhythm.

### Project and teaching cards

- Cards use status/kicker, title, concise description, key metadata, and one clear destination.
- Active projects may receive a teal top rule; completed projects remain quieter.
- Course cards distinguish courses with available materials from overview-only courses without displaying TODOs.

### People and CV entries

- People are rendered as privacy-safe role cards when a name is unavailable.
- CV uses an editorial timeline/list treatment with dates aligned in a stable column.

### Empty states

- Replace public TODO markers with honest, polished empty states or omit incomplete metadata.
- News with no verified entries should state that updates will be added, not show fabricated announcements.

## Motion

- 160-220ms ease-out for hover, menu, theme, and disclosure transitions.
- Card lift is at most 2px.
- No entrance choreography or parallax.
- Respect prefers-reduced-motion.

## Responsive behavior

- Desktop: hero split and multi-column cards within 1180px shell; title and portrait remain fully visible at 1280 × 800.
- Tablet: two-column content where it remains readable; navigation collapses below 880px.
- Mobile: single-column layout, hero title stays below 3.25rem, portrait follows main copy, buttons become comfortably tappable without always forcing full width.
- No horizontal scrolling at 390px, including publications, CV metadata, and course tables.

## Content and scope guardrails

- Preserve public route URLs and Jekyll data sources.
- Do not redesign the authenticated Course App, lecture decks, or course-material microsites in this project; link to them from the redesigned public course pages.
- Do not invent publications, students, news, awards, grants, affiliations, or metrics.
- Use known facts already present in configuration, CV, publications, and funded-project data.
