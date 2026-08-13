// Student sign-in: student ID + a PIN the student chooses.
//
// Every identity-proving route is closed to this course. Supabase's mailer is
// capped at 2 emails/hour; tec.mx publishes DMARC p=reject so no third party may
// send as a tec.mx address; Tec disabled app passwords, blocked app registration
// in their tenant, and requires admin approval before their users may use an
// outside app. None of that is ours to change, and a class meets next week.
//
// So the secret is chosen by the student and distributed by nobody. What it
// replaces is far worse: course-test-signin issues a session to anyone who knows
// a rostered email address, with no secret at all.
//
// No email is sent at any point. `generateLink` mints a one-time token for us to
// hand back directly — the same mechanism course-test-signin already uses, which
// is how 26 students signed in during the first real class without touching the
// mail cap.
//
// The guards that make a six-digit PIN defensible live in the database
// (migration 0051): identical errors for unknown student and wrong PIN so the
// endpoint cannot be used to enumerate student IDs, and a lockout after five
// wrong attempts so a million combinations cannot be walked through.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

type Db = ReturnType<typeof adminClient>;

class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

/** Database exception → what the student should be told, and by which name. */
const FAILURES: Record<string, { status: number; code: string; message: string }> = {
  pin_invalid: {
    status: 401,
    code: "pin_invalid",
    message: "That student ID and PIN do not match."
  },
  pin_locked: {
    status: 429,
    code: "pin_locked",
    message: "Too many wrong PINs. Wait 15 minutes, or ask your professor to reset it."
  },
  pin_not_set: {
    status: 409,
    code: "pin_not_set",
    message: "You have not set a PIN yet. Scan the class QR code to set one."
  },
  pin_already_set: {
    status: 409,
    code: "pin_already_set",
    message: "This student ID already has a PIN. Ask your professor to reset it."
  },
  pin_format: {
    status: 400,
    code: "pin_format",
    message: "Your PIN must be exactly 6 digits."
  },
  join_invalid: {
    status: 404,
    code: "join_invalid",
    message: "That class code is not valid."
  },
  join_not_live: {
    status: 409,
    code: "join_not_live",
    message: "You can only set your PIN during a live class. Ask your professor to start it."
  },
  student_unknown: {
    status: 404,
    code: "student_unknown",
    message: "That student ID is not on the course roster."
  },
  not_in_this_class: {
    status: 403,
    code: "not_in_this_class",
    message: "You are not enrolled in the group for this class."
  }
};

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const db = adminClient();

    if (body.action === "claim") {
      const result = await callPinRpc(db, "claim_student_pin", {
        p_course_id: courseId,
        p_student_identifier: cleanIdentifier(body.student_identifier),
        p_join_code: cleanJoinCode(body.join_code),
        p_pin: cleanPin(body.pin)
      });
      const otp = await issueOneTimeToken(db, result.institutional_email);
      await audit(db, courseId, result.profile_id, "student_pin_claimed", {
        note: "PIN set during a live class."
      });
      return json({ email: result.institutional_email, otp, claimed: true });
    }

    if (body.action === "signin") {
      const result = await callPinRpc(db, "verify_student_pin", {
        p_course_id: courseId,
        p_student_identifier: cleanIdentifier(body.student_identifier),
        p_pin: cleanPin(body.pin)
      });
      const otp = await issueOneTimeToken(db, result.institutional_email);
      return json({ email: result.institutional_email, otp, claimed: false });
    }

    throw new HttpError("Unknown action.", 400, "unknown_action");
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message, error_code: error.code }, { status: error.status });
    }
    // Never leak a raw database message to a student's phone.
    return json(
      { error: "Unable to sign you in. Try again.", error_code: "pin_unavailable" },
      { status: 400 }
    );
  }
});

/** RPC `result` codes → the failure the student is shown. */
const RESULTS: Record<string, keyof typeof FAILURES> = {
  invalid: "pin_invalid",
  locked: "pin_locked",
  not_set: "pin_not_set",
  pin_already_set: "pin_already_set",
  pin_format: "pin_format",
  join_invalid: "join_invalid",
  join_not_live: "join_not_live",
  student_unknown: "student_unknown",
  not_in_this_class: "not_in_this_class"
};

/**
 * The functions return a `result` rather than raising, and that is load-bearing
 * rather than stylistic: an exception aborts the transaction, so the earlier
 * version rolled back its own failed-attempt counter and the lockout never
 * armed. Migration 0052 has the full account.
 */
async function callPinRpc(
  db: Db,
  fn: string,
  args: Record<string, unknown>
): Promise<{ profile_id: string; institutional_email: string }> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const result = String(row?.result || "");

  if (result !== "ok") {
    const failure = FAILURES[RESULTS[result] || "pin_invalid"];
    throw new HttpError(failure.message, failure.status, failure.code);
  }
  if (!row?.institutional_email) {
    throw new HttpError("Unable to sign you in. Try again.", 400, "pin_unavailable");
  }
  return row;
}

/**
 * A real Supabase session, minted without sending anything. `generateLink`
 * produces the one-time token and hands it back rather than mailing it, which is
 * the entire reason this design escapes the 2/hour ceiling.
 */
async function issueOneTimeToken(db: Db, email: string): Promise<string> {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (!error && data?.properties?.email_otp) return data.properties.email_otp;

  const { error: createError } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (createError && !String(createError.message || "").toLowerCase().includes("already")) {
    throw createError;
  }
  const { data: retry, error: retryError } = await db.auth.admin.generateLink({
    type: "magiclink",
    email
  });
  if (retryError) throw retryError;
  if (!retry?.properties?.email_otp) {
    throw new HttpError("Unable to sign you in. Try again.", 400, "pin_unavailable");
  }
  return retry.properties.email_otp;
}

async function audit(
  db: Db,
  courseId: string,
  profileId: string,
  action: string,
  metadata: Record<string, unknown>
) {
  try {
    await db.from("audit_log").insert({
      course_id: courseId,
      actor_profile_id: profileId,
      target_type: "profile",
      target_id: profileId,
      action,
      metadata
    });
  } catch {
    // An audit failure must never stop a student getting into class.
  }
}

function cleanIdentifier(value: unknown): string {
  const text = String(value || "").trim();
  if (!text || text.length > 80) {
    throw new HttpError(
      FAILURES.pin_invalid.message,
      FAILURES.pin_invalid.status,
      FAILURES.pin_invalid.code
    );
  }
  return text;
}

function cleanPin(value: unknown): string {
  const text = String(value || "").trim();
  if (!/^[0-9]{6}$/.test(text)) {
    throw new HttpError(
      FAILURES.pin_format.message,
      FAILURES.pin_format.status,
      FAILURES.pin_format.code
    );
  }
  return text;
}

function cleanJoinCode(value: unknown): string {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    throw new HttpError(
      FAILURES.join_invalid.message,
      FAILURES.join_invalid.status,
      FAILURES.join_invalid.code
    );
  }
  return code;
}

function cleanCourseId(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);
}
