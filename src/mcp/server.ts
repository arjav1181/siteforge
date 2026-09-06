import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runAdd } from "../add/command.js";
import { runFx } from "../fx/command.js";
import { runThree } from "../three/command.js";
import { runAudit } from "../audit/command.js";
import { runSkills, AGENTS } from "../skills/command.js";
import { runDoctor } from "../doctor/command.js";
import { runShot } from "../shot/command.js";
import { setJsonMode } from "../log.js";
import { VERSION } from "../version.js";

const DEFAULT_DIR = "src/components";

function text(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2).slice(0, 20000) }] };
}

function fail(e: unknown): { content: { type: "text"; text: string }[]; isError: boolean } {
  return { content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }], isError: true as const };
}

export function buildServer(): McpServer {
  const server = new McpServer({ name: "siteforge", version: VERSION });

  server.tool(
    "add_section",
    "Drop a pre-built section (hero, navbar, about, work, skills, experience, contact, pricing, faq, testimonials, gallery) into a Next.js + Tailwind site.",
    { section: z.string().describe("Section name (see add --list)"), dir: z.string().optional().describe("Components dir") },
    async ({ section, dir }) => {
      try {
        return text(await runAdd({ section, dir: dir ?? DEFAULT_DIR, list: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "add_effect",
    "Drop an interactive effect (cursor, badge, progress, reveal, favicon, smooth, marquee, preloader, magnetic) into a site.",
    {
      effect: z.string().describe("Effect name (see fx --list)"),
      dir: z.string().optional(),
      letter: z.string().optional().describe("Favicon letter"),
      bg: z.string().optional().describe("Favicon background"),
      fg: z.string().optional().describe("Favicon foreground"),
    },
    async ({ effect, dir, letter, bg, fg }) => {
      try {
        const opts: Record<string, string> = {};
        if (letter) opts.letter = letter;
        if (bg) opts.bg = bg;
        if (fg) opts.fg = fg;
        return text(await runFx({ effect, dir: dir ?? DEFAULT_DIR, list: false, opts }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "add_3d_scene",
    "Drop a Three.js hero scene (particle, terrain, shapes, orb, model) into a site. Remind the user to install three + @types/three.",
    { preset: z.string().describe("Preset name (see 3d --list)"), dir: z.string().optional() },
    async ({ preset, dir }) => {
      try {
        return text(await runThree({ preset, dir: dir ?? DEFAULT_DIR, list: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "audit_page",
    "Health-check a page: horizontal overflow with culprits, meta/alt/console/weight. Needs system Chrome.",
    { url: z.string().describe("http(s):// or file:// URL"), widths: z.string().optional().describe("Comma widths, default 375,768,1440") },
    async ({ url, widths }) => {
      try {
        const parsed = widths
          ? widths.split(",").map((s) => Math.round(Number(s.trim()))).filter((n) => Number.isFinite(n) && n > 0)
          : [375, 768, 1440];
        return text(await runAudit({ url, widths: parsed, budgetKb: 500, browser: null, fix: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "install_skills",
    "Install SiteForge agent skills (video, add, fx, record, audit, ship…) for coding agents.",
    {
      agents: z.string().optional().describe(`Comma list from: ${AGENTS.join(", ")} (default all)`),
      global: z.boolean().optional().describe("Install to home dir instead of project"),
    },
    async ({ agents, global }) => {
      try {
        const list = agents ? agents.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [...AGENTS];
        for (const a of list) {
          if (!AGENTS.includes(a)) throw new Error(`Unknown agent "${a}". Choose from: ${AGENTS.join(", ")}`);
        }
        return text(await runSkills({ action: "install", agents: list, global: global ?? false, oss: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "take_screenshot",
    "Screenshot any page to a PNG file. Needs system Chrome.",
    {
      url: z.string().describe("http(s):// or file:// URL"),
      out: z.string().describe("Output PNG path"),
      fullPage: z.boolean().optional().describe("Capture the full scrollable page"),
    },
    async ({ url, out, fullPage }) => {
      try {
        return text(await runShot({ url, out, width: 1280, height: 800, full: fullPage ?? false, wait: 1200, browser: null }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "check_env",
    "Check the machine for everything SiteForge needs (node, ffmpeg, chrome, package managers, gh).",
    {},
    async () => {
      try {
        return text(await runDoctor());
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}

export async function runMcp(): Promise<void> {
  // Keep stdout pristine for JSON-RPC; all human logs go to stderr.
  setJsonMode(true);
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
