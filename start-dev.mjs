#!/usr/bin/env node
/**
 * trae-salary dev launcher — start backend + weapp dev build.
 *
 * Why Node, not bash?
 *   In a non-interactive bash script, a SIGINT received while *any* command
 *   (builtin or external) is blocking is **not** delivered to the trap until
 *   that command exits. The bash version of this script blocked on
 *   `npm run dev:weapp`, whose child (taro's webpack watcher) ignores SIGINT,
 *   so the cleanup trap never fired — Ctrl+C silently left orphaned tsx
 *   watchers behind. Node's `process.on('SIGINT', …)` fires *immediately*
 *   regardless of what the main loop is doing. Verified: handler ran 970 ms
 *   after SIGINT during `await new Promise(() => {})` (a permanent block).
 *
 * What it does:
 *   1. Pre-flight: SIGKILL any leftover trae-salary processes (cwd scan via
 *      lsof + cmdline scan via pkill).
 *   2. Backend (`npm run dev` in server/) starts as a child process. Logs
 *      go to /tmp/trae-salary-server.log. We poll /health every 1 s for up
 *      to 30 s.
 *   3. Client (`npm run dev:weapp` in client/) starts as a child process.
 *      Logs go to /tmp/trae-salary-client.log AND stream to this terminal
 *      in real time (tee'd). After the first compile, import client/dist
 *      in WeChat DevTools.
 *   4. On SIGINT/SIGTERM, cleanup(): SIGTERM the child trees (so npm can
 *      propagate), wait 1 s, then walk + SIGKILL any survivors using
 *      `pgrep -P` recursion (catches tsx watcher + taro worker, whose
 *      cmdlines don't contain `server/` or `client/`).
 *
 * This file is loaded as start-dev.mjs so Node's ESM loader accepts the
 * `.mjs` extension. start-dev.command is a 3-line bash stub that
 * `exec`s `node ./start-dev.mjs` so Finder double-click works AND Node
 * receives SIGINT directly (no bash trap layer).
 */
import { spawn, execSync } from 'node:child_process';
import {
  openSync,
  closeSync,
  writeSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = here;

const SERVER_LOG = '/tmp/trae-salary-server.log';
const CLIENT_LOG = '/tmp/trae-salary-client.log';
const HEALTH_URL = process.env.TRAE_DEV_HEALTH_URL || 'http://localhost:3000/health';
const HEALTH_TIMEOUT_SEC = Number(process.env.TRAE_DEV_HEALTH_TIMEOUT || 30);

// Cmdline patterns unique to trae-salary processes (full abs path → won't
// match unrelated projects). pkill -f matches against argv strings.
const TSX_BIN = join(repoRoot, 'node_modules', '.bin', 'tsx');
const TSX_PRELOAD = join(repoRoot, 'node_modules', 'tsx', 'dist', 'preflight.cjs');
const TARO_PATTERN = 'taro build --type weapp';

let serverProc = null;
let clientProc = null;
let serverLogFd = null;
let clientLogFd = null;
let cleaned = false;
let exiting = false;

// --- Small logging helpers ---
const ts = () => new Date().toISOString().slice(11, 23);
const log = (msg) => console.log(`[${ts()}] [dev] ${msg}`);
const banner = (msg) => {
  console.log('===============================================');
  console.log(msg);
  console.log('===============================================');
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Keep event loop alive while we await external events. setInterval alone
// keeps the loop spinning; we also have child processes with active stdio
// pipes attached (which themselves keep the loop alive).
setInterval(() => {}, 60_000);

// --- Process tree: recursive pgrep -P walk, SIGKILL each leaf ---
function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function killTree(rootPid, signal = 'SIGKILL') {
  if (!rootPid || !isAlive(rootPid)) return;
  try {
    const out = execSync(`pgrep -P ${rootPid}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    for (const c of out.split('\n').map((s) => s.trim()).filter(Boolean)) {
      killTree(Number(c), signal);
    }
  } catch {
    // pgrep exits 1 if no children — fine, leaf node.
  }
  try { process.kill(rootPid, signal); } catch { /* already dead */ }
}

function pkill(signal, pattern) {
  try {
    execSync(`pkill -${signal} -f ${JSON.stringify(pattern)}`, { stdio: 'ignore' });
  } catch {
    // pkill exits 1 if no match — fine.
  }
}

function closeFds() {
  for (const fd of [serverLogFd, clientLogFd]) {
    if (fd != null) { try { closeSync(fd); } catch { /* */ } }
  }
  serverLogFd = null;
  clientLogFd = null;
}

async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  exiting = true;

  log('Stopping trae-salary dev processes...');

  // 1) TERM the child subtrees — npm propagates to taro / tsx watch.
  for (const p of [clientProc, serverProc]) {
    if (p && p.pid && isAlive(p.pid)) {
      try { process.kill(p.pid, 'SIGTERM'); } catch { /* */ }
    }
  }
  // 2) Belt-and-suspenders TERM pass.
  pkill('TERM', TSX_BIN);
  pkill('TERM', TSX_PRELOAD);
  pkill('TERM', TARO_PATTERN);

  await sleep(1000);

  // 3) KILL anything still alive in the server/client trees.
  for (const p of [clientProc, serverProc]) {
    if (p && p.pid) killTree(p.pid, 'SIGKILL');
  }
  // 4) KILL any leftover trae-salary tsx watcher / taro worker.
  pkill('KILL', TSX_BIN);
  pkill('KILL', TSX_PRELOAD);
  pkill('KILL', TARO_PATTERN);

  closeFds();

  log(`Backend log:  ${SERVER_LOG}`);
  log(`Frontend log: ${CLIENT_LOG}`);
  log('Done.');
  process.exit(0);
}

process.on('SIGINT', () => { void cleanup(); });
process.on('SIGTERM', () => { void cleanup(); });
// Belt-and-suspenders: if we crash for any other reason, still kill the
// children. Async work in 'exit' handlers doesn't run; this must be sync.
process.on('exit', () => {
  if (exiting) return;
  for (const p of [clientProc, serverProc]) {
    if (p && p.pid && isAlive(p.pid)) killTree(p.pid, 'SIGKILL');
  }
  pkill('KILL', TSX_BIN);
  pkill('KILL', TSX_PRELOAD);
  pkill('KILL', TARO_PATTERN);
});

// --- Pre-flight: clear any leftover trae-salary processes ---
function preflight() {
  log('Pre-flight: clearing leftovers...');

  // Cwd-based kill: catches watcher procs whose cmdline doesn't mention
  // server/ or client/ (e.g. tsx watcher's child node process).
  try {
    const allPids = [
      ...execSync('pgrep node 2>/dev/null || true', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n'),
      ...execSync('pgrep tsx 2>/dev/null || true', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n'),
    ].filter(Boolean);
    for (const pidStr of allPids) {
      const pid = Number(pidStr);
      if (!Number.isFinite(pid) || !isAlive(pid)) continue;
      let cwd = '';
      try {
        cwd = execSync(`lsof -p ${pid} 2>/dev/null | awk '/cwd/ {print $NF; exit}'`, {
          stdio: ['ignore', 'pipe', 'ignore'],
        }).toString().trim();
      } catch { continue; }
      if (
        cwd === `${repoRoot}/server` ||
        cwd === `${repoRoot}/server/` ||
        cwd === `${repoRoot}/client` ||
        cwd === `${repoRoot}/client/`
      ) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* */ }
      }
    }
  } catch { /* best effort */ }

  // Cmdline-based kill: catches anything the cwd scan missed.
  pkill('KILL', TSX_BIN);
  pkill('KILL', TSX_PRELOAD);
  pkill('KILL', TARO_PATTERN);
}

// --- Health check: poll /health until 200 or timeout ---
async function waitForHealth() {
  process.stdout.write(`Waiting for ${HEALTH_URL} `);
  for (let i = 0; i < HEALTH_TIMEOUT_SEC; i++) {
    try {
      const r = await fetch(HEALTH_URL);
      if (r.ok) { console.log(' ok'); return true; }
    } catch { /* not ready yet */ }
    process.stdout.write('.');
    await sleep(1000);
  }
  console.log(' timeout');
  return false;
}

// --- Spawn helper: npm <script>, log to file, optional tee to terminal ---
function spawnNpm({ name, cwd, script, logFile, tee = false }) {
  const fd = openSync(logFile, 'w');
  const child = spawn('npm', ['run', script], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Keep attached (not detached) so our kill_tree walks into npm's children.
    detached: false,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  child.stdout.on('data', (chunk) => {
    writeSync(fd, chunk);
    if (tee) process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    writeSync(fd, chunk);
    if (tee) process.stderr.write(chunk);
  });
  child.on('exit', (code, sig) => {
    log(`[${name}] child exited code=${code} signal=${sig}`);
  });

  return { child, fd };
}

async function main() {
  banner(`  trae-salary dev launcher\n  repo: ${repoRoot}`);

  preflight();

  // After pre-flight, if port is still healthy, refuse — it's a foreign server.
  try {
    const r = await fetch(HEALTH_URL);
    if (r.ok) {
      banner(`!! ${HEALTH_URL} still serves a healthy server (not from this repo).`);
      log('   Refusing to start. Stop the foreign server and re-run.');
      process.exit(1);
    }
  } catch { /* port free, proceed */ }

  // --- 1) Backend ---
  log(`Starting backend  → ${SERVER_LOG}`);
  const server = spawnNpm({
    name: 'server',
    cwd: join(repoRoot, 'server'),
    script: 'dev',
    logFile: SERVER_LOG,
    tee: false,
  });
  serverProc = server.child;
  serverLogFd = server.fd;

  const ok = await waitForHealth();
  if (!ok) {
    console.log(`\n!! Server did not become ready within ${HEALTH_TIMEOUT_SEC}s.`);
    console.log(`Tail of ${SERVER_LOG}:`);
    console.log('----');
    try {
      const tail = readFileSync(SERVER_LOG, 'utf8').split('\n').slice(-60).join('\n');
      console.log(tail);
    } catch { /* */ }
    console.log('----');
    await cleanup();
    return;
  }

  // --- 2) Client ---
  log(`Starting weapp dev:weapp → ${CLIENT_LOG} (also streamed below)`);
  const client = spawnNpm({
    name: 'client',
    cwd: join(repoRoot, 'client'),
    script: 'dev:weapp',
    logFile: CLIENT_LOG,
    tee: true,
  });
  clientProc = client.child;
  clientLogFd = client.fd;

  banner(
    `  trae-salary dev launcher — READY\n` +
    `  Backend  : ${HEALTH_URL.replace(/\/health$/, '')}  (PID ${serverProc.pid}, log: ${SERVER_LOG})\n` +
    `  Frontend : ${join(repoRoot, 'client', 'dist')}            (PID ${clientProc.pid}, log: ${CLIENT_LOG})\n` +
    `\n` +
    `  After the first compile, import client/dist in WeChat DevTools.\n` +
    `  Press Ctrl+C to stop both.`
  );

  // Block until either child exits or SIGINT/SIGTERM fires.
  // (SIGINT/SIGTERM → cleanup() → process.exit(0); child exit → also clean up.)
  await new Promise((resolve) => {
    const onSignal = () => resolve('signal');
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    serverProc.once('exit', () => resolve('server-exit'));
    clientProc.once('exit', () => resolve('client-exit'));
  });

  await cleanup();
}

main().catch(async (err) => {
  console.error('[dev] fatal:', err);
  await cleanup();
  process.exit(1);
});