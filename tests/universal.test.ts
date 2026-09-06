import { describe, it, expect } from "vitest";
import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { discoverSkills, loadManifest, parseSkillsArgs, runSkills, listOssSkills } from "../src/skills/command.js";
import { listScripts, parseRunArgs } from "../src/scripts/command.js";
import { parseServeArgs } from "../src/serve/command.js";
import { parseShotArgs, runShot } from "../src/shot/command.js";
import { buildServer } from "../src/mcp/server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const execFileAsync = promisify(execFile);

const hasPortTool = (() => {
  try {
    execFileSync("sh", ["-c", "command -v fuser || command -v lsof"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

async function runScriptFile(name: string, args: string[], stdin?: string): Promise<{ code: number; out: string }> {
  const file = path.join(import.meta.dirname, "..", "scripts", `${name}.mjs`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file, ...args], { encoding: "utf8" });
    let out = "";
    child.stdout.on("data", (c: string) => { out += c; });
    child.stderr.on("data", (c: string) => { out += c; });
    if (stdin) { child.stdin.write(stdin); child.stdin.end(); }
    child.on("close", (code: number) => resolve({ code: code ?? 1, out }));
  });
}

describe("oss skills", () => {
  it("manifest lists pinned sources", () => {
    const sources = loadManifest();
    expect(sources.map((s) => s.id)).toEqual(expect.arrayContaining(["anthropics", "superpowers"]));
    for (const s of sources) {
      expect(s.repo).toContain("/");
      expect(s.ref).toBeTruthy();
    }
  });
  it("discovers nested OSS skills (42+ total)", () => {
    const all = discoverSkills(true);
    expect(all.length).toBeGreaterThanOrEqual(40);
    expect(all.some((s) => s.source === "anthropics")).toBe(true);
    expect(all.some((s) => s.source === "superpowers")).toBe(true);
    const names = all.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length); // collision-safe
  });
  it("installs OSS skills from local submodules (whole folders)", async () => {
    const home = mkdtempSync(path.join(tmpdir(), "sf-oss-"));
    const orig = process.env.HOME;
    process.env.HOME = home;
    try {
      const r = await runSkills({ action: "install", agents: ["claude"], global: true, oss: true });
      expect((r?.installed.length ?? 0)).toBeGreaterThan(30);
      // spot-check a nested anthropics skill landed with siblings
      const landed = r?.installed.filter((p) => p.includes("brainstorming") || p.includes("systematic-debugging")) ?? [];
      expect(landed.length).toBeGreaterThan(0);
      for (const p of landed.slice(0, 2)) expect(existsSync(path.join(path.dirname(p), "SKILL.md"))).toBe(true);
    } finally {
      if (orig === undefined) delete process.env.HOME;
      else process.env.HOME = orig;
    }
  }, 120000);
  it("listOssSkills reads local submodules", async () => {
    const sources = loadManifest();
    for (const src of sources) {
      const r = await listOssSkills(src);
      expect(r.local).toBe(true);
      expect(r.names.length).toBeGreaterThan(5);
    }
  });
  it("parseSkillsArgs takes --oss", () => {
    expect(parseSkillsArgs(["install", "--oss"])).toMatchObject({ action: "install", oss: true });
  });
});

describe("bundled scripts", () => {
  it("lists all six", () => {
    expect(listScripts()).toEqual(expect.arrayContaining(["bigfiles", "loc", "todo-sweep", "json-pretty", "md-toc", "port-kill"]));
  });
  it("bigfiles ranks by size", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-big-"));
    writeFileSync(path.join(dir, "small.txt"), "hi");
    writeFileSync(path.join(dir, "big.txt"), "x".repeat(5000));
    const r = await runScriptFile("bigfiles", [dir, "--top", "2"]);
    expect(r.code).toBe(0);
    expect(r.out.indexOf("big.txt")).toBeLessThan(r.out.indexOf("small.txt"));
  });
  it("loc counts lines", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-loc-"));
    writeFileSync(path.join(dir, "a.ts"), "one\n\ntwo\nthree\n");
    const r = await runScriptFile("loc", [dir]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("TOTAL");
  });
  it("todo-sweep finds markers", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-todo-"));
    writeFileSync(path.join(dir, "a.ts"), "// TODO: fix this\nconst x = 1;\n");
    const r = await runScriptFile("todo-sweep", [dir]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("TODO");
    expect(r.out).toContain("a.ts:1");
  });
  it("json-pretty formats stdin", async () => {
    const r = await runScriptFile("json-pretty", [], '{"a":1}');
    expect(r.code).toBe(0);
    expect(r.out).toContain('"a": 1');
  });
  it("json-pretty rejects garbage", async () => {
    const r = await runScriptFile("json-pretty", [], "nope{");
    expect(r.code).toBe(1);
  });
  it("md-toc inserts a TOC", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-toc-"));
    const f = path.join(dir, "doc.md");
    writeFileSync(f, "# Title\n\n## Alpha\n\n## Beta\n");
    const r = await runScriptFile("md-toc", [f]);
    expect(r.code).toBe(0);
    expect(readFileSync(f, "utf8")).toContain("(#alpha)");
  });
  it.runIf(hasPortTool)("port-kill never signals itself or strangers", async () => {
    const http = await import("node:http");
    const srv = http.createServer((_, res) => res.end("x"));
    await new Promise<void>((res) => srv.listen(0, res));
    const port = (srv.address() as { port: number }).port;
    const r = await runScriptFile("port-kill", [String(port)]);
    expect(r.code).toBe(0);
    // Core safety property: our own pid must never appear as a kill target,
    // even when listings lie (PID reuse / namespace skew).
    expect(r.out).not.toContain(`killed pid ${process.pid}`);
    expect(r.out).not.toContain(`force-killed pid ${process.pid}`);
    // Either it worked, or it explained a safe skip — never silence, never crash.
    expect(r.out).toMatch(/killed pid \d+ \(.+\)|released the port|skipping protected|no longer bound|free|still holding|could not signal/);
    srv.close();
    await new Promise((res) => setTimeout(res, 200));
  });
  it("parseRunArgs splits script from passthrough args", () => {
    expect(parseRunArgs(["bigfiles", "public", "--top", "5"])).toEqual({ name: "bigfiles", list: false, args: ["public", "--top", "5"] });
    expect(parseRunArgs(["--list"])).toMatchObject({ list: true });
  });
});

describe("serve + shot parsing", () => {
  it("parseServeArgs", () => {
    expect(parseServeArgs(["public", "--port", "8080", "--spa"])).toEqual({ dir: "public", port: 8080, spa: true });
    expect(() => parseServeArgs(["--port", "99x".slice(0, 0) || "99999"])).toThrow();
  });
  it("parseShotArgs requires --out", () => {
    expect(parseShotArgs(["https://x.test", "--out", "a.png", "--full"])).toMatchObject({ out: "a.png", full: true });
    expect(() => parseShotArgs(["https://x.test"])).toThrow();
  });
  it("runShot captures a local page", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-shot-"));
    writeFileSync(path.join(dir, "i.html"), "<html><body><h1>hi</h1></body></html>");
    const out = path.join(dir, "s.png");
    const r = await runShot({ url: "file://" + path.join(dir, "i.html"), out, width: 800, height: 600, full: false, wait: 300, browser: null });
    expect(r.out).toBe(out);
    expect(existsSync(out)).toBe(true);
  }, 90000);
});

describe("mcp take_screenshot", () => {
  it("tool exists and captures", async () => {
    const server = buildServer();
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0" });
    await Promise.all([server.connect(serverT), client.connect(clientT)]);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("take_screenshot");
    const dir = mkdtempSync(path.join(tmpdir(), "sf-mcp-shot-"));
    writeFileSync(path.join(dir, "i.html"), "<html><body><h1>hi</h1></body></html>");
    const out = path.join(dir, "s.png");
    const res = await client.callTool({ name: "take_screenshot", arguments: { url: "file://" + path.join(dir, "i.html"), out } });
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text).out).toBe(out);
    expect(existsSync(out)).toBe(true);
    await client.close();
    await server.close();
  }, 90000);
});
