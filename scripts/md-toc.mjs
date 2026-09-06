#!/usr/bin/env node
// md-toc — insert/update a Table of Contents in a markdown file.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  console.log("Usage: md-toc <file.md>\n\nInserts (or refreshes) a TOC between <!-- toc --> markers after the first heading.");
  process.exit(args.length === 0 ? 1 : 0);
}
const file = args.find((a) => !a.startsWith("-"));
const src = readFileSync(file, "utf8");
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9а-яё -]/gi, "").trim().replace(/\s+/g, "-");
const entries = [];
for (const line of src.split("\n")) {
  const m = /^(#{2,4})\s+(.+)$/.exec(line);
  if (m) entries.push(`${"  ".repeat(m[1].length - 2)}- [${m[2]}](#${slug(m[2])})`);
}
if (entries.length === 0) { console.error("md-toc: no ## headings found."); process.exit(1); }
const toc = `<!-- toc -->\n${entries.join("\n")}\n<!-- /toc -->`;
let out;
if (/<!-- toc -->[\s\S]*<!-- \/toc -->/.test(src)) {
  out = src.replace(/<!-- toc -->[\s\S]*<!-- \/toc -->/, toc);
} else {
  const lines = src.split("\n");
  const h1 = lines.findIndex((l) => l.startsWith("# "));
  const at = h1 === -1 ? 0 : h1 + 1;
  lines.splice(at, 0, "", toc);
  out = lines.join("\n");
}
writeFileSync(file, out);
console.log(`md-toc: ${entries.length} entries → ${file}`);
