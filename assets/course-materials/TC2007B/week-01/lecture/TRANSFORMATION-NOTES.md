# TC2007B · Week 1 · Lecture 1 — Web Lecture Notes

Source: `TC2007B-W01-1-CIA.pptx` (45 slides) → redesigned web deck (`index.html`, 43 slides), bilingual EN/ES.

## How to use the deck
Open `index.html` in any browser and press **F** for fullscreen.

Controls (top-right buttons or keyboard):

- **→ / Space / Page Down** — next, or reveal the next hidden point on a slide
- **← / Page Up** — previous (steps back through reveals too)
- **L** — switch language **English ⇄ Español**
- **T** — switch **light ⇄ dark** theme
- **O** — slide overview grid · **?** — full key map · **Home/End** — first/last
- Type a number to jump to that slide. Works with presenter remotes (Page Up/Down) and touch swipe.

Language and theme choices are remembered between sessions (localStorage).

## What changed in this revision
- **Bullet rendering fixed.** Lists previously wrapped oddly (a CSS grid issue); markers are now absolutely positioned so text flows normally.
- **Light/dark toggle** and **EN/ES toggle** added. The full deck is translated to Spanish (213+ strings, including the concept-map diagram).
- **Click-to-reveal** added on slides with a real teaching reason: the attack chain, the CIA triad, threat actors, value+risk, the trade-off examples, and the Target "walk-the-chain" table. A small "click to reveal" hint appears when a slide has more to show.
- **Quiz slides reworked.** Answers are now hidden behind a click (no fill-in-the-blank giveaways); the question is posed first, the answer revealed only when you choose.
- **All placeholders filled** (details below); explanations, analogies, and examples expanded throughout.

## Section structure (43 slides)
1. **Orientation** — title, about-me, name FAQ, icebreaker, rules, AI policy, roadmap, acknowledgment.
2. **Why security?** — NIST definition, value+risk, breach demo, data-as-product, societal scale, concept check.
3. **Security mindset** — mindset + questions, the attack chain, threat actors, vulnerabilities, "spot the weakness" activity, concept check.
4. **Case study** — Target overview, walk-the-chain, financial damage, discussion.
5. **CIA triad** — concept map, CIA, CIAAAN, threats↔requirements, phishing vs spoofing, concept check.
6. **C·I·A in depth** — confidentiality, integrity, availability, balancing trade-offs.
7. **Defending systems** — prevention/detection/response/recovery + policy vs mechanism, secure-design principles.
8. **Wrap-up** — lesson summary, closing takeaway.

## Filled content & sourcing (please sanity-check before class)
These were placeholders in the previous version and are now filled. Figures are from widely-reported public sources; verify any you plan to state as precise.

- **About me (slide 2)** — drawn from your site bio: Research Professor, School of Engineering & Sciences, Tec de Monterrey; IEEE Senior Member; SNI Level I; Ph.D. Universiti Teknologi Malaysia (2016); Osaka University research stay; at Tec since 2017; Associate Editor (IEEE Access, PLOS One, Ad Hoc & Sensor Wireless Networks). Edit freely.
- **Black-market data values (slide 13)** — *approximate, illustrative* ranges (hacked account, card number, "fullz", banking login, medical record), clearly labelled as varying by source and year. Update with a current cited index if you want exact numbers.
- **Target breach (slides 24–26)** — documented facts: late-2013 holiday breach; entry via stolen credentials from a third-party HVAC vendor (Fazio Mechanical) + weak segmentation; BlackPOS-style malware on POS terminals; ~40M cards and ~70M personal records. **Financial damage** (the chart the original image showed): ~$202M est. total gross cost; $18.5M 2017 multistate settlement (47 states + DC); ~$39M banks settlement; ~−46% Q4-2013 profit; CEO and CIO both resigned in 2014. Slides note these are widely-reported figures.

## Technical note
Self-contained: `index.html` + `style.css` + `script.js`. No build step; only external dependency is the Google Fonts link (degrades gracefully offline). Prints one slide per page (all reveals shown). Drop the folder anywhere under `assets/` to publish, or keep it unpublished until you're ready.
