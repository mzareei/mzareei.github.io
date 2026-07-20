import { getSession, isConfigured, loadCourseContext, platformConfig, sendOtp, signOut, verifyOtp } from "./auth-api.js";

const els = {
  email: document.getElementById("emailInput"),
  otp: document.getElementById("otpInput"),
  sendCode: document.getElementById("sendCodeBtn"),
  verifyCode: document.getElementById("verifyCodeBtn"),
  signOut: document.getElementById("signOutBtn"),
  refresh: document.getElementById("refreshContextBtn"),
  status: document.getElementById("appStatus"),
  signedOutPanel: document.getElementById("signedOutPanel"),
  signedInPanel: document.getElementById("signedInPanel"),
  studentDashboard: document.getElementById("studentDashboard"),
  teacherDashboard: document.getElementById("teacherDashboard"),
  teacherNavigation: document.getElementById("teacherNavigation"),
  accountPanel: document.getElementById("accountPanel"),
  currentSessionPanel: document.getElementById("currentSessionPanel"),
  identitySummary: document.getElementById("identitySummary"),
  roleList: document.getElementById("roleList"),
  sectionList: document.getElementById("sectionList"),
  releasedItems: document.getElementById("releasedItems"),
  studentActions: document.getElementById("studentActions"),
  teacherActions: document.getElementById("teacherActions"),
  teacherReleasedItems: document.getElementById("teacherReleasedItems"),
  teacherReviewLinks: document.getElementById("teacherReviewLinks"),
  teacherContextPanel: document.getElementById("teacherContextPanel"),
  currentSessionTitle: document.getElementById("currentSessionTitle"),
  currentSessionStatus: document.getElementById("currentSessionStatus"),
  currentSessionMeta: document.getElementById("currentSessionMeta"),
  courseContextSelect: document.getElementById("courseContextSelect"),
  sectionContextSelect: document.getElementById("sectionContextSelect"),
  sessionContextSelect: document.getElementById("sessionContextSelect"),
  teacherContextLinks: document.getElementById("teacherContextLinks")
};

let currentSession = null;
let currentContext = null;
const teacherContextStorageKey = "tc2007b.teacher-context";
const sendCooldownSeconds = 60;
const sendCooldownStorageKey = "tc2007b.auth-send-cooldown";
let sendCooldownTimer = null;
let appBusy = false;

els.sendCode.addEventListener("click", async () => {
  const email = cleanEmail(els.email.value);
  if (!email) {
    setStatus("Enter your institutional email first.", "warn");
    return;
  }
  if (!isAllowedInstitutionalEmail(email)) {
    setStatus("Use your approved institutional email for this course.", "warn");
    return;
  }
  if (sendCooldownRemaining() > 0) {
    updateSendCodeCooldown();
    return;
  }
  await run("Sending sign-in email...", async () => {
    await sendOtp(email);
    startSendCooldown(sendCooldownSeconds);
    setStatus("Sign-in email sent. Click the link in your email, or enter the code here if one is shown.", "good");
  });
});

els.verifyCode.addEventListener("click", async () => {
  const email = cleanEmail(els.email.value);
  const token = els.otp.value.trim();
  if (!email || !token) {
    setStatus("Enter your email and the six digit code if your email includes one.", "warn");
    return;
  }
  if (!isAllowedInstitutionalEmail(email)) {
    setStatus("Use your approved institutional email for this course.", "warn");
    return;
  }
  await run("Verifying code...", async () => {
    currentSession = await verifyOtp(email, token);
    await refreshContext();
  });
});

els.signOut.addEventListener("click", async () => {
  await run("Signing out...", async () => {
    await signOut();
    currentSession = null;
    renderSignedOut();
    setStatus("Signed out.", "good");
  });
});

els.refresh.addEventListener("click", () => refreshContext());
els.courseContextSelect.addEventListener("change", () => updateTeacherContextFromControls());
els.sectionContextSelect.addEventListener("change", () => updateTeacherContextFromControls());
els.sessionContextSelect.addEventListener("change", () => updateTeacherContextFromControls());

init();

async function init() {
  if (!isConfigured()) {
    renderSignedOut();
    setStatus("Course app auth is not configured yet. Add the public Supabase anon key in platform-config.js.", "warn");
    return;
  }

  await run("Checking session...", async () => {
    currentSession = await getSession();
    if (currentSession) {
      await refreshContext();
    } else {
      renderSignedOut();
      setStatus("Sign in with your institutional email to continue.", "");
    }
  });
}

async function refreshContext() {
  if (!currentSession) {
    currentSession = await getSession();
  }
  if (!currentSession) {
    renderSignedOut();
    setStatus("Sign in to load your course context.", "warn");
    return;
  }

  await run("Loading course context...", async () => {
    const context = await loadCourseContext(currentSession);
    renderContext(context);
    setStatus("Course context loaded.", "good");
  });
}

async function run(workingMessage, action) {
  setBusy(true);
  setStatus(workingMessage, "");
  try {
    await action();
  } catch (error) {
    if (isRateLimitError(error)) {
      startSendCooldown(sendCooldownSeconds);
      setStatus("Rate limit reached. Wait about 60 seconds, then request one new sign-in email.", "warn");
    } else {
      setStatus(error.message || "Something went wrong.", "danger");
    }
  } finally {
    setBusy(false);
    updateSendCodeCooldown();
  }
}

function renderSignedOut() {
  currentContext = null;
  els.signedOutPanel.hidden = false;
  els.signedInPanel.hidden = true;
  els.studentDashboard.hidden = true;
  els.teacherDashboard.hidden = true;
  els.teacherContextPanel.hidden = true;
  els.identitySummary.textContent = "";
  els.roleList.innerHTML = "";
  els.sectionList.innerHTML = "";
  els.releasedItems.innerHTML = "";
  els.studentActions.innerHTML = "";
  els.teacherActions.innerHTML = "";
  els.teacherContextLinks.innerHTML = "";
  els.teacherReleasedItems.innerHTML = "";
  els.teacherReviewLinks.innerHTML = "";
  updateSendCodeCooldown();
}

function startSendCooldown(seconds) {
  const until = Date.now() + seconds * 1000;
  localStorage.setItem(sendCooldownStorageKey, String(until));
  updateSendCodeCooldown();
}

function sendCooldownRemaining() {
  const until = Number(localStorage.getItem(sendCooldownStorageKey) || 0);
  const remainingMs = Math.max(0, until - Date.now());
  if (!remainingMs && until) localStorage.removeItem(sendCooldownStorageKey);
  return Math.ceil(remainingMs / 1000);
}

function updateSendCodeCooldown() {
  const remaining = sendCooldownRemaining();
  if (sendCooldownTimer) {
    clearTimeout(sendCooldownTimer);
    sendCooldownTimer = null;
  }
  if (remaining > 0) {
    els.sendCode.disabled = true;
    els.sendCode.textContent = `Try again in ${remaining}s`;
    sendCooldownTimer = setTimeout(updateSendCodeCooldown, 1000);
    return;
  }
  els.sendCode.disabled = appBusy;
  els.sendCode.textContent = "Send sign-in email";
}

function isRateLimitError(error) {
  return /rate limit|too many|email rate/i.test(error?.message || "");
}

function roleCapabilities(context) {
  const memberships = context.memberships || [];
  return {
    hasStudentRole: (context.sections || []).some((section) => section.role === "student"),
    canTeach: memberships.some((membership) => {
      return ["platform_owner", "instructor", "teaching_assistant"].includes(membership.role);
    }),
    canAudit: memberships.some((membership) => {
      return ["platform_owner", "instructor"].includes(membership.role);
    })
  };
}

function renderContext(context) {
  currentContext = context;
  els.signedOutPanel.hidden = true;
  els.signedInPanel.hidden = false;
  const profile = context.profile || {};
  els.identitySummary.innerHTML = "";
  els.identitySummary.append(
    row("Name", profile.full_name || "Profile not linked yet"),
    row("Email", profile.institutional_email || context.user?.email || ""),
    row("Student ID", profile.student_identifier || "Not assigned")
  );

  renderList(els.roleList, context.memberships || [], (membership) => {
    const course = membership.course_title || membership.course_id || "Course";
    return `${course}: ${labelize(membership.role)} (${membership.status})`;
  }, "No active course role found.");

  renderList(els.sectionList, context.sections || [], (section) => {
    return `${section.section_code}: ${section.section_name} (${labelize(section.role)})`;
  }, "No active section enrollment found.");

  renderReleasedItems(context.releases || []);

  renderStudentActions(context);

  const capabilities = roleCapabilities(context);
  els.teacherDashboard.hidden = !capabilities.canTeach;
  els.studentDashboard.hidden = capabilities.canTeach || !capabilities.hasStudentRole;
  renderTeacherContextSwitchers(context, capabilities.canTeach);
  renderTeacherNavigation(capabilities.canTeach, capabilities.canAudit);
  if (capabilities.canTeach) {
    renderCurrentSession(context);
    renderTeacherSupport(context);
  }
}

function renderList(target, rows, formatter, emptyText) {
  target.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = emptyText;
    target.append(empty);
    return;
  }
  rows.forEach((rowData) => {
    const item = document.createElement("li");
    item.textContent = formatter(rowData);
    target.append(item);
  });
}

function renderReleasedItems(rows) {
  renderReleasedItemsInto(els.releasedItems, rows);
}

function renderReleasedItemsInto(target, rows) {
  target.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No released items for your section yet.";
    target.append(empty);
    return;
  }
  rows.forEach((item) => {
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    if (item.content_type === "activity" && item.activity_instance_id) {
      link.href = `activity.html?activity=${encodeURIComponent(item.activity_instance_id)}`;
    } else {
      link.href = `content.html?release=${encodeURIComponent(item.release_id || "")}`;
    }
    link.textContent = releasedItemLabel(item);
    listItem.append(link);
    target.append(listItem);
  });
}

function releasedItemLabel(item) {
  const state = labelize(item.state);
  const session = item.class_session_title ? ` · ${item.class_session_title}` : "";
  const sessionState = item.session_state ? ` · ${labelize(item.session_state)} session` : "";
  const continued = item.continued_from_session_id ? ` · Continues ${item.continued_from_session_title || "earlier class"}` : "";
  const paused = item.state === "paused" || item.session_state === "paused" ? " · Paused, progress saved" : "";
  return `${item.title} · ${state}${session}${sessionState}${continued}${paused}`;
}

function renderStudentActions(context) {
  const hasStudentSection = (context.sections || []).some((section) => section.role === "student");
  const actions = hasStudentSection ? [
    { label: "Confirm My Identity", href: "identity.html" },
    { label: "Open My Progress", href: "progress.html" },
    { label: "Open Review Coach", href: "review-coach.html" },
    { label: "Open My Portfolio", href: "portfolio.html" },
    { label: "Submit Exit Ticket", href: "exit-ticket.html" }
  ] : [];
  renderActionList(els.studentActions, actions, "Student actions appear here after section enrollment is active.");
}

function teacherNavigationGroups(canAudit) {
  const groups = [
    {
      label: "Teach",
      items: [
        { label: "Class Sessions", href: "sessions.html", contextual: true },
        { label: "Release Controls", href: "releases.html", contextual: true },
        { label: "Participation", href: "participation.html", contextual: false }
      ]
    },
    {
      label: "Review",
      items: [
        { label: "Gradebook", href: "gradebook.html", contextual: true },
        { label: "Student Records", href: "student-records.html", contextual: false },
        { label: "Learning Insights", href: "insights.html", contextual: true }
      ]
    },
    {
      label: "Manage",
      items: [
        { label: "Course Sections", href: "sections.html", contextual: false },
        { label: "Course Roster", href: "roster.html", contextual: false },
        { label: "Content Library", href: "content-library.html", contextual: false }
      ]
    }
  ];
  if (canAudit) {
    groups[1].items.push({ label: "Review Audit Log", href: "audit.html", contextual: false });
  }
  return groups;
}

function renderTeacherNavigation(canTeach, canAudit) {
  els.teacherActions.innerHTML = "";
  if (!canTeach) return;
  const context = selectedTeacherContext();
  teacherNavigationGroups(canAudit).forEach((group) => {
    const groupItem = document.createElement("li");
    groupItem.className = "teacher-nav-group";
    const heading = document.createElement("span");
    heading.className = "teacher-nav-label";
    heading.textContent = group.label;
    const list = document.createElement("ul");
    list.className = "teacher-nav-links";
    group.items.forEach((action) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = action.contextual ? withTeacherContext(action.href, context) : action.href;
      link.textContent = action.label;
      item.append(link);
      list.append(item);
    });
    groupItem.append(heading, list);
    els.teacherActions.append(groupItem);
  });
}

function renderTeacherContextSwitchers(context, canTeach) {
  els.teacherContextPanel.hidden = !canTeach;
  if (!canTeach) {
    els.teacherContextLinks.innerHTML = "";
    return;
  }

  const stored = selectedTeacherContext();
  const courses = teacherCourses(context);
  const sections = teacherSections(context);
  const sessions = context.teacher_sessions || [];
  const courseId = courses.some((course) => course.course_id === stored.courseId)
    ? stored.courseId
    : courses[0]?.course_id || platformConfig().courseId || "";
  const sectionId = sections.some((section) => section.section_id === stored.sectionId)
    ? stored.sectionId
    : sections[0]?.section_id || "";
  const sectionSessions = sessions.filter((session) => !sectionId || session.section_id === sectionId);
  const sessionId = sectionSessions.some((session) => session.session_id === stored.sessionId)
    ? stored.sessionId
    : sectionSessions[0]?.session_id || "";

  populateSelect(els.courseContextSelect, courses, courseId, "course_id", (course) => {
    return [course.course_code, course.course_title, course.term_label].filter(Boolean).join(" · ") || "TC2007B";
  });
  populateSelect(els.sectionContextSelect, sections, sectionId, "section_id", (section) => {
    return `${section.section_code || "Section"}${section.section_name ? ` · ${section.section_name}` : ""}`;
  });
  populateSelect(els.sessionContextSelect, sectionSessions, sessionId, "session_id", (session) => {
    const continuation = session.continued_from_session_title ? ` · continues ${session.continued_from_session_title}` : "";
    return `${session.planned_date || "No date"} · ${session.title || "Class session"} · ${labelize(session.state)}${continuation}`;
  });

  saveTeacherContext({
    courseId,
    sectionId,
    sessionId
  });
  renderTeacherContextLinks();
}

function updateTeacherContextFromControls() {
  const sectionId = els.sectionContextSelect.value;
  const sessions = (currentContext?.teacher_sessions || []).filter((session) => !sectionId || session.section_id === sectionId);
  if (!sessions.some((session) => session.session_id === els.sessionContextSelect.value)) {
    populateSelect(els.sessionContextSelect, sessions, sessions[0]?.session_id || "", "session_id", (session) => {
      const continuation = session.continued_from_session_title ? ` · continues ${session.continued_from_session_title}` : "";
      return `${session.planned_date || "No date"} · ${session.title || "Class session"} · ${labelize(session.state)}${continuation}`;
    });
  }
  saveTeacherContext({
    courseId: els.courseContextSelect.value,
    sectionId,
    sessionId: els.sessionContextSelect.value
  });
  renderTeacherNavigation(true, roleCapabilities(currentContext || {}).canAudit);
  renderTeacherContextLinks();
  renderCurrentSession(currentContext || {});
  renderTeacherSupport(currentContext || {});
}

function renderTeacherContextLinks() {
  const context = selectedTeacherContext();
  const links = [
    { label: "Manage selected session", href: withTeacherContext("sessions.html", context) },
    { label: "Prepare selected releases", href: withTeacherContext("releases.html", context) },
    { label: "View section insights", href: withTeacherContext("insights.html", context) },
    { label: "Review section gradebook", href: withTeacherContext("gradebook.html", context) }
  ];
  renderActionList(els.teacherContextLinks, links, "Choose a section and session to focus teacher tools.");
}

function teacherCourses(context) {
  const courses = (context.memberships || [])
    .filter((membership) => ["platform_owner", "instructor", "teaching_assistant"].includes(membership.role))
    .map((membership) => ({
      course_id: membership.course_id || platformConfig().courseId || "",
      course_code: membership.course_code || "TC2007B",
      course_title: membership.course_title || "Information Security",
      term_label: membership.term_label || ""
    }));
  return uniqueBy(courses.length ? courses : [{
    course_id: platformConfig().courseId || "tc2007b",
    course_code: "TC2007B",
    course_title: "Information Security",
    term_label: ""
  }], "course_id");
}

function teacherSections(context) {
  const sessionSections = (context.teacher_sessions || []).map((session) => ({
    section_id: session.section_id,
    section_code: session.section_code,
    section_name: session.section_name
  }));
  const enrolledSections = (context.sections || [])
    .filter((section) => ["instructor", "teaching_assistant"].includes(section.role))
    .map((section) => ({
      section_id: section.id,
      section_code: section.section_code,
      section_name: section.section_name
    }));
  return uniqueBy([...enrolledSections, ...sessionSections].filter((section) => section.section_id), "section_id");
}

function populateSelect(select, rows, selectedValue, valueKey, labeler) {
  select.innerHTML = "";
  if (!rows.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "None available";
    select.append(option);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  rows.forEach((rowData) => {
    const option = document.createElement("option");
    option.value = rowData[valueKey] || "";
    option.textContent = labeler(rowData);
    option.selected = option.value === selectedValue;
    select.append(option);
  });
}

function selectedTeacherContext() {
  try {
    const parsed = JSON.parse(localStorage.getItem(teacherContextStorageKey) || "{}");
    return {
      courseId: parsed.courseId || platformConfig().courseId || "tc2007b",
      sectionId: parsed.sectionId || "",
      sessionId: parsed.sessionId || ""
    };
  } catch (_error) {
    return {
      courseId: platformConfig().courseId || "tc2007b",
      sectionId: "",
      sessionId: ""
    };
  }
}

function selectedTeacherSession(context) {
  const selection = selectedTeacherContext();
  return (context.teacher_sessions || []).find((session) => {
    return session.session_id === selection.sessionId;
  }) || null;
}

function renderCurrentSession(context) {
  const session = selectedTeacherSession(context);
  if (!session) {
    els.currentSessionTitle.textContent = "Choose a class session";
    els.currentSessionStatus.textContent = "Unavailable";
    els.currentSessionStatus.dataset.tone = "";
    els.currentSessionMeta.textContent = "Select a section and session to focus instructor tools.";
    renderActionList(els.teacherContextLinks, [], "Choose a section and session to focus teacher tools.");
    return;
  }
  const section = [session.section_code, session.section_name].filter(Boolean).join(" · ");
  els.currentSessionTitle.textContent = session.title || "Class session";
  els.currentSessionStatus.textContent = labelize(session.state || "scheduled");
  els.currentSessionStatus.dataset.tone = session.state === "live"
    ? "good"
    : session.state === "paused"
      ? "warn"
      : "";
  els.currentSessionMeta.textContent = [session.planned_date, section].filter(Boolean).join(" · ");
  renderTeacherContextLinks();
}

function renderTeacherSupport(context) {
  renderReleasedItemsInto(els.teacherReleasedItems, context.releases || []);
  const selection = selectedTeacherContext();
  renderActionList(els.teacherReviewLinks, [
    { label: "View section insights", href: withTeacherContext("insights.html", selection) },
    { label: "Review section gradebook", href: withTeacherContext("gradebook.html", selection) }
  ], "Choose a section to focus review tools.");
}

function saveTeacherContext(context) {
  localStorage.setItem(teacherContextStorageKey, JSON.stringify(context));
}

function withTeacherContext(href, context) {
  const params = new URLSearchParams();
  if (context.courseId) params.set("course", context.courseId);
  if (context.sectionId) params.set("section", context.sectionId);
  if (context.sessionId) params.set("session", context.sessionId);
  return params.toString() ? `${href}?${params.toString()}` : href;
}

function renderActionList(target, actions, emptyText) {
  target.innerHTML = "";
  if (!actions.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = emptyText;
    target.append(empty);
    return;
  }
  actions.forEach((action) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = action.href;
    link.textContent = action.label;
    item.append(link);
    target.append(item);
  });
}

function row(label, value) {
  const item = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  item.append(strong, document.createTextNode(value));
  return item;
}

function setBusy(isBusy) {
  appBusy = isBusy;
  [els.verifyCode, els.signOut, els.refresh].forEach((button) => {
    button.disabled = isBusy;
  });
  if (isBusy) {
    els.sendCode.disabled = true;
  } else {
    updateSendCodeCooldown();
  }
  els.signedInPanel.setAttribute("aria-busy", String(isBusy && !els.signedInPanel.hidden));
  [els.courseContextSelect, els.sectionContextSelect, els.sessionContextSelect].forEach((control) => {
    control.disabled = isBusy || control.options.length === 0;
  });
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.dataset.tone = tone || "";
}

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isAllowedInstitutionalEmail(email) {
  const allowedInstitutionalDomains = platformConfig().allowedInstitutionalDomains || [];
  if (!allowedInstitutionalDomains.length) return true;
  return allowedInstitutionalDomains.some((domain) => {
    return email.endsWith(`@${String(domain || "").trim().toLowerCase().replace(/^@/, "")}`);
  });
}

function labelize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueBy(rows, key) {
  const seen = new Set();
  return rows.filter((rowData) => {
    const value = rowData[key];
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
