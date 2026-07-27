import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = serviceRoleKey();
  if (!url || !serviceKey) {
    throw new Error("Supabase service credentials are not configured.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
}

export function assertTeacherPin(pin: unknown) {
  const expected = Deno.env.get("QUIZ_TEACHER_PIN");
  if (!expected) {
    throw new Error("QUIZ_TEACHER_PIN is not configured.");
  }
  if (String(pin || "") !== expected) {
    throw new Error("Invalid teacher PIN.");
  }
}

export function serviceRoleKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      return JSON.parse(secretKeys).default;
    } catch (_error) {
      // Fall back to the legacy default below.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}
