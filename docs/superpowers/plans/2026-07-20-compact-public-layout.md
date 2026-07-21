# Compact Public Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage and every public route comfortably fit a 13-inch laptop viewport without changing the site's editorial identity or content.

**Architecture:** Keep the existing Jekyll structure intact. Extend the public-site verifier with a compact-density CSS contract, then adjust only the shared stylesheet so homepage, standard pages, posts, and courses inherit the correction.

**Tech Stack:** Jekyll, SCSS, vanilla JavaScript, Node.js verification, in-app browser.

## Global Constraints

- Preserve all copy, routes, data, colors, fonts, and public components.
- Modify only public-site verification, shared public CSS, and implementation documentation.
- Do not modify `assets/course-materials/**` or `supabase/**`.
- At `1280 × 800`, the homepage hero and representative route mastheads must expose their complete primary content above the fold.

---

### Task 1: Add the compact-density contract and implement it

**Files:**
- Modify: `tools/verify-public-site-design.js`
- Modify: `assets/css/style.scss`
- Create: `docs/superpowers/specs/2026-07-20-compact-public-layout-design.md`
- Create: `docs/superpowers/plans/2026-07-20-compact-public-layout.md`

**Interfaces:**
- Consumes: existing `.home-hero`, `.home-hero__copy`, `.home-hero__portrait`, `.page`, and `.site-masthead` CSS contracts.
- Produces: `--home-title-max`, `--page-title-max`, compact hero sizing, and compact route masthead spacing.

- [ ] **Step 1: Write the failing source contract**

Require these exact stylesheet markers in `tools/verify-public-site-design.js`:

```js
"--home-title-max: 4rem",
"--page-title-max: 3.65rem",
"min-height: min(600px, calc(100svh - 76px))",
"max-width: 340px"
```

- [ ] **Step 2: Run RED**

Run `node tools/verify-public-site-design.js` and confirm failure begins with `Public theme missing: --home-title-max: 4rem`.

- [ ] **Step 3: Implement the compact shared CSS**

Add title tokens, reduce `.page` and `.site-masthead` spacing, apply the page-title token, and replace the fixed homepage hero composition with the viewport-aware height, `4rem` title maximum, and `340px` portrait cap. Keep mobile overrides explicit.

- [ ] **Step 4: Run GREEN and regressions**

Run:

```powershell
bundle exec jekyll build
node tools/verify-public-site-design.js
node --check assets/js/main.js
node tools/verify-course-platform.js
node tools/verify-auth-command-center.js
git diff --check
```

- [ ] **Step 5: Perform browser verification**

At `1280 × 800`, confirm the homepage headline, full portrait, introduction, actions, and profile controls fit above the fold; confirm the Research and Publications content begins above the fold. Repeat overflow checks at `390 × 844` and visual review at `1440 × 1000`.

- [ ] **Step 6: Commit and publish**

Commit as `fix: compact public site typography and mastheads`, merge to `main`, rerun the full verification suite, push, and confirm the compact CSS is live.
