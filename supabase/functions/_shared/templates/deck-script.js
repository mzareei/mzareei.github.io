/* =====================================================================
   Generated lecture deck presenter engine
   Navigation + click-to-reveal fragments + EN/ES language + light/dark.
   course-platform-question-display:v1
   No dependency on side panels or hidden notes.
   ===================================================================== */
(function () {
  "use strict";

  var root    = document.documentElement;
  var slides  = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var total   = slides.length;
  var current = 0;
  var lastAppliedRevision = 0;

  var elProgress = document.getElementById("progress");
  var elCur      = document.getElementById("cur");
  var elTotal    = document.getElementById("total");
  var elSecName  = document.getElementById("secName");
  var overview   = document.getElementById("overview");
  var ovGrid     = document.getElementById("ovGrid");
  var ovTitle    = document.getElementById("ovTitle");
  var help       = document.getElementById("help");
  var fragHint   = document.getElementById("fragHint");
  var fragHintTx = document.getElementById("fragHintText");
  var langBtn    = document.getElementById("langBtn");
  var themeBtn   = document.getElementById("themeBtn");

  elTotal.textContent = total;

  /* ---- Language ---- */
  var lang  = read("tc-lang", "en");
  var theme = read("tc-theme", "dark");

  // SVG concept-map text isn't a [data-es] element, so translate by class.
  var svgMap = {
    "cm-owners":   ["Owners", "Propietarios"],
    "cm-owners-s": ["value & protect", "valoran y protegen"],
    "cm-assets":   ["Assets", "Activos"],
    "cm-assets-s": ["things of value", "cosas de valor"],
    "cm-vuln":     ["Vulnerabilities", "Vulnerabilidades"],
    "cm-vuln-s":   ["weaknesses", "debilidades"],
    "cm-threats":  ["Threats", "Amenazas"],
    "cm-threats-s":["actors + actions", "actores + acciones"],
    "cm-risk":     ["Risk", "Riesgo"],
    "cm-risk-s":   ["to assets", "a los activos"],
    "cm-cm":       ["Countermeasures", "Contramedidas"],
    "cm-cm-s":     ["reduce risk", "reducen el riesgo"],
    "cm-l1":       ["own", "poseen"],
    "cm-l2":       ["have", "tienen"],
    "cm-l3":       ["exploit", "explotan"],
    "cm-l4":       ["create", "crean"],
    "cm-l5":       ["protect", "protegen"]
  };
  var uiText = {
    ovTitle:  ["Slide overview", "Vista general de diapositivas"],
    fragHint: ["click to reveal", "clic para revelar"],
    checkpointReady: ["Ready to send from the class controls.", "Lista para enviar desde los controles de la clase."],
    checkpointSent: ["Question sent to students.", "Pregunta enviada a estudiantes."],
    checkpointRevealed: ["Answer revealed.", "Respuesta mostrada."]
  };

  function captureEnglish() {
    document.querySelectorAll("[data-es]").forEach(function (el) {
      if (!el.hasAttribute("data-en")) el.setAttribute("data-en", el.innerHTML);
    });
  }

  function applyLang(l) {
    lang = l;
    root.setAttribute("data-lang", l);
    root.setAttribute("lang", l);
    var idx = (l === "es") ? 1 : 0;

    document.querySelectorAll("[data-es]").forEach(function (el) {
      var html = (l === "es") ? el.getAttribute("data-es") : el.getAttribute("data-en");
      if (html != null) el.innerHTML = html;
    });
    Object.keys(svgMap).forEach(function (cls) {
      var t = document.querySelector("text." + cls);
      if (t) t.textContent = svgMap[cls][idx];
    });

    langBtn.textContent    = (l === "es") ? "EN" : "ES";
    ovTitle.textContent    = uiText.ovTitle[idx];
    fragHintTx.textContent = uiText.fragHint[idx];
    updateSecName();
    updateCheckpointSlot();
    save("tc-lang", l);
  }
  function toggleLang() { applyLang(lang === "es" ? "en" : "es"); }

  /* ---- Theme ---- */
  function applyTheme(t) {
    theme = t;
    root.setAttribute("data-theme", t);
    themeBtn.textContent = (t === "dark") ? "☀" : "☽";
    save("tc-theme", t);
  }
  function toggleTheme() { applyTheme(theme === "dark" ? "light" : "dark"); }

  /* ---- Fragments + navigation ---- */
  function setFragments(slide, revealAll) {
    slide.querySelectorAll(".fragment").forEach(function (f) {
      f.classList.toggle("revealed", !!revealAll);
    });
  }

  function show(i, dir, appliedRevision, acknowledgedTeachingSlide) {
    i = Math.max(0, Math.min(total - 1, i));
    slides[current].classList.remove("active");
    current = i;
    var s = slides[current];
    s.classList.add("active");
    setFragments(s, dir !== "forward");
    updateChrome();
    notifyParent({
      type: "deck.slide_changed",
      slide: current + 1,
      teaching_slide: Number.isInteger(acknowledgedTeachingSlide)
        ? acknowledgedTeachingSlide
        : Number(s.getAttribute("data-teaching-slide")) || null,
      appliedRevision: Number.isInteger(appliedRevision) ? appliedRevision : null
    });
    var checkpointKey = s.getAttribute("data-checkpoint-key");
    if (checkpointKey) {
      notifyParent({
        type: "deck.checkpoint_entered",
        checkpoint_key: checkpointKey,
        after_slide: Number(s.getAttribute("data-after-slide"))
      });
    }
  }

  function next() {
    var hidden = slides[current].querySelector(".fragment:not(.revealed)");
    if (hidden) { hidden.classList.add("revealed"); updateFragHint(); return; }
    if (current < total - 1) show(current + 1, "forward");
  }
  function prev() {
    var revealed = slides[current].querySelectorAll(".fragment.revealed");
    if (revealed.length) { revealed[revealed.length - 1].classList.remove("revealed"); updateFragHint(); return; }
    if (current > 0) show(current - 1, "back");
  }

  function updateChrome() {
    elCur.textContent = current + 1;
    elProgress.style.width = ((current + 1) / total * 100) + "%";
    updateSecName();
    updateFragHint();
    if (history.replaceState) history.replaceState(null, "", "#" + (current + 1));
    closeOverlays();
  }
  function updateSecName() {
    var s = slides[current];
    var name = (lang === "es" && s.getAttribute("data-section-es")) || s.getAttribute("data-section") || "";
    elSecName.textContent = name;
  }
  function updateFragHint() {
    var more = !!slides[current].querySelector(".fragment:not(.revealed)");
    fragHint.classList.toggle("show", more);
  }
  function updateCheckpointSlot() {
    var slide = slides[current];
    var slot = slide && slide.querySelector(".checkpoint-slot");
    if (!slot) return;
    var state = slide.getAttribute("data-checkpoint-state");
    var copy = state === "ready" ? uiText.checkpointReady
      : state === "sent" ? uiText.checkpointSent
      : state === "revealed" ? uiText.checkpointRevealed
      : null;
    slot.textContent = copy ? copy[lang === "es" ? 1 : 0] : "";
  }

  var classroomQuestionLayer = null;

  function clearQuestionDisplay() {
    if (classroomQuestionLayer) classroomQuestionLayer.remove();
    classroomQuestionLayer = null;
  }

  function showQuestionDisplay(message) {
    clearQuestionDisplay();
    var layer = document.createElement("section");
    layer.className = "classroom-question-layer";
    layer.setAttribute("aria-live", "polite");
    var shell = document.createElement("div");
    shell.className = "classroom-question-shell";
    var kicker = document.createElement("p");
    kicker.className = "kicker";
    kicker.textContent = lang === "es" ? "Pregunta en vivo" : "Live question";
    var prompt = document.createElement("h1");
    prompt.textContent = message.prompt;
    shell.appendChild(kicker);
    shell.appendChild(prompt);
    if (message.prompt_es) {
      var promptEs = document.createElement("p");
      promptEs.className = "classroom-question-es";
      promptEs.textContent = message.prompt_es;
      shell.appendChild(promptEs);
    }
    var instruction = document.createElement("p");
    instruction.className = "classroom-question-instruction";
    instruction.textContent = lang === "es"
      ? "Elige la mejor respuesta en tu teléfono."
      : "Choose the best answer on your phone.";
    shell.appendChild(instruction);
    var options = document.createElement("div");
    options.className = "classroom-question-options";
    message.options.forEach(function (option) {
      var item = document.createElement("div");
      item.className = "classroom-question-option";
      var key = document.createElement("span");
      key.className = "classroom-question-key";
      key.textContent = option.key;
      var copy = document.createElement("span");
      copy.textContent = option.text;
      if (option.text_es) {
        var copyEs = document.createElement("span");
        copyEs.className = "classroom-question-option-es";
        copyEs.textContent = option.text_es;
        copy.appendChild(copyEs);
      }
      item.appendChild(key);
      item.appendChild(copy);
      options.appendChild(item);
    });
    shell.appendChild(options);
    var hint = document.createElement("p");
    hint.className = "classroom-question-hint";
    hint.textContent = lang === "es"
      ? "Continúa la clase cuando estés listo."
      : "Continue the lecture when you are ready.";
    shell.appendChild(hint);
    layer.appendChild(shell);
    document.body.appendChild(layer);
    classroomQuestionLayer = layer;
  }

  /* ---- Same-origin parent bridge ---- */
  function notifyParent(message) {
    if (parent === window) return;
    var payload = {};
    Object.keys(message).forEach(function (key) { payload[key] = message[key]; });
    payload.version = 1;
    parent.postMessage(payload, location.origin);
  }

  function validParentMessage(value) {
    if (!value || typeof value !== "object") return false;
    var proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    var ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some(function (key) { return typeof key !== "string"; })) return false;
    var descriptors = Object.getOwnPropertyDescriptors(value);
    if (ownKeys.some(function (key) {
      return !Object.prototype.hasOwnProperty.call(descriptors[key], "value")
        || !descriptors[key].enumerable
        || typeof descriptors[key].value === "function";
    })) return false;
    var keys = Object.getOwnPropertyNames(value).sort().join(",");
    // This command intentionally has no protocol version so it matches the
    // presentation-state wire contract shared by controller and projector.
    if (value.type === "course-platform:goto-slide") {
      return keys === "revision,teachingSlide,type"
        && Number.isInteger(value.teachingSlide)
        && value.teachingSlide > 0
        && Number.isInteger(value.revision)
        && value.revision > 0;
    }
    if (value.type === "checkpoint.question_display") {
      if (keys !== "checkpoint_key,options,prompt,prompt_es,type,version") return false;
      if (value.version !== 1 || typeof value.checkpoint_key !== "string" || !value.checkpoint_key.trim()) return false;
      if (typeof value.prompt !== "string" || value.prompt.length < 1 || value.prompt.length > 2000) return false;
      if (value.prompt_es !== null && typeof value.prompt_es !== "string") return false;
      if (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > 8) return false;
      return value.options.every(function (option) {
        if (!option || typeof option !== "object" || Object.getPrototypeOf(option) !== Object.prototype) return false;
        var optionKeys = Object.getOwnPropertyNames(option).sort();
        return optionKeys.join(",") === "key,text,text_es"
          && typeof option.key === "string" && option.key.length > 0 && option.key.length <= 80
          && typeof option.text === "string" && option.text.length > 0 && option.text.length <= 1000
          && (option.text_es === null || typeof option.text_es === "string");
      });
    }
    if (value.type === "checkpoint.question_clear") {
      return keys === "checkpoint_key,type,version"
        && value.version === 1
        && typeof value.checkpoint_key === "string"
        && !!value.checkpoint_key.trim();
    }
    if (keys !== "checkpoint_key,type,version") return false;
    if (value.version !== 1 || typeof value.checkpoint_key !== "string" || !value.checkpoint_key.trim()) {
      return false;
    }
    return [
      "checkpoint.question_ready",
      "checkpoint.question_sent",
      "checkpoint.answer_revealed",
      "checkpoint.resume"
    ].indexOf(value.type) >= 0;
  }

  function remoteTargetIndex(teachingSlide) {
    var visible = slides[current];
    if (Number(visible.getAttribute("data-after-slide")) === teachingSlide) return current;
    if (Number(visible.getAttribute("data-teaching-slide")) === teachingSlide) {
      var boundary = slides[current + 1];
      if (boundary && Number(boundary.getAttribute("data-after-slide")) === teachingSlide) return current + 1;
    }
    return slides.findIndex(function (slide) {
      return Number(slide.getAttribute("data-teaching-slide")) === teachingSlide;
    });
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== location.origin || event.source !== parent) return;
    if (!validParentMessage(event.data)) return;
    if (event.data.type === "course-platform:goto-slide") {
      if (event.data.revision <= lastAppliedRevision) return;
      var targetIndex = remoteTargetIndex(event.data.teachingSlide);
      if (targetIndex < 0) return;
      show(targetIndex, "back", event.data.revision, event.data.teachingSlide);
      lastAppliedRevision = event.data.revision;
      return;
    }
    var slide = slides[current];
    var checkpointKey = slide.getAttribute("data-checkpoint-key");
    if (!checkpointKey || event.data.checkpoint_key !== checkpointKey) return;

    if (event.data.type === "checkpoint.question_display") {
      showQuestionDisplay(event.data);
      return;
    }
    if (event.data.type === "checkpoint.question_clear") {
      clearQuestionDisplay();
      return;
    }

    if (event.data.type === "checkpoint.resume") {
      next();
      return;
    }
    var state = event.data.type === "checkpoint.question_ready" ? "ready"
      : event.data.type === "checkpoint.question_sent" ? "sent"
      : "revealed";
    slide.setAttribute("data-checkpoint-state", state);
    updateCheckpointSlot();
  });

  /* ---- Keyboard / presenter remote ---- */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.repeat) return;
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        var checkpointKey = slides[current].getAttribute("data-checkpoint-key");
        if (checkpointKey) {
          notifyParent({
            type: "deck.checkpoint_skipped",
            checkpoint_key: checkpointKey
          });
        }
        next();
        break;
      case " ":
        e.preventDefault();
        var checkpointKey = slides[current].getAttribute("data-checkpoint-key");
        if (checkpointKey) {
          notifyParent({
            type: "deck.checkpoint_action",
            checkpoint_key: checkpointKey
          });
        } else next();
        break;
      case "ArrowDown": case "PageDown":
        e.preventDefault(); next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home": e.preventDefault(); show(0, "back"); break;
      case "End":  e.preventDefault(); show(total - 1, "back"); break;
      case "f": case "F": toggleFullscreen(); break;
      case "o": case "O": toggleOverview(); break;
      case "l": case "L": toggleLang(); break;
      case "t": case "T": toggleTheme(); break;
      case "?": toggleHelp(); break;
      case "Escape": closeOverlays(); break;
      default: if (/^[0-9]$/.test(e.key)) handleNumeric(e.key);
    }
  });

  var numBuf = "", numTimer = null;
  function handleNumeric(d) {
    numBuf += d;
    clearTimeout(numTimer);
    numTimer = setTimeout(function () {
      var n = parseInt(numBuf, 10);
      if (n >= 1 && n <= total) show(n - 1, "back");
      numBuf = "";
    }, 600);
  }

  /* ---- Buttons / click / touch ---- */
  document.getElementById("nextBtn").addEventListener("click", next);
  document.getElementById("prevBtn").addEventListener("click", prev);
  document.getElementById("fsBtn").addEventListener("click", toggleFullscreen);
  document.getElementById("ovBtn").addEventListener("click", toggleOverview);
  document.getElementById("helpBtn").addEventListener("click", toggleHelp);
  langBtn.addEventListener("click", toggleLang);
  themeBtn.addEventListener("click", toggleTheme);

  document.getElementById("deck").addEventListener("click", function (e) {
    if (overview.classList.contains("open") || help.classList.contains("open")) return;
    if (e.target.closest("a, button")) return;
    var x = e.clientX / window.innerWidth;
    if (x < 0.12) prev(); else next();
  });

  var tx = 0, ty = 0;
  document.addEventListener("touchstart", function (e) {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); }
  }, { passive: true });

  /* ---- Fullscreen / overview / help ---- */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || function () {}).call(document.documentElement);
    } else {
      (document.exitFullscreen || function () {}).call(document);
    }
  }

  function buildOverview() {
    ovGrid.innerHTML = "";
    slides.forEach(function (s, i) {
      var h = s.querySelector("h1, h2");
      var title = h ? h.textContent.trim() : ("Slide " + (i + 1));
      var sec = (lang === "es" && s.getAttribute("data-section-es")) || s.getAttribute("data-section") || "";
      var card = document.createElement("div");
      card.className = "ov-card";
      card.innerHTML = '<div class="ov-num">' + (i + 1) + '</div>' +
                       '<div class="ov-title"></div>' +
                       '<div class="ov-sec"></div>';
      card.querySelector(".ov-title").textContent = title;
      card.querySelector(".ov-sec").textContent = sec;
      card.addEventListener("click", function () { show(i, "back"); });
      ovGrid.appendChild(card);
    });
  }
  function toggleOverview() {
    if (overview.classList.contains("open")) { overview.classList.remove("open"); return; }
    closeOverlays(); buildOverview(); overview.classList.add("open");
  }
  function toggleHelp() {
    if (help.classList.contains("open")) { help.classList.remove("open"); return; }
    closeOverlays(); help.classList.add("open");
  }
  function closeOverlays() {
    overview.classList.remove("open");
    help.classList.remove("open");
  }
  overview.addEventListener("click", function (e) { if (e.target === overview) closeOverlays(); });
  help.addEventListener("click", function (e) { if (e.target === help) closeOverlays(); });

  /* ---- Storage helpers ---- */
  function read(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---- Init ---- */
  captureEnglish();
  applyTheme(theme);
  applyLang(lang);

  var startN = parseInt((location.hash || "").replace("#", ""), 10);
  show(isNaN(startN) ? 0 : startN - 1, "back");
  notifyParent({ type: "deck.ready", slide: current + 1 });
})();
