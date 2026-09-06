const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

let jsonMode = false;

/** In JSON mode, all human logs go to stderr; only the result JSON hits stdout. */
export function setJsonMode(v: boolean): void {
  jsonMode = v;
}

const out = () => (jsonMode ? process.stderr : process.stdout);

export const log = {
  step(msg: string) {
    out().write(`${CYAN}▸${RESET} ${msg}\n`);
  },
  ok(msg: string) {
    out().write(`${GREEN}✓${RESET} ${msg}\n`);
  },
  warn(msg: string) {
    out().write(`${YELLOW}⚠${RESET} ${msg}\n`);
  },
  err(msg: string) {
    process.stderr.write(`${RED}✗${RESET} ${msg}\n`);
  },
  blank() {
    out().write("\n");
  },
  title(msg: string) {
    out().write(`${BOLD}${msg}${RESET}\n`);
  },
  dim(msg: string) {
    out().write(`${DIM}${msg}${RESET}\n`);
  },
  /** Unstyled write, routed like everything else (stderr in JSON mode). */
  raw(msg: string) {
    out().write(msg);
  },
};

/** Single-line progress counter (overwrites itself). Call done() to finish the line. */
export function progress(total: number, label: string) {
  let current = 0;
  const stream = () => (jsonMode ? process.stderr : process.stdout);
  const render = () => {
    stream().write(`\r  ${current}/${total} ${label}`);
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
    done() {
      current = total;
      render();
      stream().write("\n");
    },
  };
}
