insert into public.courses (id, code, title, term_label, status)
values ('tc2007b', 'TC2007B', 'Information Security', 'Tecnologico de Monterrey', 'active')
on conflict (id) do update set
  code = excluded.code,
  title = excluded.title,
  term_label = excluded.term_label,
  status = excluded.status,
  updated_at = now();

insert into public.course_sections (course_id, section_code, section_name, meeting_pattern, campus, status)
values
  ('tc2007b', 'A', 'Section A', 'Set before semester', 'Campus', 'active'),
  ('tc2007b', 'B', 'Section B', 'Set before semester', 'Campus', 'active')
on conflict (course_id, section_code) do update set
  section_name = excluded.section_name,
  meeting_pattern = excluded.meeting_pattern,
  campus = excluded.campus,
  status = excluded.status,
  updated_at = now();

insert into public.content_items (course_id, content_type, slug, title, summary, source_kind, source_ref, contains_sensitive_content, default_points)
values
  ('tc2007b', 'lecture', 'week-01-lecture', 'Week 1 Lecture 1: Introduction to Cybersecurity', 'Security mindset, CIA triad, risk, and design principles.', 'static_path', '/assets/course-materials/information-security/week-01/lecture/', false, 0),
  ('tc2007b', 'mission', 'week-01-mission-01', 'Mission 01: Think Like an Attacker', 'Practice CIA reasoning, phishing, spoofing, and defender response loops.', 'static_path', '/assets/course-materials/information-security/week-01/mission-01/', false, 10),
  ('tc2007b', 'lecture', 'week-01-lecture-2', 'Week 1 Lecture 2: Legal and Ethical Aspects', 'Authorization, privacy, disclosure, scope, and responsible security work.', 'static_path', '/assets/course-materials/information-security/week-01/lecture-2/', false, 0),
  ('tc2007b', 'lecture', 'week-02-lecture', 'Week 2 Lecture 1: Authentication', 'Passwords, storage, biometrics, MFA, and usability.', 'static_path', '/assets/course-materials/information-security/week-02/lecture/', false, 0),
  ('tc2007b', 'resource', 'review-coach', 'Review Coach', 'Practice weak topics based on released work and missed concepts.', 'static_path', '/assets/course-materials/information-security/review-coach/', false, 0),
  ('tc2007b', 'resource', 'teacher', 'Teacher Insights', 'Instructor summary view for participation, reflections, and course signals.', 'static_path', '/assets/course-materials/information-security/teacher/', true, 0)
on conflict (course_id, slug) do update set
  content_type = excluded.content_type,
  title = excluded.title,
  summary = excluded.summary,
  source_kind = excluded.source_kind,
  source_ref = excluded.source_ref,
  contains_sensitive_content = excluded.contains_sensitive_content,
  default_points = excluded.default_points,
  updated_at = now();

insert into public.content_releases (content_item_id, course_id, state, opens_at, allowed_attempts)
select id, 'tc2007b', 'released', now(), 1
from public.content_items item
where item.course_id = 'tc2007b'
  and item.slug in ('week-01-lecture', 'week-01-mission-01', 'review-coach')
  and not exists (
    select 1
    from public.content_releases release
    where release.content_item_id = item.id
      and release.course_id = 'tc2007b'
      and release.section_id is null
  );

insert into public.content_releases (content_item_id, course_id, state, opens_at, allowed_attempts)
select id, 'tc2007b', 'scheduled', now() + interval '7 days', 1
from public.content_items item
where item.course_id = 'tc2007b'
  and item.slug = 'week-01-lecture-2'
  and not exists (
    select 1
    from public.content_releases release
    where release.content_item_id = item.id
      and release.course_id = 'tc2007b'
      and release.section_id is null
  );

insert into public.content_releases (content_item_id, course_id, state, allowed_attempts)
select id, 'tc2007b', 'draft', 1
from public.content_items item
where item.course_id = 'tc2007b'
  and item.slug in ('week-02-lecture', 'teacher')
  and not exists (
    select 1
    from public.content_releases release
    where release.content_item_id = item.id
      and release.course_id = 'tc2007b'
      and release.section_id is null
  );
