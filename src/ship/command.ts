import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, writeFileSync } from "node:fs";
import { commandExists } from "../util.js";
import { log } from "../log.js";

const execFileAsync = promisify(execFile);

export const SHIP_HELP = `siteforge ship — commit, create the GitHub repo, and push.

Usage:
  siteforge ship [options]

Options:
  --repo <name>       Repo name (default: current directory name)
  --private           Create a private repo (default: public)
  --message <msg>     Commit message (default: "ship it")
  --no-push           Commit locally only, skip GitHub + push

Requires: git, and the gh CLI authenticated (gh auth login).

Examples:
  siteforge ship
  siteforge ship --repo my-site --private
`;

const GITIGNORE = `node_modules/
.next/
dist/
out/
*.log
.DS_Store
.env*.local
`;

export interface ShipOptions {
  repo: string | null;
  isPrivate: boolean;
  message: string;
  push: boolean;
}

export function parseShipArgs(argv: string[]): ShipOptions {
  const o: ShipOptions = { repo: null, isPrivate: false, message: "ship it", push: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "--repo": o.repo = next(); break;
      case "--private": o.isPrivate = true; break;
      case "--message": o.message = next(); break;
      case "--no-push": o.push = false; break;
      default: throw new Error(`Unknown option for ship: ${a}`);
    }
  }
  return o;
}

async function git(args: string[], cwd = process.cwd()): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

export async function runShip(o: ShipOptions): Promise<void> {
  if (!(await commandExists("git"))) throw new Error("git not found");

  try {
    await git(["rev-parse", "--git-dir"]);
  } catch {
    log.step("Initializing git repo...");
    await git(["init"]);
  }

  if (!existsSync(".gitignore")) {
    writeFileSync(".gitignore", GITIGNORE);
    log.ok("Wrote .gitignore");
  }

  await git(["add", "-A"]);
  const status = await git(["status", "--porcelain"]);
  if (status) {
    await git(["commit", "-m", o.message]);
    log.ok(`Committed: ${o.message}`);
  } else {
    log.step("Nothing to commit — working tree clean.");
  }

  if (!o.push) return;

  if (!(await commandExists("gh"))) {
    throw new Error("gh CLI not found — install it (https://cli.github.com), then: gh auth login");
  }
  try {
    await execFileAsync("gh", ["auth", "status"]);
  } catch {
    throw new Error("gh is not authenticated — run: gh auth login");
  }

  let remote = "";
  try {
    remote = await git(["remote", "get-url", "origin"]);
  } catch {
    /* no origin yet */
  }
  if (!remote) {
    const { default: path } = await import("node:path");
    const name = o.repo ?? path.basename(path.resolve("."));
    log.step(`Creating GitHub repo ${name} (${o.isPrivate ? "private" : "public"})...`);
    await execFileAsync("gh", [
      "repo", "create", name,
      o.isPrivate ? "--private" : "--public",
      "--source", ".", "--push",
    ]);
    log.ok("Repo created and pushed.");
  } else {
    log.step(`Pushing to ${remote}...`);
    try {
      await git(["push", "-u", "origin", "HEAD"]);
    } catch {
      await git(["push"]);
    }
    log.ok("Pushed.");
  }

  log.blank();
  log.dim("  Deploy to Vercel: import the repo at https://vercel.com/new");
  log.blank();
}
