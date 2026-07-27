// Streams gated content out of the private course-content bucket.
//
// The browser lands here from an iframe with ?t=<HMAC token> minted by
// course-content-access AFTER the release gate passed. This function only
// verifies the token and serves the object with its real content type —
// Storage signed URLs can't do that for HTML on the shared supabase.co domain
// (they downgrade it to text/plain as an anti-phishing measure).
import { adminClient } from "../_shared/client.ts";
import { verifyContentToken } from "../_shared/content-token.ts";

const bucket = "course-content";

function mimeForPath(path: string) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".pdf")) return "application/pdf";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

// The Supabase gateway rewrites HTML responses to text/plain with a lockdown
// CSP (anti-phishing), so the browser cannot render this response directly.
// Instead the app fetches it (CORS below) and renders it from a local blob URL.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "GET") {
    return new Response("Method not allowed.", { status: 405, headers: corsHeaders });
  }

  try {
    const token = new URL(request.url).searchParams.get("t") || "";
    const path = await verifyContentToken(token);

    const db = adminClient();
    const { data: blob, error } = await db.storage.from(bucket).download(path);
    if (error || !blob) throw new Error("Access denied: content was not found.");

    return new Response(blob.stream(), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": mimeForPath(path),
        // Private per-student links: never cache on shared infrastructure.
        "Cache-Control": "private, max-age=300",
        "X-Mime": mimeForPath(path)
      }
    });
  } catch (error) {
    const message = error?.message || "Unable to serve content.";
    const status = message.includes("Access denied") ? 403 : 400;
    return new Response(message, {
      status,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" }
    });
  }
});
