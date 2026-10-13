/**
 * Interactive prompts: arrow-key select, multi-select, confirm, text.
 *
 * Hand-rolled on purpose. A dependency here would load on every single command
 * — including `siteforge --version` — to serve one menu that only the wizard
 * uses. This is raw-mode stdin and a redraw loop, which is a couple of hundred
 * lines and costs nothing when unused.
 *
 * Every prompt degrades: without a TTY they fall back to a numbered question
 * over plain readline, so a piped or scripted run gets a usable (if dull)
 * experience instead of a hang.
 */
import readline from "node:readline";
import { style, glyph, colorEnabled } from "./color.js";
import { isInteractive } from "./stream.js";

/** Raw-mode readline wrapper that resolves once per keypress. */
class KeyReader {
  private rl: readline.Interface;
  private pending: ((key: string) => void) | null = null;
  private ended = false;

  constructor() {
    this.rl = readline.createInterface({ input: process.stdin, terminal: true });
    this.rl.on("line", () => {
      /* swallow: we drive this ourselves */
    });
  }

  next(): Promise<string | null> {
    if (this.ended) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.pending = resolve;
    });
  }

  /** stdin only emits `keypress` when raw mode is on and a listener is attached. */
  attach(): void {
    const stdin = process.stdin;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("keypress", (_str: string, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
      const name = key.ctrl ? `ctrl-${key.name ?? ""}` : (key.name ?? key.sequence ?? "");
      const p = this.pending;
      this.pending = null;
      p?.(name);
    });
  }

  close(): void {
    this.ended = true;
    this.pending = null;
    const stdin = process.stdin;
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.pause();
    this.rl.close();
  }
}

const erase = (n: number) => (n > 0 ? `\x1b[${n}A\x1b[0J` : "");

/** Ask once over plain readline — the non-TTY path. */
function line(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: string) => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(v);
    };
    rl.question(question, (a) => done(a.trim()));
    // A closed pipe must resolve, not throw and take the run down.
    rl.on("close", () => done(""));
    process.stdin.on("error", () => done(""));
  });
}

/**
 * Pick one option with the arrow keys.
 *
 * Returns the chosen index, or -1 if the user pressed Ctrl-C — callers should
 * treat -1 as "cancel", not as a valid selection.
 */
export async function select<T>(message: string, options: { label: string; value: T; hint?: string }[]): Promise<number> {
  if (options.length === 0) return -1;

  if (!isInteractive()) {
    process.stdout.write(`\n  ${message}\n`);
    options.forEach((o, i) => process.stdout.write(`    ${i + 1}) ${o.label}\n`));
    const ans = await line(`  Pick [1-${options.length}]: `);
    const n = Number(ans);
    return Number.isInteger(n) && n >= 1 && n <= options.length ? n - 1 : -1;
  }

  let cursor = 0;
  const keys = new KeyReader();
  keys.attach();
  process.stdout.write("\n");
  let drawn = 0;

  const render = () => {
    process.stdout.write(erase(drawn));
    drawn = 0;
    const lines = [`  ${style.bold(message)}`];
    options.forEach((o, i) => {
      const on = i === cursor;
      const mark = on ? style.cyan(glyph.arrow) : " ";
      const text = on ? style.boldCyan(o.label) : o.label;
      const hint = o.hint ? style.gray(`  ${o.hint}`) : "";
      lines.push(`  ${mark} ${text}${hint}`);
    });
    lines.push(style.gray(`  ${glyph.arrow} move · ${glyph.arrow}/${glyph.info} enter · q quit`));
    process.stdout.write(lines.join("\n") + "\n");
    drawn = lines.length;
  };

  render();
  for (;;) {
    const key = await keys.next();
    if (key === null) break;
    if (key === "up" || key === "k" || key === "p") cursor = (cursor - 1 + options.length) % options.length;
    else if (key === "down" || key === "j" || key === "n") cursor = (cursor + 1) % options.length;
    else if (key === "return" || key === "enter" || key === "space") break;
    else if (key === "q" || key === "escape" || key === "ctrl-c") { cursor = -1; break; }
    else if (/^[1-9]$/.test(key) && Number(key) <= options.length) { cursor = Number(key) - 1; break; }
    else continue;
    render();
  }
  keys.close();
  process.stdout.write(erase(drawn));
  return cursor;
}

/** Yes/no. Returns the default when there is no TTY to ask. */
export async function confirm(message: string, dflt = true): Promise<boolean> {
  if (!isInteractive()) return dflt;
  const chosen = await select(message, [
    { label: "Yes", value: true },
    { label: "No", value: false },
  ]);
  if (chosen === -1) return false;
  return chosen === 0;
}

/** Free text with a default. Returns the default on empty input. */
export async function text(message: string, dflt = ""): Promise<string> {
  const suffix = dflt ? style.gray(` [${dflt}]`) : "";
  if (!isInteractive()) return (await line(`  ${message}${dflt ? ` [${dflt}]` : ""}: `)) || dflt;
  const ans = await line(`  ${message}${suffix}: `);
  return ans || dflt;
}

/** Pick several options; space toggles, enter confirms. Returns chosen indices. */
export async function multiselect<T>(message: string, options: { label: string; value: T }[]): Promise<number[]> {
  if (!isInteractive() || options.length === 0) {
    const one = await select(message, options);
    return one === -1 ? [] : [one];
  }
  let cursor = 0;
  const chosen = new Set<number>();
  const keys = new KeyReader();
  keys.attach();
  process.stdout.write("\n");
  let drawn = 0;

  const render = () => {
    process.stdout.write(erase(drawn));
    drawn = 0;
    const lines = [`  ${style.bold(message)}`];
    options.forEach((o, i) => {
      const on = i === cursor;
      const box = chosen.has(i) ? style.green("[x]") : style.gray("[ ]");
      const mark = on ? style.cyan(glyph.arrow) : " ";
      lines.push(`  ${mark} ${box} ${on ? style.bold(o.label) : o.label}`);
    });
    lines.push(style.gray("  move · space toggles · enter confirms · q quits"));
    process.stdout.write(lines.join("\n") + "\n");
    drawn = lines.length;
  };

  render();
  for (;;) {
    const key = await keys.next();
    if (key === null) break;
    if (key === "up") cursor = (cursor - 1 + options.length) % options.length;
    else if (key === "down") cursor = (cursor + 1) % options.length;
    else if (key === "space") { if (!chosen.has(cursor)) chosen.add(cursor); else chosen.delete(cursor); }
    else if (key === "return" || key === "enter") break;
    else if (key === "q" || key === "escape" || key === "ctrl-c") { chosen.clear(); break; }
    else continue;
    render();
  }
  keys.close();
  process.stdout.write(erase(drawn));
  return [...chosen].sort((a, b) => a - b);
}

export { colorEnabled };