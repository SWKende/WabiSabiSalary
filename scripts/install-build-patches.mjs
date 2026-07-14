#!/usr/bin/env node
/**
 * Postinstall patches for the Taro 4.2 + webpack 5 toolchain.
 *
 * Three npm dependency-version mismatches block `npm run build:weapp`:
 *
 * 1) Each eslint (root, @tarojs/plugin-doctor, @eslint/eslintrc) needs
 *    `ajv@^6.12.4` + transitive deps (`fast-deep-equal`, `fast-json-stable-stringify`,
 *    `json-schema-traverse`, `uri-js`) nested beside it. Without the nested ajv@6,
 *    webpackbar's plugin-doctor step crashes with
 *    `Cannot find module 'ajv/lib/refs/json-schema-draft-04.json'`.
 *
 * 2) `schema-utils@2` (used by babel-loader@8) ships with `ajv-keywords@3`
 *    which is only compatible with `ajv@6/7`. With the root `overrides: ajv@^8`,
 *    `require('ajv')` from `schema-utils/dist/validate.js` resolves to `ajv@8`
 *    and `ajv-keywords/keywords/_formatLimit.js` crashes on
 *    `Cannot read properties of undefined (reading 'date')`.
 *    Fix: nest ajv@6 + deps into `babel-loader/node_modules/schema-utils/node_modules/`.
 *
 * 3) `webpackbar@5.0.2` is the only progress plugin in `@tarojs/webpack5-runner`
 *    and it inherits from `webpack.ProgressPlugin`. Its constructor sets
 *    `this.options = { name, color, reporters, reporter, basic, fancy, ... }` —
 *    webpack 4 fields. webpack 5 ProgressPlugin's `_applyOnCompiler` runs
 *    `compiler.validate(schema, this.options, ...)` with strict
 *    `additionalProperties: false`, so it throws.
 *    Fix: strip those reporter-only fields out of `this.options` and into
 *    `this._extra`, and update all internal references. Also rename the
 *    destructured local `reporters` to `reportersInput` so it doesn't shadow
 *    the module-scope `reporters` constant.
 *
 * The source of ajv@6 + transitive deps is `@eslint/eslintrc/node_modules/`
 * which `npm` already nested there during install — copy from there rather
 * than running `npm install` again.
 *
 * Idempotent: safe to run on every `npm install`.
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
} from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const AJV_DEPS = ['ajv', 'fast-deep-equal', 'fast-json-stable-stringify', 'json-schema-traverse', 'uri-js'];
const AJV_SRC = `${repoRoot}/node_modules/@eslint/eslintrc/node_modules`;

// --- 1) ajv@6 nesting for every eslint + schema-utils ---

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/**
 * Find every directory whose package.json has name === 'eslint'. Allows up to
 * 2 levels of node_modules traversal so nested copies (e.g. inside
 * @tarojs/plugin-doctor) are reached.
 */
function findEslintDirs(root) {
  const out = [];
  function walk(dir, depth, inNmCount) {
    if (depth > 12) return;
    if (!existsSync(dir)) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      const nextNm = e.name === 'node_modules' ? inNmCount + 1 : inNmCount;
      if (nextNm > 2) continue;
      const pkg = readJson(join(full, 'package.json'));
      if (pkg?.name === 'eslint') { out.push(full); continue; }
      walk(full, depth + 1, nextNm);
    }
  }
  walk(root, 0, 0);
  return out;
}

/**
 * Walk up from `start` looking for the nearest `node_modules/ajv` and return its
 * version, or null if none found.
 */
function nearestAjvVersion(start) {
  let cur = start;
  while (true) {
    const p = join(cur, 'node_modules', 'ajv', 'package.json');
    if (existsSync(p)) return readJson(p)?.version ?? null;
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

function ensureAjv6Beside(targetDir) {
  const ver = nearestAjvVersion(targetDir);
  if (ver && /^6\./.test(ver)) return 'already-ok';
  const targetNodeModules = join(targetDir, 'node_modules');
  mkdirSync(targetNodeModules, { recursive: true });
  for (const dep of AJV_DEPS) {
    const src = join(AJV_SRC, dep);
    const dst = join(targetNodeModules, dep);
    if (!existsSync(src)) {
      return `missing-source:${dep}`;
    }
    if (!existsSync(dst)) {
      cpSync(src, dst, { recursive: true });
    }
  }
  return 'installed';
}

let ajvInstalled = 0;
let ajvAlreadyOk = 0;
let ajvMissed = 0;

const eslintDirs = [...new Set(findEslintDirs(repoRoot))];
for (const dir of eslintDirs) {
  const r = ensureAjv6Beside(dir);
  if (r === 'installed') ajvInstalled++;
  else if (r === 'already-ok') ajvAlreadyOk++;
  else { ajvMissed++; console.warn(`[postinstall] ajv@6 next to ${dir}: ${r}`); }
}

// schema-utils@2 (used by babel-loader@8) needs its own nested ajv@6
const schemaUtilsDir = join(repoRoot, 'node_modules/babel-loader/node_modules/schema-utils');
if (existsSync(schemaUtilsDir)) {
  const r = ensureAjv6Beside(schemaUtilsDir);
  if (r === 'installed') ajvInstalled++;
  else if (r === 'already-ok') ajvAlreadyOk++;
  else { ajvMissed++; console.warn(`[postinstall] ajv@6 next to schema-utils: ${r}`); }
}

if (ajvInstalled || ajvMissed) {
  console.log(`[postinstall] ajv@6 nested: ${ajvInstalled} installed, ${ajvAlreadyOk} already OK, ${ajvMissed} failed`);
}

// --- 2) webpackbar WebpackBarPlugin patch for webpack 5 ---

/**
 * Replace the WebpackBarPlugin constructor (and the state getter + _ensureState)
 * so it no longer pollutes `this.options` with webpack 4 fields. The original
 * used `const { reporters, ... } = opts` which shadowed the module-scope
 * `reporters` constant; rename to `reportersInput`.
 *
 * Idempotent: skip if the file already contains the PATCH marker.
 */
function patchWebpackbar(file) {
  if (!existsSync(file)) return 'missing';
  let src = readFileSync(file, 'utf8');
  // Idempotency: the patched constructor destructures `reporters: reportersInput`
  // to avoid shadowing the module-scope reporters map. Detect that.
  if (src.includes('reporters: reportersInput')) return 'already-patched';

  // The exact constructor body to replace — same in both .cjs and .mjs except
  // for the `Webpack` vs `Webpack__default` superclass reference.
  const constructorPattern = /class WebpackBarPlugin extends (Webpack\.|Webpack__default\.)ProgressPlugin \{\n  constructor\(options\) \{\n    super\(\{ activeModules: true \}\);\n    this\.options = Object\.assign\(\{\}, DEFAULTS, options\);\n([^]*?)\n    \}\n    this\.reporters = _reporters\.map\(\(\{ reporter, options: options2 = \{\} \}\) => \{[\s\S]*?\}\);/;

  const replacement = (superRef) => `class WebpackBarPlugin extends ${superRef}ProgressPlugin {
  constructor(options) {
    super({ activeModules: true });
    const opts = Object.assign({}, DEFAULTS, options);
    // ↓ webpack 5 ProgressPlugin-validate PATCH: ProgressPlugin's validate hook
    // rejects webpack 4 options (name/color/reporters/reporter/basic/fancy) with
    // additionalProperties:false. Keep those reporter-only fields on
    // \`this._extra\` and expose only the webpack 5 ProgressPlugin fields on
    // \`this.options\`. Rename destructured \`reporters\` to avoid shadowing the
    // module-scope reporters map below.
    const { reporters: reportersInput, reporter, basic, fancy, name, color, ...prog5 } = opts;
    this._extra = { reporters: reportersInput, reporter, basic, fancy, name, color };
    this.options = prog5;
    this.handler = (percent, message, ...details) => {
      this.updateProgress(percent, message, details);
    };
    const _reporters = Array.from(this._extra.reporters || []).concat(this._extra.reporter).filter(Boolean).map((reporter) => {
      if (Array.isArray(reporter)) {
        return { reporter: reporter[0], options: reporter[1] };
      }
      if (typeof reporter === "string") {
        return { reporter };
      }
      return { reporter };
    });
    this.reporters = _reporters.map(({ reporter, options: options2 = {} }) => {
      if (typeof reporter === "string") {
        if (this._extra[reporter] === false) {
          return void 0;
        }
        options2 = { ...this._extra[reporter], ...options2 };
        reporter = reporters[reporter] || require(reporter);
      }
      if (typeof reporter === "function") {
        try {
          reporter = new reporter(options2);
        } catch (err) {
          reporter = reporter(options2);
        }
      }
      return reporter;
    }).filter(Boolean);
  }`;

  let patched = false;
  if (constructorPattern.test(src)) {
    src = src.replace(constructorPattern, replacement('Webpack.'));
    patched = true;
  }
  const cjsPattern = /class WebpackBarPlugin extends Webpack__default\.ProgressPlugin \{\n  constructor\(options\) \{\n    super\(\{ activeModules: true \}\);\n    this\.options = Object\.assign\(\{\}, DEFAULTS, options\);/;
  if (cjsPattern.test(src)) {
    src = src.replace(cjsPattern, `class WebpackBarPlugin extends Webpack__default.ProgressPlugin {
  constructor(options) {
    super({ activeModules: true });
    const opts = Object.assign({}, DEFAULTS, options);
    // ↓ webpack 5 ProgressPlugin-validate PATCH
    const { reporters: reportersInput, reporter, basic, fancy, name, color, ...prog5 } = opts;
    this._extra = { reporters: reportersInput, reporter, basic, fancy, name, color };
    this.options = prog5;`);
    patched = true;
  }

  // Patch state getter and _ensureState to use this._extra instead of this.options.
  src = src.replace(
    /get state\(\) \{\n    return globalStates\[this\.options\.name\];\n  \}\n  _ensureState\(\) \{\n    if \(!this\.states\[this\.options\.name\]\) \{\n      this\.states\[this\.options\.name\] = \{\n        \.\.\.DEFAULT_STATE,\n        color: this\.options\.color,\n        name: startCase\(this\.options\.name\)\n      \}\;\n    \}\n  \}/,
    `get state() {
    return globalStates[this._extra.name];
  }
  _ensureState() {
    if (!this.states[this._extra.name]) {
      this.states[this._extra.name] = {
        ...DEFAULT_STATE,
        color: this._extra.color,
        name: startCase(this._extra.name)
      };
    }
  }`
  );

  if (!patched && !src.includes('webpack 5 ProgressPlugin-validate PATCH')) {
    return 'no-match';
  }
  writeFileSync(file, src, 'utf8');
  return 'patched';
}

const webpackbarFiles = [
  join(repoRoot, 'node_modules/webpackbar/dist/index.cjs'),
  join(repoRoot, 'node_modules/webpackbar/dist/index.mjs'),
];
let wbPatched = 0;
let wbAlready = 0;
let wbMissed = 0;
for (const f of webpackbarFiles) {
  const r = patchWebpackbar(f);
  if (r === 'patched') wbPatched++;
  else if (r === 'already-patched') wbAlready++;
  else { wbMissed++; console.warn(`[postinstall] webpackbar patch ${f}: ${r}`); }
}
if (wbPatched) console.log(`[postinstall] webpackbar patched: ${wbPatched} file(s)`);