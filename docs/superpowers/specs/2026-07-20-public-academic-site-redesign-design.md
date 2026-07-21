# Public Academic Site Redesign

Date: 2026-07-20
Status: Approved by delegated user judgment
Superdesign direction: Editorial Research Flagship
Superdesign flow canvas: https://superdesign.dev/teams/951c9f69-2cdd-4b5d-a93a-fc8a7c1f71fb/projects/c8ffcd6d-ee0a-4ff7-9238-06a261fbb2bb

## 1. Objective

Redesign `https://mzareei.github.io/` and its public Jekyll subpages as one coherent academic portfolio. The result must communicate Mahdi Zareei's research program, scholarly evidence, teaching, and collaboration pathways with substantially stronger hierarchy and visual quality while preserving existing public URLs and data sources.

The redesign covers the Jekyll homepage, standard pages, course collection pages, and post pages. It does not restyle self-contained lecture decks, course-material microsites, or the authenticated TC2007B Course App, which retain their own design systems.

## 2. Audit Findings

The current site is functional but visually underpowered:

- The 820px shell is too narrow for research cards, publication metadata, and a distinctive homepage.
- The homepage has no visible portrait because the file is named `profile.jpg.jpg` while the template requests `profile.jpg`.
- Public TODO placeholders appear in the biography, news, research connections, student names, course pages, posts, and contact copy.
- The mobile hero title is oversized relative to the viewport and produces a long, weak first screen.
- Navigation exposes only a subset of important public routes and the footer lists every route without hierarchy.
- Subpages reuse typography and cards but do not share a strong masthead, evidence summary, or editorial rhythm.
- Research cards show incomplete metadata as if it were content.
- Teaching pages mix a production-ready Information Security course with draft course material without distinguishing readiness.
- The visual system uses light font weights and low-contrast secondary text that weaken scanning.

## 3. Approaches Considered

### A. Editorial Research Flagship — selected

A spacious homepage with a two-column research hero, portrait, evidence rail, selected themes, active projects, latest publications, and a structured footer. Subpages use strong mastheads, evidence-led cards, and readable scholarly lists.

This direction best balances authority, personality, and route depth. It is visually distinctive without turning the academic site into a marketing page.

### B. Compact Scholarly Index

A denser, rule-based homepage that prioritizes lists and metadata over narrative. It supports expert scanning well but makes the site less approachable to prospective students and collaborators and underuses the available portrait and project story.

### C. Minimal Evolution

Retain the current narrow al-folio-inspired layout and improve only spacing, color, and cards. This is the lowest-risk option but does not resolve the weak homepage hierarchy or give the diverse subpages enough room.

## 4. Visual Direction

The selected direction is a modern editorial academic portfolio.

- Display type: Source Serif 4.
- UI and body type: Inter.
- Palette: ink navy, cobalt, research teal, warm off-white, and restrained orange highlights.
- Shell: 1180px maximum with a 720px reading column for long prose.
- Surfaces: warm page background, white/ink cards, quiet borders, sparse shadows.
- Shape: 10px controls, 18px cards, 24px feature panels.
- Motion: 160-220ms subtle transitions, 2px maximum lift, no entrance choreography.
- Themes: full light and dark support using shared semantic tokens.

The final CSS must be standalone Jekyll-compatible SCSS. Superdesign HTML is visual reference, not production code; no Tailwind runtime or new JavaScript framework will be introduced.

## 5. Shared Information Architecture

### Header

The shared sticky header contains:

- `MZ` monogram and Mahdi Zareei brand link.
- Home, Research, Publications, Projects, Teaching, People, and CV routes.
- A distinct Contact action.
- Theme toggle.
- Accessible mobile disclosure below 880px with Escape, outside-click, selection closing, and focus restoration.

The active route must be explicit. The mobile menu must not remain keyboard-accessible while closed.

### Page masthead

All standard pages use a shared masthead with an eyebrow, display title, and short subtitle. Pages may add one small evidence summary or action when it helps orientation.

### Footer

The footer is grouped into identity, Research, Academic, and Connect regions. It provides profile links and copyright without repeating every route as an undifferentiated line.

## 6. Homepage

### Hero

The desktop hero uses a seven/five split:

- Left: role/institution eyebrow, research-positioning statement, concise biography, Research and Publications actions, academic profile links.
- Right: real profile portrait and a compact scholarly-status card.

The production title is slightly smaller than the first Superdesign draft to keep the entire core message and actions visible at 1440px.

### Evidence rail

Use only verifiable data already present in the repository:

- publication count from `site.data.publications`;
- active funded-project count from `site.data.projects`;
- IEEE Senior Member;
- SNI Level I.

Do not display generated citation or h-index numbers in the homepage rail.

### Homepage sections

1. Selected research themes, drawn from the real research data.
2. Active funded work, drawn from project data.
3. Latest verified publications, drawn from publication data.
4. Collaboration callout leading to Contact.

Placeholder news and placeholder blog posts are excluded from the homepage.

## 7. Route Designs

### About

Use the shared masthead and a readable biography column with a compact facts rail for role, institution, memberships, and editorial service. Preserve factual biography content.

### Research

Render six numbered theme cards from `_data/research.yml`. Each card includes the real title and description plus only verified nonempty connections. Values containing TODO markers are not rendered. Include pathways to Publications and Projects.

### Publications

Preserve year accordions, counts, expand/collapse controls, author highlighting, venue, type, DOI, Scopus, PDF, code/data, and citations. Improve hierarchy and responsive spacing without fabricating filters or metrics.

### Projects

Group active and completed funded work. Active work receives stronger teal emphasis. Cards retain status, duration, role, funding, amount, collaborators, and related output only when data exists.

### Teaching

Present all real course records as polished cards. Information Security is labeled as having an active Course App and materials. Overview-only courses remain visible but must not expose TODO strings or empty week scaffolding.

### Course detail

Use the shared course masthead, metadata chips, description, topics, content, highlighted start-here panel, and responsive schedule/table styling. The authenticated app and public course page remain separate security concerns.

### People

Group doctoral, master's, graduate, and undergraduate researchers. When a real name is unavailable, display a privacy-safe role label such as `Doctoral researcher`, not an editorial placeholder. Retain verified program, status, thesis/project, topic, and outcomes.

### CV

Use a readable editorial CV with stable date columns, clearly separated sections, and responsive stacking. Preserve all existing facts and links. Do not expose internal verification notes as public TODO styling.

### Blog and posts

Use editorial article rows for the blog and a focused reading column for posts. The example placeholder post becomes unpublished. The Welcome post may remain. Empty states are calm and honest.

### News

Do not publish the current fabricated placeholder announcements. Show a polished empty state until verified entries exist.

### Contact

Present known emails, affiliation, office, and profile links. Include collaboration and prospective-student inquiry pathways using neutral guidance that does not claim unknown supervision requirements.

## 8. Content Honesty

The redesign must remove public placeholder presentation without inventing replacements.

- Fix the portrait filename and reference.
- Replace the homepage TODO paragraph with a concise statement based on the existing biography.
- Clear or suppress TODO metadata in research data.
- Hide placeholder news entries.
- Unpublish the example placeholder post.
- Replace student-name placeholders with privacy-safe generic roles.
- Remove visible course TODO helpers; overview-only courses receive honest availability language.
- Remove TODO blocks from Contact and Research pages.
- Replace `[Your Full Name]` descriptions with Mahdi Zareei.

Repository comments may still explain content maintenance, but no visitor-facing TODO text may render.

## 9. Accessibility and Responsive Requirements

- Visible skip link and focus ring.
- Semantic header, nav, main, article, section, and footer landmarks.
- Minimum 44px mobile interactive targets.
- Mobile navigation closes on selection, outside click, and Escape and returns focus.
- Theme state persists and remains accessible by name and pressed state.
- Text meets WCAG AA contrast in both themes.
- No horizontal scrolling at 390px, including publication links, CV rows, and course tables.
- Tables use scroll containers where restructuring would harm semantics.
- `prefers-reduced-motion` disables nonessential transitions.

## 10. Technical Boundaries

- Continue using Jekyll, Liquid, SCSS, and dependency-free JavaScript.
- Preserve route and collection permalinks.
- Preserve SEO, feed, sitemap, and theme initialization.
- Do not introduce npm build dependencies or client frameworks.
- Keep the authenticated Course App and course microsites unchanged.
- Maintain GitHub Pages compatibility.

## 11. Verification

The implementation is complete only when:

- Jekyll builds successfully.
- All internal public links resolve in the generated site.
- Every public route uses the shared header/footer/theme.
- No visitor-facing TODO or `[Your Full Name]` text remains.
- The profile portrait loads.
- Desktop, tablet, and 390px mobile views are visually reviewed.
- Light/dark theme, mobile navigation, publication accordions, and post/course layouts work.
- Existing authenticated Course App verifiers still pass because that subsystem remains untouched.
