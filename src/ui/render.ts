/**
 * The renderer: spinners, live task lists, panels and tables.
 *
 * The one idea worth stating up front is that every fancy path here has a
 * plain equivalent. A task list that cannot take over the cursor becomes one
 * line per task. A spinner becomes a single line printed when the work
 * finishes. A panel becomes indented text. That is what makes the same code
 * safe in CI logs, in pipes, and under `--json`.
 */
import { style, glyph, spinnerFrame, spinnerFrames, width, pad, colorEnabled } from "./color.js";
import { out, canAnimate } from "./stream.js";

/** ── milliseconds → a compact human duration ───────────────────────────────── */
export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** ── a single tracked step ─────────────────────────────────────────────────── */
export interface TaskState {
  label: string;
  status: "running" | "done" | "fail" | "skip";
  detail?: string;
  ms?: number;
  /** Set when the task is added; private to the list but carried on the object
   *  so a caller holding the handle never has to keep a second bookkeeping map. */
  started: number;
}

/**
 * A live list of steps that redraws in place.
 *
 * Redraw is "move the cursor up by however many lines we printed last time,
 * clear each one, rewrite". Counting rendered lines rather than assuming one
 * line per task is what keeps a two-line detail from corrupting the display.
 */
export class TaskList {
  private tasks: TaskState[] = [];
  private rendered = 0;
  private open = false;

  constructor(private readonly indent: string = "  ") {}

  add(label: string, detail?: string): TaskState {
    const t: TaskState = { label, status: "running", detail, started: Date.now() };
    this.tasks.push(t);
    this.open = true;
    this.render();
    return t;
  }

  update(t: TaskState, label?: string, detail?: string): void {
    if (label !== undefined) t.label = label;
    if (detail !== undefined) t.detail = detail;
    this.render();
  }

  done(t: TaskState, label?: string, detail?: string): void {
    if (label !== undefined) t.label = label;
    if (detail !== undefined) t.detail = detail;
    t.status = "done";
    t.ms = Date.now() - t.started;
    this.render();
  }

  fail(t: TaskState, label?: string, detail?: string): void {
    if (label !== undefined) t.label = label;
    if (detail !== undefined) t.detail = detail;
    t.status = "fail";
    this.render();
  }

  private line(t: TaskState, tick: number): string {
    const ind = this.indent;
    const mark =
      t.status === "running"
        ? style.cyan(spinnerFrame(tick))
        : t.status === "done"
          ? style.green(glyph.success)
          : t.status === "fail"
            ? style.red(glyph.fail)
            : style.gray(glyph.info);
    const label = t.status === "running" ? t.label : t.label;
    const timing = t.status === "done" && t.ms !== undefined && t.ms >= 100 ? style.gray(` ${duration(t.ms)}`) : "";
    const detail = t.detail ? style.gray(`  ${t.detail}`) : "";
    return `${ind}${mark} ${label}${timing}${detail}`;
  }

  private render(): void {
    if (!canAnimate()) return;
    const s = out();
    // Erase what we drew last frame. Writing the move-up before the content is
    // what keeps a shrinking list from leaving ghosts behind.
    if (this.rendered > 0) s.write(`\x1b[${this.rendered}A`);
    for (let i = 0; i < this.rendered; i++) s.write("\x1b[2K");
    const tick = Date.now() / 100 | 0;
    for (const t of this.tasks) s.write(`${this.line(t, tick)}\n`);
    this.rendered = this.tasks.length;
  }

  /** Freeze the list: paint the final state and stop redrawing. */
  end(): void {
    if (!canAnimate() || !this.open) return;
    this.render();
    this.open = false;
    this.rendered = 0;
  }
}

/** ── spinner ───────────────────────────────────────────────────────────────── */
export interface Spinner {
  update(msg: string): void;
  ok(msg?: string): void;
  fail(msg?: string): void;
  stop(): void;
}

/**
 * An indeterminate spinner for one piece of work.
 *
 * On an animated terminal it rotates in place and records elapsed time; in a
 * log it prints exactly one line when the work resolves, which is all a log
 * reader ever wanted anyway.
 */
export function spinner(label: string): Spinner {
  const started = Date.now();
  let current = label;
  let stopped = false;

  if (!canAnimate()) {
    return {
      update(msg) { current = msg; },
      ok(msg) { out().write(`  ${style.green(glyph.success)} ${msg ?? current} ${style.gray(duration(Date.now() - started))}\n`); },
      fail(msg) { out().write(`  ${style.red(glyph.fail)} ${msg ?? current}\n`); },
      stop() { stopped = true; },
    };
  }

  const s = out();
  const timer = setInterval(() => {
    if (stopped) return;
    s.write(`\r\x1b[2K  ${style.cyan(spinnerFrame(Date.now() / 100 | 0))} ${current} ${style.gray(duration(Date.now() - started))}`);
  }, 80);
  // Never hold the event loop open on the spinner's account.
  timer.unref?.();

  const clear = () => {
    stopped = true;
    clearInterval(timer);
    s.write("\r\x1b[2K");
  };

  return {
    update(msg) { current = msg; },
    ok(msg) { clear(); s.write(`  ${style.green(glyph.success)} ${msg ?? current} ${style.gray(duration(Date.now() - started))}\n`); },
    fail(msg) { clear(); s.write(`  ${style.red(glyph.fail)} ${msg ?? current}\n`); },
    stop() { clear(); },
  };
}

/** ── panels ────────────────────────────────────────────────────────────────── */

/**
 * Hard-wrap on width, preserving any newlines the caller already put in.
 *
 * A panel is only as readable as its width. Without this, one long command
 * stretches the box to 140 columns and every other line wraps against the
 * terminal instead of the box.
 */
export function wrap(text: string, cols: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (width(para) <= cols) {
      out.push(para);
      continue;
    }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      if (width(line) + width(word) > cols && line.trim()) {
        out.push(line.trimEnd());
        line = "";
      }
      line += word;
    }
    if (line.trim()) out.push(line.trimEnd());
  }
  return out;
}

/** Width to draw at: the terminal's, minus a gutter, and never absurd. */
function panelWidth(): number {
  const cols = process.stdout.columns ?? 0;
  return Math.max(32, Math.min(cols ? cols - 6 : 96, 96));
}

/**
 * A bordered summary box.
 *
 * Deliberately plain ASCII on terminals without Unicode: a box drawn with
 * half-supported glyphs reads as corruption, and a clean indented block reads
 * as intentional.
 */
export function panel(title: string, lines: string[], maxWidth = panelWidth()): string {
  const body: string[] = [];
  for (const l of lines) {
    // Padding of 4 leaves room for the border and one space of gutter.
    for (const w of wrap(l, Math.max(16, maxWidth - 4))) body.push(w);
  }
  const inner = Math.max(width(title) + 2, ...body.map((l) => width(l) + 2), 28);
  const bar = colorEnabled ? "─" : "-";
  const side = colorEnabled ? "│" : "|";
  const top = colorEnabled ? "╭" : "+";
  const bottom = colorEnabled ? "╰" : "`";
  const head = `${side} ${style.bold(title)}`;
  const headPad = " ".repeat(Math.max(0, inner - width(title) - 2));
  return [
    style.gray(top + bar.repeat(inner - 1)),
    style.gray(head) + headPad + style.gray(side),
    ...body.map((l) => `${style.gray(side)} ${pad(l, inner - 2)} ${style.gray(side)}`),
    style.gray(bottom + bar.repeat(inner - 1)),
  ].join("\n");
}

/** ── tables ────────────────────────────────────────────────────────────────── */
/**
 * Aligned columns with a dim header rule.
 *
 * Widths are computed from visible cells, not byte length, so styled cells and
 * box glyphs do not skew the layout.
 */
export function table(headers: string[], rows: string[][]): string {
  const cols = headers.length;
  const widths = headers.map((h, i) => Math.max(width(h), ...rows.map((r) => width(r[i] ?? "")), 1));
  const line = (cells: string[], color?: (s: string) => string): string =>
    cells
      .map((c, i) => {
        const isLast = i === cols - 1;
        const s = isLast ? (c ?? "") : pad(c ?? "", widths[i]!);
        return color ? color(s) : s;
      })
      .join("  ")
      .replace(/\s+$/, "");
  return [line(headers, style.gray), style.gray(widths.map((w) => "─".repeat(w)).join("  ")), ...rows.map((r) => line(r))].join("\n");
}

/** ── a heading for a multi-step command ────────────────────────────────────── */
export function banner(title: string, subtitle?: string): void {
  const s = out();
  s.write(`\n  ${style.boldCyan(glyph.info)} ${style.bold(title)}\n`);
  if (subtitle) s.write(`  ${style.gray(subtitle)}\n`);
  s.write("\n");
}

export { spinnerFrames };