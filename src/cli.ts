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
import { parseDemoArgs, runDemo, DEMO_HELP } from "./demo/command.js";
import { parseRunArgs, runScriptCmd, RUN_HELP } from "./scripts/command.js";
import { parseServeArgs, runServe, SERVE_HELP } from "./serve/command.js";
import { parseShotArgs, runShot, SHOT_HELP } from "./shot/command.js";
import { parseAgentsArgs, runAgents, AGENTS_HELP } from "./agents/command.js";
import { renderCompletion, parseCompletionArgs } from "./complete.js";
import { runMcp } from "./mcp/server.js";
import { runDoctor, DOCTOR_HELP } from "./doctor/command.js";
import { runUpdate, UPDATE_HELP } from "./update/command.js";
import { parseUpdateArgs } from "./update/command.js";
import { createAsk, runWizard, parseInitArgs, runInit, INIT_HELP } from "./wizard.js";
import { VERSION } from "./version.js";
import { log, setJsonMode } from "./log.js";

const HELP = `siteforge v${VERSION} — forge killer interactive sites.

Usage:
  siteforge [command] [options]     (no command opens the wizard)

Commands:
  init      Guided new site: video background + sections + FX
  demo      Forge a sample site instantly (no files needed)
  video     Turn a video into a scroll-driven Next.js site
  add       Drop a pre-built section into your site
  fx        Drop an interactive effect into your site
  3d        Drop a Three.js hero scene into your site
  record    Capture a dressed-up demo video of any page
  audit     Health-check a page: overflow, meta, alt, console, weight
  shot      Screenshot any page to PNG
  serve     Static file server for previews
  ship      Commit, create the GitHub repo, and push
  skills    List/install agent skills for this toolkit
  assets    Batch-compress images in a directory
  agents    Detect stack + write AGENTS.md conventions
  mcp       Serve tools to AI agents over MCP (stdio)
  completion  Print shell tab-completion script
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

Global flags: --json (machine result on stdout, logs on stderr),
--help on any command prints its manual.
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
    // --json: human logs go to stderr, machine result to stdout.
    const jsonMode = rest.includes("--json");
    const args = rest.filter((a) => a !== "--json");
    if (jsonMode) setJsonMode(true);
    const emit = (result: unknown) => {
      if (jsonMode && result !== undefined) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    };
    switch (cmd) {
      case "help":
        process.stdout.write(HELP);
        return;
      case "init":
        if (wantsHelp) { process.stdout.write(INIT_HELP); return; }
        {
          const { ask, close } = createAsk();
          try {
            await runInit(ask, parseInitArgs(args));
          } finally {
            close();
          }
        }
        return;
      case "demo":
        if (wantsHelp) { process.stdout.write(DEMO_HELP); return; }
        emit(await runDemo(parseDemoArgs(args)));
        return;
      case "video":
        if (wantsHelp) { process.stdout.write(VIDEO_HELP); return; }
        emit(await runVideo(parseVideoArgs(args)));
        return;
      case "add":
        if (wantsHelp) { process.stdout.write(ADD_HELP); return; }
        emit(await runAdd(parseAddArgs(args)));
        return;
      case "fx":
        if (wantsHelp) { process.stdout.write(FX_HELP); return; }
        emit(await runFx(parseFxArgs(args)));
        return;
      case "3d":
        if (wantsHelp) { process.stdout.write(THREE_HELP); return; }
        emit(await runThree(parseThreeArgs(args)));
        return;
      case "record":
        if (wantsHelp) { process.stdout.write(RECORD_HELP); return; }
        emit(await runRecord(parseRecordArgs(args)));
        return;
      case "shot":
        if (wantsHelp) { process.stdout.write(SHOT_HELP); return; }
        emit(await runShot(parseShotArgs(args)));
        return;
      case "serve":
        if (wantsHelp) { process.stdout.write(SERVE_HELP); return; }
        await runServe(parseServeArgs(args));
        return;
      case "run":
        if (wantsHelp) { process.stdout.write(RUN_HELP); return; }
        emit(await runScriptCmd(parseRunArgs(args)));
        return;
      case "audit":
        if (wantsHelp) { process.stdout.write(AUDIT_HELP); return; }
        {
          const r = await runAudit(parseAuditArgs(args));
          emit(r);
          if (!r.clean) process.exitCode = 1;
        }
        return;
      case "ship":
        if (wantsHelp) { process.stdout.write(SHIP_HELP); return; }
        emit(await runShip(parseShipArgs(args)));
        return;
      case "skills":
        if (wantsHelp) { process.stdout.write(SKILLS_HELP); return; }
        emit(await runSkills(parseSkillsArgs(args)));
        return;
      case "assets":
        if (wantsHelp) { process.stdout.write(ASSETS_HELP); return; }
        emit(await runAssets(parseAssetsArgs(args)));
        return;
      case "doctor":
        if (wantsHelp) { process.stdout.write(DOCTOR_HELP); return; }
        emit(await runDoctor());
        return;
      case "update":
        if (wantsHelp) { process.stdout.write(UPDATE_HELP); return; }
        emit(await runUpdate(parseUpdateArgs(args).check));
        return;
      case "agents":
        if (wantsHelp) { process.stdout.write(AGENTS_HELP); return; }
        emit(await runAgents({ ...parseAgentsArgs(args), cwd: process.cwd() }));
        return;
      case "completion":
        process.stdout.write(renderCompletion(parseCompletionArgs(args.filter((a) => a !== "--json"))));
        return;
      case "mcp":
        await runMcp();
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
