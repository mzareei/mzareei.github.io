export type CheckpointMetadata = {
  segmentKey: string;
  sourceSlideNumbers: number[];
  sourceSlideStart: number;
  sourceSlideEnd: number;
  checkpointAfterSlide: number;
};

type CheckpointRow = CheckpointMetadata & { difficulty: string };

const difficultyOrder = ["easy", "medium", "hard"];

export function checkpointMetadataFromQuestion(
  value: Record<string, unknown>
): CheckpointMetadata {
  return {
    segmentKey: String(value.segment_key || "").trim(),
    sourceSlideNumbers: Array.isArray(value.source_slide_numbers)
      ? value.source_slide_numbers.map(Number)
      : [],
    sourceSlideStart: Number(value.source_slide_start),
    sourceSlideEnd: Number(value.source_slide_end),
    checkpointAfterSlide: Number(value.checkpoint_after_slide)
  };
}

export function checkpointMetadataColumns(value: CheckpointMetadata) {
  return {
    segment_key: value.segmentKey,
    source_slide_numbers: value.sourceSlideNumbers,
    source_slide_start: value.sourceSlideStart,
    source_slide_end: value.sourceSlideEnd,
    checkpoint_after_slide: value.checkpointAfterSlide
  };
}

function hasCheckpointMetadata(value: Record<string, unknown>): boolean {
  return (
    value.segment_key !== null
    && value.segment_key !== undefined
  ) || (
    Array.isArray(value.source_slide_numbers)
    && value.source_slide_numbers.length > 0
  ) || (
    value.source_slide_start !== null
    && value.source_slide_start !== undefined
  ) || (
    value.source_slide_end !== null
    && value.source_slide_end !== undefined
  ) || (
    value.checkpoint_after_slide !== null
    && value.checkpoint_after_slide !== undefined
  );
}

export function checkpointMetadataState(rows: Array<Record<string, unknown>>): {
  status: "missing" | "valid" | "invalid";
  presentCount: number;
  validRows: CheckpointRow[];
} {
  const present = rows.filter(hasCheckpointMetadata);
  const validRows = present
    .map((row) => ({
      ...checkpointMetadataFromQuestion(row),
      difficulty: String(row.difficulty || "")
    }))
    .filter((row) =>
      validateCheckpointMetadata(row, row.checkpointAfterSlide).length === 0
    );

  if (present.length === 0) {
    return { status: "missing", presentCount: 0, validRows: [] };
  }
  if (present.length === rows.length && validRows.length === rows.length) {
    return { status: "valid", presentCount: present.length, validRows };
  }
  return { status: "invalid", presentCount: present.length, validRows };
}

export function validateCheckpointMetadata(
  value: CheckpointMetadata,
  teachingSlideCount: number
): string[] {
  const problems: string[] = [];
  const sourceSlides = Array.isArray(value.sourceSlideNumbers)
    ? value.sourceSlideNumbers
    : [];

  if (!sourceSlides.length) {
    problems.push("At least one source slide is required.");
  }
  if (
    Number.isInteger(value.sourceSlideEnd)
    && Number.isInteger(value.checkpointAfterSlide)
    && value.sourceSlideEnd > value.checkpointAfterSlide
  ) {
    problems.push("The source slide range ends after its checkpoint.");
  }
  if (!value.segmentKey) {
    problems.push("A segment key is required.");
  }
  if (!Number.isInteger(teachingSlideCount) || teachingSlideCount < 1) {
    problems.push("The teaching slide count must be a positive integer.");
  }
  if (!Number.isInteger(value.sourceSlideStart) || value.sourceSlideStart < 1) {
    problems.push("The source slide start must be a positive integer.");
  }
  if (!Number.isInteger(value.sourceSlideEnd) || value.sourceSlideEnd < 1) {
    problems.push("The source slide end must be a positive integer.");
  } else if (
    Number.isInteger(value.sourceSlideStart)
    && value.sourceSlideEnd < value.sourceSlideStart
  ) {
    problems.push("The source slide end must not precede its start.");
  }
  if (
    !Number.isInteger(value.checkpointAfterSlide)
    || value.checkpointAfterSlide < 1
    || value.checkpointAfterSlide > teachingSlideCount
  ) {
    problems.push("The checkpoint must identify a finalized teaching slide.");
  }

  const uniqueSlides = new Set(sourceSlides);
  if (uniqueSlides.size !== sourceSlides.length) {
    problems.push("Cited source slides must not be duplicated.");
  }
  if (
    sourceSlides.some((slide) =>
      !Number.isInteger(slide)
      || slide < 1
      || slide > teachingSlideCount
      || slide > value.checkpointAfterSlide
    )
  ) {
    problems.push("Every cited source slide must be at or before its checkpoint.");
  }
  if (
    sourceSlides.some((slide, index) => index > 0 && slide <= sourceSlides[index - 1])
  ) {
    problems.push("Cited source slides must be in ascending order.");
  }
  if (
    sourceSlides.length
    && Number.isInteger(value.sourceSlideStart)
    && Math.min(...sourceSlides) !== value.sourceSlideStart
  ) {
    problems.push("The source slide start must match the first cited slide.");
  }
  if (
    sourceSlides.length
    && Number.isInteger(value.sourceSlideEnd)
    && Math.max(...sourceSlides) !== value.sourceSlideEnd
  ) {
    problems.push("The source slide end must match the last cited slide.");
  }

  return problems;
}

export function checkpointCoverage(
  rows: CheckpointRow[]
): Array<{
  segment_key: string;
  checkpoint_after_slide: number;
  candidate_count: number;
  difficulties: string[];
}> {
  const grouped = new Map<string, CheckpointRow[]>();
  for (const row of rows) {
    const key = `${row.checkpointAfterSlide}\u0000${row.segmentKey}`;
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }

  return [...grouped.values()]
    .map((group) => ({
      segment_key: group[0].segmentKey,
      checkpoint_after_slide: group[0].checkpointAfterSlide,
      candidate_count: group.length,
      difficulties: [...new Set(group.map((row) => row.difficulty))].sort((a, b) => {
        const aIndex = difficultyOrder.indexOf(a);
        const bIndex = difficultyOrder.indexOf(b);
        if (aIndex < 0 || bIndex < 0) return a.localeCompare(b);
        return aIndex - bIndex;
      })
    }))
    .sort((a, b) =>
      a.checkpoint_after_slide - b.checkpoint_after_slide
      || a.segment_key.localeCompare(b.segment_key)
    );
}

export function validateCheckpointBank(
  rows: CheckpointRow[],
  teachingSlideCount: number
): string[] {
  const problems: string[] = [];
  if (rows.length !== 18) {
    problems.push(`The generated bank must contain exactly 18 questions; found ${rows.length}.`);
  }

  for (const difficulty of difficultyOrder) {
    const count = rows.filter((row) => row.difficulty === difficulty).length;
    if (count !== 6) {
      problems.push(`The generated bank must contain exactly 6 ${difficulty} questions; found ${count}.`);
    }
  }

  rows.forEach((row, index) => {
    for (const problem of validateCheckpointMetadata(row, teachingSlideCount)) {
      problems.push(`Q${index + 1}: ${problem}`);
    }
  });

  const coverage = checkpointCoverage(rows);
  if (
    teachingSlideCount >= 18
    && teachingSlideCount <= 50
    && (coverage.length < 3 || coverage.length > 5)
  ) {
    problems.push(
      `A normal 18–50-slide lecture must have 3–5 checkpoints; found ${coverage.length}.`
    );
  }
  for (const checkpoint of coverage) {
    if (checkpoint.candidate_count < 2) {
      problems.push(
        `Checkpoint after slide ${checkpoint.checkpoint_after_slide} must have at least 2 candidates.`
      );
    }
  }
  return problems;
}
