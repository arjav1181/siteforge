import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderCompletion } from "../src/complete.js";
import { detectStack, renderAgentsMd, runAgents } from "../src/agents/command.js";
import { fixHtml } from "../src/audit/command.js";
import { compareVersions, parseUpdateArgs } from "../src/update/command.js";
import { buildServer } from "../src/mcp/server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const execFileAsync = promisify(execFile);
const CLI = path.join(__dirname, "..", "dist", "cli.js");

async function cli(...args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI, ...args]);
    return { stdout, stderr, code: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", code: err.code ?? 1 };
  }
}

describe("--json mode", () => {
  it("add prints machine JSON on stdout, logs on stderr", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-json-"));
    const r = await cli("add", "faq", "--dir", dir, "--json");
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.files.some((f: string) => f.endsWith("Faq.tsx"))).toBe(true);
    expect(r.stderr).toContain("Wrote");
  }, 60000);
  it("audit --json yields a parseable report", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-json-audit-"));
    writeFileSync(path.join(dir, "p.html"), "<html><head><title>T</title></head><body><p>hi</p></body></html>");
    const r = await cli("audit", "file://" + path.join(dir, "p.html"), "--widths", "800", "--json");
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(typeof parsed.clean).toBe("boolean");
    expect(Array.isArray(parsed.warnings)).toBe(true);
  }, 120000);
  it("doctor --json yields checks array", async () => {
    const r = await cli("doctor", "--json");
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.checks.length).toBeGreaterThan(4);
  }, 60000);
});

describe("completions", () => {
  it.each(["bash", "zsh", "fish"])("%s mentions every command", (shell) => {
    const out = renderCompletion(shell);
    for (const c of ["video", "add", "fx", "3d", "record", "audit", "ship", "skills", "assets", "agents", "mcp", "completion", "doctor", "update"]) {
      expect(out, `${shell}:${c}`).toContain(c);
    }
  });
  it("rejects unknown shells", () => {
    expect(() => renderCompletion("powershell")).toThrow();
  });
});

describe("agents command", () => {
  it("detects stack signals", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-stack-"));
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({
      name: "demo", scripts: { dev: "next dev", test: "vitest run" },
      dependencies: { next: "14.0.0", tailwindcss: "^3" }, devDependencies: { vitest: "^3" },
    }));
    writeFileSync(path.join(dir, "bun.lock"), "");
    writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }));
    const info = detectStack(dir);
    expect(info.pm).toBe("bun");
    expect(info.frameworks.some((f) => f.startsWith("Next.js"))).toBe(true);
    expect(info.testing).toContain("Vitest");
    expect(info.strict).toBe(true);
    const md = renderAgentsMd(info);
    expect(md).toContain("bun run dev");
    expect(md).toContain("## Agreements");
  });
  it("writes AGENTS.md, refuses overwrite without --force", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-agents-"));
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x" }));
    const r1 = await runAgents({ init: true, force: false, cwd: dir });
    expect(r1.wrote).toContain("AGENTS.md");
    expect(existsSync(path.join(dir, "AGENTS.md"))).toBe(true);
    await expect(runAgents({ init: true, force: false, cwd: dir })).rejects.toThrow(/--force/);
    expect(readFileSync(path.join(dir, "AGENTS.md"), "utf8")).toContain("# AGENTS.md");
  });
});

describe("audit --fix", () => {
  it("fixes lang, meta, and alt in one pass", () => {
    const { html, changes } = fixHtml(
      '<html><head><title>T</title></head><body><img src="my-photo.jpg"></body></html>',
    );
    expect(changes.length).toBe(3);
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('name="description"');
    expect(html).toContain('alt="my photo"');
  });
  it("leaves clean html alone", () => {
    const { changes } = fixHtml(
      '<html lang="en"><head><meta name="description" content="x"></head><body><img src="a.png" alt="b"></body></html>',
    );
    expect(changes).toEqual([]);
  });
  it("cli --fix repairs a real file (with .bak)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-fix-"));
    const file = path.join(dir, "p.html");
    writeFileSync(file, "<html><head><title>T</title></head><body><p>hi</p></body></html>");
    const r = await cli("audit", "file://" + file, "--widths", "800", "--fix");
    expect(r.code).toBe(0);
    expect(existsSync(file + ".bak")).toBe(true);
    expect(readFileSync(file, "utf8")).toContain('lang="en"');
  }, 120000);
});

describe("update helpers", () => {
  it("compareVersions orders semver", () => {
    expect(compareVersions("1.0.0", "1.1.0")).toBe(-1);
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
  });
  it("parseUpdateArgs", () => {
    expect(parseUpdateArgs(["--check"])).toEqual({ check: true });
    expect(parseUpdateArgs([])).toEqual({ check: false });
    expect(() => parseUpdateArgs(["--nope"])).toThrow();
  });
});

describe("mcp server", () => {
  it("exposes tools and runs one end to end", async () => {
    const server = buildServer();
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverT), client.connect(clientT)]);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const n of ["add_section", "add_effect", "add_3d_scene", "audit_page", "install_skills", "check_env"]) {
      expect(names).toContain(n);
    }
    const dir = mkdtempSync(path.join(tmpdir(), "sf-mcp-"));
    const res = await client.callTool({ name: "add_effect", arguments: { effect: "reveal", dir } });
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text).files[0]).toContain("useReveal.ts");
    expect(existsSync(path.join(dir, "useReveal.ts"))).toBe(true);
    await client.close();
    await server.close();
  }, 60000);
});
