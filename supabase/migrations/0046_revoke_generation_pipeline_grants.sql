-- Finish the lock on content_uploads and generation_jobs.
--
-- 0019 enabled RLS on both and said so in its own comment — "enabled, no
-- policies, so only service-role edge functions can touch these tables" — but
-- it never ran the paired revoke. Every other table in this schema gets both
-- statements together (0004 lines 175-195). These two got one.
--
-- The advisor did not flag them, and it was right not to: RLS is genuinely on,
-- the schema has zero policies, so anon reads return no rows and anon writes
-- are refused. No data is reachable. What the leftover grants change is the
-- answer PostgREST gives: these two respond 200 with an empty array where
-- every other table responds 401, which confirms the table exists and hands
-- back its column names on introspection. It also means a future migration
-- that adds even one permissive policy would open real rows immediately,
-- because the grant underneath it is already in place.
--
-- Revoking costs nothing today — anon can already read nothing — and removes
-- that standing hazard. Service role is unaffected, so the upload and
-- generation functions keep working unchanged.

revoke all on public.content_uploads from anon, authenticated;
revoke all on public.generation_jobs from anon, authenticated;
