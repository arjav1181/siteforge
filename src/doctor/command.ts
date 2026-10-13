import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { commandExists } from "../util.js";
import { log } from "../log.js";
import { style } from "../ui/color.js";
import { table } from "../ui/render.js";
import { out } from "../ui/stream.js";
import { detectAgents } from "../agent/detect.js";

const execFileAsync = promisify(execFile);

export const DOCTOR_HELP = `siteforge doctor — check this machine for everything SiteForge needs.

Usage:
  siteforge doctor

Each line says what failed and which commands it blocks, so the report points
at the fix rather than just at the problem. Nothing here is fatal except a
missing Node.js; every other command checks its own prerequisites and says so.
`;

export interface DoctorCheck {
  name: string;
  /** The commands this check gates. */
  need: string;
  ok: boolean;
  detail: string;
}

async function binVersion(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 5000 });
    return stdout.trim().split("\n")[0]!.slice(0, 60);
  } catch {
    return null;
  }
}

/**
 * Whether `gh` is actually authenticated, not merely installed.
 *
 * These are different states and the difference cost a real debugging session:
 * `gh` can be on PATH and still fail every push with "Invalid username or
 * token". Reporting "installed" under a check labelled "authenticated" is
 * worse than not checking at all.
 */
async function ghAuthed(): Promise<{ ok: boolean; detail: string }> {
  const v = await binVersion("gh", ["--version"]);
  if (!v) return { ok: false, detail: "missing — https://cli.github.com" };
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "status"], { timeout: 8000 });
    const account = stdout.split("\n").find((l) => l.includes("Logged in"))?.trim() ?? "";
    return { ok: true, detail: account.replace(/\s+/g, " ") || v.split(" ").slice(0, 3).join(" ") };
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr;
    // `gh auth status` leads with the bare hostname ("github.com"), which says
    // nothing useful. Pick the first line that actually explains itself.
    const line = (typeof stderr === "string" ? stderr.split("\n") : [])
      .map((l) => l.replace(/^\s*[×✗✕xX]\s*/, "").trim())
      .find((l) => l.length > 12 && !/^github\.com$/i.test(l) && !/^Logged in/i.test(l));
    return {
      ok: false,
      detail: `installed but not signed in — ${line || "run gh auth login"}`,
    };
  }
}

export async function runDoctor(): Promise<{ checks: DoctorCheck[] }> {
  const checks: DoctorCheck[] = [];

  const nodeV = await binVersion("node", ["-v"]);
  const nodeMajor = nodeV ? Number(nodeV.replace("v", "").split(".")[0]) : 0;
  checks.push({
    name: "node 18+",
    need: "everything",
    ok: nodeMajor >= 18,
    detail: nodeV ?? "missing",
  });

  const ffmpegV = await binVersion("ffmpeg", ["-version"]);
  checks.push({
    name: "ffmpeg",
    need: "video, record, dewatermark",
    ok: ffmpegV !== null,
    detail: ffmpegV ? ffmpegV.split(" ").slice(0, 3).join(" ") : "missing — https://ffmpeg.org/download.html",
  });

  const ffprobeOk = await commandExists("ffprobe");
  checks.push({
    name: "ffprobe",
    need: "video, dewatermark",
    ok: ffprobeOk,
    detail: ffprobeOk ? "present (ships with ffmpeg)" : "missing",
  });

  let chromeDetail = "missing";
  let chromeOk = false;
  for (const c of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const v = await binVersion(c, ["--version"]);
    if (v) {
      chromeOk = true;
      chromeDetail = `${c} (${v.slice(0, 40)})`;
      break;
    }
  }
  if (process.env.SITEFORGE_CHROME) {
    chromeOk = true;
    chromeDetail = `SITEFORGE_CHROME=${process.env.SITEFORGE_CHROME}`;
  }
  checks.push({ name: "chrome", need: "record, audit, shot", ok: chromeOk, detail: chromeDetail });

  const pm = (await commandExists("bun")) ? "bun" : (await commandExists("npm")) ? "npm" : null;
  checks.push({
    name: "bun/npm",
    need: "video install/build, ship",
    ok: pm !== null,
    detail: pm ?? "missing",
  });

  let sharpOk = false;
  try {
    createRequire(import.meta.url).resolve("sharp");
    sharpOk = true;
  } catch {
    /* not installed */
  }
  checks.push({
    name: "sharp",
    need: "video, assets, dewatermark",
    ok: sharpOk,
    detail: sharpOk ? "installed with siteforge" : "missing — reinstall siteforge",
  });

  const gh = await ghAuthed();
  checks.push({ name: "gh (authenticated)", need: "ship", ok: gh.ok, detail: gh.detail });

  // The `agent` command needs something to hand work to. Reporting zero here is
  // the difference between "nothing to install" and "you have no agent".
  const agents = detectAgents();
  const primary = agents.filter((a) => a.primary).map((a) => a.id);
  checks.push({
    name: "coding agent",
    need: "agent",
    ok: agents.length > 0,
    detail: agents.length
      ? `${agents.length} found${primary.length ? ` (${primary.join(", ")})` : ""}`
      : "none found — npm i -g @anthropic-ai/claude-code · opencode-ai · @openai/codex",
  });

  const rows = checks.map((c) => [
    c.ok ? style.green("✓") : style.red("✗"),
    c.name.padEnd(19),
    c.detail,
    style.gray(`[${c.need}]`),
  ]);
  log.blank();
  out().write(`\n${table(["", "CHECK", "DETAIL", "NEEDED BY"], rows)}\n`);
  log.blank();

  const missing = checks.filter((c) => !c.ok);
  if (missing.length) {
    log.dim(`  ${missing.length} of ${checks.length} missing. Only node is required for the rest to run —`);
    log.dim("  every other command checks its own prerequisites and tells you what to install.");
  } else {
    log.ok("Everything SiteForge needs is here.");
  }
  log.blank();

  if (!checks[0]!.ok) throw new Error("Node.js 18+ is required for everything else.");
  return { checks };
}