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
assert.match(notesFn, /\.eq\("profile_id", profileId\)[\s\S]{0,180}\.eq\("course_id", courseId\)[\s\S]{0,180}\.in\("class_session_id", sessionIds\)/);

console.log("verify-class-management: OK");
