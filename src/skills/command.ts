import { existsSync, mkdirSync, readdirSync, readFileSync, cpSync, copyFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { log } from "../log.js";
import { packageRoot } from "../util.js";

const execFileAsync = promisify(execFile);

export const SKILLS_HELP = `siteforge skills — install bundled agent skills into your setup.

Usage:
  siteforge skills --list [--oss]
  siteforge skills install [--agent claude,cursor,opencode,codex,aider,pi]
                           [--global] [--oss]

Handmade skills ship with the package. OSS collections (see oss-skills.json)
install with --oss — whole skill folders (SKILL.md + references + scripts),
flattened so every agent discovers them one level deep.

Examples:
  siteforge skills install
  siteforge skills install --agent claude --global --oss
`;

export interface OssSource {
  id: string;
  repo: string;
  subdir: string;
  skillsPath: string;
  ref: string;
  license: string;
  note: string;
}

export interface DiscoveredSkill {
  /** Install name (collision-prefixed when needed) */
  name: string;
  /** Owning source id: "handmade" or manifest id */
  source: string;
  /** Absolute directory containing SKILL.md */
  dir: string;
}

export function loadManifest(): OssSource[] {
  const file = path.join(packageRoot(), "oss-skills.json");
  if (!existsSync(file)) return [];
  return (JSON.parse(readFileSync(file, "utf8")) as { sources: OssSource[] }).sources ?? [];
}

const SKIP_DIRS = new Set([".git", "node_modules", ".hg"]);

/** Recursively find skill dirs (folders directly containing SKILL.md). */
export function findSkillDirs(root: string, maxDepth = 4): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === "SKILL.md")) {
      out.push(dir);
      return; // don't descend into a skill folder
    }
    for (const e of entries) {
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), depth + 1);
    }
  };
  walk(root, 0);
  return out.sort();
}

/** Discover handmade + (optionally) OSS skills with collision-safe names. */
export function discoverSkills(includeOss: boolean, root = packageRoot()): DiscoveredSkill[] {
  const found: DiscoveredSkill[] = [];
  const used = new Set<string>();
  const add = (source: string, dir: string, prefixOnClash: string | null) => {
    let name = path.basename(dir);
    if (used.has(name)) name = `${prefixOnClash ?? source}-${path.basename(dir)}`;
    used.add(name);
    found.push({ source, name, dir });
  };
  const handmade = path.join(root, "skills");
  if (existsSync(handmade)) {
    for (const d of findSkillDirs(handmade, 1)) add("handmade", d, null);
  }
  if (includeOss) {
    for (const src of loadManifest()) {
      const base = path.join(root, src.subdir, src.skillsPath);
      if (!existsSync(base)) continue;
      for (const d of findSkillDirs(base, 4)) add(src.id, d, src.id);
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

export function listBundledSkills(): string[] {
  return discoverSkills(false).map((s) => s.name);
}

/** Where each agent looks for skills: [projectDir, globalDir, fileName] */
function agentTargets(agent: string): { project: string; global: string; file: (name: string) => string; flat: boolean } {
  switch (agent) {
    case "claude":
      return { project: path.join(".claude", "skills"), global: path.join(homedir(), ".claude", "skills"), file: () => "SKILL.md", flat: false };
    case "cursor":
      return { project: path.join(".cursor", "rules"), global: path.join(homedir(), ".cursor", "rules"), file: (n) => `siteforge-${n}.mdc`, flat: true };
    case "opencode":
      return { project: path.join(".opencode", "skills"), global: path.join(homedir(), ".config", "opencode", "skills"), file: () => "SKILL.md", flat: false };
    case "codex":
      return { project: path.join(".codex", "skills"), global: path.join(homedir(), ".codex", "skills"), file: () => "SKILL.md", flat: false };
    case "aider":
      return { project: path.join(".aider", "skills"), global: path.join(homedir(), ".aider", "skills"), file: () => "SKILL.md", flat: false };
    case "pi":
      return { project: path.join(".pi", "skills"), global: path.join(homedir(), ".pi", "skills"), file: () => "SKILL.md", flat: false };
    default:
      throw new Error(`Unknown agent "${agent}". Choose from: ${AGENTS.join(", ")}`);
  }
}

export const AGENTS = ["claude", "cursor", "opencode", "codex", "aider", "pi"];

/** Skill names inside a source, via local submodule or GitHub tree API (npm installs). */
export async function listOssSkills(src: OssSource): Promise<{ local: boolean; names: string[] }> {
  const local = path.join(packageRoot(), src.subdir, src.skillsPath);
  if (existsSync(local) && findSkillDirs(local, 1).length > 0) {
    return { local: true, names: findSkillDirs(local, 4).map((d) => path.basename(d)).sort() };
  }
  const res = await fetch(`https://api.github.com/repos/${src.repo}/git/trees/${src.ref}?recursive=1`, {
    headers: { "User-Agent": "siteforge", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`Cannot list ${src.repo} (HTTP ${res.status}) — clone with --recursive instead.`);
  const data = (await res.json()) as { tree?: { path?: string; type?: string }[] };
  const prefix = src.skillsPath + "/";
  const names = new Set<string>();
  for (const e of data.tree ?? []) {
    if (e.type !== "blob" || !e.path?.startsWith(prefix) || !e.path.endsWith("/SKILL.md")) continue;
    const rest = e.path.slice(prefix.length).split("/");
    if (rest.length === 2) names.add(rest[0]);
  }
  return { local: false, names: [...names].sort() };
}
export async function fetchOssSource(src: OssSource): Promise<string> {
  const tmp = path.join(tmpdir(), `siteforge-oss-${src.id}-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const tgz = path.join(tmp, "src.tgz");
  log.step(`Fetching ${src.repo}@${src.ref}...`);
  const res = await fetch(`https://codeload.github.com/${src.repo}/tar.gz/${src.ref}`);
  if (!res.ok) throw new Error(`Download failed for ${src.repo}: HTTP ${res.status}`);
  writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
  try {
    await execFileAsync("tar", ["-xzf", tgz, "-C", tmp, "--strip-components=1"]);
  } catch {
    throw new Error("Need `tar` on PATH to fetch OSS skills (or clone with --recursive).");
  }
  return path.join(tmp, src.skillsPath);
}

export function parseSkillsArgs(argv: string[]): { action: string | null; agents: string[]; global: boolean; oss: boolean } {
  let action: string | null = null;
  let agents = [...AGENTS];
  let global = false;
  let oss = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") action = "list";
    else if (a === "install") action = "install";
    else if (a === "--global") global = true;
    else if (a === "--oss") oss = true;
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
  return { action, agents, global, oss };
}

export async function runSkills(o: { action: string | null; agents: string[]; global: boolean; oss: boolean }): Promise<{ installed: string[] } | undefined> {
  if (o.action === "list" || !o.action) {
    const mine = discoverSkills(false);
    log.step(`Handmade skills (${mine.length}):`);
    for (const s of mine) log.dim(`  - ${s.name}`);
    if (o.oss) {
      for (const src of loadManifest()) {
        try {
          const { local, names } = await listOssSkills(src);
          log.step(`${src.id}: ${names.length} skills${local ? " (local)" : " (remote)"}`);
          if (!local) for (const n of names.slice(0, 40)) log.dim(`  - ${n}`);
          if (names.length > 40) log.dim(`  … +${names.length - 40} more (install to see all)`);
        } catch (e) {
          log.warn(`${src.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } else {
      log.blank();
      log.dim("  Add --oss to preview OSS collections (see oss-skills.json).");
    }
    log.blank();
    log.dim("  Install: siteforge skills install [--agent claude] [--global] [--oss]");
    return undefined;
  }

  // Gather skill dirs: handmade always; OSS from submodules or network fallback.
  const roots: { source: string; dir: string }[] = [];
  const pkgRoot = packageRoot();
  const handmade = path.join(pkgRoot, "skills");
  if (existsSync(handmade)) roots.push({ source: "handmade", dir: handmade });
  if (o.oss) {
    for (const src of loadManifest()) {
      const local = path.join(pkgRoot, src.subdir, src.skillsPath);
      if (existsSync(local) && findSkillDirs(local, 1).length > 0) {
        roots.push({ source: src.id, dir: local });
      } else {
        roots.push({ source: src.id, dir: await fetchOssSource(src) });
      }
    }
  }

  const used = new Set<string>();
  const installed: string[] = [];
  for (const agent of o.agents) {
    const t = agentTargets(agent);
    const base = o.global ? t.global : t.project;
    for (const root of roots) {
          for (const skillDir of findSkillDirs(root.dir, root.source === "handmade" ? 1 : 4)) {
        let name = path.basename(skillDir);
        if (used.has(agent + ":" + name)) name = `${root.source}-${path.basename(skillDir)}`;
        used.add(agent + ":" + name);
        // Cursor keeps flat rule files; everyone else gets a folder per skill.
        const destDir = t.flat ? base : path.join(base, name);
        mkdirSync(destDir, { recursive: true });
        if (t.flat) {
          copyFileSync(path.join(skillDir, "SKILL.md"), path.join(destDir, t.file(name)));
        } else {
          cpSync(skillDir, destDir, { recursive: true });
        }
        const dest = path.join(destDir, t.flat ? t.file(name) : "SKILL.md");
        log.ok(`${agent}: ${dest}`);
        installed.push(dest);
      }
    }
  }
  log.blank();
  log.dim("  OSS licenses travel with their folders — respect them. Paths follow");
  log.dim("  each agent's conventional layout — move files if yours differs.");
  return { installed };
}
