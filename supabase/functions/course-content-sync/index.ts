// Instructor-only sync from the private mzareei/course-content repository.
//
// The browser supplies only the instructor's normal Supabase JWT. GitHub
// access stays here, behind COURSE_CONTENT_GITHUB_TOKEN, and this function
// never changes content_releases: publishing content and releasing it to
// students remain separate actions.
import { createHash } from "node:crypto";
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;
type Profile = { id: string; auth_user_id: string; institutional_email: string; full_name: string; status: string };
type Permissions = { isPlatformOwner: boolean };

const githubRepo = "https://api.github.com/repos/mzareei/course-content";
const githubBranch = "main";
const bucket = "course-content";
const courseDirectories: Record<string, string> = {
  tc2007b: "courses/tc2007b-information-security"
};
const allowedExternalHosts = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
const forbiddenHosts = new Set(["mzareei.github.io"]);
const contentTypes = new Set(["lecture", "mission", "quiz_bank", "activity", "exit_ticket", "portfolio", "resource", "case_file"]);
const githubHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "course-platform-content-sync"
};

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (body.action !== "sync") return json({ error: "The sync action is required." }, { status: 400 });

    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const courseDirectory = courseDirectories[courseId];
    if (!courseDirectory) return json({ error: "That course is not configured for repository sync." }, { status: 400 });

    const db = adminClient();
    const { profile, permissions } = await requireInstructor(db, token, courseId);
    const contentItemId = cleanUuid(body.content_item_id, "A valid content item id is required.");
    const result = await syncItem(db, courseId, courseDirectory, contentItemId, String(profile.id), permissions);
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync content from the repository.";
    if (message === "content_item_not_owned") return json({ error: message, error_code: message }, { status: 403 });
    if (message === "course_content_repository_not_configured") {
      return json({ error: "Repository sync is not configured yet.", error_code: message }, { status: 503 });
    }
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

async function syncItem(
  db: Db,
  courseId: string,
  courseDirectory: string,
  contentItemId: string,
  actorProfileId: string,
  permissions: Permissions
) {
  const githubToken = Deno.env.get("COURSE_CONTENT_GITHUB_TOKEN") || "";
  if (!githubToken) throw new Error("course_content_repository_not_configured");

  const { data: item, error: itemError } = await db
    .from("content_items")
    .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, contains_sensitive_content, default_points, owner_profile_id")
    .eq("id", contentItemId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new Error("That content item is not part of this course.");
  if (!permissions.isPlatformOwner && item.owner_profile_id != null && String(item.owner_profile_id) !== actorProfileId) {
    throw new Error("content_item_not_owned");
  }
  if (item.source_kind !== "storage_object") throw new Error("Only storage-backed content can sync from the repository.");

  const ref = await githubJson(`${githubRepo}/git/ref/heads/${githubBranch}`, githubToken);
  const sourceCommit = String(ref.object?.sha || "");
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) throw new Error("The repository branch did not return a valid commit.");

  const treeResponse = await githubJson(`${githubRepo}/git/trees/${sourceCommit}?recursive=1`, githubToken);
  if (treeResponse.truncated) throw new Error("The repository tree is too large to sync safely.");
  const itemDirectory = `${courseDirectory}/content/${item.slug}`;
  const metadataPath = `${itemDirectory}/content.json`;
  const metadataEntry = findTreeEntry(treeResponse.tree, metadataPath);
  const metadata = JSON.parse(await readBlob(metadataEntry.sha, githubToken));
  validateMetadata(metadata, item);

  const entry = cleanEntry(metadata.entry || "index.html");
  const artifactEntry = findTreeEntry(treeResponse.tree, `${itemDirectory}/${entry}`);
  const html = await readBlob(artifactEntry.sha, githubToken);
  if (html.length > 5 * 1024 * 1024) throw new Error("The repository artifact is too large to sync.");
  validateArtifact(html, metadata);

  const contentSha = createHash("sha256").update(html).digest("hex");
  const { data: latestVersion, error: versionError } = await db
    .from("content_versions")
    .select("version, content_sha256")
    .eq("content_item_id", item.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw versionError;

  const current = await downloadStorage(db, String(item.source_ref));
  const currentSha = current ? createHash("sha256").update(current).digest("hex") : "";
  if (currentSha === contentSha || latestVersion?.content_sha256 === contentSha) {
    return {
      status: "unchanged",
      slug: item.slug,
      source_commit: sourceCommit,
      content_sha256: contentSha,
      version: Number(latestVersion?.version || 0)
    };
  }

  const version = Number(latestVersion?.version || 0) + 1;
  const versionPath = versionCopyPath(String(item.source_ref), version);
  const artifactBlob = new Blob([html], { type: "text/html; charset=utf-8" });
  const { error: versionUploadError } = await db.storage.from(bucket).upload(versionPath, artifactBlob, {
    contentType: "text/html; charset=utf-8",
    upsert: true
  });
  if (versionUploadError) throw versionUploadError;

  const { error: liveUploadError } = await db.storage.from(bucket).upload(String(item.source_ref), artifactBlob, {
    contentType: "text/html; charset=utf-8",
    upsert: true
  });
  if (liveUploadError) throw liveUploadError;

  const summary = String(metadata.summary?.en || "").trim() || null;
  const { data: updatedItem, error: updateError } = await db
    .from("content_items")
    .update({
      title: String(metadata.title.en).trim(),
      summary,
      content_type: metadata.content_type,
      default_points: Number.isFinite(Number(metadata.default_points)) ? Math.max(0, Number(metadata.default_points)) : 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", item.id)
    .eq("course_id", courseId)
    .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, default_points, updated_at")
    .single();
  if (updateError) throw updateError;

  const { error: versionInsertError } = await db.from("content_versions").insert({
    content_item_id: item.id,
    version,
    storage_path: versionPath,
    content_sha256: contentSha,
    content_bytes: html.length,
    published_by: actorProfileId,
    published_from: "github_action",
    source_commit: sourceCommit,
    note: "Synced from mzareei/course-content main."
  });
  if (versionInsertError) throw versionInsertError;

  const { error: auditError } = await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "content_item",
    target_id: item.id,
    action: "content_repository_synced",
    metadata: { slug: item.slug, source_commit: sourceCommit, content_sha256: contentSha, version }
  });
  if (auditError) throw auditError;

  return {
    status: "synced",
    slug: item.slug,
    source_commit: sourceCommit,
    content_sha256: contentSha,
    version,
    item: updatedItem
  };

  async function readBlob(sha: string, token: string) {
    const blob = await githubJson(`${githubRepo}/git/blobs/${sha}`, token);
    if (blob.encoding !== "base64" || typeof blob.content !== "string") throw new Error("The repository returned an unreadable content blob.");
    return decodeBase64(blob.content);
  }
}

async function githubJson(url: string, token: string) {
  const response = await fetch(url, { headers: { ...githubHeaders, Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GitHub repository request failed (${response.status}).`);
  return payload;
}

function findTreeEntry(tree: Array<{ path?: string; type?: string; sha?: string }>, wantedPath: string) {
  const entry = (tree || []).find((candidate) => candidate.path === wantedPath && candidate.type === "blob" && candidate.sha);
  if (!entry?.sha) throw new Error(`The repository is missing ${wantedPath}.`);
  return { sha: String(entry.sha) };
}

function decodeBase64(value: string) {
  const bytes = Uint8Array.from(atob(value.replace(/\s/g, "")), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function validateMetadata(meta: Record<string, any>, item: Record<string, any>) {
  if (meta.slug !== item.slug) throw new Error("The repository slug does not match the selected content item.");
  if (meta.content_item_id !== item.id) throw new Error("The repository content_item_id does not match the selected content item.");
  if (!contentTypes.has(String(meta.content_type)) || meta.content_type !== item.content_type) throw new Error("The repository content type does not match the selected content item.");
  if (!meta.title?.en?.trim() || !meta.title?.es?.trim()) throw new Error("The repository title must exist in English and Spanish.");
  if (!meta.storage_filename || String(item.source_ref).split("/").pop() !== meta.storage_filename) throw new Error("The repository storage filename does not match production.");
}

function validateArtifact(html: string, meta: Record<string, any>) {
  if (!/<title>[^<]+<\/title>/i.test(html)) throw new Error("The repository artifact has no title.");
  const declared = new Set(allowedExternalHosts);
  for (const link of meta.external_links || []) {
    try { declared.add(new URL(String(link)).hostname.toLowerCase()); } catch { throw new Error("The repository external_links metadata is invalid."); }
  }
  const references = [...html.matchAll(/(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
    .map((match) => String(match[1] ?? match[2] ?? "").trim()).filter(Boolean);
  for (const reference of references) {
    if (/^(?:data|mailto|tel):/i.test(reference) || reference.startsWith("#")) continue;
    const host = hostOf(reference);
    if (host === "") throw new Error(`relative reference ${reference} survived`);
    if (host === "invalid") throw new Error(`invalid reference ${reference}`);
    if (forbiddenHosts.has(host)) throw new Error(`links to ${host}`);
    if (!declared.has(host)) throw new Error(`links to undeclared host ${host}`);
  }
}

function hostOf(reference: string) {
  if (!/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(reference)) return "";
  try { return new URL(reference, "https://placeholder.invalid/").hostname.toLowerCase(); } catch { return "invalid"; }
}

function versionCopyPath(sourceRef: string, version: number) {
  const parts = sourceRef.split("/");
  parts.pop();
  return `${parts.join("/")}/.versions/v${version}.html`;
}

async function downloadStorage(db: Db, sourceRef: string) {
  const { data, error } = await db.storage.from(bucket).download(sourceRef);
  if (error) {
    if (/not found|object not found/i.test(String(error.message || error))) return null;
    throw error;
  }
  return new Uint8Array(await data.arrayBuffer());
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
  if (!profile) throw new Error("Instructor profile is not linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active");
  if (membershipError) throw membershipError;
  const activeMemberships = memberships || [];
  if (!activeMemberships.some((membership) => ["platform_owner", "instructor"].includes(String(membership.role)))) {
    throw new Error("You are not allowed to sync content for this course.");
  }
  return {
    profile: profile as Profile,
    permissions: { isPlatformOwner: activeMemberships.some((membership) => String(membership.role) === "platform_owner") }
  };
}

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function cleanUuid(value: unknown, message: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) throw new Error(message);
  return text;
}

function cleanEntry(value: unknown) {
  const entry = String(value || "").trim();
  if (!entry || entry.includes("..") || entry.startsWith("/") || !entry.toLowerCase().endsWith(".html")) {
    throw new Error("The repository entry file is invalid.");
  }
  return entry;
}
