import type { GenerationMode } from "../_shared/generation-plan.ts";

type FinalizationRow = Record<string, unknown>;

export type FinalizationProof = {
  job: FinalizationRow;
  contentItem: FinalizationRow | null;
  questionBank: FinalizationRow | null;
};

export type FinalizationExpectation = {
  jobId: string;
  mode: GenerationMode;
  stagingDeckPath: string | null;
};

function sameId(value: unknown, expected: unknown) {
  return String(value || "") !== "" && String(value) === String(expected);
}

export function matchesFinalizedGeneration(
  proof: FinalizationProof,
  expected: FinalizationExpectation
) {
  const { job, contentItem, questionBank } = proof;
  if (
    !sameId(job.id, expected.jobId)
    || job.status !== "ready_for_review"
    || job.generation_mode !== expected.mode
    || !questionBank
    || !sameId(job.question_bank_id, questionBank.id)
    || !sameId(questionBank.generation_job_id, expected.jobId)
  ) {
    return false;
  }

  const stepState = job.step_state && typeof job.step_state === "object"
    ? job.step_state as Record<string, unknown>
    : {};
  if (expected.mode === "bank_only") {
    return job.content_item_id == null
      && contentItem == null
      && expected.stagingDeckPath == null
      && stepState.deck_storage_path == null;
  }

  return Boolean(
    expected.stagingDeckPath
    && contentItem
    && sameId(job.content_item_id, contentItem.id)
    && sameId(contentItem.generation_job_id, expected.jobId)
    && contentItem.source_ref === expected.stagingDeckPath
    && stepState.deck_storage_path === expected.stagingDeckPath
  );
}
