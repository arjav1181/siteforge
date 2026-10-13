/**
 * Which agents are actually installed.
 *
 * Detection is a PATH lookup per agent, cached for the life of the process:
 * `siteforge agent list` would otherwise shell out once per agent on every
 * invocation, which is the slowest thing a CLI that advertises itself as fast
 * can do.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AGENTS, type AgentSpec, PRIMARY_AGENTS } from "./registry.js";

const execFileAsync = promisify(execFile);

let cache: AgentSpec[] | null = null;

/** Pure test seam: resolves an executable name to an absolute path, or null. */
export type Resolver = (bin: string) => string | null;

/**
 * Walk PATH looking for an executable.
 *
 * Deliberately hand-rolled rather than shelling out to `which`: spawning a
 * process per agent is the expensive version of this question, and the answer
 * is just a filename search.
 */
export const defaultResolver: Resolver = (bin) => {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const exts = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const full = path.join(dir, bin + ext);
      try {
        if (existsSync(full)) return full;
      } catch {
        // Unreadable PATH entry — keep looking rather than give up.
      }
    }
  }
  return null;
};

/** Every known agent, resolved. Cached after the first call. */
export function detectAgents(resolver: Resolver = defaultResolver): AgentSpec[] {
  if (cache && resolver === defaultResolver) return cache;
  const found = AGENTS.filter((a) => resolver(a.bin) || Boolean(a.aliases?.some((al) => resolver(al))));
  if (resolver === defaultResolver) cache = found;
  return found;
}

/**
 * Pick which agent to use.
 *
 * Preference order is the explicit request, then the primary three in registry
 * order, then anything else installed. Returning null rather than throwing
 * lets the caller print the install line for the specific agent the user named.
 */
export function pickAgent(requested: string | null, available: AgentSpec[]): AgentSpec | null {
  if (requested) {
    const key = requested.toLowerCase();
    return (
      available.find((a) => a.id === key || a.bin === key || a.name.toLowerCase().replace(/\s+/g, "-") === key) ?? null
    );
  }
  return PRIMARY_AGENTS.find((a) => available.some((b) => b.id === a.id)) ?? available[0] ?? null;
}

/** Test hook: drop the memoised detection result. */
export function resetDetectionCache(): void {
  cache = null;
}

/** Resolve an agent to its absolute executable path, or null. */
export function resolveBin(spec: AgentSpec, resolver: Resolver = defaultResolver): string | null {
  if (resolver(spec.bin)) return resolver(spec.bin);
  for (const al of spec.aliases ?? []) {
    const hit = resolver(al);
    if (hit) return hit;
  }
  return null;
}

/** Exported for the doctor command's environment report. */
export async function agentVersion(spec: AgentSpec, bin: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(bin, ["--version"], { timeout: 5000 });
    return stdout.trim().split("\n")[0] ?? null;
  } catch {
    return null;
  }
}