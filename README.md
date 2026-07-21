# Personal Academic Website

A clean, responsive, lightweight academic website built with [Jekyll](https://jekyllrb.com/)
and hosted on **GitHub Pages**. Content lives in Markdown and simple YAML data files,
so adding publications, students, projects, courses, and news does **not** require
touching the design.

> **Live site:** https://mzareei.github.io/
> **Repo:** https://github.com/mzareei/mzareei.github.io/

---

## 1. Quick start

You do **not** need to build anything to publish. GitHub Pages builds the site
automatically every time you push to the `main` branch.

1. Push these files to the repository's `main` branch.
2. In the repo: **Settings → Pages → Build and deployment**.
   Set **Source = "Deploy from a branch"**, **Branch = `main` / `(root)`**, then **Save**.
3. Wait ~1 minute. Your site appears at `https://mzareei.github.io/`.

### Optional: preview locally

Local preview requires Ruby. Then:

```bash
gem install bundler
bundle install
bundle exec jekyll serve --livereload
# open http://localhost:4000
```

(Changes to `_config.yml` require restarting the server.)

### Optional: verify the TC2007B course platform

The interactive course materials include lecture quizzes, QR classroom tools,
Supabase functions, progress views, and teacher dashboards. Before pushing
course-platform changes, run:

```bash
node tools/verify-course-platform.js
```

The verifier checks question-bank coverage, answer-key shape, JavaScript syntax,
local course links, and accidental server-secret references in public files.

---

## 2. First things to edit

Most identity settings live in **`_config.yml`**:

- `name`, `title`, `affiliation`, `short_summary`, `email`
- `profiles:` — your CV path and links to Google Scholar, ORCID, Scopus, GitHub, LinkedIn, etc.
  (Leave any value as `""` to hide that link.)
- `description`, `keywords` — used for SEO and social sharing.

Optional additions:

- `assets/cv/cv.pdf` — add a downloadable CV when a current version is ready.
- `assets/images/favicon.svg` — replace the provided mark if desired.

---

## 3. Where content lives

| Section | Edit this | Notes |
|---|---|---|
| Home — research, projects, publications | `_data/research.yml`, `_data/projects.yml`, `_data/publications.yml` | auto-pulled |
| About / Bio | `about.md` | short + long bio |
| CV (web) | `cv.html` | pulls publications/projects/students automatically |
| CV (PDF) | `assets/cv/cv.pdf` | the downloadable file |
| Research themes | `_data/research.yml` | one entry per theme |
| Publications | `_data/publications.yml` | grouped by year |
| Projects | `_data/projects.yml` | active / completed / under-review |
| Students | `_data/students.yml` | phd / msc / graduated / undergrad |
| Courses | `_courses/*.md` | one file per course |
| Teaching materials | `assets/slides/<course>/` | PDFs, notebooks, datasets |
| Blog | `_posts/*.md` | one file per post |
| News | `_data/news.yml` | newest first |
| Contact | `contact.md` + `_config.yml` | |

The home page also uses `tagline` and `affiliation_url` from `_config.yml`
for the heading under your name.

Design (colors, fonts, layout) lives in `assets/css/style.scss`.
Page templates live in `_layouts/` and reusable pieces in `_includes/`.
The navigation menu is defined in `_includes/header.html`.

---

## 4. How to add content

### Add a new publication
Open `_data/publications.yml` and add an entry. `type` must be one of
`journal`, `conference`, `book_chapter`, or `preprint`:

```yaml
- title: "Your paper title"
  authors: "Your Name, Co-author A."
  venue: "Journal/Conference name, details"
  year: 2026
  type: journal
  doi: "10.1000/xxxx"      # optional -> becomes https://doi.org/...
  url: ""                   # optional landing page
  pdf: "/assets/pdfs/2026-paper.pdf"   # optional
  code: "https://github.com/..."        # optional
```

### Add a new project
Open `_data/projects.yml`. `status` must be `active`, `completed`, or `review`:

```yaml
- title: "Project title"
  status: active
  description: "Short description."
  role: "Principal Investigator"
  funding_source: "Agency"   # leave "" if none/not public
  amount: ""                  # leave "" if not public
  duration: "2026 – 2028"
  collaborators: "Names"
  related_publications: ""
  related_students: ""
```

### Add a new student
Open `_data/students.yml` and add under `phd`, `msc`, `graduated`, or `undergrad`:

```yaml
phd:
  - name: "Student Name"          # publish names only with consent
    program: "PhD in Computer Science"
    title: "Thesis title"
    status: "In progress (started 2026)"
    topic: "Main research topic"
    outcomes: ""
```

### Add a new class
1. Copy `_courses/example-course.md` to a new file, e.g. `_courses/cs101-fall-2026.md`.
2. Edit the front matter (`title`, `code`, `semester`, `level`, `description`, `topics`, `readings`, `links`).
3. Edit the week-by-week body. It appears automatically on the Teaching page and at `/teaching/<filename>/`.

### Add new lecture slides
1. Put the file in `assets/slides/<course-code>/`, e.g. `assets/slides/cs101/week-01.pdf`.
2. Link it from the matching course page:
   `- Slides: [Lecture 1 (PDF)](/assets/slides/cs101/week-01.pdf)`

### Add a blog post
Create a file in `_posts/` named `YYYY-MM-DD-short-title.md`:

```markdown
---
title: "Your post title"
date: 2026-06-04
description: "One-line summary (shown in the blog list and on the home page)."
tags: [research, talks]
---

Your post content in Markdown.
```

The newest three posts appear automatically under "latest posts" on the home page.

### Add a news/update item
Open `_data/news.yml` and add an entry at the top (newest first):

```yaml
- date: 2026-06-04
  title: "New paper accepted"
  body: "Short description."
```

---

## 5. Folder structure

```
.
├── _config.yml            # site settings & identity (edit first)
├── Gemfile                # local preview dependencies
├── index.html             # Home
├── about.md               # About / Bio
├── cv.html                # Web CV
├── research.html          # Research themes
├── publications.html      # Publications (filterable)
├── projects.html          # Projects
├── students.html          # Students
├── teaching.html          # Course listing
├── blog.html              # Blog listing
├── news.html              # News / updates
├── contact.md             # Contact
├── _courses/              # one Markdown file per course
│   └── example-course.md
├── _posts/                # one Markdown file per blog post
│   └── YYYY-MM-DD-title.md
├── _data/                 # structured content you edit
│   ├── research.yml
│   ├── publications.yml
│   ├── projects.yml
│   ├── students.yml
│   └── news.yml
├── _layouts/              # page templates
├── _includes/             # header, footer, reusable snippets
└── assets/
    ├── css/style.scss     # design / theme
    ├── js/main.js         # theme toggle, mobile nav, pub filters
    ├── cv/                # cv.pdf goes here
    ├── images/            # profile.jpg, favicon, og-image
    ├── pdfs/              # publication PDFs
    └── slides/            # teaching materials by course
```

---

## 6. Features

- Editorial academic design with a wide research-focused layout and reusable page system.
- Responsive layout (desktop + mobile) with accessible contrast.
- Stable light/dark theme toggle (remembers your choice; respects system setting).
- Honest empty states for news and notes until verified entries are published.
- Year-grouped publication archive with accessible expand/collapse controls.
- SEO + Open Graph metadata via `jekyll-seo-tag`; sitemap + RSS feed included.
- All content in Markdown/YAML — no design changes needed to update.

## 7. A note on accuracy

Public pages render verified profile, publication, project, and course data.
Student names remain private unless consent is recorded; anonymous entries use
role-based labels. Draft announcements and example posts are not published.

## 8. Verify the public site

Run the production build and the public-route contract checker before publishing:

```powershell
bundle exec jekyll build
node tools/verify-public-site-design.js
```

The verifier checks the shared design system, required generated routes,
visitor-facing placeholder text, the portrait asset, and internal links.
