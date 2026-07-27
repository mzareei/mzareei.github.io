import { captureTestAccessFromUrl, getSession, isConfigured, isTestAccessEmail, loadCourseContext, platformConfig, sendOtp, signOut, verifyOtp } from "./auth-api.js";

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
  teacherNavToggle: document.getElementById("teacherNavToggle"),
  teacherNavClose: document.getElementById("teacherNavClose"),
  teacherNavHome: document.getElementById("teacherNavHome"),
  teacherNavBackdrop: document.getElementById("teacherNavBackdrop"),
  accountMenuButton: document.getElementById("accountMenuButton"),
  accountPanel: document.getElementById("accountPanel"),
  enrollmentRequiredPanel: document.getElementById("enrollmentRequiredPanel"),
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
const mobileNavigationQuery = window.matchMedia("(max-width: 900px)");
let navigationWasMobile = mobileNavigationQuery.matches;
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
els.accountMenuButton.addEventListener("click", () => {
  const expanded = els.accountMenuButton.getAttribute("aria-expanded") === "true";
  setDisclosure(els.accountMenuButton, els.accountPanel, !expanded);
});
els.teacherNavToggle.addEventListener("click", () => {
  const expanded = els.teacherNavToggle.getAttribute("aria-expanded") === "true";
  setDisclosure(els.teacherNavToggle, els.teacherNavigation, !expanded);
});
els.teacherNavClose.addEventListener("click", () => closeTeacherNavigation(true));
els.teacherNavBackdrop.addEventListener("click", () => closeTeacherNavigation(true));
document.addEventListener("keydown", (event) => {
  if (event.key === "Tab" && isMobileNavigationOpen()) {
    containTeacherNavigationFocus(event);
    return;
  }
  if (event.key === "Escape") {
    const accountWasOpen = els.accountMenuButton.getAttribute("aria-expanded") === "true";
    const navigationWasOpen = els.teacherNavToggle.getAttribute("aria-expanded") === "true";
    closeCommandDisclosures();
    if (navigationWasOpen) els.teacherNavToggle.focus();
    else if (accountWasOpen) els.accountMenuButton.focus();
  }
});
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest(".account-control")) {
    setDisclosure(els.accountMenuButton, els.accountPanel, false);
  }
  if (isMobileNavigationOpen()
      && !target.closest("#teacherNavigation")
      && !target.closest("#teacherNavToggle")) {
    closeTeacherNavigation(true);
  }
});
mobileNavigationQuery.addEventListener("change", syncTeacherNavigationAccessibility);

init();

function setDisclosure(trigger, panel, expanded) {
  trigger.setAttribute("aria-expanded", String(expanded));
  if (panel === els.teacherNavigation) {
    panel.classList.toggle("is-open", expanded);
    syncTeacherNavigationAccessibility();
    if (expanded && mobileNavigationQuery.matches) els.teacherNavClose.focus();
  } else {
    panel.hidden = !expanded;
  }
}

function closeCommandDisclosures() {
  setDisclosure(els.accountMenuButton, els.accountPanel, false);
  closeTeacherNavigation(false);
}

function closeTeacherNavigation(restoreFocus) {
  const wasOpen = isMobileNavigationOpen();
  setDisclosure(els.teacherNavToggle, els.teacherNavigation, false);
  if (restoreFocus && wasOpen) els.teacherNavToggle.focus();
}

function isMobileNavigationOpen() {
  return mobileNavigationQuery.matches
    && els.teacherNavToggle.getAttribute("aria-expanded") === "true";
}

function teacherNavigationFocusableElements() {
  return Array.from(els.teacherNavigation.querySelectorAll(
    'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

function containTeacherNavigationFocus(event) {
  const focusable = teacherNavigationFocusableElements();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !els.teacherNavigation.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !els.teacherNavigation.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}

function syncTeacherNavigationAccessibility() {
  const isMobile = mobileNavigationQuery.matches;
  const isOpen = isMobile && els.teacherNavToggle.getAttribute("aria-expanded") === "true";
  if (navigationWasMobile && !isMobile && document.activeElement === els.teacherNavClose) {
    els.teacherNavHome.focus();
  } else if (!navigationWasMobile && isMobile && !isOpen
      && els.teacherNavigation.contains(document.activeElement)) {
    els.teacherNavToggle.focus();
  }
  if (!isMobile) {
    els.teacherNavigation.classList.remove("is-open");
    els.teacherNavToggle.setAttribute("aria-expanded", "false");
  }
  els.teacherNavigation.toggleAttribute("inert", !isOpen && isMobile);
  els.teacherNavigation.setAttribute("aria-hidden", String(!isOpen && isMobile));
  els.teacherNavBackdrop.hidden = !isOpen;
  navigationWasMobile = isMobile;
}

async function init() {
  const capturedTestAccessEmail = captureTestAccessFromUrl();
  if (capturedTestAccessEmail && !els.email.value) {
    els.email.value = capturedTestAccessEmail;
  }

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

  if (capturedTestAccessEmail && !currentSession) {
    setStatus(`QA test access enabled on this device for ${capturedTestAccessEmail}. Send the sign-in email to continue.`, "good");
  }
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
  closeCommandDisclosures();
  currentContext = null;
  els.signedOutPanel.hidden = false;
  els.signedInPanel.hidden = true;
  els.studentDashboard.hidden = true;
  els.teacherDashboard.hidden = true;
  els.enrollmentRequiredPanel.hidden = true;
  els.teacherNavToggle.hidden = true;
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
  const memberships = (context.memberships || []).filter((membership) => membership.status === "active");
  const sections = context.sections || [];
  const courseInstructor = memberships.some((membership) => {
    return ["platform_owner", "instructor"].includes(membership.role);
  });
  return {
    hasStudentRole: sections.some((section) => section.role === "student"),
    canTeach: memberships.some((membership) => {
      return ["platform_owner", "instructor", "teaching_assistant"].includes(membership.role);
    }) || sections.some((section) => section.role === "teaching_assistant"),
    canAudit: courseInstructor,
    canManageCourse: courseInstructor
  };
}

function renderContext(context) {
  closeCommandDisclosures();
  currentContext = context;
  els.signedOutPanel.hidden = true;
  els.signedInPanel.hidden = false;
  const profile = context.profile || {};
  const accountName = profile.preferred_name || profile.full_name || "Account";
  els.accountMenuButton.textContent = accountName;
  els.accountMenuButton.setAttribute("aria-label", accountName === "Account" ? "Account" : `Account for ${accountName}`);
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
  els.enrollmentRequiredPanel.hidden = capabilities.canTeach || capabilities.hasStudentRole;
  els.teacherNavToggle.hidden = !capabilities.canTeach;
  renderTeacherContextSwitchers(context, capabilities.canTeach);
  renderTeacherNavigation(capabilities);
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

function teacherNavigationGroups(capabilities) {
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
    }
  ];
  if (capabilities.canAudit) {
    groups[1].items.push({ label: "Review Audit Log", href: "audit.html", contextual: false });
  }
  if (capabilities.canManageCourse) {
    groups.push({
      label: "Manage",
      items: [
        { label: "Course Sections", href: "sections.html", contextual: false },
        { label: "Course Roster", href: "roster.html", contextual: false },
        { label: "Content Library", href: "content-library.html", contextual: false }
      ]
    });
  }
  return groups;
}

function renderTeacherNavigation(capabilities) {
  els.teacherActions.innerHTML = "";
  if (!capabilities.canTeach) return;
  const context = selectedTeacherContext();
  teacherNavigationGroups(capabilities).forEach((group) => {
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
  renderTeacherNavigation(roleCapabilities(currentContext || {}));
  renderTeacherContextLinks();
  renderCurrentSession(currentContext || {});
  renderTeacherSupport(currentContext || {});
}

function renderTeacherContextLinks(session = selectedTeacherSession(currentContext || {})) {
  const context = selectedTeacherContext();
  if (!session) {
    const capabilities = roleCapabilities(currentContext || {});
    const emptyActions = context.sectionId ? [{
      label: "Manage Class Sessions",
      href: withTeacherContext("sessions.html", { courseId: context.courseId, sectionId: context.sectionId }),
      primary: true
    }] : capabilities.canManageCourse ? [{
      label: "Course Sections",
      href: withTeacherContext("sections.html", { courseId: context.courseId }),
      primary: true
    }] : [];
    renderActionList(
      els.teacherContextLinks,
      emptyActions,
      "A section assignment is required before class sessions are available."
    );
    return;
  }
  const actions = [
    { label: "Manage selected session", href: withTeacherContext("sessions.html", context) },
    { label: "Prepare selected releases", href: withTeacherContext("releases.html", context) }
  ];
  if (context.sectionId) {
    actions.push(
      { label: "View section insights", href: withTeacherContext("insights.html", context) },
      { label: "Review section gradebook", href: withTeacherContext("gradebook.html", context) }
    );
  }
  const primaryLabel = session.state === "planned"
    ? "Prepare selected releases"
    : session.state === "closed" && context.sectionId
      ? "Review section gradebook"
      : "Manage selected session";
  const links = actions
    .map((action) => ({ ...action, primary: action.label === primaryLabel }))
    .sort((left, right) => Number(right.primary) - Number(left.primary))
    .slice(0, 4);
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
    renderTeacherContextLinks(null);
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
  renderTeacherContextLinks(session);
}

function renderTeacherSupport(context) {
  renderReleasedItemsInto(els.teacherReleasedItems, context.releases || []);
  const selection = selectedTeacherContext();
  const reviewLinks = selection.sectionId ? [
    { label: "View section insights", href: withTeacherContext("insights.html", selection) },
    { label: "Review section gradebook", href: withTeacherContext("gradebook.html", selection) }
  ] : [];
  renderActionList(els.teacherReviewLinks, reviewLinks, "Choose a section to focus review tools.");
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
    if (action.primary) link.classList.add("session-primary-action");
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
  if (isTestAccessEmail(email)) return true;
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
