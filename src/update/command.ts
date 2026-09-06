import { spawn } from "node:child_process";
import { commandExists } from "../util.js";
import { log } from "../log.js";
import { VERSION } from "../version.js";

export const UPDATE_HELP = `siteforge update — self-update to the latest published version.

Usage:
  siteforge update [--check]

  --check only reports whether an update exists (no changes).
`;

function runCmd(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export function parseUpdateArgs(argv: string[]): { check: boolean } {
  for (const a of argv) {
    if (a === "--check") return { check: true };
    throw new Error(`Unknown option for update: ${a} (usage: siteforge update [--check])`);
  }
  return { check: false };
}

/** -1 if a<b, 0 if equal, 1 if a>b. Pure — unit tested. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export async function fetchLatestVersion(): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch("https://registry.npmjs.org/@aj1181%2fsite-forge/latest", { signal: ctrl.signal });
    if (!res.ok) throw new Error(`registry responded ${res.status}`);
    const data = (await res.json()) as { version?: string };
    if (!data.version) throw new Error("no version in registry response");
    return data.version;
  } finally {
    clearTimeout(t);
  }
}

export async function runUpdate(checkOnly = false): Promise<{ current: string; latest: string | null; updated: boolean }> {
  log.step(`Current: siteforge v${VERSION}`);
  let latest: string | null = null;
  try {
    latest = await fetchLatestVersion();
  } catch {
    log.warn("Could not reach the registry — skipping version check.");
  }
  if (latest && compareVersions(VERSION, latest) < 0) {
    log.warn(`Update available: v${VERSION} → v${latest}`);
    if (checkOnly) return { current: VERSION, latest, updated: false };
  } else if (latest) {
    log.ok("Already on the latest version.");
    return { current: VERSION, latest, updated: false };
  }
  if (checkOnly) return { current: VERSION, latest, updated: false };
  const pkg = "@aj1181/site-forge@latest";
  if (await commandExists("npm")) {
    log.step(`Running: npm install -g ${pkg}`);
    const code = await runCmd("npm", ["install", "-g", pkg]);
    if (code !== 0) throw new Error("npm update failed");
  } else if (await commandExists("bun")) {
    log.step(`Running: bun add -g ${pkg}`);
    const code = await runCmd("bun", ["add", "-g", pkg]);
    if (code !== 0) throw new Error("bun update failed");
  } else {
    throw new Error("Neither npm nor bun found.");
  }
  log.ok("Updated. Run `siteforge --version` to confirm.");
  return { current: VERSION, latest, updated: true };
}
