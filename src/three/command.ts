import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PRESETS } from "./presets.js";
import { log } from "../log.js";

export const THREE_HELP = `siteforge 3d — drop a Three.js hero background into your site.

Usage:
  siteforge 3d <preset> [--dir src/components]
  siteforge 3d --list

Presets:
${Object.entries(PRESETS)
  .map(([name, p]) => `  ${name.padEnd(10)} ${p.description}`)
  .join("\n")}

Then: npm install three @types/three

Use as a full-bleed background inside a relative hero section:

  import ParticleHero from "./components/ParticleHero";
  <section className="relative h-screen overflow-hidden">
    <ParticleHero />
    <div className="relative z-10">...your content...</div>
  </section>

Put a .glb/.gltf file in public/models/ for the model preset.
`;

export function parseThreeArgs(argv: string[]): { preset: string | null; dir: string; list: boolean } {
  let preset: string | null = null;
  let dir = path.join("src", "components");
  let list = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") list = true;
    else if (a === "--dir") {
      const v = argv[++i];
      if (!v) throw new Error("Missing value for --dir");
      dir = v;
    } else if (a.startsWith("-")) throw new Error(`Unknown option for 3d: ${a}`);
    else if (!preset) preset = a;
    else throw new Error("Too many arguments for 3d.");
  }
  return { preset, dir, list };
}

export async function runThree(o: { preset: string | null; dir: string; list: boolean }): Promise<void> {
  if (o.list || !o.preset) {
    process.stdout.write(THREE_HELP);
    return;
  }
  const def = PRESETS[o.preset];
  if (!def) throw new Error(`Unknown preset "${o.preset}". Run: siteforge 3d --list`);
  mkdirSync(o.dir, { recursive: true });
  const target = path.join(o.dir, def.file);
  writeFileSync(target, def.render());
  log.ok(`Wrote ${target}`);
  const comp = def.file.replace(/\.tsx$/, "");
  log.blank();
  log.dim("  Install three:  npm install three @types/three");
  log.dim(`  Import:  import ${comp} from "./components/${comp}";`);
  log.blank();
}
