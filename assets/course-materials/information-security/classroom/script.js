(function () {
  "use strict";

  const lectureId = document.getElementById("lectureId");
  const sessionCode = document.getElementById("sessionCode");
  const classroomStatus = document.getElementById("classroomStatus");
  const copyStudentLinkBtn = document.getElementById("copyStudentLinkBtn");
  const copyTeacherLinkBtn = document.getElementById("copyTeacherLinkBtn");
  const qrTitle = document.getElementById("qrTitle");
  const qrCanvas = document.getElementById("qrCanvas");
  const studentLink = document.getElementById("studentLink");
  const quickLinks = document.getElementById("quickLinks");
  const pulseTitle = document.getElementById("pulseTitle");
  const pulsePrompt = document.getElementById("pulsePrompt");
  const pulseChoices = document.getElementById("pulseChoices");
  const pulseCount = document.getElementById("pulseCount");
  const pulseDebrief = document.getElementById("pulseDebrief");
  const prevPulseBtn = document.getElementById("prevPulseBtn");
  const nextPulseBtn = document.getElementById("nextPulseBtn");
  const revealBtn = document.getElementById("revealBtn");
  const timerValue = document.getElementById("timerValue");
  const startTimerBtn = document.getElementById("startTimerBtn");
  const pauseTimerBtn = document.getElementById("pauseTimerBtn");
  const resetTimerBtn = document.getElementById("resetTimerBtn");

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

  const pulseBank = {
    "tc2007b-w1-l1": [
      ["CIA triad", "A ransomware attack locks the gradebook for two days. Which CIA property is most harmed first?", ["Confidentiality", "Integrity", "Availability"], 2, "Availability is the immediate failure because authorized users cannot use the system."],
      ["Security mindset", "Is a security problem more about technology, value, or risk?", ["Technology only", "Value plus risk", "Legal text only"], 1, "Security starts when something valuable faces plausible harm."],
      ["Design principle", "Which design principle says a system should not depend on secret design details?", ["Open design", "Least privilege", "Fail-safe defaults"], 0, "Open design keeps security in keys, permissions, and controls, not hidden architecture."]
    ],
    "tc2007b-w1-l2": [
      ["Ethics", "You can technically open a file with student records. What question comes first?", ["Can I finish quickly?", "Am I authorized and is there a legitimate purpose?", "Can I screenshot it?"], 1, "Authorization and legitimate purpose separate responsible work from misuse."],
      ["Disclosure", "A student finds an exposed database. What is the safest first move?", ["Download everything", "Report without exploring the records", "Post screenshots"], 1, "Responsible reporting minimizes access and harm."],
      ["Privacy", "Why can logs be sensitive?", ["They may reveal identity and behavior", "They are always random", "They cannot include personal data"], 0, "Logs often contain identifiers, timing, location, and behavior trails."]
    ],
    "tc2007b-w2-l1": [
      ["Authentication", "What question does authentication answer?", ["Who are you?", "What may you do?", "Was the packet modified?"], 0, "Authentication verifies identity; authorization checks permission."],
      ["MFA", "Which pair is a stronger two-factor design?", ["Password and PIN", "Password and security key", "Two passwords"], 1, "A security key is possession-based, while the password is knowledge-based."],
      ["Password storage", "After a password database leak, what slows offline guessing?", ["Slow salted password hashes", "Fast unsalted hashes", "Plaintext plus backups"], 0, "Slow salted hashing increases the cost of each guess."]
    ],
    "tc2007b-w2-l2": [
      ["Access control", "A student can only submit their own assignment. Which idea is this?", ["Least privilege", "Open design", "Cryptographic collision"], 0, "Least privilege limits each actor to the access required."],
      ["Models", "Roles like student, TA, and professor point most directly to what model?", ["RBAC", "DAC", "MAC"], 0, "Role-based access control grants permissions through roles."],
      ["Policy", "Policy says what should happen. Mechanism is what?", ["The technical enforcement", "The attack motive", "The backup date"], 0, "Mechanism is the how that enforces policy."]
    ],
    "tc2007b-w3-l1": [
      ["Injection", "Why does a parameterized query stop SQL injection?", ["It separates code from data", "It hides the URL", "It makes the database public"], 0, "Parameters keep user input as values, not query syntax."],
      ["Trust boundary", "Why is browser validation not enough?", ["Attackers can bypass the browser", "Browsers cannot submit forms", "It prevents all mistakes"], 0, "The server must enforce security because the client is outside trust."],
      ["XSS", "Rendering a comment with innerHTML risks what?", ["Browser executing untrusted code", "A stronger hash", "A firewall route"], 0, "XSS happens when untrusted content becomes executable script."]
    ],
    "tc2007b-w4-bridge": [
      ["Release risk", "What should block a release?", ["Unauthenticated student-record endpoint", "A typo in a tooltip", "A slow animation"], 0, "Critical access-control failures need repair before release."],
      ["Controls", "Which control directly addresses stored XSS?", ["Output encoding", "Longer passwords", "Public-key encryption"], 0, "Untrusted text should be encoded or rendered safely."],
      ["Triage", "Risk combines which two dimensions?", ["Likelihood and impact", "Font and color", "File name and extension"], 0, "Risk triage asks how likely harm is and how severe it would be."]
    ],
    "tc2007b-w5-l1": [
      ["Public key", "To send Alice a confidential message, which key does Bob use?", ["Alice's public key", "Alice's private key", "Bob's private key"], 0, "Only Alice's private key should decrypt what was encrypted to Alice's public key."],
      ["Signature", "A digital signature is created with whose key?", ["Sender private key", "Sender public key", "Receiver public key"], 0, "The private key signs; the public key verifies."],
      ["Diffie-Hellman", "What does Diffie-Hellman establish?", ["A shared secret over an open channel", "A password reset", "A firewall rule"], 0, "Both sides derive the same secret without sending it directly."]
    ],
    "tc2007b-w6-bridge": [
      ["AEAD", "Authenticated encryption gives which two protections?", ["Confidentiality and tamper detection", "Compression and sorting", "Only identity"], 0, "AEAD protects data secrecy and detects modification."],
      ["Nonce", "What should a nonce be under the same key?", ["Unique", "Secret forever", "Identical every time"], 0, "Reuse can break the security guarantee of many modes."],
      ["Keys", "Where should production encryption keys live?", ["Managed secret or key service", "Public repository", "Student handout"], 0, "Keys need controlled access, auditing, and rotation."]
    ],
    "tc2007b-w7-l1": [
      ["Protocol freshness", "What does a nonce help prove?", ["Freshness", "Compression", "Screen size"], 0, "Freshness helps stop replayed messages."],
      ["Reflection", "Why include identities and directions in protocol messages?", ["To prevent message reuse in the wrong direction", "To make packets longer", "To remove authentication"], 0, "Labels help prevent reflection and role confusion."],
      ["HMAC", "Why is HMAC stronger than a plain hash for API messages?", ["It uses a shared secret", "It uses no key", "It is shorter"], 0, "The secret lets the receiver verify authorization of the message."]
    ],
    "tc2007b-w8-bridge": [
      ["TLS", "TLS should prove what about the server?", ["Identity through certificate validation", "That the app has no bugs", "That passwords are memorable"], 0, "TLS authenticates the endpoint and protects the channel."],
      ["Certificate warning", "A hostname mismatch means what?", ["The site identity check failed", "The password is too short", "The firewall is off"], 0, "The certificate name must match the requested host."],
      ["Downgrade", "HTTPS stripped to HTTP on public Wi-Fi is what?", ["An active channel attack", "A harmless color change", "A backup policy"], 0, "Downgrade attacks remove channel protection."]
    ],
    "tc2007b-w9-l1": [
      ["Malware", "A worm is known for what?", ["Self-propagating across networks", "Only encrypting one file", "Issuing certificates"], 0, "Worms spread across systems without needing host-file attachment."],
      ["Ransomware", "What is a good early response?", ["Isolate affected systems", "Keep using the infected machine", "Delete all logs"], 0, "Isolation limits spread and preserves response options."],
      ["Defense", "What is stronger than signatures alone?", ["Layered prevention, detection, backup, and recovery", "No patching", "All users as admins"], 0, "Malware defense needs layers because no single control is perfect."]
    ],
    "tc2007b-w10-l1": [
      ["Firewall policy", "Default deny means what?", ["Only explicitly allowed traffic passes", "Everything passes", "Only attackers are blocked manually"], 0, "Default deny requires intentional allow rules."],
      ["Stateful", "A stateful firewall remembers what?", ["Connection state", "Student names", "Hash collisions"], 0, "State helps distinguish expected replies from unsolicited traffic."],
      ["DMZ", "Why place public services in a DMZ?", ["To separate them from internal systems", "To remove all logs", "To share database passwords"], 0, "The DMZ limits exposure if a public service is compromised."]
    ],
    "tc2007b-w11-l1": [
      ["IDS result", "Alert on a real attack equals what?", ["True positive", "False positive", "False negative"], 0, "A true positive is a correct alert about real malicious activity."],
      ["Detection type", "Which approach catches known byte patterns?", ["Signature detection", "Anomaly detection", "Certificate validation"], 0, "Signature systems compare events to known patterns."],
      ["SOC triage", "Why prioritize alerts?", ["High false-positive rates can overwhelm analysts", "Every alert is equally urgent", "Logs have no value"], 0, "A SOC must correlate and prioritize to avoid overload."]
    ]
  };

  let currentPulseIndex = 0;
  let revealed = false;
  let timerSeconds = 300;
  let timerDefaultSeconds = 300;
  let timerId = null;
  const qr = window.QRious ? new QRious({ element: qrCanvas, size: 260, value: window.location.href }) : null;

  populateLectures();
  wireEvents();
  renderAll();

  function populateLectures() {
    lectureId.innerHTML = "";
    Object.entries(lectures).forEach(([id, title]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = title;
      lectureId.appendChild(option);
    });
    const requested = new URLSearchParams(window.location.search).get("lecture");
    lectureId.value = lectures[requested] ? requested : (window.QUIZ_CONFIG?.lectureId || Object.keys(lectures)[0]);
  }

  function wireEvents() {
    lectureId.addEventListener("change", () => {
      currentPulseIndex = 0;
      revealed = false;
      renderAll();
    });
    sessionCode.addEventListener("input", () => {
      sessionCode.value = normalizeCode(sessionCode.value);
      renderLinks();
    });
    prevPulseBtn.addEventListener("click", () => movePulse(-1));
    nextPulseBtn.addEventListener("click", () => movePulse(1));
    revealBtn.addEventListener("click", () => {
      revealed = !revealed;
      renderPulse();
    });
    copyStudentLinkBtn.addEventListener("click", () => copyText(buildStudentUrl()));
    copyTeacherLinkBtn.addEventListener("click", () => copyText(buildTeacherQuizUrl()));
    document.querySelectorAll("[data-minutes]").forEach((button) => {
      button.addEventListener("click", () => {
        timerDefaultSeconds = Number(button.dataset.minutes) * 60;
        timerSeconds = timerDefaultSeconds;
        renderTimer();
      });
    });
    startTimerBtn.addEventListener("click", startTimer);
    pauseTimerBtn.addEventListener("click", pauseTimer);
    resetTimerBtn.addEventListener("click", resetTimer);
  }

  function renderAll() {
    renderLinks();
    renderPulse();
    renderTimer();
  }

  function renderLinks() {
    const studentUrl = buildStudentUrl();
    const teacherQuizUrl = buildTeacherQuizUrl();
    const exitUrl = absoluteUrl(`${BASE}/exit-ticket/?lecture=${encodeURIComponent(lectureId.value)}`);
    const progressUrl = absoluteUrl(`${BASE}/progress/`);
    const caseFilesUrl = absoluteUrl(`${BASE}/case-files/`);
    const attackChainUrl = absoluteUrl(`${BASE}/attack-chain/`);
    const conceptMapUrl = absoluteUrl(`${BASE}/concept-map/`);
    const reviewCoachUrl = absoluteUrl(`${BASE}/review-coach/`);
    const portfolioUrl = absoluteUrl(`${BASE}/portfolio/`);
    const assessmentUrl = absoluteUrl(`${BASE}/assessment/`);
    const playbookUrl = absoluteUrl(`${BASE}/playbook/?lecture=${encodeURIComponent(lectureId.value)}`);
    const assets = lectureAssets[lectureId.value] || {};
    qrTitle.textContent = sessionCode.value ? "Quiz session link" : "Student activity link";
    studentLink.textContent = studentUrl;
    if (qr) qr.value = studentUrl;

    const links = [
      ["Student quiz", studentUrl],
      ["Teacher quiz", teacherQuizUrl],
      ["Exit ticket", exitUrl],
      ["Case files", caseFilesUrl],
      ["Attack chain", attackChainUrl],
      ["Concept map", conceptMapUrl],
      ["Review coach", reviewCoachUrl],
      ["Portfolio", portfolioUrl],
      ["Assessment", assessmentUrl],
      ["Playbook", playbookUrl],
      ["Progress", progressUrl]
    ];
    if (assets.deck) links.unshift(["Deck", absoluteUrl(assets.deck)]);
    if (assets.mission) links.splice(1, 0, ["Mission", absoluteUrl(assets.mission)]);

    quickLinks.innerHTML = "";
    links.forEach(([label, href]) => {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      quickLinks.appendChild(link);
    });
  }

  function renderPulse() {
    const pulses = pulseBank[lectureId.value] || [["Discuss", "What is the most important security decision in this lecture?", ["Prevent", "Detect", "Respond"], 0, "Use the student answers to decide where to slow down."]];
    if (currentPulseIndex >= pulses.length) currentPulseIndex = 0;
    const [title, prompt, choices, answerIndex, debrief] = pulses[currentPulseIndex];
    pulseTitle.textContent = title;
    pulsePrompt.textContent = prompt;
    pulseCount.textContent = `${currentPulseIndex + 1} / ${pulses.length}`;
    pulseChoices.innerHTML = "";
    choices.forEach((choice, index) => {
      const item = document.createElement("div");
      item.className = "pulse-choice";
      item.classList.toggle("is-answer", revealed && index === answerIndex);
      item.textContent = choice;
      pulseChoices.appendChild(item);
    });
    revealBtn.textContent = revealed ? "Hide answer" : "Reveal";
    pulseDebrief.textContent = revealed ? debrief : "";
    if (revealed) pulseDebrief.dataset.tone = "good";
    else pulseDebrief.removeAttribute("data-tone");
  }

  function movePulse(delta) {
    const pulses = pulseBank[lectureId.value] || [];
    currentPulseIndex = (currentPulseIndex + delta + pulses.length) % pulses.length;
    revealed = false;
    renderPulse();
  }

  function startTimer() {
    pauseTimer();
    timerId = window.setInterval(() => {
      timerSeconds = Math.max(0, timerSeconds - 1);
      renderTimer();
      if (timerSeconds === 0) pauseTimer();
    }, 1000);
  }

  function pauseTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
  }

  function resetTimer() {
    pauseTimer();
    timerSeconds = timerDefaultSeconds;
    renderTimer();
  }

  function renderTimer() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    timerValue.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Link copied.", "good");
    } catch (_error) {
      setStatus(text, "warn");
    }
  }

  function buildStudentUrl() {
    const assets = lectureAssets[lectureId.value] || {};
    if (!normalizeCode(sessionCode.value) && assets.mission) {
      return absoluteUrl(assets.mission);
    }
    if (!normalizeCode(sessionCode.value)) {
      return absoluteUrl(`${BASE}/exit-ticket/?lecture=${encodeURIComponent(lectureId.value)}`);
    }
    const url = new URL(`${BASE}/week-01/lecture/quiz/`, window.location.origin);
    const code = normalizeCode(sessionCode.value);
    url.searchParams.set("session", code);
    return url.toString();
  }

  function buildTeacherQuizUrl() {
    const url = new URL(`${BASE}/week-01/lecture/quiz/teacher.html`, window.location.origin);
    url.searchParams.set("lecture", lectureId.value);
    return url.toString();
  }

  function absoluteUrl(path) {
    return new URL(path, window.location.origin).toString();
  }

  function normalizeCode(code) {
    return String(code || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
  }

  function setStatus(message, tone) {
    classroomStatus.textContent = message;
    if (tone) classroomStatus.dataset.tone = tone;
    else classroomStatus.removeAttribute("data-tone");
  }
})();
