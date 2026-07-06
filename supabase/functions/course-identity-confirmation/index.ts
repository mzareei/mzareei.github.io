import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertInstitutionalEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const db = adminClient();
    const profile = await loadProfileForToken(db, token);
    const sections = await loadStudentSections(db, courseId, String(profile.id));
    if (!sections.length) {
      return json({ error: "Student is not enrolled in this course." }, { status: 403 });
    }

    if (body.action === "confirm_identity") {
      const confirmation = await saveIdentityConfirmation(db, courseId, String(profile.id), {
        status: "confirmed",
        issueNote: "",
        actorProfileId: String(profile.id)
      });
      return json({ profile, sections, confirmation });
    }

    if (body.action === "report_identity_issue") {
      const confirmation = await saveIdentityConfirmation(db, courseId, String(profile.id), {
        status: "reported_issue",
        issueNote: cleanIssueNote(body.issue_note),
        actorProfileId: String(profile.id)
      });
      return json({ profile, sections, confirmation });
    }

    const confirmation = await loadIdentityConfirmation(db, courseId, String(profile.id));
    return json({
      profile,
      sections,
      confirmation,
      actions: ["list_identity_confirmation", "confirm_identity", "report_identity_issue"]
    });
  } catch (error) {
    return json({ error: error.message || "Unable to confirm identity." }, { status: 400 });
  }
});

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);
}

function cleanIssueNote(value: unknown) {
  const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, 1000);
  if (text.length < 5) throw new Error("Briefly describe the identity issue.");
  return text;
}

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  assertInstitutionalEmailAllowed(userData.user.email || "");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, student_identifier, full_name, preferred_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Active roster profile is not linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");
  return profile;
}

async function loadStudentSections(db: Db, courseId: string, profileId: string) {
  const { data: enrollments, error: enrollmentError } = await db
    .from("section_enrollments")
    .select("id, section_id, role, status, enrolled_at")
    .eq("profile_id", profileId)
    .eq("role", "student")
    .eq("status", "active");
  if (enrollmentError) throw enrollmentError;
  const sectionIds = unique((enrollments || []).map((enrollment) => enrollment.section_id));
  if (!sectionIds.length) return [];

  const { data: sections, error: sectionError } = await db
    .from("course_sections")
    .select("id, course_id, section_code, section_name, meeting_pattern, campus, status")
    .eq("course_id", courseId)
    .in("id", sectionIds);
  if (sectionError) throw sectionError;
  const sectionById = new Map((sections || []).map((section) => [section.id, section]));

  return (enrollments || [])
    .map((enrollment) => {
      const section = sectionById.get(enrollment.section_id);
      if (!section) return null;
      return {
        ...section,
        enrollment_id: enrollment.id,
        role: enrollment.role,
        enrolled_at: enrollment.enrolled_at
      };
    })
    .filter(Boolean);
}

async function loadIdentityConfirmation(db: Db, courseId: string, profileId: string) {
  const { data, error } = await db
    .from("profile_identity_confirmations")
    .select("id, course_id, profile_id, status, issue_note, confirmed_at, created_at, updated_at")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data || {
    course_id: courseId,
    profile_id: profileId,
    status: "pending",
    issue_note: "",
    confirmed_at: null
  };
}

async function saveIdentityConfirmation(db: Db, courseId: string, profileId: string, input: {
  status: "confirmed" | "reported_issue";
  issueNote: string;
  actorProfileId: string;
}) {
  const now = new Date().toISOString();
  const { data: confirmation, error } = await db
    .from("profile_identity_confirmations")
    .upsert({
      course_id: courseId,
      profile_id: profileId,
      status: input.status,
      issue_note: input.status === "reported_issue" ? input.issueNote : null,
      confirmed_at: input.status === "confirmed" ? now : null,
      updated_at: now
    }, { onConflict: "course_id,profile_id" })
    .select("id, course_id, profile_id, status, issue_note, confirmed_at, created_at, updated_at")
    .single();
  if (error) throw error;

  const action = input.status === "confirmed" ? "identity_confirmed" : "identity_issue_reported";
  const { error: auditError } = await db
    .from("audit_log")
    .insert({
      course_id: courseId,
      actor_profile_id: input.actorProfileId,
      target_type: "profile_identity_confirmation",
      target_id: confirmation.id,
      action,
      metadata: {
        profile_id: profileId,
        status: input.status,
        issue_note: input.status === "reported_issue" ? input.issueNote : null
      }
    });
  if (auditError) throw auditError;

  return confirmation;
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
