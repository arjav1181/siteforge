import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AGENTS,
  PRIMARY_AGENTS,
  findAgent,
  buildInvocation,
  parseAgentEvent,
  parseAgentMeta,
} from "../src/agent/registry.js";
import { detectAgents, pickAgent, resolveBin, resetDetectionCache } from "../src/agent/detect.js";
import { buildPrompt, detectProjectFacts } from "../src/agent/prompt.js";
import { parseAgentCmdArgs } from "../src/agent/command.js";
import { runHandoff } from "../src/agent/handoff.js";

const spec = (id: string) => {
  const s = findAgent(id);
  if (!s) throw new Error(`no spec for ${id}`);
  return s;
};

describe("agent registry", () => {
  it("puts claude, opencode and codex first", () => {
    expect(PRIMARY_AGENTS.map((a) => a.id)).toEqual(["claude", "opencode", "codex"]);
  });

  it("resolves ids, binaries and names", () => {
    expect(findAgent("claude")?.id).toBe("claude");
    expect(findAgent("Claude-Code")?.id).toBe("claude");
    expect(findAgent("cursor-agent")?.id).toBe("cursor");
    expect(findAgent("nope")).toBeUndefined();
  });
});

describe("interactive invocation — the default path", () => {
  const on = { interactive: true, write: true } as const;

  it("claude opens a session with the task as a positional prompt", () => {
    const { bin, args } = buildInvocation(spec("claude"), "build me a site", on);
    expect(bin).toBe("claude");
    expect(args[0]).toBe("build me a site");
    // Interactive mode must NOT use -p, which would print and exit instead.
    expect(args).not.toContain("-p");
    expect(args).not.toContain("--print");
    expect(args[args.indexOf("--permission-mode") + 1]).toBe("acceptEdits");
  });

  it("opencode opens a session with --prompt", () => {
    const { args } = buildInvocation(spec("opencode"), "build me a site", on);
    expect(args[0]).toBe("--prompt");
    expect(args[1]).toBe("build me a site");
    expect(args).toContain("--auto");
    expect(args).not.toContain("run");
  });

  it("codex opens its TUI with the task as a positional prompt", () => {
    const { args } = buildInvocation(spec("codex"), "build me a site", on);
    expect(args[args.length - 1]).toBe("build me a site");
    expect(args).not.toContain("exec");
  });

  it("read-only switches each agent to its plan mode", () => {
    const ro = { interactive: true, write: false } as const;
    expect(buildInvocation(spec("claude"), "t", ro).args).toContain("plan");
    expect(buildInvocation(spec("opencode"), "t", ro).args).not.toContain("--auto");
  });

  it("never reaches for a blanket permission bypass", () => {
    for (const id of ["claude", "opencode", "codex"]) {
      const flat = buildInvocation(spec(id), "t", on).args.join(" ");
      expect(flat, id).not.toContain("bypassPermissions");
      expect(flat, id).not.toContain("danger-full-access");
      expect(flat, id).not.toContain("yolo");
    }
  });
});

describe("headless invocation", () => {
  const hl = { interactive: false, write: true } as const;

  it("claude prints and exits, pairing stream-json with --verbose", () => {
    // stream-json without --verbose is rejected outright by Claude Code, so
    // the pairing is load-bearing, not cosmetic.
    const { args } = buildInvocation(spec("claude"), "do it", hl);
    expect(args[0]).toBe("-p");
    expect(args[1]).toBe("do it");
    expect(args[args.indexOf("--output-format") + 1]).toBe("stream-json");
    expect(args).toContain("--verbose");
  });

  it("codex asks for a writable sandbox, since exec defaults to read-only", () => {
    const { args } = buildInvocation(spec("codex"), "do it", hl);
    expect(args[0]).toBe("exec");
    expect(args[args.indexOf("--sandbox") + 1]).toBe("workspace-write");
    expect(args).toContain("--json");
  });

  it("opencode uses run", () => {
    expect(buildInvocation(spec("opencode"), "t", hl).args[0]).toBe("run");
  });
});

describe("shared", () => {
  it("passes a model through to every primary agent", () => {
    for (const id of ["claude", "opencode", "codex"]) {
      for (const interactive of [true, false]) {
        const { args } = buildInvocation(spec(id), "t", { interactive, write: true, model: "some-model" });
        expect(args.join(" "), `${id}/${interactive}`).toContain("some-model");
      }
    }
  });

  it("keeps a multi-line briefing as one argument", () => {
    const prompt = "line one\nline two\nline three";
    for (const id of ["claude", "opencode", "codex"]) {
      for (const interactive of [true, false]) {
        const { args } = buildInvocation(spec(id), prompt, { interactive, write: true });
        expect(args.filter((a) => a.includes("line one")), `${id}/${interactive}`).toHaveLength(1);
      }
    }
  });
});

describe("agent event parsing", () => {
  const claude = spec("claude");

  it("reads assistant text and tool calls", () => {
    expect(
      parseAgentEvent(claude, JSON.stringify({ type: "assistant", message: { content: [{ type: "text", content: "working on it" }] } })),
    ).toBe("working on it");
    expect(
      parseAgentEvent(claude, JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Edit" }] } })),
    ).toBe("⚙ Edit");
  });

  it("summarises the final result and its cost", () => {
    expect(parseAgentEvent(claude, JSON.stringify({ type: "result", result: "all done" }))).toBe("all done");
    expect(parseAgentEvent(claude, JSON.stringify({ type: "result", total_cost_usd: 0.1234 }))).toContain("$0.1234");
  });

  it("returns null for anything it does not understand", () => {
    expect(parseAgentEvent(claude, "not json")).toBeNull();
    expect(parseAgentEvent(claude, JSON.stringify({ type: "system", subtype: "init" }))).toBeNull();
    expect(parseAgentEvent(claude, JSON.stringify({ type: "assistant", message: { content: [] } }))).toBeNull();
  });

  it("reads codex text events", () => {
    expect(parseAgentEvent(spec("codex"), JSON.stringify({ msg: { type: "text", content: "hello" } }))).toBe("hello");
  });

  // Captured verbatim from `opencode run "Reply with exactly: ok" --format json`.
  // Synthetic fixtures would have reproduced the parser's own wrong assumptions;
  // these are what the CLI actually emits.
  describe("opencode, against real captured output", () => {
    const STEP_START =
      '{"type":"step_start","timestamp":1791907774533,"sessionID":"ses_ec9f96395ffeYthL6N8ur86ncA","part":{"id":"prt_1","sessionID":"ses_ec9f96395ffeYthL6N8ur86ncA","messageID":"msg_1","type":"step-start"}}';
    const TEXT =
      '{"type":"text","timestamp":1791907774578,"sessionID":"ses_ec9f96395ffeYthL6N8ur86ncA","part":{"id":"prt_1_text-0","sessionID":"ses_ec9f96395ffeYthL6N8ur86ncA","messageID":"msg_1","type":"text","text":"ok","time":{"start":1791907773094,"end":1791907774578}}}';
    const TOOL =
      '{"type":"tool","part":{"type":"tool","tool":"edit","state":{"status":"running"}}}';

    it("reads text out of part.text", () => {
      expect(parseAgentEvent(spec("opencode"), TEXT)).toBe("ok");
    });

    it("stays quiet on events it has nothing to render", () => {
      expect(parseAgentEvent(spec("opencode"), STEP_START)).toBeNull();
    });

    it("renders tool calls", () => {
      expect(parseAgentEvent(spec("opencode"), TOOL)).toBe("⚙ edit (running)");
    });

    it("finds sessionID — camel with a capital D", () => {
      expect(parseAgentMeta(spec("opencode"), [STEP_START, TEXT]).sessionId).toBe("ses_ec9f96395ffeYthL6N8ur86ncA");
    });
  });

  it("collects session, cost and errors", () => {
    const meta = parseAgentMeta(claude, [
      JSON.stringify({ type: "system", subtype: "init", session_id: "abc123" }),
      JSON.stringify({ type: "result", total_cost_usd: 0.5 }),
    ]);
    expect(meta.sessionId).toBe("abc123");
    expect(meta.cost).toBe(0.5);
    expect(meta.error).toBeUndefined();

    const failed = parseAgentMeta(claude, [JSON.stringify({ type: "result", is_error: true, result: "hit a wall" })]);
    expect(failed.error).toBe("hit a wall");
  });
});

describe("detection", () => {
  it("finds only what the resolver claims", () => {
    resetDetectionCache();
    const found = detectAgents((bin) => (bin === "claude" || bin === "codex" ? `/usr/bin/${bin}` : null));
    expect(found.map((a) => a.id)).toEqual(["claude", "codex"]);
    resetDetectionCache();
  });

  it("prefers the primaries, in registry order", () => {
    const avail = detectAgents((bin) => (bin === "codex" || bin === "aider" ? `/usr/bin/${bin}` : null));
    expect(pickAgent(null, avail)?.id).toBe("codex");
    const onlySecondary = detectAgents((bin) => (bin === "aider" ? "/usr/bin/aider" : null));
    expect(pickAgent(null, onlySecondary)?.id).toBe("aider");
    resetDetectionCache();
  });

  it("honours an explicit choice and rejects unknown ones", () => {
    const avail = detectAgents((bin) => (bin === "claude" ? "/usr/bin/claude" : null));
    expect(pickAgent("claude", avail)?.id).toBe("claude");
    expect(pickAgent("codex", avail)).toBeNull();
    expect(pickAgent(null, [])).toBeNull();
    resetDetectionCache();
  });

  it("resolves a bin or gives up", () => {
    expect(resolveBin(spec("claude"), (b) => (b === "claude" ? "/opt/claude" : null))).toBe("/opt/claude");
    expect(resolveBin(spec("claude"), () => null)).toBeNull();
  });
});

describe("handoff prompt", () => {
  it("briefs the agent on the toolkit, in build order", () => {
    const prompt = buildPrompt({ task: "add pricing", cwd: tmpdir(), context: true, projectContext: false });
    expect(prompt).toContain("SiteForge");
    expect(prompt).toContain("siteforge init");
    expect(prompt).toContain("siteforge add");
    expect(prompt).toContain("siteforge dewatermark");
    expect(prompt).toContain("siteforge audit");
    expect(prompt).toContain("add pricing");
    // The order matters: scaffold, compose, assets, verify.
    expect(prompt.indexOf("Scaffold")).toBeLessThan(prompt.indexOf("Compose"));
    expect(prompt.indexOf("Compose")).toBeLessThan(prompt.indexOf("Verify and ship"));
  });

  it("lists the skills the agent should read", () => {
    const prompt = buildPrompt({ task: "t", cwd: tmpdir(), context: true, projectContext: false });
    expect(prompt).toMatch(/Skills installed|dewatermark/);
    expect(prompt).toContain("- video");
  });

  it("carries the house style, not just commands", () => {
    const prompt = buildPrompt({ task: "t", cwd: tmpdir(), context: true, projectContext: false });
    expect(prompt).toContain("House style");
    expect(prompt).toContain("4:4:4");
    expect(prompt).toContain("not lorem ipsum");
  });

  it("tells the agent to audit before calling it done", () => {
    const prompt = buildPrompt({ task: "t", cwd: tmpdir(), context: true, projectContext: false });
    expect(prompt).toMatch(/audit/);
    expect(prompt).toMatch(/done/);
  });

  it("sends the bare task with --no-context", () => {
    expect(buildPrompt({ task: "just do this", cwd: tmpdir(), context: false, projectContext: false })).toBe("just do this");
  });

  it("describes the stack it can see", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-stack-"));
    writeFileSync(path.join(dir, "package.json"), "{}");
    writeFileSync(path.join(dir, "bun.lock"), "");
    writeFileSync(path.join(dir, "tsconfig.json"), "{}");
    writeFileSync(path.join(dir, "next.config.js"), "");
    const facts = detectProjectFacts(dir);
    expect(facts.stack).toContain("bun");
    expect(facts.stack).toContain("typescript");
    expect(facts.stack).toContain("next");
    expect(facts.hasGit).toBe(false);
    expect(facts.isEmpty).toBe(false);
    expect(buildPrompt({ task: "t", cwd: dir, context: true, projectContext: false })).toContain("bun");
  });

  it("calls out an empty directory, since that changes the first command", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-empty-"));
    const prompt = buildPrompt({ task: "build me a site", cwd: dir, context: true, projectContext: false });
    expect(prompt).toMatch(/empty/i);
    expect(prompt).toContain("siteforge init");
  });

  it("includes the project's own conventions", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-agents-"));
    writeFileSync(path.join(dir, "AGENTS.md"), "# House rules\nAlways use kebab-case.");
    const prompt = buildPrompt({ task: "t", cwd: dir, context: true, projectContext: true });
    expect(prompt).toContain("Always use kebab-case.");
    expect(buildPrompt({ task: "t", cwd: dir, context: true, projectContext: false })).not.toContain("kebab-case");
  });

  it("truncates a runaway task rather than blowing the context", () => {
    const prompt = buildPrompt({ task: "x".repeat(50_000), cwd: tmpdir(), context: false, projectContext: false });
    expect(prompt.length).toBeLessThanOrEqual(8000);
  });
});

describe("agent arg parsing", () => {
  it("defaults to list", () => {
    const o = parseAgentCmdArgs(["list"]);
    expect(o).toMatchObject({ action: "list", write: true, context: true, interactive: true, stream: true, dryRun: false });
  });
  it("takes a bare task with no subcommand", () => {
    expect(parseAgentCmdArgs(["build", "me", "a", "site"])).toMatchObject({ action: "run", task: "build me a site" });
  });
  it("takes every flag", () => {
    const o = parseAgentCmdArgs(["--agent", "codex", "--dir", "site", "--model", "m", "--read-only", "--no-context", "--headless", "--no-stream", "--dry-run", "do", "it"]);
    expect(o).toMatchObject({
      action: "run",
      task: "do it",
      agent: "codex",
      dir: "site",
      model: "m",
      write: false,
      context: false,
      interactive: false,
      stream: false,
      dryRun: true,
    });
  });
  it("requires a task when something was clearly meant to happen", () => {
    expect(() => parseAgentCmdArgs(["prompt"])).toThrow(/Missing/);
    // Flags but no task is a mistake, not a request for the list.
    expect(() => parseAgentCmdArgs(["--agent", "codex"])).toThrow(/Missing/);
    // Bare `siteforge agent` is a request for the list, not an error.
    expect(parseAgentCmdArgs([]).action).toBe("list");
    expect(parseAgentCmdArgs(["list"]).action).toBe("list");
  });
  it("rejects unknown flags", () => {
    expect(() => parseAgentCmdArgs(["t", "--nope"])).toThrow();
  });
});

describe("end to end", () => {
  /** A stand-in agent that echoes what it was given, then exits. */
  function fakeAgent(lines: string[], code = 0): string {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-fakeagent-"));
    const file = path.join(dir, "agent.sh");
    writeFileSync(file, `#!/bin/sh\n${lines.map((l) => `echo '${l.replace(/'/g, "'\\''")}'`).join("\n")}\nexit ${code}\n`);
    chmodSync(file, 0o755);
    return file;
  }

  const base = { task: "t", cwd: tmpdir(), context: false, projectContext: false, stream: false };

  it("streams a headless run and extracts what the agent said", async () => {
    const bin = fakeAgent([
      JSON.stringify({ type: "system", subtype: "init", session_id: "sess-42" }),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Edit" }] } }),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "text", content: "added the section" }] } }),
      JSON.stringify({ type: "result", result: "done", total_cost_usd: 0.02 }),
    ]);
    const r = await runHandoff({
      ...base,
      task: "add a section",
      spec: spec("claude"),
      bin,
      interactive: false,
      write: true,
    });

    expect(r.code).toBe(0);
    expect(r.interactive).toBe(false);
    expect(r.sessionId).toBe("sess-42");
    expect(r.cost).toBe(0.02);
    expect(r.output).toContain("added the section");
    expect(r.output).toContain("⚙ Edit");
    expect(r.raw).toHaveLength(4);
    expect(r.error).toBeUndefined();
  });

  it("surfaces a failing agent rather than reporting success", async () => {
    const bin = fakeAgent([JSON.stringify({ type: "result", is_error: true, result: "could not find the section" })], 1);
    const r = await runHandoff({ ...base, spec: spec("claude"), bin, interactive: false, write: true });
    expect(r.code).toBe(1);
    expect(r.error).toContain("could not find the section");
  });

  it("passes the briefing through as a single argument", async () => {
    // The fake agent prints its argv length, so a split briefing is visible.
    const dir = mkdtempSync(path.join(tmpdir(), "sf-fakeargv-"));
    const file = path.join(dir, "agent.sh");
    writeFileSync(file, "#!/bin/sh\necho \"args=$#\"\n");
    chmodSync(file, 0o755);
    const r = await runHandoff({ ...base, spec: spec("claude"), bin: file, interactive: false, write: true });
    // -p, prompt, --permission-mode, acceptEdits, --output-format, stream-json, --verbose
    expect(r.output).toContain("args=7");
  });

  it("reports a missing binary instead of hanging", async () => {
    // Regression: awaiting a stdout that never ends left the CLI hanging
    // forever when the binary vanished between detection and spawn.
    const r = await runHandoff({
      ...base,
      spec: spec("claude"),
      bin: path.join(tmpdir(), "definitely-not-here-9f3a"),
      interactive: false,
      write: true,
    });
    expect(r.code).toBe(127);
  }, 15_000);

  it("reports a missing binary in interactive mode too", async () => {
    const r = await runHandoff({
      ...base,
      spec: spec("claude"),
      bin: path.join(tmpdir(), "definitely-not-here-9f3a"),
      interactive: true,
      write: true,
    });
    expect(r.code).toBe(127);
  }, 15_000);
});