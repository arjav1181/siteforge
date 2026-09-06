import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { chromium, type Browser, type BrowserContextOptions } from "playwright-core";

const execFileAsync = promisify(execFile);

const CANDIDATES =
  process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ]
    : process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];

/** Locate a system Chrome/Chromium (playwright-core ships no browser). */
export async function findBrowser(explicit?: string): Promise<string> {
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`Browser not found: ${explicit}`);
    return explicit;
  }
  if (process.env.SITEFORGE_CHROME && existsSync(process.env.SITEFORGE_CHROME)) {
    return process.env.SITEFORGE_CHROME as string;
  }
  for (const c of CANDIDATES) {
    if (c.includes("/") && existsSync(c)) return c;
    try {
      const { stdout } = await execFileAsync(process.platform === "win32" ? "where" : "which", [c]);
      const p = stdout.trim().split("\n")[0];
      if (p) return p;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "No Chrome/Chromium found. Install Google Chrome, or point at it:\n" +
      "  siteforge <cmd> --browser /path/to/chrome   (or SITEFORGE_CHROME env)",
  );
}

export async function launchBrowser(executablePath: string): Promise<Browser> {
  return chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
}

export type { Browser, BrowserContextOptions };
