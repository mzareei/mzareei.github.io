const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "assets/course-materials/information-security/app/app.js");
const htmlPath = path.join(root, "assets/course-materials/information-security/app/index.html");
const cssPath = path.join(root, "assets/course-materials/information-security/app/app.css");
const migrationPath = path.join(root, "supabase/migrations/0004_authenticated_course_platform.sql");
const orchestratorPath = path.join(root, "tools/verify-auth-command-center.js");

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
    this.sync();
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
    this.sync();
  }

  contains(name) {
    return this.values.has(name);
  }

  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    this.sync();
    return enabled;
  }

  sync() {
    this.element._className = [...this.values].join(" ");
  }
}

class FakeElement {
  constructor(tagName = "div", ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.eventListeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.parentElement = null;
    this.classList = new FakeClassList(this);
    this._className = "";
    this._innerHTML = "";
  }

  set className(value) {
    this._className = String(value || "");
    this.classList.values = new Set(this._className.split(/\s+/).filter(Boolean));
  }

  get className() {
    return this._className;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
    this.textContent = "";
  }

  get innerHTML() {
    return this._innerHTML;
  }

  get options() {
    return this.children;
  }

  append(...nodes) {
    nodes.forEach((node) => {
      if (node && typeof node === "object") {
        node.parentElement = this;
        this.children.push(node);
      }
    });
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  toggleAttribute(name, force) {
    const enabled = force === undefined ? !this.attributes.has(name) : Boolean(force);
    if (enabled) this.attributes.set(name, "");
    else this.attributes.delete(name);
    return enabled;
  }

  addEventListener(type, listener) {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    event.target ||= this;
    for (const listener of this.eventListeners.get(type) || []) listener(event);
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  matches(selector) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    return false;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  contains(element) {
    let current = element;
    while (current) {
      if (current === this) return true;
      current = current.parentElement;
    }
    return false;
  }

  querySelectorAll() {
    return this._focusables || [];
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.eventListeners = new Map();
    this.activeElement = null;
  }

  getElementById(id) {
    if (!this.elements.has(id)) {
      const element = new FakeElement("div", this);
      element.id = id;
      this.elements.set(id, element);
    }
    return this.elements.get(id);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createTextNode(value) {
    const node = new FakeElement("#text", this);
    node.textContent = String(value);
    return node;
  }

  addEventListener(type, listener) {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.eventListeners.get(type) || []) listener(event);
  }
}

function createHarness() {
  const document = new FakeDocument();
  const ids = [
    "emailInput", "otpInput", "sendCodeBtn", "verifyCodeBtn", "signOutBtn", "refreshContextBtn",
    "appStatus", "signedOutPanel", "signedInPanel", "studentDashboard", "teacherDashboard",
    "teacherNavigation", "teacherNavToggle", "teacherNavClose", "teacherNavHome", "teacherNavBackdrop", "accountMenuButton",
    "accountPanel", "enrollmentRequiredPanel", "currentSessionPanel", "identitySummary", "roleList",
    "sectionList", "releasedItems", "studentActions", "teacherActions", "teacherReleasedItems",
    "teacherReviewLinks", "teacherContextPanel", "currentSessionTitle", "currentSessionStatus",
    "currentSessionMeta", "courseContextSelect", "sectionContextSelect", "sessionContextSelect",
    "teacherContextLinks"
  ];
  ids.forEach((id) => document.getElementById(id));
  document.getElementById("signedInPanel").hidden = true;
  document.getElementById("studentDashboard").hidden = true;
  document.getElementById("teacherDashboard").hidden = true;
  document.getElementById("enrollmentRequiredPanel").hidden = true;
  document.getElementById("accountPanel").hidden = true;
  document.getElementById("teacherNavBackdrop").hidden = true;
  document.getElementById("teacherNavToggle").setAttribute("aria-expanded", "false");
  document.getElementById("accountMenuButton").setAttribute("aria-expanded", "false");

  const navigation = document.getElementById("teacherNavigation");
  const close = document.getElementById("teacherNavClose");
  const home = document.getElementById("teacherNavHome");
  const last = new FakeElement("a", document);
  navigation._focusables = [close, home, last];
  close.parentElement = navigation;
  home.parentElement = navigation;
  last.parentElement = navigation;

  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };
  const mobileQuery = {
    matches: true,
    listeners: [],
    addEventListener(_type, listener) { this.listeners.push(listener); }
  };
  const context = {
    console,
    document,
    Element: FakeElement,
    localStorage,
    URLSearchParams,
    setTimeout: () => 1,
    clearTimeout: () => {},
    window: { matchMedia: () => mobileQuery },
    getSession: async () => null,
    isConfigured: () => true,
    loadCourseContext: async () => ({}),
    platformConfig: () => ({ courseId: "tc2007b", allowedInstitutionalDomains: [] }),
    sendOtp: async () => {},
    signOut: async () => {},
    verifyOtp: async () => null
  };
  const source = fs.readFileSync(appPath, "utf8")
    .replace(/^import .*?;\s*$/m, "")
    .replace(/\ninit\(\);\s*\n/, "\n")
    + `\n;globalThis.commandCenterTest = {
      roleCapabilities, teacherNavigationGroups, renderTeacherNavigation, renderContext,
      renderTeacherContextSwitchers, renderTeacherContextLinks, renderCurrentSession,
      renderTeacherSupport, selectedTeacherContext, selectedTeacherSession, withTeacherContext,
      setDisclosure, closeCommandDisclosures, syncTeacherNavigationAccessibility
    };`;
  vm.runInNewContext(source, context, { filename: appPath });
  return { api: context.commandCenterTest, document, localStorage, mobileQuery };
}

function links(target) {
  return target.children
    .map((item) => item.children[0])
    .filter(Boolean);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("capabilities distinguish student, section TA, course TA, instructor, and no-role contexts", () => {
  const { api } = createHarness();
  assert.deepStrictEqual(
    { ...api.roleCapabilities({ sections: [{ role: "student", status: "active" }] }) },
    { hasStudentRole: true, canTeach: false, canAudit: false, canManageCourse: false }
  );
  assert.deepStrictEqual(
    { ...api.roleCapabilities({ sections: [{ role: "teaching_assistant", status: "planned" }] }) },
    { hasStudentRole: false, canTeach: true, canAudit: false, canManageCourse: false }
  );
  assert.deepStrictEqual(
    { ...api.roleCapabilities({ memberships: [{ role: "teaching_assistant", status: "active" }] }) },
    { hasStudentRole: false, canTeach: true, canAudit: false, canManageCourse: false }
  );
  assert.deepStrictEqual(
    { ...api.roleCapabilities({ memberships: [{ role: "instructor", status: "active" }] }) },
    { hasStudentRole: false, canTeach: true, canAudit: true, canManageCourse: true }
  );
  assert.deepStrictEqual(
    { ...api.roleCapabilities({ sections: [{ role: "instructor", status: "active" }] }) },
    { hasStudentRole: false, canTeach: false, canAudit: false, canManageCourse: false }
  );
  assert.deepStrictEqual(
    { ...api.roleCapabilities({}) },
    { hasStudentRole: false, canTeach: false, canAudit: false, canManageCourse: false }
  );
});

test("navigation consumes full capabilities and keeps Manage and Audit instructor-only", () => {
  const { api } = createHarness();
  const taGroups = api.teacherNavigationGroups({ canTeach: true, canAudit: false, canManageCourse: false });
  assert.deepStrictEqual(Array.from(taGroups, (group) => group.label), ["Teach", "Review"]);
  assert(!taGroups.flatMap((group) => group.items).some((item) => /Sections|Roster|Content Library|Audit/.test(item.label)));
  const instructorGroups = api.teacherNavigationGroups({ canTeach: true, canAudit: true, canManageCourse: true });
  assert.deepStrictEqual(Array.from(instructorGroups, (group) => group.label), ["Teach", "Review", "Manage"]);
  assert(instructorGroups.flatMap((group) => group.items).some((item) => item.label === "Review Audit Log"));
});

test("render composition covers student, section TA, instructor, and enrollment-required states", () => {
  for (const [context, expected] of [
    [{ sections: [{ role: "student", status: "active" }] }, "studentDashboard"],
    [{ sections: [{ id: "a", role: "teaching_assistant", status: "active" }] }, "teacherDashboard"],
    [{ memberships: [{ role: "instructor", status: "active", course_id: "tc2007b" }] }, "teacherDashboard"],
    [{ profile: { full_name: "No Role" } }, "enrollmentRequiredPanel"]
  ]) {
    const { api, document } = createHarness();
    api.renderContext({ user: { email: "person@tec.mx" }, profile: {}, memberships: [], sections: [], releases: [], ...context });
    for (const id of ["studentDashboard", "teacherDashboard", "enrollmentRequiredPanel"]) {
      assert.strictEqual(document.getElementById(id).hidden, id !== expected, `${expected} composition`);
    }
  }
});

test("account trigger uses the returned preferred name and retains an accessible account label", () => {
  const { api, document } = createHarness();
  api.renderContext({
    user: { email: "ada@tec.mx" },
    profile: { preferred_name: "Ada", full_name: "Ada Lovelace" },
    memberships: [], sections: [], releases: []
  });
  const trigger = document.getElementById("accountMenuButton");
  assert.strictEqual(trigger.textContent, "Ada");
  assert.strictEqual(trigger.getAttribute("aria-label"), "Account for Ada");
});

test("selected session renders one supported state-dependent primary action and contextual URLs", () => {
  const cases = [
    ["planned", "Prepare selected releases", "releases.html"],
    ["open", "Manage selected session", "sessions.html"],
    ["live", "Manage selected session", "sessions.html"],
    ["paused", "Manage selected session", "sessions.html"],
    ["continued", "Manage selected session", "sessions.html"],
    ["closed", "Review section gradebook", "gradebook.html"],
    ["cancelled", "Manage selected session", "sessions.html"]
  ];
  const migration = fs.readFileSync(migrationPath, "utf8");
  const contract = migration.match(/state in \(('planned'[\s\S]*?'cancelled')\)/)[1]
    .match(/'([^']+)'/g)
    .map((state) => state.slice(1, -1));
  assert.deepStrictEqual(cases.map(([state]) => state), contract);
  for (const [state, label, route] of cases) {
    const { api, document, localStorage } = createHarness();
    localStorage.setItem("tc2007b.teacher-context", JSON.stringify({ courseId: "tc2007b", sectionId: "section-a", sessionId: `session-${state}` }));
    api.renderCurrentSession({ teacher_sessions: [{
      session_id: `session-${state}`, section_id: "section-a", section_code: "A", title: "Class", state
    }] });
    const actions = links(document.getElementById("teacherContextLinks"));
    const primary = actions.filter((link) => link.classList.contains("session-primary-action"));
    assert.strictEqual(primary.length, 1, `${state} primary count`);
    assert.strictEqual(primary[0].textContent, label);
    assert(primary[0].href.startsWith(route));
    assert(primary[0].href.includes("course=tc2007b"));
    assert(primary[0].href.includes("section=section-a"));
    assert(primary[0].href.includes(`session=session-${state}`));
    assert(actions.length <= 4, `${state} actions stay compact`);
  }
});

test("no-session actions distinguish assigned teachers, sectionless instructors, and unassigned TAs", () => {
  const scenarios = [
    [{
      memberships: [{ role: "instructor", status: "active", course_id: "tc2007b" }],
      sections: [{ id: "section-a", role: "instructor", status: "active", section_code: "A" }]
    }, "Manage Class Sessions", "sessions.html", null],
    [{ memberships: [{ role: "instructor", status: "active", course_id: "tc2007b" }], sections: [] },
      "Course Sections", "sections.html", null],
    [{ memberships: [{ role: "teaching_assistant", status: "active", course_id: "tc2007b" }], sections: [] },
      null, null, /section assignment is required/i]
  ];
  for (const [partialContext, label, route, emptyPattern] of scenarios) {
    const { api, document } = createHarness();
    api.renderContext({ user: { email: "teacher@tec.mx" }, profile: {}, releases: [], teacher_sessions: [], ...partialContext });
    const target = document.getElementById("teacherContextLinks");
    const sessionActions = links(target);
    if (label) {
      assert.strictEqual(sessionActions.length, 1);
      assert.strictEqual(sessionActions[0].textContent, label);
      assert(sessionActions[0].href.startsWith(route));
    } else {
      assert.strictEqual(sessionActions.length, 0);
      assert.match(target.children[0].textContent, emptyPattern);
    }
    api.renderTeacherSupport({ releases: [] });
    if (!partialContext.sections.length) {
      assert.strictEqual(links(document.getElementById("teacherReviewLinks")).length, 0);
    }
  }
});

test("mobile navigation contains focus and moves it safely across responsive transitions", () => {
  const { api, document, mobileQuery } = createHarness();
  const navigation = document.getElementById("teacherNavigation");
  const toggle = document.getElementById("teacherNavToggle");
  const close = document.getElementById("teacherNavClose");
  const backdrop = document.getElementById("teacherNavBackdrop");
  api.syncTeacherNavigationAccessibility();
  assert(navigation.attributes.has("inert"));
  assert.strictEqual(navigation.getAttribute("aria-hidden"), "true");

  toggle.dispatch("click");
  assert.strictEqual(toggle.getAttribute("aria-expanded"), "true");
  assert.strictEqual(document.activeElement, close);
  const focusables = navigation._focusables;
  focusables.at(-1).focus();
  let prevented = false;
  document.dispatch("keydown", { key: "Tab", shiftKey: false, preventDefault: () => { prevented = true; } });
  assert(prevented);
  assert.strictEqual(document.activeElement, focusables[0]);
  focusables[0].focus();
  prevented = false;
  document.dispatch("keydown", { key: "Tab", shiftKey: true, preventDefault: () => { prevented = true; } });
  assert(prevented);
  assert.strictEqual(document.activeElement, focusables.at(-1));

  backdrop.dispatch("click");
  assert.strictEqual(toggle.getAttribute("aria-expanded"), "false");
  assert.strictEqual(document.activeElement, toggle);
  assert.strictEqual(backdrop.hidden, true);

  toggle.dispatch("click");
  const outside = new FakeElement("main", document);
  document.dispatch("click", { target: outside });
  assert.strictEqual(toggle.getAttribute("aria-expanded"), "false");
  assert.strictEqual(document.activeElement, toggle);

  toggle.dispatch("click");
  close.dispatch("click");
  assert.strictEqual(toggle.getAttribute("aria-expanded"), "false");
  assert.strictEqual(document.activeElement, toggle);

  api.setDisclosure(toggle, navigation, true);
  assert.strictEqual(document.activeElement, close);
  mobileQuery.matches = false;
  api.syncTeacherNavigationAccessibility();
  assert(!navigation.attributes.has("inert"));
  assert.strictEqual(navigation.getAttribute("aria-hidden"), "false");
  assert.strictEqual(backdrop.hidden, true);
  assert.strictEqual(document.activeElement, document.getElementById("teacherNavHome"));

  navigation._focusables.at(-1).focus();
  mobileQuery.matches = true;
  api.syncTeacherNavigationAccessibility();
  assert(navigation.attributes.has("inert"));
  assert.strictEqual(navigation.getAttribute("aria-hidden"), "true");
  assert.strictEqual(document.activeElement, toggle);
});

test("markup and responsive styles expose a nav landmark, close affordances, and scrollable drawer", () => {
  const html = fs.readFileSync(htmlPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  assert.match(html, /<nav[^>]+id="teacherNavigation"/);
  assert.match(html, /id="teacherNavClose"/);
  assert.match(html, /id="teacherNavHome"/);
  assert.match(html, /id="teacherNavBackdrop"/);
  assert.match(css, /\.teacher-navigation[\s\S]*?overflow-y:\s*auto/);
});

test("focused orchestrator runs executable behavior before reporting overall success", () => {
  const source = fs.readFileSync(orchestratorPath, "utf8");
  const behaviorIndex = source.indexOf('require("./verify-auth-command-center-behavior.js")');
  const successIndex = source.indexOf('console.log("Authenticated Command Center verification passed.")');
  assert(behaviorIndex >= 0);
  assert(successIndex >= 0);
  assert(behaviorIndex < successIndex);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(`  ${error.message}`);
  }
}

if (failures) {
  console.error(`Authenticated Command Center behavior verification failed: ${failures}/${tests.length} failing.`);
  process.exit(1);
}

console.log(`Authenticated Command Center behavior verification passed: ${tests.length}/${tests.length}.`);
