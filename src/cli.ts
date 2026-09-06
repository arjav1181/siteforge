#!/usr/bin/env node
import { parseVideoArgs, runVideo, VIDEO_HELP } from "./video/command.js";
import { parseAddArgs, runAdd, ADD_HELP } from "./add/command.js";
import { parseFxArgs, runFx, FX_HELP } from "./fx/command.js";
import { parseThreeArgs, runThree, THREE_HELP } from "./three/command.js";
import { parseRecordArgs, runRecord, RECORD_HELP } from "./record/command.js";
import { parseAuditArgs, runAudit, AUDIT_HELP } from "./audit/command.js";
import { parseShipArgs, runShip, SHIP_HELP } from "./ship/command.js";
import { parseSkillsArgs, runSkills, SKILLS_HELP } from "./skills/command.js";
import { parseAssetsArgs, runAssets, ASSETS_HELP } from "./assets/command.js";
import { runDoctor, DOCTOR_HELP } from "./doctor/command.js";
import { runUpdate, UPDATE_HELP } from "./update/command.js";
import { createAsk, runWizard, parseInitArgs, runInit, INIT_HELP } from "./wizard.js";
import { VERSION } from "./version.js";
import { log } from "./log.js";

const HELP = `siteforge v${VERSION} — forge killer interactive sites.

Usage:
  siteforge [command] [options]     (no command opens the wizard)

Commands:
  init      Guided new site: video background + sections + FX
  video     Turn a video into a scroll-driven Next.js site
  add       Drop a pre-built section into your site
  fx        Drop an interactive effect into your site
  3d        Drop a Three.js hero scene into your site
  record    Capture a dressed-up demo video of any page
  audit     Health-check a page: overflow, meta, alt, console, weight
  ship      Commit, create the GitHub repo, and push
  skills    List/install agent skills for this toolkit
  assets    Batch-compress images in a directory
  doctor    Check this machine for everything SiteForge needs
  update    Self-update to the latest published version

Examples:
  siteforge                                  # interactive wizard
  siteforge init --video intro.mp4 --dir site
  siteforge video reel.mp4 my-site --fps 30
  siteforge add hero --dir src/components
  siteforge 3d particle
  siteforge fx cursor
  siteforge record https://my-site.vercel.app --out demo.mp4
  siteforge audit http://localhost:3000
  siteforge ship --repo my-site

Docs: https://github.com/arjav1181/siteforge
`;

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (!cmd) {
      const { ask, close } = createAsk();
      try {
        await runWizard(ask);
      } finally {
        close();
      }
      return;
    }
    if (cmd === "-V" || cmd === "--version") {
      process.stdout.write(`siteforge v${VERSION}\n`);
      return;
    }
    const wantsHelp = rest.includes("--help") || rest.includes("-h");
    switch (cmd) {
      case "help":
        process.stdout.write(HELP);
        return;
      case "init":
        if (wantsHelp) { process.stdout.write(INIT_HELP); return; }
        {
          const { ask, close } = createAsk();
          try {
            await runInit(ask, parseInitArgs(rest));
          } finally {
            close();
          }
        }
        return;
      case "video":
        if (wantsHelp) { process.stdout.write(VIDEO_HELP); return; }
        await runVideo(parseVideoArgs(rest));
        return;
      case "add":
        if (wantsHelp) { process.stdout.write(ADD_HELP); return; }
        await runAdd(parseAddArgs(rest));
        return;
      case "fx":
        if (wantsHelp) { process.stdout.write(FX_HELP); return; }
        await runFx(parseFxArgs(rest));
        return;
      case "3d":
        if (wantsHelp) { process.stdout.write(THREE_HELP); return; }
        await runThree(parseThreeArgs(rest));
        return;
      case "record":
        if (wantsHelp) { process.stdout.write(RECORD_HELP); return; }
        await runRecord(parseRecordArgs(rest));
        return;
      case "audit":
        if (wantsHelp) { process.stdout.write(AUDIT_HELP); return; }
        {
          const clean = await runAudit(parseAuditArgs(rest));
          if (!clean) process.exitCode = 1;
        }
        return;
      case "ship":
        if (wantsHelp) { process.stdout.write(SHIP_HELP); return; }
        await runShip(parseShipArgs(rest));
        return;
      case "skills":
        if (wantsHelp) { process.stdout.write(SKILLS_HELP); return; }
        await runSkills(parseSkillsArgs(rest));
        return;
      case "assets":
        if (wantsHelp) { process.stdout.write(ASSETS_HELP); return; }
        await runAssets(parseAssetsArgs(rest));
        return;
      case "doctor":
        if (wantsHelp) { process.stdout.write(DOCTOR_HELP); return; }
        await runDoctor();
        return;
      case "update":
        if (wantsHelp) { process.stdout.write(UPDATE_HELP); return; }
        await runUpdate();
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
