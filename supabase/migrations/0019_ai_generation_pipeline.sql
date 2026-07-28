-- Phase 5: multi-professor AI pipeline. A professor uploads a PDF; a
-- background worker turns it into a deck + a bilingual, tiered question bank
-- automatically — nobody ever hand-types a quiz question, in this pipeline any
-- more than in the manual one. Nothing reaches students until the instructor
-- explicitly approves the generated bundle in the review screen.
--
-- Storage reuses the existing private 'course-content' bucket (zero RLS
-- policies, service-role only, same as every other object in it):
--   courses/{course_id}/uploads/{upload_id}/original.pdf
--   courses/{course_id}/items/{item_id}/deck.html   (unchanged from Phase 2)

create table if not exists public.content_uploads (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  storage_path text not null check (length(storage_path) between 1 and 500),
  original_filename text not null check (length(original_filename) between 1 and 300),
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null check (size_bytes > 0),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'done', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One resumable step per worker invocation, checkpointed in step_state so a
-- crashed or cold-started run picks up where it left off instead of
-- re-spending Claude API calls from scratch.
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  content_upload_id uuid not null references public.content_uploads(id) on delete cascade,
  status text not null default 'queued' check (status in (
    'queued', 'extracting', 'outlining', 'generating_deck', 'generating_questions',
    'assembling', 'ready_for_review', 'approved', 'failed'
  )),
  step_state jsonb not null default '{}'::jsonb,
  lecture_title text check (lecture_title is null or length(lecture_title) <= 180),
  lecture_slug text check (lecture_slug is null or length(lecture_slug) <= 160),
  content_item_id uuid references public.content_items(id) on delete set null,
  question_bank_id uuid references public.question_banks(id) on delete set null,
  error text,
  attempt_count int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generation_jobs_course_status_idx
  on public.generation_jobs (course_id, status);

-- Traceability: which questions/decks came from an AI job vs. the earlier
-- generate-offline-then-import flow. Nullable — existing rows are untouched.
alter table public.questions add column if not exists generation_job_id uuid
  references public.generation_jobs(id) on delete set null;
alter table public.question_banks add column if not exists generation_job_id uuid
  references public.generation_jobs(id) on delete set null;
alter table public.content_items add column if not exists generation_job_id uuid
  references public.generation_jobs(id) on delete set null;

-- RLS follows the platform's zero-policy stance: enabled, no policies, so only
-- service-role edge functions (course-content-upload, course-generation,
-- course-generation-worker) can touch these tables.
alter table public.content_uploads enable row level security;
alter table public.generation_jobs enable row level security;
