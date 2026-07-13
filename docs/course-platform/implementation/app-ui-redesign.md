# TC2007B Course App — UI/UX Redesign Decisions

This document records the design decisions behind the visual and interaction
redesign of the authenticated course app
(`assets/course-materials/information-security/app/`). It explains what was
wrong, what changed, and what was deliberately left alone, so future work stays
consistent. It is public-safe: it contains no rosters, secrets, or live evidence.

## 1. Problem diagnosis

The app worked but its visual layer was improvised, not designed:

- **Wrong foundation.** Every app page loaded the **dark** lecture-deck engine
  stylesheet (`../week-01/mission-01/style.css`) and then forced a **light**
  theme on top via `app.css`. The two collided: orphaned dark controls (the
  "Course" / "Course App" back-buttons rendered as dark pills on a light page),
  a slide "scoreboard" widget repurposed as a meaningless label ("Email · sign
  in", "CSV · export"), low-contrast teal-on-white eyebrows, and slide-sized
  headings (up to 3.5rem) on an admin screen.
- **No dark mode.** The main academic site and the lecture decks both support
  dark mode; the course app did not, despite reusing a stylesheet whose native
  theme *was* dark.
- **Coupling that the project rules forbid.** `CLAUDE.md` states the deck engine
  (`style.css`) is "copied verbatim, never edited." Styling the app through it
  meant the app's look was hostage to a file it must not touch, and shared with
  an actual lecture deck (`week-01/mission-01/`).
- **Flat hierarchy.** Almost every label, button, and status line used
  font-weight 800–900, so nothing stood out.
- **Confusing sign-in.** Email and one-time-code were shown as two side-by-side,
  equal-looking cards, hiding the real sequence ("send email first, *then*
  optionally enter a code").
- **Weak empty/data states.** e.g. the gradebook rendered a bare table header
  with no body and no "no data" message, which reads as broken.

## 2. Core decision: give the app its own design system

The app now owns a **self-contained** stylesheet (`app/app.css`) and no longer
depends on the lecture-deck engine. This:

- removes the light-over-dark override collisions;
- respects the "never edit the deck engine" rule and decouples the app from a
  slide deck;
- makes real light **and** dark themes possible from one token set;
- gives the admin/data surfaces (tables, forms, stat tiles) components they
  actually need, which a slide stylesheet never provided.

`app.css` redefines **every** class the pages use — both the former deck classes
(`mission-shell`, `mission-top`, `back-link`, `eyebrow`, `mission-score`,
`mission-card`, `lead`, `field`, `actions`, `status`, `btn`…) and the app
classes — so the deck `<link>` could be dropped with **no markup changes** on 17
of 18 pages.

## 3. Visual language

- **Type.** Inter for UI, JetBrains Mono for identifiers and numeric data (IDs,
  scores, stats). A restrained scale; headings at 700–800, body at 400–500.
  Weight is used for hierarchy, not as a default.
- **Color.** One **blue primary** (`#2563eb` light / `#5a9bff` dark) for actions,
  a **teal accent** (`#0d8f82` / `#2dd4bf`) for eyebrows and highlights — a
  palette harmonized with both the academic site's blue and the decks'
  blue+teal. Semantic status colors (good/warn/danger) with soft-tint
  backgrounds and a small status dot.
- **Surfaces.** A three-step surface ramp (page → card → inset) with one border
  color and a shadow scale, so nesting reads without heavy outlines.
- **Radii & motion.** A small radius ramp (8/12/16/pill) and short, consistent
  transitions that are fully disabled under `prefers-reduced-motion`.

## 4. Theming contract

Tokens live in three places that stay in sync:

1. `:root` — light tokens (default).
2. `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` — the OS
   preference drives dark automatically **unless** the user forced light.
3. `:root[data-theme="dark"]` — an explicit choice always wins over the OS.

`app/app-theme.js` (loaded in each page's `<head>`, so it runs before first
paint — no flash) applies any saved choice, injects one accessible toggle
button, and persists the choice under an **app-specific** key
(`tc2007b.app-theme`) so it never collides with the main site's `theme` key or
the decks' `tc-theme` key. If `localStorage` is unavailable the theme still
applies for the current page.

## 5. Interaction / IA improvements

- **Sign-in** is now a single-column, numbered two-step flow: *1)* enter
  institutional email → *Send sign-in email*; *2)* open the emailed link on this
  device, or enter a one-time code if shown. The passwordless model is stated up
  front. (All IDs and the strings a verifier checks — `Send sign-in email`,
  `Optional one-time code`, etc. — were preserved.)
- **Dashboard** is split into a student "Your course" zone (profile, roles,
  enrollment, released materials — the materials card is emphasized) and a
  visually separated "Teaching console" zone (context switchers + teacher
  actions), instead of one flat 7-card grid mixing both audiences.
- **Tables** get sticky, uppercase, muted headers; row hover; and a clear
  selected state (soft primary fill + a left accent bar). **Stat tiles** show
  monospaced figures. **QR codes** keep a white plate in every theme so they
  always scan.
- **Accessibility.** Visible focus rings on all interactive elements, a declared
  `color-scheme`, status conveyed by text/tone plus a dot (not color alone),
  and reduced-motion support.

## 6. What was deliberately preserved

- **No behavior changes.** All element IDs, `<ul>`/`<div>` container types, and
  the classes the JS keys off were kept, so `app.js` and every `*-api.js` /
  page script work unchanged.
- **No backend changes.** No migrations, Edge Functions, or `platform-config.js`
  values were touched.
- **Verifier markers** required by `tools/verify-auth-app-shell.js` and
  `tools/verify-auth-teacher-context-switchers.js` were kept intact.

## 7. Validation

- **Visual:** rendered with headless Chromium in light and dark at desktop and
  mobile widths — sign-in, dashboard, gradebook, content library, sessions, and
  progress pages — and iterated until coherent.
- **Regression:** the full local suite (`node tools/verify-*.js`, 50 scripts)
  passes after the change.
- **Contrast:** after an independent audit, the light-mode accent (eyebrow) and
  subtle-text tokens were darkened until all body/label text clears WCAG AA
  (≥4.5:1); light and dark pairs were re-checked programmatically (5.0–6.0:1).
- Live Supabase behavior is unaffected and its launch gates
  (see `supabase-launch-checklist.md`) are unchanged by this redesign.

## 8. Recommended follow-ups (not in this change)

- Add explicit **loading skeletons and empty-state rows** in the page scripts
  (e.g. gradebook/roster tables) so first paint and "no data yet" read
  intentionally rather than as an empty header.
- Consider consolidating the 11+ teacher tool pages into a single tabbed console
  to reduce navigation sprawl (larger change; touches JS).
- Add the Inter 600 weight to the font request if a semibold tier is wanted
  (currently the design uses 400/500/700/800, all already loaded).
