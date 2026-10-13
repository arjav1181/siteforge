/**
 * The solver. Pure pixel math, no sharp, no I/O — unit tested directly.
 *
 * Nothing here paints over a mark. Inside the selected area it SOLVES for the
 * background: the Laplace equation ∇²u = 0 is relaxed from the surrounding
 * pixels held fixed, so the surface runs as smoothly through the gap as it did
 * on either side. That is the 2D equivalent of interpolating a missing sample
 * out of a sequence, and it is the only one of these methods that reconstructs
 * a background rather than substituting an average:
 *
 *   blur      carries the mark's own energy outward -> leaves a glow
 *   despeckle same energy, spread wider               -> leaves a haze
 *   median    needs a kernel wider than the mark       -> rounds it off
 *   laplace   solves for a smooth surface              -> nothing left behind
 *
 * Solved coarse-to-fine, because a direct sweep across an NxN hole needs
 * O(n²) iterations to propagate the boundary.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InpaintOptions {
  /** Coarse grid decimation. Higher = faster, blockier initial guess. */
  factor?: number;
  coarseIters?: number;
  fineIters?: number;
}

/**
 * Above this, the marked box really did contain a mark. See `markStrength`.
 *
 * Measured on real frames, the same metric that looked useless as "distance to
 * a blurred copy" separates cleanly once it compares the hole to its own
 * surroundings:
 *
 *     mark present        15.6
 *     solved by this       1.5
 *     solved previously    1.8
 *     an empty area        0.1
 */
export const MARK_PRESENT = 6;

/** Gauss-Seidel with SOR; stops early once the field has settled. */
function relax(g: Float64Array, unknown: Uint8Array, W: number, H: number, iters: number, omega: number): void {
  for (let it = 0; it < iters; it++) {
    let md = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!unknown[i]) continue;
        const l = x > 0 ? g[i - 1] : g[i];
        const r = x < W - 1 ? g[i + 1] : g[i];
        const u = y > 0 ? g[i - W] : g[i];
        const d = y < H - 1 ? g[i + W] : g[i];
        const delta = omega * ((l + r + u + d) * 0.25 - g[i]);
        g[i] += delta;
        if (Math.abs(delta) > md) md = Math.abs(delta);
      }
    }
    if (md < 0.004) return;
  }
}

/** The known ring the solver uses as its boundary condition, and how wide it must be. */
export function ringFor(w: number, h: number): number {
  return Math.max(14, Math.round(Math.max(w, h) * 0.4));
}

/**
 * True when the box plus its boundary ring fits inside the frame.
 *
 * Mirrors the guard in `inpaintRegion` exactly — the crop runs from
 * `box.x - ring` to `box.x + box.w + ring`, so the ring only has to clear the
 * far edge by one ring's width, not two. A stricter reading here rejects boxes
 * the solver accepts, and shrinks good boxes for no reason.
 */
export function boxFits(box: Box, W: number, H: number): boolean {
  const ring = ringFor(box.w, box.h);
  const rx = box.x - ring;
  const ry = box.y - ring;
  return rx >= 0 && ry >= 0 && rx + box.w + ring * 2 <= W && ry + box.h + ring * 2 <= H;
}

/** Fill a rectangle by solving ∇²u = 0 from its surroundings, in place. */
export function inpaintRegion(
  data: Uint8Array,
  W: number,
  H: number,
  channels: number,
  box: Box,
  opts: InpaintOptions = {},
): void {
  const { factor = 4, coarseIters = 4000, fineIters = 300 } = opts;
  const RING = ringFor(box.w, box.h);

  // Hole plus a known ring. The ring is the boundary condition AND tells the
  // solver which way the local gradient runs, so it must be generous.
  const rx = box.x - RING;
  const ry = box.y - RING;
  const rw = box.w + RING * 2;
  const rh = box.h + RING * 2;
  if (rx < 0 || ry < 0 || rx + rw > W || ry + rh > H) {
    throw new Error(
      `marked area (${box.w}x${box.h} at ${box.x},${box.y}) is too close to an edge to solve from — mark a smaller box`,
    );
  }

  // ── coarse pass: box-average the crop onto a small grid ──
  const cw = Math.ceil(rw / factor);
  const ch = Math.ceil(rh / factor);
  const coarse = new Float64Array(cw * ch * channels);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const acc = new Float64Array(channels);
      let n = 0;
      for (let dy = 0; dy < factor; dy++) {
        const py = ry + cy * factor + dy;
        if (py < 0 || py >= H) continue;
        for (let dx = 0; dx < factor; dx++) {
          const px = rx + cx * factor + dx;
          if (px < 0 || px >= W) continue;
          const o = (py * W + px) * channels;
          for (let c = 0; c < channels; c++) acc[c] += data[o + c];
          n++;
        }
      }
      const ci = (cy * cw + cx) * channels;
      for (let c = 0; c < channels; c++) coarse[ci + c] = n ? acc[c] / n : 0;
    }
  }

  const cU = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const px = rx + cx * factor + factor / 2;
      const py = ry + cy * factor + factor / 2;
      if (px >= box.x && px < box.x + box.w && py >= box.y && py < box.y + box.h) cU[cy * cw + cx] = 1;
    }
  }
  for (let c = 0; c < channels; c++) {
    const g = new Float64Array(cw * ch);
    for (let i = 0; i < cw * ch; i++) g[i] = coarse[i * channels + c];
    relax(g, cU, cw, ch, coarseIters, 1.9);
    for (let i = 0; i < cw * ch; i++) coarse[i * channels + c] = g[i];
  }

  // ── bilinear upsample of the coarse field back to full crop resolution ──
  const fine = new Float64Array(rw * rh * channels);
  for (let y = 0; y < rh; y++) {
    const fy = y / factor - 0.5;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    const ya = Math.min(Math.max(y0, 0), ch - 1);
    const yb = Math.min(Math.max(y0 + 1, 0), ch - 1);
    for (let x = 0; x < rw; x++) {
      const fx = x / factor - 0.5;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const xa = Math.min(Math.max(x0, 0), cw - 1);
      const xb = Math.min(Math.max(x0 + 1, 0), cw - 1);
      const o = (y * rw + x) * channels;
      for (let c = 0; c < channels; c++) {
        fine[o + c] =
          (coarse[(ya * cw + xa) * channels + c] * (1 - tx) + coarse[(ya * cw + xb) * channels + c] * tx) * (1 - ty) +
          (coarse[(yb * cw + xa) * channels + c] * (1 - tx) + coarse[(yb * cw + xb) * channels + c] * tx) * ty;
      }
    }
  }

  // ── fine pass: refine against the real ring pixels ──
  const fU = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const px = rx + x;
      const py = ry + y;
      if (px >= box.x && px < box.x + box.w && py >= box.y && py < box.y + box.h) fU[y * rw + x] = 1;
    }
  }
  for (let c = 0; c < channels; c++) {
    const g = new Float64Array(rw * rh);
    for (let i = 0; i < rw * rh; i++) {
      g[i] = fU[i]
        ? fine[i * channels + c]
        : data[((ry + Math.floor(i / rw)) * W + (rx + (i % rw))) * channels + c];
    }
    relax(g, fU, rw, rh, fineIters, 1.6);
    for (let i = 0; i < rw * rh; i++) {
      if (!fU[i]) continue;
      const o = ((ry + Math.floor(i / rw)) * W + (rx + (i % rw))) * channels + c;
      data[o] = Math.max(0, Math.min(255, Math.round(g[i])));
    }
  }
}

/**
 * How much brighter the marked box is than the ring around it.
 *
 * This is the honest "was there actually a mark in here" check, and it matters
 * more than it looks: a wrong box does not fail, it quietly smooths whatever
 * you aimed it at. Reporting it per item is the only way that is visible.
 */
export function markStrength(data: Uint8Array, W: number, H: number, channels: number, box: Box): number {
  const pad = Math.max(16, Math.round(Math.max(box.w, box.h) * 0.4));
  const lum = (x: number, y: number) => {
    const o = (y * W + x) * channels;
    return (data[o] + data[o + 1] + data[o + 2]) / 3;
  };

  let inSum = 0;
  let inN = 0;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      inSum += lum(x, y);
      inN++;
    }
  }

  // The ring is excluded 8px from the hole so a blur of the mark itself cannot
  // inflate the "background" it is being compared against.
  const r = { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
  let outSum = 0;
  let outN = 0;
  for (let y = Math.max(0, r.y); y < Math.min(H, r.y + r.h); y++) {
    for (let x = Math.max(0, r.x); x < Math.min(W, r.x + r.w); x++) {
      if (x >= box.x - 8 && x < box.x + box.w + 8 && y >= box.y - 8 && y < box.y + box.h + 8) continue;
      outSum += lum(x, y);
      outN++;
    }
  }
  if (!inN || !outN) return 0;
  return inSum / inN - outSum / outN;
}

/**
 * Re-express a box drawn on one resolution against another.
 *
 * An asset directory holds a hero at 2560px and its thumbnail at 640px — the
 * mark sits in the same *relative* corner, so one box drawn on a preview has to
 * travel with the batch. Without this the run silently misses everything but
 * the file you happened to measure.
 */
export function scaleBox(box: Box, fromW: number, fromH: number, toW: number, toH: number): Box {
  const sx = toW / fromW;
  const sy = toH / fromH;
  return {
    x: Math.round(box.x * sx),
    y: Math.round(box.y * sy),
    w: Math.max(1, Math.round(box.w * sx)),
    h: Math.max(1, Math.round(box.h * sy)),
  };
}

/**
 * Pull a box inside the frame until the solver can actually run on it.
 *
 * A box drawn on a 2560px hero lands off-canvas on a 640px thumbnail. Two
 * corrections are needed, and the second is the one that is easy to miss: the
 * solver's ring is ~40% of the box's long side, so a box can occupy barely half
 * the frame and still have no room for its boundary condition. The box is
 * therefore shrunk and then nudged inward, not merely clipped.
 *
 * Frames too small to take even a 1px box plus its 14px minimum ring are left
 * unsatisfiable on purpose — `inpaintRegion` throws and the caller records the
 * failure, which is more honest than smoothing a wrong patch of the image.
 *
 * The size predicate needs two rings, not one: the box must clear `ring` on
 * its near edges and the crop adds another `ring` past its far ones, so
 * `w + 2*ring <= W`. See `boxFits` for why that is the exact requirement.
 */
export function fitBox(box: Box, W: number, H: number): Box {
  // Clip to the frame first, so the box stays anchored on the mark rather than
  // sliding off it, then shrink only as far as solvability demands.
  let w = Math.max(1, Math.min(Math.round(box.w), W, Math.max(1, W - Math.round(box.x))));
  let h = Math.max(1, Math.min(Math.round(box.h), H, Math.max(1, H - Math.round(box.y))));
  const fitsSize = () => w + 2 * ringFor(w, h) <= W && h + 2 * ringFor(w, h) <= H;
  for (let guard = 0; guard < 64 && !fitsSize(); guard++) {
    w = Math.max(1, Math.floor(w * 0.9));
    h = Math.max(1, Math.floor(h * 0.9));
  }
  const ring = ringFor(w, h);
  const x = Math.max(ring, Math.min(Math.round(box.x), W - w - ring));
  const y = Math.max(ring, Math.min(Math.round(box.y), H - h - ring));
  return { x, y, w, h };
}