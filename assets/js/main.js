(function () {
  "use strict";

  var root = document.documentElement;
  var themeToggle = document.querySelector(".theme-toggle");

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function syncThemeControl() {
    if (!themeToggle) return;
    var dark = currentTheme() === "dark";
    themeToggle.setAttribute("aria-pressed", String(dark));
    themeToggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }

  syncThemeControl();
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (error) {}
      syncThemeControl();
    });
  }

  var navToggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  var mobileNavigation = window.matchMedia("(max-width: 880px)");

  function setNavigation(open, returnFocus) {
    if (!navToggle || !nav) return;
    var mobile = mobileNavigation.matches;
    var shouldOpen = mobile && open;
    nav.classList.toggle("is-open", shouldOpen);
    navToggle.setAttribute("aria-expanded", String(shouldOpen));
    navToggle.setAttribute("aria-label", shouldOpen ? "Close navigation" : "Open navigation");
    nav.toggleAttribute("inert", mobile && !shouldOpen);
    if (mobile) nav.setAttribute("aria-hidden", String(!shouldOpen));
    else nav.removeAttribute("aria-hidden");
    if (returnFocus) navToggle.focus();
  }

  if (navToggle && nav) {
    setNavigation(false, false);
    navToggle.addEventListener("click", function () {
      setNavigation(navToggle.getAttribute("aria-expanded") !== "true", false);
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setNavigation(false, false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) setNavigation(false, true);
    });
    document.addEventListener("click", function (event) {
      if (mobileNavigation.matches && nav.classList.contains("is-open") &&
          !nav.contains(event.target) && !navToggle.contains(event.target)) setNavigation(false, false);
    });
    mobileNavigation.addEventListener("change", function () {
      var returnFocus = !mobileNavigation.matches && nav.contains(document.activeElement);
      setNavigation(false, returnFocus);
    });
  }

  var yearSelect = document.getElementById("filter-year");
  var typeSelect = document.getElementById("filter-type");
  var publications = Array.prototype.slice.call(document.querySelectorAll(".pub-item"));

  function applyFilters() {
    var year = yearSelect ? yearSelect.value : "all";
    var type = typeSelect ? typeSelect.value : "all";
    publications.forEach(function (item) {
      var visible = (year === "all" || item.dataset.year === year) &&
        (type === "all" || item.dataset.type === type);
      item.hidden = !visible;
    });
  }

  if (yearSelect) yearSelect.addEventListener("change", applyFilters);
  if (typeSelect) typeSelect.addEventListener("change", applyFilters);
})();
