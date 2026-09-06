import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FX } from "./effects.js";
import { log } from "../log.js";

export const FX_HELP = `siteforge fx — drop an interactive effect into your site.

Usage:
  siteforge fx <effect> [--dir src/components] [effect options]
  siteforge fx --list

Effects:
${Object.entries(FX)
  .map(([name, f]) => `  ${name.padEnd(10)} ${f.description}`)
  .join("\n")}

Favicon options: --letter <A> --bg <#000000> --fg <#ffffff>
  (writes src/app/icon.svg — pass --dir src/app)

Examples:
  siteforge fx cursor
  siteforge fx favicon --letter A --dir src/app
  siteforge fx smooth
`;

export function parseFxArgs(argv: string[]): { effect: string | null; dir: string; list: boolean; opts: Record<string, string> } {
  let effect: string | null = null;
  let dir = path.join("src", "components");
  let list = false;
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") list = true;
    else if (a === "--dir" || a === "--letter" || a === "--bg" || a === "--fg") {
      const v = argv[++i];
      if (!v) throw new Error(`Missing value for ${a}`);
      if (a === "--dir") dir = v;
      else opts[a.slice(2)] = v;
    } else if (a.startsWith("-")) throw new Error(`Unknown option for fx: ${a}`);
    else if (!effect) effect = a;
    else throw new Error("Too many arguments for fx.");
  }
  return { effect, dir, list, opts };
}

export interface FxResult {
  files: string[];
  printed: boolean;
}

export async function runFx(o: { effect: string | null; dir: string; list: boolean; opts: Record<string, string> }): Promise<FxResult | undefined> {
  if (o.list || !o.effect) {
    process.stdout.write(FX_HELP);
    return undefined;
  }
  const def = FX[o.effect];
  if (!def) throw new Error(`Unknown effect "${o.effect}". Run: siteforge fx --list`);
  if (def.file === null) {
    process.stdout.write(def.render(o.opts));
    return { files: [], printed: true };
  }
  mkdirSync(o.dir, { recursive: true });
  const target = path.join(o.dir, def.file);
  writeFileSync(target, def.render(o.opts));
  log.ok(`Wrote ${target}`);
  if (def.file.endsWith(".tsx") || def.file.endsWith(".ts")) {
    const comp = def.file.replace(/\.tsx?$/, "");
    const stmt = def.file.startsWith("use")
      ? `import { ${comp} } from "./components/${comp}";`
      : `import ${comp} from "./components/${comp}";`;
    log.dim(`  Import:  ${stmt}`);
  }
  if (def.file === "icon.svg") {
    log.dim("  Next.js serves src/app/icon.svg as the favicon automatically.");
    log.dim("  Delete src/app/favicon.ico if it still exists.");
  }
  return { files: [target], printed: false };
}
