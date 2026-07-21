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
  "--callout: #1b2d46",
  ".site-masthead",
  ".editorial-grid",
  ".course-mission-hero",
  ".course-page__body table",
  "width: 2.75rem",
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

requireMarkers("index.html", "Homepage", ["home-hero", "Secure intelligent systems", "evidence-rail", "site.data.publications | size", 'where: "status", "active"', "assets/images/profile.jpg"]);
requireMarkers("research.html", "Research", ["research-grid", "forloop.index", "theme.description"]);
requireMarkers("projects.html", "Projects", ["project-groups", "Active projects", "Completed projects"]);
requireMarkers("teaching.html", "Teaching", ["course-grid", "course-card", "course.code"]);
requireMarkers("_layouts/course.html", "Course layout", ["course-detail", "course-page__body"]);
requireMarkers("publications.html", "Publications", ["publication-toolbar", "pub-year", "data-year"]);
requireMarkers("students.html", "People", ["people-groups", "person-card", "Doctoral researcher"]);
requireMarkers("cv.html", "CV", ["cv-layout", "cv-nav", "cv-main"]);
requireMarkers("about.md", "About", ["about-layout", "about-facts"]);
requireMarkers("blog.html", "Blog", ["post-index", "empty-state"]);
requireMarkers("news.html", "News", ["news-list", "empty-state"]);
requireMarkers("contact.md", "Contact", ["contact-layout", "inquiry-card"]);

const publicSources = [
  "index.html", "about.md", "research.html", "publications.html", "projects.html",
  "teaching.html", "students.html", "news.html", "blog.html", "cv.html", "contact.md",
  "_data/research.yml", "_data/students.yml", "_courses/data-science.md",
  "_courses/distributed-systems.md", "_courses/network-fundamentals.md"
];
for (const relativePath of publicSources) {
  const source = read(relativePath);
  for (const forbidden of ["[Your Full Name]", "[TODO", 'class="todo"', "[Add student"]) {
    if (source.includes(forbidden)) failures.push(`${relativePath} exposes placeholder: ${forbidden}`);
  }
}

if (!fs.existsSync(path.join(root, "assets/images/profile.jpg"))) failures.push("Portrait is missing at assets/images/profile.jpg");
if (read("cv.html").includes("verify against Scholar/Scopus")) failures.push("CV exposes an internal verification note");

const builtRoot = path.join(root, "_site");
if (fs.existsSync(path.join(builtRoot, "index.html"))) {
  const requiredRoutes = ["index.html", "research/index.html", "publications/index.html", "projects/index.html", "teaching/index.html", "students/index.html", "cv/index.html", "blog/index.html", "news/index.html", "contact/index.html"];
  for (const route of requiredRoutes) {
    if (!fs.existsSync(path.join(builtRoot, route))) failures.push(`Built route missing: ${route}`);
  }

  function htmlFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? htmlFiles(target) : entry.name.endsWith(".html") ? [target] : [];
    });
  }

  const checkedLinks = new Set();
  for (const file of htmlFiles(builtRoot)) {
    const html = fs.readFileSync(file, "utf8");
    for (const forbidden of ["[Your Full Name]", "[TODO", 'class="todo"']) {
      if (html.includes(forbidden)) failures.push(`${path.relative(builtRoot, file)} renders placeholder: ${forbidden}`);
    }
    for (const match of html.matchAll(/href=["'](\/[^"]*?)["']/g)) {
      const href = match[1].split(/[?#]/)[0];
      if (!href || href.startsWith("/assets/course-materials/") || checkedLinks.has(href)) continue;
      checkedLinks.add(href);
      const relative = decodeURIComponent(href).replace(/^\//, "");
      const candidate = path.join(builtRoot, relative);
      const exists = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ||
        fs.existsSync(path.join(candidate, "index.html"));
      if (!exists) failures.push(`Broken internal link: ${href}`);
    }
  }
}

if (failures.length) {
  console.error("Public site design verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Public site design verification passed.");
