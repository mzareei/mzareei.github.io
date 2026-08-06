import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractTeachingSlides,
  injectCheckpointSections,
  prepareLegacyDeckHtml,
  removeLegacyDeckNavigation,
  replaceLegacyDeckAssets
} from "../supabase/functions/_shared/checkpoint-deck.ts";
import {
  DECK_SCRIPT,
  DECK_STYLE
} from "../supabase/functions/course-generation-worker/deck-assets.ts";
import { coalesceSegmentKeysByCheckpoint } from "../supabase/functions/_shared/checkpoint-mapping.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

assert.deepEqual(
  coalesceSegmentKeysByCheckpoint([
    { question_id: "q1", segment_key: "cia", checkpoint_after_slide: 15 },
    { question_id: "q2", segment_key: "threats", checkpoint_after_slide: 15 },
    { question_id: "q3", segment_key: "risk", checkpoint_after_slide: 28 }
  ]).map(({ segment_key }) => segment_key),
  ["cia", "cia", "risk"],
  "questions at one slide boundary must form one checkpoint candidate pool"
);
assert.deepEqual(
  Array.from(
    new Set(
      coalesceSegmentKeysByCheckpoint(
        [5, 10, 11, 20, 30, 40].map((checkpoint_after_slide) => ({
          segment_key: `slide-${checkpoint_after_slide}`,
          checkpoint_after_slide
        }))
      ).map(({ checkpoint_after_slide }) => checkpoint_after_slide)
    )
  ),
  [5, 11, 20, 30, 40],
  "the closest adjacent boundaries are merged when a model returns more than five"
);

const legacyFixture = `<!doctype html>
<html>
<head>
  <style>
  /* TC2007B — Lecture deck theme (shared design; copy per lecture) */
  .slide { display: none; }
  </style>
  <style>.lecture-custom::after { content: "$&"; }</style>
</head>
<body>
  <div class="controls">
    <a href="https://mzareei.github.io/teaching/information-security/" class="ui-btn">Home</a>
    <a href="https://mzareei.github.io/assets/course-materials/information-security/week-01/mission-01/" class="ui-btn">Mission</a>
    <a href="quiz/teacher.html?lecture=tc2007b-w1-l1" class="ui-btn">Quiz</a>
    <a href="https://mzareei.github.io/assets/course-materials/information-security/exit-ticket/" class="ui-btn">Exit</a>
    <button class="ui-btn" id="langBtn">ES</button>
    <button class="ui-btn" id="themeBtn">Theme</button>
    <a href="#source-note" class="reference-link">Source note</a>
  </div>
  <main class="deck" id="deck">
    <section class="slide title-slide active"><div class="slide-inner"><h1>One &amp; safe</h1></div></section>
    <section class="slide"><div class="slide-inner"><h2>Two</h2><p>Markup <strong>stays text</strong>.</p></div></section>
    <section class="slide activity"><div class="slide-inner"><h2>Three</h2></div></section>
    <section class="slide section"><div class="slide-inner"><h2>Four</h2></div></section>
  </main>
  <div class="nav-btns">
    <button id="prevBtn">Previous</button>
    <button id="ovBtn">Overview</button>
    <button id="helpBtn">Help</button>
    <button id="fsBtn">Fullscreen</button>
    <button id="nextBtn">Next</button>
  </div>
  <div id="overview">Overview panel</div>
  <div id="help">Help panel</div>
  <script>
  /* TC2007B - W1 - L1 - Presenter engine */
  window.legacyPresenter = true;
  </script>
  <script>window.lectureCustom = "$&";</script>
</body>
</html>`;

const checkpoints = [{
  key: "legacy-security",
  afterSlide: 3,
  sourceStart: 2,
  sourceEnd: 3
}];

const extracted = extractTeachingSlides(legacyFixture);
assert.deepEqual(extracted.map(({ number }) => number), [1, 2, 3, 4]);
assert.equal(extracted[0].text, "One & safe");
assert.equal(extracted[1].text, "Two Markup stays text.");
assert.doesNotMatch(extracted[1].text, /<[^>]+>/);

const withoutLegacyNavigation = removeLegacyDeckNavigation(legacyFixture);
for (const destination of [
  "teaching/information-security",
  "mission-01",
  "quiz/teacher.html",
  "exit-ticket"
]) {
  assert.doesNotMatch(withoutLegacyNavigation, new RegExp(destination));
}
assert.match(withoutLegacyNavigation, /id="langBtn"/);
assert.match(withoutLegacyNavigation, /id="themeBtn"/);
assert.match(withoutLegacyNavigation, /id="ovBtn"/);
assert.match(withoutLegacyNavigation, /id="helpBtn"/);
assert.match(withoutLegacyNavigation, /id="fsBtn"/);
assert.match(withoutLegacyNavigation, /id="prevBtn"/);
assert.match(withoutLegacyNavigation, /id="nextBtn"/);
assert.match(withoutLegacyNavigation, /href="#source-note"/);

const navigationVariants = {
  home: [
    "teaching/information-security/",
    "../teaching/information-security/?from=deck",
    "/teaching/information-security/#today",
    "https://mzareei.github.io/teaching/information-security/?from=deck#today"
  ],
  mission: [
    "mission-01/",
    "../mission-bridge/?from=deck",
    "/assets/course-materials/information-security/week-01/mission-02/#task",
    "https://mzareei.github.io/assets/course-materials/information-security/week-01/mission-03/?from=deck#task"
  ],
  quiz: [
    "quiz/teacher.html",
    "../quiz/teacher.html?lecture=one",
    "/assets/course-materials/information-security/week-01/quiz/teacher.html#start",
    "https://mzareei.github.io/assets/course-materials/information-security/week-01/quiz/teacher.html?lecture=one#start"
  ],
  exit: [
    "exit-ticket/",
    "../../exit-ticket/?lecture=one",
    "/assets/course-materials/information-security/exit-ticket/#reflect",
    "https://mzareei.github.io/assets/course-materials/information-security/exit-ticket/?lecture=one#reflect"
  ]
};
const navigationFixture = [
  ...Object.entries(navigationVariants).flatMap(([destination, hrefs]) =>
    hrefs.map((href, index) =>
      `<a class="ui-btn" data-legacy="${destination}-${index}" href="${href}">Old control</a>`
    )
  ),
  '<a class="ui-btn" data-keep="course" href="../information-security/resources/">Resources</a>',
  '<a class="ui-btn" data-keep="quiz" href="quiz/index.html">Quiz index</a>',
  '<a class="reference-link" data-keep="reference" href="mission-01/">Mission reference</a>'
].join("\n");
const navigationMatrixResult = removeLegacyDeckNavigation(navigationFixture);
assert.doesNotMatch(
  navigationMatrixResult,
  /data-legacy=/,
  "all bare, parent-relative, root-relative, absolute, query and hash legacy controls must be removed"
);
assert.match(navigationMatrixResult, /data-keep="course"/);
assert.match(navigationMatrixResult, /data-keep="quiz"/);
assert.match(navigationMatrixResult, /data-keep="reference"/);

// --- mission decks use different control classes and two more destinations --
// The matcher was written from the lecture decks, which style their top
// controls `ui-btn`. Every mission in the course uses `btn` / `btn-secondary`
// and a `back-link`, and adds two destinations the lecture list never had:
// the public `progress/` app, and — the one that matters — the public copy of
// its own lecture. So no mission has ever been cleaned by this function, and
// as written none ever would be.
const missionNavigationFixture = [
  '<a class="btn" data-legacy="mission-lecture" href="../lecture/">Return to lecture</a>',
  '<a class="btn" data-legacy="mission-lecture-2" href="../lecture-2/">Return to lecture</a>',
  '<a class="btn btn-secondary" data-legacy="mission-progress" href="../../progress/">My progress</a>',
  '<a href="../lecture/" data-legacy="mission-backlink" class="back-link">Lecture</a>',
  '<a class="btn" data-legacy="mission-lecture-abs" '
    + 'href="https://mzareei.github.io/assets/course-materials/information-security/week-05/lecture/">Lecture</a>',
  '<a class="btn btn-secondary" data-legacy="mission-progress-abs" '
    + 'href="https://mzareei.github.io/assets/course-materials/information-security/progress/">Progress</a>',
  // Teaching content keeps its links. A prose anchor is not a nav control, and
  // an external reference has nothing to do with the public course site.
  '<a class="reference-link" data-keep="mission-reference" href="../lecture/">see the lecture</a>',
  '<a class="btn" data-keep="mission-external" href="https://owasp.org/">OWASP</a>'
].join("\n");
const missionNavigationResult = removeLegacyDeckNavigation(missionNavigationFixture);
assert.doesNotMatch(
  missionNavigationResult,
  /data-legacy=/,
  "mission controls must be removed for btn/back-link classes, and for the "
  + "public lecture and progress destinations"
);
assert.match(missionNavigationResult, /data-keep="mission-reference"/);
assert.match(missionNavigationResult, /data-keep="mission-external"/);

const nestedTeachingFixture = legacyFixture.replace(
  "<h2>Two</h2><p>Markup <strong>stays text</strong>.</p>",
  '<h2>Two</h2><section class="nested"><p>Nested teaching markup</p></section>'
);
assert.throws(
  () => extractTeachingSlides(nestedTeachingFixture),
  /nested <section>/i,
  "nested sections inside teaching slides must fail closed"
);
assert.throws(
  () => prepareLegacyDeckHtml(nestedTeachingFixture, checkpoints, {
    style: DECK_STYLE,
    script: DECK_SCRIPT
  }),
  /nested <section>/i
);

const quotedAttributeFixture = legacyFixture
  .replace(
    '<section class="slide title-slide active">',
    '<section class="slide title-slide active" data-section="A > B">'
  )
  .replace(
    '<section class="slide"><div class="slide-inner"><h2>Two</h2>',
    "<section class=\"slide\" data-section='C > D'><div class=\"slide-inner\"><h2>Two</h2>"
  );
const quotedAttributeSlides = extractTeachingSlides(quotedAttributeFixture);
const quotedAttributeUpgrade = prepareLegacyDeckHtml(
  quotedAttributeFixture,
  checkpoints,
  { style: DECK_STYLE, script: DECK_SCRIPT }
);
assert.match(
  quotedAttributeUpgrade,
  /data-section="A > B" data-teaching-slide="1">/,
  "double-quoted > must stay inside the original attribute"
);
assert.match(
  quotedAttributeUpgrade,
  /data-section='C > D' data-teaching-slide="2">/,
  "single-quoted > must stay inside the original attribute"
);
assert.deepEqual(
  extractTeachingSlides(quotedAttributeUpgrade),
  quotedAttributeSlides,
  "quote-aware numbering must preserve exact teaching text and order"
);
assert.doesNotMatch(
  quotedAttributeUpgrade,
  /data-section=(?:"A\s+data-teaching|'C\s+data-teaching)/,
  "numbering must not splice inside a quoted attribute"
);

for (const malformedQuotedTag of [
  '<main><section class="slide data-section=\'unterminated\'>Teaching</section></main>',
  '<main><section class=\'slide data-section="unterminated">Teaching</section></main>'
]) {
  assert.throws(
    () => extractTeachingSlides(malformedQuotedTag),
    /unterminated quoted html tag/i,
    "unterminated single or double attribute quotes must fail closed"
  );
}

const rawTextFixture = legacyFixture
  .replace(
    "<body>",
    '<body>\n<!-- <section class="slide">Comment-only fake section</section> -->'
  )
  .replace(
    '<script>window.lectureCustom = "$&";</script>',
    '<script>window.fakeSection = \'<section class="slide">Script-only fake</section>\'; window.lectureCustom = "$&";</script>'
  );
assert.equal(
  extractTeachingSlides(rawTextFixture).length,
  4,
  "section-looking text in comments and scripts must not enter the teaching coordinate system"
);
assert.equal(
  extractTeachingSlides(
    prepareLegacyDeckHtml(rawTextFixture, checkpoints, {
      style: DECK_STYLE,
      script: DECK_SCRIPT
    })
  ).length,
  4
);

const injected = injectCheckpointSections(legacyFixture, checkpoints);
assert.equal((injected.match(/data-teaching-slide="/g) || []).length, 4);
assert.equal((injected.match(/data-checkpoint-key=/g) || []).length, 1);
const teachingThree = injected.indexOf('data-teaching-slide="3"');
const checkpointThree = injected.indexOf('data-checkpoint-key="legacy-security"');
const teachingFour = injected.indexOf('data-teaching-slide="4"');
assert.ok(
  teachingThree < checkpointThree && checkpointThree < teachingFour,
  "the checkpoint must be inserted after teaching slide 3 without reordering slide 4"
);
assert.deepEqual(
  extractTeachingSlides(injected).map(({ number, text }) => ({ number, text })),
  extracted
);

const escapedCheckpoint = injectCheckpointSections(legacyFixture, [{
  key: 'unsafe"<&',
  afterSlide: 3,
  sourceStart: 3,
  sourceEnd: 3
}]);
assert.match(escapedCheckpoint, /data-checkpoint-key="unsafe&quot;&lt;&amp;"/);
assert.throws(
  () => injectCheckpointSections(legacyFixture, [{
    key: "missing-slide",
    afterSlide: 5,
    sourceStart: 4,
    sourceEnd: 4
  }]),
  /finalized teaching slide/
);

const sentinelAssets = replaceLegacyDeckAssets(legacyFixture, {
  style: ".checkpoint-slide::after { content: '$&'; }",
  script: "window.currentDeck = '$&';"
});
assert.match(sentinelAssets, /content: '\$&'/);
assert.match(sentinelAssets, /window\.currentDeck = '\$&'/);
assert.match(sentinelAssets, /lecture-custom::after \{ content: "\$&"; \}/);
assert.match(sentinelAssets, /window\.lectureCustom = "\$&"/);
assert.doesNotMatch(sentinelAssets, /window\.legacyPresenter/);

const upgraded = prepareLegacyDeckHtml(legacyFixture, checkpoints, {
  style: DECK_STYLE,
  script: DECK_SCRIPT
});
assert.equal((upgraded.match(/data-teaching-slide="/g) || []).length, 4);
assert.equal((upgraded.match(/data-checkpoint-key=/g) || []).length, 1);
assert.match(upgraded, /\.checkpoint-slide::before/);
assert.match(upgraded, /type: "deck\.checkpoint_entered"/);
assert.match(upgraded, /lecture-custom::after/);
assert.match(upgraded, /window\.lectureCustom/);
assert.doesNotMatch(upgraded, /window\.legacyPresenter/);
assert.deepEqual(
  extractTeachingSlides(upgraded).map(({ number, text }) => ({ number, text })),
  extracted
);
const retriedUpgrade = prepareLegacyDeckHtml(upgraded, checkpoints, {
  style: DECK_STYLE,
  script: DECK_SCRIPT
});
assert.equal((retriedUpgrade.match(/data-checkpoint-key=/g) || []).length, 1);
assert.deepEqual(
  extractTeachingSlides(retriedUpgrade).map(({ number, text }) => ({ number, text })),
  extracted
);

const backfillPath = path.join(
  root,
  "supabase/functions/course-checkpoint-backfill/index.ts"
);
const backfillSource = fs.readFileSync(backfillPath, "utf8");
assert.match(
  backfillSource,
  /import \{ DECK_SCRIPT, DECK_STYLE \} from "\.\.\/course-generation-worker\/deck-assets\.ts"/,
  "the backfill must reuse the current generated deck assets"
);
assert.match(backfillSource, /requireInstructor\(/);
assert.match(backfillSource, /content_type !== "lecture"/);
assert.match(backfillSource, /source_kind !== "storage_object"/);
assert.match(backfillSource, /\.eq\("status", "active"\)/);
assert.equal(
  (backfillSource.match(/generateStructured\(/g) || []).length,
  1,
  "the backfill must make one structured Claude call"
);
assert.match(backfillSource, /validateCheckpointBank\(/);
assert.match(backfillSource, /candidate_count < 2/);
assert.match(backfillSource, /checkpointMetadataState\(/);
assert.match(backfillSource, /checkpoint_preparation_state/);
assert.match(backfillSource, /prepareLegacyDeckHtml\([\s\S]*style: DECK_STYLE[\s\S]*script: DECK_SCRIPT/);
assert.match(backfillSource, /\.rpc\("begin_question_bank_checkpoint_preparation"/);
assert.match(backfillSource, /\.rpc\("complete_question_bank_checkpoint_preparation"/);
assert.doesNotMatch(
  backfillSource,
  /\.from\("questions"\)\s*\.update\(/,
  "question metadata must be committed through one transactional RPC"
);
assert.doesNotMatch(
  backfillSource,
  /\.from\("question_options"\)\s*\.(?:insert|update|upsert|delete)\(/,
  "backfill must never rewrite question options"
);

const validationIndex = backfillSource.indexOf("validateCheckpointBank(");
const metadataWriteIndex = backfillSource.indexOf(
  '.rpc("begin_question_bank_checkpoint_preparation"'
);
const storageWriteIndex = backfillSource.indexOf(".upload(\n      item.source_ref");
const completionWriteIndex = backfillSource.indexOf(
  '.rpc("complete_question_bank_checkpoint_preparation"'
);
assert.ok(validationIndex >= 0 && metadataWriteIndex > validationIndex);
assert.ok(
  storageWriteIndex > metadataWriteIndex,
  "validated metadata and durable pending state must precede the same-path storage upload"
);
assert.ok(
  completionWriteIndex > storageWriteIndex,
  "the bank can only become ready after its same-path deck upload succeeds"
);
const generateIndex = backfillSource.indexOf("await generateStructured(");
const pendingBranchIndex = backfillSource.indexOf(
  'bank.checkpoint_preparation_state === "pending_upload"'
);
assert.ok(
  pendingBranchIndex >= 0 && pendingBranchIndex < generateIndex,
  "a pending retry must be selected before the model call"
);
assert.match(
  backfillSource.slice(pendingBranchIndex, generateIndex),
  /persistedMappings\(questions[\s\S]*return persistPreparedDeck/,
  "pending retries must reconstruct the deck from persisted question metadata"
);

const migrationSource = fs.readFileSync(
  path.join(root, "supabase/migrations/0022_checkpoint_preparation_state.sql"),
  "utf8"
);
assert.match(
  migrationSource,
  /checkpoint_preparation_state[\s\S]*pending_upload[\s\S]*ready/
);
assert.match(
  migrationSource,
  /create or replace function public\.begin_question_bank_checkpoint_preparation/
);
assert.match(
  migrationSource,
  /jsonb_array_length\(p_mappings\)\s*<>\s*18/
);
assert.match(
  migrationSource,
  /segment_key\s*=[\s\S]*source_slide_numbers\s*=[\s\S]*source_slide_start\s*=[\s\S]*source_slide_end\s*=[\s\S]*checkpoint_after_slide\s*=/,
  "the begin RPC must write exactly the five checkpoint metadata fields"
);
assert.match(
  migrationSource,
  /checkpoint_preparation_state\s*=\s*'pending_upload'/
);
assert.match(
  migrationSource,
  /create or replace function public\.complete_question_bank_checkpoint_preparation/
);
assert.match(
  migrationSource,
  /checkpoint_preparation_state\s*=\s*'ready'/
);
assert.doesNotMatch(
  migrationSource,
  /\bset\s+(?:[\s\S]{0,300},\s*)?(?:prompt|prompt_es|option_text|status)\s*=/i,
  "checkpoint preparation must not rewrite prompts, options, or lifecycle status"
);
assert.match(
  migrationSource,
  /grant execute on function public\.begin_question_bank_checkpoint_preparation[\s\S]*to service_role/
);
assert.match(
  migrationSource,
  /grant execute on function public\.complete_question_bank_checkpoint_preparation[\s\S]*to service_role/
);

const configSource = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");
assert.match(
  configSource,
  /\[functions\.course-checkpoint-backfill\]\s*\n(?:#[^\n]*\n)*verify_jwt = false/
);

const bankSource = fs.readFileSync(
  path.join(root, "supabase/functions/course-question-bank/index.ts"),
  "utf8"
);
assert.match(
  bankSource,
  /content_item_id: bank\.content_item_id/,
  "the Content UI needs the real content item id returned by list_banks"
);
assert.match(
  bankSource,
  /checkpoint_preparation_state: bank\.checkpoint_preparation_state/,
  "list_banks must expose the durable preparation state"
);

console.log("verify-checkpoint-decks: OK");
