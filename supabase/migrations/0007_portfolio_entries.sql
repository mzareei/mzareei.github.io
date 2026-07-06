create extension if not exists pgcrypto;

create table if not exists public.portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  gradebook_category_id uuid references public.gradebook_categories(id) on delete set null,
  entry_type text not null check (entry_type in ('mission_evidence', 'case_file', 'reflection', 'project_artifact', 'review_plan', 'other')),
  entry_json jsonb not null default '{}'::jsonb check (jsonb_typeof(entry_json) = 'object'),
  visibility text not null default 'student_teacher' check (visibility in ('private', 'student_teacher', 'section_showcase')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_entries_profile_created_idx
on public.portfolio_entries(profile_id, course_id, created_at desc);

create index if not exists portfolio_entries_section_category_idx
on public.portfolio_entries(section_id, gradebook_category_id, created_at desc);

create index if not exists portfolio_entries_content_idx
on public.portfolio_entries(content_item_id)
where content_item_id is not null;

alter table public.portfolio_entries enable row level security;

revoke all on public.portfolio_entries from anon, authenticated;
