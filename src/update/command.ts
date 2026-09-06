import { spawn } from "node:child_process";
import { commandExists } from "../util.js";
import { log } from "../log.js";
import { VERSION } from "../version.js";

export const UPDATE_HELP = `siteforge update — self-update to the latest published version.

Usage:
  siteforge update
`;

function runCmd(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function runUpdate(): Promise<void> {
  log.step(`Current: siteforge v${VERSION}`);
  const pkg = "@arjav1181/siteforge@latest";
  if (await commandExists("npm")) {
    log.step(`Running: npm install -g ${pkg}`);
    const code = await runCmd("npm", ["install", "-g", pkg]);
    if (code !== 0) throw new Error("npm update failed");
  } else if (await commandExists("bun")) {
    log.step(`Running: bun add -g ${pkg}`);
    const code = await runCmd("bun", ["add", "-g", pkg]);
    if (code !== 0) throw new Error("bun update failed");
  } else {
    throw new Error("Neither npm nor bun found.");
  }
  log.ok("Updated. Run `siteforge --version` to confirm.");
}
