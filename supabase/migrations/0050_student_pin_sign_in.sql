-- Students sign in with their student ID and a PIN they choose themselves.
--
-- Why this exists: every identity-proving route is closed to this course.
-- Supabase's mailer is capped at 2/hour; tec.mx publishes DMARC p=reject so no
-- third party may send as a tec.mx address; Tec disabled app passwords, blocked
-- app registration in their tenant, and requires admin approval before their
-- users may use an outside app. Waiting on their IT is not a plan for a class
-- that meets next week.
--
-- So the secret becomes something the student chooses and nobody distributes.
-- What it replaces is far worse: today `course-test-signin` lets anyone who
-- knows a rostered email sign in as that person, with no secret at all.
--
-- The threat model, stated honestly. Student IDs are semi-public — they appear
-- on rosters and group chats — so the PIN is the whole secret, and six digits is
-- only a million combinations. That is safe only if guessing is throttled, which
-- is what pin_failed_attempts and pin_locked_until are for. Without them this
-- would be weaker than what it replaces, not stronger.
--
-- The first claim is the residual risk: whoever claims a student ID first sets
-- its PIN. It is bounded deliberately — a claim requires the join code of a
-- class that is live right now, so an impostor has to be in the room during
-- class, and the real student discovers it immediately and tells the professor,
-- who resets it. Detectable and reversible, which is the standard this course
-- needs; it is not the standard a bank needs.

alter table public.profiles
  -- bcrypt, via pgcrypto. Never the PIN itself.
  add column if not exists pin_hash text,
  add column if not exists pin_set_at timestamptz,
  add column if not exists pin_failed_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz;

comment on column public.profiles.pin_hash is
  'bcrypt hash of the student-chosen sign-in PIN. Null means unclaimed: the '
  'student may set one by scanning a live class QR code.';

-- Claiming and verifying both look a student up by this, so it must be fast and
-- case-insensitive: a student typing a00000001 means A00000001.
create unique index if not exists profiles_student_identifier_lower_idx
  on public.profiles (lower(student_identifier))
  where student_identifier is not null;
