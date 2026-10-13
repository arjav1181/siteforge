import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { log, progress, isJsonMode } from "../log.js";
import { commandExists, formatBytes } from "../util.js";
import { inpaintRegion, markStrength, scaleBox, fitBox, MARK_PRESENT, type Box } from "./inpaint.js";
import { parseBox, guessBox, asciiPreview, writePicker, openBrowser } from "./picker.js";
import type { Ask } from "../wizard.js";

const execFileAsync = promisify(execFile);

export const DEWATERMARK_HELP = `siteforge dewatermark — solve watermarks out of images, frame
sequences and video.

Usage:
  siteforge dewatermark <image|dir|video> [options]

Options:
  --box=x,y,w,h              area to solve (skips the picker)
  --auto                     start from a guessed box (advisory, often wrong)
  --out <path>               output file, or dir for a directory input
  --format <keep|webp|jpg>   image output format (default: keep)
  --quality <1-100>          image quality (default: 82)
  --no-open                  don't launch the browser picker
  --yes                      no prompts

It does not paint over the mark. It SOLVES for it: inside the selected area the
Laplace equation ∇²u = 0 is relaxed with the surrounding pixels held fixed, so
the surface runs as smoothly through the gap as it did on either side.

Output is written beside the input (directories go to <dir>-clean/) and keeps
the source filename and format, so existing <img src> references keep working.

Examples:
  siteforge dewatermark hero.png
  siteforge dewatermark public --box=1600,880,180,180
  siteforge dewatermark ./frames --auto --yes
  siteforge dewatermark talk.mp4 --box=1200,680,90,90 --quality 88

Honesty note — why you are asked to mark it:
the obvious auto-detect is diffing frames, since a watermark is static and a
scene is not. Measured on a real sequence that does NOT work here: the sparkle
is SEMI-TRANSPARENT, so its pixels shift as the background moves behind it
(spread inside the mark 22.7 vs a 23.8 frame average — no signal). Guessing is
not an option either, because a wrong box does not fail, it quietly smooths
whatever you aimed it at. So the script asks.

Every run then reports three things, because each is a different claim:
  marked    a mark was detected in that item
  residual  a mark was detected again AFTER solving — it did not come out
  adjusted  the box had to move to fit inside that frame, which is the usual
            reason a mark survives (a box the solver cannot use as drawn)
residual is the one to read: everything else on the summary line can be true
while that number is not.
`;

const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".avif", ".bmp", ".gif"]);
const VID_EXT = new Set([".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".mpg", ".mpeg"]);
const WRITABLE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export type Format = "keep" | "webp" | "jpg";

export interface DewatermarkOptions {
  target: string;
  box: string | null;
  out: string | null;
  format: Format;
  quality: number;
  auto: boolean;
  open: boolean;
  yes: boolean;
}

export interface DewatermarkFailure {
  file: string;
  reason: string;
}

export interface DewatermarkResult {
  target: string;
  kind: "image" | "frames" | "video";
  box: Box;
  output: string;
  total: number;
  marked: number;
  clean: number;
  adjusted: number;
  residual: number;
  bytes: number;
  failures: DewatermarkFailure[];
}

export function parseDewatermarkArgs(argv: string[]): DewatermarkOptions {
  const o: DewatermarkOptions = {
    target: "",
    box: null,
    out: null,
    format: "keep",
    quality: 82,
    auto: false,
    open: true,
    yes: false,
  };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    if (a.startsWith("--box=")) o.box = a.slice("--box=".length);
    else if (a === "--box") o.box = next();
    else if (a === "--out") o.out = next();
    else if (a === "--auto") o.auto = true;
    else if (a === "--no-open") o.open = false;
    else if (a === "--yes" || a === "-y") o.yes = true;
    else if (a === "--format") {
      const v = next();
      if (v !== "keep" && v !== "webp" && v !== "jpg") throw new Error("--format must be keep, webp, or jpg");
      o.format = v;
    } else if (a === "--quality") {
      const v = Number(next());
      if (!Number.isInteger(v) || v < 1 || v > 100) throw new Error("--quality must be 1-100");
      o.quality = v;
    } else if (a.startsWith("-")) throw new Error(`Unknown option for dewatermark: ${a}`);
    else positional.push(a);
  }
  if (positional.length === 0) throw new Error("Missing <image|dir|video> argument.");
  if (positional.length > 1) throw new Error("One input at a time. Run it again for the next file.");
  o.target = positional[0];
  if (o.box !== null && !parseBox(o.box)) throw new Error(`--box needs four numbers "x,y,w,h", got "${o.box}"`);
  return o;
}

/** Extension the output should carry. `keep` falls back to webp for formats sharp cannot write. */
function targetExt(src: string, format: Format): string {
  if (format === "jpg") return ".jpg";
  if (format === "webp") return ".webp";
  const ext = path.extname(src).toLowerCase();
  return WRITABLE_EXT.has(ext) ? ext : ".webp";
}

function encode(pipe: sharp.Sharp, ext: string, quality: number): sharp.Sharp {
  if (ext === ".png") return pipe.png({ compressionLevel: 9 });
  if (ext === ".jpg" || ext === ".jpeg") return pipe.jpeg({ quality, chromaSubsampling: "4:4:4" });
  return pipe.webp({ quality });
}

/** Default destination beside the source, format-appropriate. */
function cleanName(src: string, format: Format): string {
  const ext = path.extname(src);
  return path.join(path.dirname(src), `${path.basename(src, ext)}.clean${targetExt(src, format)}`);
}

async function processImage(
  src: string,
  dst: string,
  box: Box,
  ref: { w: number; h: number },
  quality: number,
  format: Format,
): Promise<{ marked: boolean; adjusted: boolean; residual: boolean }> {
  const meta = await sharp(src).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("could not read image dimensions");

  const scaled = scaleBox(box, ref.w, ref.h, W, H);
  const fitted = fitBox(scaled, W, H);
  // toColourspace before removeAlpha: a greyscale or palette source would
  // otherwise hand back a single channel and the solver would read past the end.
  const { data } = await sharp(src)
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const before = markStrength(data, W, H, 3, fitted);
  inpaintRegion(data, W, H, 3, fitted);
  // Measured again on the solved pixels, because "the mark was there" is not
  // the same claim as "the mark is gone". A box the solver had to move can
  // miss the mark entirely and leave it sitting there; counting that as a
  // success is the one lie this command must not tell.
  const after = markStrength(data, W, H, 3, fitted);

  const buf = await encode(sharp(data, { raw: { width: W, height: H, channels: 3 } }), targetExt(src, format), quality).toBuffer();
  mkdirSync(path.dirname(dst), { recursive: true });
  // Written straight out rather than via a ".tmp" sibling: sharp infers the
  // encoder from the output extension, and ".clean.png.tmp" has none.
  writeFileSync(dst, buf);
  return {
    marked: before > MARK_PRESENT,
    adjusted: fitted.x !== scaled.x || fitted.y !== scaled.y || fitted.w !== scaled.w || fitted.h !== scaled.h,
    residual: before > MARK_PRESENT && after > MARK_PRESENT,
  };
}

/**
 * Process a list of images.
 *
 * `resolveOut` maps a source path to its destination rather than taking a
 * directory: for a single image the destination is a FILE beside it, and
 * passing that path in as a directory made mkdir create `photo.clean.png/`
 * with the real output buried inside it. Every mode writes somewhere different,
 * so the mapping is what actually differs.
 *
 * One bad file must not kill the batch — a box near an edge fails on some
 * resolutions and not others — so failures are collected and reported instead
 * of thrown.
 */
async function runImages(
  files: string[],
  resolveOut: (src: string) => string,
  box: Box,
  ref: { w: number; h: number },
  quality: number,
  format: Format,
): Promise<{ total: number; marked: number; adjusted: number; residual: number; failures: DewatermarkFailure[]; last: string }> {
  let marked = 0;
  let adjusted = 0;
  let residual = 0;
  const failures: DewatermarkFailure[] = [];
  let last = "";
  const bar = files.length > 1 ? progress(files.length, "frames") : null;
  for (const src of files) {
    const dst = resolveOut(src);
    try {
      const r = await processImage(src, dst, box, ref, quality, format);
      if (r.marked) marked++;
      if (r.adjusted) adjusted++;
      if (r.residual) residual++;
      last = dst;
    } catch (e) {
      failures.push({ file: src, reason: e instanceof Error ? e.message : String(e) });
    }
    bar?.tick();
  }
  bar?.done();
  return { total: files.length, marked, adjusted, residual, failures, last };
}

interface VideoMeta {
  width: number;
  height: number;
  fps: number;
}

async function probeVideo(file: string): Promise<VideoMeta> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate",
    "-of", "json",
    file,
  ]);
  const s = (JSON.parse(stdout) as { streams?: { width?: number; height?: number; r_frame_rate?: string }[] }).streams?.[0] ?? {};
  const [n, d] = String(s.r_frame_rate ?? "0/1").split("/").map(Number);
  return { width: s.width ?? 0, height: s.height ?? 0, fps: d ? n / d : 30 };
}

/** Validated numeric entry, one field at a time, so a pasted typo can be fixed. */
async function askNumber(ask: Ask, label: string): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await ask(`  ${label}`, "");
    if (raw === "") throw new Error(`No area given — pass --box=x,y,w,h or --auto to skip the prompt.`);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
    log.warn(`${label} must be a number`);
  }
  throw new Error(`No usable ${label} after 3 tries — pass --box=x,y,w,h or --auto.`);
}

async function resolveBox(ask: Ask, ref: string, o: DewatermarkOptions): Promise<Box> {
  if (o.box) {
    const b = parseBox(o.box);
    if (b) return b;
  }
  if (o.auto || o.yes) {
    const b = await guessBox(ref);
    log.step(`guessing ${b.x},${b.y} ${b.w}x${b.h} — override with --box if it is wrong`);
    return b;
  }
  // createAsk refuses non-TTY with a generic readline complaint; say the useful
  // thing instead, because a pipe or CI run has no way to answer.
  if (!process.stdin.isTTY) {
    throw new Error(`Cannot prompt without a TTY — pass --box=x,y,w,h or --auto.`);
  }

  const html = writePicker(ref, path.join(tmpdir(), `siteforge-wm-${randomUUID().slice(0, 8)}.html`));
  if (o.open && (await openBrowser(html))) {
    log.step("a picker should be open in your browser");
  } else {
    log.step("open this to pick the box by dragging:");
    log.dim(`    ${html}`);
  }
  log.dim("  drag a box around the mark, press 'copy coordinates', then paste them here");
  log.dim("  (or leave it blank and type the four numbers one per line)");
  log.blank();

  const pasted = parseBox(await ask("  x,y,w,h", ""));
  if (pasted) return pasted;

  const [x, y, w, h] = [
    await askNumber(ask, "x"),
    await askNumber(ask, "y"),
    await askNumber(ask, "width"),
    await askNumber(ask, "height"),
  ];
  if (w <= 0 || h <= 0) throw new Error("width and height must be greater than zero");
  return { x, y, w, h };
}

async function cleanVideo(
  target: string,
  box: Box,
  ref: { w: number; h: number },
  o: DewatermarkOptions,
): Promise<{ total: number; marked: number; adjusted: number; residual: number; failures: DewatermarkFailure[]; output: string }> {
  const work = path.join(tmpdir(), `siteforge-wm-${randomUUID().slice(0, 8)}`);
  const frames = path.join(work, "frames");
  const clean = path.join(work, "clean");
  mkdirSync(frames, { recursive: true });
  mkdirSync(clean, { recursive: true });
  const dst = o.out
    ? path.resolve(o.out)
    : path.join(path.dirname(target), `${path.basename(target, path.extname(target))}.clean.mp4`);

  try {
    log.step("decoding frames");
    await execFileAsync(
      "ffmpeg",
      ["-v", "error", "-y", "-i", target, "-fps_mode", "passthrough", "-q:v", "2", path.join(frames, "%06d.png")],
      { maxBuffer: 1024 * 1024 * 32 },
    );
    const pngs = readdirSync(frames).filter((f) => f.endsWith(".png")).sort().map((f) => path.join(frames, f));
    if (!pngs.length) throw new Error("ffmpeg produced no frames");

    const meta = await probeVideo(target);
    log.step(`${meta.width}x${meta.height} @ ${meta.fps.toFixed(3)} fps — solving ${pngs.length} frames`);
    // Frames carry the mark at the video's own scale, not the preview still's,
    // so the box is re-expressed against the real video size.
    const vbox = fitBox(scaleBox(box, ref.w, ref.h, meta.width, meta.height), meta.width, meta.height);
    const r = await runImages(pngs, (s) => path.join(clean, `${path.basename(s, ".png")}.webp`), vbox, { w: meta.width, h: meta.height }, o.quality, "webp");

    log.step(`encoding ${dst}`);
    mkdirSync(path.dirname(dst), { recursive: true });
    const crf = Math.max(12, Math.min(28, Math.round(37.5 - o.quality * 0.25)));
    // Audio is copied rather than dropped: a video that loses its soundtrack
    // because of a watermark fix is a worse video than the watermarked one.
    await execFileAsync(
      "ffmpeg",
      ["-v", "error", "-y", "-framerate", String(meta.fps), "-i", path.join(clean, "%06d.webp"), "-i", target,
        "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-crf", String(crf), "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-shortest", dst],
      { maxBuffer: 1024 * 1024 * 32 },
    );
    return { ...r, output: dst };
  } finally {
    await execFileAsync("rm", ["-rf", work]).catch(() => undefined);
  }
}

export async function runDewatermark(ask: Ask, o: DewatermarkOptions): Promise<DewatermarkResult> {
  const target = path.resolve(o.target);
  if (!existsSync(target)) throw new Error(`No such file or directory: ${o.target}`);

  const ext = path.extname(target).toLowerCase();
  const kind: DewatermarkResult["kind"] = !ext ? "frames" : VID_EXT.has(ext) ? "video" : "image";
  if (kind === "image" && !IMG_EXT.has(ext)) {
    throw new Error(`Unsupported file type "${ext}" — pass an image, a directory of images, or a video`);
  }
  if (kind === "video" && !(await commandExists("ffmpeg"))) {
    throw new Error("Video needs ffmpeg and ffprobe on PATH — run: siteforge doctor");
  }

  let files: string[] = [];
  if (kind === "frames") {
    files = readdirSync(target)
      .filter((f) => IMG_EXT.has(path.extname(f).toLowerCase()))
      .sort()
      .map((f) => path.join(target, f));
    if (!files.length) throw new Error(`No images found in ${o.target}`);
  } else if (kind === "image") files = [target];

  // The first still is what you look at when choosing a box. For video that
  // means decoding one frame — the mark sits in the same place throughout.
  let ref = files[0];
  let tmpRef: string | null = null;
  if (kind === "video") {
    tmpRef = path.join(tmpdir(), `siteforge-wm-ref-${randomUUID().slice(0, 8)}.png`);
    await execFileAsync("ffmpeg", ["-v", "error", "-y", "-i", target, "-frames:v", "1", tmpRef]);
    ref = tmpRef;
  }

  try {
    const meta = await sharp(ref).metadata();
    const refSize = { w: meta.width ?? 0, h: meta.height ?? 0 };
    log.step(`${kind}  ${target}`);
    if (kind === "frames") log.dim(`  ${files.length} images`);

    const box = await resolveBox(ask, ref, o);

    // ── confirm against a preview ──
    log.blank();
    log.dim("  the marked area (the mark should be centred in this):");
    log.blank();
    const preview = await asciiPreview(ref, box).catch(() => "(preview unavailable)");
    for (const line of preview.split("\n").slice(0, 18)) log.dim(`    ${line}`);
    log.blank();
    log.step(`solving ${box.w}x${box.h} at ${box.x},${box.y}`);

    // --yes and --json both mean "do not wait for a keypress".
    if (!o.yes && !isJsonMode()) {
      const answer = await ask("  proceed?", "y");
      if (/^n/i.test(answer)) throw new Error("Cancelled — nothing was written.");
    }

    // ── run ──
    let out: { total: number; marked: number; adjusted: number; residual: number; failures: DewatermarkFailure[]; output: string };
    if (kind === "video") {
      out = await cleanVideo(target, box, refSize, o);
    } else {
      const outDir =
        kind === "frames"
          ? o.out
            ? path.resolve(o.out)
            : path.join(path.dirname(target), `${path.basename(target)}-clean`)
          : null;
      const r = await runImages(
        files,
        (src) =>
          outDir
            ? path.join(outDir, path.basename(src, path.extname(src)) + targetExt(src, o.format))
            : o.out
              ? path.resolve(o.out)
              : cleanName(src, o.format),
        box,
        refSize,
        o.quality,
        o.format,
      );
      out = { ...r, output: outDir ?? r.last ?? o.out ?? "" };
    }

    const clean = out.total - out.marked;
    log.blank();
    if (out.failures.length) {
      log.warn(`${out.failures.length} file(s) skipped — first: ${out.failures[0].reason}`);
    }
    log.ok(`${out.total} item(s) → ${out.output}`);
    const pct = out.total ? Math.round((out.marked / out.total) * 100) : 0;
    if (out.marked) log.ok(`the mark was present in ${pct}% of them (${clean} already clean)`);
    else log.warn("no mark was present in any of them — that box was empty, try a better one");

    if (out.residual) {
      // Said plainly rather than folded into the success line: these files
      // still carry the mark, and a box the solver had to move is the usual
      // reason. Everything else on the line is a real solve.
      log.warn(`${out.residual} still ${out.residual === 1 ? "shows" : "show"} the mark after solving — its box could not be used as drawn`);
    } else if (out.adjusted) {
      log.dim(`  ${out.adjusted} had the box nudged to fit inside the frame — all came out clean`);
    }

    const single = kind !== "frames";
    const bytes = single && out.output && existsSync(out.output) ? statSync(out.output).size : 0;
    if (bytes) log.dim(`  ${formatBytes(bytes)}`);
    log.blank();

    return {
      target,
      kind,
      box,
      output: out.output,
      total: out.total,
      marked: out.marked,
      clean,
      adjusted: out.adjusted,
      residual: out.residual,
      bytes,
      failures: out.failures,
    };
  } finally {
    if (tmpRef) unlinkSync(tmpRef);
  }
}