import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

const teacherRoles = ["platform_owner", "instructor"];
const rosterRoles = ["student", "teaching_assistant", "instructor", "observer"];
const defaultAllowedDomains = ["tec.mx", "itesm.mx"];

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
    const { profile } = await requireInstructor(db, token, courseId);

    if (body.action === "preview_roster") {
      const result = await validateRosterRows(db, courseId, cleanRosterRows(body.rows), cleanAllowedDomains(body.allowed_domains));
      return json(result);
    }

    if (body.action === "apply_roster") {
      const result = await applyRoster(db, {
        courseId,
        rows: cleanRosterRows(body.rows),
        allowedDomains: cleanAllowedDomains(body.allowed_domains),
        sourceFilename: cleanSourceFilename(body.source_filename),
        actorProfileId: profile.id
      });
      return json(result);
    }

    if (body.action === "correct_roster_profile") {
      const result = await correctRosterProfile(db, {
        courseId,
        profileId: cleanUuid(body.profile_id, "A valid profile id is required."),
        institutionalEmail: cleanEmail(body.institutional_email),
        fullName: cleanFullName(body.full_name),
        studentIdentifier: cleanStudentIdentifier(body.student_identifier),
        status: cleanProfileStatus(body.status),
        reason: cleanReason(body.reason),
        actorProfileId: profile.id
      });
      return json(result);
    }

    if (body.action === "merge_roster_profile") {
      const result = await mergeRosterProfile(db, {
        courseId,
        sourceProfileId: cleanUuid(body.source_profile_id, "A valid source profile id is required."),
        targetProfileId: cleanUuid(body.target_profile_id, "A valid target profile id is required."),
        reason: cleanReason(body.reason),
        actorProfileId: profile.id
      });
      return json(result);
    }

    const roster = await listRoster(db, courseId);
    return json({
      roster,
      actions: ["list_roster", "preview_roster", "apply_roster", "correct_roster_profile", "merge_roster_profile"],
      allowed_domains: defaultAllowedDomains
    });
  } catch (error) {
    const message = error.message || "Unable to manage roster.";
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
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

function cleanAllowedDomains(value: unknown) {
  const domains = Array.isArray(value) ? value : [];
  const cleaned = domains
    .map((domain) => String(domain || "").trim().toLowerCase().replace(/^@/, ""))
    .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain));
  return Array.from(new Set(cleaned.length ? cleaned : defaultAllowedDomains));
}

function cleanRosterRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).map((row, index) => {
    const source = typeof row === "object" && row ? row as Record<string, unknown> : {};
    return {
      row_number: Number(source.row_number || index + 1),
      institutional_email: cleanEmail(source.institutional_email),
      full_name: String(source.full_name || "").trim().slice(0, 160),
      student_identifier: String(source.student_identifier || "").trim().slice(0, 80),
      section_code: String(source.section_code || "").trim().slice(0, 40),
      role: String(source.role || "student").trim().toLowerCase()
    };
  });
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanFullName(value: unknown) {
  const text = String(value || "").trim().slice(0, 160);
  if (text.length < 1) throw new Error("Full name is required.");
  return text;
}

function cleanStudentIdentifier(value: unknown) {
  return String(value || "").trim().slice(0, 80) || null;
}

function cleanProfileStatus(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (!["invited", "active", "inactive", "merged"].includes(text)) {
    throw new Error("A valid profile status is required.");
  }
  return text;
}

function cleanReason(value: unknown) {
  const text = String(value || "").trim().slice(0, 1000);
  if (text.length < 5) throw new Error("A correction or merge reason is required.");
  return text;
}

function cleanUuid(value: unknown, message: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(text)) {
    throw new Error(message);
  }
  return text;
}

function cleanSourceFilename(value: unknown) {
  return String(value || "pasted-roster.csv").trim().slice(0, 240) || "pasted-roster.csv";
}

async function requireInstructor(db: ReturnType<typeof adminClient>, token: string, courseId: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Instructor profile is not linked to this account.");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("id, role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .in("role", teacherRoles);
  if (membershipError) throw membershipError;
  if (!(memberships || []).length) throw new Error("You are not allowed to manage the roster for this course.");

  return { profile, user: userData.user };
}

async function validateRosterRows(db: ReturnType<typeof adminClient>, courseId: string, rows: ReturnType<typeof cleanRosterRows>, allowedDomains: string[]) {
  const { data: sections, error } = await db
    .from("course_sections")
    .select("id, section_code, section_name, status")
    .eq("course_id", courseId);
  if (error) throw error;

  const sectionByCode = new Map((sections || []).map((section) => [String(section.section_code).toLowerCase(), section]));
  const seenEmails = new Set<string>();
  const accepted_rows = [];
  const rejected_rows = [];

  for (const row of rows) {
    const rejection = validateRosterRow(row, allowedDomains, sectionByCode, seenEmails);
    if (rejection) {
      rejected_rows.push({
        ...row,
        reason: rejection
      });
      continue;
    }
    seenEmails.add(row.institutional_email);
    const section = sectionByCode.get(row.section_code.toLowerCase());
    accepted_rows.push({
      ...row,
      role: row.role || "student",
      section_id: section.id,
      section_name: section.section_name
    });
  }

  return {
    row_count: rows.length,
    accepted_count: accepted_rows.length,
    rejected_count: rejected_rows.length,
    accepted_rows,
    rejected_rows,
    allowed_domains: allowedDomains
  };
}

function validateRosterRow(row: ReturnType<typeof cleanRosterRows>[number], allowedDomains: string[], sectionByCode: Map<string, Record<string, unknown>>, seenEmails: Set<string>) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.institutional_email)) return "Invalid institutional email.";
  if (!allowedDomains.some((domain) => row.institutional_email.endsWith(`@${domain}`))) return "Email is outside the allowed institutional domains.";
  if (seenEmails.has(row.institutional_email)) return "Duplicate email in this import.";
  if (row.full_name.length < 1) return "Full name is required.";
  if (!row.section_code) return "Section code is required.";
  if (!sectionByCode.has(row.section_code.toLowerCase())) return "Section code does not exist for this course.";
  if (!rosterRoles.includes(row.role)) return "Role is not valid for roster import.";
  return "";
}

async function applyRoster(db: ReturnType<typeof adminClient>, input: {
  courseId: string;
  rows: ReturnType<typeof cleanRosterRows>;
  allowedDomains: string[];
  sourceFilename: string;
  actorProfileId: string;
}) {
  const preview = await validateRosterRows(db, input.courseId, input.rows, input.allowedDomains);

  const { data: importRow, error: importError } = await db
    .from("roster_imports")
    .insert({
      course_id: input.courseId,
      uploaded_by: input.actorProfileId,
      source_filename: input.sourceFilename,
      row_count: preview.row_count,
      accepted_count: preview.accepted_count,
      rejected_count: preview.rejected_count,
      status: preview.rejected_count ? "validated" : "applied"
    })
    .select("id, row_count, accepted_count, rejected_count, status, created_at")
    .single();
  if (importError) throw importError;

  if (preview.accepted_rows.length) {
    await upsertAcceptedRows(db, input.courseId, preview.accepted_rows);
    if (preview.rejected_count === 0) {
      await db
        .from("roster_imports")
        .update({ status: "applied" })
        .eq("id", importRow.id);
    }
  }

  return {
    roster_import: importRow,
    ...preview
  };
}

async function upsertAcceptedRows(db: ReturnType<typeof adminClient>, courseId: string, rows: Record<string, unknown>[]) {
  const profilePayload = rows.map((row) => ({
    institutional_email: row.institutional_email,
    student_identifier: row.student_identifier || null,
    full_name: row.full_name,
    status: "invited",
    updated_at: new Date().toISOString()
  }));

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .upsert(profilePayload, { onConflict: "institutional_email" })
    .select("id, institutional_email");
  if (profileError) throw profileError;

  const profileByEmail = new Map((profiles || []).map((profile) => [profile.institutional_email, profile]));
  const membershipPayload = [];
  const enrollmentPayload = [];

  for (const row of rows) {
    const profile = profileByEmail.get(row.institutional_email);
    if (!profile) continue;
    membershipPayload.push({
      course_id: courseId,
      profile_id: profile.id,
      role: row.role,
      status: "active",
      updated_at: new Date().toISOString()
    });
    enrollmentPayload.push({
      section_id: row.section_id,
      profile_id: profile.id,
      role: row.role,
      status: "active",
      updated_at: new Date().toISOString()
    });
  }

  if (membershipPayload.length) {
    const { error } = await db
      .from("course_memberships")
      .upsert(membershipPayload, { onConflict: "course_id,profile_id,role" });
    if (error) throw error;
  }
  if (enrollmentPayload.length) {
    const { error } = await db
      .from("section_enrollments")
      .upsert(enrollmentPayload, { onConflict: "section_id,profile_id,role" });
    if (error) throw error;
  }
}

async function correctRosterProfile(db: ReturnType<typeof adminClient>, input: {
  courseId: string;
  profileId: string;
  institutionalEmail: string;
  fullName: string;
  studentIdentifier: string | null;
  status: string;
  reason: string;
  actorProfileId: string;
}) {
  await assertProfileInCourse(db, input.courseId, input.profileId);
  validateCorrectedEmail(input.institutionalEmail);

  const { data: before, error: beforeError } = await db
    .from("profiles")
    .select("id, institutional_email, student_identifier, full_name, preferred_name, status")
    .eq("id", input.profileId)
    .maybeSingle();
  if (beforeError) throw beforeError;
  if (!before) throw new Error("Profile not found.");

  const { data: profile, error: updateError } = await db
    .from("profiles")
    .update({
      institutional_email: input.institutionalEmail,
      full_name: input.fullName,
      student_identifier: input.studentIdentifier,
      status: input.status,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.profileId)
    .select("id, institutional_email, student_identifier, full_name, preferred_name, status")
    .single();
  if (updateError) throw updateError;

  await insertAudit(db, {
    courseId: input.courseId,
    actorProfileId: input.actorProfileId,
    targetType: "profile",
    targetId: input.profileId,
    action: "profile_corrected",
    metadata: {
      reason: input.reason,
      before,
      after: profile
    }
  });

  return { profile };
}

async function mergeRosterProfile(db: ReturnType<typeof adminClient>, input: {
  courseId: string;
  sourceProfileId: string;
  targetProfileId: string;
  reason: string;
  actorProfileId: string;
}) {
  if (input.sourceProfileId === input.targetProfileId) {
    throw new Error("Source and target profile must be different.");
  }
  const source = await assertProfileInCourse(db, input.courseId, input.sourceProfileId);
  const target = await assertProfileInCourse(db, input.courseId, input.targetProfileId);

  const moved = {
    course_memberships: await copyCourseMemberships(db, input.courseId, input.sourceProfileId, input.targetProfileId),
    section_enrollments: await copySectionEnrollments(db, input.courseId, input.sourceProfileId, input.targetProfileId),
    student_attempts: await moveProfileRows(db, "student_attempts", input.sourceProfileId, input.targetProfileId),
    gradebook_scores: await moveProfileRows(db, "gradebook_scores", input.sourceProfileId, input.targetProfileId),
    portfolio_entries: await moveProfileRows(db, "portfolio_entries", input.sourceProfileId, input.targetProfileId),
    exit_tickets: await moveProfileRows(db, "exit_tickets", input.sourceProfileId, input.targetProfileId),
    participation_events: await moveProfileRows(db, "participation_events", input.sourceProfileId, input.targetProfileId)
  };

  await db
    .from("course_memberships")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("course_id", input.courseId)
    .eq("profile_id", input.sourceProfileId);
  await deactivateSourceSectionEnrollments(db, input.courseId, input.sourceProfileId);

  const { data: mergedProfile, error: mergeError } = await db
    .from("profiles")
    .update({
      auth_user_id: null,
      status: "merged",
      updated_at: new Date().toISOString()
    })
    .eq("id", input.sourceProfileId)
    .select("id, institutional_email, student_identifier, full_name, status")
    .single();
  if (mergeError) throw mergeError;

  await insertAudit(db, {
    courseId: input.courseId,
    actorProfileId: input.actorProfileId,
    targetType: "profile",
    targetId: input.sourceProfileId,
    action: "profile_merged",
    metadata: {
      reason: input.reason,
      source_profile_id: input.sourceProfileId,
      target_profile_id: input.targetProfileId,
      source_email: source.institutional_email,
      target_email: target.institutional_email,
      moved
    }
  });

  return {
    source_profile: mergedProfile,
    target_profile_id: input.targetProfileId,
    moved
  };
}

function validateCorrectedEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid institutional email.");
  if (!defaultAllowedDomains.some((domain) => email.endsWith(`@${domain}`))) {
    throw new Error("Email is outside the allowed institutional domains.");
  }
}

async function assertProfileInCourse(db: ReturnType<typeof adminClient>, courseId: string, profileId: string) {
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, institutional_email, student_identifier, full_name, status")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Profile not found.");

  const { data: membership, error: membershipError } = await db
    .from("course_memberships")
    .select("id")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error("Profile is not part of this course roster.");
  return profile;
}

async function copyCourseMemberships(db: ReturnType<typeof adminClient>, courseId: string, sourceProfileId: string, targetProfileId: string) {
  const { data: memberships, error } = await db
    .from("course_memberships")
    .select("course_id, role, status")
    .eq("course_id", courseId)
    .eq("profile_id", sourceProfileId);
  if (error) throw error;
  const payload = (memberships || []).map((membership) => ({
    course_id: membership.course_id,
    profile_id: targetProfileId,
    role: membership.role,
    status: membership.status,
    updated_at: new Date().toISOString()
  }));
  if (!payload.length) return 0;
  const { error: upsertError } = await db
    .from("course_memberships")
    .upsert(payload, { onConflict: "course_id,profile_id,role" });
  if (upsertError) throw upsertError;
  return payload.length;
}

async function copySectionEnrollments(db: ReturnType<typeof adminClient>, courseId: string, sourceProfileId: string, targetProfileId: string) {
  const { data: enrollments, error } = await db
    .from("section_enrollments")
    .select("section_id, role, status, course_sections!inner(course_id)")
    .eq("profile_id", sourceProfileId)
    .eq("course_sections.course_id", courseId);
  if (error) throw error;
  const payload = (enrollments || []).map((enrollment) => ({
    section_id: enrollment.section_id,
    profile_id: targetProfileId,
    role: enrollment.role,
    status: enrollment.status,
    updated_at: new Date().toISOString()
  }));
  if (!payload.length) return 0;
  const { error: upsertError } = await db
    .from("section_enrollments")
    .upsert(payload, { onConflict: "section_id,profile_id,role" });
  if (upsertError) throw upsertError;
  return payload.length;
}

async function deactivateSourceSectionEnrollments(db: ReturnType<typeof adminClient>, courseId: string, sourceProfileId: string) {
  const { data: enrollments, error } = await db
    .from("section_enrollments")
    .select("id, course_sections!inner(course_id)")
    .eq("profile_id", sourceProfileId)
    .eq("course_sections.course_id", courseId);
  if (error) throw error;
  const ids = unique((enrollments || []).map((enrollment) => enrollment.id));
  if (!ids.length) return;
  const { error: updateError } = await db
    .from("section_enrollments")
    .update({ status: "dropped", dropped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in("id", ids);
  if (updateError) throw updateError;
}

async function moveProfileRows(db: ReturnType<typeof adminClient>, table: string, sourceProfileId: string, targetProfileId: string) {
  const { data, error } = await db
    .from(table)
    .update({ profile_id: targetProfileId })
    .eq("profile_id", sourceProfileId)
    .select("id");
  if (error) throw error;
  return (data || []).length;
}

async function insertAudit(db: ReturnType<typeof adminClient>, input: {
  courseId: string;
  actorProfileId: string;
  targetType: string;
  targetId: string;
  action: string;
  metadata: Record<string, unknown>;
}) {
  const { error } = await db
    .from("audit_log")
    .insert({
      course_id: input.courseId,
      actor_profile_id: input.actorProfileId,
      target_type: input.targetType,
      target_id: input.targetId,
      action: input.action,
      metadata: input.metadata
    });
  if (error) throw error;
}

async function listRoster(db: ReturnType<typeof adminClient>, courseId: string) {
  const { data: memberships, error } = await db
    .from("course_memberships")
    .select("id, profile_id, role, status, updated_at")
    .eq("course_id", courseId)
    .order("role", { ascending: true });
  if (error) throw error;
  if (!(memberships || []).length) return [];

  const profileIds = unique((memberships || []).map((membership) => membership.profile_id));
  const [{ data: profiles, error: profileError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    db
      .from("profiles")
      .select("id, institutional_email, student_identifier, full_name, auth_user_id, status")
      .in("id", profileIds),
    db
      .from("section_enrollments")
      .select("id, section_id, profile_id, role, status")
      .in("profile_id", profileIds)
  ]);
  if (profileError) throw profileError;
  if (enrollmentError) throw enrollmentError;

  const sectionIds = unique((enrollments || []).map((enrollment) => enrollment.section_id));
  const { data: sections, error: sectionError } = sectionIds.length
    ? await db
        .from("course_sections")
        .select("id, section_code, section_name")
        .in("id", sectionIds)
    : { data: [], error: null };
  if (sectionError) throw sectionError;

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const sectionById = new Map((sections || []).map((section) => [section.id, section]));
  const enrollmentByProfile = new Map<string, Record<string, unknown>[]>();
  for (const enrollment of enrollments || []) {
    const rows = enrollmentByProfile.get(enrollment.profile_id) || [];
    rows.push(enrollment);
    enrollmentByProfile.set(enrollment.profile_id, rows);
  }

  return (memberships || []).map((membership) => {
    const profile = profileById.get(membership.profile_id) || {};
    const sectionsForProfile = (enrollmentByProfile.get(membership.profile_id) || []).map((enrollment) => {
      const section = sectionById.get(enrollment.section_id) || {};
      return {
        section_id: enrollment.section_id,
        section_code: section.section_code || "",
        section_name: section.section_name || "",
        role: enrollment.role,
        status: enrollment.status
      };
    });
    return {
      profile_id: membership.profile_id,
      institutional_email: profile.institutional_email || "",
      student_identifier: profile.student_identifier || "",
      full_name: profile.full_name || "",
      claimed: Boolean(profile.auth_user_id),
      profile_status: profile.status || "",
      course_role: membership.role,
      membership_status: membership.status,
      sections: sectionsForProfile
    };
  });
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
