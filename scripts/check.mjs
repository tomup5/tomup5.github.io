// Static checks for the site. Run: node scripts/check.mjs
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => (existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : null);
const html = read("index.html");
const css = read("style.css") ?? "";

// Case-sensitive existence check (GitHub Pages is case-sensitive, Windows is not).
const existsExact = (rel) => {
  const parts = rel.split("/");
  let dir = root;
  for (const part of parts) {
    if (!existsSync(dir) || !readdirSync(dir).includes(part)) return false;
    dir = join(dir, part);
  }
  return true;
};

const tokensIn = (selector) => {
  const start = css.indexOf(selector + " {");
  if (start === -1) return null;
  const block = css.slice(start, css.indexOf("}", start));
  const out = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
};

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SECTIONS = ["about", "projects", "education", "experience", "skills", "contact"];
const SKILLS = [
  "Java", "JavaScript", "Python", "HTML/CSS", "C", "C++", "SQL",
  "Git", "GitHub Actions", "VS Code", "Linux", "ESLint",
  "Chrome Extensions API", "jsdom", "Node.js", "React", "MongoDB",
  "English", "Spanish",
];

const checks = [
  ["indexExists", () => html !== null || "index.html not found"],
  ["viewport", () =>
    html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">') ||
    "viewport meta missing"],
  ["title", () => html.includes("<title>Thomas Dupree</title>") || "title missing"],
  ["noExternalAssets", () => {
    const sheets = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/gi)].map((m) => m[0]);
    const badSheet = sheets.find((t) => /href="https?:/.test(t) && !/href="https:\/\/fonts\.googleapis\.com\//.test(t));
    if (badSheet) return `external stylesheet not allowed: ${badSheet}`;
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
    for (const [, attrs, body] of scripts) {
      const src = attrs.match(/src="([^"]+)"/)?.[1];
      if (src && src !== "script.js") return `script not allowed: ${src}`;
      if (!src && !body.includes("localStorage")) return "unexpected inline script";
    }
    return true;
  }],
  ["themeScriptInHead", () => {
    const head = html.split("</head>")[0];
    const inline = head.search(/<script>[\s\S]*?data-theme|<script>[\s\S]*?dataset\.theme/);
    const sheet = head.indexOf('href="style.css"');
    return (inline !== -1 && sheet !== -1 && inline < sheet) || "inline theme script must precede style.css in <head>";
  }],
  ["localFilesExist", () => {
    const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1])
      .filter((r) => !/^(https?:|mailto:|#)/.test(r)).map((r) => r.split("#")[0]);
    const missing = refs.filter((r) => !existsExact(r));
    return missing.length === 0 || `missing files (case-sensitive): ${missing.join(", ")}`;
  }],
  ["imagesHaveDimensions", () => {
    const bad = [...html.matchAll(/<img[^>]*>/gi)].map((m) => m[0])
      .filter((t) => !/\swidth="\d+"/.test(t) || !/\sheight="\d+"/.test(t) || !/\salt="/.test(t));
    return bad.length === 0 || `img missing width/height/alt: ${bad[0]}`;
  }],
  ["ogImageAbsolute", () => {
    const m = html.match(/<meta property="og:image" content="https:\/\/tomup5\.github\.io\/([^"]+)"/);
    if (!m) return "og:image missing or not absolute";
    return existsExact(m[1]) || `og:image file missing locally: ${m[1]}`;
  }],
  ["noPhone", () => !/\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(html) || "phone number found"],
  ["sectionOrder", () => {
    const pos = SECTIONS.map((id) => html.indexOf(`<section id="${id}"`));
    if (pos.includes(-1)) return `missing sections: ${SECTIONS.filter((_, i) => pos[i] === -1).join(", ")}`;
    if (pos.some((p, i) => i > 0 && p < pos[i - 1])) return `sections out of order, want ${SECTIONS.join(" > ")}`;
    const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
    const unlinked = SECTIONS.filter((id) => !nav.includes(`href="#${id}"`));
    return unlinked.length === 0 || `nav missing links: ${unlinked.join(", ")}`;
  }],
  ["contactLinks", () => {
    const m = html.match(/<section id="contact"[\s\S]*?<\/section>/)?.[0] ?? "";
    return (m.includes('href="mailto:thomasdupree2024@gmail.com"') &&
      m.includes('href="https://www.linkedin.com/in/thomas-dupree-6a1526380/"')) ||
      "contact section missing email or LinkedIn link";
  }],
  ["photoExists", () => {
    const img = html.match(/<img[^>]*class="[^"]*\bhero-photo\b[^"]*"[^>]*>/)?.[0];
    if (!img) return "hero photo <img class=\"hero-photo\"> missing";
    const src = img.match(/src="([^"]+)"/)?.[1];
    return existsExact(src) || `hero photo file missing: ${src}`;
  }],
  ["skillLevels", () => {
    const rows = [...html.matchAll(/<li class="skill-row" data-level="(\d)"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/g)]
      .map((m) => [m[2].trim().replace("&amp;", "&"), Number(m[1])]);
    const bad = rows.filter(([, l]) => l < 1 || l > 4);
    if (bad.length) return `levels out of range: ${bad.map(([n]) => n).join(", ")}`;
    const names = rows.map(([n]) => n);
    const missing = SKILLS.filter((s) => !names.includes(s));
    return missing.length === 0 || `skills missing: ${missing.join(", ")}`;
  }],
  ["contrast", () => {
    const themes = { dark: tokensIn(":root"), light: tokensIn(':root[data-theme="light"]') };
    const problems = [];
    for (const [name, t] of Object.entries(themes)) {
      if (!t) { problems.push(`${name} tokens missing`); continue; }
      for (const k of ["text", "muted", "accent"]) {
        if (!t[k] || !t.bg) { problems.push(`${name} --${k}/--bg missing`); continue; }
        const r = ratio(t[k], t.bg);
        if (r < 4.5) problems.push(`${name} ${k} ${r.toFixed(2)}:1`);
      }
    }
    return problems.length === 0 || problems.join(", ");
  }],
  ["revealScopedToJs", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]*\.reveal[^{}]*)\{([^}]*)\}/g)]
      .filter(([, , body]) => /opacity:\s*0[;\s]/.test(body));
    // Only script.js's initReveal adds .reveal-ready, so a missing or crashing script can't hide sections.
    const bad = rules.filter(([, sel]) => !sel.trim().split(",").every((s) => s.trim().startsWith(".reveal-ready")));
    if (bad.length) return `.reveal hidden without .reveal-ready scope: ${bad[0][1].trim()}`;
    const js = read("script.js") ?? "";
    return js.includes('classList.add("reveal-ready")') || "script.js never adds .reveal-ready";
  }],
  ["printShowsAll", () =>
    /@media print\s*\{[\s\S]*?\.reveal[\s\S]*?opacity:\s*1/.test(css) || "no print rule un-hiding .reveal"],
  ["scriptFailSafe", () => {
    const js = read("script.js") ?? "";
    if (/matchMedia\("[^"]*"\)\s*\.addEventListener/.test(js)) return "matchMedia(...).addEventListener throws on Safari < 14";
    const inits = [...js.matchAll(/^\s*(init[A-Z]\w*)\(\);/gm)];
    return inits.length === 0 || `init calls not wrapped in run(): ${inits.map((m) => m[1]).join(", ")}`;
  }],
  ["meterSquaresVisible", () => {
    const problems = [];
    for (const [name, sel] of [["dark", ":root"], ["light", ':root[data-theme="light"]']]) {
      const t = tokensIn(sel);
      if (!t?.node) { problems.push(`${name} --node missing`); continue; }
      const r = ratio(t.node, t.bg);
      if (r < 3) problems.push(`${name} --node ${r.toFixed(2)}:1 (need 3:1)`);
    }
    if (!/\.meter i\s*\{[^}]*var\(--node\)/.test(css)) problems.push("empty meter squares don't use --node");
    return problems.length === 0 || problems.join(", ");
  }],
  ["reducedMotion", () => css.includes("prefers-reduced-motion") || "no prefers-reduced-motion rule"],
  ["internalDocsNotPublished", () => {
    const cfg = read("_config.yml");
    if (cfg === null) return "_config.yml missing";
    const missing = ["docs", "scripts"].filter((d) => !new RegExp(`^\\s*-\\s*${d}\\s*$`, "m").test(cfg));
    return missing.length === 0 || `_config.yml does not exclude: ${missing.join(", ")}`;
  }],
  ["resumeIsPdf", () => {
    const p = join(root, "resume.pdf");
    if (!existsSync(p)) return "resume.pdf missing";
    const buf = readFileSync(p);
    return (buf.length > 10_000 && buf.subarray(0, 5).toString() === "%PDF-") ||
      `resume.pdf is not a real PDF (${buf.length} bytes)`;
  }],
];

const failures = [];
for (const [name, fn] of checks) {
  let result;
  try { result = fn(); } catch (e) { result = e.message; }
  if (result !== true) failures.push(`${name}: ${result}`);
  if (name === "indexExists" && result !== true) break;
}

if (failures.length) {
  console.log(`FAIL (${failures.length})\n` + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log(`PASS (${checks.length} checks)`);
