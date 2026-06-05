(function () {
  const progressBar = document.getElementById("progressBar");
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  const sections = navItems
    .map((item) => document.querySelector(item.dataset.target))
    .filter(Boolean);

  function updateProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const percent = height > 0 ? Math.min(100, Math.max(0, (scrollTop / height) * 100)) : 0;
    progressBar.style.width = percent + "%";
  }

  function setActiveSection(id) {
    navItems.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.target === "#" + id);
    });
  }

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const target = document.querySelector(item.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(button.dataset.jump);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActiveSection(entry.target.id);
      });
    },
    { rootMargin: "-35% 0px -55% 0px", threshold: 0.01 }
  );
  sections.forEach((section) => observer.observe(section));

  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  document.getElementById("printLesson").addEventListener("click", () => window.print());

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => {
        item.classList.toggle("is-active", item === tab);
        item.setAttribute("aria-selected", item === tab ? "true" : "false");
      });
      panels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.id === tab.dataset.cia);
      });
    });
  });

  document.querySelectorAll(".matrix-row[data-answer]").forEach((row) => {
    row.addEventListener("click", () => {
      row.classList.add("is-revealed");
      row.querySelector("strong").textContent = row.dataset.answer;
    });
  });

  const selects = {
    asset: document.getElementById("assetSelect"),
    actor: document.getElementById("actorSelect"),
    weakness: document.getElementById("weaknessSelect"),
    requirement: document.getElementById("requirementSelect"),
  };
  const caseOutput = document.getElementById("caseOutput");

  function updateCaseOutput() {
    caseOutput.innerHTML =
      "<strong>Scenario:</strong> " +
      selects.actor.value +
      " may target " +
      selects.asset.value +
      " by exploiting " +
      selects.weakness.value +
      ". The class should discuss how this threatens " +
      selects.requirement.value +
      " and what controls could reduce the risk.";
  }

  Object.values(selects).forEach((select) => select.addEventListener("change", updateCaseOutput));
  updateCaseOutput();

  const quizForm = document.getElementById("quizForm");
  const quizResult = document.getElementById("quizResult");
  const answers = {
    q1: "a",
    q2: "a",
    q3: "a",
    q4: "a",
    q5: "a",
  };

  quizForm.addEventListener("submit", (event) => {
    event.preventDefault();
    let score = 0;
    Object.entries(answers).forEach(([name, answer]) => {
      const checked = quizForm.querySelector(`input[name="${name}"]:checked`);
      if (checked && checked.value === answer) score += 1;
    });
    quizResult.textContent = `Score: ${score}/5. ${score >= 4 ? "Good command of the Week 01 vocabulary." : "Review the concept map and CIA section, then try again."}`;
    quizResult.className = "quiz-result " + (score >= 4 ? "is-pass" : "is-review");
  });

  quizForm.addEventListener("reset", () => {
    setTimeout(() => {
      quizResult.textContent = "";
      quizResult.className = "quiz-result";
    }, 0);
  });

  const exitTicket = document.getElementById("exitTicket");
  const wordCount = document.getElementById("wordCount");
  const copyTicket = document.getElementById("copyTicket");

  function updateWordCount() {
    const words = exitTicket.value.trim().split(/\s+/).filter(Boolean);
    wordCount.textContent = words.length + (words.length === 1 ? " word" : " words");
  }

  exitTicket.addEventListener("input", updateWordCount);

  copyTicket.addEventListener("click", async () => {
    const text = exitTicket.value.trim();
    if (!text) {
      wordCount.textContent = "Write a response first";
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      wordCount.textContent = "Response copied";
    } catch (error) {
      exitTicket.select();
      wordCount.textContent = "Select and copy manually";
    }
  });
})();
