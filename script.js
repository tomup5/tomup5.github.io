// Small enhancements on top of a page that works without JavaScript.
// Each feature runs on its own, so one failing can't take the others down.
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function run(fn) {
    try { fn(); } catch (e) { if (window.console) console.error(e); }
  }

  function onMediaChange(query, handler) {
    var mq = window.matchMedia(query);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  // Light/dark switch. The inline script in <head> applies the saved choice
  // before the first paint; this keeps the button and browser chrome in step.
  function initTheme() {
    var button = document.querySelector(".theme-toggle");
    var meta = document.querySelector('meta[name="theme-color"]');

    function sync() {
      var light = root.dataset.theme === "light";
      button.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
      if (meta) meta.setAttribute("content", light ? "#f7f8fb" : "#0a0f1c");
    }

    button.addEventListener("click", function () {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
      sync();
    });
    sync();
  }

  // Phone menu: a panel that drops down under the bar.
  function initMenu() {
    var header = document.querySelector(".site-nav");
    var button = document.querySelector(".menu-toggle");
    var links = Array.prototype.slice.call(document.querySelectorAll("#nav-links a"));

    function isOpen() { return header.classList.contains("menu-open"); }

    function setOpen(open) {
      header.classList.toggle("menu-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open && links[0]) links[0].focus();
    }

    button.addEventListener("click", function () { setOpen(!isOpen()); });
    links.forEach(function (link) {
      link.addEventListener("click", function () { if (isOpen()) setOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !isOpen()) return;
      setOpen(false);
      button.focus();
    });
    document.addEventListener("click", function (e) {
      if (isOpen() && !header.contains(e.target)) setOpen(false);
    });
    onMediaChange("(min-width: 768px)", function (e) {
      if (e.matches && isOpen()) setOpen(false);
    });
  }

  // Marks the nav link for whichever section the reader is in: the last one
  // whose heading has passed just under the bar, or the last section once the
  // page is scrolled to the bottom.
  function initActiveNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll("#nav-links a"));
    var sections = links.map(function (a) { return document.getElementById(a.hash.slice(1)); });
    var current = null;
    var queued = false;

    function update() {
      queued = false;
      var line = 110;
      var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      var index = -1;
      if (atBottom) {
        index = sections.length - 1;
      } else {
        sections.forEach(function (s, i) {
          if (s && s.getBoundingClientRect().top <= line) index = i;
        });
      }
      var next = index >= 0 ? links[index] : null;
      if (next === current) return;
      if (current) current.removeAttribute("aria-current");
      if (next) next.setAttribute("aria-current", "location");
      current = next;
    }

    function queue() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
  }

  // Sections ease in the first time they scroll into view. Nothing is hidden
  // until this has set itself up, so a failed script never blanks the page.
  function initReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var blocks = document.querySelectorAll(".reveal");
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        seen.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    blocks.forEach(function (el) { seen.observe(el); });
    root.classList.add("reveal-ready");
  }

  // Headline: writes out each phrase, holds it, then backspaces to the next.
  function initTyping() {
    var el = document.querySelector(".typed");
    if (!el || reduceMotion) return;
    var phrases = JSON.parse(el.getAttribute("data-phrases") || "[]").filter(Boolean);
    if (phrases.length < 2) return;

    var index = 0;
    var shown = phrases[0].length;
    var erasing = true;

    function step() {
      if (document.hidden) { setTimeout(step, 800); return; }
      var phrase = phrases[index];
      shown += erasing ? -1 : 1;
      el.textContent = phrase.slice(0, shown);

      if (erasing && shown <= 0) {
        erasing = false;
        index = (index + 1) % phrases.length;
        setTimeout(step, 450);
      } else if (!erasing && shown >= phrase.length) {
        erasing = true;
        setTimeout(step, 2400);
      } else {
        setTimeout(step, erasing ? 35 : 70);
      }
    }

    setTimeout(step, 3000);
  }

  run(initMenu);
  run(initTheme);
  run(initActiveNav);
  run(initReveal);
  run(initTyping);
})();
