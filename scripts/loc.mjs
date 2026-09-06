#!/usr/bin/env node
// loc — lines of code by extension.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", ".git", ".next", "dist", "out", "coverage"]);
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: loc [dir]\n\nCounts non-blank lines per extension. Defaults: dir=.");
  process.exit(0);
}
const dir = args.find((a) => !a.startsWith("-")) ?? ".";
const byExt = new Map();
let files = 0;
(function walk(d) {
  let entries;
  try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p); }
    else if (e.isFile()) {
      if (statSync(p).size > 2_000_000) continue;
      let text;
      try { text = readFileSync(p, "utf8"); } catch { continue; }
      if (text.includes("\0")) continue;
      const ext = path.extname(e.name) || "(no ext)";
      const lines = text.split("\n").filter((l) => l.trim().length > 0).length;
      byExt.set(ext, (byExt.get(ext) ?? 0) + lines);
      files++;
    }
  }
})(dir);
const rows = [...byExt.entries()].sort((a, b) => b[1] - a[1]);
const total = rows.reduce((a, [, n]) => a + n, 0);
for (const [ext, n] of rows) console.log(`${String(n).padStart(8)}  ${ext}`);
console.log(`${String(total).padStart(8)}  TOTAL (${files} files)`);
