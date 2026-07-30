import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertCheckpointPushMatches } from "../supabase/functions/_shared/pulse-checkpoint.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const matching = {
  sessionState: "live",
  sessionContentItemId: "content-one",
  bankContentItemId: "content-one",
  questionCheckpoint: 12,
  requestedCheckpoint: 12
};
assert.doesNotThrow(() => assertCheckpointPushMatches(matching));
assert.throws(
  () => assertCheckpointPushMatches({ ...matching, sessionState: "open" }),
  /live/,
  "a merely open session must not accept a checkpoint question"
);
assert.throws(
  () => assertCheckpointPushMatches({
    ...matching,
    bankContentItemId: "different-content"
  }),
  /lecture/,
  "a question from another lecture must not be pushable"
);
assert.throws(
  () => assertCheckpointPushMatches({ ...matching, questionCheckpoint: 13 }),
  /checkpoint/,
  "a question from another slide checkpoint must not be pushable"
);

const contentSource = read("supabase/functions/course-content-access/index.ts");
assert.match(contentSource, /body\.action === "request_instructor_url"/);
assert.match(contentSource, /loadInstructorContentAccess\(/);
assert.match(contentSource, /mintContentToken\(/);
const instructorAccessStart = contentSource.indexOf(
  "async function loadInstructorContentAccess"
);
const instructorAccessEnd = contentSource.indexOf(
  "\nasync function ",
  instructorAccessStart + 1
);
assert.ok(instructorAccessStart >= 0, "instructor content access helper is required");
const instructorAccessSource = contentSource.slice(
  instructorAccessStart,
  instructorAccessEnd >= 0 ? instructorAccessEnd : undefined
);
assert.match(instructorAccessSource, /\.from\("content_items"\)/);
assert.match(instructorAccessSource, /\.from\("course_memberships"\)/);
assert.match(instructorAccessSource, /teacherRoles\.includes/);
assert.match(instructorAccessSource, /source_kind/);
assert.match(instructorAccessSource, /storage_object/);
assert.doesNotMatch(
  instructorAccessSource,
  /content_releases/,
  "private instructor viewing must not create or consult a student release"
);

const pulseSource = read("supabase/functions/course-pulse/index.ts");
assert.match(
  pulseSource,
  /select\("id, course_id, section_id, state, sequence_number, title, content_item_id"\)/
);
assert.match(pulseSource, /question_bank_id[^"]*checkpoint_after_slide/);
assert.match(pulseSource, /\.from\("question_banks"\)/);
assert.match(pulseSource, /assertCheckpointPushMatches\(/);
assert.match(
  pulseSource,
  /question_id:\s*bankQuestion \? bankQuestion\.questionId : null/,
  "the verified bank question id must be the id snapshotted into the round"
);
assert.equal(
  pulseSource.match(/text_es:\s*snapshot\.text_es/g)?.length,
  2,
  "both teacher and student round projections must preserve bilingual prompt text"
);

console.log("verify-live-checkpoint-security: OK");
