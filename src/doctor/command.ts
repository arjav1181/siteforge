import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { commandExists } from "../util.js";
import { log } from "../log.js";

const execFileAsync = promisify(execFile);

export const DOCTOR_HELP = `siteforge doctor — check your machine for everything SiteForge needs.

Usage:
  siteforge doctor
`;

interface Check {
  name: string;
  need: string;
  ok: boolean;
  detail: string;
}

async function binVersion(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args);
    return stdout.trim().split("\n")[0].slice(0, 60);
  } catch {
    return null;
  }
}

export async function runDoctor(): Promise<void> {
  const checks: Check[] = [];

  const nodeV = await binVersion("node", ["-v"]);
  const nodeMajor = nodeV ? Number(nodeV.replace("v", "").split(".")[0]) : 0;
  checks.push({
    name: "node 18+", need: "everything",
    ok: nodeMajor >= 18, detail: nodeV ?? "missing",
  });

  const ffmpegV = await binVersion("ffmpeg", ["-version"]);
  checks.push({
    name: "ffmpeg", need: "video, record",
    ok: ffmpegV !== null, detail: ffmpegV ? ffmpegV.split(" ").slice(0, 3).join(" ") : "missing — https://ffmpeg.org/download.html",
  });

  const ffprobeOk = await commandExists("ffprobe");
  checks.push({
    name: "ffprobe", need: "video",
    ok: ffprobeOk, detail: ffprobeOk ? "present (ships with ffmpeg)" : "missing",
  });

  let chromeDetail = "missing";
  let chromeOk = false;
  for (const c of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const v = await binVersion(c, ["--version"]);
    if (v) { chromeOk = true; chromeDetail = `${c} (${v.slice(0, 40)})`; break; }
  }
  if (process.env.SITEFORGE_CHROME) {
    chromeOk = true;
    chromeDetail = `SITEFORGE_CHROME=${process.env.SITEFORGE_CHROME}`;
  }
  checks.push({ name: "chrome", need: "record, audit", ok: chromeOk, detail: chromeDetail });

  const pm = (await commandExists("bun")) ? "bun" : (await commandExists("npm")) ? "npm" : null;
  checks.push({
    name: "bun/npm", need: "video install/build",
    ok: pm !== null, detail: pm ?? "missing",
  });

  let sharpOk = false;
  try {
    createRequire(import.meta.url).resolve("sharp");
    sharpOk = true;
  } catch { /* not installed */ }
  checks.push({
    name: "sharp", need: "video, assets",
    ok: sharpOk, detail: sharpOk ? "installed with siteforge" : "missing — reinstall siteforge",
  });

  const ghV = await binVersion("gh", ["--version"]);
  checks.push({
    name: "gh (authenticated)", need: "ship",
    ok: ghV !== null, detail: ghV ? ghV.split(" ").slice(0, 3).join(" ") + " (run gh auth login)" : "missing — https://cli.github.com",
  });

  log.blank();
  for (const c of checks) {
    const mark = c.ok ? "✓" : "✗";
    process.stdout.write(`  ${c.ok ? "\x1b[32m" : "\x1b[31m"}${mark}\x1b[0m ${c.name.padEnd(18)} ${c.detail}   \x1b[2m[${c.need}]\x1b[0m\n`);
  }
  log.blank();
  if (!checks[0].ok) throw new Error("Node.js 18+ is required for everything else.");
}
