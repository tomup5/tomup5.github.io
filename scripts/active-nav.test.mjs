// Runs script.js against a tiny fake DOM to test which nav link is marked
// as the current section. Run: node scripts/active-nav.test.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "script.js"), "utf8");
const IDS = ["about", "projects", "education", "experience", "skills", "contact"];

function el(extra = {}) {
  const attrs = {};
  const classes = new Set();
  return {
    attrs,
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => attrs[k] ?? null,
    removeAttribute: (k) => { delete attrs[k]; },
    addEventListener() {},
    contains: () => false,
    focus() {},
    classList: {
      add: (c) => classes.add(c),
      contains: (c) => classes.has(c),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
    },
    dataset: {},
    ...extra,
  };
}

function setup() {
  const tops = Object.fromEntries(IDS.map((id, i) => [id, 900 + i * 800]));
  const sections = Object.fromEntries(IDS.map((id) => [id, el({ id, getBoundingClientRect: () => ({ top: tops[id] }) })]));
  const links = IDS.map((id) => el({ hash: "#" + id, textContent: id }));
  const listeners = {};
  const frames = [];
  const doc = {
    documentElement: el({ scrollHeight: 6000 }),
    hidden: false,
    querySelector: () => el(),
    querySelectorAll: (sel) => (sel === "#nav-links a" ? links : []),
    getElementById: (id) => sections[id] ?? null,
    addEventListener() {},
  };
  const win = {
    innerHeight: 900,
    scrollY: 0,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    requestAnimationFrame: (fn) => frames.push(fn),
    matchMedia: () => ({ matches: true, addListener() {} }),
  };
  win.window = win;
  win.document = doc;
  vm.runInNewContext(source, { window: win, document: doc, localStorage: { getItem() {}, setItem() {} }, setTimeout() {}, console });

  const scrollTo = (y, newTops) => {
    win.scrollY = y;
    Object.assign(tops, newTops);
    listeners.scroll();
    while (frames.length) frames.shift()();
  };
  const active = () => links.filter((l) => l.attrs["aria-current"]).map((l) => l.textContent);
  return { scrollTo, active };
}

const tests = {
  "nothing is marked while the hero is on screen"() {
    const { active } = setup();
    assert.deepEqual(active(), []);
  },
  "marks the section whose heading has passed under the bar"() {
    const { scrollTo, active } = setup();
    scrollTo(2600, { about: -1700, projects: -900, education: 60, experience: 860, skills: 1660, contact: 2460 });
    assert.deepEqual(active(), ["education"]);
  },
  "marks Contact once the page is scrolled to the bottom"() {
    const { scrollTo, active } = setup();
    scrollTo(5100, { about: -4200, projects: -3400, education: -2600, experience: -1800, skills: -1000, contact: 420 });
    assert.deepEqual(active(), ["contact"]);
  },
  "moves back up when the reader scrolls up"() {
    const { scrollTo, active } = setup();
    scrollTo(4100, { about: -3200, projects: -2400, education: -1600, experience: -800, skills: 0, contact: 800 });
    assert.deepEqual(active(), ["skills"]);
    scrollTo(3900, { about: -3000, projects: -2200, education: -1400, experience: -600, skills: 200, contact: 1000 });
    assert.deepEqual(active(), ["experience"]);
  },
  "clears the mark when scrolling back to the hero"() {
    const { scrollTo, active } = setup();
    scrollTo(2600, { about: -1700, projects: -900, education: 60, experience: 860, skills: 1660, contact: 2460 });
    scrollTo(0, { about: 900, projects: 1700, education: 2500, experience: 3300, skills: 4100, contact: 4900 });
    assert.deepEqual(active(), []);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log("ok   " + name); }
  catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message.split("\n")[0]); }
}
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log(`PASS (${Object.keys(tests).length} tests)`);
