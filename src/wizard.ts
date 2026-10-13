import readline from "node:readline";
import path from "node:path";
import { runVideo } from "./video/command.js";
import { SECTIONS } from "./add/sections.js";
import { runAdd } from "./add/command.js";
import { FX } from "./fx/effects.js";
import { runFx } from "./fx/command.js";
import { PRESETS } from "./three/presets.js";
import { runThree } from "./three/command.js";
import { runRecord } from "./record/command.js";
import { runAudit } from "./audit/command.js";
import { runShip } from "./ship/command.js";
import { runSkills, AGENTS } from "./skills/command.js";
import { runDoctor } from "./doctor/command.js";
import { log } from "./log.js";
import { select, multiselect } from "./ui/prompt.js";
import { banner } from "./ui/render.js";
import { VERSION } from "./version.js";

export type Ask = (question: string, def?: string) => Promise<string>;

export function createAsk(): { ask: Ask; close: () => void } {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask: Ask = (question, def = "") =>
    new Promise((resolve, reject) => {
      if (!process.stdin.isTTY) {
        reject(new Error(`Missing required input in non-interactive mode: ${question}`));
        return;
      }
      const suffix = def ? ` [${def}]` : "";
      rl.question(`${question}${suffix}: `, (ans) => resolve(ans.trim() || def));
    });
  return { ask, close: () => rl.close() };
}

/**
 * Pick any number of entries, returning their names.
 *
 * Thin wrapper so the call sites read as intent ("pick sections") rather than
 * as index arithmetic.
 */
async function pickList(title: string, names: string[]): Promise<string[]> {
  const picked = await multiselect(title, names.map((n) => ({ label: n, value: n })));
  return picked.map((i) => names[i]);
}

/**
 * The front door.
 *
 * Menu items carry their own explanation as a hint, so the menu explains
 * itself instead of making the user remember what `3d` does. Navigation is
 * arrow keys on a terminal and numbered lines everywhere else.
 */
const MENU: { label: string; hint: string }[] = [
  { label: "New site", hint: "video background + sections + FX, guided" },
  { label: "Hand it to an agent", hint: "Claude Code, OpenCode or Codex — with the toolkit briefed" },
  { label: "Add section", hint: "hero, navbar, work, pricing, faq…" },
  { label: "Add effect", hint: "cursor, badge, marquee, 3D scene…" },
  { label: "Record demo", hint: "page → MP4 + poster" },
  { label: "Audit site", hint: "overflow, meta, alt, console, weight" },
  { label: "Ship it", hint: "commit + GitHub + push" },
  { label: "Install skills", hint: "agent skills for this toolkit" },
  { label: "Quick demo", hint: "sample site, no files needed" },
  { label: "Serve folder", hint: "static preview server" },
  { label: "Screenshot", hint: "page → PNG" },
  { label: "Run script", hint: "everyday helpers (bigfiles, loc…)" },
  { label: "Doctor", hint: "check this machine" },
  { label: "Exit", hint: "" },
];

const EXIT = MENU.length - 1;

export async function runWizard(ask: Ask): Promise<void> {
  banner(`siteforge v${VERSION}`, "forge killer interactive sites");
  for (;;) {
    const choice = await select(
      "What are we forging today?",
      MENU.map((m) => ({ label: m.label, value: m.label, hint: m.hint || undefined })),
    );
    log.blank();
    if (choice === -1 || choice === EXIT) {
      log.dim("Later!");
      log.blank();
      return;
    }

    switch (choice) {
      case 0:
        await runInit(ask);
        break;
      case 1: {
        const task = await ask("  What should it build?", "");
        if (!task) {
          log.warn("Nothing to hand over.");
          break;
        }
        const { runAgent, parseAgentCmdArgs } = await import("./agent/command.js");
        await runAgent(parseAgentCmdArgs([task]));
        break;
      }
      case 2: {
        const names = Object.keys(SECTIONS);
        for (const i of await multiselect("Sections:", names.map((n) => ({ label: n, value: n })))) {
          await runAdd({ section: names[i], dir: "src/components", list: false });
        }
        break;
      }
      case 3: {
        const fxNames = Object.keys(FX);
        const tdNames = Object.keys(PRESETS);
        const opts = [...fxNames.map((n) => ({ label: n, value: `fx:${n}` })), ...tdNames.map((n) => ({ label: `3d:${n}`, value: `3d:${n}` }))];
        for (const i of await multiselect("Effects & 3D:", opts)) {
          const n = opts[i].value;
          if (n.startsWith("fx:")) await runFx({ effect: n.slice(3), dir: "src/components", list: false, opts: {} });
          else await runThree({ preset: n.slice(3), dir: "src/components", list: false });
        }
        break;
      }
      case 4: {
        const url = await ask("  URL", "http://localhost:3000");
        const out = await ask("  Output MP4", "demo.mp4");
        await runRecord({
          url, out, width: 1280, height: 800, establish: 1800,
          step: 90, delay: 130, hold: 1500, crf: 21, browser: null, keepRaw: false,
        });
        break;
      }
      case 5: {
        const url = await ask("  URL", "http://localhost:3000");
        const { clean } = await runAudit({ url, widths: [375, 768, 1440], budgetKb: 500, browser: null, fix: false });
        if (!clean) log.warn("Fix the errors above, then re-run audit.");
        break;
      }
      case 6:
        await runShip({ repo: null, isPrivate: false, message: await ask("  Commit message", "ship it"), push: true });
        break;
      case 7: {
        const picked = await multiselect("Agents:", AGENTS.map((a) => ({ label: a, value: a })));
        const oss = (await ask("  Include OSS collections? (y/N)", "n")).toLowerCase().startsWith("y");
        const agents = picked.length ? picked.map((i) => AGENTS[i]) : AGENTS;
        await runSkills({ action: "install", agents, oss, global: (await ask("  Global? (y/N)", "n")).toLowerCase().startsWith("y") });
        break;
      }
      case 8: {
        const { runDemo } = await import("./demo/command.js");
        await runDemo({ dir: "./siteforge-demo", fps: 24 });
        break;
      }
      case 9: {
        const { runServe } = await import("./serve/command.js");
        const dir = await ask("  Directory", "public");
        const port = Number(await ask("  Port", "8000"));
        await runServe({ dir, port, spa: false });
        break;
      }
      case 10: {
        const { runShot } = await import("./shot/command.js");
        const url = await ask("  URL", "http://localhost:3000");
        const out = await ask("  Output PNG", "shot.png");
        await runShot({ url, out, width: 1280, height: 800, full: false, wait: 1200, browser: null });
        break;
      }
      case 11: {
        const { listScripts, runScriptCmd } = await import("./scripts/command.js");
        log.dim(`  Scripts: ${listScripts().join(", ")}`);
        const name = await ask("  Script", "");
        if (!name) break;
        const extra = await ask("  Args (space-separated)", "");
        await runScriptCmd({ name, list: false, args: extra ? extra.split(/\s+/) : [] });
        break;
      }
      case 12:
        await runDoctor();
        break;
    }
    log.blank();
  }
}

export interface InitOptions {
  video: string | null;
  dir: string | null;
  fps: number | null;
  headline: string | null;
  subline: string | null;
  email: string | null;
  github: string | null;
  sections: string[] | null;
  fx: string[] | null;
}

export const INIT_HELP = `siteforge init — guided new site: video background + your content + sections + FX.

Usage:
  siteforge init [options]        (interactive wizard)
  siteforge init --video intro.mp4 --dir my-site --headline "Make it unforgettable."

Options:
  --video <file>        Source video (skips prompt)
  --dir <dir>           Site directory (default: derived from video)
  --fps <n>             Frame rate (default: source fps)
  --headline <text>     Hero headline (default: keep template)
  --subline <text>      Hero subline (default: keep template)
  --email <addr>        Contact email (wired into contact section)
  --github <url>        GitHub URL (wired into contact section)
  --sections <a,b>      Section names (see: siteforge add --list)
  --fx <a,b>            fx:NAME or 3d:NAME entries (see: siteforge fx --list)
`;

export function parseInitArgs(argv: string[]): InitOptions {
  const o: InitOptions = {
    video: null, dir: null, fps: null, headline: null, subline: null,
    email: null, github: null, sections: null, fx: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "--video": o.video = next(); break;
      case "--dir": o.dir = next(); break;
      case "--fps": {
        const v = Number(next());
        if (!Number.isFinite(v) || v <= 0) throw new Error("--fps must be positive");
        o.fps = v;
        break;
      }
      case "--headline": o.headline = next(); break;
      case "--subline": o.subline = next(); break;
      case "--email": o.email = next(); break;
      case "--github": o.github = next(); break;
      case "--sections": o.sections = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--fx": o.fx = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      default: throw new Error(`Unknown option for init: ${a}`);
    }
  }
  return o;
}

export async function runInit(ask: Ask, flags: InitOptions = { video: null, dir: null, fps: null, headline: null, subline: null, email: null, github: null, sections: null, fx: null }): Promise<void> {
  const video = flags.video ?? (await ask("  Video file", ""));
  if (!video) throw new Error("A video file is required.");
  const dir = flags.dir ?? (await ask("  Site directory", ""));
  const fpsRaw = flags.fps !== null ? String(flags.fps) : await ask("  FPS (empty = source fps)", "");
  const fps = fpsRaw ? Number(fpsRaw) : null;
  if (fpsRaw && (!Number.isFinite(fps as number) || (fps as number) <= 0)) throw new Error("--fps must be positive");

  const headline = flags.headline ?? (await ask("  Headline", ""));
  const subline = flags.subline ?? (await ask("  Subline", ""));
  const email = flags.email ?? (await ask("  Contact email", ""));
  const github = flags.github ?? (await ask("  GitHub URL", ""));
  const content = {
    ...(headline ? { headline } : {}),
    ...(subline ? { subline } : {}),
    ...(email ? { email } : {}),
    ...(github ? { github } : {}),
  };

  log.step("Building video background...");
  const out = dir || `./${path.basename(video).replace(/\.[^.]*$/, "") || "site"}-site`;
  await runVideo({
    video, outDir: out, fps,
    width: 1920, height: 1080, name: null, upscale: true,
    install: true, build: false, quality: 95, pm: null,
  });

  const sectionNames = Object.keys(SECTIONS);
  const pickedSections = flags.sections ?? (await pickList("Sections:", sectionNames));

  const fxNames = Object.keys(FX).map((n) => `fx:${n}`);
  const tdNames = Object.keys(PRESETS).map((n) => `3d:${n}`);
  const pickedFx = flags.fx ?? (await pickList("Effects & 3D:", [...fxNames, ...tdNames]));

  const { composeSite } = await import("./video/compose.js");
  await composeSite(out, {
    content,
    sections: pickedSections,
    projectName: path.basename(path.resolve(out)),
  });

  for (const n of pickedFx) {
    const target = path.join(out, "src", "components");
    if (n.startsWith("fx:")) {
      const en = n.slice(3);
      if (!FX[en]) { log.warn(`Unknown fx "${en}" — skipped.`); continue; }
      await runFx({ effect: en, dir: target, list: false, opts: {} });
    } else if (n.startsWith("3d:")) {
      const pn = n.slice(3);
      if (!PRESETS[pn]) { log.warn(`Unknown 3d preset "${pn}" — skipped.`); continue; }
      await runThree({ preset: pn, dir: target, list: false });
    } else if (FX[n]) {
      await runFx({ effect: n, dir: target, list: false, opts: {} });
    } else if (PRESETS[n]) {
      await runThree({ preset: n, dir: target, list: false });
    } else log.warn(`Unknown entry "${n}" — skipped.`);
  }

  log.blank();
  log.ok("Site forged — with your content, not placeholders. Next:");
  log.dim(`  1. cd ${out} && <pm> run dev`);
  log.dim("  2. Read FORGE.md for the map, pass real content to components");
  log.dim("  3. siteforge audit <url> → siteforge ship");
  log.blank();
}
