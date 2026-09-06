import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SECTIONS } from "../add/sections.js";
import { runAdd } from "../add/command.js";
import { log } from "../log.js";

export interface SiteContent {
  headline?: string;
  subline?: string;
  email?: string;
  github?: string;
  title?: string;
}

const FALLBACK_SECTION = `      <section className="relative z-10 h-screen flex items-center justify-center">
        <p className="text-white/30 text-sm tracking-widest uppercase">Add sections — run: siteforge add --list</p>
      </section>
`;

export function renderForgeMd(projectName: string): string {
  return `# ${projectName} — forged with SiteForge

A scroll-driven immersive site. The background video plays frame-by-frame as
visitors scroll (canvas engine in \`src/app/page.tsx\`).

## Run it

\`\`\`bash
bun install && bun run dev     # or npm install && npm run dev
bun run build                  # production check before shipping
\`\`\`

## Where things live

- \`src/app/page.tsx\` — canvas engine + all sections. Content in top-level
  data arrays; new sections follow the \`relative z-10\` + \`max-w-6xl\` pattern.
- \`src/app/layout.tsx\` — fonts + browser tab title.
- \`src/components/\` — drop-in SiteForge components (+ \`siteforge.css\`).
- \`public/frames/\` — the animation. Never rename files.

## Grow it

\`\`\`bash
siteforge add pricing --dir src/components   # more sections
siteforge fx cursor                          # cursor, badges, marquees…
siteforge 3d particle                        # Three.js hero scenes
siteforge record http://localhost:3000 --out demo.mp4
siteforge audit http://localhost:3000        # must exit 0 before ship
siteforge ship --repo ${projectName}
\`\`\`

## For AI agents

Install the toolkit skills so your agent knows these conventions:
\`siteforge skills install\`. Key rule: the canvas engine is load-bearing —
edit around it, never through it. Mobile-first: verify at 375px.
`;
}

/** Import lines + JSX for picked sections. Contact/hero receive content props. */
export function buildSectionsJsx(picked: string[], content: SiteContent): { imports: string; jsx: string } {
  const imports: string[] = [];
  const jsx: string[] = [];
  for (const name of picked) {
    const def = SECTIONS[name];
    if (!def) continue;
    const comp = def.file.replace(/\.tsx$/, "");
    imports.push(`import ${comp} from "../components/${comp}";`);
    if (name === "contact") {
      const socials = content.github
        ? `[{ name: "GitHub", url: "${content.github}" }]`
        : undefined;
      const props = [
        content.email ? `email="${content.email}"` : "",
        socials ? `socials={${socials}}` : "",
      ].filter(Boolean).join(" ");
      jsx.push(`      <Contact${props ? " " + props : ""} />`);
    } else if (name === "hero") {
      const props = [
        content.headline ? `name="${content.headline}"` : "",
        content.subline ? `tagline="${content.subline}"` : "",
      ].filter(Boolean).join(" ");
      jsx.push(`      <Hero${props ? " " + props : ""} />`);
    } else if (name === "hero-grid") {
      const props = [
        content.headline ? `name="${content.headline}"` : "",
        content.subline ? `tagline="${content.subline}"` : "",
      ].filter(Boolean).join(" ");
      jsx.push(`      <HeroGrid${props ? " " + props : ""} />`);
    } else {
      jsx.push(`      <${comp} />`);
    }
  }
  return { imports: imports.join("\n"), jsx: jsx.join("\n") };
}

export interface ComposeOptions {
  content: SiteContent;
  sections: string[];
  projectName: string;
}

/** Bake content + sections into an already-scaffolded site. */
export async function composeSite(outDir: string, opts: ComposeOptions): Promise<void> {
  const { content, sections, projectName } = opts;
  const known = sections.filter((s) => SECTIONS[s]);
  for (const s of sections) {
    if (!SECTIONS[s]) log.warn(`Unknown section "${s}" — skipped.`);
  }

  // 1. Component files (+ shared css) via the add pipeline.
  const compDir = path.join(outDir, "src", "components");
  for (const s of known) {
    await runAdd({ section: s, dir: compDir, list: false });
  }

  // 2. Patch page.tsx: content, hero swap, imports, sections.
  const pagePath = path.join(outDir, "src", "app", "page.tsx");
  let page = readFileSync(pagePath, "utf8");

  if (content.headline) page = page.split("Make it unforgettable.").join(content.headline);
  if (content.subline) page = page.split("Your subline goes here. One sentence on what this is.").join(content.subline);

  const customHero = known.includes("hero") || known.includes("hero-grid");
  if (customHero) {
    const start = page.indexOf("{/* __DEFAULT_HERO_START__ */}");
    const end = page.indexOf("{/* __DEFAULT_HERO_END__ */}");
    if (start !== -1 && end !== -1) {
      page = page.slice(0, start) + page.slice(end + "{/* __DEFAULT_HERO_END__ */}".length);
    }
  }

  const { imports, jsx } = buildSectionsJsx(known, content);
  page = page.replace("// __COMPONENT_IMPORTS__", imports || "// (no extra components)");
  page = page.replace(
    "{/* __EXTRA_SECTIONS__ */}",
    jsx || FALLBACK_SECTION,
  );
  // Strip our own scaffolding markers — never ship them.
  page = page
    .split("{/* __DEFAULT_HERO_START__ */}\n").join("")
    .split("{/* __DEFAULT_HERO_END__ */}\n").join("")
    .split("{/* __DEFAULT_HERO_END__ */}").join("");
  writeFileSync(pagePath, page);
  log.ok("Composed page.tsx (content + sections)");

  // 3. Layout title.
  const layoutPath = path.join(outDir, "src", "app", "layout.tsx");
  const title = content.title ?? (content.headline ? `${content.headline} — Site` : null);
  if (title) {
    const layout = readFileSync(layoutPath, "utf8").replace(
      'title: "Immersive Site"',
      `title: ${JSON.stringify(title)}`,
    );
    writeFileSync(layoutPath, layout);
  }

  // 4. Guide file so the output never feels orphaned.
  writeFileSync(path.join(outDir, "FORGE.md"), renderForgeMd(projectName));
  log.ok("Wrote FORGE.md");
}
