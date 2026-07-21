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

requireMarkers("assets/css/style.scss", "Public theme", [
  '--font-sans: "Inter"',
  '--font-display: "Source Serif 4"',
  "--site-max: 1180px",
  ".site-masthead",
  ".editorial-grid",
  "@media (max-width: 880px)"
]);

requireMarkers("_includes/header.html", "Header", [
  'class="brand-mark"',
  "'/research/' | relative_url",
  "'/projects/' | relative_url",
  "'/students/' | relative_url",
  "'/contact/' | relative_url"
]);

requireMarkers("assets/js/main.js", "Navigation behavior", [
  "setNavigation",
  'event.key === "Escape"',
  "nav.contains(document.activeElement)",
  'setAttribute("aria-expanded"'
]);

requireMarkers("_config.yml", "Jekyll exclusions", ["docs/superpowers"]);

if (failures.length) {
  console.error("Public site design verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Public site design verification passed.");
