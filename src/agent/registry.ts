/**
 * The coding agents SiteForge can hand work to.
 *
 * Claude Code, OpenCode and Codex come first because they are what people
 * actually use, and because all three can open an interactive session with a
 * prompt already loaded — which is the whole feature. The rest are best-effort.
 *
 * Every invocation here was read off the installed CLI's own `--help`, not
 * guessed. These flags move between releases, and a silently wrong flag is worse
 * than an agent SiteForge refuses to drive.
 */

export type AgentId = "claude" | "opencode" | "codex" | "gemini" | "aider" | "cursor" | "pi";

export interface AgentSpec {
  id: AgentId;
  name: string;
  /** Executable to find on PATH. */
  bin: string;
  /** Secondary names that also count as installed. */
  aliases?: string[];
  install: string;
  docs: string;
  /** First-class: detected, streamed, write access wired correctly. */
  primary: boolean;
  /** Can the agent be told not to touch files? */
  readOnly: boolean;
}

export const AGENTS: AgentSpec[] = [
  { id: "claude", name: "Claude Code", bin: "claude", install: "npm i -g @anthropic-ai/claude-code", docs: "https://code.claude.com/docs/en/cli-reference", primary: true, readOnly: true },
  { id: "opencode", name: "OpenCode", bin: "opencode", install: "npm i -g opencode-ai", docs: "https://opencode.ai/docs/cli/", primary: true, readOnly: true },
  { id: "codex", name: "Codex", bin: "codex", install: "npm i -g @openai/codex", docs: "https://developers.openai.com/codex/cli/reference", primary: true, readOnly: true },
  { id: "gemini", name: "Gemini CLI", bin: "gemini", install: "npm i -g @google/gemini-cli", docs: "https://github.com/google-gemini/gemini-cli", primary: false, readOnly: false },
  { id: "aider", name: "Aider", bin: "aider", install: "pip install aider-install && aider-install", docs: "https://aider.chat/docs/usage.html", primary: false, readOnly: false },
  { id: "cursor", name: "Cursor Agent", bin: "cursor-agent", install: "curl https://cursor.com/install -fsS | bash", docs: "https://docs.cursor.com/en/cli/reference", primary: false, readOnly: false },
  { id: "pi", name: "Pi", bin: "pi", install: "see your Pi install", docs: "https://pi.dev", primary: false, readOnly: false },
];

export const PRIMARY_AGENTS = AGENTS.filter((a) => a.primary);

export function findAgent(id: string): AgentSpec | undefined {
  const key = id.trim().toLowerCase();
  return AGENTS.find(
    (a) => a.id === key || a.bin === key || a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === key,
  );
}

export interface InvocationOptions {
  /** Open the agent's own session so the user can talk to it. Default. */
  interactive: boolean;
  /** Let it create and edit files. */
  write: boolean;
  model?: string;
}

export interface Invocation {
  bin: string;
  args: string[];
}

/**
 * Build the exact command that opens (or runs) the agent.
 *
 * The two shapes are genuinely different CLIs, not two moods of one CLI:
 *
 *   interactive  `claude "<prompt>"`            → a session you talk to
 *               `opencode --prompt "<prompt>"`
 *               `codex "<prompt>"`
 *   headless     `claude -p "<prompt>"`         → one task, output captured
 *               `opencode run "<prompt>"`
 *               `codex exec "<prompt>"`
 */
export function buildInvocation(spec: AgentSpec, prompt: string, o: InvocationOptions): Invocation {
  const canWrite = o.write;
  switch (spec.id) {
    case "claude": {
      const args = [o.interactive ? prompt : "-p", ...(o.interactive ? [] : [prompt])];
      if (o.model) args.push("--model", o.model);
      // acceptEdits takes file edits without prompting but still asks before
      // shell commands. Handing over an edit is not handing over the machine.
      args.push("--permission-mode", canWrite ? "acceptEdits" : "plan");
      if (!o.interactive) args.push("--output-format", "stream-json", "--verbose");
      return { bin: spec.bin, args };
    }
    case "opencode": {
      const args = o.interactive ? ["--prompt", prompt] : ["run", prompt];
      if (o.model) args.push("--model", o.model);
      if (canWrite) args.push("--auto");
      if (!o.interactive) args.push("--format", "json");
      return { bin: spec.bin, args };
    }
    case "codex": {
      // `codex exec` defaults to a read-only sandbox, so an agent asked to
      // build something would fail on its first write without this.
      const args = o.interactive ? [] : ["exec"];
      if (o.model) args.push("--model", o.model);
      if (!o.interactive) args.push("--sandbox", canWrite ? "workspace-write" : "read-only");
      if (!o.interactive) args.push("--json");
      args.push(prompt);
      return { bin: spec.bin, args };
    }
    case "gemini":
      return { bin: spec.bin, args: [canWrite ? "-y" : "-p", prompt] };
    case "aider":
      return { bin: spec.bin, args: ["--no-auto-commits", "--message", prompt] };
    case "cursor":
      return { bin: spec.bin, args: ["--print", prompt] };
    case "pi":
      return { bin: spec.bin, args: ["-p", prompt] };
  }
}

/**
 * Best-effort text extraction from one streamed line, for `--headless`.
 *
 * These event shapes change between agent releases and none of them are
 * versioned, so every parser returns null rather than guessing. The raw lines
 * are always kept alongside, which is what makes `--json` trustworthy even
 * when the pretty view has nothing to show.
 */
export function parseAgentEvent(spec: AgentSpec, line: string): string | null {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (spec.id === "claude") {
    const type = j.type as string | undefined;
    if (type === "assistant" || type === "user") {
      const blocks = (j.message as { content?: unknown } | undefined)?.content;
      if (!Array.isArray(blocks)) return null;
      const out: string[] = [];
      for (const b of blocks as { type?: string; name?: string; text?: string; content?: unknown }[]) {
        if (b.type === "text") {
          const t = typeof b.text === "string" ? b.text : typeof b.content === "string" ? b.content : "";
          if (t.trim()) out.push(t.trim());
        } else if (b.type === "tool_use" && b.name) out.push(`⚙ ${b.name}`);
      }
      return out.length ? out.join("\n") : null;
    }
    if (type === "result") {
      const text = typeof j.result === "string" ? j.result.trim() : "";
      if (text) return text;
      return typeof j.total_cost_usd === "number" ? `done · $${j.total_cost_usd.toFixed(4)}` : "done";
    }
    return null;
  }
  if (spec.id === "codex") {
    const msg = (j.msg ?? j) as { type?: string; content?: unknown };
    return msg.type === "text" && typeof msg.content === "string" && msg.content.trim()
      ? msg.content.trim()
      : null;
  }
  if (spec.id === "opencode") {
    // Verified against `opencode run --format json`, which emits events shaped
    // {type, timestamp, sessionID, part:{type, text}}. The text lives at
    // `part.text`, not at the top level — so a parser that looks for `text` at
    // the root renders nothing at all. Session id is `sessionID`, camel with a
    // capital D, which no snake_case guess would have found.
    const part = j.part as { type?: string; text?: string; tool?: string; state?: { status?: string } } | undefined;
    if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) return part.text.trim();
    if (part?.type === "tool" && part.tool) {
      const status = part.state?.status;
      return `⚙ ${part.tool}${status && status !== "completed" ? ` (${status})` : ""}`;
    }
    // Tolerate the flat shapes some versions and wrappers emit.
    const flat = (j.text ?? j.content) as unknown;
    return typeof flat === "string" && flat.trim() ? flat.trim() : null;
  }
  return null;
}

/** Session id, cost and error, when the agent happens to report them. */
export function parseAgentMeta(spec: AgentSpec, lines: string[]): { sessionId?: string; cost?: number; error?: string } {
  const meta: { sessionId?: string; cost?: number; error?: string } = {};
  for (const raw of lines) {
    let j: Record<string, unknown>;
    try {
      j = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }
    const sid = j.session_id ?? j.sessionId ?? j.sessionID ?? j.thread_id ?? (j.msg as { thread_id?: string } | undefined)?.thread_id;
    if (typeof sid === "string") meta.sessionId = sid;
    const cost = j.total_cost_usd ?? j.cost_usd;
    if (typeof cost === "number") meta.cost = cost;
    if (spec.id === "claude" && j.type === "result" && j.is_error) {
      meta.error = typeof j.result === "string" ? j.result : "the agent reported an error";
    }
    if (spec.id === "codex" && (j.msg as { type?: string } | undefined)?.type === "error") {
      meta.error = typeof j.error === "string" ? j.error : "codex reported an error";
    }
  }
  return meta;
}