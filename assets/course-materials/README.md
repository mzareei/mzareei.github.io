# Course materials

Web-based lecture decks for teaching. Each deck is a self-contained folder
(`index.html` + `style.css` + `script.js`) that opens in any browser, projects
full-screen, and supports light/dark + English/Spanish + click-to-reveal.

## Folder convention

```
assets/course-materials/
  _template/              ← starter (NOT published; copy this for new lectures)
    lecture/              ← copy this folder
    HOW-TO-USE.md
  <course-slug>/          ← e.g. information-security
    week-01/
      lecture/            ← Week 1, Lecture 1
      lecture-2/          ← Week 1, Lecture 2
      lecture-3/          ← (additional lectures)
    week-02/
      lecture/
      ...
```

- `<course-slug>` is a short, lowercase, hyphenated name (e.g. `information-security`).
- The **first** lecture of a week is `lecture/`; additional ones are `lecture-2/`,
  `lecture-3/`, … (this keeps already-shared URLs stable).
- Anything in a folder starting with `_` (like `_template/`, or a `_week-05/`
  you're not ready to publish) stays in the repo but is **not** put on the public
  site — handy for drafts.

## Published URLs

A deck at `assets/course-materials/information-security/week-01/lecture-2/`
is served at:

```
https://mzareei.github.io/assets/course-materials/information-security/week-01/lecture-2/
```

## Current decks

| Week | Lecture | Topic | Path |
|------|---------|-------|------|
| 1 | 1 | Introduction to Cybersecurity (CIA triad) | `information-security/week-01/lecture/` |
| 1 | 2 | Legal & Ethical Aspects | `information-security/week-01/lecture-2/` |

## Making a new one

See `_template/HOW-TO-USE.md`.
