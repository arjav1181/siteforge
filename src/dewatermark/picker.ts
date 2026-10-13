/**
 * Picking the area. A terminal cannot show a photograph, which is the whole
 * reason marking by hand is otherwise unpleasant, so the default path is a
 * browser canvas you drag a box in. ASCII preview is the no-browser fallback.
 */
import { writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import type { Box } from "./inpaint.js";

const execFileAsync = promisify(execFile);

/** Accepts "1,2,3,4" in any spacing, pasted straight from the picker. */
export function parseBox(s: string): Box | null {
  const n = String(s)
    .split(/[,\s]+/)
    .map(Number)
    .filter((v) => Number.isFinite(v));
  if (n.length < 4) return null;
  const [x, y, w, h] = n;
  if (w <= 0 || h <= 0 || x < 0 || y < 0) return null;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/**
 * Advisory only — see the honesty note in DEWATERMARK_HELP.
 *
 * The obvious auto-detect is diffing frames: a watermark is static, a scene is
 * not. Measured on a real sequence, that does NOT work here — the sparkle is
 * SEMI-TRANSPARENT, so its pixels shift as the background moves behind it.
 * Spread inside the mark was 22.7 against a 23.8 frame average: no signal. A
 * median across frames does not help either; the moving subject is still
 * brighter and wins. Guessing is not an option either — a wrong box silently
 * erases the wrong part of someone's photo. So the guess is a starting point
 * you override, never a decision.
 */
export async function guessBox(file: string): Promise<Box> {
  const m = await sharp(file).metadata();
  const w = m.width ?? 0;
  const h = m.height ?? 0;
  const side = Math.round(Math.min(w, h) * 0.12);
  return {
    x: Math.round(w * 0.85) - Math.round(side / 2),
    y: Math.round(h * 0.78) - Math.round(side / 2),
    w: side,
    h: side,
  };
}

const RAMP = " .:-=+*#%@";

/** Terminal-sized greyscale view of the box and its surroundings. */
export async function asciiPreview(file: string, box: Box): Promise<string> {
  const meta = await sharp(file).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const pad = Math.round(Math.max(box.w, box.h) * 0.3) || 16;
  const left = Math.max(0, Math.min(box.x - pad, W - 1));
  const top = Math.max(0, Math.min(box.y - pad, H - 1));
  const width = Math.max(1, Math.min(box.w + pad * 2, W - left));
  const height = Math.max(1, Math.min(box.h + pad * 2, H - top));
  const cols = Math.min(width, 54);
  // Terminal cells are ~2x taller than wide; asking for equal counts stretches
  // the preview vertically and makes the shape hard to judge.
  const rows = Math.max(1, Math.min(18, Math.round((cols * height) / width / 2)));
  const { data, info } = await sharp(file)
    .extract({ left, top, width, height })
    .resize(cols, rows, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let out = "";
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      out += RAMP[Math.min(9, Math.floor((data[y * info.width + x] / 255) * 10))];
    }
    out += "\n";
  }
  return out;
}

/**
 * A real picker: the image in a browser, drag a box, copy the coordinates.
 */
export function writePicker(file: string, out: string): string {
  const src = `file://${file}`;
  const html = `<!doctype html><meta charset=utf-8>
<title>mark the watermark</title>
<style>
 body{margin:0;background:#111;color:#eee;font:13px ui-monospace,monospace}
 header{padding:10px 14px;background:#000;position:sticky;top:0;border-bottom:1px solid #333}
 canvas{display:block;cursor:crosshair;max-width:100%}
 b{color:#7cf}
</style>
<header>drag a box around the mark &middot; it is filled at full size below
 &nbsp;<span id=out>—</span>
 &nbsp;<button onclick="copy()">copy coordinates</button></header>
<canvas id=c></canvas>
<script>
const img=new Image();
img.onload=()=>{
 const c=document.getElementById('c');
 c.width=img.naturalWidth;c.height=img.naturalHeight;
 const g=c.getContext('2d');g.drawImage(img,0,0);
 let s=null;
 const show=n=>{document.getElementById('out').textContent=n.x+' , '+n.y+' , '+n.w+' , '+n.h};
 const draw=cur=>{
  g.drawImage(img,0,0);
  if(!cur)return;
  g.save();g.fillStyle='rgba(0,180,255,.22)';g.strokeStyle='#00d5ff';g.lineWidth=2;
  g.fillRect(cur.x,cur.y,cur.w,cur.h);g.strokeRect(cur.x,cur.y,cur.w,cur.h);g.restore();
 };
 c.onmousedown=e=>{s={x:e.offsetX,y:e.offsetY,w:0,h:0};draw(s);show(s)};
 c.onmousemove=e=>{
  if(!s)return;
  s.w=e.offsetX-s.x;s.h=e.offsetY-s.y;
  const n={x:Math.min(s.x,e.offsetX),y:Math.min(s.y,e.offsetY),w:Math.abs(s.w),h:Math.abs(s.h)};
  show(n);draw(n);
 };
 c.onmouseup=()=>{s=null};
};
img.src=${JSON.stringify(src)};
function copy(){
 const t=document.getElementById('out').textContent;
 navigator.clipboard.writeText(t).then(()=>{document.getElementById('out').textContent='COPIED: '+t});
}
</script>`;
  writeFileSync(out, html);
  return out;
}

export async function openBrowser(target: string): Promise<boolean> {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const argv = process.platform === "win32" ? ["/c", "start", "", target] : [target];
  try {
    const child = execFileAsync(cmd, argv);
    child.child.unref();
    return true;
  } catch {
    return false;
  }
}