(function () {
  "use strict";

  const lectureId = document.getElementById("lectureId");
  const minuteStat = document.getElementById("minuteStat");
  const copyRunSheetBtn = document.getElementById("copyRunSheetBtn");
  const playbookStatus = document.getElementById("playbookStatus");
  const goalTitle = document.getElementById("goalTitle");
  const goalText = document.getElementById("goalText");
  const focusList = document.getElementById("focusList");
  const toolLinks = document.getElementById("toolLinks");
  const runSheet = document.getElementById("runSheet");
  const pivotList = document.getElementById("pivotList");
  const closingNote = document.getElementById("closingNote");

  const BASE = "/assets/course-materials/information-security";
  const lectures = window.QUIZ_CONFIG?.lectures || {};
  const lectureAssets = {
    "tc2007b-w1-l1": { deck: `${BASE}/week-01/lecture/`, mission: `${BASE}/week-01/mission-01/` },
    "tc2007b-w1-l2": { deck: `${BASE}/week-01/lecture-2/` },
    "tc2007b-w2-l1": { deck: `${BASE}/week-02/lecture/`, mission: `${BASE}/week-02/mission-02/` },
    "tc2007b-w2-l2": { deck: `${BASE}/week-02/lecture-2/`, mission: `${BASE}/week-02/mission-03/` },
    "tc2007b-w3-l1": { deck: `${BASE}/week-03/lecture/`, mission: `${BASE}/week-03/mission-04/` },
    "tc2007b-w4-bridge": { mission: `${BASE}/week-04/mission-bridge/` },
    "tc2007b-w5-l1": { deck: `${BASE}/week-05/lecture/`, mission: `${BASE}/week-05/mission-05/` },
    "tc2007b-w6-bridge": { mission: `${BASE}/week-06/mission-bridge/` },
    "tc2007b-w7-l1": { deck: `${BASE}/week-07/lecture/`, mission: `${BASE}/week-07/mission-06/` },
    "tc2007b-w8-bridge": { mission: `${BASE}/week-08/mission-bridge/` },
    "tc2007b-w9-l1": { deck: `${BASE}/week-09/lecture/`, mission: `${BASE}/week-09/mission-07/` },
    "tc2007b-w10-l1": { deck: `${BASE}/week-10/lecture/`, mission: `${BASE}/week-10/mission-08/` },
    "tc2007b-w11-l1": { deck: `${BASE}/week-11/lecture/`, mission: `${BASE}/week-11/mission-09/` }
  };

  const playbooks = {
    "tc2007b-w1-l1": plan("Security mindset", "Students should describe security as value plus risk, then separate confidentiality, integrity, and availability impacts.", ["CIA", "risk", "phishing", "response loop"], "Ask students to rewrite one vague threat as asset, harm, and first control."),
    "tc2007b-w1-l2": plan("Ethical scope", "Students should separate technical capability from authorization, privacy, responsible disclosure, and legal risk.", ["authorization", "privacy", "scope", "disclosure"], "Close with one sentence: what would you report, and what would you avoid touching?"),
    "tc2007b-w2-l1": plan("Prove identity", "Students should compare authentication factors, password storage decisions, and MFA tradeoffs.", ["authentication", "passwords", "MFA", "usability"], "Ask for the strongest MFA choice and one usability cost."),
    "tc2007b-w2-l2": plan("Control access", "Students should connect access-control models to least privilege and enforcement mechanisms.", ["RBAC", "ABAC", "least privilege", "policy"], "Have students name one permission they would remove from an overpowered role."),
    "tc2007b-w3-l1": plan("Break the app safely", "Students should explain injection and XSS as trust-boundary failures and choose stronger fixes.", ["SQL injection", "XSS", "validation", "trust boundaries"], "End with one rule: where must security validation happen?"),
    "tc2007b-w4-bridge": plan("Harden release", "Students should triage secure-coding risks and decide what blocks deployment.", ["risk", "release gates", "controls", "monitoring"], "Ask which risk blocks release and which can ship with monitoring."),
    "tc2007b-w5-l1": plan("Exchange secrets", "Students should separate encryption, signatures, key ownership, and public-key exchange.", ["public key", "private key", "signatures", "Diffie-Hellman"], "Close with two arrows: who encrypts with what, and who signs with what."),
    "tc2007b-w6-bridge": plan("Protect data", "Students should choose symmetric crypto tools, password hashing, key storage, and nonce discipline.", ["AEAD", "hashing", "keys", "nonces"], "Ask why a leaked key needs rotation, not just deletion."),
    "tc2007b-w7-l1": plan("Authenticate messages", "Students should explain freshness, HMAC, hash properties, and protocol role labels.", ["freshness", "HMAC", "hash properties", "protocols"], "Close with the replay question: what proves this message is new?"),
    "tc2007b-w8-bridge": plan("Secure channels", "Students should connect TLS, certificate validation, downgrade attacks, and channel controls.", ["TLS", "certificates", "HTTPS", "downgrade"], "Ask which warning means identity validation failed."),
    "tc2007b-w9-l1": plan("Contain malware", "Students should classify malware behavior and choose containment before recovery.", ["malware", "ransomware", "containment", "backups"], "End with a three-step incident first response."),
    "tc2007b-w10-l1": plan("Build perimeter", "Students should translate firewall intent into rules, state, DMZ placement, and layer choice.", ["firewalls", "stateful", "DMZ", "WAF"], "Ask what default deny changes about exposure."),
    "tc2007b-w11-l1": plan("Tune detection", "Students should classify IDS outcomes and prioritize alerts under false-positive pressure.", ["IDS", "false positives", "SOC", "triage"], "Close with one alert students would escalate and one they would suppress.")
  };

  populateLectures();
  lectureId.addEventListener("change", render);
  copyRunSheetBtn.addEventListener("click", copyRunSheet);
  render();

  function populateLectures() {
    lectureId.innerHTML = "";
    Object.entries(lectures).forEach(([id, title]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = title;
      lectureId.appendChild(option);
    });
    const requested = new URLSearchParams(window.location.search).get("lecture");
    lectureId.value = lectures[requested] ? requested : Object.keys(lectures)[0];
  }

  function render() {
    const sheet = buildRunSheet(lectureId.value);
    minuteStat.textContent = String(sheet.minutes);
    goalTitle.textContent = sheet.title;
    goalText.textContent = sheet.goal;
    closingNote.textContent = sheet.closing;
    renderFocus(sheet.focus);
    renderLinks(lectureId.value);
    renderTimeline(sheet.segments);
    renderPivots(sheet.pivots);
  }

  function buildRunSheet(id) {
    const base = playbooks[id] || plan("Security decision", "Students should connect the lecture topic to one concrete security decision.", ["risk", "control", "evidence"], "Ask students what control they would choose first and why.");
    const title = lectures[id] || base.title;
    const segments = [
      ["0-5", "Opening incident", `Frame ${base.focus[0]} with a concrete failure and ask for the first security question.`],
      ["5-18", "Core explanation", `Teach the main idea: ${base.goal}`],
      ["18-25", "Quiz pulse", "Run a short quiz or classroom pulse, then sort answers by reasoning rather than speed."],
      ["25-48", "Decision practice", `Launch the mission, case, or concept check tied to ${base.focus.slice(0, 2).join(" and ")}.`],
      ["48-62", "Debrief", "Compare two plausible answers and name the security property each answer protects."],
      ["62-70", "Repair loop", "Send weak topics to Review Coach or Concept Map before the next activity."],
      ["70-75", "Exit ticket", base.closing]
    ];
    return Object.assign({}, base, { title, minutes: 75, segments });
  }

  function renderFocus(items) {
    focusList.innerHTML = "";
    items.forEach((item) => {
      const pill = document.createElement("div");
      pill.className = "focus-pill";
      pill.textContent = item;
      focusList.appendChild(pill);
    });
  }

  function renderLinks(id) {
    const assets = lectureAssets[id] || {};
    const links = [
      ["Classroom", `${BASE}/classroom/?lecture=${encodeURIComponent(id)}`],
      ["Quiz console", `${BASE}/week-01/lecture/quiz/teacher.html?lecture=${encodeURIComponent(id)}`],
      ["Exit ticket", `${BASE}/exit-ticket/?lecture=${encodeURIComponent(id)}`],
      ["Concept map", `${BASE}/concept-map/`],
      ["Review coach", `${BASE}/review-coach/`],
      ["Teacher insights", `${BASE}/teacher/`]
    ];
    if (assets.deck) links.unshift(["Deck", assets.deck]);
    if (assets.mission) links.splice(1, 0, ["Mission", assets.mission]);
    toolLinks.innerHTML = "";
    links.forEach(([label, href]) => {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      toolLinks.appendChild(link);
    });
  }

  function renderTimeline(segments) {
    runSheet.innerHTML = "";
    segments.forEach(([time, title, body]) => {
      const step = document.createElement("article");
      step.className = "timeline-step";
      step.innerHTML = "<strong></strong><span><h3></h3><p></p></span>";
      step.querySelector("strong").textContent = time;
      step.querySelector("h3").textContent = title;
      step.querySelector("p").textContent = body;
      runSheet.appendChild(step);
    });
  }

  function renderPivots(pivots) {
    pivotList.innerHTML = "";
    pivots.forEach(([condition, action]) => {
      const item = document.createElement("article");
      item.className = "pivot-item";
      item.innerHTML = "<strong></strong><span></span>";
      item.querySelector("strong").textContent = condition;
      item.querySelector("span").textContent = action;
      pivotList.appendChild(item);
    });
  }

  async function copyRunSheet() {
    const sheet = buildRunSheet(lectureId.value);
    const text = [
      sheet.title,
      sheet.goal,
      "",
      ...sheet.segments.map(([time, title, body]) => `${time} ${title}: ${body}`),
      "",
      "Closing:",
      sheet.closing
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Run sheet copied.", "good");
    } catch (_error) {
      setStatus(text, "warn");
    }
  }

  function plan(title, goal, focus, closing) {
    return {
      title,
      goal,
      focus,
      closing,
      pivots: [
        ["Low quiz score", "Pause for a pair explanation, then rerun one similar pulse."],
        ["Quiet room", "Ask for two competing answers before revealing the safer choice."],
        ["Fast finishers", "Send them to the Concept Map and ask for one prerequisite they can teach."]
      ]
    };
  }

  function setStatus(message, tone) {
    playbookStatus.textContent = message;
    if (tone) playbookStatus.dataset.tone = tone;
    else playbookStatus.removeAttribute("data-tone");
  }

  window.buildRunSheet = buildRunSheet;
})();
