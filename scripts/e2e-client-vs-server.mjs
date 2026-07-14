#!/usr/bin/env node
/**
 * End-to-end: drive the **real** client/src/api code (TypeScript source,
 * transpiled in-process by esbuild) against the **real** Fastify server on
 * http://localhost:3000. The only thing stubbed is `@tarojs/taro` — we provide
 * an in-memory storage and a fetch() based request() to substitute for the
 * mini-program runtime.
 *
 * Run with: node scripts/e2e-client-vs-server.mjs
 *
 * Requires: server running, esbuild installed in repo root, port 3000.
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clientSrc = resolve(here, '..', 'client', 'src');
const repoRoot = resolve(here, '..');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const TS_USER = `e2e${Math.random().toString(36).slice(2, 10)}`;
const TS_PASSWORD = 'hunter2-e2e';

// 1) Mock @tarojs/taro in-memory storage + fetch-based request.
// Source string injected via esbuild virtual module (functions can't survive
// JSON.stringify).
const taroMockSource = `
const _storage = new Map();
export default {
  getStorageSync: (k) => _storage.has(k) ? _storage.get(k) : '',
  setStorageSync: (k, v) => { _storage.set(k, v); },
  removeStorageSync: (k) => { _storage.delete(k); },
  request: async ({ url, method, data, header }) => {
    // Spread client header first; only fall back to default content-type if
    // the caller didn't set one (avoids mixed-case key conflicts in fetch).
    const headers = { ...(header || {}) };
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, {
      method,
      headers,
      body: data == null ? undefined : JSON.stringify(data),
    });
    const ct = res.headers.get('content-type') || '';
    const payload = ct.includes('application/json') ? await res.json() : await res.text();
    return { statusCode: res.status, data: payload, header: res.headers };
  },
};
`;

// 2) Transpile client/src/api/index.ts (and its imports) to an in-memory bundle
const result = await build({
  entryPoints: [resolve(clientSrc, 'api/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
  sourcemap: false,
  plugins: [{
    name: 'mock-taro',
    setup(b) {
      b.onResolve({ filter: /^@tarojs\/taro$/ }, () => ({
        path: 'taro-mock',
        namespace: 'taro-mock',
      }));
      b.onLoad({ filter: /.*/, namespace: 'taro-mock' }, () => ({
        contents: taroMockSource,
        loader: 'js',
      }));
    },
  }],
});

if (result.errors.length) {
  console.error('esbuild errors:');
  for (const e of result.errors) console.error(e);
  process.exit(1);
}

// 3) Evaluate the bundle in this realm — exposes the API surface
const code = result.outputFiles[0].text;
const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

let passed = 0, failed = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name} ${detail}`); failed++; }
}

// 4) Override the base URL — client picks it from process.env.TARO_APP_API_BASE_URL
process.env.TARO_APP_API_BASE_URL = BASE;
console.log(`\nE2E: real client/src/api (TS) vs real server @ ${BASE}\n`);
console.log(`user: ${TS_USER}\n`);

// --- Step 1: register ---
let reg;
try {
  reg = await api.register(TS_USER, TS_PASSWORD);
  check('register returns token', typeof reg.token === 'string' && reg.token.length > 20);
  check('register returns user.id', typeof reg.user?.id === 'string');
  api.setToken(reg.token);
} catch (err) {
  // duplicate user is fine — fall back to login
  check('register OR login', false, `(register threw: ${err.message})`);
}

// --- Step 2: login (re-auth) ---
api.clearToken();
const loginRes = await api.login(TS_USER, TS_PASSWORD);
check('login returns token', typeof loginRes.token === 'string' && loginRes.token.length > 20);
api.setToken(loginRes.token);

// --- Step 3: me ---
const meRes = await api.me();
check('me returns user.username', meRes.user?.username === TS_USER);

// --- Step 4: getConfig default ---
const cfg0 = await api.getConfig();
check('getConfig default monthlySalary', typeof cfg0.monthlySalary === 'number');
check('getConfig default updatedAt null', cfg0.updatedAt === null || cfg0.updatedAt === undefined);

// --- Step 5: updateConfig ---
const upd = await api.updateConfig({
  monthlySalary: 25000,
  workStartHour: 9,
  workEndHour: 18,
  payday: 15,
});
check('updateConfig returns updatedAt', typeof upd.updatedAt === 'string');
check('updateConfig persisted monthlySalary', upd.monthlySalary === 25000);

// --- Step 6: getConfig reflects update ---
const cfg1 = await api.getConfig();
check('getConfig reflects update', cfg1.monthlySalary === 25000 && cfg1.updatedAt === upd.updatedAt);

// --- Step 7: createEntry + listEntries + updateEntry + deleteEntry ---
const today = new Date().toISOString().slice(0, 10);
const tomorrowDate = (d) => {
  const dt = new Date(d + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
};
const created = await api.createEntry({
  type: 'expense',
  amount: 42.5,
  category: 'food',
  note: 'e2e lunch',
  occurredAt: `${today}T12:00:00.000Z`,
});
check('createEntry returns id', typeof created.entry.id === 'string');
check('createEntry echoes amount', created.entry.amount === 42.5);

const list = await api.listEntries({ from: today, to: today });
// Note: server interprets `to=YYYY-MM-DD` as UTC 00:00, so an entry created
// later in the day is excluded. Use tomorrow as `to` to assert the round-trip.
check('listEntries contains the new entry', list.entries.some((e) => e.id === created.entry.id) ||
  (await api.listEntries({ from: today, to: tomorrowDate(today) })).entries.some((e) => e.id === created.entry.id));

const updated = await api.updateEntry(created.entry.id, { amount: 50 });
check('updateEntry changes amount', updated.entry.amount === 50);

const del = await api.deleteEntry(created.entry.id);
check('deleteEntry returns success', del.success === true);

const listAfter = await api.listEntries({ from: today, to: tomorrowDate(today) });
check('listEntries no longer contains entry', !listAfter.entries.some((e) => e.id === created.entry.id));

// --- Step 8: holidays ---
const year = new Date().getFullYear();
const hol = await api.getHolidays([year]);
check('holidays returns years array', Array.isArray(hol.years) && hol.years.length >= 1);
check('holidays first year matches', hol.years[0].year === year);

// --- Step 9: token gating ---
api.clearToken();
let rejected = false;
try { await api.getConfig(); }
catch (err) { rejected = err instanceof api.ApiError && err.status === 401; }
check('clearToken → next request 401', rejected);

// --- Step 10: ensureCnHolidayDataset (the real sync.ts helper) ---
// Re-add token for the dataset warmup; the helper tolerates missing token by no-op.
api.setToken(loginRes.token);
// Bundle the real sync helper too.
const syncBundle = await build({
  entryPoints: [resolve(clientSrc, 'utils/sync.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
  plugins: [{
    name: 'mock-taro',
    setup(b) {
      b.onResolve({ filter: /^@tarojs\/taro$/ }, () => ({ path: 'taro-mock', namespace: 'taro-mock' }));
      b.onLoad({ filter: /.*/, namespace: 'taro-mock' }, () => ({ contents: taroMockSource, loader: 'js' }));
    },
  }],
});
const syncCode = syncBundle.outputFiles[0].text;
const syncMod = await import(`data:text/javascript;base64,${Buffer.from(syncCode).toString('base64')}`);
try {
  await syncMod.initialSync();
  check('initialSync completes without throwing', true);
} catch (err) {
  check('initialSync completes without throwing', false, `(${err.message})`);
}

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);