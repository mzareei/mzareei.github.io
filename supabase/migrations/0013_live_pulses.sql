-- Live in-lecture pulse questions.
--
-- A "pulse" is a single question pushed mid-lecture to keep the room paying
-- attention, answered on phones in under a minute, and graded. The authenticated
-- activity engine (activity_instances → student_attempts → student_responses) is
-- deliberately not reused here: it is built for a timed multi-question quiz with
-- attempt lifecycle, which is far too heavy for one 45-second question. These two
-- tables keep the hot path to a single insert.
--
-- Grading is hybrid: answering at all earns partial credit, answering correctly
-- earns full credit. The awarded points are ALSO written to participation_events,
-- so the existing gradebook participation category picks pulses up with no
-- gradebook changes at all.

create table if not exists public.pulse_rounds (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  -- Null for an ad-hoc question typed in the moment rather than drawn from a bank.
  question_id uuid references public.questions(id) on delete set null,
  -- The question is frozen at push time: editing the bank later must never change
  -- what a student was actually asked, or how it was graded.
  prompt_snapshot jsonb not null check (jsonb_typeof(prompt_snapshot) = 'object'),
  state text not null default 'open' check (state in ('open', 'revealed', 'closed')),
  points numeric not null default 1 check (points >= 0 and points <= 100),
  answer_points numeric not null default 0.5 check (answer_points >= 0 and answer_points <= 100),
  time_limit_seconds int not null default 60 check (time_limit_seconds between 10 and 900),
  opened_at timestamptz not null default now(),
  ends_at timestamptz not null,
  revealed_at timestamptz,
  closed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (answer_points <= points)
);

create table if not exists public.pulse_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.pulse_rounds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  option_key text not null check (length(option_key) between 1 and 40),
  is_correct boolean not null,
  points_awarded numeric not null default 0 check (points_awarded >= 0),
  latency_ms int check (latency_ms is null or latency_ms >= 0),
  answered_at timestamptz not null default now(),
  -- One answer per student per round, and no changing it afterwards.
  unique (round_id, profile_id)
);

create index if not exists pulse_rounds_session_idx
  on public.pulse_rounds (class_session_id, opened_at desc);
create index if not exists pulse_rounds_open_idx
  on public.pulse_rounds (class_session_id, state);
create index if not exists pulse_answers_round_idx
  on public.pulse_answers (round_id);
create index if not exists pulse_answers_profile_idx
  on public.pulse_answers (profile_id, answered_at desc);

-- QR join code for a class session. Students scan it once and land straight in
-- the live screen; the code is per-session so it cannot be reused next week.
alter table public.class_sessions add column if not exists join_code text;
create unique index if not exists class_sessions_join_code_key
  on public.class_sessions (join_code) where join_code is not null;

-- End-of-class written reflection bounds, configurable per session because a
-- short class may warrant a shorter paragraph.
alter table public.class_sessions
  add column if not exists reflection_min_words int not null default 50;
alter table public.class_sessions
  add column if not exists reflection_max_words int not null default 100;
alter table public.class_sessions
  add constraint class_sessions_reflection_words_check
  check (reflection_min_words >= 0 and reflection_max_words >= reflection_min_words);

-- Same posture as every other table: RLS on, no policies, so browsers get
-- nothing and only service-role edge functions can read or write.
alter table public.pulse_rounds enable row level security;
revoke all on public.pulse_rounds from anon, authenticated;
alter table public.pulse_answers enable row level security;
revoke all on public.pulse_answers from anon, authenticated;
