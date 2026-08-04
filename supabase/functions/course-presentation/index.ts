import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
import { deckCheckpointsFromQuestions } from "../_shared/checkpoint-deck.ts";
import { controllerView, projectorView } from "../_shared/presentation-view.mjs";
import {
  actionKind,
  authorizePresentationRequest,
  presentationErrorResponse
} from "../_shared/presentation-policy.mjs";

type Db = ReturnType<typeof adminClient>;
type Row = Record<string, unknown>;
type PresentationPhase = "lecture" | "pulse" | "quiz" | "podium" | "reflection" | "closed";

const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
const phases: PresentationPhase[] = ["lecture", "pulse", "quiz", "podium", "reflection", "closed"];

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });
    const body = await request.json().catch(() => ({})) as Row;
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const sessionId = cleanUuid(body.class_session_id, "class session id");
    const db = adminClient();
    const action = String(body.action || "");
    if (actionKind(action) === "unknown") {
      return json({ error: "Unknown action." }, { status: 400 });
    }
    const actor = await authorizeTeacher(db, token, courseId, sessionId, action);

    if (action === "request_slide" || action === "set_phase") {
      const expectedRevision = nonNegativeInteger(body.revision, "revision");
      const requestedSlide = action === "request_slide"
        ? positiveInteger(body.requested_slide, "requested slide")
        : null;
      const phase = action === "set_phase" ? cleanPhase(body.phase) : null;
      const { data, error } = await db.rpc("course_presentation_control", {
        p_class_session_id: sessionId,
        p_expected_revision: expectedRevision,
        p_requested_slide: requestedSlide,
        p_phase: phase
      });
      if (error) throw error;
      const input = {
        session_id: sessionId,
        state: data,
        pulse: await loadPulse(db, courseId, sessionId, actor.sectionId)
      };
      return json(String(body.surface || "") === "projector"
        ? projectorView(input)
        : controllerView(input));
    }

    if (action === "acknowledge_slide" || action === "checkpoint_reached" || action === "heartbeat") {
      const revision = nonNegativeInteger(body.revision, "revision");
      const surface = action === "heartbeat" && String(body.surface || "") === "controller"
        ? "controller"
        : "projector";
      // Surface only chooses which last-seen timestamp moves. Both fields are
      // non-sensitive telemetry, and the authenticated section teacher cannot
      // use either branch to change revision, slide, phase, or checkpoint data.
      const acknowledgedSlide = action === "acknowledge_slide"
        ? positiveInteger(body.acknowledged_slide, "acknowledged slide")
        : null;
      const checkpointKey = action === "checkpoint_reached"
        ? cleanCheckpointKey(body.checkpoint_key)
        : null;
      const checkpointAfterSlide = action === "checkpoint_reached"
        ? positiveInteger(body.checkpoint_after_slide, "checkpoint slide")
        : null;
      if (action === "checkpoint_reached") {
        const state = await loadState(db, sessionId);
        const authored = await authoredCheckpointExists(db, {
          courseId,
          contentItemId: actor.contentItemId,
          checkpointKey: checkpointKey!,
          checkpointAfterSlide: checkpointAfterSlide!
        });
        const decision = authorizePresentationRequest({
          action,
          roles: actor.roles,
          assignments: actor.assignments,
          sectionId: actor.sectionId,
          checkpoint: {
            reportedRevision: revision,
            currentRevision: Number(state.revision),
            requestedSlide: Number(state.requested_slide),
            acknowledgedSlide: Number(state.acknowledged_slide),
            checkpointKey,
            checkpointAfterSlide,
            authored
          }
        });
        if (!decision.allowed || decision.checkpoint === "reject") {
          throw new Error("That checkpoint does not match the current authored lecture boundary.");
        }
      }
      const { data, error } = await db.rpc("course_presentation_telemetry", {
        p_class_session_id: sessionId,
        p_revision: revision,
        p_acknowledged_slide: acknowledgedSlide,
        p_checkpoint_key: checkpointKey,
        p_checkpoint_after_slide: checkpointAfterSlide,
        p_surface: surface
      });
      if (error) throw error;
      const input = {
        session_id: sessionId,
        state: data,
        pulse: await loadPulse(db, courseId, sessionId, actor.sectionId)
      };
      return json(surface === "controller" ? controllerView(input) : projectorView(input));
    }

    if (action === "controller_current" || action === "projector_current") {
      const state = await loadState(db, sessionId);
      const input = {
        session_id: sessionId,
        state,
        pulse: await loadPulse(db, courseId, sessionId, actor.sectionId)
      };
      return json(action === "controller_current" ? controllerView(input) : projectorView(input));
    }

    return json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to synchronize the presentation.";
    const response = presentationErrorResponse(message);
    return json({ error: response.message }, { status: response.status });
  }
});

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function cleanUuid(value: unknown, label: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`A valid ${label} is required.`);
  }
  return text;
}

function nonNegativeInteger(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`A valid ${label} is required.`);
  return number;
}

function positiveInteger(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`A valid ${label} is required.`);
  return number;
}

function cleanPhase(value: unknown) {
  const phase = String(value || "") as PresentationPhase;
  if (!phases.includes(phase)) throw new Error("A valid presentation phase is required.");
  return phase;
}

function cleanCheckpointKey(value: unknown) {
  const key = String(value || "").trim().slice(0, 160);
  if (!key) throw new Error("A checkpoint key is required.");
  return key;
}

async function authorizeTeacher(db: Db, token: string, courseId: string, sessionId: string, action: string) {
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
  if (!profile) throw new Error("No active course profile is linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");

  const [{ data: memberships, error: membershipError }, { data: session, error: sessionError }] =
    await Promise.all([
      db.from("course_memberships").select("role").eq("course_id", courseId)
        .eq("profile_id", profile.id).eq("status", "active").in("role", teacherRoles),
      db.from("class_sessions").select("id, course_id, section_id, content_item_id").eq("id", sessionId)
        .eq("course_id", courseId).maybeSingle()
    ]);
  if (membershipError) throw membershipError;
  if (sessionError) throw sessionError;
  if (!session) throw new Error("That class session was not found.");
  const roles = (memberships || []).map((membership) => String(membership.role));
  if (!roles.length) throw new Error("You are not allowed to view this presentation.");
  const { data: assignments, error: assignmentError } = await db.from("section_enrollments")
    .select("section_id, role").eq("profile_id", profile.id).eq("section_id", session.section_id)
    .eq("status", "active").in("role", ["instructor", "teaching_assistant"]);
  if (assignmentError) throw assignmentError;
  const decision = authorizePresentationRequest({
    action,
    roles,
    assignments: assignments || [],
    sectionId: String(session.section_id)
  });
  if (!decision.allowed) {
    throw new Error("You are not assigned to teach this class session with the required role.");
  }
  return {
    roles,
    assignments: assignments || [],
    sectionId: String(session.section_id),
    contentItemId: session.content_item_id ? String(session.content_item_id) : null
  };
}

async function authoredCheckpointExists(db: Db, input: {
  courseId: string;
  contentItemId: string | null;
  checkpointKey: string;
  checkpointAfterSlide: number;
}) {
  if (!input.contentItemId) return false;
  const { data, error } = await db.from("questions")
    .select("segment_key, checkpoint_after_slide, source_slide_start, source_slide_end, question_banks!inner(course_id, content_item_id, bank_type, status)")
    .eq("status", "active")
    .eq("question_banks.course_id", input.courseId)
    .eq("question_banks.content_item_id", input.contentItemId)
    .eq("question_banks.bank_type", "graded")
    .eq("question_banks.status", "active");
  if (error) throw error;
  try {
    return deckCheckpointsFromQuestions(data || []).some((checkpoint) =>
      checkpoint.key === input.checkpointKey
      && checkpoint.after_slide === input.checkpointAfterSlide
    );
  } catch {
    return false;
  }
}

async function loadState(db: Db, sessionId: string) {
  const { error: insertError } = await db.from("class_presentation_state")
    .upsert({ class_session_id: sessionId }, { onConflict: "class_session_id", ignoreDuplicates: true });
  if (insertError) throw insertError;
  const { data, error } = await db.from("class_presentation_state").select("*")
    .eq("class_session_id", sessionId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Presentation state could not be created.");
  return data;
}

async function loadPulse(db: Db, courseId: string, sessionId: string, sectionId: string) {
  const { data: rounds, error } = await db.from("pulse_rounds")
    .select("id, state, question_id, prompt_snapshot, revealed_at")
    .eq("course_id", courseId).eq("class_session_id", sessionId)
    .in("state", ["open", "revealed"]).order("opened_at", { ascending: false }).limit(1);
  if (error) throw error;
  const round = (rounds || [])[0];
  if (!round) return null;
  if (round.state === "revealed" && round.revealed_at
    && Date.now() > new Date(round.revealed_at).getTime() + 3 * 60 * 1000) return null;

  const [{ count: submitted, error: answerError }, { count: eligible, error: eligibleError }] =
    await Promise.all([
      db.from("pulse_answers").select("id", { count: "exact", head: true }).eq("round_id", round.id),
      db.from("section_enrollments").select("id", { count: "exact", head: true })
        .eq("section_id", sectionId).eq("role", "student").eq("status", "active")
    ]);
  if (answerError) throw answerError;
  if (eligibleError) throw eligibleError;

  const snapshot = (round.prompt_snapshot || {}) as Row;
  return {
    round_id: round.id,
    state: round.state,
    prompt: snapshot.text,
    prompt_es: snapshot.text_es,
    options: snapshot.options,
    correct_key: snapshot.correct_key,
    explanation: snapshot.explanation || null,
    explanation_es: snapshot.explanation_es || null,
    submitted: submitted ?? 0,
    eligible: eligible ?? 0
  };
}
