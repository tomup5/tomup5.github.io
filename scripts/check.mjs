// Static checks for the site. Run: node scripts/check.mjs
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => (existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : null);
const html = read("index.html");

const checks = [
  ["indexExists", () => html !== null || "index.html not found"],
  ["viewport", () =>
    html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">') ||
    "viewport meta missing"],
  ["title", () => html.includes("<title>Thomas Dupree</title>") || "title missing"],
  ["noExternalAssets", () => {
    if (/<script/i.test(html)) return "page contains a <script>";
    const ext = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/gi)].filter((m) => /href="https?:/i.test(m[0]));
    return ext.length === 0 || `external stylesheet: ${ext[0][0]}`;
  }],
  ["localFilesExist", () => {
    const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1])
      .filter((r) => !/^(https?:|mailto:|#)/.test(r));
    const missing = refs.filter((r) => !existsSync(join(root, r.split("#")[0])));
    return missing.length === 0 || `missing files: ${missing.join(", ")}`;
  }],
  ["imagesHaveDimensions", () => {
    const bad = [...html.matchAll(/<img[^>]*>/gi)].map((m) => m[0])
      .filter((t) => !/\swidth="\d+"/.test(t) || !/\sheight="\d+"/.test(t) || !/\salt="/.test(t));
    return bad.length === 0 || `img missing width/height/alt: ${bad[0]}`;
  }],
  ["ogImageAbsolute", () =>
    /<meta property="og:image" content="https:\/\/tomup5\.github\.io\/[^"]+"/.test(html) ||
    "og:image missing or not absolute"],
  ["noPhone", () => !/\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(html) || "phone number found"],
  ["sections", () => {
    const missing = ["projects", "about", "skills", "contact"].filter((id) => !html.includes(`id="${id}"`));
    return missing.length === 0 || `missing sections: ${missing.join(", ")}`;
  }],
  ["internalDocsNotPublished", () => {
    const cfg = read("_config.yml");
    if (cfg === null) return "_config.yml missing; GitHub Pages would publish docs/ as web pages";
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
  ["sectionsFilled", () => {
    const empty = ["about", "skills", "contact"].filter((id) => {
      const m = html.match(new RegExp(`<section id="${id}">([\\s\\S]*?)</section>`));
      return !m || !/<h2>/.test(m[1]) || m[1].replace(/<[^>]+>/g, "").trim().length < 20;
    });
    return empty.length === 0 || `empty sections: ${empty.join(", ")}`;
  }],
  ["contactLinks", () =>
    (html.includes('href="mailto:thomasdupree2024@gmail.com"') &&
      html.includes('href="https://www.linkedin.com/in/thomas-dupree-6a1526380/"')) ||
    "contact email or LinkedIn link missing"],
  ["contrast", () => {
    const css = read("style.css");
    const token = (n) => css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
    const lum = (hex) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const bg = token("bg");
    const low = ["text", "muted", "accent"]
      .map((n) => [n, ratio(token(n), bg)])
      .filter(([, r]) => r < 4.5);
    return low.length === 0 || low.map(([n, r]) => `${n} ${r.toFixed(2)}:1`).join(", ");
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
