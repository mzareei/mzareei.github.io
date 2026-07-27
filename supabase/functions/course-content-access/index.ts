import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
import { mintContentToken } from "../_shared/content-token.ts";

type Db = ReturnType<typeof adminClient>;

const visibleContentStates = ["released", "live", "paused", "review_only", "scheduled"];
const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
// Long enough to read a deck without re-minting mid-lecture, short enough that a
// leaked link dies quickly. The viewer re-mints transparently on expiry.
const SIGNED_URL_SECONDS = 600;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (body.action !== "open_content" && body.action !== "request_url") {
      return json({ error: "Unknown action." }, { status: 400 });
    }

    const db = adminClient();
    const profile = await loadProfileForToken(db, token);
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const releaseId = cleanUuid(body.release_id, "release id");
    const access = await loadContentAccess(db, {
      courseId,
      releaseId,
      profileId: String(profile.id)
    });

    // request_url: after the same gate, mint a short-lived delivery URL for
    // storage-backed content. Delivery goes through course-content-serve (not a
    // storage signed URL, which downgrades HTML to text/plain on the shared
    // supabase.co domain). The bucket stays private with zero policies.
    if (body.action === "request_url") {
      if (access.content.source_kind !== "storage_object") {
        throw new Error("Access denied: this content is not stored on the platform.");
      }
      const token = await mintContentToken(String(access.content.source_ref), SIGNED_URL_SECONDS);
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      return json({
        ...access,
        url: `${supabaseUrl}/functions/v1/course-content-serve?t=${token}`,
        expires_in: SIGNED_URL_SECONDS
      });
    }

    return json(access);
  } catch (error) {
    const message = error.message || "Unable to open content.";
    if (message.includes("Access denied")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);
}

function cleanUuid(value: unknown, label: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`A valid ${label} is required.`);
  }
  return text;
}

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  await assertCourseEmailAllowed(db, userData.user.email || "");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Access denied: no active course profile is linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");
  return profile;
}

async function loadContentAccess(db: Db, input: {
  courseId: string;
  releaseId: string;
  profileId: string;
}) {
  const [sections, memberships, release] = await Promise.all([
    loadActiveSections(db, input.profileId),
    loadMemberships(db, input.courseId, input.profileId),
    loadRelease(db, input.courseId, input.releaseId)
  ]);

  const sectionIds = sections.map((section) => String(section.section_id));
  const isTeacher = memberships.some((membership) => teacherRoles.includes(String(membership.role)));
  assertReleaseVisible(release, sectionIds, isTeacher);

  const { data: item, error: itemError } = await db
    .from("content_items")
    .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, contains_sensitive_content, default_points")
    .eq("id", release.content_item_id)
    .eq("course_id", input.courseId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new Error("Access denied: released content was not found.");

  return {
    access: "granted",
    release: {
      release_id: release.id,
      state: effectiveReleaseState(release, new Date()),
      release_state: release.state,
      opens_at: release.opens_at,
      closes_at: release.closes_at
    },
    content: {
      id: item.id,
      content_type: item.content_type,
      slug: item.slug,
      title: item.title,
      summary: item.summary || "",
      source_kind: item.source_kind,
      source_ref: item.source_ref,
      contains_sensitive_content: item.contains_sensitive_content,
      default_points: item.default_points
    }
  };
}

async function loadActiveSections(db: Db, profileId: string) {
  const { data, error } = await db
    .from("section_enrollments")
    .select("section_id, role, status")
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (error) throw error;
  return data || [];
}

async function loadMemberships(db: Db, courseId: string, profileId: string) {
  const { data, error } = await db
    .from("course_memberships")
    .select("course_id, role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (error) throw error;
  return data || [];
}

async function loadRelease(db: Db, courseId: string, releaseId: string) {
  const { data, error } = await db
    .from("content_releases")
    .select("id, content_item_id, course_id, section_id, class_session_id, state, opens_at, closes_at, review_opens_at, review_closes_at")
    .eq("id", releaseId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Access denied: content release was not found.");
  return data;
}

function assertReleaseVisible(release: Record<string, unknown>, sectionIds: string[], isTeacher: boolean) {
  if (!visibleContentStates.includes(String(release.state))) {
    throw new Error("Access denied: this content is not released.");
  }

  const sectionAllowed = isTeacher || !release.section_id || sectionIds.includes(String(release.section_id));
  if (!sectionAllowed) {
    throw new Error("Access denied: this content is not released for your section.");
  }

  const now = new Date();
  if (String(release.state) === "scheduled" && !isScheduledOpen(release, now)) {
    throw new Error("Access denied: scheduled release is not open yet.");
  }
  if (release.opens_at && new Date(String(release.opens_at)) > now) {
    throw new Error("Access denied: this content is not open yet.");
  }
  if (release.closes_at && new Date(String(release.closes_at)) < now && String(release.state) !== "review_only") {
    throw new Error("Access denied: this content is closed.");
  }
}

function isScheduledOpen(release: Record<string, unknown>, now: Date) {
  return String(release.state) === "scheduled" && Boolean(release.opens_at) && new Date(String(release.opens_at)) <= now;
}

function effectiveReleaseState(release: Record<string, unknown>, now: Date) {
  return isScheduledOpen(release, now) ? "released" : String(release.state);
}
