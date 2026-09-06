import readline from "node:readline";
import path from "node:path";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { runVideo } from "./video/command.js";
import { SECTIONS, renderSharedCss } from "./add/sections.js";
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

/** "1,3-4" → zero-based indices clamped to [0, max). Pure — unit tested. */
export function parseSelection(input: string, max: number): number[] {
  const out = new Set<number>();
  for (const part of input.split(",")) {
    const range = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!range) continue;
    const a = Math.max(1, Math.min(max, Number(range[1])));
    const b = range[2] ? Math.max(1, Math.min(max, Number(range[2]))) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}

async function pickList(ask: Ask, title: string, names: string[]): Promise<string[]> {
  log.dim(`  ${title} (comma-separated numbers, empty = skip):`);
  names.forEach((n, i) => log.dim(`    ${i + 1}) ${n}`));
  const ans = await ask("  Pick", "");
  if (!ans) return [];
  return parseSelection(ans, names.length).map((i) => names[i]);
}

const MENU = `
  What are we forging today?
    1) New site        video background + sections + FX, guided
    2) Add section     hero, navbar, work, pricing, faq…
    3) Add effect      cursor, badge, marquee, 3D scene…
    4) Record demo     page → MP4 + poster
    5) Audit site      overflow, meta, alt, console, weight
    6) Ship it         commit + GitHub + push
    7) Install skills  agent skills for this toolkit
    8) Doctor          check this machine
    0) Exit
`;

export async function runWizard(ask: Ask): Promise<void> {
  log.blank();
  log.title("  ▲ siteforge");
  for (;;) {
    process.stdout.write(MENU);
    const choice = await ask("  Choice", "0");
    log.blank();
    switch (choice) {
      case "1":
        await runInit(ask);
        break;
      case "2": {
        const names = Object.keys(SECTIONS);
        for (const n of await pickList(ask, "Sections:", names)) {
          await runAdd({ section: n, dir: "src/components", list: false });
        }
        break;
      }
      case "3": {
        const fxNames = Object.keys(FX).map((n) => `fx:${n}`);
        const tdNames = Object.keys(PRESETS).map((n) => `3d:${n}`);
        for (const n of await pickList(ask, "Effects & 3D:", [...fxNames, ...tdNames])) {
          if (n.startsWith("fx:")) await runFx({ effect: n.slice(3), dir: "src/components", list: false, opts: {} });
          else await runThree({ preset: n.slice(3), dir: "src/components", list: false });
        }
        break;
      }
      case "4": {
        const url = await ask("  URL", "http://localhost:3000");
        const out = await ask("  Output MP4", "demo.mp4");
        await runRecord({
          url, out, width: 1280, height: 800, establish: 1800,
          step: 90, delay: 130, hold: 1500, crf: 21, browser: null, keepRaw: false,
        });
        break;
      }
      case "5": {
        const url = await ask("  URL", "http://localhost:3000");
        const { clean } = await runAudit({ url, widths: [375, 768, 1440], budgetKb: 500, browser: null, fix: false });
        if (!clean) log.warn("Fix the errors above, then re-run audit.");
        break;
      }
      case "6":
        await runShip({ repo: null, isPrivate: false, message: await ask("  Commit message", "ship it"), push: true });
        break;
      case "7": {
        const picked = await pickList(ask, "Agents:", AGENTS);
        await runSkills({ action: "install", agents: picked.length ? picked : AGENTS, global: (await ask("  Global? (y/N)", "n")).toLowerCase().startsWith("y") });
        break;
      }
      case "8":
        await runDoctor();
        break;
      case "0":
      default:
        log.dim("  Later!");
        return;
    }
    log.blank();
  }
}

export interface InitOptions {
  video: string | null;
  dir: string | null;
  fps: number | null;
  sections: string[] | null;
  fx: string[] | null;
}

export const INIT_HELP = `siteforge init — guided new site: video background + sections + FX.

Usage:
  siteforge init [options]        (interactive wizard)
  siteforge init --video intro.mp4 --dir my-site --sections hero,navbar,work --fx cursor

Options:
  --video <file>        Source video (skips prompt)
  --dir <dir>           Site directory (default: derived from video)
  --fps <n>             Frame rate (default: source fps)
  --sections <a,b>      Section names (see: siteforge add --list)
  --fx <a,b>            fx:NAME or 3d:NAME entries (see: siteforge fx --list)
`;

export function parseInitArgs(argv: string[]): InitOptions {
  const o: InitOptions = { video: null, dir: null, fps: null, sections: null, fx: null };
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
      case "--sections": o.sections = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--fx": o.fx = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      default: throw new Error(`Unknown option for init: ${a}`);
    }
  }
  return o;
}

export async function runInit(ask: Ask, flags: InitOptions = { video: null, dir: null, fps: null, sections: null, fx: null }): Promise<void> {
  const video = flags.video ?? (await ask("  Video file", ""));
  if (!video) throw new Error("A video file is required.");
  const dir = flags.dir ?? (await ask("  Site directory", ""));
  const fpsRaw = flags.fps !== null ? String(flags.fps) : await ask("  FPS (empty = source fps)", "");
  const fps = fpsRaw ? Number(fpsRaw) : null;
  if (fpsRaw && (!Number.isFinite(fps as number) || (fps as number) <= 0)) throw new Error("--fps must be positive");

  log.step("Building video background...");
  const out = dir || `./${path.basename(video).replace(/\.[^.]*$/, "") || "site"}-site`;
  await runVideo({
    video, outDir: out, fps,
    width: 1920, height: 1080, name: null, upscale: true,
    install: true, build: false, quality: 95, pm: null,
  });

  const sectionNames = Object.keys(SECTIONS);
  const pickedSections = flags.sections ?? (await pickList(ask, "Sections:", sectionNames));
  for (const n of pickedSections) {
    if (!SECTIONS[n]) { log.warn(`Unknown section "${n}" — skipped.`); continue; }
    await runAdd({ section: n, dir: path.join(out, "src", "components"), list: false });
  }

  const fxNames = Object.keys(FX).map((n) => `fx:${n}`);
  const tdNames = Object.keys(PRESETS).map((n) => `3d:${n}`);
  const pickedFx = flags.fx ?? (await pickList(ask, "Effects & 3D:", [...fxNames, ...tdNames]));
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

  // Shared CSS for everything added (runAdd writes it on first add; ensure it).
  const cssPath = path.join(out, "src", "components", "siteforge.css");
  if (!existsSync(cssPath)) {
    mkdirSync(path.join(out, "src", "components"), { recursive: true });
    writeFileSync(cssPath, renderSharedCss());
    log.ok(`Wrote ${cssPath}`);
  }

  log.blank();
  log.ok("Site forged. Next:");
  log.dim(`  1. cd ${out} && <pm> run dev`);
  log.dim("  2. Import components in src/app/page.tsx, pass real content");
  log.dim("  3. siteforge audit <url> → siteforge ship");
  log.blank();
}
