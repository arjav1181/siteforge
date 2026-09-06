import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { log } from "../log.js";

export const SERVE_HELP = `siteforge serve — static file server for previews.

Usage:
  siteforge serve [dir] [--port 8000] [--spa]

Serves with correct MIME types, directory index.html resolution, and
optional SPA fallback (unknown paths serve index.html). Ctrl+C to stop.

Examples:
  siteforge serve public
  siteforge serve dist --port 8080 --spa
`;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
};

export function parseServeArgs(argv: string[]): { dir: string; port: number; spa: boolean } {
  let dir = ".";
  let port = 8000;
  let spa = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") {
      const v = argv[++i];
      const n = Number(v);
      if (v === undefined || !Number.isInteger(n) || n <= 0 || n > 65535) throw new Error("--port must be 1-65535");
      port = n;
    } else if (a === "--spa") spa = true;
    else if (a.startsWith("-")) throw new Error(`Unknown option for serve: ${a}`);
    else positional.push(a);
  }
  if (positional.length > 1) throw new Error("Too many arguments for serve.");
  if (positional[0]) dir = positional[0];
  return { dir, port, spa };
}

export async function runServe(o: { dir: string; port: number; spa: boolean }): Promise<never> {
  const root = path.resolve(o.dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`Not a directory: ${o.dir}`);
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      let file = path.join(root, safe);
      if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!existsSync(file) && o.spa) file = path.join(root, "index.html");
      if (!existsSync(file)) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("Server error");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(o.port, () => {
      log.ok(`Serving ${root} → http://localhost:${o.port}${o.spa ? " (SPA mode)" : ""}`);
      log.dim("  Ctrl+C to stop.");
    });
  });
  // Block forever (until SIGINT).
  await new Promise(() => {});
  throw new Error("unreachable");
}
