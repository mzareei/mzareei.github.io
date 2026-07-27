// Test sign-in: issues a session for a rostered address without sending a verification
// email, so the course team can test without hitting Supabase's built-in SMTP rate limit.
//
// While enabled, ANY caller who knows a rostered address can sign in as that person. It is
// a testing mode, not a login method. Four rails keep it from becoming permanent:
//
//   1. It is off unless COURSE_TEST_SIGNIN_UNTIL is set to a future date, so it expires
//      by itself rather than depending on anyone remembering.
//   2. Only addresses already on the roster, with an active membership, are accepted.
//   3. Instructor and platform_owner accounts are refused, so the accounts that can change
//      releases and grades always require a real verification email.
//   4. Every issued session is written to the audit log.
//
// The session itself is a genuine Supabase session: the admin API generates a one-time
// token that is verified in the browser, so nothing downstream treats it differently.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

const blockedRoles = ["instructor", "platform_owner"];
const enabledUntilEnvVar = "COURSE_TEST_SIGNIN_UNTIL";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const window = testSignInWindow();
    if (!window.enabled) {
      return json({ error: window.reason, enabled: false }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.action === "status") {
      return json({ enabled: true, enabled_until: window.until });
    }

    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const email = cleanEmail(body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "A valid email address is required." }, { status: 400 });
    }

    const db = adminClient();
    const { profile, roles } = await requireRosteredNonInstructor(db, courseId, email);
    const otp = await issueOneTimeToken(db, email);

    await db.from("audit_log").insert({
      course_id: courseId,
      actor_profile_id: profile.id,
      target_type: "profile",
      target_id: profile.id,
      action: "test_signin_issued",
      metadata: {
        email,
        roles,
        enabled_until: window.until,
        note: "Session issued without email verification while test sign-in was enabled."
      }
    });

    return json({ email, otp, enabled_until: window.until });
  } catch (error) {
    const message = error.message || "Unable to complete test sign-in.";
    const status = message.includes("not allowed") || message.includes("refused") ? 403 : 400;
    return json({ error: message }, { status });
  }
});

// Enabled only while COURSE_TEST_SIGNIN_UNTIL names a future date, so the mode lapses on
// its own. A missing or malformed value leaves it off.
function testSignInWindow() {
  let raw = "";
  try {
    raw = Deno.env.get(enabledUntilEnvVar) || "";
  } catch {
    raw = "";
  }
  const value = raw.trim();
  if (!value) {
    return { enabled: false, reason: "Test sign-in is not enabled for this course.", until: "" };
  }

  const until = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59Z` : value);
  if (Number.isNaN(until.getTime())) {
    return { enabled: false, reason: "Test sign-in is not enabled for this course.", until: "" };
  }
  if (until.getTime() <= Date.now()) {
    return { enabled: false, reason: "Test sign-in expired. Use the emailed sign-in link.", until: until.toISOString() };
  }
  return { enabled: true, reason: "", until: until.toISOString() };
}

async function requireRosteredNonInstructor(db: ReturnType<typeof adminClient>, courseId: string, email: string) {
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, institutional_email, full_name, status")
    .eq("institutional_email", email)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !["invited", "active"].includes(profile.status)) {
    throw new Error("That address is not on the course roster.");
  }

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active");
  if (membershipError) throw membershipError;

  const roles = (memberships || []).map((membership) => String(membership.role));
  if (!roles.length) throw new Error("That address is not enrolled in this course.");
  if (roles.some((role) => blockedRoles.includes(role))) {
    throw new Error("Test sign-in is refused for instructor accounts. Use the emailed sign-in link.");
  }

  return { profile, roles };
}

// generateLink creates a token without sending mail, which is the whole point here. The
// auth user is created first when the person has never signed in.
async function issueOneTimeToken(db: ReturnType<typeof adminClient>, email: string) {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (!error && data?.properties?.email_otp) return data.properties.email_otp;

  const { error: createError } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (createError && !String(createError.message || "").toLowerCase().includes("already")) {
    throw createError;
  }

  const { data: retry, error: retryError } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (retryError) throw retryError;
  if (!retry?.properties?.email_otp) throw new Error("Unable to issue a sign-in token.");
  return retry.properties.email_otp;
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanCourseId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);
}
