// Remove the public-site navigation from a stored deck, one content item per
// call, and keep a rollback copy of what was there before.
//
// Why this exists: Phase 2 deliberately rewrote every relative link in a deck
// or mission to an absolute public URL so cross-navigation would keep working
// while the public copies still existed. That was correct then. It means every
// object in the private bucket carries hard links to the public site — nine of
// the twelve missions link to the public copy of their own lecture — so a
// student inside /content?t=… is one click outside the gate. The public tree
// is being retired, which turns those links into 404s from inside the bucket
// as well.
//
// Actions:
//   preview  { content_item_id? } -> { items: [...] }
//     Counts surviving public references per item and reports what a clean
//     would change. Writes nothing, anywhere. Safe during class.
//   clean    { content_item_id }  -> { item, version, references_removed }
//     Cleans exactly one item.
//
// ORDERING — the whole safety story. Postgres and Storage do not share a
// transaction, so the sequence is chosen so every possible failure leaves
// something harmless:
//
//   read → transform → verify → back up the OLD bytes → record the version
//   → overwrite the live object
//
//   fail during read/transform/verify : nothing written at all
//   fail during backup                : live object untouched
//   fail during the version insert    : orphan backup file, live object intact
//   fail during the overwrite         : backup and record both describe the
//                                       bytes that are still live; retry safe
//
// The forbidden order is overwrite-then-back-up: any failure there loses the
// only copy of the previous deck.
//
// One item per call, deliberately. A loop over 23 decks in one invocation is
// one timeout away from a partial sweep with no record of where it stopped.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import {
  extractTeachingSlides,
  removeLegacyDeckNavigation,
  removeLegacyDeckScriptNavigation
} from "../_shared/checkpoint-deck.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const bucket = "course-content";
const publicOriginPattern = /https?:\/\/mzareei\.github\.io[^"'\s)]*/g;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const db = adminClient();
    const { profile, isGlobalOwner } = await requireInstructor(db, token, courseId);

    if (body.action === "preview") {
      return json(await preview(db, courseId, {
        contentItemId: cleanOptionalUuid(body.content_item_id),
        profileId: String(profile.id),
        isGlobalOwner
      }));
    }

    if (body.action === "clean") {
      const contentItemId = cleanOptionalUuid(body.content_item_id);
      if (!contentItemId) throw new Error("A content item id is required.");
      return json(await cleanOne(db, courseId, {
        contentItemId,
        profileId: String(profile.id),
        isGlobalOwner,
        note: String(body.note || "").trim().slice(0, 1000) || null
      }));
    }

    return json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error.message || "Unable to clean content.";
    if (message === "content_item_not_owned") {
      return json({ error: message, error_code: "content_item_not_owned" }, { status: 403 });
    }
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function cleanOptionalUuid(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("A valid content item id is required.");
  }
  return text;
}

async function requireInstructor(db: Db, token: string, courseId: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Content cleanup is not allowed without an active course profile.");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("role")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active");
  if (membershipError) throw membershipError;
  const roles = (memberships || []).map((m) => String(m.role));
  if (!roles.some((role) => instructorRoles.includes(role))) {
    throw new Error("Content cleanup is not allowed for this role.");
  }
  return { profile, isGlobalOwner: roles.includes("platform_owner") };
}

/** Cleanup is a write, so it follows the same ownership rule as every other
 *  content write. A null owner is unowned legacy content and stays writable
 *  until the ownership backfill runs — see course-content-library. */
function assertOwned(
  item: { owner_profile_id?: string | null },
  permissions: { profileId: string; isGlobalOwner: boolean }
) {
  if (permissions.isGlobalOwner) return;
  if (item.owner_profile_id == null) return;
  if (String(item.owner_profile_id) === String(permissions.profileId)) return;
  throw new Error("content_item_not_owned");
}

async function loadStorageItems(db: Db, courseId: string, contentItemId: string) {
  let query = db
    .from("content_items")
    .select("id, slug, title, content_type, source_kind, source_ref, owner_profile_id")
    .eq("course_id", courseId)
    .eq("source_kind", "storage_object")
    .order("slug", { ascending: true });
  if (contentItemId) query = query.eq("id", contentItemId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function downloadText(db: Db, storagePath: string) {
  const { data, error } = await db.storage.from(bucket).download(storagePath);
  if (error) throw error;
  return await data.text();
}

function publicReferences(html: string) {
  return html.match(publicOriginPattern) || [];
}

/** Dry run. Reads storage, writes nothing, and reports what would change. */
async function preview(db: Db, courseId: string, input: {
  contentItemId: string;
  profileId: string;
  isGlobalOwner: boolean;
}) {
  const items = await loadStorageItems(db, courseId, input.contentItemId);
  const report = [];
  for (const item of items) {
    // A preview the caller may not act on is misleading, so skip what they
    // could not clean anyway rather than reporting work they cannot do.
    let owned = true;
    try {
      assertOwned(item, input);
    } catch {
      owned = false;
    }
    if (!owned) continue;

    let before: string[] = [];
    let after: string[] = [];
    let readError: string | null = null;
    try {
      const html = await downloadText(db, String(item.source_ref));
      before = publicReferences(html);
      after = publicReferences(
        removeLegacyDeckScriptNavigation(removeLegacyDeckNavigation(html))
      );
    } catch (error) {
      readError = error.message || "Could not read the stored file.";
    }
    report.push({
      content_item_id: item.id,
      slug: item.slug,
      title: item.title,
      content_type: item.content_type,
      storage_path: item.source_ref,
      public_references: before.length,
      public_references_after: after.length,
      would_change: before.length > after.length,
      still_public_after: Array.from(new Set(after)).slice(0, 10),
      error: readError
    });
  }
  return { items: report };
}

async function nextVersionNumber(db: Db, contentItemId: string) {
  const { data, error } = await db
    .from("content_versions")
    .select("version")
    .eq("content_item_id", contentItemId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.version || 0) + 1;
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function cleanOne(db: Db, courseId: string, input: {
  contentItemId: string;
  profileId: string;
  isGlobalOwner: boolean;
  note: string | null;
}) {
  const [item] = await loadStorageItems(db, courseId, input.contentItemId);
  if (!item) throw new Error("That content item is not a stored file in this course.");
  assertOwned(item, input);

  const storagePath = String(item.source_ref);

  // ---- every fallible read and pure step first -----------------------------
  const original = await downloadText(db, storagePath);
  const before = publicReferences(original);
  if (!before.length) {
    return { item, version: null, references_removed: 0, already_clean: true };
  }

  const cleaned = removeLegacyDeckScriptNavigation(removeLegacyDeckNavigation(original));

  const after = publicReferences(cleaned);
  if (after.length) {
    throw new Error(
      `The cleaned deck still contains ${after.length} public reference(s): `
      + `${Array.from(new Set(after)).slice(0, 3).join(", ")}. Nothing was written.`
    );
  }

  // A cleanup that changes the teaching content is not a cleanup. Compare the
  // slides before and after and refuse rather than upload a deck that drifted.
  const slidesBefore = extractTeachingSlides(original);
  const slidesAfter = extractTeachingSlides(cleaned);
  if (slidesBefore.length !== slidesAfter.length) {
    throw new Error("The cleanup changed the number of teaching slides. Nothing was written.");
  }
  for (let index = 0; index < slidesBefore.length; index += 1) {
    if (slidesBefore[index].text !== slidesAfter[index].text) {
      throw new Error(
        `The cleanup changed the text of teaching slide ${index + 1}. Nothing was written.`
      );
    }
  }

  const originalSha = await sha256Hex(original);
  const version = await nextVersionNumber(db, String(item.id));

  // ---- writes, in the only safe order --------------------------------------
  // 1. Back up the bytes that are live right now.
  const backupPath = `${storagePath.replace(/\/[^/]+$/, "")}/.versions/${version}-${originalSha.slice(0, 8)}.html`;
  const { error: backupError } = await db.storage
    .from(bucket)
    .upload(backupPath, new Blob([original], { type: "text/html; charset=utf-8" }), {
      contentType: "text/html; charset=utf-8",
      upsert: true
    });
  if (backupError) throw backupError;

  // 2. Record what that backup is, before the live object changes. If this
  //    fails we have an orphan file and an untouched deck — both harmless.
  const { data: versionRow, error: versionError } = await db
    .from("content_versions")
    .insert({
      content_item_id: item.id,
      version,
      storage_path: backupPath,
      content_sha256: originalSha,
      content_bytes: new TextEncoder().encode(original).length,
      published_by: input.profileId,
      published_from: "cli",
      note: input.note || `Pre-cleanup snapshot: ${before.length} public reference(s) removed.`
    })
    .select("id, version, storage_path, content_sha256")
    .single();
  if (versionError) throw versionError;

  // 3. Only now overwrite the live object, at the same path — source_ref
  //    points at it and the gated chain resolves it, so the path never moves.
  const { error: uploadError } = await db.storage
    .from(bucket)
    .upload(storagePath, new Blob([cleaned], { type: "text/html; charset=utf-8" }), {
      contentType: "text/html; charset=utf-8",
      upsert: true
    });
  if (uploadError) throw uploadError;

  await db.from("content_items").update({ updated_at: new Date().toISOString() }).eq("id", item.id);

  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: input.profileId,
    target_type: "content_item",
    target_id: item.id,
    action: "content_public_links_removed",
    metadata: {
      slug: item.slug,
      storage_path: storagePath,
      backup_path: backupPath,
      version,
      references_removed: before.length
    }
  });

  return {
    item: { id: item.id, slug: item.slug, title: item.title },
    version: versionRow,
    references_removed: before.length,
    already_clean: false
  };
}
