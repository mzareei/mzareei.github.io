// Content authored outside the platform.
//
// The professor's own AI is the author; this function is the single door
// through which its output enters. It makes no model call. It authorizes the
// caller, re-checks the structural facts the class depends on at runtime, and
// writes both halves — so a client that skips the preview cannot push
// unvalidated content into private storage.
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
import { validateDeckHtml, type DeckProblem } from "../_shared/deck-validation.ts";
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
  if (question.options.filter((option) => option.is_correct).length !== 1) {
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
            if (problems.length) {
              result.deck = { ok: false, problems };
            } else {
              const itemId = await writeDeck(db, courseId, String(profile.id), body.deck);
              result.deck = { ok: true, content_item_id: itemId };
            }
          } catch (error) {
            result.deck = { ok: false, error: message(error) };
          }
        }

        // Table is audit_log, not audit_events. Columns verified against
        // 0006_gradebook_foundation.sql and the existing insert at
        // course-question-bank/index.ts:293 — target_type and action are NOT
        // NULL with length checks, and metadata must be a JSON object.
        await db.from("audit_log").insert({
          course_id: courseId,
          actor_profile_id: profile.id,
          target_type: "content_import",
          target_id: null,
          action: "content_imported",
          metadata: result
        });

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

async function resolveBankContentItem(
  db: Db, courseId: string, actorProfileId: string, slug: string, title: string
): Promise<string> {
  const existing = await findContentItemBySlug(db, courseId, slug);

  if (existing) {
    if (isCallersOwn(existing.owner_profile_id, actorProfileId)) {
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

async function resolveDeckContentItem(
  db: Db, courseId: string, actorProfileId: string, slug: string, title: string
): Promise<{ id: string; slug: string }> {
  const existing = await findContentItemBySlug(db, courseId, slug);

  if (existing) {
    if (isCallersOwn(existing.owner_profile_id, actorProfileId)) {
      const { error: updateError } = await db
        .from("content_items")
        .update({
          title,
          content_type: "lecture",
          source_kind: "storage_object",
          source_ref: deckStoragePath(courseId, slug),
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
      if (updateError) throw updateError;
      return { id: String(existing.id), slug };
    }
    // Owned by a different professor: never name the collision (pitfall #60).
    const freeSlug = await availableSlug(db, courseId, slug);
    const id = await insertContentItem(db, courseId, actorProfileId, {
      slug: freeSlug,
      title,
      contentType: "lecture",
      sourceKind: "storage_object",
      sourceRef: deckStoragePath(courseId, freeSlug)
    });
    return { id, slug: freeSlug };
  }

  const id = await insertContentItem(db, courseId, actorProfileId, {
    slug,
    title,
    contentType: "lecture",
    sourceKind: "storage_object",
    sourceRef: deckStoragePath(courseId, slug)
  });
  return { id, slug };
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
            ? question.topic_tags.map((tag) => String(tag))
            : [],
          points: 1,
          status: "active",
          // Never "generated" or "imported" — "authored" is accurate (the
          // platform made no model call) and is the column's own default;
          // "imported" is not in the check constraint and would fail.
          source: "authored",
          updated_at: new Date().toISOString()
          // Checkpoint columns (segment_key, source_slide_start/end,
          // checkpoint_after_slide) are intentionally left unset — they stay
          // at their schema defaults, the honest state for content with no
          // checkpoint bridge. covers_up_to_slide from the payload is not a
          // real column and is accepted-but-ignored for the same reason.
        },
        { onConflict: "question_bank_id,generation_key" }
      )
      .select("id")
      .maybeSingle();
    if (saveError) throw saveError;

    // Options are replaced wholesale: they are meaningless apart from their stem.
    const { error: deleteError } = await db
      .from("question_options")
      .delete()
      .eq("question_id", saved!.id);
    if (deleteError) throw deleteError;

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
  }

  return bankId;
}

/** Upload the validated deck HTML and resolve/create its content item.
 *  Only called once validateDeckHtml has returned zero problems. */
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

  const { id: contentItemId, slug: finalSlug } = await resolveDeckContentItem(
    db, courseId, actorProfileId, requestedSlug, title
  );

  const path = deckStoragePath(courseId, finalSlug);
  const { error: uploadError } = await db.storage.from(CONTENT_BUCKET).upload(
    path,
    new Blob([html], { type: "text/html; charset=utf-8" }),
    { contentType: "text/html; charset=utf-8", upsert: true }
  );
  if (uploadError) throw uploadError;

  return contentItemId;
}
