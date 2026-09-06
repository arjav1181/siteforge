#!/usr/bin/env node
import { parseVideoArgs, runVideo, VIDEO_HELP } from "./video/command.js";
import { parseAddArgs, runAdd, ADD_HELP } from "./add/command.js";
import { parseFxArgs, runFx, FX_HELP } from "./fx/command.js";
import { parseRecordArgs, runRecord, RECORD_HELP } from "./record/command.js";
import { parseAuditArgs, runAudit, AUDIT_HELP } from "./audit/command.js";
import { parseShipArgs, runShip, SHIP_HELP } from "./ship/command.js";
import { log } from "./log.js";

export const VERSION = "1.0.0";

const HELP = `siteforge v${VERSION} — forge killer interactive sites.

Usage:
  siteforge <command> [options]

Commands:
  video     Turn a video into a scroll-driven Next.js site
  add       Drop a pre-built section into your site (hero, navbar, work…)
  fx        Drop an interactive effect into your site (cursor, badge…)
  record    Capture a dressed-up demo video of any page
  audit     Health-check a page: overflow, meta, alt, console, weight
  ship      Commit, create the GitHub repo, and push

  help      Show this help (or: siteforge <command> --help is per-command)

Examples:
  siteforge video intro.mp4 my-site --fps 30
  siteforge add hero --dir src/components
  siteforge fx cursor
  siteforge record https://my-site.vercel.app --out demo.mp4
  siteforge audit http://localhost:3000
  siteforge ship --repo my-site

Run with -V/--version for the version. Docs: https://github.com/arjav1181/siteforge
`;

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
      process.stdout.write(HELP);
      return;
    }
    if (cmd === "-V" || cmd === "--version") {
      process.stdout.write(`siteforge v${VERSION}\n`);
      return;
    }
    switch (cmd) {
      case "video":
        if (rest.includes("--help") || rest.includes("-h")) { process.stdout.write(VIDEO_HELP); return; }
        await runVideo(parseVideoArgs(rest));
        return;
      case "add":
        if (rest.includes("--help") || rest.includes("-h")) { process.stdout.write(ADD_HELP); return; }
        await runAdd(parseAddArgs(rest));
        return;
      case "fx":
        if (rest.includes("--help") || rest.includes("-h")) { process.stdout.write(FX_HELP); return; }
        await runFx(parseFxArgs(rest));
        return;
      case "record":
        if (rest.includes("--help") || rest.includes("-h")) { process.stdout.write(RECORD_HELP); return; }
        await runRecord(parseRecordArgs(rest));
        return;
      case "audit":
        if (rest.includes("--help") || rest.includes("-h")) { process.stdout.write(AUDIT_HELP); return; }
        {
          const clean = await runAudit(parseAuditArgs(rest));
          if (!clean) process.exitCode = 1;
        }
        return;
      case "ship":
        if (rest.includes("--help") || rest.includes("-h")) { process.stdout.write(SHIP_HELP); return; }
        await runShip(parseShipArgs(rest));
        return;
      default:
        throw new Error(`Unknown command: ${cmd}\n\n${HELP}`);
    }
  } catch (e) {
    log.err(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

const isEntry =
  process.argv[1] !== undefined &&
  (import.meta.url.endsWith("cli.js") || import.meta.url.endsWith("cli.ts"));
if (isEntry) {
  void main();
}
