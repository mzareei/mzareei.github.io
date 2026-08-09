export type GenerationMode = "deck_and_bank" | "bank_only";

export type TeachingBrief = {
  generation_mode: GenerationMode;
  instructions: string;
  live_checkpoint_goal: number | null;
  candidates_per_checkpoint: number | null;
  end_quiz_question_goal: number | null;
  checkpoint_preferences: string;
};

export type SourcePage = {
  source_pdf_page: number;
  topic: string;
  topic_es: string;
  evidence: string;
};

export type TeachingPlan = {
  source_pages: SourcePage[];
  checkpoints: Array<{
    key: string;
    topic: string;
    source_pdf_pages: number[];
    suggested_after_pdf_page: number | null;
    candidate_goal: number | null;
  }>;
  end_quiz_goal: number | null;
};

const maxFreeTextLength = 4_000;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is required.`);
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function freeText(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > maxFreeTextLength) throw new Error(`${label} must be at most 4,000 characters.`);
  return text;
}

function optionalGoal(value: unknown, label: string) {
  if (value == null || value === "") return null;
  const goal = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(goal) || goal <= 0) throw new Error(`${label} must be a positive number or null.`);
  return goal;
}

function optionalPage(value: unknown, label: string) {
  if (value == null || value === "") return null;
  const page = Number(value);
  if (!Number.isInteger(page) || page <= 0) throw new Error(`${label} must be a positive page number or null.`);
  return page;
}

export function validateTeachingBrief(value: unknown): TeachingBrief {
  const brief = asRecord(value, "A teaching brief");
  const mode = requiredText(brief.generation_mode, "Generation mode");
  if (mode !== "deck_and_bank" && mode !== "bank_only") {
    throw new Error("Generation mode must be deck_and_bank or bank_only.");
  }
  return {
    generation_mode: mode,
    instructions: freeText(brief.instructions, "Instructions"),
    live_checkpoint_goal: optionalGoal(brief.live_checkpoint_goal, "Live checkpoint goal"),
    candidates_per_checkpoint: optionalGoal(brief.candidates_per_checkpoint, "Candidates per checkpoint"),
    end_quiz_question_goal: optionalGoal(brief.end_quiz_question_goal, "End quiz question goal"),
    checkpoint_preferences: freeText(brief.checkpoint_preferences, "Checkpoint preferences")
  };
}

export function validateTeachingPlan(value: unknown): TeachingPlan {
  const plan = asRecord(value, "A teaching plan");
  if (!Array.isArray(plan.source_pages) || !plan.source_pages.length) {
    throw new Error("A teaching plan must include source pages.");
  }
  const sourcePages = plan.source_pages.map((value, index) => {
    const page = asRecord(value, `Source page ${index + 1}`);
    const sourcePdfPage = optionalPage(page.source_pdf_page, `Source page ${index + 1}`);
    if (sourcePdfPage == null) throw new Error(`Source page ${index + 1} is required.`);
    return {
      source_pdf_page: sourcePdfPage,
      topic: requiredText(page.topic, `Source page ${index + 1} topic`),
      topic_es: requiredText(page.topic_es, `Source page ${index + 1} Spanish topic`),
      evidence: requiredText(page.evidence, `Source page ${index + 1} evidence`)
    };
  });
  sourcePages.forEach((page, index) => {
    if (index > 0 && page.source_pdf_page <= sourcePages[index - 1].source_pdf_page) {
      throw new Error("Source pages must be in ascending PDF order.");
    }
  });

  if (!Array.isArray(plan.checkpoints)) throw new Error("Teaching plan checkpoints are required.");
  const allowedPages = new Set(sourcePages.map((page) => page.source_pdf_page));
  const checkpoints = plan.checkpoints.map((value, index) => {
    const checkpoint = asRecord(value, `Checkpoint ${index + 1}`);
    if (!Array.isArray(checkpoint.source_pdf_pages) || !checkpoint.source_pdf_pages.length) {
      throw new Error(`Checkpoint ${index + 1} must cite source PDF pages.`);
    }
    const citedPages = checkpoint.source_pdf_pages.map((page) => {
      const sourcePdfPage = optionalPage(page, `Checkpoint ${index + 1} source page`);
      if (sourcePdfPage == null || !allowedPages.has(sourcePdfPage)) {
        throw new Error(`Checkpoint ${index + 1} cites a page absent from source_pages.`);
      }
      return sourcePdfPage;
    });
    return {
      key: requiredText(checkpoint.key, `Checkpoint ${index + 1} key`),
      topic: requiredText(checkpoint.topic, `Checkpoint ${index + 1} topic`),
      source_pdf_pages: citedPages,
      suggested_after_pdf_page: optionalPage(checkpoint.suggested_after_pdf_page, `Checkpoint ${index + 1} suggested page`),
      candidate_goal: optionalGoal(checkpoint.candidate_goal, `Checkpoint ${index + 1} candidate goal`)
    };
  });
  return { source_pages: sourcePages, checkpoints, end_quiz_goal: optionalGoal(plan.end_quiz_goal, "End quiz goal") };
}
