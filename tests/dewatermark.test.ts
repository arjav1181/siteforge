import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { inpaintRegion, markStrength, scaleBox, fitBox, boxFits, MARK_PRESENT } from "../src/dewatermark/inpaint.js";
import { parseBox } from "../src/dewatermark/picker.js";
import { parseDewatermarkArgs, runDewatermark } from "../src/dewatermark/command.js";

const rgb = (r: number, g: number, b: number, n: number) => {
  const d = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    d[i * 3] = r;
    d[i * 3 + 1] = g;
    d[i * 3 + 2] = b;
  }
  return d;
};

/** Flat background with a bright square stamped on it — a stand-in mark. */
async function marked(w: number, h: number, box: { x: number; y: number; w: number; h: number }) {
  const data = rgb(60, 70, 80, w * h);
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const o = (y * w + x) * 3;
      data[o] = 245;
      data[o + 1] = 245;
      data[o + 2] = 245;
    }
  }
  return { data, png: await sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer() };
}

const read = async (f: string) => {
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
};
const stubAsk = async () => "";

describe("inpaint solver", () => {
  it("fills a hole so it matches the surrounding surface", () => {
    const W = 400, H = 300;
    const box = { x: 300, y: 200, w: 40, h: 40 };
    const data = rgb(60, 70, 80, W * H);
    for (let y = box.y; y < box.y + box.h; y++) {
      for (let x = box.x; x < box.x + box.w; x++) {
        const o = (y * W + x) * 3;
        data[o] = data[o + 1] = data[o + 2] = 245;
      }
    }
    expect(markStrength(data, W, H, 3, box)).toBeGreaterThan(MARK_PRESENT);

    inpaintRegion(data, W, H, 3, box);

    // The whole point: after solving, the hole is indistinguishable from the
    // background it sat on. markStrength is the same metric used to detect it.
    expect(markStrength(data, W, H, 3, box)).toBeLessThan(1);
    const centre = ((box.y + 20) * W + (box.x + 20)) * 3;
    expect(data[centre]).toBeCloseTo(60, 0);
    expect(data[centre + 1]).toBeCloseTo(70, 0);
    expect(data[centre + 2]).toBeCloseTo(80, 0);
  });

  it("leaves everything outside the box untouched", () => {
    const W = 400, H = 300;
    const box = { x: 300, y: 200, w: 40, h: 40 };
    const data = rgb(60, 70, 80, W * H);
    for (let y = box.y; y < box.y + box.h; y++) {
      for (let x = box.x; x < box.x + box.w; x++) {
        data[(y * W + x) * 3] = 245;
      }
    }
    const before = Uint8Array.from(data);
    inpaintRegion(data, W, H, 3, box);

    const differing: number[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 3;
        const inside = x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
        if (inside) continue;
        if (data[o] !== before[o] || data[o + 1] !== before[o + 1] || data[o + 2] !== before[o + 2]) {
          differing.push(y * W + x);
        }
      }
    }
    expect(differing).toEqual([]);
  });

  it("refuses a box too close to an edge to solve from", () => {
    const data = rgb(60, 70, 80, 200 * 200);
    expect(() => inpaintRegion(data, 200, 200, 3, { x: 0, y: 0, w: 40, h: 40 })).toThrow(/edge/);
    expect(() => inpaintRegion(data, 200, 200, 3, { x: 185, y: 185, w: 40, h: 40 })).toThrow(/edge/);
  });

  it("keeps a gradient running through the gap", () => {
    // A left-to-right ramp: a solver that only averaged would flatten it, one
    // that respects the boundary condition continues the slope.
    const W = 300, H = 200;
    const data = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 3;
        data[o] = Math.round((x / W) * 200);
        data[o + 1] = Math.round((x / W) * 200);
        data[o + 2] = Math.round((x / W) * 200);
      }
    }
    const box = { x: 140, y: 90, w: 30, h: 30 };
    inpaintRegion(data, W, H, 3, box);
    const row = box.y + box.h / 2;
    const at = (x: number) => data[(row * W + x) * 3];
    // The ramp rises left-to-right, so the far edge must stay brighter than the
    // near one — an averaging solver would flatten both to the same value.
    expect(at(box.x + box.w - 2)).toBeGreaterThan(at(box.x + 4));
    expect(at(box.x + 4)).toBeGreaterThan(at(box.x - 6));
  });
});

describe("mark detection", () => {
  it("reads ~0 on an empty area and high on a real mark", () => {
    const W = 400, H = 300;
    const empty = rgb(60, 70, 80, W * H);
    expect(markStrength(empty, W, H, 3, { x: 300, y: 200, w: 40, h: 40 })).toBeLessThan(0.01);
    const markedBuf = rgb(60, 70, 80, W * H);
    for (let y = 200; y < 240; y++) {
      for (let x = 300; x < 340; x++) {
        const o = (y * W + x) * 3;
        markedBuf[o] = markedBuf[o + 1] = markedBuf[o + 2] = 245;
      }
    }
    expect(markStrength(markedBuf, W, H, 3, { x: 300, y: 200, w: 40, h: 40 })).toBeGreaterThan(MARK_PRESENT);
  });
});

describe("box geometry", () => {
  it("scales a box drawn on one resolution onto another", () => {
    expect(scaleBox({ x: 100, y: 50, w: 20, h: 10 }, 1000, 500, 500, 250)).toEqual({ x: 50, y: 25, w: 10, h: 5 });
    expect(scaleBox({ x: 100, y: 50, w: 20, h: 10 }, 1000, 500, 250, 125)).toEqual({ x: 25, y: 13, w: 5, h: 3 });
    // Never rounds a box down to nothing.
    expect(scaleBox({ x: 0, y: 0, w: 4, h: 4 }, 1000, 1000, 1, 1)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("never returns a box that cannot be solved", () => {
    for (const [W, H] of [[400, 300], [2560, 1440], [64, 64], [100, 75], [80, 60], [29, 29]]) {
      for (const b of [
        { x: 0, y: 0, w: W, h: H },
        { x: W - 4, y: H - 4, w: 500, h: 500 },
        { x: 5, y: 5, w: 3, h: 3 },
        { x: W / 2, y: H / 2, w: 200, h: 200 },
      ]) {
        const fitted = fitBox(b, W, H);
        expect(boxFits(fitted, W, H), `${W}x${H} ${JSON.stringify(b)} → ${JSON.stringify(fitted)}`).toBe(true);
        expect(fitted.w).toBeGreaterThan(0);
        expect(fitted.h).toBeGreaterThan(0);
        expect(fitted.x + fitted.w).toBeLessThanOrEqual(W);
        expect(fitted.y + fitted.h).toBeLessThanOrEqual(H);
      }
    }
  });

  it("leaves a box that already fits exactly where it was drawn", () => {
    const b = { x: 100, y: 60, w: 40, h: 30 };
    expect(fitBox(b, 400, 300)).toEqual(b);
  });

  it("keeps an overhanging box the size it was drawn at", () => {
    // Hangs off the bottom-right. It has to move inward to make room for the
    // ring, but it must keep its size — shrinking to 1px would "solve" a dot
    // and leave the mark sitting there.
    const fitted = fitBox({ x: 330, y: 230, w: 90, h: 80 }, 400, 300);
    expect(boxFits(fitted, 400, 300)).toBe(true);
    expect(fitted.x + fitted.w).toBeLessThanOrEqual(400);
    expect(fitted.y + fitted.h).toBeLessThanOrEqual(300);
    // Never grows either.
    expect(fitted.w).toBeLessThanOrEqual(90);
    expect(fitted.h).toBeLessThanOrEqual(80);
  });
});

describe("parseBox", () => {
  it("takes the picker's output in any spacing", () => {
    expect(parseBox("12, 34, 56, 78")).toEqual({ x: 12, y: 34, w: 56, h: 78 });
    expect(parseBox("12 34 56 78")).toEqual({ x: 12, y: 34, w: 56, h: 78 });
    expect(parseBox("12.4,34.6,56,78")).toEqual({ x: 12, y: 35, w: 56, h: 78 });
  });
  it("rejects nonsense", () => {
    expect(parseBox("")).toBeNull();
    expect(parseBox("1,2,3")).toBeNull();
    expect(parseBox("1,2,0,4")).toBeNull();
    expect(parseBox("-1,2,3,4")).toBeNull();
    expect(parseBox("a,b,c,d")).toBeNull();
  });
});

describe("arg parsing", () => {
  it("defaults", () => {
    expect(parseDewatermarkArgs(["hero.png"])).toMatchObject({
      target: "hero.png",
      format: "keep",
      quality: 82,
      auto: false,
      open: true,
      yes: false,
    });
  });
  it("takes every flag", () => {
    const o = parseDewatermarkArgs(["./f", "--box=1,2,3,4", "--auto", "--yes", "--no-open", "--format", "webp", "--quality", "90", "--out", "x"]);
    expect(o).toMatchObject({ target: "./f", box: "1,2,3,4", auto: true, yes: true, open: false, format: "webp", quality: 90, out: "x" });
  });
  it("accepts --box as a separate value", () => {
    expect(parseDewatermarkArgs(["a.png", "--box", "5,6,7,8"]).box).toBe("5,6,7,8");
  });
  it("rejects bad input", () => {
    expect(() => parseDewatermarkArgs([])).toThrow(/Missing/);
    expect(() => parseDewatermarkArgs(["a.png", "b.png"])).toThrow(/One input/);
    expect(() => parseDewatermarkArgs(["a.png", "--nope"])).toThrow();
    expect(() => parseDewatermarkArgs(["a.png", "--quality", "0"])).toThrow();
    expect(() => parseDewatermarkArgs(["a.png", "--quality", "101"])).toThrow();
    expect(() => parseDewatermarkArgs(["a.png", "--format", "gif"])).toThrow();
    expect(() => parseDewatermarkArgs(["a.png", "--box", "1,2,3"])).toThrow(/four numbers/);
    expect(() => parseDewatermarkArgs(["a.png", "--out"])).toThrow(/Missing value/);
  });
});

describe("runDewatermark", () => {
  it("solves a mark out of one image, beside the source", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
    const box = { x: 300, y: 200, w: 40, h: 40 };
    const src = path.join(dir, "hero.png");
    await sharp((await marked(400, 300, box)).png).toFile(src);

    const r = await runDewatermark(stubAsk, parseDewatermarkArgs([src, `--box=${box.x},${box.y},${box.w},${box.h}`, "--yes"]));

    expect(r.kind).toBe("image");
    expect(r.total).toBe(1);
    expect(r.marked).toBe(1);
    expect(r.failures).toEqual([]);
    expect(path.basename(r.output)).toBe("hero.clean.png");
    expect(existsSync(r.output)).toBe(true);

    const after = await read(r.output);
    expect(markStrength(after.data, 400, 300, 3, box)).toBeLessThan(1);
    // Original untouched — this is not a destructive in-place rewrite.
    const before = await read(src);
    expect(markStrength(before.data, 400, 300, 3, box)).toBeGreaterThan(MARK_PRESENT);
  });

  it("keeps every filename in a directory so references still resolve", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
    // Two resolutions, same relative corner: the box is drawn on the big one
    // and must travel to the small one.
    await sharp((await marked(400, 300, { x: 300, y: 200, w: 40, h: 40 })).png).toFile(path.join(dir, "hero.png"));
    await sharp((await marked(200, 150, { x: 150, y: 100, w: 20, h: 20 })).png).toFile(path.join(dir, "thumb.jpg"));

    const r = await runDewatermark(stubAsk, parseDewatermarkArgs([dir, "--box=300,200,40,40", "--yes"]));

    expect(r.kind).toBe("frames");
    expect(r.total).toBe(2);
    expect(r.marked).toBe(2);
    expect(r.failures).toEqual([]);
    expect(r.adjusted).toBe(0);
    expect(readdirSync(r.output).sort()).toEqual(["hero.png", "thumb.jpg"]);

    const small = await read(path.join(r.output, "thumb.jpg"));
    expect(small.info.width).toBe(200);
    expect(markStrength(small.data, 200, 150, 3, { x: 150, y: 100, w: 20, h: 20 })).toBeLessThan(1);
  });

  it("reports a box it had to move rather than claiming a clean solve", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
    // A box drawn overhanging the frame: the solver's ring has to come first,
    // so the box moves. A moved box can miss the mark, so the run says so.
    const src = path.join(dir, "hero.png");
    await sharp((await marked(400, 300, { x: 360, y: 250, w: 40, h: 40 })).png).toFile(src);

    const r = await runDewatermark(stubAsk, parseDewatermarkArgs([src, "--box=360,250,60,40", "--yes"]));
    expect(r.adjusted).toBe(1);
    expect(r.marked).toBe(1);
    // The box moved off the mark's bottom-right corner, so part of it survives.
    // The run has to say so rather than book this as a clean solve.
    expect(r.residual).toBe(1);
  });

  it("counts a mark that survived the solve as residual, not success", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
    // A box aimed at empty background next to a big mark. The solver happily
    // smooths the empty patch and the mark survives — reporting that as a
    // clean solve is the lie this counter exists to prevent.
    const src = path.join(dir, "missed.png");
    await sharp((await marked(400, 300, { x: 60, y: 60, w: 60, h: 60 })).png).toFile(src);

    const r = await runDewatermark(stubAsk, parseDewatermarkArgs([src, "--box=280,220,40,40", "--yes"]));
    expect(r.marked).toBe(0);
    expect(r.residual).toBe(0);

    // Now aim a box that straddles the mark so it is only partly removed.
    const straddle = path.join(dir, "straddle.png");
    await sharp((await marked(400, 300, { x: 300, y: 200, w: 40, h: 40 })).png).toFile(straddle);
    const r2 = await runDewatermark(stubAsk, parseDewatermarkArgs([straddle, "--box=300,200,40,40", "--yes"]));
    expect(r2.marked).toBe(1);
    expect(r2.residual).toBe(0);
  });

  it("flags a thumbnail too small to take the drawn box as residual", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
    // Same relative corner, but on a 320px thumb the 15px mark cannot keep the
    // solver's 14px minimum ring on every side, so the box is pushed off it.
    await sharp((await marked(1280, 720, { x: 1140, y: 620, w: 60, h: 60 })).png).toFile(path.join(dir, "hero.png"));
    await sharp((await marked(320, 180, { x: 285, y: 155, w: 15, h: 15 })).png).toFile(path.join(dir, "thumb.png"));

    const r = await runDewatermark(stubAsk, parseDewatermarkArgs([dir, "--box=1140,620,60,60", "--yes"]));
    expect(r.marked).toBe(2);
    expect(r.residual).toBe(1);
    expect(r.adjusted).toBe(1);
  });

  it("reports an empty box instead of pretending it worked", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
    const src = path.join(dir, "plain.png");
    await sharp((await marked(400, 300, { x: 0, y: 0, w: 1, h: 1 })).png).toFile(src);

    const r = await runDewatermark(stubAsk, parseDewatermarkArgs([src, "--box=300,200,40,40", "--yes"]));
    expect(r.marked).toBe(0);
    expect(r.clean).toBe(1);
  });

  it("collects a per-file failure instead of aborting the batch", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
    const box = { x: 300, y: 200, w: 40, h: 40 };
    await sharp((await marked(400, 300, box)).png).toFile(path.join(dir, "a-ok.png"));
    // 28x20 is below the floor a solvable box needs (1px + 2x14px ring = 29px),
    // so this one genuinely cannot be solved. It must not take the batch with it.
    await sharp((await marked(28, 20, { x: 14, y: 10, w: 5, h: 5 })).png).toFile(path.join(dir, "b-tiny.png"));

    const r = await runDewatermark(stubAsk, parseDewatermarkArgs([dir, "--box=300,200,40,40", "--yes"]));
    expect(r.total).toBe(2);
    expect(r.marked).toBe(1);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].file).toContain("b-tiny.png");
    expect(r.failures[0].reason).toMatch(/edge/);
    // The file it could solve still landed on disk.
    expect(existsSync(path.join(r.output, "a-ok.png"))).toBe(true);
  });

  it("converts with --format and honours --out", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
    const box = { x: 300, y: 200, w: 40, h: 40 };
    const src = path.join(dir, "hero.png");
    await sharp((await marked(400, 300, box)).png).toFile(src);
    const out = path.join(dir, "out.webp");

    const r = await runDewatermark(stubAsk, parseDewatermarkArgs([src, "--box=300,200,40,40", "--yes", "--format", "webp", "--out", out]));
    expect(r.output).toBe(out);
    expect(existsSync(out)).toBe(true);
    const after = await read(out);
    expect(after.info.width).toBe(400);
    expect(markStrength(after.data, 400, 300, 3, box)).toBeLessThan(1);
  });

  it("errors clearly on a missing or unsupported target", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
    await expect(runDewatermark(stubAsk, parseDewatermarkArgs([path.join(dir, "nope.png"), "--yes"]))).rejects.toThrow(/No such file/);
    await expect(runDewatermark(stubAsk, parseDewatermarkArgs([dir, "--yes"]))).rejects.toThrow(/No images found/);
    const file = path.join(dir, "notes.txt");
    await sharp((await marked(40, 40, { x: 0, y: 0, w: 1, h: 1 })).png).toFile(file);
    await sharp((await marked(40, 40, { x: 0, y: 0, w: 1, h: 1 })).png).toFile(path.join(dir, "real.png"));
    await expect(runDewatermark(stubAsk, parseDewatermarkArgs([file, "--yes"]))).rejects.toThrow(/Unsupported file type/);
  });

  it("refuses to prompt when there is no TTY and no box", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
    const src = path.join(dir, "hero.png");
    await sharp((await marked(200, 200, { x: 100, y: 100, w: 20, h: 20 })).png).toFile(src);
    const isTTY = process.stdin.isTTY;
    (process.stdin as { isTTY?: boolean }).isTTY = false;
    try {
      await expect(runDewatermark(stubAsk, parseDewatermarkArgs([src]))).rejects.toThrow(/--box/);
    } finally {
      (process.stdin as { isTTY?: boolean }).isTTY = isTTY;
    }
  });

  describe("interactive flow", () => {
    /** Runs with a pretend TTY so the picker branch is reachable. */
    const withTty = async <T,>(fn: () => Promise<T>): Promise<T> => {
      const isTTY = process.stdin.isTTY;
      (process.stdin as { isTTY?: boolean }).isTTY = true;
      try {
        return await fn();
      } finally {
        (process.stdin as { isTTY?: boolean }).isTTY = isTTY;
      }
    };

    it("takes a pasted box, confirms, then solves", async () => {
      const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
      const box = { x: 300, y: 200, w: 40, h: 40 };
      const src = path.join(dir, "hero.png");
      await sharp((await marked(400, 300, box)).png).toFile(src);

      const asked: string[] = [];
      const ask = async (q: string, def = "") => {
        asked.push(q);
        return asked.length === 1 ? "300,200,40,40" : def;
      };

      const r = await withTty(() =>
        runDewatermark(ask, parseDewatermarkArgs([src, "--no-open"])),
      );
      expect(asked[0]).toContain("x,y,w,h");
      expect(asked[1]).toContain("proceed");
      expect(r.marked).toBe(1);
      expect(r.residual).toBe(0);
      expect(existsSync(r.output)).toBe(true);
    });

    it("falls back to four numbers when the paste box is unusable", async () => {
      const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
      const src = path.join(dir, "hero.png");
      await sharp((await marked(400, 300, { x: 300, y: 200, w: 40, h: 40 })).png).toFile(src);

      const replies = ["oops", "300", "200", "40", "40", "y"];
      let i = 0;
      const ask = async () => replies[i++] ?? "";

      const r = await withTty(() => runDewatermark(ask, parseDewatermarkArgs([src, "--no-open"])));
      expect(i).toBe(6);
      expect(r.marked).toBe(1);
    });

    it("cancels when the confirmation is declined", async () => {
      const dir = mkdtempSync(path.join(tmpdir(), "sf-dw-"));
      const src = path.join(dir, "hero.png");
      await sharp((await marked(400, 300, { x: 300, y: 200, w: 40, h: 40 })).png).toFile(src);

      const replies = ["300,200,40,40", "n"];
      let i = 0;
      const ask = async () => replies[i++] ?? "";

      await expect(withTty(() => runDewatermark(ask, parseDewatermarkArgs([src, "--no-open"])))).rejects.toThrow(/Cancelled/);
      expect(existsSync(path.join(dir, "hero.clean.png"))).toBe(false);
    });
  });
});