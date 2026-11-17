// Small enhancements on top of a page that works without JavaScript.
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Theme: dark by default, light if chosen. The inline script in <head>
  // applies the saved choice before first paint; this wires up the button.
  function initTheme() {
    var button = document.querySelector(".theme-toggle");
    var meta = document.querySelector('meta[name="theme-color"]');

    function sync() {
      var dark = root.dataset.theme !== "light";
      button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      if (meta) meta.setAttribute("content", dark ? "#0b0e14" : "#f8f8f6");
    }

    button.addEventListener("click", function () {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
      sync();
    });
    sync();
  }

  // Phone menu: a drawer under the nav bar.
  function initMenu() {
    var header = document.querySelector(".site-nav");
    var button = document.querySelector(".menu-toggle");
    var links = document.querySelectorAll("#nav-links a");

    function setOpen(open) {
      header.classList.toggle("menu-open", open);
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    button.addEventListener("click", function () {
      setOpen(!header.classList.contains("menu-open"));
    });
    links.forEach(function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("menu-open")) {
        setOpen(false);
        button.focus();
      }
    });
    window.matchMedia("(min-width: 768px)").addEventListener("change", function (e) {
      if (e.matches) setOpen(false);
    });
  }

  // Highlight the nav link for the section on screen.
  function initActiveNav() {
    if (!("IntersectionObserver" in window)) return;
    var links = {};
    document.querySelectorAll("#nav-links a").forEach(function (a) {
      links[a.getAttribute("href").slice(1)] = a;
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Object.keys(links).forEach(function (id) { links[id].removeAttribute("aria-current"); });
        var link = links[entry.target.id];
        if (link) link.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-70px 0px -60% 0px" });

    Object.keys(links).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  // Sections fade up as they scroll into view.
  function initReveal() {
    var blocks = document.querySelectorAll(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      blocks.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    blocks.forEach(function (el) { observer.observe(el); });
  }

  // Hero headline: types and deletes each phrase in turn.
  function initTyping() {
    var el = document.querySelector(".typed");
    if (!el || reduceMotion) return;
    var phrases;
    try { phrases = JSON.parse(el.dataset.phrases); } catch (e) { return; }
    if (!phrases || phrases.length < 2) return;

    var phrase = 0;
    var chars = phrases[0].length;
    var deleting = true;

    function tick() {
      if (document.hidden) { setTimeout(tick, 500); return; }
      var text = phrases[phrase];
      chars += deleting ? -1 : 1;
      el.textContent = text.slice(0, chars);

      var delay = deleting ? 45 : 85;
      if (!deleting && chars === text.length) {
        deleting = true;
        delay = 2200;
      } else if (deleting && chars === 0) {
        deleting = false;
        phrase = (phrase + 1) % phrases.length;
        delay = 350;
      }
      setTimeout(tick, delay);
    }

    // The first phrase is already in the HTML; hold it, then start cycling.
    setTimeout(tick, 2600);
  }

  initTheme();
  initMenu();
  initActiveNav();
  initReveal();
  initTyping();
})();
