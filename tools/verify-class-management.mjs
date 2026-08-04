import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(
  path.join(root, "supabase/migrations/0024_class_management_and_notes.sql"),
  "utf8"
);
const fn = fs.readFileSync(
  path.join(root, "supabase/functions/course-session-management/index.ts"),
  "utf8"
);
const notesFn = fs.readFileSync(
  path.join(root, "supabase/functions/course-student-notes/index.ts"),
  "utf8"
);
const rosterFn = fs.readFileSync(
  path.join(root, "supabase/functions/course-roster-management/index.ts"),
  "utf8"
);
const invitationFn = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/instructor-invitation.ts"),
  "utf8"
);
const assignmentSql = fs.readFileSync(
  path.join(root, "supabase/migrations/0025_assign_student_section.sql"),
  "utf8"
);
const assignmentGuardSql = fs.readFileSync(
  path.join(root, "supabase/migrations/0026_guard_student_section_assignment.sql"),
  "utf8"
);
const compositionFixSql = fs.readFileSync(
  path.join(root, "supabase/migrations/0027_class_management_composition_fixes.sql"),
  "utf8"
);
const releaseFn = fs.readFileSync(
  path.join(root, "supabase/functions/course-release-management/index.ts"),
  "utf8"
);

assert.match(sql, /create table[^;]+class_student_notes/is);
assert.match(sql, /needs_follow_up boolean not null default false/i);
assert.match(sql, /alter table public\.class_student_notes enable row level security/i);
assert.match(
  sql,
  /alter table public\.class_sessions\s+add constraint class_sessions_course_id_id_key\s+unique\s*\(\s*course_id\s*,\s*id\s*\)/i,
  "class sessions need a full course/id key for a course-scoped note reference"
);
assert.match(
  sql,
  /foreign key\s*\(\s*course_id\s*,\s*class_session_id\s*\)\s+references public\.class_sessions\s*\(\s*course_id\s*,\s*id\s*\)\s+on delete cascade/i,
  "notes must enforce that their course and session belong together and retain session-delete cascading"
);
assert.match(sql, /close_class_session_with_review/i);
assert.match(sql, /for update/i);
assert.match(sql, /section_id[\s\S]+review_only/i);
assert.match(
  sql,
  /unique\s*\(\s*content_item_id\s*,\s*section_id\s*,\s*class_session_id\s*\)/i,
  "automatic review releases must have a full three-column unique constraint"
);
assert.match(sql, /on conflict\s*\(\s*content_item_id\s*,\s*section_id\s*,\s*class_session_id\s*\)/i);
assert.match(sql, /insert into public\.audit_log/i);
assert.match(sql, /insert into public\.release_events/i);
assert.match(sql, /grant execute on function public\.close_class_session_with_review\(uuid, text, uuid, text\)\s*to service_role/i);
assert.doesNotMatch(
  sql,
  /create unique index[^;]+content_releases[^;]+where/i,
  "the conflict target must be backed by a full unique constraint, not a partial index"
);
assert.match(fn, /body\.action === "update_session"/);
assert.match(fn, /actual_start_at/);
assert.match(fn, /content_type[^;]+lecture/s);
assert.match(fn, /close_class_session_with_review/);
assert.match(sql, /create or replace function public\.update_class_session_atomic/i);
assert.match(
  sql,
  /update_class_session_atomic[\s\S]+for update[\s\S]+update public\.class_sessions[\s\S]+insert into public\.audit_log/i,
  "session editing must lock, update, and audit in one RPC"
);
assert.match(sql, /locked_session\.state not in \('planned', 'open', 'continued'\)[\s\S]+actual_start_at is not null/i);
assert.match(sql, /p_content_item_id[\s\S]+content_type = 'lecture'/i);
assert.match(sql, /grant execute on function public\.update_class_session_atomic\(uuid, text, uuid, uuid, text, date, uuid\)\s*to service_role/i);
assert.match(fn, /\.rpc\("update_class_session_atomic"/);
assert.match(
  compositionFixSql,
  /update_class_session_atomic[\s\S]+target_sequence_number[\s\S]+for update[\s\S]+sequence_number = target_sequence_number/i,
  "moving a planned class must atomically choose and return an available target-group sequence number"
);
assert.match(
  compositionFixSql,
  /loop[\s\S]+update public\.class_sessions[\s\S]+exception[\s\S]+when unique_violation[\s\S]+max\(sequence_number\)/i,
  "a concurrent target-group insert must be retried with the next available sequence number"
);
assert.doesNotMatch(
  fn,
  /Choose a different section or class/,
  "a target-group sequence collision is resolved atomically and must not be presented as a user choice"
);
assert.match(
  compositionFixSql,
  /if locked_session\.state = 'closed' then[\s\S]+return locked_session/i,
  "closing an already-closed session must return the existing result without duplicate review or audit writes"
);
assert.match(
  fn,
  /const isIdempotentClose = currentState === "closed" && input\.nextState === "closed"/,
  "the edge function must allow a close retry to reach post-close cleanup"
);

assert.match(notesFn, /const instructorRoles = \["platform_owner", "instructor"\]/);
assert.match(notesFn, /\.from\("profiles"\)[\s\S]+\.eq\("status", "active"\)/);
assert.match(notesFn, /\.from\("course_memberships"\)[\s\S]+\.eq\("course_id", courseId\)[\s\S]+\.in\("role", instructorRoles\)/);
assert.match(notesFn, /body\.action === "list_session"/);
assert.match(notesFn, /body\.action === "list_student"/);
assert.match(notesFn, /body\.action === "create"/);
assert.match(notesFn, /body\.action === "resolve"/);
assert.doesNotMatch(notesFn, /body\.action === "student/);
assert.match(notesFn, /\.from\("class_sessions"\)[\s\S]+\.eq\("course_id", courseId\)/);
assert.match(notesFn, /return json\(\{ notes \}\)/);
assert.match(sql, /create or replace function public\.create_class_student_note_atomic/i);
assert.match(
  sql,
  /create_class_student_note_atomic[\s\S]+p_course_id text[\s\S]+course_id = p_course_id[\s\S]+for update[\s\S]+section_enrollments[\s\S]+role = 'student'[\s\S]+status = 'active'[\s\S]+insert into public\.class_student_notes[\s\S]+insert into public\.audit_log/i,
  "note creation must derive the session course, validate active group membership, write the note, and audit in one RPC"
);
assert.match(sql, /create_class_student_note_atomic[\s\S]+insert into public\.class_student_notes[\s\S]+locked_session\.course_id/i);
assert.match(sql, /create or replace function public\.resolve_class_student_note_atomic/i);
assert.match(
  sql,
  /resolve_class_student_note_atomic[\s\S]+p_course_id text[\s\S]+for update[\s\S]+class_sessions[\s\S]+course_id = locked_note\.course_id[\s\S]+course_id = p_course_id[\s\S]+section_enrollments[\s\S]+role = 'student'[\s\S]+status = 'active'[\s\S]+update public\.class_student_notes[\s\S]+insert into public\.audit_log/i,
  "note resolution must validate the persisted session/course/group relationship and audit in one RPC"
);
assert.match(sql, /grant execute on function public\.create_class_student_note_atomic\(uuid, text, uuid, uuid, text, boolean\)\s*to service_role/i);
assert.match(sql, /grant execute on function public\.resolve_class_student_note_atomic\(uuid, text, uuid\)\s*to service_role/i);
assert.match(notesFn, /\.rpc\("create_class_student_note_atomic"/);
assert.match(notesFn, /\.rpc\("resolve_class_student_note_atomic"/);
assert.match(notesFn, /p_course_id: courseId/);
assert.doesNotMatch(notesFn, /\.from\("class_student_notes"\)\s*\.insert\(/, "the edge function must not bypass transactional note creation");
assert.doesNotMatch(notesFn, /\.from\("class_student_notes"\)\s*\.update\(/, "the edge function must not bypass transactional note resolution");
assert.match(notesFn, /\.eq\("class_session_id", session\.id\)[\s\S]{0,180}\.eq\("course_id", courseId\)/);
assert.doesNotMatch(
  notesFn,
  /assertStoredNotesMatchSessionGroup/,
  "one moved student must not make an instructor's whole session-note list fail"
);
assert.match(
  notesFn,
  /\.from\("class_student_notes"\)[\s\S]+\.eq\("profile_id", profileId\)[\s\S]+\.eq\("course_id", courseId\)/,
  "student history must start from course-scoped notes, not only current group sessions"
);
assert.match(
  compositionFixSql,
  /create_class_student_note_atomic[\s\S]+enrollment\.section_id = locked_session\.section_id[\s\S]+enrollment\.role = 'student'[\s\S]+enrollment\.status in \('active', 'dropped'\)/i,
  "note creation must accept a student's historical enrollment after a normal group move"
);
assert.match(
  compositionFixSql,
  /resolve_class_student_note_atomic[\s\S]+enrollment\.section_id = locked_session\.section_id[\s\S]+enrollment\.role = 'student'[\s\S]+enrollment\.status in \('active', 'dropped'\)/i,
  "an unresolved note from a student's old group must remain resolvable"
);

assert.match(rosterFn, /const teacherRoles = \["platform_owner", "instructor"\]/);
assert.match(invitationFn, /auth\.admin\.inviteUserByEmail/);
assert.match(invitationFn, /auth\.signInWithOtp/);
assert.match(
  rosterFn,
  /sendInstructorInvitation\(db,\s*person\.institutional_email\)/,
  "adding an instructor must send an invitation email"
);
assert.match(
  rosterFn,
  /requireInstructor\(db, token, courseId\)[\s\S]+body\.action === "assign_person_section"/,
  "group assignment must stay behind the existing instructor role gate"
);
assert.match(rosterFn, /\.rpc\("assign_student_section_atomic"/);
assert.match(rosterFn, /p_course_id:\s*courseId/);
assert.match(rosterFn, /p_actor_profile_id:\s*profile\.id/);
assert.match(rosterFn, /p_profile_id:\s*cleanUuid\(body\.profile_id/);
assert.match(rosterFn, /p_section_id:\s*cleanUuid\(body\.section_id/);
assert.match(rosterFn, /function safeErrorMessage\(error: unknown/);
assert.match(rosterFn, /typeof candidate\.message === "string"/);
assert.match(rosterFn, /const error_code = rosterErrorCode\(message\)/);
const assignmentAction = rosterFn.slice(
  rosterFn.indexOf('if (body.action === "assign_person_section")'),
  rosterFn.indexOf('if (body.action === "grant_external_access")')
);
assert.doesNotMatch(
  assignmentAction,
  /\.from\("section_enrollments"\)\s*\.update\(/,
  "the edge action must not bypass the atomic assignment RPC"
);

assert.match(assignmentSql, /create or replace function public\.assign_student_section_atomic/i);
assert.match(assignmentSql, /p_actor_profile_id\s+uuid/i);
assert.match(assignmentSql, /p_profile_id\s+uuid/i);
assert.match(assignmentSql, /p_section_id\s+uuid/i);
assert.match(assignmentSql, /p_actor_profile_id = p_profile_id/i, "self-assignment must be refused");
assert.match(
  assignmentSql,
  /from public\.profiles[\s\S]+id = p_profile_id[\s\S]+status = 'active'[\s\S]+for update/i,
  "only an active profile may be assigned"
);
assert.match(
  assignmentSql,
  /from public\.course_sections[\s\S]+id = p_section_id[\s\S]+course_id = p_course_id/i,
  "the target group must belong to the requested course"
);
assert.match(
  assignmentSql,
  /from public\.course_memberships[\s\S]+course_id = p_course_id[\s\S]+profile_id = p_profile_id[\s\S]+role = 'student'/i,
  "the target must have a student course membership"
);
assert.match(assignmentSql, /role <> 'student'/i, "instructor, assistant, and observer rows must not be moved as students");
assert.match(
  assignmentSql,
  /update public\.section_enrollments[\s\S]+status = 'dropped'[\s\S]+role = 'student'[\s\S]+status = 'active'/i,
  "other active student enrollments must be preserved and marked dropped"
);
assert.match(
  assignmentSql,
  /insert into public\.section_enrollments[\s\S]+on conflict\s*\(\s*section_id\s*,\s*profile_id\s*,\s*role\s*\)[\s\S]+status = 'active'/i,
  "the target enrollment must be activated through the full unique key"
);
assert.match(
  assignmentSql,
  /update public\.course_memberships[\s\S]+status = 'active'[\s\S]+course_id = p_course_id[\s\S]+profile_id = p_profile_id[\s\S]+role = 'student'/i,
  "the student course membership must remain active"
);
assert.match(assignmentSql, /insert into public\.audit_log/i);
assert.match(assignmentSql, /before_section_ids/i);
assert.match(assignmentSql, /target_section_id/i);
assert.match(
  assignmentSql,
  /grant execute on function public\.assign_student_section_atomic\(text, uuid, uuid, uuid\)\s*to service_role/i
);

assert.match(assignmentGuardSql, /create or replace function public\.assign_student_section_atomic/i);
assert.match(
  assignmentGuardSql,
  /from public\.profiles[\s\S]+id = p_profile_id[\s\S]+status in \('active', 'invited'\)[\s\S]+for update/i,
  "active and invited student profiles must both be assignable"
);
assert.match(
  assignmentGuardSql,
  /from public\.course_sections[\s\S]+id = p_section_id[\s\S]+course_id = p_course_id[\s\S]+status in \('planned', 'active'\)/i,
  "completed and archived groups must be rejected by the transactional boundary"
);
assert.match(
  assignmentGuardSql,
  /Only planned or active groups can receive students\./i,
  "the RPC must return an actionable group-state error"
);
assert.match(
  assignmentGuardSql,
  /Only an active or invited student profile can be assigned to a group\./i,
  "the RPC must return an actionable student-status error"
);
assert.match(
  assignmentGuardSql,
  /grant execute on function public\.assign_student_section_atomic\(text, uuid, uuid, uuid\)\s*to service_role/i
);

assert.match(
  releaseFn,
  /scheduled:\s*\["released",\s*"draft"\]/,
  "scheduled access must have a valid cancellation transition back to draft"
);

console.log("verify-class-management: OK");
