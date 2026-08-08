import { adminClient } from "../_shared/client.ts";
import { assertMutableCheckpoint, validateCheckpointDraft } from "../_shared/class-question-plan.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

type Permissions = {
  isGlobalOwner: boolean;
  permittedSectionIds: string[];
};

type PlanRecord = {
  id: string;
  class_session_id: string;
  question_bank_id: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type CheckpointContext = {
  id: string;
  plan_id: string;
  position: number;
  topic: string;
  slide_hint: number | null;
  notes: string | null;
  state: string;
  sentRoundCount: number;
};

const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
const editableSessionStates = ["planned", "live"];
const knownPlanCodes = new Set([
  "class_question_plan_action_invalid",
  "class_question_plan_bank_mismatch",
  "class_question_plan_checkpoint_id_invalid",
  "class_question_plan_checkpoint_not_found",
  "class_question_plan_checkpoint_locked",
  "class_question_plan_exists",
  "class_question_plan_failed",
  "class_question_plan_not_found",
  "class_question_plan_plan_id_invalid",
  "class_question_plan_question_bank_id_invalid",
  "class_question_plan_question_bank_not_active",
  "class_question_plan_question_ids_duplicate",
  "class_question_plan_question_ids_invalid",
  "class_question_plan_question_not_in_bank",
  "class_question_plan_session_id_invalid",
  "class_question_plan_session_not_found",
  "class_question_plan_session_state_invalid",
  "class_question_plan_slide_hint_invalid",
  "class_question_plan_source_plan_id_invalid",
  "class_question_plan_source_plan_not_found",
  "class_question_plan_topic_required"
]);

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
    const { profile, permissions } = await requireTeacher(db, token, courseId);

    switch (String(body.action || "")) {
      case "get":
        return json({ plan: await getPlan(db, courseId, permissions, body) });
      case "create":
        return json({ plan: await createPlan(db, courseId, String(profile.id), permissions, body) });
      case "copy":
        return json({ plan: await copyPlan(db, courseId, String(profile.id), permissions, body) });
      case "add_checkpoint":
        return json({ plan: await addCheckpoint(db, courseId, String(profile.id), permissions, body) });
      case "update_checkpoint":
        return json({ plan: await updateCheckpoint(db, courseId, String(profile.id), permissions, body) });
      case "remove_checkpoint":
        return json({ plan: await removeCheckpoint(db, courseId, String(profile.id), permissions, body) });
      case "set_candidates":
        return json({ plan: await setCandidates(db, courseId, String(profile.id), permissions, body) });
      case "mark_skipped":
        return json({ plan: await markSkipped(db, courseId, String(profile.id), permissions, body) });
      default:
        throw new Error("class_question_plan_action_invalid");
    }
  } catch (error) {
    const message = safeErrorMessage(error, "class_question_plan_failed");
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    if (knownPlanCodes.has(message)) return json({ error: message, error_code: message }, { status: 400 });
    return json({ error: "class_question_plan_failed", error_code: "class_question_plan_failed" }, { status: 400 });
  }
});

function safeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown };
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
  }
  return fallback;
}

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function cleanUuid(value: unknown, code: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(code);
  }
  return text;
}

function cleanQuestionIds(value: unknown) {
  if (!Array.isArray(value)) throw new Error("class_question_plan_question_ids_invalid");
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    const id = cleanUuid(entry, "class_question_plan_question_ids_invalid");
    if (seen.has(id)) throw new Error("class_question_plan_question_ids_duplicate");
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

async function requireTeacher(db: Db, token: string, courseId: string) {
  const profile = await loadProfileForToken(db, token);
  const roles = await loadRoles(db, courseId, String(profile.id));
  if (!roles.some((role) => teacherRoles.includes(role))) {
    throw new Error("You are not allowed to manage question plans for this course.");
  }
  const isGlobalOwner = roles.includes("platform_owner");
  const permittedSectionIds = isGlobalOwner ? [] : await loadPermittedSectionIds(db, String(profile.id), courseId);
  if (!isGlobalOwner && !permittedSectionIds.length) {
    throw new Error("You are not allowed to manage question plans for this course.");
  }
  return { profile, permissions: { isGlobalOwner, permittedSectionIds } };
}

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  await assertCourseEmailAllowed(db, userData.user.email || "");

  const { data: profile, error } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, preferred_name, status")
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

async function loadPermittedSectionIds(db: Db, profileId: string, courseId: string) {
  const { data, error } = await db
    .from("section_enrollments")
    .select("section_id, course_sections!inner(course_id)")
    .eq("profile_id", profileId)
    .in("role", ["instructor", "teaching_assistant"])
    .eq("status", "active")
    .eq("course_sections.course_id", courseId);
  if (error) throw error;
  return Array.from(new Set((data || []).map((row) => String(row.section_id))));
}

function assertSectionAllowed(permissions: Permissions, sectionId: string) {
  if (permissions.isGlobalOwner || permissions.permittedSectionIds.includes(String(sectionId))) return;
  throw new Error("You are not allowed to manage this class section.");
}

function assertEditableSessionState(state: unknown) {
  if (editableSessionStates.includes(String(state || ""))) return;
  throw new Error("class_question_plan_session_state_invalid");
}

async function loadSession(db: Db, courseId: string, sessionId: string) {
  const { data, error } = await db
    .from("class_sessions")
    .select("id, course_id, section_id, state, title, planned_date, content_item_id")
    .eq("id", sessionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("class_question_plan_session_not_found");
  return data;
}

async function loadPlanBySessionId(db: Db, sessionId: string) {
  const { data, error } = await db
    .from("class_question_plans")
    .select("id, class_session_id, question_bank_id, updated_by, created_at, updated_at")
    .eq("class_session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as PlanRecord | null;
}

async function loadPlanById(db: Db, planId: string) {
  const { data, error } = await db
    .from("class_question_plans")
    .select("id, class_session_id, question_bank_id, updated_by, created_at, updated_at")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("class_question_plan_not_found");
  return data as PlanRecord;
}

async function loadActiveQuestionBank(db: Db, courseId: string, questionBankId: string) {
  const { data, error } = await db
    .from("question_banks")
    .select("id, course_id, status, content_item_id")
    .eq("id", questionBankId)
    .eq("course_id", courseId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("class_question_plan_question_bank_not_active");
  return data;
}

async function loadAccessiblePlanById(db: Db, courseId: string, permissions: Permissions, planId: string) {
  const plan = await loadPlanById(db, planId);
  const session = await loadSession(db, courseId, String(plan.class_session_id));
  assertSectionAllowed(permissions, String(session.section_id));
  return { plan, session };
}

async function loadAccessibleCheckpoint(
  db: Db,
  courseId: string,
  permissions: Permissions,
  checkpointId: string
) {
  const { data, error } = await db
    .from("class_question_plan_checkpoints")
    .select("id, plan_id, position, topic, slide_hint, notes, state")
    .eq("id", checkpointId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("class_question_plan_checkpoint_not_found");

  const { plan, session } = await loadAccessiblePlanById(db, courseId, permissions, String(data.plan_id));
  return {
    plan,
    session,
    checkpoint: {
      ...data,
      sentRoundCount: String(data.state || "") === "sent" ? 1 : 0
    } as CheckpointContext
  };
}

async function serializePlan(db: Db, plan: PlanRecord) {
  const { data: checkpoints, error: checkpointError } = await db
    .from("class_question_plan_checkpoints")
    .select("id, plan_id, position, topic, slide_hint, notes, state, updated_by, created_at, updated_at")
    .eq("plan_id", plan.id)
    .order("position", { ascending: true });
  if (checkpointError) throw checkpointError;

  const checkpointRows = checkpoints || [];
  const checkpointIds = checkpointRows.map((row) => String(row.id));
  const { data: candidateRows, error: candidateError } = checkpointIds.length
    ? await db
        .from("class_question_plan_candidates")
        .select("checkpoint_id, question_id")
        .in("checkpoint_id", checkpointIds)
    : { data: [], error: null };
  if (candidateError) throw candidateError;

  const questionIds = Array.from(new Set((candidateRows || []).map((row) => String(row.question_id))));
  const { data: questions, error: questionError } = questionIds.length
    ? await db
        .from("questions")
        .select("id, created_at")
        .in("id", questionIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (questionError) throw questionError;

  const questionOrder = new Map((questions || []).map((row, index) => [String(row.id), index]));
  const candidateByCheckpoint = new Map<string, string[]>();

  for (const checkpointId of checkpointIds) {
    const ordered = (candidateRows || [])
      .filter((row) => String(row.checkpoint_id) === checkpointId)
      .map((row) => String(row.question_id))
      .sort((left, right) => {
        const leftIndex = questionOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = questionOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
        return left.localeCompare(right);
      });
    candidateByCheckpoint.set(checkpointId, ordered);
  }

  return {
    id: plan.id,
    class_session_id: plan.class_session_id,
    question_bank_id: plan.question_bank_id,
    updated_by: plan.updated_by,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    checkpoints: checkpointRows.map((checkpoint) => ({
      id: checkpoint.id,
      position: checkpoint.position,
      topic: checkpoint.topic,
      slide_hint: checkpoint.slide_hint,
      notes: checkpoint.notes,
      state: checkpoint.state,
      candidate_question_ids: candidateByCheckpoint.get(String(checkpoint.id)) || [],
      updated_by: checkpoint.updated_by,
      created_at: checkpoint.created_at,
      updated_at: checkpoint.updated_at
    }))
  };
}

async function getPlan(db: Db, courseId: string, permissions: Permissions, body: Record<string, unknown>) {
  const sessionId = cleanUuid(body.class_session_id, "class_question_plan_session_id_invalid");
  const session = await loadSession(db, courseId, sessionId);
  assertSectionAllowed(permissions, String(session.section_id));
  const plan = await loadPlanBySessionId(db, sessionId);
  return plan ? await serializePlan(db, plan) : null;
}

async function createPlan(
  db: Db,
  courseId: string,
  actorProfileId: string,
  permissions: Permissions,
  body: Record<string, unknown>
) {
  const sessionId = cleanUuid(body.class_session_id, "class_question_plan_session_id_invalid");
  const questionBankId = cleanUuid(body.question_bank_id, "class_question_plan_question_bank_id_invalid");
  const session = await loadSession(db, courseId, sessionId);
  assertSectionAllowed(permissions, String(session.section_id));
  assertEditableSessionState(session.state);
  await loadActiveQuestionBank(db, courseId, questionBankId);

  const existing = await loadPlanBySessionId(db, sessionId);
  if (existing) throw new Error("class_question_plan_exists");

  const { data: created, error } = await db
    .from("class_question_plans")
    .insert({
      class_session_id: sessionId,
      question_bank_id: questionBankId,
      updated_by: actorProfileId
    })
    .select("id, class_session_id, question_bank_id, updated_by, created_at, updated_at")
    .single();
  if (error) {
    if (String(error.code) === "23505") throw new Error("class_question_plan_exists");
    throw error;
  }
  return await serializePlan(db, created as PlanRecord);
}

async function copyPlan(
  db: Db,
  courseId: string,
  actorProfileId: string,
  permissions: Permissions,
  body: Record<string, unknown>
) {
  const sourcePlanId = cleanUuid(body.source_plan_id, "class_question_plan_source_plan_id_invalid");
  const targetSessionId = cleanUuid(body.class_session_id, "class_question_plan_session_id_invalid");
  const { plan: sourcePlan } = await loadAccessiblePlanById(db, courseId, permissions, sourcePlanId);
  const sourceBankId = String(sourcePlan.question_bank_id || "");
  if (!sourceBankId) throw new Error("class_question_plan_question_bank_not_active");
  await loadActiveQuestionBank(db, courseId, sourceBankId);

  const targetSession = await loadSession(db, courseId, targetSessionId);
  assertSectionAllowed(permissions, String(targetSession.section_id));
  assertEditableSessionState(targetSession.state);

  const existing = await loadPlanBySessionId(db, targetSessionId);
  if (existing) throw new Error("class_question_plan_exists");

  const { data: sourceCheckpoints, error: sourceCheckpointError } = await db
    .from("class_question_plan_checkpoints")
    .select("id, position, topic, slide_hint, notes, state")
    .eq("plan_id", sourcePlan.id)
    .eq("state", "planned")
    .order("position", { ascending: true });
  if (sourceCheckpointError) throw sourceCheckpointError;

  const { data: createdPlan, error: createPlanError } = await db
    .from("class_question_plans")
    .insert({
      class_session_id: targetSessionId,
      question_bank_id: sourceBankId,
      updated_by: actorProfileId
    })
    .select("id, class_session_id, question_bank_id, updated_by, created_at, updated_at")
    .single();
  if (createPlanError) {
    if (String(createPlanError.code) === "23505") throw new Error("class_question_plan_exists");
    throw createPlanError;
  }

  const plannedSourceRows = sourceCheckpoints || [];
  if (plannedSourceRows.length) {
    const { data: createdCheckpoints, error: createCheckpointError } = await db
      .from("class_question_plan_checkpoints")
      .insert(
        plannedSourceRows.map((checkpoint, index) => ({
          plan_id: createdPlan.id,
          position: index + 1,
          topic: checkpoint.topic,
          slide_hint: checkpoint.slide_hint,
          notes: checkpoint.notes,
          state: "planned",
          updated_by: actorProfileId
        }))
      )
      .select("id, position");
    if (createCheckpointError) throw createCheckpointError;

    const checkpointIdByPosition = new Map(
      (createdCheckpoints || []).map((row) => [Number(row.position), String(row.id)])
    );
    const sourceCheckpointIds = plannedSourceRows.map((checkpoint) => String(checkpoint.id));
    const { data: sourceCandidates, error: sourceCandidateError } = sourceCheckpointIds.length
      ? await db
          .from("class_question_plan_candidates")
          .select("checkpoint_id, question_id")
          .in("checkpoint_id", sourceCheckpointIds)
      : { data: [], error: null };
    if (sourceCandidateError) throw sourceCandidateError;

    const copiedCandidates = (sourceCandidates || []).flatMap((candidate) => {
      const sourceIndex = plannedSourceRows.findIndex((row) => String(row.id) === String(candidate.checkpoint_id));
      const targetCheckpointId = checkpointIdByPosition.get(sourceIndex + 1);
      if (!targetCheckpointId) return [];
      return [{
        checkpoint_id: targetCheckpointId,
        question_bank_id: sourceBankId,
        question_id: candidate.question_id,
        updated_by: actorProfileId
      }];
    });

    if (copiedCandidates.length) {
      const { error: insertCandidateError } = await db
        .from("class_question_plan_candidates")
        .insert(copiedCandidates);
      if (insertCandidateError) throw insertCandidateError;
    }
  }

  return await serializePlan(db, createdPlan as PlanRecord);
}

async function addCheckpoint(
  db: Db,
  courseId: string,
  actorProfileId: string,
  permissions: Permissions,
  body: Record<string, unknown>
) {
  const planId = cleanUuid(body.plan_id, "class_question_plan_plan_id_invalid");
  const { plan, session } = await loadAccessiblePlanById(db, courseId, permissions, planId);
  assertEditableSessionState(session.state);
  const draft = validateCheckpointDraft(body);

  const { data: last, error: lastError } = await db
    .from("class_question_plan_checkpoints")
    .select("position")
    .eq("plan_id", plan.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;

  const { error } = await db
    .from("class_question_plan_checkpoints")
    .insert({
      plan_id: plan.id,
      position: Number(last?.position || 0) + 1,
      topic: draft.topic,
      slide_hint: draft.slideHint,
      notes: draft.notes,
      updated_by: actorProfileId
    });
  if (error) throw error;

  await touchPlan(db, plan.id, actorProfileId);
  return await serializePlan(db, plan);
}

async function updateCheckpoint(
  db: Db,
  courseId: string,
  actorProfileId: string,
  permissions: Permissions,
  body: Record<string, unknown>
) {
  const checkpointId = cleanUuid(body.checkpoint_id, "class_question_plan_checkpoint_id_invalid");
  const { plan, session, checkpoint } = await loadAccessibleCheckpoint(db, courseId, permissions, checkpointId);
  assertEditableSessionState(session.state);
  assertMutableCheckpoint(checkpoint.state, checkpoint.sentRoundCount);
  const draft = validateCheckpointDraft(body);

  const { error } = await db
    .from("class_question_plan_checkpoints")
    .update({
      topic: draft.topic,
      slide_hint: draft.slideHint,
      notes: draft.notes,
      updated_by: actorProfileId,
      updated_at: new Date().toISOString()
    })
    .eq("id", checkpoint.id);
  if (error) throw error;

  await touchPlan(db, plan.id, actorProfileId);
  return await serializePlan(db, plan);
}

async function removeCheckpoint(
  db: Db,
  courseId: string,
  actorProfileId: string,
  permissions: Permissions,
  body: Record<string, unknown>
) {
  const checkpointId = cleanUuid(body.checkpoint_id, "class_question_plan_checkpoint_id_invalid");
  const { plan, session, checkpoint } = await loadAccessibleCheckpoint(db, courseId, permissions, checkpointId);
  assertEditableSessionState(session.state);
  assertMutableCheckpoint(checkpoint.state, checkpoint.sentRoundCount);

  const { error } = await db
    .from("class_question_plan_checkpoints")
    .delete()
    .eq("id", checkpoint.id);
  if (error) throw error;

  await resequenceCheckpoints(db, plan.id, actorProfileId);
  await touchPlan(db, plan.id, actorProfileId);
  return await serializePlan(db, plan);
}

async function setCandidates(
  db: Db,
  courseId: string,
  actorProfileId: string,
  permissions: Permissions,
  body: Record<string, unknown>
) {
  const checkpointId = cleanUuid(body.checkpoint_id, "class_question_plan_checkpoint_id_invalid");
  const questionIds = cleanQuestionIds(body.question_ids);
  const { plan, session, checkpoint } = await loadAccessibleCheckpoint(db, courseId, permissions, checkpointId);
  assertEditableSessionState(session.state);
  assertMutableCheckpoint(checkpoint.state, checkpoint.sentRoundCount);
  await loadActiveQuestionBank(db, courseId, cleanUuid(plan.question_bank_id, "class_question_plan_question_bank_not_active"));

  const planQuestionIds = await loadPlanQuestionIds(db, plan, questionIds);
  if (planQuestionIds.length !== questionIds.length) {
    throw new Error("class_question_plan_question_not_in_bank");
  }

  const { error: deleteError } = await db
    .from("class_question_plan_candidates")
    .delete()
    .eq("checkpoint_id", checkpoint.id);
  if (deleteError) throw deleteError;

  if (questionIds.length) {
    const { error: insertError } = await db
      .from("class_question_plan_candidates")
      .insert(questionIds.map((questionId) => ({
        checkpoint_id: checkpoint.id,
        question_bank_id: plan.question_bank_id,
        question_id: questionId,
        updated_by: actorProfileId
      })));
    if (insertError) throw insertError;
  }

  await touchPlan(db, plan.id, actorProfileId);
  return await serializePlan(db, plan);
}

async function markSkipped(
  db: Db,
  courseId: string,
  actorProfileId: string,
  permissions: Permissions,
  body: Record<string, unknown>
) {
  const checkpointId = cleanUuid(body.checkpoint_id, "class_question_plan_checkpoint_id_invalid");
  const { plan, session, checkpoint } = await loadAccessibleCheckpoint(db, courseId, permissions, checkpointId);
  assertEditableSessionState(session.state);
  assertMutableCheckpoint(checkpoint.state, checkpoint.sentRoundCount);

  const { error } = await db
    .from("class_question_plan_checkpoints")
    .update({
      state: "skipped",
      updated_by: actorProfileId,
      updated_at: new Date().toISOString()
    })
    .eq("id", checkpoint.id);
  if (error) throw error;

  await touchPlan(db, plan.id, actorProfileId);
  return await serializePlan(db, plan);
}

async function resequenceCheckpoints(db: Db, planId: string, actorProfileId: string) {
  const { data: rows, error } = await db
    .from("class_question_plan_checkpoints")
    .select("id, position")
    .eq("plan_id", planId)
    .order("position", { ascending: true });
  if (error) throw error;

  for (const [index, row] of (rows || []).entries()) {
    const nextPosition = index + 1;
    if (Number(row.position) === nextPosition) continue;
    const { error: updateError } = await db
      .from("class_question_plan_checkpoints")
      .update({
        position: nextPosition,
        updated_by: actorProfileId,
        updated_at: new Date().toISOString()
      })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }
}

async function loadPlanQuestionIds(db: Db, plan: PlanRecord, questionIds: string[]) {
  if (!plan.question_bank_id) throw new Error("class_question_plan_question_bank_not_active");
  if (!questionIds.length) return [];
  const { data: questions, error } = await db
    .from("questions")
    .select("id, question_bank_id")
    .eq("question_bank_id", plan.question_bank_id)
    .eq("status", "active")
    .in("id", questionIds);
  if (error) throw error;
  return (questions || [])
    .filter((question) => String(question.question_bank_id) === String(plan.question_bank_id))
    .map((question) => String(question.id));
}

async function touchPlan(db: Db, planId: string, actorProfileId: string) {
  const { error } = await db
    .from("class_question_plans")
    .update({
      updated_by: actorProfileId,
      updated_at: new Date().toISOString()
    })
    .eq("id", planId);
  if (error) throw error;
}
