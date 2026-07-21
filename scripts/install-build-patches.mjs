#!/usr/bin/env node
/**
 * Postinstall patches for the Taro 4.2 + webpack 5 toolchain.
 *
 * One npm dependency-version mismatch blocks `npm run build:weapp`:
 *
 *   `webpackbar@5.0.2` is the only progress plugin in `@tarojs/webpack5-runner`
 *   and it inherits from `webpack.ProgressPlugin`. Its constructor sets
 *   `this.options = { name, color, reporters, reporter, basic, fancy, ... }` —
 *   webpack 4 fields. webpack 5 ProgressPlugin's `_applyOnCompiler` runs
 *   `compiler.validate(schema, this.options, ...)` with strict
 *   `additionalProperties: false`, so it throws.
 *   Fix: strip those reporter-only fields out of `this.options` and into
 *   `this._extra`, and update all internal references. Also rename the
 *   destructured local `reporters` to `reportersInput` so it doesn't shadow
 *   the module-scope `reporters` constant.
 *
 * AJV 6/8 selection (eslint, @eslint/eslintrc, @tarojs/plugin-doctor,
 * schema-utils@2 must see ajv@6; everything else sees ajv@8) is enforced at
 * install time via the `overrides` block in `package.json` — this script no
 * longer needs to copy ajv into nested node_modules.
 *
 * Idempotent: safe to run on every `npm install`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

// --- webpackbar WebpackBarPlugin patch for webpack 5 ---

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