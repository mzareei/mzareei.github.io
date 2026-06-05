(function () {
  const slides = window.LECTURE_SLIDES || [];
  const frame = document.getElementById("slideFrame");
  const transcript = document.getElementById("transcript");
  const counter = document.getElementById("counter");
  const title = document.getElementById("slideTitle");
  const blockLabel = document.getElementById("blockLabel");
  const notesBlock = document.getElementById("speakerNotesBlock");
  const notes = document.getElementById("speakerNotes");
  const overview = document.getElementById("overview");
  const overviewGrid = document.getElementById("overviewGrid");

  let slideIndex = 0;
  let stepIndex = 0;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function escapeText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function readHash() {
    const match = window.location.hash.match(/^#\/(\d+)(?:\/(\d+))?/);
    if (!match) return;
    slideIndex = clamp(Number(match[1]) - 1, 0, slides.length - 1);
    stepIndex = clamp(Number(match[2] || 0), 0, getStepCount(slides[slideIndex]) - 1);
  }

  function writeHash() {
    const next = `#/${slideIndex + 1}/${stepIndex}`;
    if (window.location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }

  function getStepCount(slide) {
    return Math.max(1, slide.objects.filter((object) => object.kind !== "decorative").length);
  }

  function objectStyle(object) {
    if (!object.box) return "";
    return [
      `left:${object.box.x}%`,
      `top:${object.box.y}%`,
      `width:${object.box.w}%`,
      `height:${object.box.h}%`,
    ].join(";");
  }

  function renderTextObject(object, objectNumber, isFocus) {
    const roleClass = object.role === "title" ? " slide-text--title" : "";
    const paragraphs = object.paragraphs.map(escapeText).join("\\n");
    if (object.box) {
      return `<div class="slide-object slide-text${roleClass}${isFocus ? " is-focus" : ""}" data-object="${objectNumber}" style="${objectStyle(object)}">${paragraphs}</div>`;
    }
    return `<div class="slide-text${roleClass}${isFocus ? " is-focus" : ""}" data-object="${objectNumber}">${paragraphs}</div>`;
  }

  function renderImageObject(object, objectNumber, isFocus) {
    if (object.src) {
      const fitClass = object.backgroundish ? " is-backgroundish" : "";
      return `<img class="slide-object slide-image${fitClass}${isFocus ? " is-focus" : ""}" data-object="${objectNumber}" src="${object.src}" alt="${escapeText(object.alt || "Slide image")}" style="${objectStyle(object)}">`;
    }
    return `<div class="slide-object image-fallback${isFocus ? " is-focus" : ""}" data-object="${objectNumber}" style="${objectStyle(object)}">Image from source slide</div>`;
  }

  function renderSlide() {
    const slide = slides[slideIndex];
    const focusable = slide.objects.filter((object) => object.kind !== "decorative");
    const focus = focusable[stepIndex] || focusable[0];
    let objectNumber = 0;
    const positioned = [];
    const auto = [];

    slide.objects.forEach((object) => {
      const currentNumber = object.kind === "decorative" ? -1 : objectNumber++;
      const isFocus = focus && object.id === focus.id;
      const html = object.type === "image"
        ? renderImageObject(object, currentNumber, isFocus)
        : renderTextObject(object, currentNumber, isFocus);
      if (object.box) positioned.push(html);
      else auto.push(html);
    });

    frame.innerHTML = positioned.join("") + (auto.length ? `<div class="slide-auto">${auto.join("")}</div>` : "");

    title.textContent = slide.title || `Slide ${slide.number}`;
    blockLabel.textContent = slide.block || "Lecture";
    counter.textContent = `Slide ${slide.number} / ${slides.length} · Step ${stepIndex + 1} / ${getStepCount(slide)}`;

    transcript.innerHTML = "";
    const transcriptItems = slide.transcript.length ? slide.transcript : ["Image-only or visual slide in the source deck."];
    transcriptItems.forEach((line, index) => {
      const li = document.createElement("li");
      li.textContent = line;
      if (focus && focus.transcriptIndex === index) li.classList.add("is-focus");
      transcript.appendChild(li);
    });

    if (slide.notes && slide.notes.length) {
      notesBlock.hidden = false;
      notes.innerHTML = slide.notes.map((line) => `<p>${escapeText(line)}</p>`).join("");
    } else {
      notesBlock.hidden = true;
      notes.innerHTML = "";
    }

    writeHash();
  }

  function goToSlide(index, step) {
    slideIndex = clamp(index, 0, slides.length - 1);
    stepIndex = clamp(step || 0, 0, getStepCount(slides[slideIndex]) - 1);
    renderSlide();
  }

  function nextStep() {
    const maxStep = getStepCount(slides[slideIndex]) - 1;
    if (stepIndex < maxStep) {
      stepIndex += 1;
      renderSlide();
    } else {
      goToSlide(slideIndex + 1, 0);
    }
  }

  function prevStep() {
    if (stepIndex > 0) {
      stepIndex -= 1;
      renderSlide();
    } else if (slideIndex > 0) {
      goToSlide(slideIndex - 1, getStepCount(slides[slideIndex - 1]) - 1);
    }
  }

  function buildOverview() {
    overviewGrid.innerHTML = "";
    slides.forEach((slide, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "overview-card";
      button.innerHTML = `<strong>${String(slide.number).padStart(2, "0")}</strong><span>${escapeText(slide.title || "Untitled slide")}</span>`;
      button.addEventListener("click", () => {
        overview.hidden = true;
        goToSlide(index, 0);
      });
      overviewGrid.appendChild(button);
    });
  }

  document.getElementById("nextStep").addEventListener("click", nextStep);
  document.getElementById("prevStep").addEventListener("click", prevStep);
  document.getElementById("nextSlide").addEventListener("click", () => goToSlide(slideIndex + 1, 0));
  document.getElementById("prevSlide").addEventListener("click", () => goToSlide(slideIndex - 1, 0));
  document.getElementById("toggleOverview").addEventListener("click", () => { overview.hidden = false; });
  document.getElementById("closeOverview").addEventListener("click", () => { overview.hidden = true; });

  document.addEventListener("keydown", (event) => {
    if (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    if (event.key === "ArrowRight" || event.key === " ") {
      event.preventDefault();
      nextStep();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prevStep();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      goToSlide(slideIndex + 1, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      goToSlide(slideIndex - 1, 0);
    } else if (event.key.toLowerCase() === "o") {
      overview.hidden = !overview.hidden;
    } else if (event.key.toLowerCase() === "f") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } else if (event.key === "Escape") {
      overview.hidden = true;
    }
  });

  window.addEventListener("hashchange", () => {
    readHash();
    renderSlide();
  });

  if (!slides.length) {
    frame.innerHTML = "<p>No slides were found.</p>";
    return;
  }

  buildOverview();
  readHash();
  renderSlide();
})();
