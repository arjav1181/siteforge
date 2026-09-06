import { readdirSync, statSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { formatBytes } from "../util.js";
import { log } from "../log.js";

export const ASSETS_HELP = `siteforge assets — batch-compress images in a directory.

Usage:
  siteforge assets <dir> [options]

Options:
  --format <webp|jpg|keep>   Output format (default: keep)
  --quality <1-100>          Output quality (default: 80)
  --max-width <px>           Downscale wider images (default: 1920)
  --dry-run                  Show what would change, write nothing

Walks <dir> (skips node_modules/.git/.next), rewrites each jpg/png/webp in
place, and prints a before/after table. Lossy — commit first.

Examples:
  siteforge assets public --dry-run
  siteforge assets public/demos --format webp --quality 82
`;

export interface AssetsOptions {
  dir: string;
  format: "webp" | "jpg" | "keep";
  quality: number;
  maxWidth: number;
  dryRun: boolean;
}

export function parseAssetsArgs(argv: string[]): AssetsOptions {
  const positional: string[] = [];
  const o: AssetsOptions = { dir: "", format: "keep", quality: 80, maxWidth: 1920, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "--format": {
        const v = next();
        if (v !== "webp" && v !== "jpg" && v !== "keep") throw new Error("--format must be webp, jpg, or keep");
        o.format = v;
        break;
      }
      case "--quality": {
        const v = Number(next());
        if (!Number.isInteger(v) || v < 1 || v > 100) throw new Error("--quality must be 1-100");
        o.quality = v;
        break;
      }
      case "--max-width": {
        const v = Number(next());
        if (!Number.isFinite(v) || v <= 0) throw new Error("--max-width must be positive");
        o.maxWidth = Math.round(v);
        break;
      }
      case "--dry-run": o.dryRun = true; break;
      default:
        if (a.startsWith("-")) throw new Error(`Unknown option for assets: ${a}`);
        positional.push(a);
    }
  }
  if (positional.length === 0) throw new Error("Missing <dir> argument.");
  o.dir = positional[0];
  return o;
}

const SKIP = new Set(["node_modules", ".git", ".next", "dist", "out"]);

function collect(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP.has(e.name)) collect(path.join(dir, e.name), out);
    } else if (/\.(jpe?g|png|webp)$/i.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

export interface AssetsResult {
  files: number;
  changed: number;
  before: number;
  after: number;
}

export async function runAssets(o: AssetsOptions): Promise<AssetsResult> {
  const files = collect(path.resolve(o.dir)).sort();
  if (files.length === 0) {
    log.warn("No images found.");
    return { files: 0, changed: 0, before: 0, after: 0 };
  }
  let before = 0, after = 0, changed = 0;
  for (const file of files) {
    const origSize = statSync(file).size;
    before += origSize;
    const meta = await sharp(file).metadata();
    const ext = path.extname(file).toLowerCase();
    const targetExt = o.format === "keep" ? ext : `.${o.format === "jpg" ? "jpg" : "webp"}`;
    const needsResize = (meta.width ?? 0) > o.maxWidth;
    const needsConvert = targetExt !== ext;
    if (!needsResize && !needsConvert && o.quality >= 92 && ext !== ".png") {
      after += origSize;
      continue;
    }
    let pipe = sharp(file);
    if (needsResize) pipe = pipe.resize({ width: o.maxWidth, withoutEnlargement: true });
    const target = file.replace(/\.[^.]*$/, targetExt);
    if (targetExt === ".webp") pipe = pipe.webp({ quality: o.quality });
    else if (targetExt === ".jpg" || targetExt === ".jpeg") pipe = pipe.jpeg({ quality: o.quality, chromaSubsampling: "4:4:4" });
    else if (ext === ".png") pipe = pipe.png({ compressionLevel: 9 });
    else pipe = pipe.jpeg({ quality: o.quality, chromaSubsampling: "4:4:4" });

    if (o.dryRun) {
      log.dim(`  would process ${path.relative(process.cwd(), file)} (${formatBytes(origSize)})`);
      after += origSize;
      continue;
    }
    const info = await pipe.toFile(target + ".siteforge-tmp");
    if (target !== file) unlinkSync(file);
    renameSync(target + ".siteforge-tmp", target);
    after += info.size;
    changed++;
    log.dim(`  ${formatBytes(origSize)} → ${formatBytes(info.size)}  ${path.relative(process.cwd(), target)}`);
  }
  log.blank();
  log.ok(`${changed}/${files.length} optimized: ${formatBytes(before)} → ${formatBytes(after)}`);
  return { files: files.length, changed, before, after };
}
