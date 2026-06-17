(function () {
  "use strict";

  const CONFIG = window.QUIZ_CONFIG || {};
  const IDENTITY_KEY = "tc2007b-portfolio-identity";
  const portfolioScore = document.getElementById("portfolioScore");
  const studentName = document.getElementById("studentName");
  const studentId = document.getElementById("studentId");
  const printBtn = document.getElementById("printBtn");
  const csvBtn = document.getElementById("csvBtn");
  const jsonBtn = document.getElementById("jsonBtn");
  const submitPortfolioBtn = document.getElementById("submitPortfolioBtn");
  const portfolioStatus = document.getElementById("portfolioStatus");
  const missionStat = document.getElementById("missionStat");
  const quizStat = document.getElementById("quizStat");
  const caseStat = document.getElementById("caseStat");
  const reviewStat = document.getElementById("reviewStat");
  const portfolioNote = document.getElementById("portfolioNote");
  const reportRows = document.getElementById("reportRows");
  const reflectionEvidence = document.getElementById("reflectionEvidence");

  const identity = read(IDENTITY_KEY);
  studentName.value = identity.student_name || "";
  studentId.value = identity.student_id || "";

  const missions = [
    ["tc2007b-mission-01", "Mission 01: Think Like an Attacker", 10, scoreMission01],
    ["tc2007b-mission-02", "Mission 02: Prove Who You Are", 8, (data) => (data.passwordTouched ? 2 : 0) + (data.storageCorrect ? 3 : 0) + boolCount(data.mfa)],
    ["tc2007b-mission-03", "Mission 03: Control The Door", 10, (data) => boolCount(data.models) + Math.round((Number(data.matrixScore || 0) / 12) * 4) + (data.policyCorrect ? 2 : 0)],
    ["tc2007b-mission-04", "Mission 04: Break The App Safely", 10, (data) => boolCount(data.sqli) + Math.round((Number(data.fixScore || 0) / 5) * 3) + (data.xssCorrect ? 2 : 0) + (data.boundaryCorrect ? 2 : 0)],
    ["tc2007b-bridge-04", "Bridge: Harden The Release", 10, (data) => boolCount(data.risk) + boolCount(data.defenses) + (data.releaseCorrect ? 3 : 0)],
    ["tc2007b-mission-05", "Mission 05: Exchange The Secret", 10, (data) => boolCount(data.keys) * 2 + (data.modCorrect ? 2 : 0) + (data.dhCorrect ? 1 : 0) + (data.designCorrect ? 1 : 0)],
    ["tc2007b-bridge-06", "Bridge: Protect The Data", 10, (data) => boolCount(data.modes) + boolCount(data.keys) + (data.nonceCorrect ? 3 : 0)],
    ["tc2007b-mission-06", "Mission 06: Authenticate The Message", 10, (data) => boolCount(data.protocol) * 2 + boolCount(data.hash) + (data.hmacCorrect ? 1 : 0)],
    ["tc2007b-bridge-08", "Bridge: Secure The Channel", 10, (data) => boolCount(data.certs) + boolCount(data.channels) + (data.downgradeCorrect ? 2 : 0)],
    ["tc2007b-mission-07", "Mission 07: Contain The Malware", 10, (data) => boolCount(data.classes) + Math.round((Number(data.triageScore || 0) / 5) * 4) + (data.countermeasureCorrect ? 2 : 0)],
    ["tc2007b-mission-08", "Mission 08: Build The Perimeter", 10, (data) => boolCount(data.packets) + boolCount(data.types) + (data.dmzCorrect ? 2 : 0)],
    ["tc2007b-mission-09", "Mission 09: Tune The Detector", 10, (data) => boolCount(data.alerts) + boolCount(data.approaches) + (data.baseRateCorrect ? 2 : 0)]
  ];

  const cases = [
    ["phishing-wave", "Campus Phishing Wave"],
    ["gradebook-sqli", "Gradebook Injection"],
    ["api-key-leak", "Leaked Service Key"],
    ["ransomware-lab", "Ransomware In The Lab"],
    ["noisy-ids", "The Noisy Detector"]
  ];
  const CONCEPT_TOTAL = 15;

  [studentName, studentId].forEach((field) => field.addEventListener("input", saveIdentity));
  printBtn.addEventListener("click", () => window.print());
  csvBtn.addEventListener("click", () => downloadText("tc2007b-portfolio.csv", toCsv(buildPortfolio().rows), "text/csv"));
  jsonBtn.addEventListener("click", () => downloadText("tc2007b-portfolio.json", JSON.stringify(buildPortfolio(), null, 2), "application/json"));
  submitPortfolioBtn.addEventListener("click", submitPortfolioRecord);

  render();

  function render() {
    const portfolio = buildPortfolio();
    portfolioScore.textContent = `${portfolio.summary.overall_percent}%`;
    missionStat.textContent = `${portfolio.summary.mission_average}%`;
    quizStat.textContent = `${portfolio.summary.quiz_average}%`;
    caseStat.textContent = `${portfolio.summary.case_completed}/5`;
    reviewStat.textContent = String(portfolio.summary.review_cards);
    portfolioNote.textContent = portfolio.summary.note;
    renderRows(portfolio.rows);
    renderReflections(portfolio.reflections);
  }

  function buildPortfolio() {
    const missionRows = missions.map(([key, title, total, scoreFn]) => {
      const data = read(key);
      const score = Math.min(total, scoreFn(data));
      const percent = total ? Math.round((score / total) * 100) : 0;
      return row("Mission", title, `${score}/${total}`, percent >= 80 ? "Strong" : percent ? "In progress" : "Not started", percent);
    });

    const quizRows = quizAttempts().map((attempt) => {
      const percent = attempt.total ? Math.round((Number(attempt.score || 0) / Number(attempt.total)) * 100) : 0;
      return row("Quiz", attempt.session_code || "Local quiz", `${attempt.score || 0}/${attempt.total || 0}`, percent >= 80 ? "Strong" : "Review", percent);
    });

    const caseState = read("tc2007b-case-files");
    const caseRows = cases.map(([id, title]) => {
      const result = caseState.results?.[id] || {};
      const percent = result.completed && result.total ? Math.round((Number(result.score || 0) / Number(result.total)) * 100) : 0;
      return row("Case file", title, result.completed ? `${result.score}/${result.total}` : "0/3", result.completed ? "Completed" : "Not started", percent);
    });

    const chainState = read("tc2007b-attack-chain");
    const chainResults = Object.values(chainState.results || {});
    const chainScore = chainResults.reduce((sum, item) => sum + Number(item.score || 0), 0);
    const chainChecked = chainResults.filter((item) => item.checked).length;
    const chainPercent = Math.round((chainScore / 18) * 100);
    const chainRows = [row("Attack chain", "Cross-week incident map", `${chainScore}/18`, chainChecked === 6 ? "Completed" : `${chainChecked}/6 stages`, chainPercent)];

    const conceptState = read("tc2007b-concept-map");
    const conceptRecords = Object.values(conceptState.confidence || {});
    const conceptReady = conceptRecords.filter((record) => Number(record.rating || 0) >= 4).length;
    const conceptWeak = conceptRecords.filter((record) => Number(record.rating || 0) > 0 && Number(record.rating || 0) <= 2).length;
    const conceptPercent = Math.round((conceptReady / CONCEPT_TOTAL) * 100);
    const conceptRows = [row("Concept map", "Course concept readiness", `${conceptReady}/${CONCEPT_TOTAL} ready · ${conceptWeak} review`, conceptPercent >= 70 ? "Connected" : "Needs mapping", conceptPercent)];

    const reviewState = read("tc2007b-review-coach");
    const reviewRecords = Object.values(reviewState.cards || {});
    const reviewGot = reviewRecords.filter((record) => record.last_rating === "got").length;
    const reviewAgain = reviewRecords.filter((record) => record.last_rating === "again").length;
    const reviewRows = [row("Review", "Review Coach sprint", `${reviewGot} got it / ${reviewAgain} review again`, reviewRecords.length >= 5 ? "Active habit" : "Needs practice", Math.min(100, Math.round((reviewRecords.length / 8) * 100)))];

    const reflections = readArray("tc2007b-exit-tickets");
    const reflectionRows = [row("Reflection", "Exit tickets", `${reflections.length} submitted`, reflections.length >= 2 ? "Reflective habit" : "Needs more reflections", Math.min(100, reflections.length * 50))];
    const rows = missionRows.concat(quizRows, caseRows, chainRows, conceptRows, reviewRows, reflectionRows);

    const missionAverage = average(missionRows.map((item) => item.percent));
    const quizAverage = average(quizRows.map((item) => item.percent));
    const caseCompleted = caseRows.filter((item) => item.status === "Completed").length;
    const activityAverage = average(rows.filter((item) => item.area !== "Quiz").map((item) => item.percent));
    const overallPercent = Math.round((missionAverage * 0.45) + (activityAverage * 0.35) + ((quizAverage || 0) * 0.2));
    const note = portfolioNoteFor({ missionAverage, quizAverage, caseCompleted, chainPercent, conceptPercent, reviewCards: reviewRecords.length, reflections: reflections.length });

    return {
      generated_at: new Date().toISOString(),
      student: {
        name: studentName.value.trim(),
        id: studentId.value.trim()
      },
      summary: {
        overall_percent: overallPercent,
        mission_average: missionAverage,
        quiz_average: quizAverage,
        case_completed: caseCompleted,
        attack_chain_percent: chainPercent,
        concept_map_percent: conceptPercent,
        review_cards: reviewRecords.length,
        reflections: reflections.length,
        note
      },
      rows,
      reflections: reflections.slice(0, 8)
    };
  }

  function renderRows(rows) {
    reportRows.innerHTML = "";
    rows.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td></td><td><strong></strong></td><td></td><td></td>`;
      tr.children[0].textContent = item.area;
      tr.querySelector("strong").textContent = item.item;
      tr.children[2].textContent = item.result;
      tr.children[3].textContent = item.status;
      reportRows.appendChild(tr);
    });
  }

  function renderReflections(reflections) {
    reflectionEvidence.innerHTML = "";
    if (!reflections.length) {
      reflectionEvidence.innerHTML = `<article class="reflection-card"><strong>No local reflections yet</strong><span>Exit tickets will appear here after class.</span></article>`;
      return;
    }
    reflections.slice(0, 6).forEach((ticket) => {
      const card = document.createElement("article");
      card.className = "reflection-card";
      card.innerHTML = `<strong></strong><span></span><p></p>`;
      card.querySelector("strong").textContent = ticket.lecture_title || ticket.lecture_id || "Exit ticket";
      card.querySelector("span").textContent = `${new Date(ticket.created_at).toLocaleString()} · confidence ${ticket.confidence || "-"}/5`;
      card.querySelector("p").textContent = ticket.muddy_point ? `Question: ${ticket.muddy_point}` : (ticket.one_thing || "Reflection saved.");
      reflectionEvidence.appendChild(card);
    });
  }

  function portfolioNoteFor(summary) {
    if (summary.missionAverage < 50) return "Start by completing the current mission and one case file before the next lecture.";
    if (summary.quizAverage && summary.quizAverage < 70) return "Quiz performance suggests reviewing missed concepts with the Review Coach.";
    if (summary.caseCompleted < 3) return "Complete more case files to practice security decisions in context.";
    if (summary.chainPercent < 80) return "Use the Attack Chain Lab to connect identity, app, malware, network, and detection topics.";
    if (summary.conceptPercent < 70) return "Use the Concept Map to connect prerequisite ideas before deeper review.";
    if (summary.reviewCards < 5) return "Run a short Review Coach sprint to keep concepts fresh.";
    if (summary.reflections < 2) return "Submit exit tickets after class to build a useful learning journal.";
    return "This portfolio shows a healthy learning loop: practice, quiz, reflect, and review.";
  }

  function quizAttempts() {
    const data = read("tc2007b-quiz-pilot");
    return Object.values(data.attempts || {})
      .filter((attempt) => attempt.submitted_at)
      .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
      .slice(0, 8);
  }

  function row(area, item, result, status, percent) {
    return { area, item, result, status, percent: Number(percent || 0) };
  }

  function scoreMission01(data) {
    const answers = Object.values(data.answers || {}).filter((answer) => answer.correct).length;
    return answers + (data.model ? 2 : 0) + (data.responseCorrect ? 2 : 0);
  }

  function boolCount(value) {
    return Object.values(value || {}).filter(Boolean).length;
  }

  function average(values) {
    const usable = values.filter((value) => Number.isFinite(value));
    return usable.length ? Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length) : 0;
  }

  function toCsv(rows) {
    const header = ["Area", "Item", "Result", "Status", "Percent"];
    const body = rows.map((item) => [item.area, item.item, item.result, item.status, item.percent]);
    return [header].concat(body).map((line) => line.map(csvCell).join(",")).join("\n");
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`${filename} ready.`, "good");
  }

  async function submitPortfolioRecord() {
    const portfolio = buildPortfolio();
    if (!portfolio.student.name && !portfolio.student.id) {
      setStatus("Add a name or student ID before submitting.", "warn");
      return;
    }
    if (!isConfigured()) {
      setStatus("Supabase is not configured. Use the JSON export for now.", "warn");
      return;
    }
    try {
      const result = await callFunction("course-submit-portfolio", { portfolio });
      setStatus(`Portfolio submitted: ${result.submission?.overall_percent ?? portfolio.summary.overall_percent}%.`, "good");
    } catch (error) {
      setStatus(error.message || "Unable to submit portfolio.", "warn");
    }
  }

  function isConfigured() {
    return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  }

  async function callFunction(name, payload) {
    const base = CONFIG.supabaseUrl.replace(/\/$/, "");
    const response = await fetch(`${base}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: CONFIG.supabaseAnonKey,
        Authorization: `Bearer ${CONFIG.supabaseAnonKey}`
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Request failed with status ${response.status}.`);
    }
    return body;
  }

  function saveIdentity() {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({
      student_name: studentName.value.trim(),
      student_id: studentId.value.trim()
    }));
  }

  function setStatus(message, tone) {
    portfolioStatus.textContent = message;
    if (tone) portfolioStatus.dataset.tone = tone;
    else portfolioStatus.removeAttribute("data-tone");
  }

  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch (_error) {
      return {};
    }
  }

  function readArray(key) {
    const value = read(key);
    return Array.isArray(value) ? value : [];
  }
})();
