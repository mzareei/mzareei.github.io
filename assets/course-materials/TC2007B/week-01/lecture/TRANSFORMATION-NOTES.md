# TC2007B · Week 1 · Lecture 1 — Web Lecture Transformation Notes

Source: `TC2007B-W01-1-CIA.pptx` (45 slides) → redesigned web deck (`index.html`, 42 slides).

## How to use the deck
Open `index.html` in any browser, press **F** for fullscreen, and present. Arrow keys / Space / Page Up–Down (presenter remotes) navigate. Press **?** for the full key map, **O** for the slide overview grid. Self-contained — no build step, no internet required except the Google Fonts link (degrades gracefully offline).

## How the PowerPoint was transformed
The original mixed text slides with many image-only slides (decorative photos, joke "fail" pictures, and charts whose text wasn't machine-readable). Rather than screenshotting the PPTX, the deck was rebuilt as a clean dark-academic web presentation: every slide title now states a *main idea* instead of a topic label, decorative images were replaced with web-native visuals (a threat→vulnerability→attack→compromise flow, a CIA triad block, an SVG concept map, and comparison tables), and teaching scaffolding (analogies, concept checks, discussion prompts) was added. No facts, figures, citations, or biography were invented.

## Section structure of the new lecture
1. **Orientation** (8 slides) — title, about-me placeholder, name FAQ, icebreaker activity, classroom rules, AI-use policy, roadmap, acknowledgment.
2. **Why security?** (7) — NIST definition, value+risk framing, "who is safe" breach demo, data-as-product, societal scale, concept check.
3. **Security mindset** (7) — mindset + key questions, the attack chain, threat actors, vulnerabilities/humans, "spot the weakness" activity, concept check.
4. **Case study** (4) — Target overview scaffold, mapping the breach onto the chain, discussion.
5. **CIA triad** (7) — concept map, CIA triad, CIAAAN, threats↔requirements table, phishing vs spoofing, concept check.
6. **C·I·A in depth** (4) — confidentiality, integrity, availability, balancing trade-offs.
7. **Defending systems** (3) — prevention/detection/response/recovery + policy vs mechanism, secure-design principles.
8. **Wrap-up** (2) — lesson summary, closing takeaway.

## What was merged / expanded / turned into activities
- **Merged:** the scattered "Vulnerabilities and Attacks" text slides (22 + 24) into one model + one diagram; the two "Availability" slides (40 + 41) into one; the "what is the security mindset" + "important questions" slides (19 + 20) into one.
- **Expanded:** the NIST definition now explicitly previews the CIA triad; the attack chain is shown as a visual flow; "relationship of key concepts" (slide 33) became a labeled SVG concept map.
- **Turned into activities:** the introduce-yourself slide (5) is now a framed icebreaker; the unreadable "fail" image sequence (25–29) became a *"spot the weakness"* exercise; the Target case (30–32) became a *walk-the-chain* table plus a discussion slide.
- **Preserved verbatim in spirit:** classroom rules, the full **AI-use policy**, the name FAQ, and the **Georgia Tech / Dr. Wenke Lee & Dr. Mustaque Ahamad (CS 6035)** acknowledgment.

## ⚑ Missing factual information — needs instructor confirmation
These appear as dashed **placeholder** blocks in the deck (slides 2, 13, 24):
1. **About me (slide 2)** — add your factual role, institution, research areas, background.
2. **Black-market data values (slide 13)** — the source chart's numbers weren't readable; insert current, cited price ranges with a year.
3. **Target breach facts (slides 24–25)** — the source illustrated this with images only; add verified, sourced details (date, initial entry point, method/malware, records affected, impact) before teaching. The walk-the-chain table is ready to be filled in live.

Nothing in the deck asserts these as fact until you fill them in.
