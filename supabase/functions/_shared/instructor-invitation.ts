import { adminClient } from "./client.ts";

type Db = ReturnType<typeof adminClient>;

const defaultAppUrl = "https://course-platform-3ko.pages.dev/";

function appRedirectUrl() {
  const configured = String(Deno.env.get("COURSE_APP_URL") || defaultAppUrl).trim();
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return defaultAppUrl;
    url.search = "";
    url.hash = "";
    return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch {
    return defaultAppUrl;
  }
}

/**
 * Supabase roster rows are not Auth users, so adding an instructor alone does
 * not send anything. Send the first-use invite; if Auth already has the
 * address, fall back to the same magic-link email used by the sign-in screen.
 */
export async function sendInstructorInvitation(db: Db, email: string) {
  const redirectTo = appRedirectUrl();
  const { error: inviteError } = await db.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!inviteError) return { sent: true, method: "invitation" as const };

  // Auth returns an "already registered" error when a person previously
  // signed in. They still need a fresh link when an instructor is re-added.
  if (!/already registered|already exists|user.*exists|email.*exists/i.test(String(inviteError.message || ""))) {
    console.error("Instructor invitation email failed.", inviteError.message || "unknown error");
    return { sent: false, method: null };
  }

  const { error: otpError } = await db.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo }
  });
  if (!otpError) return { sent: true, method: "magic_link" as const };
  console.error("Instructor magic-link email failed.", otpError.message || "unknown error");
  return { sent: false, method: null };
}
