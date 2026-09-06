import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../log.js";

export const SKILLS_HELP = `siteforge skills — install bundled agent skills into your setup.

Usage:
  siteforge skills --list
  siteforge skills install [--agent claude,cursor,opencode,codex,aider,pi]
                           [--global]

Installs every bundled skill (video, add, fx, record, audit, ship, …) as
SKILL.md files in each agent's conventional location. Project-local by
default; --global writes to your home directory instead.

Examples:
  siteforge skills install
  siteforge skills install --agent claude --global
`;

/** Where each agent looks for skills: [projectDir, globalDir, fileName] */
function agentTargets(agent: string): { project: string; global: string; file: (name: string) => string } {
  switch (agent) {
    case "claude":
      return {
        project: path.join(".claude", "skills"),
        global: path.join(homedir(), ".claude", "skills"),
        file: () => "SKILL.md",
      };
    case "cursor":
      return {
        project: path.join(".cursor", "rules"),
        global: path.join(homedir(), ".cursor", "rules"),
        file: (name) => `siteforge-${name}.mdc`,
      };
    case "opencode":
      return {
        project: path.join(".opencode", "skills"),
        global: path.join(homedir(), ".config", "opencode", "skills"),
        file: () => "SKILL.md",
      };
    case "codex":
      return {
        project: path.join(".codex", "skills"),
        global: path.join(homedir(), ".codex", "skills"),
        file: () => "SKILL.md",
      };
    case "aider":
      return {
        project: path.join(".aider", "skills"),
        global: path.join(homedir(), ".aider", "skills"),
        file: () => "SKILL.md",
      };
    case "pi":
      return {
        project: path.join(".pi", "skills"),
        global: path.join(homedir(), ".pi", "skills"),
        file: () => "SKILL.md",
      };
    default:
      throw new Error(`Unknown agent "${agent}". Choose from: ${AGENTS.join(", ")}`);
  }
}

export const AGENTS = ["claude", "cursor", "opencode", "codex", "aider", "pi"];

/** Directory containing the bundled skills (works from src/ and dist/). */
export function bundledSkillsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "..", "skills"), // dist/skills (published package)
    path.join(here, "..", "..", "skills"), // repo root (tsx dev / vitest)
  ];
  for (const c of candidates) {
    try {
      const has = readdirSync(c, { withFileTypes: true }).some(
        (d) => d.isDirectory() && existsSync(path.join(c, d.name, "SKILL.md")),
      );
      if (has) return c;
    } catch {
      /* try next */
    }
  }
  throw new Error("Bundled skills not found (expected skills/ next to the package).");
}

export function listBundledSkills(): string[] {
  const dir = bundledSkillsDir();
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();
}

export function parseSkillsArgs(argv: string[]): { action: string | null; agents: string[]; global: boolean } {
  let action: string | null = null;
  let agents = [...AGENTS];
  let global = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") action = "list";
    else if (a === "install") action = "install";
    else if (a === "--global") global = true;
    else if (a === "--agent") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --agent");
      agents = v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      for (const ag of agents) {
        if (!AGENTS.includes(ag)) throw new Error(`Unknown agent "${ag}". Choose from: ${AGENTS.join(", ")}`);
      }
    } else if (a.startsWith("-")) throw new Error(`Unknown option for skills: ${a}`);
    else throw new Error(`Unknown argument for skills: ${a}`);
  }
  return { action, agents, global };
}

export async function runSkills(o: { action: string | null; agents: string[]; global: boolean }): Promise<void> {
  const names = listBundledSkills();
  if (o.action === "list" || !o.action) {
    log.step("Bundled skills:");
    for (const n of names) log.dim(`  - ${n}`);
    log.blank();
    log.dim("  Install: siteforge skills install [--agent claude] [--global]");
    return;
  }
  for (const agent of o.agents) {
    const t = agentTargets(agent);
    const base = o.global ? t.global : t.project;
    for (const name of names) {
      const src = readFileSync(path.join(bundledSkillsDir(), name, "SKILL.md"), "utf8");
      // Cursor keeps flat rule files; everyone else gets a folder per skill.
      const destDir = agent === "cursor" ? base : path.join(base, name);
      mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, t.file(name));
      writeFileSync(dest, src);
      log.ok(`${agent}: ${dest}`);
    }
  }
  log.blank();
  log.dim("  Paths follow each agent's conventional layout — move files if yours differs.");
}
