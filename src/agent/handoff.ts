/**
 * Running the handoff.
 *
 * Interactive is the default and the reason this command exists: the agent's
 * own session opens with the task already loaded, and the user talks to it from
 * there. SiteForge's job ends the moment the session opens.
 *
 * `--headless` is the other shape — one task, output captured — for scripts and
 * CI. It has to guess at each agent's event format, so the raw lines are always
 * kept: the pretty view is a rendering of what happened, never the only record.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { TaskList, spinner, duration } from "../ui/render.js";
import { style, glyph } from "../ui/color.js";
import { out, canAnimate } from "../ui/stream.js";
import {
  buildInvocation,
  parseAgentEvent,
  parseAgentMeta,
  type AgentSpec,
  type InvocationOptions,
} from "./registry.js";
import { buildPrompt, type PromptOptions } from "./prompt.js";

export interface HandoffResult {
  agent: string;
  task: string;
  cwd: string;
  code: number;
  interactive: boolean;
  sessionId?: string;
  cost?: number;
  error?: string;
  /** Text the agent produced, as far as it could be extracted. */
  output: string;
  /** Every streamed line, verbatim. */
  raw: string[];
  ms: number;
}

export interface HandoffOptions extends PromptOptions, InvocationOptions {
  spec: AgentSpec;
  /** Absolute path to the resolved executable. */
  bin: string;
  /** Render live progress (headless only — an interactive session owns the TTY). */
  stream: boolean;
}

export async function runHandoff(o: HandoffOptions): Promise<HandoffResult> {
  const prompt = buildPrompt(o);
  const { args } = buildInvocation(o.spec, prompt, o);
  const started = Date.now();

  const base = { agent: o.spec.id, task: o.task, cwd: o.cwd, interactive: o.interactive, raw: [] as string[], output: "" };

  // ── interactive: hand the terminal straight over and get out of the way ──
  if (o.interactive) {
    const child = spawn(o.bin, args, { cwd: o.cwd, stdio: "inherit", env: process.env });
    const code = await new Promise<number>((resolve) => {
      // 'error' fires when the binary does not exist. Without this listener the
      // promise would never settle and the CLI would hang forever.
      child.on("error", (e: NodeJS.ErrnoException) => resolve(e.code === "ENOENT" ? 127 : 1));
      child.on("close", (c) => resolve(c ?? 1));
    });
    return { ...base, code, ms: Date.now() - started };
  }

  // ── headless: capture and parse ──
  const rendered: string[] = [];
  const raw: string[] = [];
  const emit = (text: string) => {
    if (!text) return;
    rendered.push(text);
    if (o.stream) {
      const s = out();
      const lines = text.split("\n");
      // Erase the task line before writing prose, then redraw it, so a stream
      // of tokens does not shred the task list.
      if (canAnimate()) s.write("\r\x1b[2K");
      for (const line of lines) s.write(`${style.gray(glyph.arrow)} ${line}\n`);
      if (canAnimate()) s.write(`\x1b[${lines.length}A`);
    }
  };

  const tasks = o.stream ? new TaskList() : null;
  const task = tasks?.add(`handing off to ${o.spec.name}`);
  const spin = o.stream && !canAnimate() ? spinner(`handing off to ${o.spec.name}`) : null;

  const child = spawn(o.bin, args, { cwd: o.cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env });

  // Race a spawn failure against the pipes instead of iterating a stdout that
  // may never end. Awaiting one stream and then the other deadlocks as soon as
  // the child fills the other's pipe buffer.
  const finished = new Promise<number>((resolve) => {
    child.on("error", (e: NodeJS.ErrnoException) => resolve(e.code === "ENOENT" ? 127 : 1));
    child.on("close", (c) => resolve(c ?? 1));
  });

  let stderr = "";
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (d: string) => { stderr += d; });

  if (child.stdout) {
    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    for await (const line of rl) {
      raw.push(line);
      // Two different "I don't recognise this" cases, and they must be treated
      // differently. A line that is not JSON at all is the agent talking to us
      // — show it, or the user sees nothing and assumes a hang. A line that IS
      // JSON is an event we chose not to render (session init, usage rollups);
      // those stay quiet.
      let isJson = true;
      try {
        JSON.parse(line);
      } catch {
        isJson = false;
      }
      const shown = isJson ? parseAgentEvent(o.spec, line) : line;
      if (shown) emit(shown);
    }
  }

  const code = await finished;
  const meta = parseAgentMeta(o.spec, raw);
  const ms = Date.now() - started;

  if (spin) {
    if (code === 0) spin.ok(`${o.spec.name} finished in ${duration(ms)}`);
    else spin.fail(`${o.spec.name} exited ${code}`);
  }
  if (task && tasks) {
    if (code === 0) tasks.done(task, `${o.spec.name} finished`, duration(ms));
    else tasks.fail(task, `${o.spec.name} exited ${code}`);
    tasks.end();
  }

  const tail = stderr.trim().split("\n").filter(Boolean).slice(-1)[0];
  const error = meta.error ?? (code === 0 ? undefined : tail ?? `exit ${code}`);

  return { ...base, code, sessionId: meta.sessionId, cost: meta.cost, error, output: rendered.join("\n"), raw, ms };
}