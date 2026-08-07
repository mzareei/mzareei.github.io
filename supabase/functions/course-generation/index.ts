// Orchestrates the AI PDF-to-deck-and-question-bank pipeline. This function
// never calls the Claude API itself — it only manages the generation_jobs
// queue that course-generation-worker advances one resumable step at a time.
// Nothing this function does makes content visible to students: approve()
// creates the content_item + question_bank in draft/inactive states and a
// content_release row in 'draft' state, exactly like every other release —
// a human still has to promote it through the normal release flow.
//
// Actions (instructor/platform_owner only, all course-scoped):
//   create_job          { upload_id, lecture_title, lecture_slug? } -> { job }
//   status               { job_id } -> { job }
//   list_jobs            {} -> { jobs }
//   cancel                { job_id } -> { job }
//   review_bundle         { job_id } -> { job, deck_html, questions }
//   approve               { job_id } -> { job, content_item, question_bank }
//   regenerate_questions  { job_id } -> { job }  (resets just the question step)
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
import { mintContentToken } from "../_shared/content-token.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const bucket = "course-content";
const cancellableStates = ["queued", "extracting", "outlining", "generating_deck", "generating_questions", "assembling"];

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const db = adminClient();
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const profile = await requireInstructor(db, token, courseId);

    switch (body.action) {
      case "create_job":
        return json(await createJob(db, courseId, String(profile.id), body));
      case "advance":
        return json(await advanceJob(db, courseId, body));
      case "status":
        return json({ job: await loadJob(db, courseId, body.job_id) });
      case "list_jobs":
        return json(await listJobs(db, courseId));
      case "cancel":
        return json(await cancelJob(db, courseId, body));
      case "review_bundle":
        return json(await reviewBundle(db, courseId, body));
      case "preview_url":
        return json(await previewUrl(db, courseId, body));
      case "approve":
        return json(await approveJob(db, courseId, String(profile.id), body));
      case "regenerate_questions":
        return json(await regenerateQuestions(db, courseId, body));
      default:
        return json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const message = error?.message || "Unable to manage generation jobs.";
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

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

async function requireInstructor(db: Db, token: string, courseId: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  await assertCourseEmailAllowed(db, userData.user.email || "");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("No active course profile is linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active");
  if (membershipError) throw membershipError;
  const isInstructor = (memberships || []).some((m) => instructorRoles.includes(String(m.role)));
  if (!isInstructor) throw new Error("Managing generation jobs is not allowed for this role.");
  return profile;
}

/** A slug free in this course. Used when the requested one is taken by another
 *  owner's item — the caller must never be told that item exists. */
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

async function createJob(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const uploadId = String(body.upload_id || "").trim();
  if (!uploadId) throw new Error("An upload id is required.");
  const lectureTitle = String(body.lecture_title || "").trim().slice(0, 180);
  if (lectureTitle.length < 2) throw new Error("A lecture title is required.");
  let lectureSlug = cleanSlug(body.lecture_slug || lectureTitle);
  if (lectureSlug.length < 2) throw new Error("A valid lecture slug is required.");

  const { data: upload, error: uploadError } = await db
    .from("content_uploads")
    .select("id, course_id, status")
    .eq("id", uploadId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (uploadError) throw uploadError;
  if (!upload) throw new Error("That upload was not found.");
  if (upload.status !== "uploaded") throw new Error("Confirm the PDF upload before starting generation.");

  // A slug clash means different things depending on who owns the clashing
  // item. Your own duplicate title is advice you can act on, so refuse by name.
  // Someone else's is content you are not allowed to see: naming it leaks its
  // existence and blocks a title you have every right to use. Resolve instead.
  const { data: clash, error: clashError } = await db
    .from("content_items")
    .select("id, owner_profile_id")
    .eq("course_id", courseId)
    .eq("slug", lectureSlug)
    .maybeSingle();
  if (clashError) throw clashError;
  if (clash) {
    const yours = clash.owner_profile_id == null
      || String(clash.owner_profile_id) === String(actorProfileId);
    if (yours) {
      throw new Error(`A content item with slug "${lectureSlug}" already exists — choose a different one.`);
    }
    lectureSlug = await availableSlug(db, courseId, lectureSlug);
  }

  const { data: job, error } = await db
    .from("generation_jobs")
    .insert({
      course_id: courseId,
      content_upload_id: uploadId,
      status: "queued",
      lecture_title: lectureTitle,
      lecture_slug: lectureSlug,
      created_by: actorProfileId
    })
    .select("*")
    .single();
  if (error) throw error;

  await db.from("content_uploads").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", uploadId);
  await invokeWorker(String(job.id));
  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "generation_job",
    target_id: job.id,
    action: "generation_job_created",
    metadata: { lecture_slug: lectureSlug, upload_id: uploadId }
  });

  return { job };
}

/** The worker self-chains, but a run can still stall on a cold start or a
 *  transient API error. The Content screen calls this while a job is in flight
 *  so a stalled job resumes instead of sitting there looking alive. */
async function advanceJob(db: Db, courseId: string, body: Record<string, unknown>) {
  const job = await loadJob(db, courseId, body.job_id);
  if (["ready_for_review", "approved", "failed"].includes(String(job.status))) {
    return { job, advanced: false };
  }
  await invokeWorker(String(job.id));
  return { job, advanced: true };
}

async function invokeWorker(jobId: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/course-generation-worker`;
  const secret = Deno.env.get("GENERATION_WORKER_SECRET") || "";
  // Fire-and-forget: a generation step takes far longer than this request should.
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job_id: jobId, secret })
  }).catch(() => {});
}

async function loadJob(db: Db, courseId: string, jobIdRaw: unknown) {
  const jobId = String(jobIdRaw || "").trim();
  if (!jobId) throw new Error("A job id is required.");
  const { data, error } = await db
    .from("generation_jobs")
    .select("id, course_id, content_upload_id, status, lecture_title, lecture_slug, content_item_id, question_bank_id, error, attempt_count, created_at, updated_at")
    .eq("id", jobId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That generation job was not found.");
  return data;
}

async function listJobs(db: Db, courseId: string) {
  const { data, error } = await db
    .from("generation_jobs")
    .select("id, status, lecture_title, lecture_slug, content_item_id, error, created_at, updated_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return { jobs: data || [] };
}

async function cancelJob(db: Db, courseId: string, body: Record<string, unknown>) {
  const job = await loadJob(db, courseId, body.job_id);
  if (!cancellableStates.includes(String(job.status))) {
    throw new Error(`A job in status "${job.status}" can no longer be cancelled.`);
  }
  const { data, error } = await db
    .from("generation_jobs")
    .update({ status: "failed", error: "Cancelled by instructor.", updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .select("id, status, error")
    .single();
  if (error) throw error;
  return { job: data };
}

async function reviewBundle(db: Db, courseId: string, body: Record<string, unknown>) {
  const job = await loadJob(db, courseId, body.job_id);
  if (job.status !== "ready_for_review" && job.status !== "approved") {
    throw new Error(`This job is not ready for review yet (status: ${job.status}).`);
  }

  const stepState = (job as Record<string, unknown>).step_state as Record<string, unknown> | undefined;
  let deckHtml: string | null = null;
  const deckPath = job.content_item_id ? null : (stepState?.deck_storage_path as string | undefined);
  if (deckPath) {
    const { data: blob, error: downloadError } = await db.storage.from(bucket).download(deckPath);
    if (downloadError) throw downloadError;
    deckHtml = await blob.text();
  } else if (job.content_item_id) {
    const { data: item, error: itemError } = await db
      .from("content_items").select("source_ref").eq("id", job.content_item_id).maybeSingle();
    if (itemError) throw itemError;
    if (item) {
      const { data: blob, error: downloadError } = await db.storage.from(bucket).download(item.source_ref);
      if (downloadError) throw downloadError;
      deckHtml = await blob.text();
    }
  }

  let questions: Record<string, unknown>[] = [];
  if (job.question_bank_id) {
    const { data, error } = await db
      .from("questions")
      .select("id, prompt, prompt_es, difficulty, status, segment_key, source_slide_numbers, source_slide_start, source_slide_end, checkpoint_after_slide, question_options(id, option_text, option_text_es, is_correct, position)")
      .eq("question_bank_id", job.question_bank_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    questions = data || [];
  }

  return { job, deck_html: deckHtml, questions };
}

/** A same-origin URL for previewing a generated deck before it is approved.
 *  Reuses the gated delivery chain (HMAC token -> course-content-serve ->
 *  the /content Pages Function) rather than dropping the HTML into a srcdoc
 *  iframe: srcdoc inherits the app's own CSP, which blocks the deck engine's
 *  inline script, so the deck renders but is frozen on slide one. This path
 *  gets the relaxed CSP /content is scoped to. Instructor-only, and the token
 *  expires quickly. */
async function previewUrl(db: Db, courseId: string, body: Record<string, unknown>) {
  const job = await loadJob(db, courseId, body.job_id);
  const stepState = (job as Record<string, unknown>).step_state as Record<string, unknown> | undefined;
  let path = String(stepState?.deck_storage_path || "");
  if (!path && job.content_item_id) {
    const { data: item, error } = await db
      .from("content_items").select("source_ref").eq("id", job.content_item_id).maybeSingle();
    if (error) throw error;
    path = String(item?.source_ref || "");
  }
  if (!path) throw new Error("This job has no generated deck yet.");
  const token = await mintContentToken(path, 600);
  return { token, expires_in: 600 };
}

async function approveJob(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const job = await loadJob(db, courseId, body.job_id);
  if (job.status !== "ready_for_review") {
    throw new Error(`Only a job that is ready for review can be approved (status: ${job.status}).`);
  }
  if (!job.content_item_id || !job.question_bank_id) {
    throw new Error("This job has no generated content item or question bank to approve.");
  }

  // Flip everything from draft to its normal "exists but not released" resting
  // state. A content_release starts in 'draft' — the instructor still has to
  // release it explicitly, same as content added any other way.
  const { error: itemError } = await db
    .from("content_items").update({ updated_at: new Date().toISOString() }).eq("id", job.content_item_id);
  if (itemError) throw itemError;

  const { error: bankError } = await db
    .from("question_banks").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", job.question_bank_id);
  if (bankError) throw bankError;

  const { error: questionsError } = await db
    .from("questions").update({ status: "active", updated_at: new Date().toISOString() }).eq("question_bank_id", job.question_bank_id);
  if (questionsError) throw questionsError;

  const { data: section, error: sectionError } = await db
    .from("course_sections").select("id").eq("course_id", courseId).limit(1).maybeSingle();
  if (sectionError) throw sectionError;

  const { data: existingRelease, error: releaseCheckError } = await db
    .from("content_releases").select("id").eq("content_item_id", job.content_item_id).maybeSingle();
  if (releaseCheckError) throw releaseCheckError;
  if (!existingRelease) {
    const { error: releaseError } = await db.from("content_releases").insert({
      content_item_id: job.content_item_id,
      course_id: courseId,
      section_id: section?.id || null,
      state: "draft",
      created_by: actorProfileId,
      updated_by: actorProfileId
    });
    if (releaseError) throw releaseError;
  }

  const { data: updated, error } = await db
    .from("generation_jobs")
    // Clear `error` too: a step that failed validation and then succeeded on
    // retry leaves its message behind, and it reads as a failure on a job the
    // instructor just approved.
    .update({ status: "approved", error: null, updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .select("*")
    .single();
  if (error) throw error;

  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "generation_job",
    target_id: job.id,
    action: "generation_job_approved",
    metadata: { content_item_id: job.content_item_id, question_bank_id: job.question_bank_id }
  });

  return { job: updated };
}

async function regenerateQuestions(db: Db, courseId: string, body: Record<string, unknown>) {
  const job = await loadJob(db, courseId, body.job_id);
  if (!["ready_for_review", "failed"].includes(String(job.status))) {
    throw new Error(`Questions can only be regenerated once the deck step has finished (status: ${job.status}).`);
  }
  if (job.question_bank_id) {
    const { error: deleteError } = await db.from("questions").delete().eq("question_bank_id", job.question_bank_id);
    if (deleteError) throw deleteError;
  }
  const { data: updated, error } = await db
    .from("generation_jobs")
    .update({ status: "generating_questions", error: null, updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .select("*")
    .single();
  if (error) throw error;
  return { job: updated };
}
