# TC2007B Course App design system

## Product context

The TC2007B Course App is the authenticated classroom workspace behind the public course site. It serves instructors and students, but the signed-in home adapts its hierarchy to the active role. For instructors, the dominant job is operating the current class: confirm course/section/session context, prepare releases, run the live session, then review participation and outcomes. Account and enrollment details are supporting context, not the primary task.

## Design principles

1. Workflow before metadata: show the current class, its state, and the next useful action before profile or role details.
2. One obvious primary action: each state should offer a single emphasized next step; other actions remain visible but quieter.
3. Context is persistent: course, section, and session selectors stay near the top of instructor surfaces.
4. Progressive disclosure: daily teaching tools are immediate; semester setup and audit tools are grouped as secondary navigation.
5. Calm academic utility: clear, trustworthy, information-dense enough for instructors, without looking like a generic enterprise admin panel.
6. Role-aware composition: instructors see teaching operations; students see released materials, current activities, and progress using the same visual language.

## Visual language

Retain the existing Inter and JetBrains Mono families and the existing blue/teal identity. The redesign may change composition, density, hierarchy, and component arrangement, but must not introduce unrelated fonts, decorative gradients, neon colors, glassmorphism, or marketing-page styling.

### Typography

- UI and content: Inter, with Segoe UI and system sans-serif fallbacks.
- IDs, dates, compact metrics, and technical metadata: JetBrains Mono.
- Page title: 28-34px, weight 800, tight tracking.
- Section title: 18-22px, weight 700.
- Card title: 15-17px, weight 700.
- Body: 14-16px, line-height 1.5-1.6.
- Eyebrows and compact labels: 11-12px, weight 700, uppercase, 0.08-0.11em tracking.

### Light colors

- App background: #f4f7fb.
- Primary surface: #ffffff.
- Secondary surface: #eef2f8.
- Tertiary surface: #e4eaf3.
- Default border: #dbe3ee.
- Strong border: #c3cee0.
- Primary text: #12203a.
- Muted text: #55637a.
- Subtle text: #5d6b81.
- Primary blue: #2563eb; hover/strong blue: #1d4ed8.
- Primary soft: #e9f0fe; primary soft border: #cfe0fd.
- Accent teal: #0a6f65; accent soft: #e2f5f2.
- Success: #15803d with #e6f5ec background.
- Warning: #a45a08 with #fbefdc background.
- Danger: #c02636 with #fdeaec background.

### Dark colors

- App background: #0c131f.
- Primary surface: #141d2b.
- Secondary surface: #1b2739.
- Tertiary surface: #223148.
- Default border: #29374d.
- Strong border: #3a4c68.
- Primary text: #eaf1fb.
- Muted text: #a6b4c9.
- Primary blue: #5a9bff; strong blue: #7db0ff.
- Accent teal: #2dd4bf.

### Spacing and shape

- Base spacing rhythm: 4px.
- Common gaps: 8, 12, 16, 20, 24, and 32px.
- Dense control/card padding: 12-16px.
- Primary panel padding: 20-28px.
- Small radius: 8px; standard radius: 12px; major panel radius: 16px; pills: 999px.
- Use borders and restrained surface shifts for grouping. Shadows remain soft and sparse.

## Core layout

- Desktop target: 1440px viewport, content shell approximately 1180-1240px wide.
- Mobile remains fully usable below 760px with stacked regions and 44px minimum controls.
- Instructor home should use a compact application header, persistent teaching-context bar, a dominant current-session/next-action region, and secondary cards or navigation for materials, class health, setup, and review.
- Profile, email, role, and sign-out belong in a compact account area rather than a large dashboard card.
- Avoid empty grid columns and cards whose height is driven by unrelated neighboring content.

## Components

### Buttons

- Primary: blue fill, white text in light theme, 44px minimum height, 8px radius.
- Secondary: secondary surface, strong border, primary text.
- Tertiary/navigation: quiet surface or text treatment; reveal blue/soft-blue on hover and active state.
- Destructive actions use the danger token and are visually separated from routine actions.

### Context selector bar

- Course, section, and session selectors form one coherent control group.
- Show current live state as a semantic status chip.
- The most likely next action sits at the right edge on desktop and below selectors on mobile.

### Current-session panel

- Contains date/title, live or scheduled status, released item counts, participation/response signals when available, and one primary next action.
- A short three-stage model—Prepare, Teach, Review—may show progress, but must not become a decorative stepper detached from real state.

### Cards

- Cards need a clear purpose and a stable height based on their own content.
- Prefer compact summary cards with one metric or action group over large blank containers.
- Released materials show type, release state, class/session association, and direct action in a scannable row.

### Navigation

- Group instructor destinations as Teach, Review, and Manage.
- The current page/area must be explicit.
- Avoid presenting all destinations as an undifferentiated vertical stack of identical cards.

### Feedback and accessibility

- Preserve visible focus rings, semantic live regions, keyboard navigation, reduced-motion behavior, and AA text contrast.
- Loading, empty, success, warning, and error states must not depend on color alone.

## Motion

- Use the existing 160ms ease for hover/focus/selection transitions.
- Limit movement to subtle hover lift or state transitions; no large entrance animations.
- Respect `prefers-reduced-motion`.

## Redesign scope

The first design target is the signed-in instructor dashboard at `app/index.html`. All existing capabilities and routes remain available. The design exploration changes information architecture and presentation only; authentication, permissions, Supabase data contracts, and release logic are unchanged.
