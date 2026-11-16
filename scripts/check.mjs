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
