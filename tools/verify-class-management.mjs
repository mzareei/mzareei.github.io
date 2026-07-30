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
assert.match(notesFn, /\.from\("section_enrollments"\)[\s\S]+\.eq\("section_id", session\.section_id\)[\s\S]+\.eq\("profile_id", profileId\)[\s\S]+\.eq\("role", "student"\)[\s\S]+\.eq\("status", "active"\)/);
assert.match(notesFn, /\.from\("class_student_notes"\)\s*\.insert\(/);
assert.match(notesFn, /\.from\("class_student_notes"\)\s*\.update\(\{\s*resolved_at:[\s\S]+resolved_by:/);
assert.doesNotMatch(notesFn, /\.from\("class_student_notes"\)[\s\S]{0,160}\.update\([\s\S]{0,160}note_text/);
assert.match(notesFn, /action: "class_student_note_created"/);
assert.match(notesFn, /action: "class_student_note_resolved"/);
assert.match(notesFn, /return json\(\{ notes \}\)/);

console.log("verify-class-management: OK");
