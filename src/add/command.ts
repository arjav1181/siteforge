import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SECTIONS, renderSharedCss } from "./sections.js";
import { log } from "../log.js";

export const ADD_HELP = `siteforge add — drop a pre-built section into your Next.js + Tailwind site.

Usage:
  siteforge add <section> [--dir src/components]
  siteforge add --list

Sections:
${Object.entries(SECTIONS)
  .map(([name, s]) => `  ${name.padEnd(12)} ${s.description}`)
  .join("\n")}

Each section is a self-contained .tsx component with props + placeholder
content. After adding, import it in your page and pass real content:

  import Hero from "./components/Hero";
  <Hero name="ARJAV" tagline="..." />

Sections use the .reveal convention — add the observer snippet printed after
each add (or reuse yours) and import ./components/siteforge.css once.
`;

const OBSERVER_SNIPPET = `// Reveal on scroll — paste once (e.g. in your page component):
useEffect(() => {
  const els = document.querySelectorAll(".reveal");
  const obs = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) e.target.classList.add("visible");
  }), { threshold: 0.15 });
  els.forEach((el) => obs.observe(el));
  return () => obs.disconnect();
}, []);`;

export function parseAddArgs(argv: string[]): { section: string | null; dir: string; list: boolean } {
  let section: string | null = null;
  let dir = path.join("src", "components");
  let list = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") list = true;
    else if (a === "--dir") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --dir");
      dir = v;
    } else if (a.startsWith("-")) throw new Error(`Unknown option for add: ${a}`);
    else if (!section) section = a;
    else throw new Error("Too many arguments for add.");
  }
  return { section, dir, list };
}

export async function runAdd(opts: { section: string | null; dir: string; list: boolean }): Promise<void> {
  if (opts.list || !opts.section) {
    process.stdout.write(ADD_HELP);
    return;
  }
  const def = SECTIONS[opts.section];
  if (!def) throw new Error(`Unknown section "${opts.section}". Run: siteforge add --list`);
  mkdirSync(opts.dir, { recursive: true });

  const compPath = path.join(opts.dir, def.file);
  writeFileSync(compPath, def.render());
  log.ok(`Wrote ${compPath}`);

  const cssPath = path.join(opts.dir, "siteforge.css");
  if (!existsSync(cssPath)) {
    writeFileSync(cssPath, renderSharedCss());
    log.ok(`Wrote ${cssPath} (shared reveal/buttons/cards)`);
  }

  const comp = def.file.replace(/\.tsx$/, "");
  log.blank();
  log.dim("  Wire it up:");
  log.dim(`    import ${comp} from "./components/${comp}";`);
  log.dim(`    <${comp} />   // props: ${def.props}`);
  log.dim(`  Import once:  ./components/siteforge.css`);
  log.blank();
  log.dim("  Reveal observer (needs useEffect import):");
  for (const line of OBSERVER_SNIPPET.split("\n")) log.dim(`  ${line}`);
  log.blank();
}
