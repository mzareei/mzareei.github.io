// Deterministic slide-JSON → single-file HTML deck.
//
// The model only ever produces structured slide data; all markup is built here.
// That keeps generated decks byte-for-byte consistent with the hand-authored
// ones, and means a bad generation can't inject arbitrary HTML into a page that
// students open.
import { DECK_SKELETON, DECK_SCRIPT, DECK_STYLE } from "./deck-assets.ts";
import {
  renderCheckpointSection,
  type DeckCheckpoint
} from "../_shared/checkpoint-deck.ts";

export interface Slide {
  slide_number: number;
  kind: "title" | "section" | "bullets" | "cards" | "definition" | "activity" | "closing";
  section: string;
  section_es: string;
  heading: string;
  heading_es: string;
  kicker?: string;
  kicker_es?: string;
  lead?: string;
  lead_es?: string;
  bullets?: Array<{ text: string; text_es: string }>;
  cards?: Array<{ title: string; title_es: string; body: string; body_es: string }>;
  quote?: string;
  quote_es?: string;
  source?: string;
  answer?: string;
  answer_es?: string;
  figure_note?: string;
  figure_note_es?: string;
  source_pdf_pages: number[];
}

/** Model text → safe HTML text content. */
function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The deck engine reads `data-es` and assigns it with innerHTML, so the
 * attribute holds HTML that survives two decoding passes: the HTML parser
 * decodes the attribute, then innerHTML parses what comes out. Ampersands are
 * therefore escaped twice on purpose — "Tom & Jerry" has to reach innerHTML as
 * "Tom &amp; Jerry" to render as written.
 */
function esAttr(value: unknown) {
  return esc(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** An element carrying its Spanish twin. */
function bi(tag: string, en: unknown, es: unknown, attrs = "") {
  const spanish = String(es ?? "").trim();
  const esBit = spanish ? ` data-es="${esAttr(spanish)}"` : "";
  return `<${tag}${attrs ? " " + attrs : ""}${esBit}>${esc(en)}</${tag}>`;
}

function kicker(slide: Slide) {
  if (!slide.kicker) return "";
  const es = slide.kicker_es ? ` data-es="${esAttr(`<span class='dot'></span>${slide.kicker_es}`)}"` : "";
  return `      <span class="kicker"${es}><span class="dot"></span>${esc(slide.kicker)}</span>\n`;
}

function figureNote(slide: Slide) {
  if (!slide.figure_note) return "";
  return `      ${bi("p", slide.figure_note, slide.figure_note_es, 'class="figure-note"')}\n`;
}

const CARD_ACCENTS = ["accent-top", "teal-top", "good-top", "warn-top", "violet-top", "danger-top"];

function body(slide: Slide) {
  const parts: string[] = [];
  parts.push(kicker(slide));

  const headingTag = slide.kind === "title" || slide.kind === "section" ? "h1" : "h2";
  parts.push(`      ${bi(headingTag, slide.heading, slide.heading_es)}\n`);

  if (slide.kind === "title") parts.push(`      <div class="title-rule"></div>\n`);

  if (slide.lead) parts.push(`      ${bi("p", slide.lead, slide.lead_es, 'class="lead"')}\n`);

  if (slide.kind === "definition" && slide.quote) {
    parts.push(`      <div class="definition">\n`);
    parts.push(`        ${bi("blockquote", slide.quote, slide.quote_es)}\n`);
    if (slide.source) parts.push(`        <span class="src">${esc(slide.source)}</span>\n`);
    parts.push(`      </div>\n`);
  }

  if (slide.bullets?.length) {
    parts.push(`      <ul class="clean">\n`);
    for (const bullet of slide.bullets) {
      parts.push(`        ${bi("li", bullet.text, bullet.text_es)}\n`);
    }
    parts.push(`      </ul>\n`);
  }

  if (slide.cards?.length) {
    const cols = slide.cards.length >= 3 ? "cols-3" : "cols-2";
    parts.push(`      <div class="grid ${cols}">\n`);
    slide.cards.forEach((card, index) => {
      const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
      parts.push(
        `        <div class="card ${accent}">` +
        `${bi("h3", card.title, card.title_es)}` +
        `${bi("p", card.body, card.body_es)}` +
        `</div>\n`
      );
    });
    parts.push(`      </div>\n`);
  }

  // Answers stay hidden behind a click so the room commits before seeing them.
  if (slide.kind === "activity" && slide.answer) {
    parts.push(`      <div class="reveal-answer fragment">\n`);
    parts.push(`        <span class="ra-tag" data-es="Respuesta">Answer</span>\n`);
    parts.push(`        ${bi("p", slide.answer, slide.answer_es)}\n`);
    parts.push(`      </div>\n`);
  }

  parts.push(figureNote(slide));
  return parts.join("");
}

function renderSlide(slide: Slide, index: number) {
  const classes = ["slide"];
  if (slide.kind === "title") classes.push("title-slide");
  if (slide.kind === "section" || slide.kind === "closing") classes.push("section");
  if (slide.kind === "activity") classes.push("activity");
  if (index === 0) classes.push("active");

  const badge = slide.kind === "activity"
    ? `      <span class="badge" data-es="◆ Actividad">◆ Activity</span>\n`
    : "";

  return (
    `  <section class="${classes.join(" ")}" data-section="${esAttr(slide.section)}" ` +
    `data-section-es="${esAttr(slide.section_es)}" data-teaching-slide="${slide.slide_number}" data-source-pdf-pages="${slide.source_pdf_pages.join(",")}">\n` +
    `    <div class="slide-inner">\n` +
    badge +
    body(slide) +
    `    </div>\n` +
    `  </section>\n`
  );
}

export async function assembleDeck(input: {
  title: string;
  slides: Slide[];
  checkpoints: DeckCheckpoint[];
}): Promise<string> {
  const teachingSlideNumbers = new Set(input.slides.map((slide) => slide.slide_number));
  const seenCheckpointKeys = new Set<string>();
  const checkpoints = [...input.checkpoints].sort((a, b) =>
    a.after_slide - b.after_slide || a.segment_key.localeCompare(b.segment_key)
  );
  for (const checkpoint of checkpoints) {
    if (!teachingSlideNumbers.has(checkpoint.after_slide)) {
      throw new Error(
        `Checkpoint "${checkpoint.key}" does not match a finalized teaching slide.`
      );
    }
    if (seenCheckpointKeys.has(checkpoint.key)) {
      throw new Error(`Checkpoint key "${checkpoint.key}" is duplicated.`);
    }
    seenCheckpointKeys.add(checkpoint.key);
  }

  const checkpointsBySlide = new Map<number, DeckCheckpoint[]>();
  for (const checkpoint of checkpoints) {
    checkpointsBySlide.set(checkpoint.after_slide, [
      ...(checkpointsBySlide.get(checkpoint.after_slide) || []),
      checkpoint
    ]);
  }

  const slides = input.slides.map((slide, index) => {
    const checkpointSections = (checkpointsBySlide.get(slide.slide_number) || [])
      .map(renderCheckpointSection)
      .join("\n");
    return renderSlide(slide, index) + (checkpointSections ? `\n${checkpointSections}` : "");
  }).join("\n");
  return DECK_SKELETON
    .replace(/\{\{TITLE\}\}/g, esc(input.title))
    .replace(/\{\{DESCRIPTION\}\}/g, esc(input.title))
    .replace(/\{\{COURSE_LABEL_EN\}\}/g, esc(input.title))
    .replace(/\{\{COURSE_LABEL_ES\}\}/g, esAttr(input.title))
    .replace("{{STYLE_CSS}}", DECK_STYLE)
    .replace("{{SCRIPT_JS}}", DECK_SCRIPT)
    .replace("{{SLIDES}}", slides);
}
