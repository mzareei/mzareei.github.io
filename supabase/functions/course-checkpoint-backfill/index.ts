// Instructor-only preparation for storage-backed legacy lecture decks.
//
// The existing question stems and options are immutable here. Claude maps each
// question to finalized teaching slides and shared validators reject the complete
// mapping before one RPC commits all metadata plus a durable upload-pending state.
import { generateStructured, textBlock } from "../_shared/anthropic.ts";
import { adminClient } from "../_shared/client.ts";
import {
  deckHasCurrentProtocol,
  deckCheckpointsFromQuestions,
  extractTeachingSlides,
  prepareLegacyDeckHtml
} from "../_shared/checkpoint-deck.ts";
import {
  checkpointCoverage,
  checkpointMetadataColumns,
  checkpointMetadataFromQuestion,
  checkpointMetadataState,
  type CheckpointMetadata,
  validateCheckpointBank
} from "../_shared/checkpoints.ts";
import { coalesceSegmentKeysByCheckpoint } from "../_shared/checkpoint-mapping.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
import { DECK_SCRIPT, DECK_STYLE } from "../course-generation-worker/deck-assets.ts";

type Db = ReturnType<typeof adminClient>;

type StoredQuestion = {
  id: string;
  difficulty: string;
  prompt: string;
  prompt_es: string | null;
  segment_key: string | null;
  source_slide_numbers: number[];
  source_slide_start: number | null;
  source_slide_end: number | null;
  checkpoint_after_slide: number | null;
};

type MappedQuestion = {
  questionId: string;
  difficulty: string;
  metadata: CheckpointMetadata;
};

export type BackfillResult = {
  content_item_id: string;
  question_bank_id: string;
  storage_path: string;
  teaching_slide_count: number;
  checkpoint_count: number;
  mapped_question_count: number;
  preparation_state: "ready";
  deck_upgraded: boolean;
};

const bucket = "course-content";
const instructorRoles = ["platform_owner", "instructor"];
const mappingKeys = [
  "checkpoint_after_slide",
  "question_id",
  "segment_key",
  "source_slide_end",
  "source_slide_numbers",
  "source_slide_start"
];
const mappingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mappings: {
      type: "array",
      minItems: 18,
      maxItems: 18,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question_id: {
            type: "string",
            description: "The unchanged database id of the existing question."
          },
          segment_key: {
            type: "string",
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            description: "Stable lowercase-hyphenated concept key."
          },
          source_slide_numbers: {
            type: "array",
            minItems: 1,
            items: { type: "integer", minimum: 1 }
          },
          source_slide_start: { type: "integer", minimum: 1 },
          source_slide_end: { type: "integer", minimum: 1 },
          checkpoint_after_slide: { type: "integer", minimum: 1 }
        },
        required: mappingKeys
      }
    }
  },
  required: ["mappings"]
} as const;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (body.action !== "prepare") {
      return json({ error: "Unknown action." }, { status: 400 });
    }

    const db = adminClient();
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    await requireInstructor(db, token, courseId);
    return json(await prepareCheckpoints(db, courseId, body));
  } catch (error) {
    const message = error instanceof Error
      ? error.message || "Unable to prepare lecture checkpoints."
      : "Unable to prepare lecture checkpoints.";
    if (message.includes("not allowed")) {
      return json({ error: message }, { status: 403 });
    }
    return json({ error: message }, { status: 400 });
  }
});

function bearerToken(value: string | null): string {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);
}

async function requireInstructor(db: Db, token: string, courseId: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  await assertCourseEmailAllowed(db, userData.user.email || "");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    throw new Error("Checkpoint preparation is not allowed without an active course profile.");
  }
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("role")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active");
  if (membershipError) throw membershipError;
  const permitted = (memberships || []).some((membership) =>
    instructorRoles.includes(String(membership.role))
  );
  if (!permitted) {
    throw new Error("Checkpoint preparation is not allowed for this role.");
  }
  return profile;
}

function contentItemId(value: unknown): string {
  const id = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("A valid content item id is required.");
  }
  return id;
}

function exactMappingRecord(raw: unknown, index: number): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Mapping ${index + 1} must be an object.`);
  }
  const record = raw as Record<string, unknown>;
  const keys = Reflect.ownKeys(record);
  if (
    keys.some((key) => typeof key !== "string")
    || keys.map(String).sort().join(",") !== mappingKeys.join(",")
  ) {
    throw new Error(`Mapping ${index + 1} contains missing or unknown fields.`);
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      throw new Error(`Mapping ${index + 1} contains an unsafe property.`);
    }
  }
  return record;
}

function validateMappings(
  raw: Record<string, unknown>,
  questions: StoredQuestion[],
  teachingSlideCount: number
): {
  mappings: MappedQuestion[];
  coverage: ReturnType<typeof checkpointCoverage>;
} {
  const rawMappings = Array.isArray(raw.mappings) ? raw.mappings : [];
  if (rawMappings.length !== questions.length) {
    throw new Error(
      `Claude must map every existing question exactly once; expected ${questions.length}, found ${rawMappings.length}.`
    );
  }

  const questionById = new Map(questions.map((question) => [String(question.id), question]));
  const seenIds = new Set<string>();
  const byId = new Map<string, MappedQuestion>();
  rawMappings.forEach((value, index) => {
    const record = exactMappingRecord(value, index);
    const questionId = String(record.question_id || "").trim();
    const question = questionById.get(questionId);
    if (!question) throw new Error(`Mapping ${index + 1} identifies an unknown question.`);
    if (seenIds.has(questionId)) throw new Error(`Question ${questionId} was mapped more than once.`);
    seenIds.add(questionId);

    const metadata = checkpointMetadataFromQuestion(record);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.segmentKey)) {
      throw new Error(`Mapping ${index + 1} has an invalid segment key.`);
    }
    byId.set(questionId, {
      questionId,
      difficulty: String(question.difficulty),
      metadata
    });
  });

  const mappings = questions.map((question) => {
    const mapping = byId.get(String(question.id));
    if (!mapping) throw new Error(`Question ${question.id} was not mapped.`);
    return mapping;
  });
  const checkpointProblems = validateCheckpointBank(
    mappings.map((mapping) => ({
      ...mapping.metadata,
      difficulty: mapping.difficulty
    })),
    teachingSlideCount
  );
  if (checkpointProblems.length) {
    throw new Error(
      `Legacy bank mapping rejected: ${checkpointProblems.slice(0, 6).join("; ")}`
    );
  }

  const coverage = checkpointCoverage(mappings.map((mapping) => ({
    ...mapping.metadata,
    difficulty: mapping.difficulty
  })));
  if (coverage.length < 3 || coverage.length > 5) {
    throw new Error(`Legacy banks require 3–5 checkpoints; found ${coverage.length}.`);
  }
  const sparse = coverage.find((checkpoint) => checkpoint.candidate_count < 2);
  if (sparse) {
    throw new Error(
      `Checkpoint after slide ${sparse.checkpoint_after_slide} has fewer than 2 candidates.`
    );
  }
  return { mappings, coverage };
}

function persistedMappings(
  questions: StoredQuestion[],
  teachingSlideCount: number
): ReturnType<typeof validateMappings> {
  return validateMappings(
    {
      mappings: questions.map((question) => ({
        checkpoint_after_slide: question.checkpoint_after_slide,
        question_id: question.id,
        segment_key: question.segment_key,
        source_slide_end: question.source_slide_end,
        source_slide_numbers: question.source_slide_numbers,
        source_slide_start: question.source_slide_start
      }))
    },
    questions,
    teachingSlideCount
  );
}

function backfillResult(
  item: { id: unknown; source_ref: string },
  bank: { id: unknown },
  teachingSlideCount: number,
  mappedQuestionCount: number,
  checkpointCount: number,
  deckUpgraded: boolean
): BackfillResult {
  return {
    content_item_id: String(item.id),
    question_bank_id: String(bank.id),
    storage_path: String(item.source_ref),
    teaching_slide_count: teachingSlideCount,
    checkpoint_count: checkpointCount,
    mapped_question_count: mappedQuestionCount,
    preparation_state: "ready",
    deck_upgraded: deckUpgraded
  };
}

async function persistPreparedDeck(
  db: Db,
  courseId: string,
  item: { id: unknown; source_ref: string },
  bank: { id: unknown },
  currentHtml: string,
  teachingSlideCount: number,
  mappings: MappedQuestion[],
  coverage: ReturnType<typeof checkpointCoverage>,
  beginPreparation: boolean
): Promise<BackfillResult> {
  const deckCheckpoints = deckCheckpointsFromQuestions(
    mappings.map((mapping) => ({
      segment_key: mapping.metadata.segmentKey,
      source_slide_start: mapping.metadata.sourceSlideStart,
      source_slide_end: mapping.metadata.sourceSlideEnd,
      checkpoint_after_slide: mapping.metadata.checkpointAfterSlide
    }))
  );
  const preparedHtml = prepareLegacyDeckHtml(
    currentHtml,
    deckCheckpoints.map((checkpoint) => ({
      key: checkpoint.key,
      afterSlide: checkpoint.after_slide,
      sourceStart: checkpoint.source_slide_start,
      sourceEnd: checkpoint.source_slide_end
    })),
    {
      style: DECK_STYLE,
      script: DECK_SCRIPT
    }
  );

  if (beginPreparation) {
    const { error: beginError } = await db
      .rpc("begin_question_bank_checkpoint_preparation", {
        p_course_id: courseId,
        p_bank_id: bank.id,
        p_mappings: mappings.map((mapping) => ({
          question_id: mapping.questionId,
          ...checkpointMetadataColumns(mapping.metadata)
        }))
      });
    if (beginError) throw beginError;
  }

  // Storage is the last content mutation. If this upload fails, or if the
  // readiness acknowledgement below fails, pending_upload remains retryable.
  const { error: uploadError } = await db.storage
    .from(bucket)
    .upload(
      item.source_ref,
      new Blob([preparedHtml], { type: "text/html; charset=utf-8" }),
      { contentType: "text/html; charset=utf-8", upsert: true }
    );
  if (uploadError) throw uploadError;

  const { error: completionError } = await db
    .rpc("complete_question_bank_checkpoint_preparation", {
      p_course_id: courseId,
      p_bank_id: bank.id
    });
  if (completionError) throw completionError;

  return backfillResult(
    item,
    bank,
    teachingSlideCount,
    mappings.length,
    coverage.length,
    true
  );
}

async function prepareCheckpoints(
  db: Db,
  courseId: string,
  body: Record<string, unknown>
): Promise<BackfillResult> {
  const requestedId = contentItemId(body.content_item_id);
  const { data: item, error: itemError } = await db
    .from("content_items")
    .select("id, course_id, content_type, source_kind, source_ref")
    .eq("id", requestedId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new Error("That lecture was not found.");
  if (item.content_type !== "lecture") {
    throw new Error("Only lectures can be prepared for checkpoints.");
  }
  if (item.source_kind !== "storage_object") {
    throw new Error("Only private storage-backed lectures can be prepared.");
  }
  const expectedPrefix = `courses/${courseId}/items/`;
  const storagePath = String(item.source_ref || "");
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new Error("The lecture does not point to this course's private content path.");
  }
  const storageItem = { id: item.id, source_ref: storagePath };

  const { data: banks, error: bankError } = await db
    .from("question_banks")
    .select("id, content_item_id, status, checkpoint_preparation_state")
    .eq("course_id", courseId)
    .eq("content_item_id", item.id)
    .eq("status", "active");
  if (bankError) throw bankError;
  if ((banks || []).length !== 1) {
    throw new Error("The lecture must have exactly one active question bank.");
  }
  const bank = banks[0];

  const { data: deckBlob, error: downloadError } = await db.storage
    .from(bucket)
    .download(storagePath);
  if (downloadError) throw downloadError;
  const legacyHtml = await deckBlob.text();
  const teachingSlides = extractTeachingSlides(legacyHtml);
  if (!teachingSlides.length) throw new Error("The private lecture deck has no teaching slides.");

  const { data: questionRows, error: questionError } = await db
    .from("questions")
    .select(
      "id, difficulty, prompt, prompt_es, segment_key, source_slide_numbers, source_slide_start, source_slide_end, checkpoint_after_slide"
    )
    .eq("question_bank_id", bank.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (questionError) throw questionError;
  const questions = (questionRows || []) as StoredQuestion[];
  if (questions.length !== 18) {
    throw new Error(`The active bank must contain exactly 18 questions; found ${questions.length}.`);
  }
  const metadataState = checkpointMetadataState(
    questions as unknown as Array<Record<string, unknown>>
  );
  if (bank.checkpoint_preparation_state === "pending_upload") {
    if (metadataState.status !== "valid") {
      throw new Error("Pending checkpoint preparation has incomplete persisted metadata.");
    }
    const retry = persistedMappings(questions, teachingSlides.length);
    return persistPreparedDeck(
      db,
      courseId,
      storageItem,
      bank,
      legacyHtml,
      teachingSlides.length,
      retry.mappings,
      retry.coverage,
      false
    );
  }
  if (bank.checkpoint_preparation_state === "ready") {
    if (metadataState.status !== "valid") {
      throw new Error("A ready checkpoint bank has invalid persisted metadata.");
    }
    const ready = persistedMappings(questions, teachingSlides.length);
    if (!deckHasCurrentProtocol(legacyHtml)) {
      return persistPreparedDeck(
        db,
        courseId,
        storageItem,
        bank,
        legacyHtml,
        teachingSlides.length,
        ready.mappings,
        ready.coverage,
        false
      );
    }
    return backfillResult(
      storageItem,
      bank,
      teachingSlides.length,
      ready.mappings.length,
      ready.coverage.length,
      false
    );
  }
  if (bank.checkpoint_preparation_state !== "none") {
    throw new Error("The checkpoint preparation state is not recognized.");
  }
  if (metadataState.status !== "missing") {
    throw new Error("Only a legacy bank with completely missing checkpoint metadata can be prepared.");
  }

  const { data: optionRows, error: optionError } = await db
    .from("question_options")
    .select("question_id, option_text, option_text_es, is_correct, position")
    .in("question_id", questions.map((question) => question.id))
    .order("position", { ascending: true });
  if (optionError) throw optionError;
  const optionsByQuestion = new Map<string, Array<Record<string, unknown>>>();
  for (const option of optionRows || []) {
    const questionId = String(option.question_id);
    optionsByQuestion.set(questionId, [
      ...(optionsByQuestion.get(questionId) || []),
      {
        text: option.option_text,
        text_es: option.option_text_es,
        is_correct: option.is_correct,
        position: option.position
      }
    ]);
  }
  for (const question of questions) {
    const options = optionsByQuestion.get(String(question.id)) || [];
    if (options.length !== 4 || options.filter((option) => option.is_correct).length !== 1) {
      throw new Error(`Question ${question.id} must have four options and one correct answer.`);
    }
  }

  const result = await generateStructured({
    system:
      "You map existing university multiple-choice questions to finalized teaching slides. " +
      "Never rewrite, paraphrase, translate, add or remove a prompt or option. Return only metadata " +
      "for every supplied question id. Cite every teaching slide needed to answer each question, " +
      "keep source slides ascending, and place each checkpoint at or after all of its cited slides. " +
      "Group all 18 questions into 3–5 concept checkpoints with at least two candidates per checkpoint.",
    content: [
      textBlock(
        "Finalized teaching slides:\n" +
        JSON.stringify(teachingSlides) +
        "\n\nExisting immutable questions and options:\n" +
        JSON.stringify(questions.map((question) => ({
          question_id: question.id,
          difficulty: question.difficulty,
          prompt: question.prompt,
          prompt_es: question.prompt_es,
          options: optionsByQuestion.get(String(question.id))
        })))
      )
    ],
    toolName: "map_legacy_questions",
    toolDescription:
      "Map each unchanged existing question id to source teaching slides and one of 3–5 checkpoint boundaries.",
    schema: mappingSchema,
    maxTokens: 7000
  });
  const normalizedResult = {
    ...result,
    mappings: coalesceSegmentKeysByCheckpoint(
      Array.isArray(result.mappings) ? result.mappings : []
    )
  };
  const { mappings, coverage } = validateMappings(
    normalizedResult,
    questions,
    teachingSlides.length
  );
  return persistPreparedDeck(
    db,
    courseId,
    storageItem,
    bank,
    legacyHtml,
    teachingSlides.length,
    mappings,
    coverage,
    true
  );
}
