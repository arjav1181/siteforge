import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { log } from "../log.js";
import { packageRoot } from "../util.js";

export const RUN_HELP = `siteforge run — everyday scripts for all kinds of work.

Usage:
  siteforge run --list
  siteforge run <script> [args...]        (scripts take --help individually)

Scripts:
  bigfiles      Top-N largest files under a dir
  loc           Lines of code by extension
  todo-sweep    List TODO/FIXME/HACK markers with locations
  json-pretty   Stdin JSON in, pretty JSON out (pipe-friendly)
  md-toc        Insert/refresh a Table of Contents in markdown
  port-kill     Free TCP ports by killing listeners

Examples:
  siteforge run bigfiles public --top 10
  siteforge run todo-sweep src
  curl -s https://api.example.com/x | siteforge run json-pretty
`;

export function listScripts(): string[] {
  const dir = path.join(packageRoot(), "scripts");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => f.replace(/\.mjs$/, ""))
    .sort();
}

export function parseRunArgs(argv: string[]): { name: string | null; list: boolean; args: string[] } {
  let name: string | null = null;
  let list = false;
  const args: string[] = [];
  let rest = false;
  for (const a of argv) {
    if (!rest && a === "--list") { list = true; continue; }
    if (!rest && !name && !a.startsWith("-")) { name = a; continue; }
    rest = true;
    args.push(a);
  }
  return { name, list, args };
}

export async function runScriptCmd(o: { name: string | null; list: boolean; args: string[] }): Promise<{ script?: string; code?: number }> {
  const available = listScripts();
  if (o.list || !o.name) {
    log.step("Bundled scripts:");
    for (const n of available) log.dim(`  - ${n}`);
    log.blank();
    log.dim("  Run: siteforge run <script> [args...]  (each takes --help)");
    return {};
  }
  if (!available.includes(o.name)) {
    throw new Error(`Unknown script "${o.name}". Run: siteforge run --list`);
  }
  const file = path.join(packageRoot(), "scripts", `${o.name}.mjs`);
  const code = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, [file, ...o.args], { stdio: "inherit" });
    child.on("error", () => resolve(1));
    child.on("close", (c) => resolve(c ?? 1));
  });
  if (code !== 0) throw new Error(`Script "${o.name}" exited with code ${code}`);
  return { script: o.name, code };
}
