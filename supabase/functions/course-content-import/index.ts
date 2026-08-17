// Content authored outside the platform.
//
// The professor's own AI is the author; this function is the single door
// through which its output enters. It makes no model call. It authorizes the
// caller and re-checks, server-side, the structural facts the class depends
// on: question shape (questionFault) and deck self-containment/declared
// outbound links (validateDeckHtml) — so a client that skips the preview
// cannot push a structurally broken question set, or a deck with a surviving
// relative reference or an undeclared/forbidden outbound link, into private
// storage. This is not a general inline-script/exfiltration sandbox — it does
// not sanitize arbitrary inline script or CSS; the `/content` route's CSP is
// the runtime control for that broader class of risk. See
// _shared/deck-validation.ts's header for exactly what it does and doesn't
// check.
//
// The two halves fail independently: a bad deck must never block a question
// import, and vice versa.
//
// writeBank/writeDeck do NOT delegate to course-question-bank's import_bank
// action: that action unconditionally runs validateCheckpointBank, which
// requires exactly 18 questions in a 6/6/6 difficulty split plus a full set
// of checkpoint slide-mapping columns on every row — facts an externally
// authored file has no way to supply. Writes here go directly to
// content_items / question_banks / questions with the "flexible" generation
// validation profile and no checkpoint columns set, per the resolved,
// schema-verified contract in .superpowers/sdd/task-4-contract.md.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import {
  validateDeckHtml, partitionDeckProblems, type DeckProblem
} from "../_shared/deck-validation.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const PROMPT_MAX = 4000;
const OPTION_MAX = 2000;
const DIFFICULTIES = ["easy", "medium", "hard"];
const CONTENT_BUCKET = "course-content";

interface OptionPayload {
  option_text: string;
  option_text_es: string | null;
  is_correct: boolean;
  position: number;
}
interface QuestionPayload {
  prompt: string;
  prompt_es: string | null;
  difficulty: string;
  topic: string | null;
  topic_tags: string[];
  covers_up_to_slide: number | null;
  options: OptionPayload[];
}

/** The same structural facts the preview enforces, re-checked server-side.
 *  Not a judgment about the question — a statement about whether it can be
 *  displayed and graded at all. */
function questionFault(question: QuestionPayload, index: number): string | null {
  const at = `Question ${index + 1}`;
  if (!question.prompt?.trim()) return `${at} has no text.`;
  if (question.prompt.length > PROMPT_MAX) return `${at} is longer than ${PROMPT_MAX} characters.`;
  if (question.prompt_es && question.prompt_es.length > PROMPT_MAX) {
    return `${at} (Spanish) is longer than ${PROMPT_MAX} characters.`;
  }
  if (!DIFFICULTIES.includes(question.difficulty)) return `${at} has an unknown difficulty.`;
  if (!Array.isArray(question.options) || question.options.length !== 4) {
    return `${at} does not have four options.`;
  }
  // Strict equality, not truthiness: a direct API call bypassing the preview
  // could send is_correct: "false" (a truthy string) and pass a `.is_correct`
  // filter, so both this count and the per-option check below require the
  // real boolean.
  if (question.options.filter((option) => option.is_correct === true).length !== 1) {
    return `${at} does not have exactly one correct answer.`;
  }
  for (const option of question.options) {
    if (!option.option_text?.trim()) return `${at} has an empty option.`;
    if (option.option_text.length > OPTION_MAX) {
      return `${at} has an option longer than ${OPTION_MAX} characters.`;
    }
    if (option.option_text_es && option.option_text_es.length > OPTION_MAX) {
      return `${at} has a Spanish option longer than ${OPTION_MAX} characters.`;
    }
    if (option.is_correct !== true && option.is_correct !== false) {
      return `${at} has an option with a non-boolean correct flag.`;
    }
    if (!Number.isInteger(option.position) || option.position < 0 || option.position > 3) {
      return `${at} has an option with an invalid position.`;
    }
  }
  return null;
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));

    // A one-action switch, not an if: kept consistent with the dispatch
    // style every other multi-purpose function here uses
    // (course-question-bank/index.ts, course-generation/index.ts).
    switch (body.action) {
      case "import_content": {
        const db = adminClient();
        const courseId = cleanCourseId(body.course_id) || "tc2007b";
        const profile = await loadProfileForToken(db, token);
        const roles = await loadRoles(db, courseId, String(profile.id));
        if (!roles.some((role) => instructorRoles.includes(role))) {
          return json({ error: "This action is restricted to an instructor." }, { status: 403 });
        }

        const result: Record<string, unknown> = {
          bank: { ok: false },
          deck: { ok: false }
        };

        if (body.bank) {
          try {
            const questions = (body.bank.questions ?? []) as QuestionPayload[];
            if (!questions.length) throw new Error("The file contains no questions.");
            // A very large file means thousands of sequential round trips
            // inside one edge function invocation — cap it well above any
            // real lecture bank (the legacy hard profile caps at 18) but
            // well short of a pathological input causing a mid-loop timeout.
            if (questions.length > 200) {
              throw new Error(`A single import supports at most 200 questions; this file has ${questions.length}.`);
            }
            for (const [index, question] of questions.entries()) {
              const fault = questionFault(question, index);
              if (fault) throw new Error(fault);
            }
            const bankId = await writeBank(db, courseId, String(profile.id), body.bank, questions);
            result.bank = { ok: true, question_bank_id: bankId };
          } catch (error) {
            result.bank = { ok: false, error: message(error) };
          }
        }

        if (body.deck) {
          try {
            const problems: DeckProblem[] = validateDeckHtml(String(body.deck.html ?? ""), {
              allowedHosts: Array.isArray(body.deck.external_links) ? body.deck.external_links : [],
              forbiddenHosts: ["mzareei.github.io"]
            });
            // Only a blocking finding refuses the upload. An outbound link to
            // somewhere the professor did not pre-declare is reported and let
            // through — see partitionDeckProblems() for why, and note the
            // /content CSP is what actually contains an external reference at
            // runtime. `notices` travel on the success result so the professor
            // still learns where their deck points.
            const { blocking, notices } = partitionDeckProblems(problems);
            if (blocking.length) {
              result.deck = { ok: false, problems: blocking };
            } else {
              const itemId = await writeDeck(db, courseId, String(profile.id), body.deck);
              result.deck = notices.length
                ? { ok: true, content_item_id: itemId, notices }
                : { ok: true, content_item_id: itemId };
            }
          } catch (error) {
            result.deck = { ok: false, error: message(error) };
          }
        }

        // Table is audit_log, not audit_events. Columns verified against
        // 0006_gradebook_foundation.sql and the existing insert at
        // course-question-bank/index.ts:293 — target_type and action are NOT
        // NULL with length checks, and metadata must be a JSON object.
        const { error: auditError } = await db.from("audit_log").insert({
          course_id: courseId,
          actor_profile_id: profile.id,
          target_type: "content_import",
          target_id: null,
          action: "content_imported",
          metadata: result
        });
        // Same shape as course-question-bank's own audit insert (not a new
        // regression) — but this function's own header calls it "the single
        // door" for imported content, so its own audit trail failing
        // silently would undercut that claim. Log it; don't swallow it.
        if (auditError) console.error("course-content-import: audit_log insert failed", auditError);

        return json(result);
      }
      default:
        return json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
});

function message(error: unknown) {
  if (error instanceof Error) return error.message;
  const detail = (error as { message?: unknown })?.message;
  return typeof detail === "string" ? detail : "Unable to import this content.";
}

// ---------------------------------------------------------------------------
// Auth helpers — copied verbatim from course-question-bank/index.ts
// (lines 89–131) and course-generation/index.ts (cleanSlug, availableSlug),
// per the plan's explicit instruction not to invent new ones.
// ---------------------------------------------------------------------------

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function cleanSlug(value: unknown) {
  return String(value || "")
    .trim().toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  await assertCourseEmailAllowed(db, userData.user.email || "");
  const { data: profile, error } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("No active course profile is linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");
  return profile;
}

async function loadRoles(db: Db, courseId: string, profileId: string) {
  const { data, error } = await db
    .from("course_memberships")
    .select("role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (error) throw error;
  return (data || []).map((row) => String(row.role));
}

/** A slug free in this course. Used when the requested one is taken by another
 *  owner's item — the caller must never be told that item exists. The
 *  uniqueness constraint on content_items is (course_id, slug) only — not
 *  scoped by content_type — so this lookup deliberately is not either. */
async function availableSlug(db: Db, courseId: string, baseSlug: string) {
  const { data, error } = await db
    .from("content_items")
    .select("slug")
    .eq("course_id", courseId)
    .like("slug", `${baseSlug}%`);
  if (error) throw error;
  const taken = new Set((data || []).map((row: { slug: unknown }) => String(row.slug)));
  let candidate = baseSlug;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${baseSlug}-${suffix}`.slice(0, 160);
    suffix += 1;
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// content_items resolution — resolve-or-create, owner-safe (pitfall #60).
//
// A bank-only touch and a deck touch use two different update policies on an
// existing, caller-owned row:
//   - the bank path only ever overwrites `title` on update. It must never
//     touch content_type/source_kind/source_ref, because in a paired import
//     the given Deno.serve handler writes the bank half BEFORE the deck half
//     (see the header comment): if a bank-only re-import (no body.deck in
//     the request) later touches the same slug for an item that already
//     carries a deck, overwriting source_kind/source_ref back to the
//     bank-only shape would silently break the deck's storage pointer.
//   - the deck path always (re)asserts content_type='lecture',
//     source_kind='storage_object' and the fresh source_ref, on both insert
//     and update, mirroring the platform's own generation finalize function
//     (0035_pdf_teaching_plans.sql, the "update ... set content_type =
//     'lecture'" branch), because uploading a deck is always the operation
//     that legitimately (re)establishes those fields.
// Resolving the bank half first and the deck half second (in a paired
// import, both requested with the same slug) still converges on one shared
// row: the bank's resolution creates/updates it, and the deck's resolution
// finds that same row by slug and promotes it to a full lecture item. If the
// two slugs differ, each resolves its own independent row — exactly the
// plan's "two-independent-files" design.
//
// Both "yours, existing row" branches (bank and deck) also run
// isReimportableByThisFeature before touching anything: a slug collision
// with a generation-pipeline lecture, a Gen-1-migrated item, or hand-
// authored content must refuse, not silently corrupt what's already there.
//
// The deck path is further split into a read-only resolve step
// (resolveDeckTargetSlug — runs the owner-safety and reuse checks, decides
// the final slug, touches no tables) and a write step
// (writeDeckContentItemRow), so writeDeck can run the Storage upload between
// them: no row is written or updated until the bytes it will point at
// already exist in Storage.
// ---------------------------------------------------------------------------

function deckStoragePath(courseId: string, slug: string) {
  return `courses/${courseId}/imported/${slug}/deck.html`;
}

async function insertContentItem(
  db: Db,
  courseId: string,
  actorProfileId: string,
  input: { slug: string; title: string; contentType: string; sourceKind: string; sourceRef: string }
) {
  const { data: inserted, error } = await db
    .from("content_items")
    .insert({
      course_id: courseId,
      content_type: input.contentType,
      slug: input.slug,
      title: input.title,
      source_kind: input.sourceKind,
      source_ref: input.sourceRef,
      owner_profile_id: actorProfileId,
      created_by: actorProfileId
    })
    .select("id")
    .single();
  if (error) throw error;
  return String(inserted.id);
}

async function findContentItemBySlug(db: Db, courseId: string, slug: string) {
  const { data, error } = await db
    .from("content_items")
    .select("id, owner_profile_id")
    .eq("course_id", courseId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; owner_profile_id: string | null } | null;
}

function isCallersOwn(ownerProfileId: string | null, actorProfileId: string) {
  return ownerProfileId == null || String(ownerProfileId) === String(actorProfileId);
}

/** True only if every existing writer signature on this item matches what
 *  course-content-import itself would have written — never true for a
 *  generation-pipeline lecture, a Gen-1-migrated item, or anything hand-
 *  authored. This is what makes re-importing under the same slug safe:
 *  everything it's about to touch, it (or an earlier run of it) put there.
 *
 *  Deliberately does NOT take a caller-declared "expected kind" parameter
 *  (unlike the fix contract's literal draft): it derives the kind from the
 *  item's own actual content_type and checks THAT kind's shape. A single
 *  hard-coded expectedKind per call site breaks two legitimate flows the
 *  given Deno.serve handler already relies on — (1) a first-time combined
 *  import, where writeBank runs first and creates a fresh 'quiz_bank' item
 *  that writeDeck then promotes to 'lecture' moments later in the same
 *  request, and (2) a bank-only re-import targeting a slug that a prior
 *  request already paired with a deck (content_type is 'lecture' by then).
 *  Both are this feature's own prior writes and are exactly as safe to
 *  reuse as the single-kind case the contract's literal code covers — the
 *  real threat this guards against (a generation-pipeline lecture, a Gen-1
 *  migrated item, or hand-authored content) is excluded either way, because
 *  its source_kind/source_ref/bank-signature never matches what this
 *  feature itself produces for ANY of its two content_types. */
async function isReimportableByThisFeature(
  db: Db, existing: { id: string }, courseId: string, slug: string
): Promise<boolean> {
  const { data: item, error } = await db
    .from("content_items")
    .select("content_type, source_kind, source_ref")
    .eq("id", existing.id)
    .single();
  if (error) throw error;

  if (item.content_type === "lecture") {
    if (item.source_kind !== "storage_object") return false;
    if (item.source_ref !== deckStoragePath(courseId, slug)) return false;
  } else if (item.content_type === "quiz_bank") {
    if (item.source_kind !== "supabase_record") return false;
    if (item.source_ref !== slug) return false;
  } else {
    // Neither content_type this feature ever produces.
    return false;
  }

  const { data: banks, error: bankError } = await db
    .from("question_banks")
    .select("bank_type, generation_validation_profile, generation_job_id")
    .eq("content_item_id", existing.id)
    .eq("status", "active");
  if (bankError) throw bankError;
  // No active bank at all is fine (e.g. a deck-only item with no bank yet).
  // Any active bank must carry the exact signature only this feature writes:
  // graded + flexible + no generation_job_id. Practice banks (Gen-1 legacy),
  // legacy-profile banks (generation pipeline), or anything with a
  // generation_job_id (always the generation pipeline) all fail this check.
  return (banks || []).every((bank) =>
    bank.bank_type === "graded"
    && bank.generation_validation_profile === "flexible"
    && bank.generation_job_id == null
  );
}

function reuseRefusedError(slug: string) {
  return new Error(
    `"${slug}" already has course content that was not created by importing an ` +
    `external file. Import under a different slug, or archive the existing ` +
    `content first.`
  );
}

async function resolveBankContentItem(
  db: Db, courseId: string, actorProfileId: string, slug: string, title: string
): Promise<string> {
  const existing = await findContentItemBySlug(db, courseId, slug);

  if (existing) {
    if (isCallersOwn(existing.owner_profile_id, actorProfileId)) {
      // Critical guard: never silently take over a generation-pipeline
      // lecture, a Gen-1-migrated item, or hand-authored content. Every real
      // TC2007B lecture already has an active bank owned by the platform
      // owner (the same "yours" account) — without this check, importing
      // under an existing lecture's slug would corrupt it.
      if (!(await isReimportableByThisFeature(db, existing, courseId, slug))) {
        throw reuseRefusedError(slug);
      }
      const { error: updateError } = await db
        .from("content_items")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updateError) throw updateError;
      return String(existing.id);
    }
    // Owned by a different professor: never name the collision (pitfall #60).
    const freeSlug = await availableSlug(db, courseId, slug);
    return insertContentItem(db, courseId, actorProfileId, {
      slug: freeSlug,
      title,
      contentType: "quiz_bank",
      sourceKind: "supabase_record",
      sourceRef: freeSlug
    });
  }

  return insertContentItem(db, courseId, actorProfileId, {
    slug,
    title,
    contentType: "quiz_bank",
    sourceKind: "supabase_record",
    sourceRef: slug
  });
}

/** Read-only: figure out which slug the deck will actually land on, and run
 *  the owner-safety and Critical-finding reuse checks — all BEFORE anything
 *  is written, so a slug that turns out to be refused never triggers a
 *  Storage upload. Does not touch the database. */
async function resolveDeckTargetSlug(
  db: Db, courseId: string, actorProfileId: string, slug: string
): Promise<string> {
  const existing = await findContentItemBySlug(db, courseId, slug);
  if (!existing) return slug;

  if (isCallersOwn(existing.owner_profile_id, actorProfileId)) {
    // Critical guard: same reasoning as resolveBankContentItem — never
    // silently take over a generation-pipeline lecture, a Gen-1-migrated
    // item, or hand-authored content.
    if (!(await isReimportableByThisFeature(db, existing, courseId, slug))) {
      throw reuseRefusedError(slug);
    }
    return slug;
  }

  // Owned by a different professor: never name the collision (pitfall #60).
  return availableSlug(db, courseId, slug);
}

/** Write step only — assumes `slug` already passed resolveDeckTargetSlug's
 *  checks (or is fresh). Called AFTER the Storage upload succeeds, so a
 *  failed upload never leaves a row pointing at bytes that don't exist. */
async function writeDeckContentItemRow(
  db: Db, courseId: string, actorProfileId: string, slug: string, title: string
): Promise<string> {
  const existing = await findContentItemBySlug(db, courseId, slug);
  const sourceRef = deckStoragePath(courseId, slug);

  if (existing) {
    const { error: updateError } = await db
      .from("content_items")
      .update({
        title,
        content_type: "lecture",
        source_kind: "storage_object",
        source_ref: sourceRef,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id);
    if (updateError) throw updateError;
    return String(existing.id);
  }

  return insertContentItem(db, courseId, actorProfileId, {
    slug,
    title,
    contentType: "lecture",
    sourceKind: "storage_object",
    sourceRef
  });
}

// ---------------------------------------------------------------------------
// writeBank / writeDeck — the resolved contract
// (.superpowers/sdd/task-4-contract.md), not the plan's "delegates to
// import_bank" prose. See the file header for why.
// ---------------------------------------------------------------------------

/** Upsert a question bank (and its questions) from an externally authored
 *  file. `questions` has already passed questionFault for every row. */
async function writeBank(
  db: Db,
  courseId: string,
  actorProfileId: string,
  bank: Record<string, unknown>,
  questions: QuestionPayload[]
): Promise<string> {
  const slug = cleanSlug(bank.content_slug);
  if (!slug) throw new Error("A valid content slug is required.");
  const title = String(bank.title || "").trim().slice(0, 180);
  if (!title) throw new Error("A bank title is required.");
  // bank.title_es arrives per the frontend's contentImport.ts interface but
  // has no column on content_items or question_banks — accepted, ignored.

  const contentItemId = await resolveBankContentItem(db, courseId, actorProfileId, slug, title);

  const { data: savedBank, error: bankError } = await db
    .from("question_banks")
    .upsert(
      {
        course_id: courseId,
        content_item_id: contentItemId,
        title,
        bank_type: "graded",
        status: "active",
        // 'flexible', not the legacy 18/6-6-6 profile — an externally
        // imported bank has no checkpoint mapping to satisfy it.
        generation_validation_profile: "flexible",
        created_by: actorProfileId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "course_id,content_item_id,bank_type" }
    )
    .select("id")
    .maybeSingle();
  if (bankError) throw bankError;
  const bankId = String(savedBank!.id);

  // Leave hand-edited questions alone unless explicitly told otherwise —
  // same rule as course-question-bank's importBank.
  const { data: existing, error: existingError } = await db
    .from("questions")
    .select("id, generation_key, source")
    .eq("question_bank_id", bankId);
  if (existingError) throw existingError;
  const bySource = new Map(
    (existing || []).map((row) => [String(row.generation_key), String(row.source)])
  );
  const replaceEdited = Boolean(bank.replace_edited);

  for (const [index, question] of questions.entries()) {
    // No natural stable key from an externally authored file (unlike
    // model-generated banks, which emit their own key) — use the question's
    // position in the submitted array. A same-length re-import updates
    // matching positions in place; inserting/removing a question in the
    // middle of a revised file shifts every later position's identity. That
    // is an accepted, deliberate limitation, not a bug to solve here.
    const generationKey = `import_${index}`;
    if (bySource.get(generationKey) === "generated_edited" && !replaceEdited) continue;

    const { data: saved, error: saveError } = await db
      .from("questions")
      .upsert(
        {
          question_bank_id: bankId,
          generation_key: generationKey,
          prompt: question.prompt,
          prompt_es: question.prompt_es,
          question_type: "single_choice",
          difficulty: question.difficulty,
          topic_tags: Array.isArray(question.topic_tags)
            ? question.topic_tags.map((tag) => String(tag).toLowerCase().trim())
            : [],
          points: 1,
          status: "active",
          // Never "generated" or "imported" — "authored" is accurate (the
          // platform made no model call) and is the column's own default;
          // "imported" is not in the check constraint and would fail.
          source: "authored",
          // Informal hints carried straight from the file — a separate,
          // unvalidated concept from the strict checkpoint columns below.
          // They let a Class Question Plan auto-build itself later without
          // the professor retyping what the file already said.
          suggested_slide_hint: Number.isInteger(question.covers_up_to_slide)
            && (question.covers_up_to_slide as number) > 0
            && (question.covers_up_to_slide as number) <= 2147483647
            ? (question.covers_up_to_slide as number)
            : null,
          suggested_topic: typeof question.topic === "string" && question.topic.trim()
            ? question.topic.trim().slice(0, 160)
            : null,
          updated_at: new Date().toISOString()
          // Checkpoint columns (segment_key, source_slide_start/end,
          // checkpoint_after_slide) are intentionally left unset — they stay
          // at their schema defaults, the honest state for content with no
          // checkpoint bridge.
        },
        { onConflict: "question_bank_id,generation_key" }
      )
      .select("id")
      .maybeSingle();
    if (saveError) throw saveError;

    // Options are replaced wholesale: they are meaningless apart from their
    // stem. Insert the new four FIRST, then delete the specific old option
    // ids — question_options has no unique constraint beyond its primary key
    // (verified: only 0005_authenticated_activity_storage.sql's create
    // table, nothing else touches this table), so this ordering means the
    // question never has fewer than its old option count during the swap
    // (transiently 8, briefly, which nothing reads mid-request) instead of a
    // window where an active question has zero options if a failure lands
    // between delete and insert.
    const { data: oldOptions, error: oldOptionsError } = await db
      .from("question_options")
      .select("id")
      .eq("question_id", saved!.id);
    if (oldOptionsError) throw oldOptionsError;

    const { error: optionError } = await db.from("question_options").insert(
      question.options.map((option) => ({
        question_id: saved!.id,
        option_text: option.option_text,
        option_text_es: option.option_text_es,
        is_correct: option.is_correct,
        position: option.position
      }))
    );
    if (optionError) throw optionError;

    if (oldOptions?.length) {
      const { error: deleteError } = await db
        .from("question_options")
        .delete()
        .in("id", oldOptions.map((row) => row.id));
      if (deleteError) throw deleteError;
    }
  }

  // A shorter re-import (fewer questions than a previous run of this same
  // bank) leaves the tail of the old file's questions active unless they're
  // explicitly archived here. Safe to do unconditionally: the Critical guard
  // above guarantees every question this function's upsert loop could have
  // touched — and therefore every import_N key in this bank — originated
  // from course-content-import itself, never mixed with generated/legacy
  // questions from a different writer.
  const currentKeys = questions.map((_, index) => `import_${index}`);
  const staleKeys = (existing || [])
    .map((row) => String(row.generation_key))
    .filter((key) => /^import_\d+$/.test(key) && !currentKeys.includes(key));
  if (staleKeys.length) {
    const { error: archiveError } = await db
      .from("questions")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("question_bank_id", bankId)
      .in("generation_key", staleKeys);
    if (archiveError) throw archiveError;
  }

  return bankId;
}

/** Upload the validated deck HTML and resolve/create its content item.
 *  Only called once validateDeckHtml has returned zero problems.
 *
 *  Ordering matters here: resolve the target slug (read-only — no write to
 *  content_items) FIRST, then upload, then write/update the row LAST. If the
 *  upload fails, nothing in content_items has changed — no fresh row points
 *  at bytes that were never written, and no existing row has been repointed
 *  away from wherever it correctly pointed before. */
async function writeDeck(
  db: Db,
  courseId: string,
  actorProfileId: string,
  deck: Record<string, unknown>
): Promise<string> {
  const requestedSlug = cleanSlug(deck.slug);
  if (!requestedSlug) throw new Error("A valid content slug is required.");
  const title = String(deck.title || "").trim().slice(0, 180);
  if (!title) throw new Error("A deck title is required.");
  // deck.title_es arrives per the frontend's contentImport.ts interface but
  // has no column on content_items — accepted, ignored.
  const html = String(deck.html ?? "");

  // Resolve the target slug (and run the Critical-finding reuse check)
  // WITHOUT writing anything yet, so a failed upload never touches a row.
  const targetSlug = await resolveDeckTargetSlug(db, courseId, actorProfileId, requestedSlug);
  const path = deckStoragePath(courseId, targetSlug);

  const { error: uploadError } = await db.storage.from(CONTENT_BUCKET).upload(
    path,
    new Blob([html], { type: "text/html; charset=utf-8" }),
    { contentType: "text/html; charset=utf-8", upsert: true }
  );
  if (uploadError) throw uploadError;

  // Only now write/update the row — the bytes it will point at already exist.
  return await writeDeckContentItemRow(db, courseId, actorProfileId, targetSlug, title);
}
