# How to make a new lecture deck

This `_template/` folder is the starting point for every lecture. Because the
folder name begins with `_`, Jekyll/GitHub Pages **ignores it** — it lives in
the repo but is never published as a page. Copy it to create a real lecture.

## The 4-step recipe

1. **Copy the `lecture/` folder** into the right place (see the path convention
   below). Example, for Week 2's first lecture of the information-security course:

   ```
   assets/course-materials/information-security/week-02/lecture/
   ```

2. **Edit `index.html`** — that's the only file you normally touch. Each
   `<section class="slide">` is one slide. Change the text, add or remove slides.

3. **Update the footer line** near the bottom of `index.html`:
   - the `<span class="course">` label (e.g. `TC2007B · W2 · L1 — Title`)
   - you do **not** need to edit the slide count — the script counts slides
     automatically. (The number in the file is just a placeholder.)

4. **Commit and push.** It's live a minute later at the matching URL.

You never edit `style.css` or `script.js` — they're the shared engine, copied as-is.

## Writing slides

- **Bilingual (EN/ES):** put the English text inside the element as usual, and
  add a `data-es="…"` attribute with the Spanish. The ES/EN button swaps them.
  - Inside `data-es`, use **single quotes** for any inner tag attributes
    (`<span class='accent'>`) and **typographic quotes** `“ ” ¿ ¡` for quotation
    marks — never a straight `"` (it would close the attribute).
  - Put `data-es` on the **leaf** text element (the `<h3>`, `<p>`, `<li>`),
    not on a wrapper that also contains a `fragment`.

- **Reveal on click:** add `class="fragment"` to anything that should appear on
  the next click instead of all at once (great for building a diagram or hiding
  a quiz answer). A "click to reveal" hint shows while a slide has more.

- **Hidden quiz answers:** wrap the answer in
  `<div class="reveal-answer fragment"> … </div>` so it only appears when you
  choose to reveal it.

- **Components available** (see the template slides for live examples):
  card grids (`grid cols-2|cols-3`, card colours `accent-top` / `teal-top` /
  `good-top` / `warn-top` / `danger-top` / `violet-top`), `flow` diagrams,
  `triad`, `table.compare`, `stats`, `definition` quotes, `callout`
  (`note` / `check` / `discuss` / `policy`), `activity` slides, and `section`
  dividers.

## Don'ts (from the course rules)

- Don't invent facts, figures, citations, or cases. If a number is uncertain,
  use a `figure-note` caption to flag it for verification.
- Keep acknowledgments when the source slides have them.
