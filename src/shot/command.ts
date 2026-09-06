import { findBrowser, launchBrowser } from "../browser.js";
import { log } from "../log.js";

export const SHOT_HELP = `siteforge shot — screenshot any page.

Usage:
  siteforge shot <url> --out shot.png [options]

Options:
  --out <file>        Output PNG (required)
  --viewport <WxH>    Viewport (default: 1280x800)
  --full              Full-page screenshot
  --wait <ms>         Extra settle time after load (default: 1200)
  --browser <path>    Chrome/Chromium binary (default: auto-detect)

Examples:
  siteforge shot https://example.com --out hero.png
  siteforge shot http://localhost:3000 --out full.png --full --viewport 1440x900
`;

export interface ShotOptions {
  url: string;
  out: string;
  width: number;
  height: number;
  full: boolean;
  wait: number;
  browser: string | null;
}

export function parseShotArgs(argv: string[]): ShotOptions {
  const positional: string[] = [];
  const o: ShotOptions = { url: "", out: "", width: 1280, height: 800, full: false, wait: 1200, browser: null };
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
      case "--full": o.full = true; break;
      case "--wait": o.wait = num(next(), "--wait"); break;
      case "--browser": o.browser = next(); break;
      default:
        if (a.startsWith("-")) throw new Error(`Unknown option for shot: ${a}`);
        positional.push(a);
    }
  }
  if (positional.length === 0) throw new Error("Missing <url> argument.");
  if (positional.length > 1) throw new Error("Too many arguments for shot.");
  if (!o.out) throw new Error("Missing --out <file>.");
  o.url = positional[0];
  return o;
}

export async function runShot(o: ShotOptions): Promise<{ out: string }> {
  const exe = await findBrowser(o.browser ?? undefined);
  const browser = await launchBrowser(exe);
  try {
    const page = await (await browser.newContext({ viewport: { width: o.width, height: o.height } })).newPage();
    try {
      await page.goto(o.url, { waitUntil: "networkidle", timeout: 30000 });
    } catch {
      await page.goto(o.url, { waitUntil: "load", timeout: 30000 });
    }
    await page.waitForTimeout(o.wait);
    await page.screenshot({ path: o.out, fullPage: o.full });
  } finally {
    await browser.close();
  }
  log.ok(`Wrote ${o.out}`);
  return { out: o.out };
}
