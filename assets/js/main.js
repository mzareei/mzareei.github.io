/* ============================================================
   main.js  —  small, dependency-free site behaviour
   1. Dark/light theme toggle (persists in localStorage)
   2. Mobile navigation toggle
   3. Publication filtering by year and type
   ============================================================ */
(function () {
  "use strict";

  /* ---- 1. Theme toggle ---------------------------------- */
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* ---- 2. Mobile nav ------------------------------------ */
  var navToggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---- 3. Publication filters --------------------------- */
  var yearSel = document.getElementById("filter-year");
  var typeSel = document.getElementById("filter-type");
  var pubItems = Array.prototype.slice.call(document.querySelectorAll(".pub-item"));

  function applyFilters() {
    if (!pubItems.length) return;
    var y = yearSel ? yearSel.value : "all";
    var t = typeSel ? typeSel.value : "all";

    pubItems.forEach(function (item) {
      var matchYear = (y === "all") || (item.getAttribute("data-year") === y);
      var matchType = (t === "all") || (item.getAttribute("data-type") === t);
      item.style.display = (matchYear && matchType) ? "" : "none";
    });

    // Hide a type heading + its group if every item under it is hidden.
    document.querySelectorAll("[data-pub-group]").forEach(function (group) {
      var visible = group.querySelectorAll('.pub-item:not([style*="display: none"])').length;
      group.style.display = visible ? "" : "none";
    });
  }

  if (yearSel) yearSel.addEventListener("change", applyFilters);
  if (typeSel) typeSel.addEventListener("change", applyFilters);
})();
