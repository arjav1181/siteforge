#!/usr/bin/env node
// todo-sweep — list TODO/FIXME/HACK/XXX markers with file:line.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", ".git", ".next", "dist", "out", "coverage"]);
const RE = /\b(TODO|FIXME|HACK|XXX|NOTE)\b\s*:?\s*(.*)/;
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: todo-sweep [dir]\n\nLists code markers with locations. Defaults: dir=.");
  process.exit(0);
}
const dir = args.find((a) => !a.startsWith("-")) ?? ".";
let found = 0;
(function walk(d) {
  let entries;
  try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p); }
    else if (e.isFile()) {
      if (statSync(p).size > 1_000_000) continue;
      let text;
      try { text = readFileSync(p, "utf8"); } catch { continue; }
      if (text.includes("\0")) continue;
      text.split("\n").forEach((line, i) => {
        const m = RE.exec(line);
        if (m) { found++; console.log(`${p}:${i + 1} [${m[1]}] ${m[2].trim().slice(0, 100)}`); }
      });
    }
  }
})(dir);
if (found === 0) console.log("Clean — no markers found.");
