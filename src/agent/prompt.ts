/**
 * The briefing handed to the agent.
 *
 * Anyone can shell out to `claude "do my laundry"`. What an agent cannot know on
 * its own is that this toolkit exists, what its commands are called, which
 * skills were just installed for it, and what the house style is. This file is
 * where that goes — it is the actual product of the handoff.
 *
 * Pure and exported so the exact text is unit tested. A handoff prompt is
 * invisible when it is wrong, which makes it precisely the kind of thing that
 * needs a test rather than a code review.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { listBundledSkills } from "../skills/command.js";

export interface PromptOptions {
  task: string;
  cwd: string;
  /** Include the toolkit briefing. */
  context: boolean;
  /** Include the project's own AGENTS.md / CLAUDE.md, if it has one. */
  projectContext: boolean;
}

/** Long enough for any real request, short enough not to crowd the context. */
const MAX_TASK = 8000;

/** What the agent can see of this repo. Pure, so it is testable. */
export function detectProjectFacts(cwd: string): { stack: string[]; hasGit: boolean; isEmpty: boolean } {
  const has = (f: string) => existsSync(path.join(cwd, f));
  const stack: string[] = [];
  if (has("bun.lock") || has("bun.lockb")) stack.push("bun");
  if (has("package-lock.json")) stack.push("npm");
  if (has("pnpm-lock.yaml")) stack.push("pnpm");
  if (has("next.config.js") || has("next.config.mjs") || has("next.config.ts")) stack.push("next");
  if (has("tailwind.config.js") || has("tailwind.config.ts")) stack.push("tailwind");
  if (has("tsconfig.json")) stack.push("typescript");
  return {
    stack,
    hasGit: has(".git"),
    // A directory with no package.json is almost always a fresh site waiting
    // to be scaffolded, which changes which command should go first.
    isEmpty: !has("package.json"),
  };
}

function readProjectInstructions(cwd: string, limit = 4000): string | null {
  for (const name of ["AGENTS.md", "CLAUDE.md", "FORGE.md"]) {
    const f = path.join(cwd, name);
    if (!existsSync(f)) continue;
    try {
      const text = readFileSync(f, "utf8").trim();
      if (!text) continue;
      return text.length > limit ? `${text.slice(0, limit)}\n…(truncated)` : text;
    } catch {
      continue;
    }
  }
  return null;
}

/** Toolkit commands, grouped by the phase of a build they belong to. */
const FLOW: [string, [string, string][]][] = [
  [
    "1. Scaffold",
    [
      ["siteforge init --video <clip> --dir <dir> --headline \"…\"", "guided site: video background + sections + FX"],
      ["siteforge video <clip> <dir>", "a video turned into a scroll-driven Next.js site"],
      ["siteforge demo <dir>", "instant sample site, nothing to prepare"],
    ],
  ],
  [
    "2. Compose",
    [
      ["siteforge add <section>", "hero, navbar, about, work, skills, experience, contact, pricing, faq, testimonials, gallery, features, cta, logos"],
      ["siteforge fx <effect>", "cursor, badge, progress, reveal, favicon, smooth, marquee, preloader, magnetic"],
      ["siteforge 3d <preset>", "particle, terrain, shapes, orb, GLB model"],
    ],
  ],
  [
    "3. Assets",
    [
      ["siteforge assets <dir>", "batch-compress images in place — --dry-run first"],
      ["siteforge dewatermark <path>", "solve watermarks out of images, frame dirs and video"],
    ],
  ],
  [
    "4. Verify and ship",
    [
      ["npm run dev", "run the site locally"],
      ["siteforge audit http://localhost:3000 --fix", "overflow, meta/alt/console/weight — --fix repairs"],
      ["siteforge record <url> --out demo.mp4", "30fps demo video + poster"],
      ["siteforge shot <url> --out x.png", "screenshots"],
      ["siteforge ship --repo <name>", "commit, create the GitHub repo, push"],
    ],
  ],
];

/** House style, so the agent does not have to guess what "good" means here. */
const STYLE = `\
- Tailwind only; no CSS frameworks, no component libraries beyond what init writes.
- 4:4:4 chroma end to end — no subsampling blocks on gradients.
- One idea per section, generous vertical rhythm, mobile-first.
- Real content, not lorem ipsum. Ask the user for the headline, links and copy
  if they were not in the task, rather than inventing a fake company.
- Run \`siteforge audit --fix\` before you call it done, and check it is clean.`;

export function buildPrompt(o: PromptOptions): string {
  const task = o.task.trim().slice(0, MAX_TASK);
  if (!o.context) return task;

  const facts = detectProjectFacts(o.cwd);
  const L: string[] = [];

  L.push(`You are working in ${o.cwd}.`);
  if (facts.stack.length) L.push(`Already set up: ${facts.stack.join(", ")}.`);
  if (!facts.hasGit) L.push("Not a git repository yet — `siteforge ship` will create one.");
  if (facts.isEmpty) L.push("This directory is empty, so scaffold from scratch with `siteforge init`.");
  L.push("");

  L.push("## The toolkit");
  L.push("SiteForge is installed (`siteforge`). Build with it instead of writing a site from scratch:");
  for (const [phase, cmds] of FLOW) {
    L.push("");
    L.push(`**${phase}**`);
    const w = Math.max(...cmds.map(([c]) => c.length));
    for (const [c, d] of cmds) L.push(`  ${c.padEnd(w)}  ${d}`);
  }
  L.push("");
  L.push("Every command takes `--help`, and `--json` for machine-readable output.");
  L.push("Read the skill before using a command — each carries the recipe and the pitfalls:");
  L.push("");

  const skills = listBundledSkills().sort();
  for (const s of skills) L.push(`  - ${s}`);
  L.push("");

  const instructions = o.projectContext ? readProjectInstructions(o.cwd) : null;
  if (instructions) {
    L.push("## Project conventions");
    L.push(instructions);
    L.push("");
  }

  L.push("## House style");
  L.push(STYLE);
  L.push("");

  L.push("## Task");
  L.push(task);
  return L.join("\n");
}