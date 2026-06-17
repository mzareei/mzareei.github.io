(function () {
  "use strict";

  const STORE_KEY = "tc2007b-case-files";
  const state = readState();
  const caseScore = document.getElementById("caseScore");
  const caseList = document.getElementById("caseList");
  const caseKicker = document.getElementById("caseKicker");
  const caseTitle = document.getElementById("caseTitle");
  const caseSummary = document.getElementById("caseSummary");
  const evidenceGrid = document.getElementById("evidenceGrid");
  const decisionStack = document.getElementById("decisionStack");
  const checkCaseBtn = document.getElementById("checkCaseBtn");
  const resetCaseBtn = document.getElementById("resetCaseBtn");
  const caseStatus = document.getElementById("caseStatus");
  const caseDebrief = document.getElementById("caseDebrief");
  const debriefTitle = document.getElementById("debriefTitle");
  const debriefText = document.getElementById("debriefText");

  const cases = [
    {
      id: "phishing-wave",
      label: "Case 01",
      title: "Campus Phishing Wave",
      week: "Weeks 1-2",
      summary: "Several students report a fake scholarship email that points to a login page copying the university portal.",
      evidence: [
        ["Email header", "Reply-To domain differs from the university domain."],
        ["Landing page", "The page asks for password and MFA approval immediately."],
        ["Login logs", "Several accounts show impossible travel within one hour."]
      ],
      decisions: [
        {
          prompt: "What is the best first response?",
          options: ["Warn students only", "Revoke suspicious sessions, reset affected credentials, and block the domain", "Wait for more victims"],
          answer: 1,
          why: "Contain active account compromise before only sending awareness messaging."
        },
        {
          prompt: "Which concept best explains the attack?",
          options: ["Phishing plus spoofing", "Packet filtering", "Hash collision"],
          answer: 0,
          why: "The attacker impersonates a trusted source and tricks people into giving credentials."
        },
        {
          prompt: "Which control would reduce repeat success?",
          options: ["Phishing-resistant MFA or passkeys", "A shorter password policy", "Turning off logs"],
          answer: 0,
          why: "Origin-bound authenticators make fake-login capture much less useful."
        }
      ]
    },
    {
      id: "gradebook-sqli",
      label: "Case 02",
      title: "Gradebook Injection",
      week: "Weeks 3-4",
      summary: "A grade lookup endpoint returns another student's grade when a crafted value is placed in the student_id field.",
      evidence: [
        ["Code clue", "SQL string is assembled with direct input concatenation."],
        ["Database account", "The app user can read every table."],
        ["Error page", "Stack traces reveal table and column names."]
      ],
      decisions: [
        {
          prompt: "What is the strongest code fix?",
          options: ["Parameterized query", "Hide the button", "Rename the table"],
          answer: 0,
          why: "Parameters keep input as data instead of SQL syntax."
        },
        {
          prompt: "What should happen before release?",
          options: ["Patch, retest, and reduce database privileges", "Ship and monitor social media", "Ask students not to exploit it"],
          answer: 0,
          why: "Sensitive data exposure is a release blocker until fixed and verified."
        },
        {
          prompt: "Which extra layer limits blast radius?",
          options: ["Least privilege for the database account", "A public error page", "A faster animation"],
          answer: 0,
          why: "A limited account reduces how much an exploited app can read or change."
        }
      ]
    },
    {
      id: "api-key-leak",
      label: "Case 03",
      title: "Leaked Service Key",
      week: "Weeks 5-6",
      summary: "A production API key was committed to a public repository and may have been copied before removal.",
      evidence: [
        ["Repository", "The key appears in commit history, not only the latest file."],
        ["API logs", "Traffic spikes from unknown IP addresses."],
        ["Key scope", "The key can read private course records."]
      ],
      decisions: [
        {
          prompt: "What is the first key-management move?",
          options: ["Delete the visible line only", "Rotate the key and revoke the exposed one", "Tell students to ignore it"],
          answer: 1,
          why: "Once a secret is public, removal from the current file is not enough."
        },
        {
          prompt: "What should the team inspect next?",
          options: ["Access logs and affected data scope", "Only CSS files", "The class schedule"],
          answer: 0,
          why: "You need to estimate whether the exposed key was used and what it could access."
        },
        {
          prompt: "Where should future production secrets live?",
          options: ["Managed secret storage or environment variables", "Client-side JavaScript", "Public Markdown notes"],
          answer: 0,
          why: "Secrets need controlled server-side access, not browser delivery or public files."
        }
      ]
    },
    {
      id: "ransomware-lab",
      label: "Case 04",
      title: "Ransomware In The Lab",
      week: "Week 9",
      summary: "Several lab machines show encrypted files and a ransom note after a student opened a cracked software installer.",
      evidence: [
        ["Host behavior", "Many files renamed within minutes."],
        ["Network", "One machine made connections to many peers."],
        ["Backups", "Last known clean backup is from yesterday evening."]
      ],
      decisions: [
        {
          prompt: "What is the best immediate containment action?",
          options: ["Isolate affected machines from the network", "Pay the ransom instantly", "Keep all machines running normally"],
          answer: 0,
          why: "Isolation slows spread and preserves investigation options."
        },
        {
          prompt: "What should be preserved for analysis?",
          options: ["Logs and relevant disk/memory evidence", "Only the ransom note screenshot", "Nothing, wipe first"],
          answer: 0,
          why: "Evidence helps understand entry, spread, and scope before recovery."
        },
        {
          prompt: "Which recovery path is safest?",
          options: ["Restore verified clean backups after containment", "Restore from any attached drive immediately", "Disable all backups forever"],
          answer: 0,
          why: "Verified clean backups matter only after containment and eradication."
        }
      ]
    },
    {
      id: "noisy-ids",
      label: "Case 05",
      title: "The Noisy Detector",
      week: "Weeks 10-11",
      summary: "An IDS reports hundreds of alerts after a firewall rule change, but only a few may represent real attacks.",
      evidence: [
        ["Alert mix", "Most alerts are low-confidence signature matches."],
        ["Firewall change", "A new rule exposed a test service to the internet."],
        ["Host logs", "One server shows failed login bursts and a new admin process."]
      ],
      decisions: [
        {
          prompt: "Which alert deserves highest priority?",
          options: ["The exposed server with host evidence", "Every alert equally", "The oldest low-confidence alert"],
          answer: 0,
          why: "Correlated network and host evidence makes that alert more actionable."
        },
        {
          prompt: "What metric problem can overwhelm a SOC?",
          options: ["False positives", "Password length only", "Certificate expiration only"],
          answer: 0,
          why: "Too many false positives consume analyst attention."
        },
        {
          prompt: "What should happen to the firewall rule?",
          options: ["Review and restrict exposure to the intended source", "Open more ports", "Delete all IDS logs"],
          answer: 0,
          why: "Firewall exposure should match the actual access requirement."
        }
      ]
    }
  ];

  let activeCaseId = state.activeCaseId || cases[0].id;

  checkCaseBtn.addEventListener("click", checkCase);
  resetCaseBtn.addEventListener("click", resetCase);

  render();

  function render() {
    renderCaseList();
    renderActiveCase();
    renderOverallScore();
  }

  function renderCaseList() {
    caseList.innerHTML = "";
    cases.forEach((item) => {
      const result = state.results[item.id];
      const button = document.createElement("button");
      button.type = "button";
      button.className = activeCaseId === item.id ? "is-active" : "";
      button.innerHTML = `<strong></strong><span></span>`;
      button.querySelector("strong").textContent = item.title;
      button.querySelector("span").textContent = `${item.label} · ${item.week}`;
      if (result?.completed) {
        const earned = document.createElement("em");
        earned.textContent = `${result.score}/${item.decisions.length}`;
        button.appendChild(earned);
      }
      button.addEventListener("click", () => {
        activeCaseId = item.id;
        state.activeCaseId = activeCaseId;
        save();
        render();
      });
      caseList.appendChild(button);
    });
  }

  function renderActiveCase() {
    const item = currentCase();
    const answers = state.answers[item.id] || {};
    caseKicker.textContent = `${item.label} · ${item.week}`;
    caseTitle.textContent = item.title;
    caseSummary.textContent = item.summary;
    evidenceGrid.innerHTML = "";
    item.evidence.forEach(([title, body]) => {
      const card = document.createElement("article");
      card.className = "evidence-card";
      card.innerHTML = `<strong></strong><span></span>`;
      card.querySelector("strong").textContent = title;
      card.querySelector("span").textContent = body;
      evidenceGrid.appendChild(card);
    });

    decisionStack.innerHTML = "";
    item.decisions.forEach((decision, index) => {
      const selected = answers[index];
      const card = document.createElement("article");
      card.className = "decision-card";
      if (selected != null && state.results[item.id]?.completed) {
        card.classList.add(Number(selected) === decision.answer ? "is-correct" : "is-wrong");
      }
      card.innerHTML = `<h3></h3><div class="choice-row"></div><p class="feedback" aria-live="polite"></p>`;
      card.querySelector("h3").textContent = decision.prompt;
      const row = card.querySelector(".choice-row");
      decision.options.forEach((option, optionIndex) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice";
        button.textContent = option;
        button.classList.toggle("is-correct", state.results[item.id]?.completed && optionIndex === decision.answer);
        button.classList.toggle("is-wrong", state.results[item.id]?.completed && Number(selected) === optionIndex && optionIndex !== decision.answer);
        button.addEventListener("click", () => {
          state.answers[item.id] = state.answers[item.id] || {};
          state.answers[item.id][index] = optionIndex;
          delete state.results[item.id];
          save();
          renderActiveCase();
          renderCaseList();
        });
        row.appendChild(button);
      });
      const feedback = card.querySelector(".feedback");
      if (state.results[item.id]?.completed) {
        feedback.textContent = decision.why;
        feedback.dataset.tone = Number(selected) === decision.answer ? "good" : "warn";
      }
      decisionStack.appendChild(card);
    });
    renderDebrief();
  }

  function checkCase() {
    const item = currentCase();
    const answers = state.answers[item.id] || {};
    if (item.decisions.some((_decision, index) => answers[index] == null)) {
      setStatus("Choose one option for each decision.", "warn");
      return;
    }
    const score = item.decisions.reduce((sum, decision, index) => sum + (Number(answers[index]) === decision.answer ? 1 : 0), 0);
    state.results[item.id] = {
      completed: true,
      score,
      total: item.decisions.length,
      completed_at: new Date().toISOString()
    };
    save();
    setStatus("Case checked.", "good");
    render();
  }

  function resetCase() {
    const item = currentCase();
    delete state.answers[item.id];
    delete state.results[item.id];
    save();
    setStatus("Case reset.", "good");
    render();
  }

  function renderDebrief() {
    const item = currentCase();
    const result = state.results[item.id];
    caseDebrief.classList.toggle("is-visible", Boolean(result?.completed));
    if (!result?.completed) return;
    debriefTitle.textContent = result.score === item.decisions.length ? "Clean case analysis" : "Case review";
    debriefText.textContent = result.score === item.decisions.length
      ? "You chose the strongest first moves and matched the incident to the right controls."
      : `You scored ${result.score}/${item.decisions.length}. Review the highlighted decisions and try the case again.`;
  }

  function renderOverallScore() {
    const completed = cases.filter((item) => state.results[item.id]?.completed).length;
    const percent = Math.round((completed / cases.length) * 100);
    caseScore.textContent = `${percent}%`;
  }

  function currentCase() {
    return cases.find((item) => item.id === activeCaseId) || cases[0];
  }

  function setStatus(message, tone) {
    caseStatus.textContent = message;
    if (tone) caseStatus.dataset.tone = tone;
    else caseStatus.removeAttribute("data-tone");
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return {
        activeCaseId: parsed.activeCaseId,
        answers: parsed.answers || {},
        results: parsed.results || {}
      };
    } catch (_error) {
      return { answers: {}, results: {} };
    }
  }
})();
