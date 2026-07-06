export const defaultAllowedInstitutionalDomains = ["tec.mx", "itesm.mx"];

export function cleanInstitutionalEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function assertInstitutionalEmailAllowed(email: unknown, allowedDomains = defaultAllowedInstitutionalDomains) {
  const cleaned = cleanInstitutionalEmail(email);
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
