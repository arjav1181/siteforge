/**
 * Colour and glyph capability detection.
 *
 * Terminals lie about what they can do more often than people expect, so this
 * is decided once at startup and every writer goes through it:
 *
 *   NO_COLOR        any value disables colour (https://no-color.org)
 *   FORCE_COLOR     overrides everything, including NO_COLOR
 *   TERM=dumb       no colour, no glyphs — the honest "I am a pipe" signal
 *   not a TTY       no colour. CI logs are files, and escape codes in a log
 *                   are just noise a human has to read past.
 *
 * Glyphs are separate from colour: a terminal can easily take colour but not
 * Unicode. Braille spinners and box-drawing are pretty but meaningless in a
 * `cat logfile`, so they degrade on their own.
 */

const isTTY = Boolean(process.stdout.isTTY);

const env = process.env;

/** True when we should emit SGR escapes. */
export const colorEnabled: boolean = (() => {
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") return true;
  if (env.NO_COLOR !== undefined) return false;
  if (env.TERM === "dumb") return false;
  return isTTY;
})();

/**
 * True when we should emit box-drawing and spinner glyphs.
 *
 * Deliberately stricter than colour: `LANG=C` is the common signal for a
 * terminal that will render braille as question marks.
 */
export const unicodeEnabled: boolean = colorEnabled && env.TERM !== "linux" && !/^(C|POSIX)$/.test(env.LANG ?? "");

const wrap = (open: number, close: number) => (s: string) =>
  colorEnabled ? `\x1b[${open}m${s}\x1b[${close}m` : s;

export const style = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  underline: wrap(4, 24),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
  boldCyan: (s: string) => (colorEnabled ? `\x1b[1m\x1b[36m${s}\x1b[39m\x1b[22m` : s),
  boldGreen: (s: string) => (colorEnabled ? `\x1b[1m\x1b[32m${s}\x1b[39m\x1b[22m` : s),
  boldRed: (s: string) => (colorEnabled ? `\x1b[1m\x1b[31m${s}\x1b[39m\x1b[22m` : s),
  boldYellow: (s: string) => (colorEnabled ? `\x1b[1m\x1b[33m${s}\x1b[39m\x1b[22m` : s),
};

/**
 * Status glyphs. ASCII fallbacks are aligned to the same 1-cell width so
 * columns do not jump when a terminal loses Unicode mid-run.
 */
export const glyph = {
  success: unicodeEnabled ? "✔" : "+",
  fail: unicodeEnabled ? "✖" : "x",
  warn: unicodeEnabled ? "▲" : "!",
  info: unicodeEnabled ? "•" : "-",
  arrow: unicodeEnabled ? "❯" : ">",
  bar: unicodeEnabled ? "│" : "|",
  corner: unicodeEnabled ? "╰" : "`",
};

/** Braille spinner — smooth rotation, degrades to ASCII without losing the slot. */
const SPINNER_FRAMES = unicodeEnabled
  ? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  : ["|", "/", "-", "\\"];

export function spinnerFrame(tick: number): string {
  return SPINNER_FRAMES[tick % SPINNER_FRAMES.length]!;
}

/** Frame that briefly replaces the spinner when a step fails. */
export const spinnerFrames = SPINNER_FRAMES;

/** Strip SGR/CSI sequences. Used by tests and by the JSON stream writer. */
export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/** Visible width, ignoring escape sequences. Wide glyphs count as one cell. */
export function width(s: string): number {
  return stripAnsi(s).length;
}

/** Pad to `n` visible cells. */
export function pad(s: string, n: number): string {
  const w = width(s);
  return w >= n ? s : s + " ".repeat(n - w);
}