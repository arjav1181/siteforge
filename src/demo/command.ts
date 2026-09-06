#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { commandExists } from "../util.js";
import { log } from "../log.js";

const execFileAsync = promisify(execFile);

export const DEMO_HELP = `siteforge demo — forge a sample site in ~a minute, no files needed.

Usage:
  siteforge demo [dir] [--fps 24]

Generates a short synthetic clip with ffmpeg, then runs the full video
pipeline on it (frames + scaffold + your content prompts skipped).
The fastest way to see what SiteForge output feels like.

Requires ffmpeg. Skips install/build for speed — run them yourself:

  cd <dir> && bun install && bun run dev
`;

export function parseDemoArgs(argv: string[]): { dir: string; fps: number } {
  let dir = "./siteforge-demo";
  let fps = 24;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fps") {
      const v = argv[++i];
      const n = Number(v);
      if (v === undefined || !Number.isFinite(n) || n <= 0) throw new Error("--fps must be positive");
      fps = n;
    } else if (a.startsWith("-")) throw new Error(`Unknown option for demo: ${a}`);
    else positional.push(a);
  }
  if (positional.length > 1) throw new Error("Too many arguments for demo.");
  if (positional[0]) dir = positional[0];
  return { dir, fps };
}

export async function runDemo(o: { dir: string; fps: number }): Promise<{ outDir: string; frames: number }> {
  if (!(await commandExists("ffmpeg"))) throw new Error("Missing dependency: ffmpeg");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const tmp = mkdtempSync(join(tmpdir(), "siteforge-demo-"));
  const clip = join(tmp, "sample.mp4");
  try {
    log.step("Generating sample clip...");
    await execFileAsync("ffmpeg", [
      "-y", "-v", "warning",
      "-f", "lavfi", "-i", `testsrc=size=1280x720:rate=30:duration=4`,
      "-vf", "format=yuv420p",
      "-c:v", "libx264", "-preset", "veryfast", clip,
    ]);
    const { runVideo } = await import("../video/command.js");
    const res = await runVideo({
      video: clip, outDir: o.dir, fps: o.fps,
      width: 1280, height: 720, name: "siteforge-demo", upscale: false,
      install: false, build: false, quality: 90, pm: null,
    });
    return { outDir: res.outDir, frames: res.frames };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
