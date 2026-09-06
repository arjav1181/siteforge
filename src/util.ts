import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

export async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync(process.platform === "win32" ? "where" : "which", [cmd]);
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  return `${m}m ${Math.round(sec % 60)}s`;
}

/** Package root — works from src/ (tsx/vitest) and dist/ (installed). */
export function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.join(here, ".."), path.join(here, "..", "..")];
  for (const c of candidates) {
    if (existsSync(path.join(c, "package.json"))) return c;
  }
  throw new Error("Package root not found.");
}
