(function () {
  "use strict";

  const CONFIG = window.QUIZ_CONFIG || {};
  const portfolioFile = document.getElementById("portfolioFile");
  const portfolioJson = document.getElementById("portfolioJson");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const demoBtn = document.getElementById("demoBtn");
  const clearBtn = document.getElementById("clearBtn");
  const assessmentStatus = document.getElementById("assessmentStatus");
  const finalGrade = document.getElementById("finalGrade");
  const studentName = document.getElementById("studentName");
  const studentMeta = document.getElementById("studentMeta");
  const coverageValue = document.getElementById("coverageValue");
  const coverageMeta = document.getElementById("coverageMeta");
  const signalTitle = document.getElementById("signalTitle");
  const signalText = document.getElementById("signalText");
  const rubricRows = document.getElementById("rubricRows");
  const gapList = document.getElementById("gapList");
  const portfolioTeacherPin = document.getElementById("portfolioTeacherPin");
  const loadPortfolioSummaryBtn = document.getElementById("loadPortfolioSummaryBtn");
  const exportPortfolioSummaryBtn = document.getElementById("exportPortfolioSummaryBtn");
  const portfolioSummaryStatus = document.getElementById("portfolioSummaryStatus");
  const submissionStats = document.getElementById("submissionStats");
  const portfolioSubmissions = document.getElementById("portfolioSubmissions");
  let lastPortfolioSummary = null;

  const RUBRIC = [
    {
      key: "quiz",
      category: "Quiz mastery",
      evidence: "Live and local quiz attempts",
      weight: 25,
      areas: ["quiz"]
    },
    {
      key: "missions",
      category: "Mission practice",
      evidence: "Weekly browser missions and bridge missions",
      weight: 25,
      areas: ["mission"]
    },
    {
      key: "scenario",
      category: "Scenario reasoning",
      evidence: "Case files and attack-chain mapping",
      weight: 25,
      areas: ["case file", "attack chain"]
    },
    {
      key: "reflection",
      category: "Reflection and review",
      evidence: "Exit tickets, Concept Map, and Review Coach cards",
      weight: 15,
      areas: ["reflection", "review", "concept map"]
    },
    {
      key: "coverage",
      category: "Portfolio coverage",
      evidence: "Breadth of submitted evidence rows",
      weight: 10,
      coverage: true
    }
  ];

  const demoPortfolio = {
    generated_at: new Date().toISOString(),
    student: { name: "Demo Student", id: "A00000000" },
    rows: [
      { area: "Mission", item: "Mission 01: Think Like an Attacker", result: "9/10", status: "Strong", percent: 90 },
      { area: "Mission", item: "Mission 02: Prove Who You Are", result: "7/8", status: "Strong", percent: 88 },
      { area: "Quiz", item: "Week 1 live quiz", result: "8/10", status: "Strong", percent: 80 },
      { area: "Quiz", item: "Week 2 live quiz", result: "6/10", status: "Review", percent: 60 },
      { area: "Case file", item: "Campus Phishing Wave", result: "3/3", status: "Completed", percent: 100 },
      { area: "Attack chain", item: "Cross-week incident map", result: "13/18", status: "4/6 stages", percent: 72 },
      { area: "Review", item: "Review Coach sprint", result: "6 got it / 2 review again", status: "Active habit", percent: 100 },
      { area: "Reflection", item: "Exit tickets", result: "2 submitted", status: "Reflective habit", percent: 100 }
    ]
  };

  portfolioFile.addEventListener("change", readFile);
  analyzeBtn.addEventListener("click", analyzeText);
  demoBtn.addEventListener("click", () => {
    portfolioJson.value = JSON.stringify(demoPortfolio, null, 2);
    analyzeText();
  });
  clearBtn.addEventListener("click", () => {
    portfolioFile.value = "";
    portfolioJson.value = "";
    renderEmpty();
    setStatus("Cleared.", "");
  });
  loadPortfolioSummaryBtn.addEventListener("click", loadPortfolioSummary);
  exportPortfolioSummaryBtn.addEventListener("click", exportPortfolioSummary);

  renderEmpty();
  renderPortfolioSummaryEmpty();

  function readFile() {
    const file = portfolioFile.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      portfolioJson.value = String(reader.result || "");
      analyzeText();
    });
    reader.addEventListener("error", () => setStatus("Could not read file.", "warn"));
    reader.readAsText(file);
  }

  function analyzeText() {
    try {
      const portfolio = JSON.parse(portfolioJson.value || "{}");
      renderAssessment(calculateWeightedGrade(portfolio));
      setStatus("Portfolio analyzed.", "good");
    } catch (_error) {
      setStatus("Portfolio JSON is not valid.", "warn");
    }
  }

  function calculateWeightedGrade(portfolio) {
    const rows = Array.isArray(portfolio?.rows) ? portfolio.rows : [];
    const countedRows = rows.filter((row) => Number(row.percent) > 0);
    const coveragePercent = rows.length ? Math.round((countedRows.length / rows.length) * 100) : 0;
    const categories = RUBRIC.map((item) => {
      const score = item.coverage ? coveragePercent : averageForAreas(rows, item.areas);
      const evidenceCount = item.coverage ? countedRows.length : countForAreas(rows, item.areas);
      const contribution = Math.round((score * item.weight) / 100);
      return Object.assign({}, item, { score, evidenceCount, contribution });
    });
    const finalPercent = Math.round(categories.reduce((sum, item) => sum + item.contribution, 0));
    const gaps = buildGaps(categories, rows);
    const signal = buildSignal(categories, finalPercent);

    return {
      generatedAt: portfolio?.generated_at || "",
      student: portfolio?.student || {},
      rows,
      rowCount: rows.length,
      countedRows: countedRows.length,
      coveragePercent,
      categories,
      finalPercent,
      gaps,
      signal
    };
  }

  function renderAssessment(assessment) {
    finalGrade.textContent = `${assessment.finalPercent}%`;
    studentName.textContent = assessment.student.name || "Unnamed student";
    studentMeta.textContent = [assessment.student.id, readableDate(assessment.generatedAt)]
      .filter(Boolean)
      .join(" · ") || "Portfolio export loaded.";
    coverageValue.textContent = `${assessment.coveragePercent}%`;
    coverageMeta.textContent = `${assessment.countedRows}/${assessment.rowCount} evidence rows counted.`;
    signalTitle.textContent = assessment.signal.title;
    signalText.textContent = assessment.signal.text;
    renderRubric(assessment.categories);
    renderGaps(assessment.gaps);
  }

  function renderEmpty() {
    finalGrade.textContent = "0%";
    studentName.textContent = "No portfolio loaded";
    studentMeta.textContent = "Import one JSON export to begin.";
    coverageValue.textContent = "0%";
    coverageMeta.textContent = "0 evidence rows counted.";
    signalTitle.textContent = "Waiting for evidence";
    signalText.textContent = "The strongest signal appears after analysis.";
    renderRubric(RUBRIC.map((item) => Object.assign({}, item, { score: 0, evidenceCount: 0, contribution: 0 })));
    renderGaps([{ title: "No portfolio loaded", detail: "Use a JSON export from the Learning Portfolio." }]);
  }

  function renderRubric(categories) {
    rubricRows.innerHTML = "";
    categories.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td><strong></strong></td><td></td><td></td><td></td><td></td>";
      tr.querySelector("strong").textContent = item.category;
      tr.children[1].textContent = item.evidence;
      tr.children[2].textContent = `${item.weight}%`;
      tr.children[3].textContent = `${item.score}%`;
      tr.children[4].textContent = `${item.contribution} pts`;
      rubricRows.appendChild(tr);
    });
  }

  function renderGaps(gaps) {
    gapList.innerHTML = "";
    gaps.forEach((gap) => {
      const item = document.createElement("div");
      item.className = "gap-item";
      item.innerHTML = "<strong></strong><span></span>";
      item.querySelector("strong").textContent = gap.title;
      item.querySelector("span").textContent = gap.detail;
      gapList.appendChild(item);
    });
  }

  function averageForAreas(rows, areas) {
    const values = rows
      .filter((row) => areas.includes(normalizeArea(row.area)))
      .map((row) => Number(row.percent))
      .filter(Number.isFinite);
    return average(values);
  }

  function countForAreas(rows, areas) {
    return rows.filter((row) => areas.includes(normalizeArea(row.area))).length;
  }

  function buildGaps(categories, rows) {
    if (!rows.length) {
      return [{ title: "No evidence rows", detail: "Ask the student for the JSON export from the Learning Portfolio." }];
    }
    const gaps = [];
    categories.forEach((item) => {
      if (item.evidenceCount === 0) {
        gaps.push({ title: `${item.category} missing`, detail: item.evidence });
      } else if (item.score < 70) {
        gaps.push({ title: `${item.category} below target`, detail: `${item.score}% from ${item.evidenceCount} evidence item(s).` });
      }
    });
    if (!gaps.length) {
      gaps.push({ title: "Evidence looks healthy", detail: "The portfolio has breadth and no category below 70%." });
    }
    return gaps;
  }

  function buildSignal(categories, finalPercent) {
    const byKey = Object.fromEntries(categories.map((item) => [item.key, item]));
    if (finalPercent >= 85 && byKey.coverage.score >= 80) {
      return { title: "Strong learning loop", text: "Move this student toward explanation, peer support, or a harder case." };
    }
    if (byKey.quiz.score < 70) {
      return { title: "Revisit quiz concepts", text: "Use missed quiz concepts for the next opening pulse or Review Coach sprint." };
    }
    if (byKey.missions.score < 70) {
      return { title: "Practice gap", text: "Ask for the current mission before assigning a deeper scenario." };
    }
    if (byKey.scenario.score < 70) {
      return { title: "Reasoning gap", text: "Use Case Files or the Attack Chain Lab to connect controls to incidents." };
    }
    if (byKey.reflection.score < 70) {
      return { title: "Reflection gap", text: "Use exit tickets to capture confusion before the next lecture." };
    }
    return { title: "Solid progress", text: "Keep the lecture rhythm: quick quiz, decision practice, reflection, review." };
  }

  function normalizeArea(area) {
    return String(area || "").trim().toLowerCase();
  }

  function average(values) {
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  }

  function readableDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function setStatus(message, tone) {
    assessmentStatus.textContent = message;
    if (tone) assessmentStatus.dataset.tone = tone;
    else assessmentStatus.removeAttribute("data-tone");
  }

  async function loadPortfolioSummary() {
    if (!isConfigured()) {
      setPortfolioSummaryStatus("Supabase is not configured.", "warn");
      return;
    }
    try {
      const summary = await callFunction("course-portfolio-summary", {
        teacher_pin: portfolioTeacherPin.value
      });
      lastPortfolioSummary = summary;
      renderPortfolioSummary(summary);
      setPortfolioSummaryStatus("Portfolio summary loaded.", "good");
    } catch (error) {
      setPortfolioSummaryStatus(error.message || "Unable to load submissions.", "warn");
    }
  }

  function renderPortfolioSummary(summary) {
    const stats = summary.stats || {};
    submissionStats.innerHTML = "";
    [
      ["Total", stats.total || 0],
      ["Avg grade", `${stats.average_overall || 0}%`],
      ["Low evidence", stats.low_evidence || 0],
      ["Avg concept", `${stats.average_concept_map || 0}%`]
    ].forEach(([label, value]) => {
      const card = document.createElement("div");
      card.innerHTML = "<strong></strong><span></span>";
      card.querySelector("strong").textContent = value;
      card.querySelector("span").textContent = label;
      submissionStats.appendChild(card);
    });

    portfolioSubmissions.innerHTML = "";
    const submissions = summary.submissions || [];
    if (!submissions.length) {
      portfolioSubmissions.innerHTML = `<article class="submission-row"><strong>No portfolio submissions yet</strong><span>Student records will appear here after they submit.</span></article>`;
      return;
    }
    submissions.slice(0, 20).forEach((submission) => {
      const row = document.createElement("article");
      row.className = "submission-row";
      row.innerHTML = "<strong></strong><span></span><span></span><span></span><span></span>";
      row.querySelector("strong").textContent = submission.student_name || submission.student_identifier || "Unnamed student";
      row.children[1].textContent = `${submission.overall_percent || 0}% overall`;
      row.children[2].textContent = `${submission.quiz_average || 0}% quiz`;
      row.children[3].textContent = `${submission.concept_map_percent || 0}% map`;
      row.children[4].textContent = new Date(submission.created_at).toLocaleString();
      portfolioSubmissions.appendChild(row);
    });
  }

  function renderPortfolioSummaryEmpty() {
    submissionStats.innerHTML = "";
    portfolioSubmissions.innerHTML = `<article class="submission-row"><strong>No portfolio submissions loaded</strong><span>Use the teacher PIN to load Supabase records.</span></article>`;
  }

  function exportPortfolioSummary() {
    const submissions = lastPortfolioSummary?.submissions || [];
    if (!submissions.length) {
      setPortfolioSummaryStatus("Load submissions before exporting.", "warn");
      return;
    }
    const rows = [
      ["student_name", "student_identifier", "overall_percent", "mission_average", "quiz_average", "case_completed", "attack_chain_percent", "concept_map_percent", "review_cards", "reflections", "created_at"],
      ...submissions.map((submission) => [
        submission.student_name || "",
        submission.student_identifier || "",
        submission.overall_percent ?? "",
        submission.mission_average ?? "",
        submission.quiz_average ?? "",
        submission.case_completed ?? "",
        submission.attack_chain_percent ?? "",
        submission.concept_map_percent ?? "",
        submission.review_cards ?? "",
        submission.reflections ?? "",
        submission.created_at || ""
      ])
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tc2007b-portfolio-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setPortfolioSummaryStatus("CSV exported.", "good");
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

  function setPortfolioSummaryStatus(message, tone) {
    portfolioSummaryStatus.textContent = message;
    if (tone) portfolioSummaryStatus.dataset.tone = tone;
    else portfolioSummaryStatus.removeAttribute("data-tone");
  }

  function csvCell(value) {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  window.calculateWeightedGrade = calculateWeightedGrade;
})();
