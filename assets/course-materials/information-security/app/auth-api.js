const DEFAULT_CONTEXT_FUNCTION = "course-auth-context";

export function platformConfig() {
  return window.TC2007B_PLATFORM_CONFIG || {};
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

export async function sendOtp(email) {
  const { error } = await client().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false
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
