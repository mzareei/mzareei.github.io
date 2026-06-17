(function () {
  "use strict";

  const STORE_KEY = "tc2007b-attack-chain";
  const state = readState();
  const chainScore = document.getElementById("chainScore");
  const stageList = document.getElementById("stageList");
  const stageKicker = document.getElementById("stageKicker");
  const stageTitle = document.getElementById("stageTitle");
  const stageStory = document.getElementById("stageStory");
  const evidenceGrid = document.getElementById("evidenceGrid");
  const decisionGrid = document.getElementById("decisionGrid");
  const checkStageBtn = document.getElementById("checkStageBtn");
  const nextStageBtn = document.getElementById("nextStageBtn");
  const resetLabBtn = document.getElementById("resetLabBtn");
  const stageStatus = document.getElementById("stageStatus");
  const stageDebrief = document.getElementById("stageDebrief");
  const debriefTitle = document.getElementById("debriefTitle");
  const debriefText = document.getElementById("debriefText");

  const stages = [
    {
      id: "initial-access",
      label: "Stage 01",
      title: "Initial Access",
      story: "A fake scholarship email leads students to a convincing login page. One teaching assistant approves an MFA prompt without checking the origin.",
      evidence: [
        ["Email clue", "Reply-To domain is not the university domain."],
        ["Identity clue", "Login came from a new country minutes after the TA logged in locally."],
        ["User action", "MFA approval happened immediately after password entry."]
      ],
      decisions: {
        weak: ["Weak point", ["Missing phishing-resistant MFA", "SQL string concatenation", "Expired TLS certificate"], 0],
        control: ["Best control", ["Passkeys or hardware security keys", "Open more firewall ports", "Use faster hashes"], 0],
        signal: ["Detection signal", ["Impossible travel and suspicious MFA push", "CSS color mismatch", "Disk space warning"], 0]
      },
      debrief: "The first failure is identity trust. Stronger origin-bound authentication and identity anomaly alerts reduce the chance that a fake page becomes account control."
    },
    {
      id: "privilege-abuse",
      label: "Stage 02",
      title: "Privilege Abuse",
      story: "The compromised account can read more grade records than the TA needs. The attacker exports a full class roster before anyone notices.",
      evidence: [
        ["Permission clue", "The TA account can access every course, not only assigned sections."],
        ["Data clue", "Large export from a low-privilege user profile."],
        ["Timing clue", "Export happened outside normal grading hours."]
      ],
      decisions: {
        weak: ["Weak point", ["Overbroad authorization", "Nonce reuse", "Stored XSS"], 0],
        control: ["Best control", ["Least-privilege RBAC or ABAC", "Disable all logs", "Use a shorter password"], 0],
        signal: ["Detection signal", ["Unusual data volume for the role", "A successful font load", "Normal homepage visit"], 0]
      },
      debrief: "Authentication was not enough. Authorization should limit what the account can do, and monitoring should notice access patterns outside the role."
    },
    {
      id: "app-exploit",
      label: "Stage 03",
      title: "Application Exploit",
      story: "The attacker finds an admin search box that joins input into a SQL query. A crafted search reveals hidden student records.",
      evidence: [
        ["Code clue", "Query is assembled with direct input concatenation."],
        ["Error clue", "Database error reveals a table name."],
        ["Result clue", "Search returns records outside the chosen course."]
      ],
      decisions: {
        weak: ["Weak point", ["Input becomes SQL code", "MFA challenge fatigue", "False positive IDS alert"], 0],
        control: ["Best control", ["Parameterized queries plus server-side validation", "Hide the search link only", "Compress the database"], 0],
        signal: ["Detection signal", ["SQL errors and abnormal query patterns", "A normal certificate chain", "A successful backup"], 0]
      },
      debrief: "The app crossed a trust boundary. Server-side validation, parameterized queries, and database least privilege limit this stage."
    },
    {
      id: "malware-persistence",
      label: "Stage 04",
      title: "Malware Persistence",
      story: "A downloaded grading helper silently installs a scheduled task and contacts a remote command endpoint after every reboot.",
      evidence: [
        ["Host clue", "New scheduled task appears after installer runs."],
        ["Network clue", "Repeated outbound connections to an unknown domain."],
        ["Privilege clue", "The helper requested administrator rights."]
      ],
      decisions: {
        weak: ["Weak point", ["Untrusted software executed with high privilege", "Certificate transparency monitoring", "Role-based grading"], 0],
        control: ["Best control", ["Application control plus EDR monitoring", "Plain MD5 hash of the file name", "Disable MFA"], 0],
        signal: ["Detection signal", ["New persistence item and suspicious outbound traffic", "Lecture slide count", "A valid CSS file"], 0]
      },
      debrief: "Malware defense needs layered controls: reduce execution, detect persistence, and watch host plus network behavior together."
    },
    {
      id: "data-exfiltration",
      label: "Stage 05",
      title: "Data Exfiltration",
      story: "The attacker packages exported records and uploads them to a public file-sharing service from inside the campus network.",
      evidence: [
        ["Data clue", "Compressed archive created from student records."],
        ["Network clue", "Large upload to a domain never used by the course platform."],
        ["Channel clue", "Traffic leaves through an allowed outbound path."]
      ],
      decisions: {
        weak: ["Weak point", ["No egress monitoring for sensitive exports", "All passwords are too long", "The page uses HTTPS"], 0],
        control: ["Best control", ["Data-loss monitoring and restricted outbound policy", "Turn off backups", "Make every account admin"], 0],
        signal: ["Detection signal", ["Large unusual upload after sensitive data access", "Normal login banner", "Successful image load"], 0]
      },
      debrief: "Confidentiality can fail after earlier controls fail. Egress monitoring, segmentation, and sensitive-data rules help contain the final step."
    },
    {
      id: "detection-response",
      label: "Stage 06",
      title: "Detection And Response",
      story: "The SOC receives identity alerts, database errors, endpoint telemetry, and firewall logs. Some alerts are noisy, but a few line up into one incident.",
      evidence: [
        ["Identity", "Impossible travel followed by large export."],
        ["Application", "SQL errors from the same account."],
        ["Endpoint", "New persistence item on one workstation."]
      ],
      decisions: {
        weak: ["Weak point", ["Alerts are not correlated into one story", "TLS is too encrypted", "Passwords are salted"], 0],
        control: ["Best control", ["Correlate signals, isolate affected host, revoke sessions, and preserve evidence", "Delete all logs", "Wait until every alert is certain"], 0],
        signal: ["Detection signal", ["Identity + app + host + network evidence together", "One isolated typo", "A low battery warning"], 0]
      },
      debrief: "A defender wins by connecting signals into a story, prioritizing the highest-risk path, and responding without destroying evidence."
    }
  ];

  let activeStageId = state.activeStageId || stages[0].id;

  checkStageBtn.addEventListener("click", checkStage);
  nextStageBtn.addEventListener("click", nextStage);
  resetLabBtn.addEventListener("click", resetLab);

  render();

  function render() {
    renderStages();
    renderActiveStage();
    renderScore();
  }

  function renderStages() {
    stageList.innerHTML = "";
    stages.forEach((stage) => {
      const result = state.results[stage.id];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stage-button";
      button.classList.toggle("is-active", stage.id === activeStageId);
      button.classList.toggle("is-complete", Boolean(result?.checked));
      button.innerHTML = `<strong></strong><span></span>`;
      button.querySelector("strong").textContent = stage.title;
      button.querySelector("span").textContent = stage.label;
      if (result?.checked) {
        const badge = document.createElement("em");
        badge.textContent = `${result.score}/3`;
        button.appendChild(badge);
      }
      button.addEventListener("click", () => {
        activeStageId = stage.id;
        state.activeStageId = activeStageId;
        save();
        render();
      });
      stageList.appendChild(button);
    });
  }

  function renderActiveStage() {
    const stage = currentStage();
    const answers = state.answers[stage.id] || {};
    const checked = Boolean(state.results[stage.id]?.checked);
    stageKicker.textContent = `${stage.label} · Attack path`;
    stageTitle.textContent = stage.title;
    stageStory.textContent = stage.story;
    evidenceGrid.innerHTML = "";
    stage.evidence.forEach(([title, body]) => {
      const card = document.createElement("article");
      card.className = "evidence-card";
      card.innerHTML = `<strong></strong><span></span>`;
      card.querySelector("strong").textContent = title;
      card.querySelector("span").textContent = body;
      evidenceGrid.appendChild(card);
    });

    decisionGrid.innerHTML = "";
    Object.entries(stage.decisions).forEach(([key, [title, options, answerIndex]]) => {
      const card = document.createElement("article");
      card.className = "decision-card";
      card.innerHTML = `<h3></h3><div></div>`;
      card.querySelector("h3").textContent = title;
      const optionWrap = card.querySelector("div");
      options.forEach((option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chain-option";
        button.textContent = option;
        button.classList.toggle("is-selected", Number(answers[key]) === index);
        button.classList.toggle("is-correct", checked && index === answerIndex);
        button.classList.toggle("is-wrong", checked && Number(answers[key]) === index && index !== answerIndex);
        button.addEventListener("click", () => {
          state.answers[stage.id] = state.answers[stage.id] || {};
          state.answers[stage.id][key] = index;
          delete state.results[stage.id];
          save();
          render();
        });
        optionWrap.appendChild(button);
      });
      decisionGrid.appendChild(card);
    });
    renderDebrief(stage);
  }

  function checkStage() {
    const stage = currentStage();
    const answers = state.answers[stage.id] || {};
    const keys = Object.keys(stage.decisions);
    if (keys.some((key) => answers[key] == null)) {
      setStatus("Choose one answer in each column.", "warn");
      return;
    }
    const score = keys.reduce((sum, key) => {
      const answerIndex = stage.decisions[key][2];
      return sum + (Number(answers[key]) === answerIndex ? 1 : 0);
    }, 0);
    state.results[stage.id] = {
      checked: true,
      score,
      total: 3,
      checked_at: new Date().toISOString()
    };
    save();
    setStatus("Stage checked.", score === 3 ? "good" : "warn");
    render();
  }

  function nextStage() {
    const index = stages.findIndex((stage) => stage.id === activeStageId);
    const next = stages[(index + 1) % stages.length];
    activeStageId = next.id;
    state.activeStageId = activeStageId;
    save();
    setStatus("", "");
    render();
  }

  function resetLab() {
    state.answers = {};
    state.results = {};
    state.activeStageId = stages[0].id;
    activeStageId = stages[0].id;
    save();
    setStatus("Lab reset.", "good");
    render();
  }

  function renderDebrief(stage) {
    const result = state.results[stage.id];
    stageDebrief.classList.toggle("is-visible", Boolean(result?.checked));
    if (!result?.checked) return;
    debriefTitle.textContent = result.score === 3 ? "Stage mapped cleanly" : "Stage needs another pass";
    debriefText.textContent = result.score === 3
      ? stage.debrief
      : `${stage.debrief} Recheck the highlighted choices and look for the weak point, control, and signal that directly match the evidence.`;
  }

  function renderScore() {
    const totals = stages.reduce((acc, stage) => {
      const result = state.results[stage.id];
      acc.score += Number(result?.score || 0);
      acc.total += 3;
      return acc;
    }, { score: 0, total: 0 });
    const percent = totals.total ? Math.round((totals.score / totals.total) * 100) : 0;
    chainScore.textContent = `${percent}%`;
  }

  function currentStage() {
    return stages.find((stage) => stage.id === activeStageId) || stages[0];
  }

  function setStatus(message, tone) {
    stageStatus.textContent = message;
    if (tone) stageStatus.dataset.tone = tone;
    else stageStatus.removeAttribute("data-tone");
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return {
        activeStageId: parsed.activeStageId,
        answers: parsed.answers || {},
        results: parsed.results || {}
      };
    } catch (_error) {
      return { answers: {}, results: {} };
    }
  }
})();
