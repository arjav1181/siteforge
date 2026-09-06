#!/usr/bin/env node
// port-kill — free a TCP port by killing its listeners.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  console.log("Usage: port-kill <port> [...]");
  process.exit(args.length === 0 ? 1 : 0);
}
for (const raw of args) {
  if (raw.startsWith("-")) continue;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) { console.error(`port-kill: bad port "${raw}"`); continue; }
  let pids = [];
  const run = (cmd, args) => {
    try {
      // Never hang: DNS lookups off (-nP for lsof), hard timeout on everything.
      const out = execFileSync(cmd, args, { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "pipe"] });
      return (out ?? "").toString().trim().split(/\s+/).filter(Boolean);
    } catch (e) {
      if (e.code === "ENOENT" || e.code === "ETIMEDOUT") return null; // tool missing/hung
      return ((e.stdout ?? "").toString().trim().split(/\s+/).filter(Boolean));
    }
  };
  const have = (cmd) => {
    try { execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore", timeout: 5000 }); return true; }
    catch { return false; }
  };
  // Our own process tree — never a valid target (PID reuse / namespace skew
  // can make listings lie; never trust a bare number).
  const protectedPids = new Set([process.pid]);
  try {
    let p = process.ppid, guard = 0;
    while (p > 1 && guard++ < 32) {
      protectedPids.add(p);
      const after = readFileSync(`/proc/${p}/stat`, "utf8");
      p = Number(after.slice(after.lastIndexOf(")") + 2).split(" ")[1]);
    }
  } catch { /* /proc unavailable (non-Linux): self-only protection */ }
  const commOf = (pid) => {
    try { return readFileSync(`/proc/${pid}/comm`, "utf8").trim(); }
    catch { return "?"; }
  };
  const stillBound = (pid) => {
    try {
      const out = execFileSync("lsof", ["-nP", "-a", "-p", String(pid), "-i", `tcp:${port}`],
        { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "pipe"] });
      return (out ?? "").trim().length > 0;
    } catch {
      return false;
    }
  };
  if (process.platform !== "darwin" && have("fuser")) {
    pids = run("fuser", [`${port}/tcp`]) ?? [];
  } else if (have("lsof")) {
    const out = run("lsof", ["-nP", "-ti", `tcp:${port}`]);
    pids = (out ?? []).filter((p) => /^\d+$/.test(p));
  } else {
    console.error("port-kill: need fuser or lsof on PATH");
    process.exit(1);
  }
  const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  const alive = (pid) => {
    try { process.kill(pid, 0); return true; }
    catch { return false; } // ESRCH (dead) or EPERM (alive, foreign) — treat foreign as alive
  };
  const cands = [...new Set(
    pids.map(Number).filter((n) => Number.isInteger(n) && n > 1),
  )];
  if (cands.length === 0) { console.log(`port ${port}: free`); continue; }
  for (const pid of cands) {
    const comm = commOf(pid);
    if (protectedPids.has(pid) || /port-kill/i.test(comm)) {
      console.log(`port ${port}: skipping protected pid ${pid} (${comm})`);
      continue;
    }
    if (!stillBound(pid)) {
      console.log(`port ${port}: pid ${pid} (${comm}) no longer bound — skipping`);
      continue;
    }
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      console.log(`port ${port}: could not signal pid ${pid} (${comm})`);
      continue;
    }
    let released = false;
    for (let i = 0; i < 6 && !released; i++) {
      sleepSync(250);
      released = !alive(pid) || !stillBound(pid);
    }
    if (released && !alive(pid)) console.log(`port ${port}: killed pid ${pid} (${comm})`);
    else if (released) console.log(`port ${port}: pid ${pid} (${comm}) released the port`);
    else {
      try { process.kill(pid, "SIGKILL"); console.log(`port ${port}: force-killed pid ${pid} (${comm})`); }
      catch { console.log(`port ${port}: pid ${pid} (${comm}) still holding (permission?)`); }
    }
  }
}
