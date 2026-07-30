-- pgcrypto is installed in Supabase's extensions schema. The atomic starter
-- uses gen_random_bytes when a legacy session has no join code, so its secured
-- search path must include that trusted schema.
alter function public.start_class_session_atomic(uuid, text, uuid)
  set search_path = public, extensions;
