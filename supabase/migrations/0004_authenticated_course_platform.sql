create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  institutional_email text not null unique check (
    institutional_email = lower(institutional_email)
    and institutional_email like '%@%'
  ),
  student_identifier text unique check (student_identifier is null or length(student_identifier) between 1 and 80),
  full_name text not null check (length(full_name) between 1 and 160),
  preferred_name text check (preferred_name is null or length(preferred_name) <= 120),
  status text not null default 'active' check (status in ('invited', 'active', 'inactive', 'merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id text primary key,
  code text not null check (length(code) between 2 and 40),
  title text not null check (length(title) between 2 and 160),
  term_label text not null check (length(term_label) between 2 and 80),
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_memberships (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('platform_owner', 'instructor', 'teaching_assistant', 'student', 'observer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, profile_id, role)
);

create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  section_code text not null check (length(section_code) between 1 and 40),
  section_name text not null check (length(section_name) between 1 and 120),
  meeting_pattern text check (meeting_pattern is null or length(meeting_pattern) <= 160),
  campus text check (campus is null or length(campus) <= 120),
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, section_code)
);

create table if not exists public.section_enrollments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('instructor', 'teaching_assistant', 'student', 'observer')),
  status text not null default 'active' check (status in ('active', 'inactive', 'dropped')),
  enrolled_at timestamptz not null default now(),
  dropped_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (section_id, profile_id, role)
);

create table if not exists public.roster_imports (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  section_id uuid references public.course_sections(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  source_filename text not null check (length(source_filename) between 1 and 240),
  row_count int not null default 0 check (row_count >= 0),
  accepted_count int not null default 0 check (accepted_count >= 0),
  rejected_count int not null default 0 check (rejected_count >= 0),
  status text not null default 'uploaded' check (status in ('uploaded', 'validated', 'applied', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  sequence_number int not null check (sequence_number > 0),
  title text not null check (length(title) between 1 and 180),
  planned_date date not null,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  state text not null default 'planned' check (state in ('planned', 'open', 'live', 'paused', 'continued', 'closed', 'cancelled')),
  continued_from_session_id uuid references public.class_sessions(id) on delete set null,
  teacher_notes text check (teacher_notes is null or length(teacher_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, sequence_number)
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  content_type text not null check (content_type in ('lecture', 'mission', 'quiz_bank', 'activity', 'exit_ticket', 'portfolio', 'resource', 'case_file')),
  slug text not null check (length(slug) between 1 and 160),
  title text not null check (length(title) between 1 and 180),
  summary text check (summary is null or length(summary) <= 1000),
  source_kind text not null default 'static_path' check (source_kind in ('static_path', 'supabase_record', 'external_url')),
  source_ref text not null check (length(source_ref) between 1 and 500),
  contains_sensitive_content boolean not null default false,
  default_points numeric not null default 0 check (default_points >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);

create table if not exists public.content_releases (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  section_id uuid references public.course_sections(id) on delete cascade,
  class_session_id uuid references public.class_sessions(id) on delete set null,
  state text not null default 'draft' check (state in ('draft', 'scheduled', 'released', 'live', 'paused', 'review_only', 'closed', 'archived')),
  opens_at timestamptz,
  closes_at timestamptz,
  review_opens_at timestamptz,
  review_closes_at timestamptz,
  allowed_attempts int not null default 1 check (allowed_attempts between 1 and 20),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at),
  check (review_closes_at is null or review_opens_at is null or review_closes_at > review_opens_at)
);

create table if not exists public.release_events (
  id uuid primary key default gen_random_uuid(),
  content_release_id uuid not null references public.content_releases(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created', 'state_changed', 'schedule_changed', 'scope_changed', 'reopened', 'archived')),
  old_state text check (old_state is null or old_state in ('draft', 'scheduled', 'released', 'live', 'paused', 'review_only', 'closed', 'archived')),
  new_state text not null check (new_state in ('draft', 'scheduled', 'released', 'live', 'paused', 'review_only', 'closed', 'archived')),
  reason text check (reason is null or length(reason) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists profiles_auth_user_idx
on public.profiles(auth_user_id);

create index if not exists profiles_email_idx
on public.profiles(institutional_email);

create index if not exists course_memberships_profile_idx
on public.course_memberships(profile_id, course_id, status);

create index if not exists course_sections_course_status_idx
on public.course_sections(course_id, status);

create index if not exists section_enrollments_profile_idx
on public.section_enrollments(profile_id, section_id, status);

create index if not exists roster_imports_course_created_idx
on public.roster_imports(course_id, created_at desc);

create index if not exists class_sessions_section_date_idx
on public.class_sessions(section_id, planned_date, sequence_number);

create index if not exists content_items_course_type_idx
on public.content_items(course_id, content_type);

create index if not exists content_releases_scope_idx
on public.content_releases(course_id, section_id, class_session_id, state);

create index if not exists content_releases_window_idx
on public.content_releases(opens_at, closes_at);

create index if not exists release_events_release_created_idx
on public.release_events(content_release_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_memberships enable row level security;
alter table public.course_sections enable row level security;
alter table public.section_enrollments enable row level security;
alter table public.roster_imports enable row level security;
alter table public.class_sessions enable row level security;
alter table public.content_items enable row level security;
alter table public.content_releases enable row level security;
alter table public.release_events enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.courses from anon, authenticated;
revoke all on public.course_memberships from anon, authenticated;
revoke all on public.course_sections from anon, authenticated;
revoke all on public.section_enrollments from anon, authenticated;
revoke all on public.roster_imports from anon, authenticated;
revoke all on public.class_sessions from anon, authenticated;
revoke all on public.content_items from anon, authenticated;
revoke all on public.content_releases from anon, authenticated;
revoke all on public.release_events from anon, authenticated;
