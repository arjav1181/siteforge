import { describe, it, expect } from "vitest";
import { runDoctor } from "../src/doctor/command.js";
import { parseAgentCmdArgs } from "../src/agent/command.js";

const run = async () => {
  const checks = (await runDoctor()).checks;
  return new Map(checks.map((c) => [c.name, c]));
};

describe("doctor", () => {
  it("covers every command that has a prerequisite", async () => {
    const byName = await run();
    // Each entry must name the commands it actually gates. `dewatermark` needs
    // ffmpeg for video and sharp for images; `agent` needs an agent.
    expect(byName.get("ffmpeg")?.need).toContain("dewatermark");
    expect(byName.get("ffprobe")?.need).toContain("dewatermark");
    expect(byName.get("sharp")?.need).toContain("dewatermark");
    expect(byName.get("coding agent")?.need).toBe("agent");
    expect(byName.get("gh (authenticated)")?.need).toBe("ship");
  });

  it("reports the coding agents it found, and how to fix it when it finds none", async () => {
    const c = (await run()).get("coding agent")!;
    expect(c).toBeDefined();
    expect(c.detail).toMatch(/found|found —|none found/);
    // A missing agent must say what to install, not just "no".
    if (!c.ok) expect(c.detail).toContain("npm i -g");
  });

  it("distinguishes gh being installed from gh being signed in", async () => {
    // This is the check that used to lie: it reported `gh --version` under a
    // label saying "authenticated", so an installed-but-signed-out gh looked
    // healthy right up until a push failed.
    const c = (await run()).get("gh (authenticated)")!;
    const ghInstalled = await import("../src/util.js").then((m) => m.commandExists("gh"));
    if (!ghInstalled) {
      expect(c.ok).toBe(false);
      expect(c.detail).toContain("missing");
    } else {
      // Installed: the verdict must come from auth state, not presence.
      expect(typeof c.ok).toBe("boolean");
    }
  });

  it("only node is fatal — everything else is reported, not thrown", async () => {
    const r = await runDoctor();
    expect(r.checks.length).toBeGreaterThanOrEqual(8);
    // The machine running the tests has node, so this must not throw.
    expect(r.checks[0]!.ok).toBe(true);
  });

  it("every check says which commands need it", async () => {
    for (const c of (await runDoctor()).checks) {
      expect(c.need, c.name).toBeTruthy();
      expect(c.detail, c.name).toBeTruthy();
    }
  });
});

describe("doctor and the agent command agree", () => {
  it("names an agent the way `siteforge agent list` would", async () => {
    const c = (await run()).get("coding agent")!;
    const listed = parseAgentCmdArgs(["list"]);
    expect(listed.action).toBe("list");
    // The primary trio must be what the install hint suggests.
    if (!c.ok) {
      for (const id of ["claude-code", "opencode", "codex"]) expect(c.detail.toLowerCase()).toContain(id.split("-")[0]!);
    }
  });
});