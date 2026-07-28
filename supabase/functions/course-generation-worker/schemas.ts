// JSON Schemas the model is forced to answer through. Keeping them here rather
// than inline keeps the worker readable, and keeps the deck's vocabulary (the
// slide "kind" enum) in one place next to the assembler that consumes it.

export const OUTLINE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "The lecture's title as taught." },
    summary: { type: "string", description: "One or two sentences on what this lecture covers." },
    sections: {
      type: "array",
      description: "The lecture in order, one entry per teaching section.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          title_es: { type: "string" },
          key_points: {
            type: "array",
            description: "The substantive points taught in this section.",
            items: { type: "string" }
          },
          definitions: {
            type: "array",
            description: "Terms defined in this section.",
            items: {
              type: "object",
              properties: { term: { type: "string" }, definition: { type: "string" } },
              required: ["term", "definition"]
            }
          },
          examples: {
            type: "array",
            description: "Concrete cases, scenarios or worked examples used.",
            items: { type: "string" }
          }
        },
        required: ["title", "title_es", "key_points"]
      }
    },
    figure_notes: {
      type: "array",
      description: "Numbers, statistics or claims whose source is unclear and that must be flagged rather than asserted.",
      items: { type: "string" }
    }
  },
  required: ["title", "summary", "sections"]
} as const;

export const SLIDES_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["title", "section", "bullets", "cards", "definition", "activity", "closing"],
            description:
              "title = opening slide; section = divider; bullets = a list; cards = 2-3 parallel " +
              "ideas; definition = a quoted definition plus context; activity = a question or " +
              "discussion prompt with a hidden answer; closing = the summary slide."
          },
          section: { type: "string", description: "Section name shown in the footer (English)." },
          section_es: { type: "string" },
          heading: { type: "string" },
          heading_es: { type: "string" },
          kicker: { type: "string", description: "Short label above the heading." },
          kicker_es: { type: "string" },
          lead: { type: "string", description: "One-sentence lead paragraph." },
          lead_es: { type: "string" },
          bullets: {
            type: "array",
            items: {
              type: "object",
              properties: { text: { type: "string" }, text_es: { type: "string" } },
              required: ["text", "text_es"]
            }
          },
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                title_es: { type: "string" },
                body: { type: "string" },
                body_es: { type: "string" }
              },
              required: ["title", "title_es", "body", "body_es"]
            }
          },
          quote: { type: "string", description: "For definition slides: the definition itself." },
          quote_es: { type: "string" },
          source: { type: "string", description: "Attribution for the quote, if any." },
          answer: { type: "string", description: "For activity slides: the answer, hidden until clicked." },
          answer_es: { type: "string" },
          figure_note: { type: "string", description: "Caveat shown in small print under the slide." },
          figure_note_es: { type: "string" }
        },
        required: ["kind", "section", "section_es", "heading", "heading_es"]
      }
    }
  },
  required: ["slides"]
} as const;

export const QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          prompt_es: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          topic_tags: {
            type: "array",
            description: "Two or three lowercase-hyphenated topic tags, e.g. cia-triad.",
            items: { type: "string" }
          },
          explanation: { type: "string", description: "Why the correct answer is correct." },
          explanation_es: { type: "string" },
          options: {
            type: "array",
            description: "Exactly 4, exactly one with is_correct true.",
            items: {
              type: "object",
              properties: {
                option_text: { type: "string" },
                option_text_es: { type: "string" },
                is_correct: { type: "boolean" }
              },
              required: ["option_text", "option_text_es", "is_correct"]
            }
          }
        },
        required: ["prompt", "prompt_es", "difficulty", "options"]
      }
    }
  },
  required: ["questions"]
} as const;
