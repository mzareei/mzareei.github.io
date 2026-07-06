-- TC2007B post-launch smoke sanity checks.
-- Run in the Supabase SQL editor after migrations, seeds, function deploys,
-- roster import, and one teacher-plus-student smoke test.
--
-- No individual student names or emails are selected by default.
-- If a check does not show the expected count, inspect through the teacher UI
-- or a private admin workflow instead of pasting identifying data into public notes.

-- Change this value only if the live course id is different.
with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Project metadata' as check_name,
  c.id as course_id,
  c.code,
  c.title,
  c.term_label,
  c.status
from public.courses c
join launch_params p on p.course_id = c.id;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Roster identity claim summary' as check_name,
  pr.status,
  count(*) as profile_count,
  count(pr.auth_user_id) as claimed_profile_count
from public.profiles pr
join public.course_memberships cm on cm.profile_id = pr.id
join launch_params p on p.course_id = cm.course_id
group by pr.status
order by pr.status;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Roster summary' as check_name,
  cm.role,
  cm.status,
  count(*) as profile_count
from public.course_memberships cm
join launch_params p on p.course_id = cm.course_id
group by cm.role, cm.status
order by cm.role, cm.status;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Section enrollment summary' as check_name,
  cs.section_code,
  se.role,
  se.status,
  count(*) as enrollment_count
from public.section_enrollments se
join public.course_sections cs on cs.id = se.section_id
join launch_params p on p.course_id = cs.course_id
group by cs.section_code, se.role, se.status
order by cs.section_code, se.role, se.status;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Release state summary' as check_name,
  coalesce(cs.section_code, 'course-wide') as section_code,
  cr.state,
  count(*) as release_count
from public.content_releases cr
left join public.course_sections cs on cs.id = cr.section_id
join launch_params p on p.course_id = cr.course_id
group by coalesce(cs.section_code, 'course-wide'), cr.state
order by coalesce(cs.section_code, 'course-wide'), cr.state;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Activity instance summary' as check_name,
  cs.section_code,
  ai.state,
  count(*) as activity_instance_count
from public.activity_instances ai
join public.course_sections cs on cs.id = ai.section_id
join launch_params p on p.course_id = cs.course_id
group by cs.section_code, ai.state
order by cs.section_code, ai.state;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Student attempt summary' as check_name,
  cs.section_code,
  sa.status,
  count(*) as attempt_count,
  count(sa.submitted_at) as submitted_count,
  round(avg(sa.score_percent), 2) as average_score_percent
from public.student_attempts sa
join public.course_sections cs on cs.id = sa.section_id
join launch_params p on p.course_id = cs.course_id
group by cs.section_code, sa.status
order by cs.section_code, sa.status;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Student response summary' as check_name,
  cs.section_code,
  count(sr.id) as response_count,
  count(*) filter (where sr.is_correct is true) as correct_count,
  count(*) filter (where sr.is_correct is false) as incorrect_count
from public.student_responses sr
join public.student_attempts sa on sa.id = sr.student_attempt_id
join public.course_sections cs on cs.id = sa.section_id
join launch_params p on p.course_id = cs.course_id
group by cs.section_code
order by cs.section_code;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Gradebook score summary' as check_name,
  cs.section_code,
  gs.status,
  count(*) as score_count,
  round(avg(gs.score_final), 2) as average_final_score
from public.gradebook_scores gs
join public.gradebook_items gi on gi.id = gs.gradebook_item_id
join public.course_sections cs on cs.id = gs.section_id
join launch_params p on p.course_id = gi.course_id
group by cs.section_code, gs.status
order by cs.section_code, gs.status;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Gradebook export evidence summary' as check_name,
  count(gs.id) as score_rows,
  count(gs.source_attempt_id) as scores_linked_to_attempts,
  count(*) filter (where gs.score_raw is not null) as rows_with_raw_score,
  count(*) filter (where gs.score_final is not null) as rows_with_final_score,
  count(*) filter (where gs.status in ('posted', 'missing', 'excused', 'locked')) as official_status_rows
from public.gradebook_scores gs
join public.gradebook_items gi on gi.id = gs.gradebook_item_id
join launch_params p on p.course_id = gi.course_id;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Exit ticket summary' as check_name,
  cs.section_code,
  count(*) as exit_ticket_count,
  round(avg(et.confidence), 2) as average_confidence
from public.exit_tickets et
join public.course_sections cs on cs.id = et.section_id
join launch_params p on p.course_id = et.course_id
group by cs.section_code
order by cs.section_code;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Portfolio entry summary' as check_name,
  cs.section_code,
  pe.entry_type,
  pe.visibility,
  count(*) as portfolio_entry_count
from public.portfolio_entries pe
join public.course_sections cs on cs.id = pe.section_id
join launch_params p on p.course_id = pe.course_id
group by cs.section_code, pe.entry_type, pe.visibility
order by cs.section_code, pe.entry_type, pe.visibility;

with launch_params as (
  select 'tc2007b'::text as course_id
)
select
  'Audit log summary' as check_name,
  al.target_type,
  al.action,
  count(*) as audit_event_count,
  max(al.created_at) as latest_event_at
from public.audit_log al
join launch_params p on p.course_id = al.course_id
group by al.target_type, al.action
order by max(al.created_at) desc, al.target_type, al.action;

with sensitive_tables as (
  select unnest(array[
    'profiles',
    'profile_identity_confirmations',
    'courses',
    'course_memberships',
    'course_sections',
    'section_enrollments',
    'roster_imports',
    'class_sessions',
    'content_items',
    'content_releases',
    'release_events',
    'activity_templates',
    'activity_instances',
    'question_banks',
    'questions',
    'question_options',
    'student_attempts',
    'student_responses',
    'exit_tickets',
    'gradebook_categories',
    'gradebook_items',
    'gradebook_scores',
    'grade_adjustments',
    'participation_events',
    'audit_log',
    'portfolio_entries'
  ]) as table_name
)
select
  'RLS state summary' as check_name,
  st.table_name,
  c.relrowsecurity as rls_enabled
from sensitive_tables st
left join pg_class c on c.relname = st.table_name
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
order by st.table_name;
