// Instructor-only writes into the private course-content bucket.
//
// Actions:
//   create_upload_url  { slug, filename }  -> { path, token, signed_url }
//     Mints a one-time signed upload URL for
//     courses/<course_id>/items/<slug>/<filename>. The browser (or a local
//     migration script) PUTs the file there directly; the service key never
//     leaves the function.
//   register_item      { slug, title, summary?, content_type, storage_path,
//                        default_points?, contains_sensitive_content? }
//     -> { item }
//     Upserts the content item pointing at the uploaded object
//     (source_kind = 'storage_object'). Releases are managed separately by
//     course-content-library / course-release-management, unchanged.
//
//   create_upload      { filename, size_bytes }  -> { upload_id, path, token, signed_url }
//     Phase 5 AI pipeline: mints a signed upload URL for a source PDF at
//     courses/<course_id>/uploads/<upload_id>/original.pdf and records a
//     content_uploads row. The deck/questions don't exist yet — that's
//     course-generation's job once this file has actually landed.
//   confirm_upload     { upload_id }  -> { upload }
//     Verifies the PDF actually landed in storage (size, extension) and
//     flips content_uploads to 'uploaded' so a generation job can start.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const bucket = "course-content";
const contentTypes = ["lecture", "mission", "quiz_bank", "activity", "exit_ticket", "portfolio", "resource", "case_file"];
const allowedExtensions = [".html", ".pdf", ".png", ".jpg", ".jpeg", ".svg", ".css", ".js", ".json"];
const maxSlugLength = 120;
const maxPdfBytes = 40 * 1024 * 1024; // 40MB — generous for a ~80-page slide-style PDF

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const db = adminClient();
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const profile = await requireInstructor(db, token, courseId);

    if (body.action === "create_upload_url") {
      const slug = cleanSlug(body.slug);
      const filename = cleanFilename(body.filename);
      // A signed upload URL is a write, and it is minted with upsert enabled.
      // Scoping only the library would leave the storage object itself wide
      // open: any course instructor could overwrite any other's deck by slug.
      await assertSlugWritable(db, courseId, slug, String(profile.id));
      const path = `courses/${courseId}/items/${slug}/${filename}`;
      const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path, { upsert: true });
      if (error) throw error;
      return json({ path, token: data.token, signed_url: data.signedUrl });
    }

    if (body.action === "register_item") {
      const item = await registerItem(db, courseId, String(profile.id), body);
      return json({ item });
    }

    if (body.action === "create_upload") {
      return json(await createPdfUpload(db, courseId, String(profile.id), body));
    }

    if (body.action === "confirm_upload") {
      return json(await confirmPdfUpload(db, courseId, body));
    }

    return json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error.message || "Unable to manage content uploads.";
    if (message === "content_upload_not_owned") {
      return json({ error: message, error_code: "content_upload_not_owned" }, { status: 403 });
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
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);
}

function cleanSlug(value: unknown) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxSlugLength);
  if (slug.length < 2) throw new Error("A valid content slug is required.");
  return slug;
}

function mimeForFilename(filename: string) {
  if (filename.endsWith(".html")) return "text/html; charset=utf-8";
  if (filename.endsWith(".pdf")) return "application/pdf";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".svg")) return "image/svg+xml";
  if (filename.endsWith(".css")) return "text/css; charset=utf-8";
  if (filename.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filename.endsWith(".json")) return "application/json";
  return "";
}

function cleanFilename(value: unknown) {
  const filename = String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (!filename || filename.includes("..")) throw new Error("A valid filename is required.");
  if (!allowedExtensions.some((ext) => filename.endsWith(ext))) {
    throw new Error(`The filename must end with one of: ${allowedExtensions.join(", ")}.`);
  }
  return filename;
}

async function requireInstructor(db: Db, token: string, courseId: string) {
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
  if (!profile) throw new Error("Content uploads are not allowed without an active course profile.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active");
  if (membershipError) throw membershipError;
  const isInstructor = (memberships || []).some((m) => instructorRoles.includes(String(m.role)));
  if (!isInstructor) throw new Error("Content uploads are not allowed for this role.");
  return profile;
}

// Requirement 7. Writing to a slug means writing to whatever content item owns
// it. An unowned item stays writable by any course instructor until the
// ownership backfill runs — see course-content-library for why that fail-open
// is load-bearing rather than defensive.
async function assertSlugWritable(db: Db, courseId: string, slug: string, actorProfileId: string) {
  const [{ data: existing, error }, { data: memberships, error: membershipError }] = await Promise.all([
    db
      .from("content_items")
      .select("id, owner_profile_id")
      .eq("course_id", courseId)
      .eq("slug", slug)
      .maybeSingle(),
    db
      .from("course_memberships")
      .select("role")
      .eq("course_id", courseId)
      .eq("profile_id", actorProfileId)
      .eq("status", "active")
  ]);
  if (error) throw error;
  if (membershipError) throw membershipError;
  if ((memberships || []).some((m) => String(m.role) === "platform_owner")) return;
  if (!existing) return;
  if (existing.owner_profile_id == null) return;
  if (String(existing.owner_profile_id) === String(actorProfileId)) return;
  throw new Error("content_upload_not_owned");
}

async function createPdfUpload(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const originalFilename = String(body.filename || "").trim().slice(0, 300);
  if (!originalFilename.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files can be uploaded for AI generation.");
  }
  const { data: uploadRow, error: insertError } = await db
    .from("content_uploads")
    .insert({
      course_id: courseId,
      uploaded_by: actorProfileId,
      storage_path: "pending",
      original_filename: originalFilename || "lecture.pdf",
      mime_type: "application/pdf",
      size_bytes: 1,
      status: "uploaded"
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const path = `courses/${courseId}/uploads/${uploadRow.id}/original.pdf`;
  const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;

  const { error: updateError } = await db
    .from("content_uploads")
    .update({ storage_path: path })
    .eq("id", uploadRow.id);
  if (updateError) throw updateError;

  return { upload_id: uploadRow.id, path, token: data.token, signed_url: data.signedUrl };
}

async function confirmPdfUpload(db: Db, courseId: string, body: Record<string, unknown>) {
  const uploadId = String(body.upload_id || "").trim();
  if (!uploadId) throw new Error("An upload id is required.");

  const { data: uploadRow, error: loadError } = await db
    .from("content_uploads")
    .select("id, course_id, storage_path")
    .eq("id", uploadId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!uploadRow) throw new Error("That upload was not found.");

  const dir = `courses/${courseId}/uploads/${uploadId}`;
  const { data: objects, error: listError } = await db.storage.from(bucket).list(dir);
  if (listError) throw listError;
  const object = (objects || []).find((entry) => entry.name === "original.pdf");
  if (!object) throw new Error("The PDF was not found in storage. Upload it first.");

  const sizeBytes = Number(object.metadata?.size || 0);
  if (!sizeBytes) throw new Error("The uploaded file appears to be empty.");
  if (sizeBytes > maxPdfBytes) {
    throw new Error(`That PDF is too large (max ${Math.round(maxPdfBytes / (1024 * 1024))}MB).`);
  }

  const { data: updated, error: updateError } = await db
    .from("content_uploads")
    .update({ size_bytes: sizeBytes, status: "uploaded", updated_at: new Date().toISOString() })
    .eq("id", uploadId)
    .select("id, storage_path, original_filename, size_bytes, status")
    .single();
  if (updateError) throw updateError;
  return { upload: updated };
}

async function registerItem(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const slug = cleanSlug(body.slug);
  const title = String(body.title || "").trim().slice(0, 200);
  if (title.length < 2) throw new Error("A content title is required.");
  const contentType = String(body.content_type || "").trim();
  if (!contentTypes.includes(contentType)) {
    throw new Error(`A valid content type is required (${contentTypes.join(", ")}).`);
  }
  await assertSlugWritable(db, courseId, slug, actorProfileId);
  const storagePath = String(body.storage_path || "").trim();
  const expectedPrefix = `courses/${courseId}/items/${slug}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new Error("The storage path must belong to this course and slug.");
  }

  // The object must exist before the item can point at it.
  const { data: objects, error: listError } = await db.storage
    .from(bucket)
    .list(expectedPrefix.replace(/\/$/, ""));
  if (listError) throw listError;
  const objectName = storagePath.slice(expectedPrefix.length);
  const uploaded = (objects || []).find((object) => object.name === objectName);
  if (!uploaded) {
    throw new Error("The uploaded file was not found in storage. Upload it first.");
  }

  // Signed-upload PUTs don't reliably record the mimetype (and upserts never
  // update it), so a deck could be served as text/plain and render blank in the
  // viewer. Normalize it here: if the stored type disagrees with the extension,
  // re-write the object with the correct contentType via the service role.
  const expectedMime = mimeForFilename(objectName);
  const storedMime = String(uploaded.metadata?.mimetype || "");
  if (expectedMime && storedMime !== expectedMime) {
    const { data: blob, error: downloadError } = await db.storage.from(bucket).download(storagePath);
    if (downloadError) throw downloadError;
    const { error: rewriteError } = await db.storage
      .from(bucket)
      .upload(storagePath, blob, { contentType: expectedMime, upsert: true });
    if (rewriteError) throw rewriteError;
  }

  const defaultPoints = Number.isFinite(Number(body.default_points)) ? Math.max(0, Number(body.default_points)) : 0;
  const { data: item, error: upsertError } = await db
    .from("content_items")
    .upsert(
      {
        course_id: courseId,
        slug,
        title,
        summary: String(body.summary || "").trim().slice(0, 500) || null,
        content_type: contentType,
        source_kind: "storage_object",
        source_ref: storagePath,
        contains_sensitive_content: Boolean(body.contains_sensitive_content),
        default_points: defaultPoints,
        owner_profile_id: actorProfileId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "course_id,slug" }
    )
    .select("id, course_id, slug, title, summary, content_type, source_kind, source_ref, default_points")
    .maybeSingle();
  if (upsertError) throw upsertError;

  const { error: auditError } = await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "content_item",
    target_id: item?.id || null,
    action: "content_uploaded",
    metadata: { slug, storage_path: storagePath, content_type: contentType }
  });
  if (auditError) throw auditError;

  return item;
}
