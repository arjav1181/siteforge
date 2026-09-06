import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SECTIONS, renderSharedCss } from "../src/add/sections.js";
import { runAdd } from "../src/add/command.js";
import { FX } from "../src/fx/effects.js";
import { runFx } from "../src/fx/command.js";
import { findCulprits } from "../src/audit/command.js";
import { parseRecordArgs } from "../src/record/command.js";
import { parseShipArgs } from "../src/ship/command.js";
import { parseAddArgs } from "../src/add/command.js";
import { parseFxArgs } from "../src/fx/command.js";
import { parseAuditArgs } from "../src/audit/command.js";
import { parseVideoArgs } from "../src/video/command.js";

describe("sections", () => {
  it("every section renders a component with export + props", () => {
    for (const [name, def] of Object.entries(SECTIONS)) {
      const code = def.render();
      expect(code, name).toContain("export default function");
      expect(code, name).toContain("Props");
      expect(def.file.endsWith(".tsx"), name).toBe(true);
    }
  });
  it("hero-grid fades with distance (no CSS var hacks)", () => {
    expect(SECTIONS["hero-grid"].render()).toContain("opacity: Math.max");
  });
  it("contact mailto interpolates the email prop", () => {
    expect(SECTIONS["contact"].render()).toContain("mailto:${email}");
  });
  it("shared css covers the reveal system", () => {
    const css = renderSharedCss();
    for (const sel of [".reveal", ".magnetic-btn", ".project-card", ".skill-tag", ".timeline-dot"]) {
      expect(css).toContain(sel);
    }
  });
  it("runAdd writes component + css + prints wiring", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-add-"));
    const target = path.join(dir, "components");
    let out = "";
    const orig = process.stdout.write.bind(process.stdout);
    // @ts-expect-error capture
    process.stdout.write = (c: string) => { out += c; return true; };
    try {
      await runAdd({ section: "hero", dir: target, list: false });
    } finally {
      process.stdout.write = orig;
    }
    expect(existsSync(path.join(target, "Hero.tsx"))).toBe(true);
    expect(existsSync(path.join(target, "siteforge.css"))).toBe(true);
    expect(out).toContain("import Hero");
    expect(out).toContain("IntersectionObserver");
  });
});

describe("fx", () => {
  it("every effect renders non-empty output", () => {
    for (const [name, def] of Object.entries(FX)) {
      expect(def.render({}).length, name).toBeGreaterThan(20);
    }
  });
  it("favicon honors letter + colors", () => {
    const svg = FX.favicon.render({ letter: "Z", bg: "#111111", fg: "#eeeeee" });
    expect(svg).toContain(">Z<");
    expect(svg).toContain('#111111');
    expect(svg).toContain('#eeeeee');
  });
  it("cursor is pointer-fine gated", () => {
    expect(FX.cursor.render()).toContain("pointer: fine");
  });
  it("runFx writes component files", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-fx-"));
    await runFx({ effect: "reveal", dir, list: false, opts: {} });
    expect(existsSync(path.join(dir, "useReveal.ts"))).toBe(true);
  });
});

describe("audit helpers", () => {
  it("findCulprits flags elements past the viewport, sorted worst-first", () => {
    const out = findCulprits(
      [
        { tag: "div", cls: "ok", right: 375 },
        { tag: "img", cls: "hero", right: 420 },
        { tag: "p", cls: "wide", right: 500 },
      ],
      375,
    );
    expect(out.map((c) => c.tag)).toEqual(["p", "img"]);
    expect(out[0].overPx).toBe(125);
  });
});

describe("arg parsing", () => {
  it("video parses flags", () => {
    const o = parseVideoArgs(["a.mp4", "out", "--fps", "30", "--no-build", "--quality", "90"]);
    expect(o).toMatchObject({ video: "a.mp4", outDir: "out", fps: 30, build: false, quality: 90 });
  });
  it("video rejects bad flags", () => {
    expect(() => parseVideoArgs(["a.mp4", "--fps", "0"])).toThrow();
    expect(() => parseVideoArgs(["a.mp4", "--nope"])).toThrow();
    expect(() => parseVideoArgs([])).toThrow();
  });
  it("record parses viewport + url", () => {
    const o = parseRecordArgs(["https://x.test", "--out", "d.mp4", "--viewport", "1440x900"]);
    expect(o).toMatchObject({ url: "https://x.test", out: "d.mp4", width: 1440, height: 900 });
    expect(() => parseRecordArgs(["https://x.test", "--viewport", "nope"])).toThrow();
  });
  it("audit parses widths", () => {
    expect(parseAuditArgs(["https://x.test", "--widths", "390,1280"]).widths).toEqual([390, 1280]);
  });
  it("ship parses visibility + repo", () => {
    expect(parseShipArgs(["--repo", "demo", "--private"])).toMatchObject({ repo: "demo", isPrivate: true });
  });
  it("add/fx parse section + effect", () => {
    expect(parseAddArgs(["hero", "--dir", "c"]).section).toBe("hero");
    expect(parseFxArgs(["favicon", "--letter", "Q"]).opts).toEqual({ letter: "Q" });
  });
});
