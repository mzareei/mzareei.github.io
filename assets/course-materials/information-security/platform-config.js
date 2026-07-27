window.TC2007B_PLATFORM_CONFIG = {
  courseId: "tc2007b",
  supabaseUrl: "https://ojmbupftdikwmlqvibwt.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qbWJ1cGZ0ZGlrd21scXZpYnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Mzk3MzUsImV4cCI6MjA5NzIxNTczNX0.X05-dMgmvXTiqha_NLnwjPg7UWvd5xoByYmKq29B4M4",
  allowedInstitutionalDomains: ["tec.mx", "itesm.mx"],
  // QA test accounts sign in from outside the institutional domains. Keep this list empty:
  // this file is served publicly, so test addresses belong in the COURSE_TEST_EMAILS secret
  // server side and in per-device storage in the browser (open the app once with
  // ?test-access=<email>). See docs/course-platform/operations/qa-test-accounts.md.
  allowedTestEmails: [],
  testAccessStorageKey: "tc2007b.test-access-emails",
  authContextFunction: "course-auth-context",
  identityConfirmationFunction: "course-identity-confirmation",
  sectionManagementFunction: "course-section-management",
  rosterManagementFunction: "course-roster-management",
  contentLibraryFunction: "course-content-library",
  releaseManagementFunction: "course-release-management",
  sessionManagementFunction: "course-session-management",
  contentAccessFunction: "course-content-access",
  activityAttemptFunction: "course-activity-attempt",
  gradebookSummaryFunction: "course-gradebook-summary",
  studentRecordsFunction: "course-student-records",
  studentProgressFunction: "course-student-progress",
  learningInsightsFunction: "course-learning-insights",
  participationEventsFunction: "course-participation-events",
  exitTicketFunction: "course-exit-ticket",
  portfolioEntryFunction: "course-portfolio-entry",
  auditLogFunction: "course-audit-log"
};
