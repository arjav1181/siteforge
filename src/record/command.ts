import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findBrowser, launchBrowser } from "../browser.js";
import { commandExists } from "../util.js";
import { log } from "../log.js";

const execFileAsync = promisify(execFile);

export const RECORD_HELP = `siteforge record — capture a dressed-up demo video of any page.

Usage:
  siteforge record <url> --out demo.mp4 [options]

The page auto-scrolls top to bottom while recording, then encodes a
30fps H.264 MP4 plus a poster frame. Dress it up first (browser frame,
headline) or record raw — your call.

Options:
  --out <file>        Output MP4 (default: demo.mp4)
  --viewport <WxH>    Recording viewport (default: 1280x800)
  --establish <ms>    Hold on first paint before scrolling (default: 1800)
  --step <px>         Scroll step in pixels (default: 90)
  --delay <ms>        Delay between scroll steps (default: 130)
  --hold <ms>         Hold on the end before stopping (default: 1500)
  --crf <n>           H.264 quality, lower is better (default: 21)
  --browser <path>    Chrome/Chromium binary (default: auto-detect)
  --keep-raw          Keep the raw .webm capture next to the MP4

Examples:
  siteforge record https://my-site.vercel.app --out demo.mp4
  siteforge record http://localhost:3000 --out hero.mp4 --step 60 --delay 100
`;

export interface RecordOptions {
  url: string;
  out: string;
  width: number;
  height: number;
  establish: number;
  step: number;
  delay: number;
  hold: number;
  crf: number;
  browser: string | null;
  keepRaw: boolean;
}

export function parseRecordArgs(argv: string[]): RecordOptions {
  const positional: string[] = [];
  const o: RecordOptions = {
    url: "", out: "demo.mp4", width: 1280, height: 800,
    establish: 1800, step: 90, delay: 130, hold: 1500,
    crf: 21, browser: null, keepRaw: false,
  };
  const num = (v: string | undefined, flag: string) => {
    const n = Number(v);
    if (v === undefined || !Number.isFinite(n) || n <= 0) throw new Error(`${flag} must be a positive number`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "--out": o.out = next(); break;
      case "--viewport": {
        const m = /^(\d+)x(\d+)$/.exec(next());
        if (!m) throw new Error("--viewport must look like 1280x800");
        o.width = Number(m[1]); o.height = Number(m[2]);
        break;
      }
      case "--establish": o.establish = num(next(), "--establish"); break;
      case "--step": o.step = num(next(), "--step"); break;
      case "--delay": o.delay = num(next(), "--delay"); break;
      case "--hold": o.hold = num(next(), "--hold"); break;
      case "--crf": o.crf = num(next(), "--crf"); break;
      case "--browser": o.browser = next(); break;
      case "--keep-raw": o.keepRaw = true; break;
      default:
        if (a.startsWith("-")) throw new Error(`Unknown option for record: ${a}`);
        positional.push(a);
    }
  }
  if (positional.length === 0) throw new Error("Missing <url> argument.");
  if (positional.length > 1) throw new Error("Too many arguments for record.");
  o.url = positional[0];
  return o;
}

function ffmpegEncode(raw: string, out: string, crf: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", [
      "-y", "-v", "warning", "-i", raw,
      "-r", "30", "-c:v", "libx264", "-crf", String(crf),
      "-preset", "medium", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", "-an", out,
    ], { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });
}

export async function runRecord(o: RecordOptions): Promise<{ out: string; poster: string }> {
  if (!(await commandExists("ffmpeg"))) throw new Error("Missing dependency: ffmpeg");
  const exe = await findBrowser(o.browser ?? undefined);
  const rawDir = mkdtempSync(path.join(tmpdir(), "siteforge-record-"));

  log.step(`Recording ${o.url} @ ${o.width}x${o.height}...`);
  const browser = await launchBrowser(exe);
  try {
    const context = await browser.newContext({
      viewport: { width: o.width, height: o.height },
      recordVideo: { dir: rawDir, size: { width: o.width, height: o.height } },
    });
    const page = await context.newPage();
    try {
      await page.goto(o.url, { waitUntil: "networkidle", timeout: 30000 });
    } catch {
      await page.goto(o.url, { waitUntil: "load", timeout: 30000 });
    }
    await page.waitForTimeout(o.establish);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    if (max > 0) {
      let y = 0;
      while (y < max) {
        y = Math.min(max, y + o.step);
        await page.evaluate((yy: number) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(o.delay);
      }
    }
    await page.waitForTimeout(o.hold);
    await context.close();
  } finally {
    await browser.close();
  }

  const raw = readdirSync(rawDir).filter((f) => f.endsWith(".webm")).map((f) => path.join(rawDir, f))[0];
  if (!raw) throw new Error("Recording produced no video");
  log.step("Encoding MP4...");
  await ffmpegEncode(raw, o.out, o.crf);
  const poster = o.out.replace(/\.mp4$/i, "") + "-poster.jpg";
  await execFileAsync("ffmpeg", ["-y", "-v", "warning", "-ss", "1", "-i", o.out, "-frames:v", "1", "-q:v", "3", poster]);
  if (!o.keepRaw) rmSync(rawDir, { recursive: true, force: true });
  log.ok(`Wrote ${o.out} + ${poster}`);
  return { out: o.out, poster };
}
