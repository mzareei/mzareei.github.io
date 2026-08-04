import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  checkpointCoverage,
  checkpointMetadataColumns,
  checkpointMetadataState,
  validateCheckpointBank,
  validateCheckpointMetadata
} from "../supabase/functions/_shared/checkpoints.ts";
import {
  deckCheckpointsFromQuestions
} from "../supabase/functions/_shared/checkpoint-deck.ts";
import {
  assembleDeck
} from "../supabase/functions/course-generation-worker/deck.ts";
import {
  DECK_SCRIPT,
  DECK_SKELETON,
  DECK_STYLE
} from "../supabase/functions/course-generation-worker/deck-assets.ts";
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

const deckQuestions = [
  {
    segment_key: "access-decisions",
    checkpoint_after_slide: 3,
    source_slide_start: 2,
    source_slide_end: 3
  },
  {
    segment_key: "cia-triad",
    checkpoint_after_slide: 1,
    source_slide_start: 1,
    source_slide_end: 1
  },
  {
    segment_key: "access-decisions",
    checkpoint_after_slide: 3,
    source_slide_start: 3,
    source_slide_end: 3
  }
];
assert.deepEqual(deckCheckpointsFromQuestions(deckQuestions), [
  {
    key: "cia-triad",
    after_slide: 1,
    segment_key: "cia-triad",
    source_slide_start: 1,
    source_slide_end: 1
  },
  {
    key: "access-decisions",
    after_slide: 3,
    segment_key: "access-decisions",
    source_slide_start: 2,
    source_slide_end: 3
  }
]);
assert.deepEqual(deckCheckpointsFromQuestions([
  {
    segment_key: "reused-segment",
    checkpoint_after_slide: 1,
    source_slide_start: 1,
    source_slide_end: 1
  },
  {
    segment_key: "reused-segment",
    checkpoint_after_slide: 3,
    source_slide_start: 2,
    source_slide_end: 3
  }
]).map(({ key, after_slide }) => ({ key, after_slide })), [
  { key: "reused-segment-1", after_slide: 1 },
  { key: "reused-segment-3", after_slide: 3 }
]);

const fixtureSlides = [1, 2, 3].map((slideNumber) => ({
  slide_number: slideNumber,
  kind: slideNumber === 1 ? "title" : "bullets",
  section: `Section ${slideNumber}`,
  section_es: `Sección ${slideNumber}`,
  heading: `Teaching slide ${slideNumber}`,
  heading_es: `Diapositiva didáctica ${slideNumber}`
}));
const fixtureHtml = await assembleDeck({
  title: "Checkpoint fixture",
  slides: fixtureSlides,
  checkpoints: deckCheckpointsFromQuestions(deckQuestions)
});
const teachingOne = fixtureHtml.indexOf('data-teaching-slide="1"');
const checkpointOne = fixtureHtml.indexOf('data-checkpoint-key="cia-triad"');
const teachingTwo = fixtureHtml.indexOf('data-teaching-slide="2"');
const teachingThree = fixtureHtml.indexOf('data-teaching-slide="3"');
const checkpointThree = fixtureHtml.indexOf('data-checkpoint-key="access-decisions"');
assert.ok(
  teachingOne < checkpointOne
  && checkpointOne < teachingTwo
  && teachingTwo < teachingThree
  && teachingThree < checkpointThree,
  "checkpoint sections must follow their matching teaching slide without renumbering teaching slides"
);
assert.equal((fixtureHtml.match(/data-teaching-slide="/g) || []).length, 3);
assert.match(
  fixtureHtml,
  /class="slide checkpoint-slide"[^>]*data-checkpoint-key="cia-triad"[^>]*data-after-slide="1"[^>]*data-source-start="1"[^>]*data-source-end="1"/
);
assert.match(fixtureHtml, /data-es="Repaso rápido"[^>]*>Quick check</);
assert.match(fixtureHtml, /data-es="Pregunta lista"[^>]*>Question ready</);
assert.match(fixtureHtml, /class="checkpoint-slot" aria-live="polite"/);
assert.doesNotMatch(fixtureHtml, /<a\b/i);
assert.doesNotMatch(
  fixtureHtml,
  /mzareei\.github\.io|course-platform-3ko\.pages\.dev|assets\/course-materials/i
);

const templateRoot = path.join(
  root,
  "supabase/functions/_shared/templates"
);
assert.equal(
  DECK_SKELETON,
  fs.readFileSync(path.join(templateRoot, "deck-skeleton.html"), "utf8"),
  "embedded deck skeleton must be rebuilt from its editable source"
);
assert.equal(
  DECK_STYLE,
  fs.readFileSync(path.join(templateRoot, "deck-style.css"), "utf8"),
  "embedded deck style must be rebuilt from its editable source"
);
assert.equal(
  DECK_SCRIPT,
  fs.readFileSync(path.join(templateRoot, "deck-script.js"), "utf8"),
  "embedded deck script must be rebuilt from its editable source"
);
assert.match(DECK_SCRIPT, /parent\.postMessage\(payload, location\.origin\)/);
assert.match(
  DECK_SCRIPT,
  /event\.origin !== location\.origin \|\| event\.source !== parent/
);
assert.match(DECK_SCRIPT, /value\.version !== 1/);
assert.match(DECK_SCRIPT, /type: "deck\.checkpoint_action"/);
assert.match(
  DECK_SCRIPT,
  /case " ":[\s\S]*if \(checkpointKey\)[\s\S]*deck\.checkpoint_action[\s\S]*else next\(\)/
);

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : Boolean(force);
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class FakeElement {
  constructor({ attributes = {}, classes = [] } = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.classList = new FakeClassList(classes);
    this.listeners = new Map();
    this.style = {};
    this.textContent = "";
    this.innerHTML = "";
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  appendChild() {}
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

function verifyCheckpointKeyboardBridge(script) {
  const teachingOne = new FakeElement({
    attributes: {
      "data-teaching-slide": "1",
      "data-section": "Start",
      "data-section-es": "Inicio"
    },
    classes: ["slide", "active"]
  });
  const checkpoint = new FakeElement({
    attributes: {
      "data-checkpoint-key": "checkpoint-one",
      "data-after-slide": "1",
      "data-section": "Quick check",
      "data-section-es": "Repaso rápido"
    },
    classes: ["slide", "checkpoint-slide"]
  });
  const teachingTwo = new FakeElement({
    attributes: {
      "data-teaching-slide": "2",
      "data-section": "Continue",
      "data-section-es": "Continuar"
    },
    classes: ["slide"]
  });
  const slides = [teachingOne, checkpoint, teachingTwo];
  const ids = new Map([
    "progress", "cur", "total", "secName", "overview", "ovGrid", "ovTitle",
    "help", "fragHint", "fragHintText", "langBtn", "themeBtn", "nextBtn",
    "prevBtn", "fsBtn", "ovBtn", "helpBtn", "deck"
  ].map((id) => [id, new FakeElement()]));
  const documentListeners = new Map();
  const windowListeners = new Map();
  const posted = [];
  const location = { hash: "", origin: "https://course.example.test" };
  const rootElement = new FakeElement();
  const document = {
    documentElement: rootElement,
    fullscreenElement: null,
    addEventListener(type, listener) { documentListeners.set(type, listener); },
    createElement() { return new FakeElement(); },
    exitFullscreen() {},
    getElementById(id) { return ids.get(id); },
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector === ".slide") return slides;
      return [];
    }
  };
  const parent = {
    postMessage(message, targetOrigin) {
      posted.push({
        message: JSON.parse(JSON.stringify(message)),
        targetOrigin
      });
    }
  };
  const window = {
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    innerWidth: 1280
  };
  const localStorage = {
    getItem() { return null; },
    setItem() {}
  };
  const history = { replaceState() {} };

  vm.runInNewContext(script, {
    clearTimeout,
    console,
    document,
    history,
    localStorage,
    location,
    Object,
    parent,
    parseInt,
    setTimeout,
    window
  });

  const keydown = documentListeners.get("keydown");
  assert.equal(typeof keydown, "function");
  const keyEvent = (key) => ({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault() {}
  });

  posted.length = 0;
  keydown(keyEvent("ArrowRight"));
  assert.equal(checkpoint.classList.contains("active"), true);

  const parentMessage = windowListeners.get("message");
  assert.equal(typeof parentMessage, "function");
  const deliverParentMessage = (data) => parentMessage({
    data,
    origin: location.origin,
    source: parent
  });
  const hiddenExecutableMessage = {
    version: 1,
    type: "checkpoint.question_ready",
    checkpoint_key: "checkpoint-one"
  };
  Object.defineProperty(hiddenExecutableMessage, "execute", {
    enumerable: false,
    value() {}
  });
  deliverParentMessage(hiddenExecutableMessage);
  assert.equal(
    checkpoint.getAttribute("data-checkpoint-state"),
    null,
    "deck must reject a parent message with a hidden executable property"
  );

  const hiddenUnknownMessage = {
    version: 1,
    type: "checkpoint.question_ready",
    checkpoint_key: "checkpoint-one"
  };
  Object.defineProperty(hiddenUnknownMessage, "internal", {
    enumerable: false,
    value: "unexpected"
  });
  deliverParentMessage(hiddenUnknownMessage);
  assert.equal(
    checkpoint.getAttribute("data-checkpoint-state"),
    null,
    "deck must reject a parent message with a hidden unknown property"
  );

  deliverParentMessage({
    version: 1,
    type: "checkpoint.question_ready",
    checkpoint_key: "checkpoint-one"
  });
  assert.equal(checkpoint.getAttribute("data-checkpoint-state"), "ready");

  posted.length = 0;
  keydown(keyEvent(" "));
  assert.equal(checkpoint.classList.contains("active"), true);
  assert.deepEqual(posted, [{
    message: {
      type: "deck.checkpoint_action",
      checkpoint_key: "checkpoint-one",
      version: 1
    },
    targetOrigin: location.origin
  }]);

  posted.length = 0;
  keydown(keyEvent("ArrowRight"));
  assert.equal(teachingTwo.classList.contains("active"), true);
  assert.deepEqual(posted.map(({ message }) => message.type), [
    "deck.checkpoint_skipped",
    "deck.slide_changed"
  ]);
}

verifyCheckpointKeyboardBridge(DECK_SCRIPT);

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
assert.match(workerSource, /deckCheckpointsFromQuestions\(questions\)/);

const bankSource = fs.readFileSync(
  path.join(root, "supabase/functions/course-question-bank/index.ts"),
  "utf8"
);
const identitySource = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/identity.ts"),
  "utf8"
);
const adminSource = fs.readFileSync(
  path.join(root, "supabase/functions/course-admin/index.ts"),
  "utf8"
);
assert.match(identitySource, /hasInstructorMembership/, "external instructors need a server-side role check");
assert.match(identitySource, /instructor.*platform_owner|platform_owner.*instructor/, "external instructor roles must be explicit");
assert.match(adminSource, /assertInstructorEmailAllowed/, "admin invitations must accept external instructor emails");
assert.match(bankSource, /checkpoint_coverage:\s*checkpointCoverage\(/);
assert.match(bankSource, /checkpoint_metadata_status:\s*metadataState\.status/);
assert.match(bankSource, /checkpoint_metadata_present:\s*metadataState\.presentCount/);
assert.match(bankSource, /checkpoint_metadata_valid:\s*metadataState\.validRows\.length/);
assert.match(bankSource, /\.eq\("checkpoint_after_slide", checkpointAfterSlide\)/);
assert.match(bankSource, /case "list_questions"/, "question banks must expose instructor review");
assert.match(bankSource, /case "update_question"/, "question banks must support expert edits");
assert.match(bankSource, /case "delete_question"/, "question banks must support safe removal");
assert.match(bankSource, /source:\s*"generated_edited"/, "edits must be marked as hand-reviewed");
assert.match(bankSource, /status:\s*"archived"/, "deletion must preserve historical question references");
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
