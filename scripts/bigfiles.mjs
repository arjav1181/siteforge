#!/usr/bin/env node
// bigfiles — top-N largest files under a directory.
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", ".git", ".next", "dist", "out"]);
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: bigfiles [dir] [--top N]\n\nLists the largest files. Defaults: dir=., top=15.");
  process.exit(0);
}
let dir = ".", top = 15;
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--top") top = Math.max(1, Number(args[++i]) || 15);
  else if (!args[i].startsWith("-")) pos.push(args[i]);
}
if (pos[0]) dir = pos[0];

const out = [];
(function walk(d) {
  let entries;
  try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p); }
    else if (e.isFile()) {
      try { out.push([statSync(p).size, p]); } catch { /* gone */ }
    }
  }
})(dir);
out.sort((a, b) => b[0] - a[0]);
const fmt = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
for (const [size, p] of out.slice(0, top)) console.log(`${fmt(size).padStart(10)}  ${p}`);
