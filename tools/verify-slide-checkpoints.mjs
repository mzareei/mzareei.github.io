import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkpointCoverage,
  checkpointMetadataColumns,
  checkpointMetadataState,
  validateCheckpointBank,
  validateCheckpointMetadata
} from "../supabase/functions/_shared/checkpoints.ts";
import {
  QUESTIONS_SCHEMA,
  SLIDES_SCHEMA
} from "../supabase/functions/course-generation-worker/schemas.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valid = {
  segmentKey: "cia-triad",
  sourceSlideNumbers: [12, 13, 14, 15],
  sourceSlideStart: 12,
  sourceSlideEnd: 15,
  checkpointAfterSlide: 15
};

assert.deepEqual(validateCheckpointMetadata(valid, 24), []);
assert.match(
  validateCheckpointMetadata({ ...valid, sourceSlideEnd: 16 }, 24)[0],
  /after its checkpoint/
);
assert.match(
  validateCheckpointMetadata({ ...valid, sourceSlideNumbers: [] }, 24)[0],
  /source slide/
);
assert.deepEqual(checkpointMetadataColumns(valid), {
  segment_key: "cia-triad",
  source_slide_numbers: [12, 13, 14, 15],
  source_slide_start: 12,
  source_slide_end: 15,
  checkpoint_after_slide: 15
});
const validStored = {
  difficulty: "easy",
  segment_key: "cia-triad",
  source_slide_numbers: [12, 13, 14, 15],
  source_slide_start: 12,
  source_slide_end: 15,
  checkpoint_after_slide: 15
};
assert.deepEqual(checkpointMetadataState([{
  ...validStored,
  segment_key: null,
  source_slide_numbers: [],
  source_slide_start: null,
  source_slide_end: null,
  checkpoint_after_slide: null
}]), {
  status: "missing",
  presentCount: 0,
  validRows: []
});
assert.deepEqual(checkpointMetadataState([validStored]), {
  status: "valid",
  presentCount: 1,
  validRows: [{ ...valid, difficulty: "easy" }]
});
assert.deepEqual(checkpointMetadataState([{
  ...validStored,
  source_slide_end: 16
}]), {
  status: "invalid",
  presentCount: 1,
  validRows: []
});
assert.equal(
  checkpointMetadataState([
    validStored,
    {
      ...validStored,
      segment_key: null,
      source_slide_numbers: [],
      source_slide_start: null,
      source_slide_end: null,
      checkpoint_after_slide: null
    }
  ]).status,
  "invalid"
);

const difficulties = ["easy", "medium", "hard"];
const rows = Array.from({ length: 18 }, (_, index) => {
  const checkpointIndex = Math.floor(index / 6);
  const start = checkpointIndex * 6 + 1;
  return {
    segmentKey: `segment-${checkpointIndex + 1}`,
    sourceSlideNumbers: [start, start + 1],
    sourceSlideStart: start,
    sourceSlideEnd: start + 1,
    checkpointAfterSlide: start + 1,
    difficulty: difficulties[index % 3]
  };
});
assert.deepEqual(validateCheckpointBank(rows, 18), []);
assert.deepEqual(checkpointCoverage(rows), [
  {
    segment_key: "segment-1",
    checkpoint_after_slide: 2,
    candidate_count: 6,
    difficulties
  },
  {
    segment_key: "segment-2",
    checkpoint_after_slide: 8,
    candidate_count: 6,
    difficulties
  },
  {
    segment_key: "segment-3",
    checkpoint_after_slide: 14,
    candidate_count: 6,
    difficulties
  }
]);
assert.match(validateCheckpointBank(rows.slice(0, 17), 18)[0], /exactly 18/);
const unbalanced = rows.map((row, index) => (
  index === 0 ? { ...row, difficulty: "medium" } : row
));
assert.ok(validateCheckpointBank(unbalanced, 18).some((problem) => /exactly 6 easy/.test(problem)));
const sparseCheckpoint = rows.map((row, index) => (
  index === 0 ? { ...row, segmentKey: "lonely-segment" } : row
));
assert.ok(
  validateCheckpointBank(sparseCheckpoint, 18)
    .some((problem) => /at least 2 candidates/.test(problem))
);

const questionItems = QUESTIONS_SCHEMA.properties.questions.items;
for (const property of [
  "segment_key",
  "source_slide_numbers",
  "source_slide_start",
  "source_slide_end",
  "checkpoint_after_slide"
]) {
  assert.ok(questionItems.required.includes(property), `${property} must be required by the model schema`);
  assert.ok(property in questionItems.properties, `${property} must exist in the model schema`);
}
const slideItems = SLIDES_SCHEMA.properties.slides.items;
assert.ok(slideItems.required.includes("slide_number"));
assert.equal(slideItems.properties.slide_number.type, "integer");

const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/0021_slide_checkpoints.sql"),
  "utf8"
);
assert.match(migration, /source_slide_numbers integer\[\] not null default '\{\}'/);
assert.match(migration, /checkpoint_after_slide >= source_slide_end/);
assert.doesNotMatch(migration, /unique index[\s\S]*questions_checkpoint_idx/i);
const checkpointMigrations = fs.readdirSync(path.join(root, "supabase/migrations"))
  .filter((name) => name.startsWith("0021_"));
assert.deepEqual(checkpointMigrations, ["0021_slide_checkpoints.sql"]);

for (const relativePath of [
  "supabase/functions/course-generation-worker/index.ts",
  "supabase/functions/course-question-bank/index.ts"
]) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert.match(source, /checkpointMetadataColumns\(/, `${relativePath} must persist checkpoint metadata`);
}

const workerSource = fs.readFileSync(
  path.join(root, "supabase/functions/course-generation-worker/index.ts"),
  "utf8"
);
assert.match(workerSource, /Finalized teaching slides:/);
assert.match(workerSource, /Write exactly 18 questions: exactly 6 easy, 6 medium and 6 hard/);
assert.match(workerSource, /3–5 concept checkpoints/);
assert.match(workerSource, /at least 2 candidate questions at every checkpoint/);
assert.match(workerSource, /validateSlides\(slides\)/);

const bankSource = fs.readFileSync(
  path.join(root, "supabase/functions/course-question-bank/index.ts"),
  "utf8"
);
assert.match(bankSource, /checkpoint_coverage:\s*checkpointCoverage\(/);
assert.match(bankSource, /checkpoint_metadata_status:\s*metadataState\.status/);
assert.match(bankSource, /checkpoint_metadata_present:\s*metadataState\.presentCount/);
assert.match(bankSource, /checkpoint_metadata_valid:\s*metadataState\.validRows\.length/);
assert.match(bankSource, /\.eq\("checkpoint_after_slide", checkpointAfterSlide\)/);
for (const property of [
  "segment_key",
  "source_slide_numbers",
  "source_slide_start",
  "source_slide_end",
  "checkpoint_after_slide"
]) {
  assert.match(
    bankSource,
    new RegExp(`${property}: picked\\.${property}`),
    `draw_question must return ${property}`
  );
}

const generationSource = fs.readFileSync(
  path.join(root, "supabase/functions/course-generation/index.ts"),
  "utf8"
);
assert.match(
  generationSource,
  /select\("id, prompt, prompt_es, difficulty, status, segment_key, source_slide_numbers, source_slide_start, source_slide_end, checkpoint_after_slide, question_options/
);

console.log("verify-slide-checkpoints: OK");
