const DEFAULT_CONTEXT_FUNCTION = "course-auth-context";
const DEFAULT_TEST_ACCESS_STORAGE_KEY = "tc2007b.test-access-emails";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function platformConfig() {
  return window.TC2007B_PLATFORM_CONFIG || {};
}

function testAccessStorageKey() {
  return platformConfig().testAccessStorageKey || DEFAULT_TEST_ACCESS_STORAGE_KEY;
}

function cleanEmailList(values) {
  const cleaned = (Array.isArray(values) ? values : [])
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter((entry) => EMAIL_PATTERN.test(entry));
  return Array.from(new Set(cleaned));
}

// QA test accounts let the course team sign in with a non-institutional address to walk
// the student experience. The addresses are held per device (and in the COURSE_TEST_EMAILS
// secret server side) rather than in this public repository.
export function testAccessEmails() {
  let stored = [];
  try {
    stored = JSON.parse(window.localStorage.getItem(testAccessStorageKey()) || "[]");
  } catch {
    stored = [];
  }
  return cleanEmailList([...(platformConfig().allowedTestEmails || []), ...(Array.isArray(stored) ? stored : [])]);
}

export function isTestAccessEmail(email) {
  const cleaned = String(email || "").trim().toLowerCase();
  return Boolean(cleaned) && testAccessEmails().includes(cleaned);
}

export function rememberTestAccessEmail(email) {
  const cleaned = String(email || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(cleaned)) return testAccessEmails();
  const configured = cleanEmailList(platformConfig().allowedTestEmails || []);
  const next = cleanEmailList([...testAccessEmails(), cleaned]).filter((entry) => !configured.includes(entry));
  try {
    window.localStorage.setItem(testAccessStorageKey(), JSON.stringify(next));
  } catch {
    // Storage can be unavailable in private browsing; the sign-in guard simply stays strict.
  }
  return testAccessEmails();
}

export function forgetTestAccessEmails() {
  try {
    window.localStorage.removeItem(testAccessStorageKey());
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

// Enrolling a device: open the app once as ...?test-access=<email>.
export function captureTestAccessFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("test-access");
  if (!requested) return "";
  const cleaned = String(requested).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(cleaned)) return "";
  rememberTestAccessEmail(cleaned);
  params.delete("test-access");
  const query = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  return cleaned;
}

export function isConfigured() {
  const config = platformConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase?.createClient);
}

export function client() {
  if (!isConfigured()) {
    throw new Error("Supabase is not configured for the course app yet.");
  }
  const config = platformConfig();
  if (!window.__TC2007B_SUPABASE_CLIENT__) {
    window.__TC2007B_SUPABASE_CLIENT__ = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
  return window.__TC2007B_SUPABASE_CLIENT__;
}

function courseAppRedirectUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  return url.href;
}

export async function sendOtp(email) {
  const { error } = await client().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: courseAppRedirectUrl()
    }
  });
  if (error) throw error;
}

export async function verifyOtp(email, token) {
  const { data, error } = await client().auth.verifyOtp({
    email,
    token,
    type: "email"
  });
  if (error) throw error;
  return data.session;
}

export async function getSession() {
  const { data, error } = await client().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

export async function loadCourseContext(session) {
  const config = platformConfig();
  const functionName = config.authContextFunction || DEFAULT_CONTEXT_FUNCTION;
  const response = await fetch(`${config.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      course_id: config.courseId || "tc2007b"
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unable to load course context.");
  }
  return payload;
}
