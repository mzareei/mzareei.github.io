# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project Context — Mahdi Zareei's Academic Website

This file travels with the repository so that, on any machine, the assistant starts
with the full project context. It mirrors the project instructions and the memory
notes maintained for this site. Keep it factual; do not invent information. Update it
when status or preferences change, then commit and push.

## Purpose

Personal academic website for **Mahdi Zareei**, presenting his academic profile,
research portfolio, teaching archive, and student/collaborator information. Audiences:
prospective students, current students seeking course materials, collaborators,
reviewers/evaluators, funding agencies, and people searching for his publications/CV.
Prioritize academic credibility, clarity, consistent structure, and long-term
maintainability over decoration. Professional tone; no marketing language. Never
fabricate publications, students, grants, metrics, or affiliations — use clear
placeholders or ask when information is missing.

## Build, preview & deploy

There is **no build step you run** — GitHub Pages builds and deploys the site
automatically on every push to `main` (no Actions workflow; the classic
"Deploy from a branch" Pages pipeline). Editing content = edit files, commit, push.

Local preview is optional and needs Ruby + Bundler:

```bash
bundle install                              # first time only
bundle exec jekyll serve --livereload       # http://localhost:4000
```

- The `github-pages` gem pins the local build to match GitHub's exactly — do not
  add plugins outside GitHub Pages' whitelist (current plugins: `jekyll-feed`,
  `jekyll-seo-tag`, `jekyll-sitemap`).
- Changes to `_config.yml` are **not** live-reloaded — restart `jekyll serve`.
- No test suite, linter, or formatter. "Correct" means: the page renders, links
  resolve, and the dark-mode toggle / pub filters / deck navigation still work.
- Always `git pull` before editing and `git push` before stopping — this repo is
  edited from two machines and GitHub is the single source of truth (see `WORKFLOW.md`).

## Architecture

Two **independent** front-end systems live in one repo; they share visual style but
no code:

**1. The Jekyll site** (everything outside `assets/course-materials/`). Content is
data-driven and decoupled from design:
- `_data/*.yml` holds the actual content (publications, projects, students, news,
  research themes). Page templates (`*.html`, `_layouts/`, `_includes/`) iterate over
  this data — to add a publication you edit YAML, never HTML. Enum-like fields are
  load-bearing: publication `type` ∈ {journal, conference, book_chapter, preprint};
  project `status` ∈ {active, completed, review}; students grouped under
  {phd, msc, graduated, undergrad}. The page filtering JS keys off these values.
- `_courses/*.md` is a Jekyll **collection** (`output: true`), one file per course,
  each rendered at `/teaching/<filename>/` via `_layouts/course.html`.
- `_config.yml` `defaults:` auto-assign layouts by type (pages→page, courses→course,
  posts→post) so content files rarely declare `layout:`.
- `assets/js/main.js` is the entire site's JS: ~50 lines, no dependencies, doing
  three things — theme toggle (persists `theme` in localStorage), mobile nav, and
  publication filtering by year/type (show/hide `.pub-item` elements + their group
  headings). The nav menu is hard-coded in `_includes/header.html`.
- `assets/css/style.scss` is the single stylesheet; the al-folio-inspired look
  (Roboto/Roboto Slab, blue accent, dark mode) is defined here.

**2. The lecture-deck engine** (`assets/course-materials/`). Self-contained HTML
slide decks served as static files (NOT Jekyll pages), one folder per lecture at
`assets/course-materials/<course>/week-NN/lecture[-N]/`. Each deck is a copy of the
template trio:
- `index.html` — the **only** file you edit per lecture; each
  `<section class="slide">` is one slide.
- `script.js` + `style.css` — the **shared engine, copied verbatim, never edited**.
  The engine (`script.js`) provides: keyboard/remote/touch/click navigation,
  click-to-reveal `.fragment` elements (forward shows them one at a time; jumping
  back reveals all), slide overview (`o`), help (`?`), fullscreen (`f`), a slide
  count computed automatically, and deep-linking via `#<slide-number>`.
- **Bilingual mechanism:** text carries a `data-es="…"` attribute; on first load the
  engine snapshots the English into `data-en`, then `applyLang` swaps `innerHTML`
  between them. Inside `data-es` use single quotes for nested tag attributes and
  typographic quotes `" " ¿ ¡` — a straight `"` closes the attribute and breaks the
  slide. SVG diagram text can't take `data-es`, so it's translated by CSS class via
  the hard-coded `svgMap` table in `script.js` (extend it when adding labeled SVGs).
- Lang (`tc-lang`) and theme (`tc-theme`) persist in localStorage under deck-specific
  keys, separate from the main site's `theme` key.
- `assets/course-materials/_template/` is the source of truth; its leading `_` makes
  Jekyll ignore it so it ships in the repo but is never published. Start every new
  deck by copying `_template/lecture/` and read its `HOW-TO-USE.md`. See the
  lecture-deck preferences section below for the content/pedagogy rules.

## Site owner

**Mahdi Zareei** — Research Professor, School of Engineering and Sciences,
Tecnológico de Monterrey, Mexico (since 2019; postdoc there 2017–2019).
PhD from Malaysia-Japan International Institute of Technology, UTM (2016);
MSc from University of Science, Malaysia (2011).

Research areas: information security, applied machine learning, NLP; earlier work in
wireless sensor / cognitive radio networks and communication protocols.

Standing: IEEE Senior Member (since 2020); SNI Level I (Mexico). Associate Editor for
IEEE Access, PLOS One, and Ad Hoc & Sensor Wireless Networks.

Identifiers:
- ORCID 0000-0001-6623-1758
- Scopus author ID 48762315500
- Web of Science ResearcherID D-8043-2013
- Google Scholar user IhVgxzAAAAAJ
- LinkedIn /in/mzareei
- ResearchGate /profile/Mahdi_Zareei
- GitHub mzareei (unconfirmed)
- Public emails: m.zareei@ieee.org, m.zareei@tec.mx
  (Chat-login email zarei.1982@gmail.com is private — do not put it on the public site.)

Funded projects 2023–26 (funded only; exclude rejected/under-review): FRIDA DDoS-SDN/P4,
FRIDA DDoS stacking, FRIDA-7463 uncertainty quantification, Fundación Gonzalo Río Arronte
suicide-risk AI, Microsoft AI for Good Azure in-kind (USD 52,380), and an older Royal
Society IES grant.

## Tech & structure

Lightweight **Jekyll** site on plain GitHub Pages (no Actions build).
Repo: github.com/mzareei/mzareei.github.io · local folder "My Personal Page".

Design intentionally mimics the al-folio look: Roboto + Roboto Slab, blue accent,
photo-beside-bio hero, icon social row, dark-mode toggle.

Content model:
- `_data/*.yml` — publications, projects, students, news, research
- `_courses/*.md` — courses
- `_posts/*.md` — blog
- Top menu kept simple: about · publications · cv · teaching · blog; everything else
  lives in the footer.

## Status (as of 2026-06-05)

Done: identity, bio, research areas, and contact filled from his real CV/bio.

TODO:
- Import 117 publications from his scopus.bib into publications.yml
- Build web CV and add a PDF
- Students / supervision
- Teaching courses
- Profile photo (`assets/images/profile.jpg`)
- Confirm/add Google Scholar, LinkedIn, ResearchGate URLs

He feeds information file-by-file and wants "most important first".

## Lecture-deck preferences (course TC2007B)

- **Enrich, don't just transcribe.** Add extra examples, analogies, and discussion
  questions — especially debate-sparking ones (e.g., "which is worse, a false accept
  or a false reject?", "should biometrics replace passwords?"). Every lecture.
- **Images:** recreate content diagrams as clean web-native visuals (SVG/CSS); drop
  decorative clipart/logos/memes; use a clear placeholder only for live or
  instructor-specific items (Menti codes, unknown QR URLs) while still putting full
  teaching content on the slide so the deck stands alone. Never reproduce textbook
  figures verbatim.
- **Title slide:** no "≈ 2-hour session" pill.
- Decks are bilingual (EN/ES via `data-es`), dark/light toggle, click-to-reveal
  fragments, quiz answers hidden behind a click, nav controls centered at bottom.
- Don't invent facts/figures/citations; flag uncertain numbers with a figure-note.
- Start from `assets/course-materials/_template/lecture/` and follow its HOW-TO-USE.md.

## Multi-machine note

See `WORKFLOW.md`. Pull before you start, push before you stop. This file is the
portable context; the assistant should re-read the live repo files on each machine
rather than rely on memory of a previous session.

---

# Course Platform v2 — where the real documentation lives

The teaching platform (live at https://course-platform-3ko.pages.dev) spans two
repos: the SPA in **`~/Documents/GitHub/course-platform`** and this repo's
`supabase/functions/` + `supabase/migrations/`.

**Its complete, current documentation is in the other repo:**
`~/Documents/GitHub/course-platform/docs/` — start at `00-START-HERE.md`.

That folder covers the project goal, architecture, design system, decision log,
current status with remaining work, the runbook, and a pitfalls file that is
worth reading before debugging anything. `docs/HANDOFF-PROMPT.md` there can be
pasted into a fresh session to continue the work.

In *this* repo:
- `supabase/functions/` — all edge functions (deploy explicitly with
  `npx supabase functions deploy <name>`; they do **not** deploy on git push)
- `supabase/migrations/` — schema (`npx supabase db push --include-all`)
- `docs/professor-guide.md` — the operating guide for class day
- `assets/course-materials/` — original hand-authored lecture decks; the Gen-1
  apps here are frozen
