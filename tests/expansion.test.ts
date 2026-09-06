import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SECTIONS } from "../src/add/sections.js";
import { runAdd } from "../src/add/command.js";
import { FX } from "../src/fx/effects.js";
import { runFx } from "../src/fx/command.js";
import { PRESETS } from "../src/three/presets.js";
import { runThree } from "../src/three/command.js";
import { parseSelection } from "../src/wizard.js";
import { parseInitArgs } from "../src/wizard.js";
import { parseThreeArgs } from "../src/three/command.js";
import { parseAssetsArgs, runAssets } from "../src/assets/command.js";
import { AGENTS, parseSkillsArgs, runSkills, listBundledSkills } from "../src/skills/command.js";
import sharp from "sharp";

describe("new sections", () => {
  it.each(["pricing", "faq", "testimonials", "gallery"])("%s renders a component", (name) => {
    const code = SECTIONS[name].render();
    expect(code).toContain("export default function");
    expect(code).toContain("Props");
  });
  it("faq needs no client JS (native details)", () => {
    expect(SECTIONS.faq.render()).toContain("<details");
    expect(SECTIONS.faq.render()).not.toContain("use client");
  });
  it("runAdd writes pricing", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-sec-"));
    await runAdd({ section: "pricing", dir, list: false });
    expect(existsSync(path.join(dir, "Pricing.tsx"))).toBe(true);
  });
});

describe("new fx", () => {
  it.each(["marquee", "preloader", "magnetic"])("%s renders", (name) => {
    expect(FX[name].render({}).length).toBeGreaterThan(50);
  });
  it("marquee loops seamlessly (content duplicated)", () => {
    expect(FX.marquee.render()).toContain("translateX(-50%)");
  });
  it("preloader never traps (fallback timeout)", () => {
    expect(FX.preloader.render()).toContain("4000");
  });
});

describe("3d presets", () => {
  it.each(["particle", "terrain", "shapes", "orb", "model"])("%s imports three + cleans up", (name) => {
    const code = PRESETS[name].render();
    expect(code).toContain('from "three"');
    expect(code).toContain("cancelAnimationFrame");
    expect(code).toContain("renderer.dispose");
  });
  it("orb embeds GLSL without template hazards", () => {
    const code = PRESETS.orb.render();
    expect(code).toContain("gl_FragColor");
    expect(code).toContain('.join("\\n")');
  });
  it("model viewer loads GLB with orbit controls", () => {
    const code = PRESETS.model.render();
    expect(code).toContain("GLTFLoader");
    expect(code).toContain("OrbitControls");
  });
  it("runThree writes the file", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-3d-"));
    await runThree({ preset: "particle", dir, list: false });
    expect(existsSync(path.join(dir, "ParticleHero.tsx"))).toBe(true);
  });
  it("parseThreeArgs", () => {
    expect(parseThreeArgs(["orb"]).preset).toBe("orb");
    expect(() => parseThreeArgs(["nope"])).not.toThrow();
  });
});

describe("wizard helpers", () => {
  it("parseSelection handles lists + ranges", () => {
    expect(parseSelection("1,3", 5)).toEqual([0, 2]);
    expect(parseSelection("2-4", 5)).toEqual([1, 2, 3]);
    expect(parseSelection("0,99,abc", 3)).toEqual([0, 2]);
    expect(parseSelection("", 3)).toEqual([]);
  });
  it("parseInitArgs", () => {
    const o = parseInitArgs(["--video", "a.mp4", "--dir", "out", "--sections", "hero,work", "--fx", "fx:cursor"]);
    expect(o).toMatchObject({ video: "a.mp4", dir: "out", sections: ["hero", "work"], fx: ["fx:cursor"] });
  });
});

describe("skills installer", () => {
  it("knows all agents", () => {
    expect(AGENTS).toEqual(expect.arrayContaining(["claude", "cursor", "opencode", "codex", "aider", "pi"]));
  });
  it("parses agent filter + global", () => {
    expect(parseSkillsArgs(["install", "--agent", "claude,cursor", "--global"])).toEqual({
      action: "install", agents: ["claude", "cursor"], global: true,
    });
    expect(() => parseSkillsArgs(["install", "--agent", "nope"])).toThrow();
  });
  it("installs into a fake HOME without touching the real one", async () => {
    const fakeHome = mkdtempSync(path.join(tmpdir(), "sf-home-"));
    const origHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      await runSkills({ action: "install", agents: ["claude", "cursor"], global: true });
      const names = listBundledSkills();
      expect(names.length).toBeGreaterThan(0);
      expect(existsSync(path.join(fakeHome, ".claude", "skills", names[0], "SKILL.md"))).toBe(true);
      expect(existsSync(path.join(fakeHome, ".cursor", "rules", `siteforge-${names[0]}.mdc`))).toBe(true);
    } finally {
      if (origHome === undefined) delete process.env.HOME;
      else process.env.HOME = origHome;
    }
  }, 60000);
});

describe("assets optimizer", () => {
  it("parseAssetsArgs", () => {
    expect(parseAssetsArgs(["public", "--format", "webp", "--dry-run"])).toMatchObject({
      dir: "public", format: "webp", dryRun: true,
    });
    expect(() => parseAssetsArgs(["public", "--format", "bmp"])).toThrow();
  });
  it("compresses a test image (dry-run changes nothing)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-assets-"));
    const img = path.join(dir, "big.png");
    await sharp({ create: { width: 2400, height: 1200, channels: 3, background: { r: 30, g: 60, b: 90 } } })
      .png().toFile(img);
    const before = (await import("node:fs")).statSync(img).size;
    await runAssets({ dir, format: "keep", quality: 80, maxWidth: 1920, dryRun: true });
    expect((await import("node:fs")).statSync(img).size).toBe(before);
    await runAssets({ dir, format: "webp", quality: 80, maxWidth: 1200, dryRun: false });
    expect(existsSync(path.join(dir, "big.webp"))).toBe(true);
    expect(existsSync(img)).toBe(false);
  }, 60000);
});
