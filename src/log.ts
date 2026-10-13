/**
 * Log primitives.
 *
 * The API every command already uses, reimplemented on the detected terminal
 * capabilities. What changed versus the old version: real status glyphs, a
 * colour palette that respects NO_COLOR/FORCE_COLOR/TERM=dumb, errors always on
 * stderr, and JSON mode able to suppress decoration entirely instead of just
 * moving it.
 *
 * For richer output — spinners, live task lists, panels, tables — reach for
 * `ui/render`. For prompts, `ui/prompt`.
 */
import { style, glyph } from "./ui/color.js";
import { out, err, setJsonMode, isJsonMode } from "./ui/stream.js";

export { setJsonMode, isJsonMode };

/** Indentation shared by every human-facing line, so output reads as one column. */
const INDENT = "  ";

export const log = {
  /** Starting something. Cyan, matches the `▸` convention people already know. */
  step(msg: string) {
    out().write(`${INDENT}${style.cyan(glyph.arrow)} ${msg}\n`);
  },
  /** Finished, successfully. */
  ok(msg: string) {
    out().write(`${INDENT}${style.green(glyph.success)} ${msg}\n`);
  },
  /** Worth knowing, not fatal. */
  warn(msg: string) {
    out().write(`${INDENT}${style.yellow(glyph.warn)} ${msg}\n`);
  },
  /** Failed. Always stderr, so `| head` does not swallow it. */
  err(msg: string) {
    err().write(`${INDENT}${style.red(glyph.fail)} ${msg}\n`);
  },
  /** Detail that should not compete with the message above it. */
  dim(msg: string) {
    out().write(`${INDENT}${style.gray(msg)}\n`);
  },
  /** Emphasised line, used for headings. */
  title(msg: string) {
    out().write(`${style.bold(msg)}\n`);
  },
  /** Indented secondary text. */
  info(msg: string) {
    out().write(`${INDENT}${msg}\n`);
  },
  blank() {
    out().write("\n");
  },
  /** Unstyled write, routed like everything else (stderr in JSON mode). */
  raw(msg: string) {
    out().write(msg);
  },
};

/** Human-readable byte size lives in util.ts — one definition, imported everywhere. */

/**
 * A single-line progress counter that overwrites itself.
 *
 * Collapses to nothing when the output is not a terminal: a CI log full of
 * `\r` sequences is unreadable, and the final summary line already carries the
 * result.
 */
export function progress(total: number, label: string) {
  let current = 0;
  const stream = () => (isJsonMode() ? process.stderr : process.stdout);
  const animate = Boolean(stream().isTTY) && !isJsonMode();
  const render = () => {
    if (!animate) return;
    stream().write(`\r  ${style.gray(`${current}/${total}`)} ${label}`);
  };
  return {
    tick(n = 1) {
      current = Math.min(total, current + n);
      render();
    },
    set(n: number) {
      current = Math.min(total, Math.max(0, n));
      render();
    },
    done(msg?: string) {
      current = total;
      if (animate) stream().write("\r\x1b[2K");
      if (msg) stream().write(`  ${msg}\n`);
    },
  };
}