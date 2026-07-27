// Build single-file copies of every lecture deck and mission, then move them into
// the private course-content bucket through the instructor-gated
// course-content-upload function.
//
//   node tools/migrate-gated-content.mjs --dry-run     # build only, no upload
//   COURSE_ACCESS_TOKEN=<instructor access token> node tools/migrate-gated-content.mjs
//
// The token is a signed-in instructor's Supabase access token (short-lived; the
// function re-validates it and the role on every call). Nothing here needs or
// touches the service-role key.
//
// What "single-file" means: each deck/mission becomes one HTML file with its
// stylesheets and engine script inlined, so one signed URL serves the whole
// thing. Remaining relative links (mission <-> lecture cross-navigation, course
// home) are rewritten to absolute public URLs so nothing silently breaks inside
// the gated viewer while the public copies still exist. Google Fonts links are
// left as-is (external, load fine). Anything the script cannot inline is
// reported loudly and skipped, never half-migrated.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(root, "assets", "course-materials", "information-security");
const outDir = path.join(root, ".gated-content-build");
const publicBase = "https://mzareei.github.io/assets/course-materials/information-security";

const SUPABASE_URL = "https://ojmbupftdikwmlqvibwt.supabase.co";
const COURSE_ID = "tc2007b";
const dryRun = process.argv.includes("--dry-run");
const accessToken = process.env.COURSE_ACCESS_TOKEN || "";

// ---------------------------------------------------------------- inventory
function discoverItems() {
  const items = [];
  const weeks = readdirSync(contentRoot).filter((name) => /^week-\d\d$/.test(name)).sort();
  for (const week of weeks) {
    const weekDir = path.join(contentRoot, week);
    for (const entry of readdirSync(weekDir).sort()) {
      const dir = path.join(weekDir, entry);
      if (!existsSync(path.join(dir, "index.html"))) continue;
      if (entry === "lecture") {
        items.push({ dir, rel: `${week}/${entry}`, slug: `${week}-lecture`, type: "lecture", points: 0 });
      } else if (/^lecture-\d$/.test(entry)) {
        items.push({ dir, rel: `${week}/${entry}`, slug: `${week}-${entry}`, type: "lecture", points: 0 });
      } else if (/^mission-/.test(entry)) {
        items.push({ dir, rel: `${week}/${entry}`, slug: `${week}-${entry}`, type: "mission", points: 10 });
      }
    }
  }
  return items;
}

// ---------------------------------------------------------------- inlining
function resolvePublicUrl(itemRel, target) {
  // itemRel like 'week-02/lecture'; target like '../mission-02/' or '/teaching/...'
  if (target.startsWith("/")) return `https://mzareei.github.io${target}`;
  const joined = path.posix.normalize(path.posix.join(itemRel, target));
  if (joined.startsWith("..")) throw new Error(`Link escapes the course folder: ${target}`);
  return `${publicBase}/${joined}`;
}

function isExternal(url) {
  return /^(https?:)?\/\//.test(url) || url.startsWith("#") || url.startsWith("mailto:") || url.startsWith("data:");
}

function inlineItem(item) {
  const notes = [];
  let html = readFileSync(path.join(item.dir, "index.html"), "utf8");

  // 1. Inline every local stylesheet, preserving order (missions load two).
  html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>(\n)?/g, (match, href) => {
    if (isExternal(href)) return match; // Google Fonts etc.
    const cssPath = path.resolve(item.dir, href);
    if (!cssPath.startsWith(contentRoot)) throw new Error(`Stylesheet outside content root: ${href}`);
    if (!existsSync(cssPath)) throw new Error(`Missing stylesheet: ${href}`);
    return `<style>\n${readFileSync(cssPath, "utf8")}\n</style>\n`;
  });

  // 2. Inline every local script (the shared engine; missions have one each).
  html = html.replace(/<script\s+src="([^"]+)"\s*><\/script>/g, (match, src) => {
    if (isExternal(src)) return match;
    const jsPath = path.resolve(item.dir, src);
    if (!jsPath.startsWith(contentRoot)) throw new Error(`Script outside content root: ${src}`);
    if (!existsSync(jsPath)) throw new Error(`Missing script: ${src}`);
    let js = readFileSync(jsPath, "utf8");
    // Rewrite the engine's keyboard-shortcut navigation (M/Q/E) to absolute URLs.
    js = js.replace(/window\.location\.href = "([^"]+)"/g, (m, target) =>
      isExternal(target) ? m : `window.location.href = "${resolvePublicUrl(item.rel, target)}"`
    );
    return `<script>\n${js}\n</script>`;
  });

  // 3. Rewrite remaining relative links (cross-navigation, back-to-course).
  html = html.replace(/(href|src)="([^"]+)"/g, (match, attr, target) => {
    if (isExternal(target) || target.startsWith("<") ) return match;
    if (target.startsWith("data-")) return match;
    return `${attr}="${resolvePublicUrl(item.rel, target)}"`;
  });

  // 4. Nothing local may remain.
  const leftover = [...html.matchAll(/(?:href|src)="((?!https?:|#|mailto:|data:)[^"]+)"/g)].map((m) => m[1]);
  if (leftover.length) throw new Error(`Unresolved local references remain: ${leftover.join(", ")}`);
  // Runtime fetches would break behind a signed URL — refuse rather than half-work.
  if (/fetch\(/.test(html) && !/functions\/v1/.test(html)) {
    notes.push("contains fetch() — check it still works from the gated viewer");
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  return { html, rawTitle: titleMatch ? titleMatch[1].trim() : item.slug, notes };
}

function friendlyTitle(rawTitle, item) {
  const decoded = rawTitle
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // 'TC2007B · Week 2 · Lecture 1 — Authentication' -> 'Week 2 Lecture 1: Authentication'
  const deck = decoded.match(/Week (\d+) · Lecture (\d+)\s*[—–-]\s*(.+)$/);
  if (deck) return `Week ${deck[1]} Lecture ${deck[2]}: ${deck[3]}`;
  // 'TC2007B · Week 6 · Symmetric Encryption' -> 'Week 6 Lecture: Symmetric Encryption'
  const week = decoded.match(/Week (\d+)\s*[·—–-]\s*(.+)$/);
  if (week && item.type === "lecture") return `Week ${week[1]} Lecture: ${week[2]}`;
  // 'Mission 02 · Prove Who You Are' -> 'Mission 02: Prove Who You Are'
  const mission = decoded.match(/((?:Bridge )?Mission[\w\s]*?\d*)\s*[·:—–-]\s*(.+)$/i);
  if (mission) return `${mission[1].trim()}: ${mission[2].trim()}`;
  return decoded.replace(/^TC2007B\s*·\s*/, "").slice(0, 200) || item.slug;
}

// ---------------------------------------------------------------- upload
async function callFn(name, body) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: COURSE_ID, ...body })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${name}: ${payload.error || response.status}`);
  return payload;
}

async function uploadItem(item, built) {
  const { path: storagePath, signed_url } = await callFn("course-content-upload", {
    action: "create_upload_url",
    slug: item.slug,
    filename: "index.html"
  });
  const put = await fetch(signed_url, {
    method: "PUT",
    headers: { "Content-Type": "text/html; charset=utf-8", "x-upsert": "true" },
    body: built.html
  });
  if (!put.ok) throw new Error(`Storage PUT failed (${put.status}): ${await put.text()}`);

  const { item: registered } = await callFn("course-content-upload", {
    action: "register_item",
    slug: item.slug,
    title: friendlyTitle(built.rawTitle, item),
    summary: "",
    content_type: item.type,
    storage_path: storagePath,
    default_points: item.points
  });
  return registered;
}

// ---------------------------------------------------------------- main
const items = discoverItems();
console.log(`Found ${items.length} items (${items.filter((i) => i.type === "lecture").length} lectures, ${items.filter((i) => i.type === "mission").length} missions).\n`);
mkdirSync(outDir, { recursive: true });

const failures = [];
for (const item of items) {
  try {
    const built = inlineItem(item);
    writeFileSync(path.join(outDir, `${item.slug}.html`), built.html);
    const noteText = built.notes.length ? `  ⚠ ${built.notes.join("; ")}` : "";
    if (dryRun) {
      console.log(`built  ${item.slug}  (${Math.round(built.html.length / 1024)} KB)  "${friendlyTitle(built.rawTitle, item)}"${noteText}`);
    } else {
      if (!accessToken) throw new Error("COURSE_ACCESS_TOKEN is required to upload (or use --dry-run).");
      const registered = await uploadItem(item, built);
      console.log(`moved  ${item.slug} -> ${registered.source_ref}${noteText}`);
    }
  } catch (error) {
    failures.push(`${item.slug}: ${error.message}`);
    console.error(`FAIL   ${item.slug}: ${error.message}`);
  }
}

console.log(failures.length ? `\n${failures.length} item(s) need manual attention.` : `\nAll ${items.length} items ${dryRun ? "built" : "migrated"} cleanly.`);
process.exit(failures.length ? 1 : 0);
