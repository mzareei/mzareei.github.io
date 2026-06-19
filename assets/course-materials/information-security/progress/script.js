(function () {
  "use strict";

  const missionList = document.getElementById("missionList");
  const quizList = document.getElementById("quizList");
  const caseFileList = document.getElementById("caseFileList");
  const attackChainList = document.getElementById("attackChainList");
  const conceptMapList = document.getElementById("conceptMapList");
  const reviewCoachList = document.getElementById("reviewCoachList");
  const portfolioList = document.getElementById("portfolioList");
  const badgeShelf = document.getElementById("badgeShelf");
  const reviewPlan = document.getElementById("reviewPlan");
  const studyPlan = document.getElementById("studyPlan");
  const copyStudyPlanBtn = document.getElementById("copyStudyPlanBtn");
  const studyPlanStatus = document.getElementById("studyPlanStatus");
  const reflectionList = document.getElementById("reflectionList");
  const overallScore = document.getElementById("overallScore");
  let studyPlanText = "";

  const missions = [
    {
      key: "tc2007b-mission-01",
      title: "Mission 01: Think Like an Attacker",
      href: "../week-01/mission-01/",
      total: 10,
      score(data) {
        const answers = Object.values(data.answers || {}).filter((answer) => answer.correct).length;
        return answers + (data.model ? 2 : 0) + (data.responseCorrect ? 2 : 0);
      },
      review(data) {
        const notes = [];
        if (!data.model) notes.push("Build one threat model: asset, threat, and CIA impact.");
        if (!data.responseCorrect) notes.push("Review the defense lifecycle: prevention, detection, response, recovery.");
        if (Object.values(data.answers || {}).filter((answer) => !answer.correct).length) notes.push("Revisit CIA triad and phishing vs spoofing distinctions.");
        return notes;
      }
    },
    {
      key: "tc2007b-mission-02",
      title: "Mission 02: Prove Who You Are",
      href: "../week-02/mission-02/",
      total: 8,
      score(data) {
        return (data.passwordTouched ? 2 : 0) + (data.storageCorrect ? 3 : 0) + Object.values(data.mfa || {}).filter(Boolean).length;
      },
      review(data) {
        const notes = [];
        if (!data.passwordTouched) notes.push("Run the password search-space simulator.");
        if (!data.storageCorrect) notes.push("Review why slow salted password hashes are safer after a database leak.");
        if (Object.values(data.mfa || {}).filter(Boolean).length < 3) notes.push("Practice risk-based MFA choices.");
        return notes;
      }
    },
    {
      key: "tc2007b-mission-03",
      title: "Mission 03: Control The Door",
      href: "../week-02/mission-03/",
      total: 10,
      score(data) {
        const models = Object.values(data.models || {}).filter(Boolean).length;
        const matrix = Math.round((Number(data.matrixScore || 0) / 12) * 4);
        const policy = data.policyCorrect ? 2 : 0;
        return models + matrix + policy;
      },
      review(data) {
        const notes = [];
        if (Object.values(data.models || {}).filter(Boolean).length < 4) notes.push("Review DAC, MAC, RBAC, and ABAC with one concrete example each.");
        if (Number(data.matrixScore || 0) < 12) notes.push("Practice least privilege: grant only the permissions required for the job.");
        if (!data.policyCorrect) notes.push("Connect access-control policy goals to the mechanism that actually enforces them.");
        return notes;
      }
    },
    {
      key: "tc2007b-mission-04",
      title: "Mission 04: Break The App Safely",
      href: "../week-03/mission-04/",
      total: 10,
      score(data) {
        const sqli = Object.values(data.sqli || {}).filter(Boolean).length;
        const fixes = Math.round((Number(data.fixScore || 0) / 5) * 3);
        const xss = data.xssCorrect ? 2 : 0;
        const boundary = data.boundaryCorrect ? 2 : 0;
        return sqli + fixes + xss + boundary;
      },
      review(data) {
        const notes = [];
        if (Object.values(data.sqli || {}).filter(Boolean).length < 3) notes.push("Practice reading unsafe SQL and spotting where input becomes code.");
        if (Number(data.fixScore || 0) < 5) notes.push("Review the strongest SQL injection defenses: parameters, server validation, and least privilege.");
        if (!data.xssCorrect) notes.push("Review why untrusted text should be rendered as text, not HTML.");
        if (!data.boundaryCorrect) notes.push("Revisit trust boundaries: browser checks help UX, but server and database rules protect integrity.");
        return notes;
      }
    },
    {
      key: "tc2007b-bridge-04",
      title: "Bridge Mission: Harden The Release",
      href: "../week-04/mission-bridge/",
      total: 10,
      score(data) {
        return Object.values(data.risk || {}).filter(Boolean).length +
          Object.values(data.defenses || {}).filter(Boolean).length +
          (data.releaseCorrect ? 3 : 0);
      },
      review(data) {
        const notes = [];
        if (Object.values(data.risk || {}).filter(Boolean).length < 3) notes.push("Practice release-risk triage: what blocks release, what can wait, and what should be monitored.");
        if (Object.values(data.defenses || {}).filter(Boolean).length < 4) notes.push("Review the strongest controls for SQLi, XSS, authorization, and vulnerable dependencies.");
        if (!data.releaseCorrect) notes.push("Revisit release gates: hiding a vulnerable endpoint is not the same as fixing access control.");
        return notes;
      }
    },
    {
      key: "tc2007b-mission-05",
      title: "Mission 05: Exchange The Secret",
      href: "../week-05/mission-05/",
      total: 10,
      score(data) {
        const keys = Object.values(data.keys || {}).filter(Boolean).length * 2;
        return (data.modCorrect ? 2 : 0) + keys + (data.dhCorrect ? 1 : 0) + (data.designCorrect ? 1 : 0);
      },
      review(data) {
        const notes = [];
        if (!data.modCorrect) notes.push("Practice modular arithmetic with small public-key examples.");
        if (Object.values(data.keys || {}).filter(Boolean).length < 3) notes.push("Review which actions use public keys, private keys, encryption, and signatures.");
        if (!data.dhCorrect) notes.push("Revisit the Diffie-Hellman toy exchange and how both sides derive the same secret.");
        if (!data.designCorrect) notes.push("Separate confidentiality from authenticity: encryption and signatures solve different problems.");
        return notes;
      }
    },
    {
      key: "tc2007b-bridge-06",
      title: "Bridge Mission: Protect The Data",
      href: "../week-06/mission-bridge/",
      total: 10,
      score(data) {
        return Object.values(data.modes || {}).filter(Boolean).length +
          Object.values(data.keys || {}).filter(Boolean).length +
          (data.nonceCorrect ? 3 : 0);
      },
      review(data) {
        const notes = [];
        if (Object.values(data.modes || {}).filter(Boolean).length < 4) notes.push("Review which crypto tool fits each job: authenticated encryption, password hashing, avoiding ECB, and hybrid encryption.");
        if (Object.values(data.keys || {}).filter(Boolean).length < 3) notes.push("Practice key-management decisions: storage, rotation, auditing, and least privilege.");
        if (!data.nonceCorrect) notes.push("Revisit why nonce reuse under the same key can expose protected data.");
        return notes;
      }
    },
    {
      key: "tc2007b-mission-06",
      title: "Mission 06: Authenticate The Message",
      href: "../week-07/mission-06/",
      total: 10,
      score(data) {
        return Object.values(data.protocol || {}).filter(Boolean).length * 2 +
          Object.values(data.hash || {}).filter(Boolean).length +
          (data.hmacCorrect ? 1 : 0);
      },
      review(data) {
        const notes = [];
        if (Object.values(data.protocol || {}).filter(Boolean).length < 3) notes.push("Review protocol freshness, direction labels, and session key purpose.");
        if (Object.values(data.hash || {}).filter(Boolean).length < 3) notes.push("Revisit preimage, second-preimage, and collision resistance.");
        if (!data.hmacCorrect) notes.push("Review why HMAC authenticates messages but a plain hash does not.");
        return notes;
      }
    },
    {
      key: "tc2007b-bridge-08",
      title: "Bridge Mission: Secure The Channel",
      href: "../week-08/mission-bridge/",
      total: 10,
      score(data) {
        return Object.values(data.certs || {}).filter(Boolean).length +
          Object.values(data.channels || {}).filter(Boolean).length +
          (data.downgradeCorrect ? 2 : 0);
      },
      review(data) {
        const notes = [];
        if (Object.values(data.certs || {}).filter(Boolean).length < 4) notes.push("Review certificate failures: hostname mismatch, expiration, issuer trust, and successful chain validation.");
        if (Object.values(data.channels || {}).filter(Boolean).length < 4) notes.push("Practice choosing channel controls: TLS, VPN or zero-trust access, HSTS, and certificate monitoring.");
        if (!data.downgradeCorrect) notes.push("Revisit downgrade attacks: never send credentials after HTTPS has been stripped.");
        return notes;
      }
    },
    {
      key: "tc2007b-mission-07",
      title: "Mission 07: Contain The Malware",
      href: "../week-09/mission-07/",
      total: 10,
      score(data) {
        return Object.values(data.classes || {}).filter(Boolean).length +
          Math.round((Number(data.triageScore || 0) / 5) * 4) +
          (data.countermeasureCorrect ? 2 : 0);
      },
      review(data) {
        const notes = [];
        if (Object.values(data.classes || {}).filter(Boolean).length < 4) notes.push("Review malware families by behavior: worm, rootkit, ransomware, botnet.");
        if (Number(data.triageScore || 0) < 5) notes.push("Practice malware containment: isolate, preserve evidence, verify backups, then recover.");
        if (!data.countermeasureCorrect) notes.push("Review layered malware defense, not signature-only thinking.");
        return notes;
      }
    },
    {
      key: "tc2007b-mission-08",
      title: "Mission 08: Build The Perimeter",
      href: "../week-10/mission-08/",
      total: 10,
      score(data) {
        return Object.values(data.packets || {}).filter(Boolean).length +
          Object.values(data.types || {}).filter(Boolean).length +
          (data.dmzCorrect ? 2 : 0);
      },
      review(data) {
        const notes = [];
        if (Object.values(data.packets || {}).filter(Boolean).length < 4) notes.push("Practice translating firewall policy into allow, deny, and restricted rules.");
        if (Object.values(data.types || {}).filter(Boolean).length < 4) notes.push("Review packet filters, stateful firewalls, WAFs, host firewalls, and NGFWs.");
        if (!data.dmzCorrect) notes.push("Review why public services belong in a DMZ rather than directly beside internal systems.");
        return notes;
      }
    },
    {
      key: "tc2007b-mission-09",
      title: "Mission 09: Tune The Detector",
      href: "../week-11/mission-09/",
      total: 10,
      score(data) {
        return Object.values(data.alerts || {}).filter(Boolean).length +
          Object.values(data.approaches || {}).filter(Boolean).length +
          (data.baseRateCorrect ? 2 : 0);
      },
      review(data) {
        const notes = [];
        if (Object.values(data.alerts || {}).filter(Boolean).length < 4) notes.push("Review true positives, false positives, false negatives, and true negatives.");
        if (Object.values(data.approaches || {}).filter(Boolean).length < 4) notes.push("Review anomaly, signature, honeypot, and IPS detection approaches.");
        if (!data.baseRateCorrect) notes.push("Revisit the base-rate problem and why SOCs must prioritize and correlate alerts.");
        return notes;
      }
    }
  ];

  const missionRows = missions.map((mission) => {
    const data = read(mission.key);
    const score = mission.score(data);
    const percent = Math.round((score / mission.total) * 100);
    const notes = mission.review(data);
    return { ...mission, data, score, percent, notes };
  });

  const caseFiles = [
    ["phishing-wave", "Campus Phishing Wave"],
    ["gradebook-sqli", "Gradebook Injection"],
    ["api-key-leak", "Leaked Service Key"],
    ["ransomware-lab", "Ransomware In The Lab"],
    ["noisy-ids", "The Noisy Detector"]
  ];

  renderMissions(missionRows);
  const quizRows = renderQuiz();
  const caseRows = renderCaseFiles();
  const attackChain = renderAttackChain();
  const conceptMap = renderConceptMap();
  const reviewCoach = renderReviewCoach();
  const reflections = renderReflections();
  renderPortfolio(missionRows, caseRows, attackChain, conceptMap, reviewCoach, reflections);
  renderBadges(missionRows, quizRows, reflections, caseRows, attackChain, conceptMap, reviewCoach);
  const reviewNotes = renderReview(missionRows, caseRows, attackChain, conceptMap, reviewCoach);
  renderStudyPlan({ missionRows, quizRows, reflections, caseRows, attackChain, conceptMap, reviewCoach, reviewNotes });
  copyStudyPlanBtn.addEventListener("click", copyStudyPlan);

  const progressRows = missionRows.concat(caseRows, attackChain, conceptMap);
  const average = progressRows.length
    ? Math.round(progressRows.reduce((sum, row) => sum + row.percent, 0) / progressRows.length)
    : 0;
  overallScore.textContent = `${average}%`;

  function renderMissions(rows) {
    missionList.innerHTML = "";
    rows.forEach((row) => {
      missionList.appendChild(progressItem({
        title: row.title,
        body: `${row.score}/${row.total} local points`,
        badge: `${row.percent}%`,
        good: row.percent >= 80,
        href: row.href
      }));
    });
  }

  function renderQuiz() {
    quizList.innerHTML = "";
    const state = read("tc2007b-quiz-pilot");
    const attempts = Object.values(state.attempts || {}).filter((attempt) => attempt.submitted_at);
    if (!attempts.length) {
      quizList.appendChild(progressItem({
        title: "No local quiz submission yet",
        body: "After a demo-mode quiz, your last local result appears here.",
        badge: "start",
        empty: true,
        href: "../week-01/lecture/quiz/"
      }));
      return [];
    }

    const rows = attempts
      .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
      .slice(0, 3);
    rows.forEach((attempt) => {
        const percent = attempt.total ? Math.round((Number(attempt.score || 0) / Number(attempt.total)) * 100) : 0;
        quizList.appendChild(progressItem({
          title: `${attempt.student_name || "Quiz attempt"} · ${attempt.session_code}`,
          body: new Date(attempt.submitted_at).toLocaleString(),
          badge: `${percent}%`,
          good: percent >= 80,
          href: "../week-01/lecture/quiz/"
        }));
      });
    return rows;
  }

  function renderCaseFiles() {
    caseFileList.innerHTML = "";
    const data = read("tc2007b-case-files");
    const results = data.results || {};
    const rows = caseFiles.map(([id, title]) => {
      const result = results[id] || {};
      const score = Number(result.score || 0);
      const total = Number(result.total || 3);
      const completed = Boolean(result.completed);
      const percent = completed && total ? Math.round((score / total) * 100) : 0;
      return { id, title, score, total, completed, percent };
    });

    rows.forEach((row) => {
      caseFileList.appendChild(progressItem({
        title: row.title,
        body: row.completed ? `${row.score}/${row.total} decisions correct` : "Open the case, inspect evidence, and choose the response.",
        badge: row.completed ? `${row.percent}%` : "open",
        good: row.percent >= 80,
        empty: !row.completed,
        href: "../case-files/"
      }));
    });
    return rows;
  }

  function renderReviewCoach() {
    reviewCoachList.innerHTML = "";
    const data = read("tc2007b-review-coach");
    const records = Object.values(data.cards || {});
    const got = records.filter((record) => record.last_rating === "got").length;
    const again = records.filter((record) => record.last_rating === "again").length;
    const total = got + again;
    const percent = Math.min(100, Math.round((total / 8) * 100));
    reviewCoachList.appendChild(progressItem({
      title: total ? "Review sprint in progress" : "No review sprint yet",
      body: total ? `${got} marked got it · ${again} marked review again` : "Run a short flashcard sprint after class to lock in weak topics.",
      badge: total ? `${total} cards` : "start",
      good: total >= 5,
      empty: !total,
      href: "../review-coach/"
    }));
    return { got, again, total, percent };
  }

  function renderAttackChain() {
    attackChainList.innerHTML = "";
    const data = read("tc2007b-attack-chain");
    const results = data.results || {};
    const rows = Object.values(results);
    const score = rows.reduce((sum, row) => sum + Number(row.score || 0), 0);
    const completedStages = rows.filter((row) => row.checked).length;
    const total = 18;
    const percent = Math.round((score / total) * 100);
    attackChainList.appendChild(progressItem({
      title: completedStages ? "Attack chain in progress" : "No attack-chain run yet",
      body: completedStages ? `${completedStages}/6 stages checked · ${score}/${total} decisions correct` : "Map one incident across identity, app, malware, network, and detection decisions.",
      badge: `${percent}%`,
      good: percent >= 80,
      empty: !completedStages,
      href: "../attack-chain/"
    }));
    return { title: "Attack Chain Lab", percent, score, total, completed: completedStages === 6 };
  }

  function renderConceptMap() {
    conceptMapList.innerHTML = "";
    const data = read("tc2007b-concept-map");
    const records = Object.values(data.confidence || {});
    const total = 15;
    const ready = records.filter((record) => Number(record.rating || 0) >= 4).length;
    const weak = records.filter((record) => Number(record.rating || 0) > 0 && Number(record.rating || 0) <= 2).length;
    const percent = Math.round((ready / total) * 100);
    conceptMapList.appendChild(progressItem({
      title: records.length ? "Concept readiness map" : "No concept map signal yet",
      body: records.length ? `${ready}/${total} concepts at confidence 4 or 5 · ${weak} need review` : "Mark concept confidence to see how the course ideas connect.",
      badge: `${percent}%`,
      good: percent >= 70,
      empty: !records.length,
      href: "../concept-map/"
    }));
    return { title: "Concept Map", percent, ready, total, weak, completed: ready >= total };
  }

  function renderPortfolio(missionRows, caseRows, attackChain, conceptMap, reviewCoach, reflections) {
    portfolioList.innerHTML = "";
    const missionAverage = missionRows.length
      ? Math.round(missionRows.reduce((sum, row) => sum + row.percent, 0) / missionRows.length)
      : 0;
    const caseCompleted = caseRows.filter((row) => row.completed).length;
    const readySignals = [
      missionAverage >= 70,
      caseCompleted >= 3,
      attackChain.percent >= 50,
      conceptMap.percent >= 50,
      reviewCoach.total >= 5,
      reflections.length >= 1
    ].filter(Boolean).length;
    portfolioList.appendChild(progressItem({
      title: "Learning Portfolio",
      body: `${readySignals}/6 evidence signals ready: missions, cases, attack chain, concept map, review, reflections.`,
      badge: readySignals >= 5 ? "ready" : "build",
      good: readySignals >= 5,
      empty: readySignals < 5,
      href: "../portfolio/"
    }));
  }

  function renderBadges(rows, quizRows, reflections, caseRows, attackChain, conceptMap, reviewCoach) {
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    const earned = (key) => Number(byKey[key]?.percent || 0) >= 80;
    const badgeRows = [
      ["Security Mindset", "Earn 80% on Mission 01.", earned("tc2007b-mission-01")],
      ["Auth Defender", "Earn 80% on Mission 02.", earned("tc2007b-mission-02")],
      ["Access Architect", "Earn 80% on Mission 03.", earned("tc2007b-mission-03")],
      ["App Shield", "Earn 80% on Mission 04.", earned("tc2007b-mission-04")],
      ["Release Guardian", "Earn 80% on the Week 4 bridge mission.", earned("tc2007b-bridge-04")],
      ["Crypto Builder", "Earn 80% on Mission 05.", earned("tc2007b-mission-05")],
      ["Key Steward", "Earn 80% on the Week 6 bridge mission.", earned("tc2007b-bridge-06")],
      ["Protocol Analyst", "Earn 80% on Mission 06.", earned("tc2007b-mission-06")],
      ["Channel Defender", "Earn 80% on the Week 8 bridge mission.", earned("tc2007b-bridge-08")],
      ["Malware Responder", "Earn 80% on Mission 07.", earned("tc2007b-mission-07")],
      ["Firewall Designer", "Earn 80% on Mission 08.", earned("tc2007b-mission-08")],
      ["Detection Tuner", "Earn 80% on Mission 09.", earned("tc2007b-mission-09")],
      ["Incident Analyst", "Complete all five security case files.", caseRows.every((row) => row.completed)],
      ["Attack Mapper", "Earn 80% on the Attack Chain Lab.", attackChain.percent >= 80],
      ["Concept Cartographer", "Mark 70% of concepts as explainable.", conceptMap.percent >= 70],
      ["Review Sprinter", "Review at least five coach cards.", reviewCoach.total >= 5],
      ["Quiz Climber", "Score 80% on a live or demo quiz.", quizRows.some((attempt) => Number(attempt.total || 0) && (Number(attempt.score || 0) / Number(attempt.total || 1)) >= 0.8)],
      ["Reflection Habit", "Submit at least two exit tickets.", reflections.length >= 2]
    ];

    badgeShelf.innerHTML = "";
    badgeRows.forEach(([title, body, earned]) => {
      const badge = document.createElement("article");
      badge.className = "course-badge";
      badge.classList.toggle("is-earned", earned);
      badge.innerHTML = `
        <span class="course-badge__mark"></span>
        <span>
          <h3></h3>
          <p></p>
        </span>
      `;
      badge.querySelector(".course-badge__mark").textContent = earned ? "OK" : "GO";
      badge.querySelector("h3").textContent = title;
      badge.querySelector("p").textContent = body;
      badgeShelf.appendChild(badge);
    });
  }

  function renderReflections() {
    reflectionList.innerHTML = "";
    const reflections = readArray("tc2007b-exit-tickets")
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 4);

    if (!reflections.length) {
      reflectionList.appendChild(progressItem({
        title: "No exit ticket yet",
        body: "Write one sentence after class about what clicked and what still feels unclear.",
        badge: "start",
        empty: true,
        href: "../exit-ticket/"
      }));
      return [];
    }

    reflections.forEach((ticket) => {
      reflectionList.appendChild(progressItem({
        title: ticket.lecture_title || ticket.lecture_id || "Exit ticket",
        body: ticket.muddy_point ? `Question: ${ticket.muddy_point}` : (ticket.one_thing || "Reflection saved locally."),
        badge: `${ticket.confidence || "-"} / 5`,
        good: Number(ticket.confidence || 0) >= 4,
        href: "../exit-ticket/"
      }));
    });
    return reflections;
  }

  function renderReview(rows, caseRows, attackChain, conceptMap, reviewCoach) {
    reviewPlan.innerHTML = "";
    const notes = rows.flatMap((row) => row.notes.map((note) => ({ note, href: row.href, title: row.title })));
    caseRows
      .filter((row) => !row.completed || row.percent < 80)
      .forEach((row) => {
        notes.push({
          note: row.completed ? `Reopen ${row.title} and improve the response decisions.` : `Complete the ${row.title} scenario case file.`,
          href: "../case-files/",
          title: "Security Case Files"
        });
      });
    if (attackChain.percent < 80) {
      notes.push({
        note: attackChain.completed ? "Revisit the Attack Chain Lab and improve weak stage mappings." : "Complete the Attack Chain Lab to connect concepts across the course.",
        href: "../attack-chain/",
        title: "Attack Chain Lab"
      });
    }
    if (conceptMap.percent < 70) {
      notes.push({
        note: conceptMap.ready ? "Raise weak concept confidence before the next lecture." : "Use the Concept Map to connect prerequisites before deeper review.",
        href: "../concept-map/",
        title: "Concept Map"
      });
    }
    if (reviewCoach.total < 5) {
      notes.unshift({
        note: "Run a five-card Review Coach sprint before the next lecture.",
        href: "../review-coach/",
        title: "Review Coach"
      });
    }
    if (!notes.length) {
      reviewPlan.appendChild(progressItem({
        title: "You are caught up locally",
        body: "Try a fresh quiz session or help someone explain a concept.",
        badge: "ready",
        good: true,
        href: "../week-01/lecture/quiz/"
      }));
      return [];
    }
    notes.slice(0, 5).forEach((item) => {
      reviewPlan.appendChild(progressItem({
        title: item.note,
        body: item.title,
        badge: "review",
        empty: true,
        href: item.href
      }));
    });
    return notes;
  }

  function renderStudyPlan({ missionRows, quizRows, reflections, caseRows, attackChain, conceptMap, reviewCoach, reviewNotes }) {
    studyPlan.innerHTML = "";
    const weakestMission = missionRows
      .slice()
      .sort((a, b) => a.percent - b.percent)
      .find((row) => row.percent < 80);
    const incompleteCase = caseRows.find((row) => !row.completed || row.percent < 80);
    const latestQuiz = quizRows[0];
    const latestQuizPercent = latestQuiz?.total ? Math.round((Number(latestQuiz.score || 0) / Number(latestQuiz.total || 1)) * 100) : null;
    const lowReflection = reflections.find((ticket) => Number(ticket.confidence || 0) <= 2);

    const quickWin = reviewCoach.total < 5
      ? ["Quick win", "Run a five-card Review Coach sprint and mark each card honestly.", "../review-coach/"]
      : reviewNotes[0]
        ? ["Quick win", reviewNotes[0].note, reviewNotes[0].href]
        : ["Quick win", "Take a fresh quiz pulse or explain one concept to a classmate.", "../week-01/lecture/quiz/"];
    const deepPractice = incompleteCase
      ? ["Deep practice", `Work through ${incompleteCase.title} and write the first response decision.`, "../case-files/"]
      : weakestMission
        ? ["Deep practice", `Revisit ${weakestMission.title}; it is currently at ${weakestMission.percent}%.`, weakestMission.href]
        : ["Deep practice", "Open the Attack Chain Lab and connect one incident across all stages.", "../attack-chain/"];
    const conceptRepair = conceptMap.percent < 70
      ? ["Concept repair", `Raise concept-map readiness above 70%; ${conceptMap.weak} concepts are marked weak.`, "../concept-map/"]
      : latestQuizPercent != null && latestQuizPercent < 80
        ? ["Concept repair", `Retake or review the latest quiz attempt; it is currently ${latestQuizPercent}%.`, "../week-01/lecture/quiz/"]
        : ["Concept repair", "Pick one strong concept and connect it to a weaker later concept.", "../concept-map/"];
    const evidenceAction = reflections.length < 2 || lowReflection
      ? ["Evidence action", "Submit an exit ticket that names one clear idea, one muddy point, and one next action.", "../exit-ticket/"]
      : ["Evidence action", "Open your Learning Portfolio and export or submit your current evidence.", "../portfolio/"];

    const cards = [quickWin, deepPractice, conceptRepair, evidenceAction];
    cards.forEach(([title, body, href], index) => {
      studyPlan.appendChild(studyCard({ day: index + 1, title, body, href }));
    });

    const week = [
      ["Day 1", quickWin[1], quickWin[2]],
      ["Day 2", deepPractice[1], deepPractice[2]],
      ["Day 3", conceptRepair[1], conceptRepair[2]],
      ["Day 4", "Run Review Coach again and mark anything uncertain as Review again.", "../review-coach/"],
      ["Day 5", "Complete one quiz or case-file retry, then check the Progress page.", "../progress/"],
      ["Day 6", evidenceAction[1], evidenceAction[2]],
      ["Day 7", "Write a two-minute summary: what changed, what remains fragile, and what you will ask next class.", "../exit-ticket/"]
    ];
    studyPlanText = ["TC2007B 7-day study plan"]
      .concat(week.map(([day, body]) => `${day}: ${body}`))
      .join("\n");
  }

  function studyCard({ day, title, body, href }) {
    const item = document.createElement("a");
    item.className = "study-card";
    item.href = href;
    item.innerHTML = `
      <strong></strong>
      <span></span>
      <p></p>
    `;
    item.querySelector("strong").textContent = `Step ${day}`;
    item.querySelector("span").textContent = title;
    item.querySelector("p").textContent = body;
    return item;
  }

  async function copyStudyPlan() {
    try {
      await navigator.clipboard.writeText(studyPlanText);
      setStudyStatus("Study plan copied.", "good");
    } catch (_error) {
      setStudyStatus(studyPlanText, "warn");
    }
  }

  function setStudyStatus(message, tone) {
    studyPlanStatus.textContent = message;
    if (tone) studyPlanStatus.dataset.tone = tone;
    else studyPlanStatus.removeAttribute("data-tone");
  }

  function progressItem({ title, body, badge, good, empty, href }) {
    const item = document.createElement("a");
    item.className = "progress-item";
    item.href = href;
    item.innerHTML = `
      <span>
        <h3></h3>
        <p></p>
      </span>
      <strong class="progress-badge"></strong>
    `;
    item.querySelector("h3").textContent = title;
    item.querySelector("p").textContent = body;
    const badgeEl = item.querySelector(".progress-badge");
    badgeEl.textContent = badge;
    badgeEl.classList.toggle("is-good", Boolean(good));
    badgeEl.classList.toggle("is-empty", Boolean(empty));
    return item;
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
