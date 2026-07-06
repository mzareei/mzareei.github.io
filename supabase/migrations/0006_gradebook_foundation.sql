create extension if not exists pgcrypto;

create table if not exists public.gradebook_categories (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  weight_percent numeric not null default 0 check (weight_percent between 0 and 100),
  drop_lowest_count int not null default 0 check (drop_lowest_count >= 0),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, name)
);

create table if not exists public.gradebook_items (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  category_id uuid not null references public.gradebook_categories(id) on delete restrict,
  activity_template_id uuid references public.activity_templates(id) on delete set null,
  title text not null check (length(title) between 1 and 180),
  max_score numeric not null default 100 check (max_score >= 0),
  due_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'locked', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, title)
);

create table if not exists public.gradebook_scores (
  id uuid primary key default gen_random_uuid(),
  gradebook_item_id uuid not null references public.gradebook_items(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  source_attempt_id uuid references public.student_attempts(id) on delete set null,
  score_raw numeric check (score_raw is null or score_raw >= 0),
  score_percent numeric check (score_percent is null or score_percent between 0 and 100),
  score_final numeric check (score_final is null or score_final >= 0),
  status text not null default 'draft' check (status in ('draft', 'posted', 'excused', 'missing', 'locked')),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gradebook_item_id, profile_id),
  check (status <> 'locked' or locked_at is not null)
);

create table if not exists public.grade_adjustments (
  id uuid primary key default gen_random_uuid(),
  gradebook_score_id uuid not null references public.gradebook_scores(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  previous_score_final numeric check (previous_score_final is null or previous_score_final >= 0),
  new_score_final numeric not null check (new_score_final >= 0),
  reason text not null check (length(reason) between 5 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.participation_events (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  class_session_id uuid references public.class_sessions(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (length(event_type) between 1 and 80),
  points numeric not null default 0 check (points >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  course_id text references public.courses(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (length(target_type) between 1 and 120),
  target_id uuid,
  action text not null check (length(action) between 1 and 120),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists gradebook_categories_course_status_idx
on public.gradebook_categories(course_id, status, name);

create index if not exists gradebook_items_course_category_status_idx
on public.gradebook_items(course_id, category_id, status, due_at);

create index if not exists gradebook_items_activity_template_idx
on public.gradebook_items(activity_template_id)
where activity_template_id is not null;

create index if not exists gradebook_scores_item_section_idx
on public.gradebook_scores(gradebook_item_id, section_id, status, score_final desc);

create index if not exists gradebook_scores_profile_idx
on public.gradebook_scores(profile_id, section_id, status, updated_at desc);

create index if not exists grade_adjustments_score_created_idx
on public.grade_adjustments(gradebook_score_id, created_at desc);

create index if not exists participation_events_profile_created_idx
on public.participation_events(profile_id, section_id, created_at desc);

create index if not exists participation_events_session_idx
on public.participation_events(class_session_id, event_type, created_at desc);

create index if not exists audit_log_course_created_idx
on public.audit_log(course_id, created_at desc);

alter table public.gradebook_categories enable row level security;
alter table public.gradebook_items enable row level security;
alter table public.gradebook_scores enable row level security;
alter table public.grade_adjustments enable row level security;
alter table public.participation_events enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.gradebook_categories from anon, authenticated;
revoke all on public.gradebook_items from anon, authenticated;
revoke all on public.gradebook_scores from anon, authenticated;
revoke all on public.grade_adjustments from anon, authenticated;
revoke all on public.participation_events from anon, authenticated;
revoke all on public.audit_log from anon, authenticated;
