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
