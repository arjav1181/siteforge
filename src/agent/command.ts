import path from "node:path";
import { log, setJsonMode } from "../log.js";
import { banner, panel, table } from "../ui/render.js";
import { style, glyph } from "../ui/color.js";
import { out } from "../ui/stream.js";
import { commandExists } from "../util.js";
import { AGENTS, PRIMARY_AGENTS, findAgent, buildInvocation } from "./registry.js";
import { detectAgents, pickAgent, resolveBin } from "./detect.js";
import { buildPrompt } from "./prompt.js";
import { runHandoff } from "./handoff.js";

export const AGENT_HELP = `siteforge agent — hand a job to your coding agent, with this
toolkit already in its head.

Usage:
  siteforge agent list
  siteforge agent "<task>"
  siteforge agent prompt "<task>"          show the briefing, run nothing
  siteforge agent "<task>" --dry-run       show the command, run nothing

Options:
  --agent <id>      claude | opencode | codex | gemini | aider | cursor | pi
  --dir <path>      project directory (default: current)
  --model <name>    pass a model through
  --read-only       plan only; the agent may not create or edit files
  --no-context      send the bare task with no toolkit briefing
  --headless        run one task and exit, instead of opening a session
  --no-stream       don't render live progress (headless only)
  --dry-run         print the command, run nothing

Opens the agent's own session with the task already loaded, so you pick up the
conversation from there. Claude Code, OpenCode and Codex are first-class.

Examples:
  siteforge agent "build me a landing page for a coffee roastery"
  siteforge agent "add a pricing section" --agent opencode --dir my-site
  siteforge agent "audit the mobile overflow and fix it" --agent codex
  siteforge agent "what is broken here?" --read-only
  siteforge agent "build me a site" --headless --no-stream
`;

export type AgentAction = "list" | "run" | "prompt";

export interface AgentOptions {
  action: AgentAction;
  task: string;
  agent: string | null;
  dir: string;
  model: string | null;
  write: boolean;
  context: boolean;
  interactive: boolean;
  stream: boolean;
  dryRun: boolean;
  cwd: string;
}

export function parseAgentCmdArgs(argv: string[]): AgentOptions {
  const o: AgentOptions = {
    action: "list",
    task: "",
    agent: null,
    dir: ".",
    model: null,
    write: true,
    context: true,
    interactive: true,
    stream: true,
    dryRun: false,
    cwd: process.cwd(),
  };
  const positional: string[] = [];
  let sawPrompt = false;
  let sawList = false;
  let sawFlag = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    if (a === "list") sawList = true;
    else if (a === "prompt") sawPrompt = true;
    else if (a === "--agent") { o.agent = next(); sawFlag = true; }
    else if (a === "--dir") { o.dir = next(); sawFlag = true; }
    else if (a === "--model") { o.model = next(); sawFlag = true; }
    else if (a === "--read-only" || a === "--no-write") { o.write = false; sawFlag = true; }
    else if (a === "--no-context") { o.context = false; sawFlag = true; }
    else if (a === "--headless") { o.interactive = false; sawFlag = true; }
    else if (a === "--no-stream") { o.stream = false; sawFlag = true; }
    else if (a === "--dry-run") { o.dryRun = true; sawFlag = true; }
    else if (a.startsWith("-")) throw new Error(`Unknown option for agent: ${a}`);
    else positional.push(a);
  }
  o.task = positional.join(" ").trim();

  // `siteforge agent` with nothing, or with `list`, shows what is installed.
  // Anything else was meant to do something, so a missing task is an error
  // rather than a silent fallthrough to the list.
  if (sawPrompt) o.action = "prompt";
  else if (sawList || (!o.task && !sawFlag)) o.action = "list";
  else o.action = "run";

  if (o.action === "prompt" && !o.task) throw new Error('Missing <task>. Usage: siteforge agent prompt "<task>"');
  if (o.action === "run" && !o.task) throw new Error('Missing <task>. Usage: siteforge agent "<task>"');
  return o;
}


export interface AgentRunResult {
  agent?: string;
  bin?: string;
  command?: string;
  cwd: string;
  task: string;
  code: number;
  sessionId?: string;
  cost?: number;
  error?: string;
  output?: string;
  ms?: number;
}

export async function runAgent(o: AgentOptions): Promise<AgentRunResult> {
  const cwd = path.resolve(o.cwd, o.dir);

  // ── list ──
  if (o.action === "list") {
    const installed = detectAgents();
    banner("Coding agents", `${installed.length} of ${AGENTS.length} available on this machine`);
    if (!installed.length) {
      log.warn("No coding agents found on PATH.");
      log.blank();
      log.dim("  Install one of:");
      for (const a of PRIMARY_AGENTS) log.dim(`    ${a.name.padEnd(14)} ${a.install}`);
      log.blank();
      return { cwd, task: "", code: 0 };
    }
    const rows: string[][] = [];
    for (const a of AGENTS) {
      const has = installed.some((i) => i.id === a.id);
      rows.push([
        a.id.padEnd(9),
        has ? style.green("● installed") : style.gray("○ not found"),
        a.primary ? style.cyan("primary") : "",
        style.gray(a.install),
      ]);
    }
    out().write(`\n${table(["AGENT", "STATUS", "", "INSTALL"], rows)}\n\n`);
    log.dim(`  Hand off with: siteforge agent run "<task>"${installed.length ? `  (defaults to ${pickAgent(null, installed)?.id})` : ""}`);
    log.blank();
    return { cwd, task: "", code: 0 };
  }

  // ── resolve the agent ──
  const installed = detectAgents();
  const spec = pickAgent(o.agent, installed);
  if (o.agent && !spec) {
    const named = findAgent(o.agent);
    if (named) throw new Error(`"${o.agent}" (${named.name}) is not installed. Install it with: ${named.install}`);
    throw new Error(
      `Unknown agent "${o.agent}". Choose one of: ${AGENTS.map((a) => a.id).join(", ")}`,
    );
  }
  if (!spec) {
    throw new Error(
      `No coding agent found on PATH. Install one of:\n${PRIMARY_AGENTS.map((a) => `  ${a.name.padEnd(14)} ${a.install}`).join("\n")}`,
    );
  }
  const bin = resolveBin(spec);
  if (!bin) throw new Error(`Could not resolve an executable for ${spec.name}. Is it still on PATH?`);

  const promptOpts = { task: o.task, cwd, context: o.context, projectContext: true };

  // ── prompt: show the briefing, run nothing ──
  if (o.action === "prompt") {
    const prompt = buildPrompt(promptOpts);
    banner(`Briefing for ${spec.name}`, `${cwd}`);
    out().write(`\n${panel(spec.name, prompt.split("\n"))}\n\n`);
    log.dim(`  send it with: siteforge agent "${o.task.slice(0, 40)}${o.task.length > 40 ? "…" : ""}" --agent ${spec.id}`);
    log.blank();
    return { agent: spec.id, cwd, task: o.task, code: 0 };
  }

  // ── dry run: show the command, run nothing ──
  if (o.dryRun) {
    const { bin, args } = buildInvocation(spec, buildPrompt(promptOpts), {
      interactive: o.interactive,
      write: o.write,
      model: o.model ?? undefined,
    });
    const shown = args.map((a) => (a.includes("\n") ? `"<${a.split("\n").length}-line briefing>"` : a));
    banner(spec.name, o.interactive ? "opens a session — nothing was executed" : "headless — nothing was executed");
    out().write(`\n${panel("command", [`${bin} ${shown.join(" ")}`])}\n\n`);
    log.dim(`  briefing: ${o.context ? "toolkit + house style" : "bare task"}`);
    log.dim(`  files:    ${o.write ? "may be created and edited" : "read-only"}`);
    log.dim(`  mode:     ${o.interactive ? "interactive session" : "headless, one task"}`);
    log.blank();
    return { agent: spec.id, bin, cwd, task: o.task, code: 0 };
  }

  // ── hand off ──
  banner(`Handing off to ${spec.name}`, `${spec.primary ? style.cyan("primary") : "secondary"} · ${o.task.slice(0, 60)}${o.task.length > 60 ? "…" : ""}`);
  if (o.interactive) {
    log.dim("Opening their session — pick the conversation up there.");
    log.blank();
  }
  log.blank();

  const r = await runHandoff({
    ...promptOpts,
    spec,
    bin,
    interactive: o.interactive,
    write: o.write,
    model: o.model ?? undefined,
    stream: o.stream,
  });

  log.blank();
  if (r.interactive) {
    if (r.code === 0) log.ok(`${spec.name} session ended cleanly`);
    else log.err(`${spec.name} exited ${r.code}${r.error ? `: ${r.error}` : ""}`);
  } else if (r.code === 0) {
    log.ok(`${spec.name} finished · ${(r.ms / 1000).toFixed(1)}s${r.sessionId ? style.gray(`  session ${r.sessionId}`) : ""}${r.cost !== undefined ? style.gray(`  $${r.cost.toFixed(4)}`) : ""}`);
  } else {
    log.err(`${spec.name} exited ${r.code}${r.error ? `: ${r.error}` : ""}`);
  }
  log.blank();

  return {
    agent: r.agent,
    cwd,
    task: r.task,
    code: r.code,
    sessionId: r.sessionId,
    cost: r.cost,
    error: r.error,
    output: r.output,
    ms: r.ms,
  };
}