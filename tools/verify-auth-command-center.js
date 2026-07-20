const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function requireMarkers(relativePath, label, markers) {
  const source = read(relativePath);
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${label} missing: ${marker}`);
  }
}

requireMarkers("assets/course-materials/information-security/app/index.html", "Command Center markup", [
  'id="studentDashboard"',
  'id="teacherDashboard"',
  'id="teacherNavigation"',
  'id="currentSessionPanel"',
  'id="teacherReleasedItems"',
  'id="teacherReviewLinks"'
]);

requireMarkers("assets/course-materials/information-security/app/app.js", "Command Center script", [
  "roleCapabilities",
  "teacherNavigationGroups",
  "renderTeacherNavigation",
  'label: "Teach"',
  'label: "Review"',
  'label: "Manage"',
  'label: "Review Audit Log"',
  "capabilities.canAudit"
]);

if (failures.length) {
  console.error("Authenticated Command Center verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Authenticated Command Center verification passed.");
console.log("- role-aware shell and instructor navigation checked");
