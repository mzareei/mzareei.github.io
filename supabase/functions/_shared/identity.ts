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

export function assertProfileMatchesAuthEmail(profile: Record<string, unknown>, authEmail: unknown) {
  const profileEmail = cleanInstitutionalEmail(profile.institutional_email);
  const signedInEmail = cleanInstitutionalEmail(authEmail);
  if (!profileEmail || profileEmail !== signedInEmail) {
    throw new Error("Signed-in email must match exactly one active roster profile.");
  }
  return profileEmail;
}
