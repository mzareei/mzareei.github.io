export const defaultAllowedInstitutionalDomains = ["tec.mx", "itesm.mx"];

// QA test accounts are addresses outside the institutional domains that are still
// allowed to sign in, so the course team can walk the student experience end to end.
// They are configured through the COURSE_TEST_EMAILS secret and never committed here,
// because platform-config.js and this repository are public.
export const testAccessEmailsEnvVar = "COURSE_TEST_EMAILS";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanInstitutionalEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function testAccessEmails() {
  let raw = "";
  try {
    raw = Deno.env.get(testAccessEmailsEnvVar) || "";
  } catch {
    raw = "";
  }
  const cleaned = raw
    .split(/[,;\s]+/)
    .map((entry) => cleanInstitutionalEmail(entry))
    .filter((entry) => emailPattern.test(entry));
  return Array.from(new Set(cleaned));
}

export function isTestAccessEmail(email: unknown) {
  const cleaned = cleanInstitutionalEmail(email);
  if (!cleaned) return false;
  return testAccessEmails().includes(cleaned);
}

export function assertInstitutionalEmailAllowed(email: unknown, allowedDomains = defaultAllowedInstitutionalDomains) {
  const cleaned = cleanInstitutionalEmail(email);
  if (isTestAccessEmail(cleaned)) return cleaned;
  const domains = allowedDomains.map((domain) => String(domain || "").trim().toLowerCase().replace(/^@/, ""));
  const allowed = domains.some((domain) => cleaned.endsWith(`@${domain}`));
  if (!cleaned || !allowed) {
    throw new Error("Institutional email domain is not approved for this course.");
  }
  return cleaned;
}

export async function hasExternalAccessGrant(db: { from: (table: string) => any }, email: unknown) {
  const cleaned = cleanInstitutionalEmail(email);
  if (!cleaned) return false;
  const { data, error } = await db
    .from("external_access_grants")
    .select("id")
    .eq("email", cleaned)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// The guard used by every trusted function. An address gets in when it is institutional,
// when it is listed in COURSE_TEST_EMAILS, or when an instructor recorded an external
// access grant for it. Course memberships still decide what the account can see.
export async function assertCourseEmailAllowed(
  db: { from: (table: string) => any },
  email: unknown,
  allowedDomains = defaultAllowedInstitutionalDomains
) {
  const cleaned = cleanInstitutionalEmail(email);
  try {
    return assertInstitutionalEmailAllowed(cleaned, allowedDomains);
  } catch (error) {
    if (await hasExternalAccessGrant(db, cleaned)) return cleaned;
    throw error;
  }
}

export function assertProfileMatchesAuthEmail(profile: Record<string, unknown>, authEmail: unknown) {
  const profileEmail = cleanInstitutionalEmail(profile.institutional_email);
  const signedInEmail = cleanInstitutionalEmail(authEmail);
  if (!profileEmail || profileEmail !== signedInEmail) {
    throw new Error("Signed-in email must match exactly one active roster profile.");
  }
  return profileEmail;
}
