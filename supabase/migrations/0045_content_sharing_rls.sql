-- Close the RLS hole on content_shares and content_versions.
--
-- 0032 added both tables but never locked them. Every other table in this
-- schema is closed the same way at birth (0004 lines 175-195): enable RLS,
-- then revoke the anon/authenticated grants. These two were the only ones
-- created without that pair, which is what Supabase's security advisor
-- flagged as rls_disabled_in_public.
--
-- The exposure is real, not theoretical. The anon key ships in a public
-- Jekyll site, PostgREST exposes the whole public schema, and an unlocked
-- table answers to it — so anyone with the project URL could read every
-- share grant and every version row, and could delete or forge them.
-- content_versions is the index of published-content backups; forged rows
-- there corrupt the rollback path that course-content-cleanup depends on.
--
-- Deny-all is the correct policy, not a placeholder. Nothing reaches either
-- table from the browser: course-content-library, course-content-sync, and
-- course-content-cleanup are the only readers and writers, and all three go
-- through adminClient() in functions/_shared/client.ts, which holds the
-- service-role key. Service role bypasses RLS and is unaffected by these
-- revokes, so this migration changes no working code path. A table with RLS
-- on and zero policies denies anon and authenticated outright, which is
-- exactly the posture the rest of the schema already has.

alter table public.content_shares enable row level security;
alter table public.content_versions enable row level security;

revoke all on public.content_shares from anon, authenticated;
revoke all on public.content_versions from anon, authenticated;
