-- Per-class attendance, engagement, and grading.
--
-- Two things arrive together here because one is worthless without the other:
-- an attendance table nobody can trust, because students could reach /live
-- without ever scanning, is just a list of guesses. So the QR check-in becomes
-- a real row, and the live screen starts requiring it.
--
-- There is ONE QR code and ONE check-in per class. The unique constraint below
-- is what makes "the first scan counts" true at the database level rather than
-- in whichever caller happens to run first.

create table if not exists public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  -- 'qr' is a student scanning the projected code. 'instructor' is the professor
  -- marking someone present by hand when the phone died or the camera refused —
  -- without that escape hatch, a failed projector locks the whole room out.
  source text not null default 'qr' check (source in ('qr', 'instructor')),
  marked_by_profile_id uuid references public.profiles(id) on delete set null,
  note text check (note is null or length(note) between 1 and 500),
  created_at timestamptz not null default now(),
  -- The first scan wins. Later scans hit this and are discarded, so the recorded
  -- arrival time cannot drift later in the hour.
  unique (class_session_id, profile_id),
  check (source <> 'instructor' or marked_by_profile_id is not null)
);

create index if not exists class_attendance_session_idx
  on public.class_attendance (class_session_id, checked_in_at);
create index if not exists class_attendance_profile_idx
  on public.class_attendance (profile_id, checked_in_at desc);

-- Append-only. An override is never edited or deleted; a newer row supersedes an
-- older one, and the trail of who changed a contested grade and why survives.
create table if not exists public.class_grade_overrides (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- Null clears the override and hands the student back to the calculated grade.
  -- The reason stays required either way: removing an override is also a decision.
  grade numeric check (grade is null or (grade >= 0 and grade <= 100)),
  calculated_grade numeric check (calculated_grade is null or (calculated_grade >= 0 and calculated_grade <= 100)),
  -- Not merely discouraged in the UI: an override without a written reason
  -- cannot be stored.
  reason text not null check (length(reason) between 5 and 1000),
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists class_grade_overrides_lookup_idx
  on public.class_grade_overrides (class_session_id, profile_id, created_at desc);

-- Grace period before a check-in counts as late. Per session, because a class
-- that starts slowly warrants a different threshold than one that does not.
alter table public.class_sessions
  add column if not exists late_after_minutes int not null default 5;
alter table public.class_sessions
  drop constraint if exists class_sessions_late_after_minutes_check;
alter table public.class_sessions
  add constraint class_sessions_late_after_minutes_check
  check (late_after_minutes between 0 and 120);

-- Same posture as every other table: RLS on with zero policies, so browsers get
-- nothing and service-role edge functions are the only door.
alter table public.class_attendance enable row level security;
revoke all on public.class_attendance from anon, authenticated;
alter table public.class_grade_overrides enable row level security;
revoke all on public.class_grade_overrides from anon, authenticated;
