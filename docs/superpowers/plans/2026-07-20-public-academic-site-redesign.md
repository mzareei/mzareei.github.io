# Public Academic Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrow placeholder-heavy public Jekyll site with the approved editorial academic portfolio across the homepage, standard pages, course pages, and posts while preserving routes, real content, accessibility, and GitHub Pages compatibility.

**Architecture:** Keep Jekyll/Liquid as the rendering layer, centralize the visual system in `assets/css/style.scss`, centralize shared structure in `_includes/` and `_layouts/`, and keep behavior in the dependency-free `assets/js/main.js`. Add one source verifier for structural/content contracts and use a generated `_site` build for link and rendering checks.

**Tech Stack:** Jekyll, Liquid, SCSS, vanilla JavaScript, Node.js verification scripts, GitHub Pages.

## Global Constraints

- Preserve existing public route and collection permalinks.
- Use Source Serif 4 for display type and Inter for UI/body type.
- Use the semantic light/dark tokens in the approved design spec; do not add Tailwind or a client framework.
- Do not redesign `assets/course-materials/**` or the authenticated Course App.
- Do not invent publications, students, news, awards, grants, affiliations, or metrics.
- No visitor-facing `TODO`, `[Your Full Name]`, `[Add ...]`, or broken-image state may render.
- Mobile navigation must be keyboard-safe and no public page may scroll horizontally at 390px.

## File Structure

- `tools/verify-public-site-design.js`: source and built-site contract verifier.
- `assets/css/style.scss`: public-site tokens, components, route layouts, responsive rules, and themes.
- `assets/js/main.js`: theme and accessible mobile navigation behavior.
- `_includes/head.html`: fonts and global metadata/assets.
- `_includes/header.html`: shared brand, route navigation, mobile trigger, and Contact action.
- `_includes/footer.html`: grouped editorial footer.
- `_includes/profile-links.html`: shared academic-profile controls.
- `_includes/project-card.html`: evidence-led project card.
- `_layouts/default.html`, `_layouts/page.html`, `_layouts/course.html`, `_layouts/post.html`: shared route structures.
- `index.html`: editorial homepage.
- `about.md`, `research.html`, `publications.html`, `projects.html`, `teaching.html`, `students.html`, `cv.html`, `blog.html`, `news.html`, `contact.md`: public route content.
- `_data/research.yml`, `_data/news.yml`, `_data/students.yml`: factual, privacy-safe public data.
- `_courses/*.md`, `_posts/2026-03-10-example-talk.md`: placeholder suppression.
- `assets/images/profile.jpg`: corrected portrait path.

---

### Task 1: Establish the Public-Site Contract and Shared Editorial Shell

**Files:**
- Create: `tools/verify-public-site-design.js`
- Modify: `_includes/head.html`
- Modify: `_includes/header.html`
- Modify: `_includes/footer.html`
- Modify: `_layouts/default.html`
- Modify: `_layouts/page.html`
- Modify: `_layouts/post.html`
- Modify: `_layouts/course.html`
- Modify: `assets/js/main.js`
- Modify: `assets/css/style.scss`

**Interfaces:**
- Consumes: Jekyll `site`, `page`, `relative_url`, and existing `profiles` values.
- Produces: `.site-header`, `.site-nav`, `.site-masthead`, `.site-footer`, `setNavigation(open, returnFocus)`, and the design-token contract used by every later task.

- [ ] **Step 1: Create the failing source verifier**

Create a Node verifier with these source contracts:

```js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function requireMarkers(relativePath, label, markers) {
  const source = read(relativePath);
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${label} missing: ${marker}`);
  }
}

requireMarkers("assets/css/style.scss", "Public theme", [
  '--font-sans: "Inter"',
  '--font-display: "Source Serif 4"',
  "--site-max: 1180px",
  ".site-masthead",
  ".editorial-grid",
  "@media (max-width: 880px)"
]);

requireMarkers("_includes/header.html", "Header", [
  'class="brand-mark"',
  'href="{{ \'/research/\' | relative_url }}"',
  'href="{{ \'/projects/\' | relative_url }}"',
  'href="{{ \'/students/\' | relative_url }}"',
  'href="{{ \'/contact/\' | relative_url }}"'
]);

requireMarkers("assets/js/main.js", "Navigation behavior", [
  "setNavigation",
  'event.key === "Escape"',
  "nav.contains(document.activeElement)",
  'setAttribute("aria-expanded"'
]);

if (failures.length) {
  console.error("Public site design verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Public site design verification passed.");
```

- [ ] **Step 2: Run the verifier to confirm RED**

Run: `node tools/verify-public-site-design.js`

Expected: failure beginning with `Public theme missing: --font-sans: "Inter"`.

- [ ] **Step 3: Replace the shared typography and token foundation**

In `_includes/head.html`, replace the Roboto request with:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,650&display=swap">
```

In `style.scss`, define the approved semantic variables and foundations:

```scss
:root {
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: "Source Serif 4", Georgia, serif;
  --page: #f7f8f6;
  --surface: #ffffff;
  --surface-subtle: #f0f3f2;
  --ink: #10213a;
  --ink-strong: #07162b;
  --muted: #5e6b7c;
  --subtle: #738093;
  --border: #dce3e2;
  --border-strong: #c6d2d1;
  --primary: #2357d8;
  --primary-hover: #183f9f;
  --primary-soft: #e8eefc;
  --teal: #087b72;
  --teal-soft: #e1f2ef;
  --warm: #d9772a;
  --warm-soft: #fff0e4;
  --site-max: 1180px;
  --reading-max: 720px;
  --radius-sm: 10px;
  --radius: 18px;
  --radius-lg: 24px;
  --ring: 0 0 0 3px color-mix(in srgb, var(--primary) 34%, transparent);
  --ease: 180ms cubic-bezier(.2, 0, 0, 1);
}
```

Add matching `[data-theme="dark"]` values from the spec and apply `font-display` only to headings/brand, not body text.

- [ ] **Step 4: Replace header, masthead, footer, and route layouts**

Use an `MZ` brand mark, the seven primary routes, Contact action, theme toggle, and mobile disclosure. Standardize page headers through:

```html
<header class="site-masthead">
  <p class="eyebrow">{{ page.eyebrow | default: page.title }}</p>
  <h1 class="site-masthead__title">{{ page.title }}</h1>
  {% if page.subtitle %}<p class="site-masthead__subtitle">{{ page.subtitle }}</p>{% endif %}
</header>
```

Keep post/course-specific metadata below the same masthead.

- [ ] **Step 5: Implement accessible theme and navigation behavior**

Use one state function:

```js
function setNavigation(open, returnFocus) {
  nav.classList.toggle("is-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
  nav.toggleAttribute("inert", !open && mobileNavigation.matches);
  nav.setAttribute("aria-hidden", String(!open && mobileNavigation.matches));
  if (returnFocus) navToggle.focus();
}
```

Add Escape, outside-click, link-selection, and media-query synchronization. Keep the theme key `theme` and update `aria-pressed`/label after toggling.

- [ ] **Step 6: Verify and commit the shared shell**

Run:

```powershell
node tools\verify-public-site-design.js
node --check assets\js\main.js
git diff --check
```

Expected: all exit 0.

Commit: `feat: establish editorial academic site shell`

---

### Task 2: Build the Editorial Homepage and Remove Public Placeholder States

**Files:**
- Modify: `tools/verify-public-site-design.js`
- Modify: `index.html`
- Modify: `_config.yml`
- Rename: `assets/images/profile.jpg.jpg` to `assets/images/profile.jpg`
- Modify: `_data/news.yml`
- Modify: `_posts/2026-03-10-example-talk.md`
- Modify: `assets/css/style.scss`

**Interfaces:**
- Consumes: `site.data.publications`, `site.data.projects`, `site.data.research`, `site.profiles`, and homepage tokens from Task 1.
- Produces: `.home-hero`, `.evidence-rail`, `.research-preview`, `.project-preview`, `.publication-preview`, and factual homepage content.

- [ ] **Step 1: Extend the verifier for homepage and honesty contracts**

Require these markers:

```js
requireMarkers("index.html", "Homepage", [
  "home-hero",
  "Secure intelligent systems",
  "evidence-rail",
  "site.data.publications | size",
  "where: \"status\", \"active\"",
  "assets/images/profile.jpg"
]);

const publicSources = [
  "index.html", "about.md", "research.html", "projects.html", "teaching.html",
  "students.html", "news.html", "blog.html", "contact.md"
];
for (const relativePath of publicSources) {
  const source = read(relativePath);
  for (const forbidden of ["[Your Full Name]", "class=\"todo\""]) {
    if (source.includes(forbidden)) failures.push(`${relativePath} exposes placeholder: ${forbidden}`);
  }
}
```

- [ ] **Step 2: Run RED**

Run: `node tools/verify-public-site-design.js`

Expected: homepage marker and placeholder failures.

- [ ] **Step 3: Correct the portrait and homepage content**

Run: `git mv assets/images/profile.jpg.jpg assets/images/profile.jpg`.

Replace the homepage with:

- two-column `.home-hero`;
- real portrait with no `onerror` suppression;
- research and publication calls to action;
- profile links;
- evidence rail derived from publications and active projects;
- three research themes;
- up to three active projects;
- three latest publications;
- contact callout.

Use this positioning statement exactly:

```html
<h1>Secure intelligent systems for people and connected environments.</h1>
```

Use only existing biography facts in supporting copy.

- [ ] **Step 4: Suppress fabricated content**

Set `_data/news.yml` to an empty YAML list with maintenance comments only. Add `published: false` to the example-talk post. Replace `[Your Full Name]` descriptions in configuration/front matter with Mahdi Zareei.

- [ ] **Step 5: Verify and commit**

Run the public verifier, JavaScript syntax, and `git diff --check`.

Commit: `feat: redesign academic portfolio homepage`

---

### Task 3: Redesign Research, Projects, Teaching, and Course Pages

**Files:**
- Modify: `tools/verify-public-site-design.js`
- Modify: `research.html`
- Modify: `projects.html`
- Modify: `_includes/project-card.html`
- Modify: `teaching.html`
- Modify: `_layouts/course.html`
- Modify: `_data/research.yml`
- Modify: `_courses/data-science.md`
- Modify: `_courses/distributed-systems.md`
- Modify: `_courses/network-fundamentals.md`
- Modify: `assets/css/style.scss`

**Interfaces:**
- Consumes: shared cards/masthead and real research/project/course data.
- Produces: `.research-grid`, `.research-card`, `.project-groups`, `.course-grid`, `.course-detail`, and clean overview-course states.

- [ ] **Step 1: Add failing route markers**

Require:

```js
requireMarkers("research.html", "Research", ["research-grid", "forloop.index", "theme.description"]);
requireMarkers("projects.html", "Projects", ["project-groups", "Active projects", "Completed projects"]);
requireMarkers("teaching.html", "Teaching", ["course-grid", "course-card", "course.code"]);
requireMarkers("_layouts/course.html", "Course layout", ["course-detail", "course-page__body"]);
```

Add a verifier loop that rejects `[TODO]` within `_data/research.yml` and the three overview course files.

- [ ] **Step 2: Run RED**

Expected: missing route markers and forbidden content.

- [ ] **Step 3: Implement research and project pages**

Research cards show index, name, description, and only nonblank verified fields. Project cards use status, title, description, role, funding, amount, duration, and optional relationships. Remove inline spacing styles and use shared classes.

- [ ] **Step 4: Implement teaching and course pages**

Course cards show code/level/semester when present, description, and availability label. Information Security receives `Course App available`; other courses receive `Course overview` without false material claims.

Replace draft course bodies with short factual overview paragraphs and remove visitor-facing incomplete week scaffolding.

- [ ] **Step 5: Verify and commit**

Run the public verifier and diff check.

Commit: `feat: redesign research projects and teaching pages`

---

### Task 4: Improve Publications, People, and CV Information Design

**Files:**
- Modify: `tools/verify-public-site-design.js`
- Modify: `publications.html`
- Modify: `students.html`
- Modify: `_data/students.yml`
- Modify: `cv.html`
- Modify: `assets/css/style.scss`

**Interfaces:**
- Consumes: shared masthead, tokens, publication/student/project data.
- Produces: `.publication-toolbar`, `.pub-year`, `.people-groups`, `.person-card`, `.cv-layout`, and `.cv-nav`.

- [ ] **Step 1: Add failing structural/privacy checks**

Require publication toolbar, people-card, and CV layout markers. Reject student names beginning with `[` in `_data/students.yml`.

- [ ] **Step 2: Run RED**

Expected: missing markers and placeholder student names.

- [ ] **Step 3: Restyle publications without changing data behavior**

Keep year details, expand/collapse buttons, type tags, DOI/Scopus/PDF/code links, author emphasis, venue, and citations. Add `data-year` consistently and use responsive link wrapping.

- [ ] **Step 4: Make people rendering privacy-safe**

Replace unavailable names in data with blank values. In Liquid, use group-aware fallbacks:

```liquid
{% if s.name and s.name != "" %}
  {{ s.name }}
{% elsif g == "phd" %}
  Doctoral researcher
{% elsif g == "msc" %}
  Master's researcher
{% else %}
  Research mentee
{% endif %}
```

- [ ] **Step 5: Introduce the editorial CV layout**

Add a compact section navigation and wrap existing factual sections in `.cv-layout`/`.cv-main`. Preserve all content and dates; replace the public PDF TODO badge with `PDF version coming soon` in neutral empty-state styling.

- [ ] **Step 6: Verify and commit**

Commit: `feat: improve publications people and cv layouts`

---

### Task 5: Finish About, Blog, News, Contact, and Profile Content

**Files:**
- Modify: `tools/verify-public-site-design.js`
- Modify: `about.md`
- Modify: `blog.html`
- Modify: `news.html`
- Modify: `contact.md`
- Modify: `_includes/profile-links.html`
- Modify: `assets/css/style.scss`

**Interfaces:**
- Consumes: shared page/post layout and known profile/contact facts.
- Produces: `.about-layout`, `.post-index`, `.empty-state`, `.contact-layout`, `.inquiry-card`, and labeled profile links.

- [ ] **Step 1: Add failing route markers and placeholder scan**

Require the five produced class contracts and reject bracketed maintenance copy in these sources.

- [ ] **Step 2: Run RED**

Expected: missing layout markers and Contact placeholder text.

- [ ] **Step 3: Implement the remaining routes**

- About: biography plus verified facts rail.
- Blog: editorial post rows and honest empty state.
- News: timeline/list when entries exist; otherwise one polished empty state.
- Contact: known email, affiliation, office, academic profiles, collaboration pathway, and neutral prospective-student pathway.
- Profile links: keep accessible names and add optional visible labels only where the containing page requests them.

- [ ] **Step 4: Verify and commit**

Commit: `feat: finish academic content and contact pages`

---

### Task 6: Build, Link-Check, and Visually Verify Every Public Template

**Files:**
- Modify: `tools/verify-public-site-design.js`
- Modify: `README.md`
- Modify: `assets/css/style.scss` only for evidence-based responsive fixes.
- Modify: `assets/js/main.js` only for evidence-based interaction fixes.

**Interfaces:**
- Consumes: all prior public route contracts.
- Produces: `_site` verification, documented commands, and production-ready responsive behavior.

- [ ] **Step 1: Extend the verifier to inspect the built site**

If `_site/index.html` exists, recursively inspect generated HTML and fail for:

```js
const forbiddenBuiltText = ["[Your Full Name]", "[TODO", "class=\"todo\""];
```

Require generated `/index.html`, `/research/index.html`, `/publications/index.html`, `/projects/index.html`, `/teaching/index.html`, `/students/index.html`, `/cv/index.html`, `/blog/index.html`, `/news/index.html`, and `/contact/index.html`.

Collect internal root-relative `href` values and verify their generated file/directory target exists, excluding `/assets/course-materials/` because those self-contained assets are verified separately.

- [ ] **Step 2: Run the clean source checks**

```powershell
node tools\verify-public-site-design.js
node --check assets\js\main.js
node tools\verify-course-platform.js
node tools\verify-auth-command-center.js
```

- [ ] **Step 3: Build the Jekyll site**

Run:

```powershell
bundle exec jekyll build
node tools\verify-public-site-design.js
```

Expected: Jekyll exits 0 and the verifier reports both source and built-site contracts passed.

- [ ] **Step 4: Perform browser review**

Inspect at 1440x1000 and 390x844 in light and dark themes:

- homepage hero, portrait, evidence rail, research/project/publication previews;
- Research, Publications, Projects, Teaching, People, CV, Blog, News, Contact;
- one course detail page and one post;
- mobile navigation closed/open, Escape, selection closing, and theme persistence.

Expected: no horizontal scroll, no clipping, no visitor placeholder text, and no broken portrait.

- [ ] **Step 5: Document verification and commit**

Add to `README.md`:

```powershell
bundle exec jekyll build
node tools/verify-public-site-design.js
```

Run `git diff --check`, `git status --short`, and the full verifier set.

Commit: `docs: record public site redesign verification`

## Completion Checklist

- [ ] Shared editorial header, masthead, footer, theme, and navigation work on every public template.
- [ ] Homepage uses the real portrait, factual evidence, research themes, active projects, and latest publications.
- [ ] No visitor-facing placeholder text remains.
- [ ] Research, Projects, Teaching, Publications, People, CV, About, Blog, News, and Contact use the shared system.
- [ ] Course and post templates are responsive and readable.
- [ ] Jekyll build, internal-link verification, public-source verifier, course-platform verifier, and Command Center verifier pass.
- [ ] Desktop/mobile and light/dark visual checks pass.
- [ ] No authenticated Course App or course-material microsite production file changed.
