/**
 * Where output goes, and whether we are allowed to take over the terminal.
 *
 * Two independent switches, because they answer different questions:
 *
 *   jsonMode  "a machine is reading this" — human logs move to stderr so
 *             stdout stays parseable.
 *   tty       "a human is watching this"  — only then may we move the cursor
 *             and redraw in place.
 *
 * Piping into a file or running under CI gets plain, sequential, one-line-at-a-
 * time output. Nothing is ever lost; the pretty rendering is additive.
 */

let jsonMode = false;

export function setJsonMode(v: boolean): void {
  jsonMode = v;
}

/** Commands that would otherwise prompt use this to stay non-blocking. */
export function isJsonMode(): boolean {
  return jsonMode;
}

/** The stream human-facing output belongs on. */
export function out(): NodeJS.WriteStream {
  return jsonMode ? process.stderr : process.stdout;
}

/** stderr is the only correct home for errors: it survives `| head`. */
export function err(): NodeJS.WriteStream {
  return process.stderr;
}

/** True when stdout is a live terminal we may drive. */
export function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.CI;
}

/**
 * True when we can take over the cursor: a real terminal, no JSON mode, and
 * the caller has not opted out. `CI` is treated as non-interactive because
 * GitHub Actions and friends allocate no TTY, so the check is belt-and-braces.
 */
export function canAnimate(): boolean {
  return isInteractive() && !jsonMode;
}