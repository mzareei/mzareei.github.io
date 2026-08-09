import type { GenerationMode, TeachingPlan } from "../_shared/generation-plan.ts";
import type { Slide } from "./deck.ts";

type GeneratedQuestion = Record<string, unknown>;

type QuestionContext = {
  key: string;
  sourcePdfPages: number[];
  suggestedAfterPdfPage: number;
  candidateGoal: number | null;
};

function uniqueSortedPages(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) throw new Error(`${label} must cite source PDF pages.`);
  const pages = [...new Set(value.map(Number))].sort((a, b) => a - b);
  if (!pages.length || pages.some((page) => !Number.isInteger(page) || page < 1)) {
    throw new Error(`${label} must cite valid source PDF pages.`);
  }
  return pages;
}

export function approvedQuestionContexts(plan: TeachingPlan): QuestionContext[] {
  const contexts = plan.checkpoints.map((checkpoint) => ({
    key: checkpoint.key,
    sourcePdfPages: uniqueSortedPages(
      checkpoint.source_pdf_pages,
      `Checkpoint ${checkpoint.key}`
    ),
    suggestedAfterPdfPage: checkpoint.suggested_after_pdf_page
      ?? Math.max(...checkpoint.source_pdf_pages),
    candidateGoal: checkpoint.candidate_goal
  }));

  if (plan.end_quiz_goal != null) {
    contexts.push({
      key: "end-quiz",
      sourcePdfPages: plan.source_pages.map((page) => page.source_pdf_page),
      suggestedAfterPdfPage: Math.max(...plan.source_pages.map((page) => page.source_pdf_page)),
      candidateGoal: plan.end_quiz_goal
    });
  }
  return contexts;
}

function stripSlideMapping(question: GeneratedQuestion): GeneratedQuestion {
  const {
    source_slide_numbers: _sourceSlideNumbers,
    source_slide_start: _sourceSlideStart,
    source_slide_end: _sourceSlideEnd,
    checkpoint_after_slide: _checkpointAfterSlide,
    ...withoutSlideMapping
  } = question;
  return withoutSlideMapping;
}

export function normalizeGeneratedQuestions(input: {
  mode: GenerationMode;
  questions: GeneratedQuestion[];
  plan: TeachingPlan;
  slides: Slide[];
}): GeneratedQuestion[] {
  const contexts = new Map(
    approvedQuestionContexts(input.plan).map((context) => [context.key, context])
  );
  if (!contexts.size) {
    throw new Error("The approved plan has no question checkpoint or end-quiz context.");
  }

  return input.questions.map((question, index) => {
    const label = `Q${index + 1}`;
    const segmentKey = String(question.segment_key || "").trim();
    const context = contexts.get(segmentKey);
    if (!context) {
      throw new Error(`${label} does not use an approved checkpoint key.`);
    }

    const sourcePdfPages = uniqueSortedPages(question.source_pdf_pages, label);
    const allowedPages = new Set(context.sourcePdfPages);
    if (sourcePdfPages.some((page) => !allowedPages.has(page))) {
      throw new Error(`${label} cites a PDF page outside its approved checkpoint context.`);
    }

    const groundedQuestion = {
      ...stripSlideMapping(question),
      segment_key: segmentKey,
      source_pdf_pages: sourcePdfPages
    };
    if (input.mode === "bank_only") return groundedQuestion;
    if (!input.slides.length) throw new Error("Deck-backed questions require finalized slides.");

    const checkpointSlides = input.slides.filter((slide) =>
      slide.source_pdf_pages.some((page) =>
        context.sourcePdfPages.includes(page)
        && page <= context.suggestedAfterPdfPage
      )
    );
    if (!checkpointSlides.length) {
      throw new Error(`${label}'s approved checkpoint has no finalized slide anchor.`);
    }
    const checkpointAfterSlide = Math.max(
      ...checkpointSlides.map((slide) => slide.slide_number)
    );
    const sourceSlideNumbers = input.slides
      .filter((slide) =>
        slide.slide_number <= checkpointAfterSlide
        && slide.source_pdf_pages.some((page) => sourcePdfPages.includes(page))
      )
      .map((slide) => slide.slide_number)
      .sort((a, b) => a - b);
    if (!sourceSlideNumbers.length) {
      throw new Error(`${label} has no finalized slide containing its cited PDF pages.`);
    }

    return {
      ...groundedQuestion,
      source_slide_numbers: sourceSlideNumbers,
      source_slide_start: sourceSlideNumbers[0],
      source_slide_end: sourceSlideNumbers[sourceSlideNumbers.length - 1],
      checkpoint_after_slide: checkpointAfterSlide
    };
  });
}
