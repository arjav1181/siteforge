import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildSectionsJsx, composeSite, renderForgeMd } from "../src/video/compose.js";
import { SECTIONS } from "../src/add/sections.js";
import { scaffoldProject } from "../src/video/scaffold.js";
import { parseDemoArgs } from "../src/demo/command.js";
import { parseInitArgs } from "../src/wizard.js";

describe("compose", () => {
  it("buildSectionsJsx wires content props", () => {
    const { imports, jsx } = buildSectionsJsx(["navbar", "contact", "work"], {
      email: "a@b.c",
      github: "https://github.com/x",
    });
    expect(imports).toContain('import Navbar from "../components/Navbar";');
    expect(imports).toContain('import Contact from "../components/Contact";');
    expect(jsx).toContain('<Contact email="a@b.c"');
    expect(jsx).toContain("https://github.com/x");
    expect(jsx).toContain("<Work />");
    expect(jsx).toContain("<Navbar />");
  });
  it("hero sections receive headline", () => {
    const { jsx } = buildSectionsJsx(["hero"], { headline: "Hello", subline: "World" });
    expect(jsx).toContain('name="Hello"');
    expect(jsx).toContain('tagline="World"');
  });
  it("FORGE.md names the project and the flow", () => {
    const md = renderForgeMd("demo-site");
    expect(md).toContain("demo-site");
    expect(md).toContain("audit");
    expect(md).toContain("ship");
  });
  it("composeSite bakes content, swaps hero, wires sections", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-compose-"));
    await scaffoldProject({ outDir: dir, projectName: "demo", frameCount: 12 });
    await composeSite(dir, {
      content: { headline: "Hello World", subline: "Sub here", email: "a@b.c", github: "https://github.com/x", title: "Hello — Site" },
      sections: ["navbar", "hero-grid", "contact"],
      projectName: "demo",
    });
    const page = readFileSync(path.join(dir, "src", "app", "page.tsx"), "utf8");
    expect(page).toContain("Hello World");
    expect(page).toContain("Sub here");
    expect(page).not.toContain("Make it unforgettable.");
    expect(page).not.toContain("__DEFAULT_HERO_START__");
    expect(page).toContain('import Navbar from "../components/Navbar";');
    expect(page).toContain("<HeroGrid");
    expect(page).toContain('email="a@b.c"');
    expect(page).not.toContain("__EXTRA_SECTIONS__");
    expect(existsSync(path.join(dir, "src", "components", "Navbar.tsx"))).toBe(true);
    expect(existsSync(path.join(dir, "src", "components", "siteforge.css"))).toBe(true);
    expect(existsSync(path.join(dir, "FORGE.md"))).toBe(true);
    const layout = readFileSync(path.join(dir, "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain('title: "Hello — Site"');
  });
  it("composeSite with no sections keeps scroll room", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-compose-empty-"));
    await scaffoldProject({ outDir: dir, projectName: "demo", frameCount: 12 });
    await composeSite(dir, { content: {}, sections: [], projectName: "demo" });
    const page = readFileSync(path.join(dir, "src", "app", "page.tsx"), "utf8");
    expect(page).toContain("siteforge add --list");
    expect(page).toContain("Make it unforgettable.");
  });
});

describe("general sections", () => {
  it.each(["features", "cta", "gallery"])("%s renders (logos covered below)", (name) => {
    const code = SECTIONS[name].render();
    expect(code).toContain("export default function");
  });
  it("logos renders wordmarks", () => {
    expect(SECTIONS.logos.render()).toContain("TRUSTED BY");
  });
});

describe("demo + init flags", () => {
  it("parseDemoArgs", () => {
    expect(parseDemoArgs([])).toMatchObject({ dir: "./siteforge-demo", fps: 24 });
    expect(parseDemoArgs(["out", "--fps", "30"])).toMatchObject({ dir: "out", fps: 30 });
    expect(() => parseDemoArgs(["a", "b"])).toThrow();
  });
  it("parseInitArgs takes content flags", () => {
    const o = parseInitArgs(["--video", "a.mp4", "--headline", "Hi", "--email", "a@b.c", "--sections", "navbar"]);
    expect(o).toMatchObject({ video: "a.mp4", headline: "Hi", email: "a@b.c", sections: ["navbar"] });
  });
});
