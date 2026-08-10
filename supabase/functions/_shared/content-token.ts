// Short-lived HMAC tokens for gated content delivery.
//
// Storage signed URLs cannot serve HTML on the shared *.supabase.co domain
// (Supabase intentionally downgrades HTML to text/plain there, an anti-phishing
// measure), so decks are delivered through the course-content-serve function
// instead. course-content-access checks the release gate and mints one of these
// tokens; course-content-serve verifies it and streams the object with its real
// content type. The signing secret is the service-role key — already present in
// every function, never in the browser. Iframes cannot send Authorization
// headers, which is why the token travels in the URL; the expiry keeps a leaked
// URL short-lived, exactly like a storage signed URL.
import { serviceRoleKey } from "./client.ts";

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(text: string): ArrayBuffer {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes.buffer as ArrayBuffer;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(serviceRoleKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function mintContentToken(path: string, ttlSeconds: number): Promise<string> {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({
    path,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  })));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyContentToken(token: string): Promise<string> {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) throw new Error("Access denied: missing content token.");
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    base64UrlDecode(signature),
    encoder.encode(payload)
  );
  if (!valid) throw new Error("Access denied: invalid content token.");
  const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  if (!parsed.path || typeof parsed.exp !== "number") throw new Error("Access denied: malformed content token.");
  if (parsed.exp * 1000 < Date.now()) throw new Error("Access denied: this link has expired. Reopen the content.");
  return String(parsed.path);
}
