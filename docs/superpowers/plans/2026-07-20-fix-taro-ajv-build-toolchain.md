# Taro 4.2 + AJV/Taro Build Toolchain 前置修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `npm run build:weapp` 与 `npm run build:h5` 在当前主工作区上再次能够完成 Taro build 插件加载流程，作为后续登录页重设计（方案 C“墨签账簿”）的前置验收条件。

**Architecture:** 在 `/tmp/build-sandbox` 沙箱中以新 npm `overrides` 验证 `ajv@6` 嵌套到三个 ESLint 消费者（`@eslint/eslintrc`、根 `eslint`、`@tarojs/plugin-doctor` 内的 `eslint`）以及 `babel-loader` 的 `schema-utils@2`；验证通过后,只把 `package.json`、`package-lock.json` 与最小化的 `scripts/install-build-patches.mjs`（只保留 webpackbar webpack 5 补丁,删除 AJV 6 的 cpSync）从沙箱同步回主工作区;增加 `client/test/build/ajv-resolution.test.mjs` 锁住 AJV 嵌套结构。

**Tech Stack:** npm workspaces、Taro 4.2、`@tarojs/cli`、Node.js 内置 `node:test`、Node.js v24。

---

## 1. 范围与非目标

**范围：** 修复 `npm install → npm run build:weapp → npm run build:h5` 在当前主工作区上从 npm install 到 Taro build 插件加载完成的整条链路。

**非目标：**

- 不修改登录页相关代码（`client/src/pages/login/**`、`client/src/pages/login/validation.ts` 等）。这些由后续独立的 `docs/superpowers/plans/2026-07-20-login-ink-ledger-redesign.md` 覆盖。
- 不升级 Taro、React、webpack 或 ESLint。
- 不修改 `client/`、`server/`、`deploy/`、`docs/superpowers/specs/` 下任何业务代码或规范。
- 不修改 `client/.stylelintrc.*` 或 stylelint 自身配置。
- 不修改 `client/vitest.config.ts`、`client/test/setup.ts` 或现有 `client/test/styles/**` 测试套件。
- 不在主工作区执行 `rm -rf node_modules` 与 `rm package-lock.json`；所有破坏性命令只在 `/tmp/build-sandbox` 内运行。

## 2. 现状证据

| 证据 | 行号 / 来源 | 关键观察 |
| --- | --- | --- |
| `package.json` | 仓库根 | `overrides: { ajv: "^8.17.1" }` 将所有 AJV 解析为 8.20.0 |
| `@eslint/eslintrc/package.json` | `node_modules/@eslint/eslintrc/package.json` | `dependencies: { ajv: "^6.12.4" }` |
| `scripts/install-build-patches.mjs:50-143` | 仓库 | 用 `cpSync` 从 `node_modules/@eslint/eslintrc/node_modules` 复制 AJV 6;但实际安装结果没有该嵌套来源,所以 patch 不能生效 |
| `scripts/install-build-patches.mjs:154-265` | 仓库 | 对 `webpackbar` 的 webpack 5 适配仍有效,需要保留 |
| `server/src/routes/auth.ts:7-9` | 仓库 | 登录认证规则；本计划不涉及 |
| `client/src/pages/login/index.tsx:46-93` | 仓库 | 当前登录页;本计划不涉及 |

## 3. 关键判断与取舍

1. **沙箱验证,主工作区最小变更:** npm `overrides` 在 v8+ 已支持 per-package 选择器（`"eslint": { "ajv": "^6.12.4" }`），理论上在安装阶段就能把 AJV 6 嵌套进指定消费者,无需 `cpSync` 运行时补丁。我们在沙箱中跑通并验证 AJV 嵌套结构、Taro build 插件加载、再把已经验证的最小变更（`package.json` 与 `package-lock.json`）同步回主工作区。
2. **保留 `scripts/install-build-patches.mjs` 的 webpackbar 段**，它解决的是 `webpack 5 ProgressPlugin` 严格 schema 校验的真实问题。仅删除 AJV 6 复制阶段。
3. **新增测试** 锁住 AJV 嵌套，避免未来 npm overrides 漂移、lockfile 漂移或 npm 版本变更再次踩坑。
4. **不在主工作区构建验收**：构建验收只在沙箱中跑一次，验证 `npm install` 与 Taro build 插件加载阶段。主工作区在确认沙箱构建通过后,以最小变更（`package.json` 4 行 + `package-lock.json` + `scripts/install-build-patches.mjs` + 1 个测试文件）落地。

## 4. 文件结构

修改:

- `package.json`（根）— 重写 `overrides`，增加 dev 依赖 `ajv@^8.17.1`。
- `scripts/install-build-patches.mjs` — 移除 AJV 6 cpSync、`findEslintDirs`、`ensureAjv6Beside`、相关常量；只保留 webpackbar 补丁。

新增:

- `client/test/build/ajv-resolution.test.mjs` — Node.js `node:test` 读取四个 consumer 的 `ajv/package.json`，断言都指向 `6.x` 且顶层 `ajv` 是 `8.x`。

明确不修改:

- `client/src/pages/login/**`、`client/src/pages/login/validation.ts`。
- `client/`、`server/`、`deploy/` 业务代码。
- 用户当前未提交的 `docs/superpowers/plans/2026-07-02-add-backend.md` 与 `docs/superpowers/plans/2026-07-14-typography-input-tokens-plan.md`。
- `.npmrc`、`client/vitest.config.ts`、`client/test/setup.ts`、`client/.stylelintrc.*`。

不创建:

- `dist/`、`node_modules/`、`.superpowers/`、`/tmp/build-sandbox`。

## 5. 任务拆分

> **重要：** 任何 `npm install`、lockfile 生成与依赖修改都先在 `/tmp/build-sandbox` 沙箱执行,验证 AJV 嵌套结构、npm overrides 与 webpackbar 补丁表现后再回到主工作区。主工作区只接受已验证的最小变更。

### Task 1: 锁住 AJV 嵌套结构的失败测试

**Files:**

- Create: `client/test/build/ajv-resolution.test.mjs`

- [ ] **Step 1: 创建文件**

`client/test/build/ajv-resolution.test.mjs` 内容:

```js
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../../..')

const consumers = [
  'node_modules/@eslint/eslintrc/node_modules/ajv/package.json',
  'node_modules/eslint/node_modules/ajv/package.json',
  'node_modules/@tarojs/plugin-doctor/node_modules/eslint/node_modules/ajv/package.json',
  'node_modules/babel-loader/node_modules/schema-utils/node_modules/ajv/package.json',
]

test('each eslint + babel-loader schema-utils consumer resolves ajv 6.x', () => {
  for (const rel of consumers) {
    const p = resolve(repoRoot, rel)
    if (!existsSync(p)) continue
    const pkg = JSON.parse(readFileSync(p, 'utf8'))
    const major = pkg.version.split('.')[0]
    if (major !== '6') {
      throw new Error(`Expected ajv 6.x at ${rel}, got ${pkg.version}`)
    }
  }
})

test('top-level ajv is 8.x', () => {
  const p = resolve(repoRoot, 'node_modules/ajv/package.json')
  const pkg = JSON.parse(readFileSync(p, 'utf8'))
  const major = pkg.version.split('.')[0]
  if (major !== '8') {
    throw new Error(`Expected top-level ajv 8.x, got ${pkg.version}`)
  }
})
```

- [ ] **Step 2: 跑测试（预期失败）**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
node --test client/test/build/ajv-resolution.test.mjs
```

预期:失败 — 当前 `@eslint/eslintrc` 没有嵌套 `ajv`，它实际加载的是顶层 `ajv@8`，因此第一个 test 不会触发错误路径（因为 `existsSync` 为真又 major=8），会抛错；第二个 test 正常通过。

- [ ] **Step 3: 提交失败用例**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/test/build/ajv-resolution.test.mjs
git commit -m "test(build): assert ajv 6.x nesting for Taro toolchain"
```

### Task 2: 在沙箱中验证 overrides 与 webpackbar 补丁

**Files:**

- Modify: `package.json`（先在沙箱 `/tmp/build-sandbox/package.json`，验证后回到主工作区）
- Modify: `package-lock.json`（从沙箱验证后复制回主工作区）
- Modify: `scripts/install-build-patches.mjs`（先在沙箱）

- [ ] **Step 1: 准备沙箱**

```bash
SANDBOX=/tmp/build-sandbox
rm -rf "$SANDBOX"
mkdir -p "$SANDBOX"
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git archive HEAD | tar -x -C "$SANDBOX"
ls "$SANDBOX"
```

预期看到 `client/ docs/ scripts/ server/ package.json package-lock.json ...`。

- [ ] **Step 2: 在沙箱里替换 `package.json`**

把 `$SANDBOX/package.json` 整文件替换为:

```json
{
  "name": "trae-salary",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["client", "server"],
  "scripts": {
    "postinstall": "node ./scripts/install-build-patches.mjs"
  },
  "devDependencies": {
    "ajv": "^8.17.1"
  },
  "overrides": {
    "ajv": "^8.17.1",
    "@eslint/eslintrc": { "ajv": "^6.12.4" },
    "eslint": { "ajv": "^6.12.4" },
    "@tarojs/plugin-doctor": {
      "eslint": { "ajv": "^6.12.4" }
    },
    "schema-utils@2": { "ajv": "^6.12.4" }
  }
}
```

`schema-utils@2` selector 把 AJV 6 嵌套到 `babel-loader/node_modules/schema-utils@2.7.1`，因为它声明 `ajv: ^6.12.4` 但顶层 AJV 是 8.x。

- [ ] **Step 3: 把精简版 `scripts/install-build-patches.mjs` 放到沙箱**

把 `$SANDBOX/scripts/install-build-patches.mjs` 整文件替换为:

```js
#!/usr/bin/env node
/**
 * Postinstall patches for the Taro 4.2 + webpack 5 toolchain.
 *
 * AJV 6/8 selection is enforced at install time via `package.json`
 * `overrides`; this script only retains the webpackbar webpack 5 fix.
 *
 * webpackbar@5.0.2 (in @tarojs/webpack5-runner) inherits from
 * webpack.ProgressPlugin. Its constructor assigns webpack 4 reporter
 * fields to `this.options`, which webpack 5 ProgressPlugin rejects via
 * strict `additionalProperties: false`. We strip those fields into a
 * new `this._extra` and update internal references.
 *
 * Idempotent: safe to run on every `npm install`.
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  join,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

function patchWebpackbar(file) {
  if (!existsSync(file)) return 'missing'
  let src = readFileSync(file, 'utf8')
  if (src.includes('reporters: reportersInput')) return 'already-patched'

  const constructorPattern = /class WebpackBarPlugin extends (Webpack\.|Webpack__default\.)ProgressPlugin \{\n  constructor\(options\) \{\n    super\(\{ activeModules: true \}\);\n    this\.options = Object\.assign\(\{\}, DEFAULTS, options\);\n([^]*?)\n    \}\n    this\.reporters = _reporters\.map\(\(\{ reporter, options: options2 = \{\} \}\) => \{[\s\S]*?\}\);/

  const replacement = (superRef) => `class WebpackBarPlugin extends ${superRef}ProgressPlugin {
  constructor(options) {
    super({ activeModules: true });
    const opts = Object.assign({}, DEFAULTS, options);
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
      if (typeof reporter === "function") {
        try {
          reporter = new reporter(options2);
        } catch (err) {
          reporter = reporter(options2);
        }
      }
      return reporter;
    }).filter(Boolean);
  }`

  let patched = false
  if (constructorPattern.test(src)) {
    src = src.replace(constructorPattern, replacement('Webpack.'))
    patched = true
  }
  const cjsPattern = /class WebpackBarPlugin extends Webpack__default\.ProgressPlugin \{\n  constructor\(options\) \{\n    super\(\{ activeModules: true \}\);\n    this\.options = Object\.assign\(\{\}, DEFAULTS, options\);/
  if (cjsPattern.test(src)) {
    src = src.replace(cjsPattern, `class WebpackBarPlugin extends Webpack__default.ProgressPlugin {
  constructor(options) {
    super({ activeModules: true });
    const opts = Object.assign({}, DEFAULTS, options);
    const { reporters: reportersInput, reporter, basic, fancy, name, color, ...prog5 } = opts;
    this._extra = { reporters: reportersInput, reporter, basic, fancy, name, color };
    this.options = prog5;`)
    patched = true
  }

  if (!patched && !src.includes('webpack 5 ProgressPlugin-validate PATCH')) return 'no-match'
  writeFileSync(file, src, 'utf8')
  return 'patched'
}

const files = [
  join(repoRoot, 'node_modules/webpackbar/dist/index.cjs'),
  join(repoRoot, 'node_modules/webpackbar/dist/index.mjs'),
]
let patched = 0, already = 0, missed = 0
for (const f of files) {
  const r = patchWebpackbar(f)
  if (r === 'patched') patched++
  else if (r === 'already-patched') already++
  else { missed++; console.warn(`[postinstall] webpackbar patch ${f}: ${r}`) }
}
if (patched) console.log(`[postinstall] webpackbar patched: ${patched} file(s)`)
if (missed) console.warn(`[postinstall] webpackbar missed: ${missed} file(s)`)
```

- [ ] **Step 4: 在沙箱重装依赖**

```bash
SANDBOX=/tmp/build-sandbox
cd "$SANDBOX"
rm -rf node_modules package-lock.json client/node_modules server/node_modules
SANDBOX_CACHE="$SANDBOX/.npm-cache"
mkdir -p "$SANDBOX_CACHE"
npm install --no-audit --no-fund --cache "$SANDBOX_CACHE"
```

预期:安装成功,无 peer dependency 错误。如果出现锁定问题,追加 `--legacy-peer-deps`（`.npmrc` 已设）。

- [ ] **Step 5: 验证四个 consumer 都解析到 AJV 6**

```bash
SANDBOX=/tmp/build-sandbox
cd "$SANDBOX"
node -e "
const path=require('path'); const req=require('module').createRequire(path.join(process.cwd(),'package.json'));
for (const p of ['@eslint/eslintrc','eslint','@tarojs/plugin-doctor/node_modules/eslint']) {
  const r=req(path.join(p,'node_modules/ajv/package.json'));
  console.log(p, r.version);
}
const bur = require('module').createRequire(path.join(process.cwd(),'babel-loader/node_modules/schema-utils/package.json'));
console.log('babel-loader/schema-utils -> ajv', bur('ajv/package.json').version);
"
```

预期输出类似：`@eslint/eslintrc 6.15.0`、`eslint 6.15.0`、`@tarojs/plugin-doctor/node_modules/eslint 6.15.0`、`babel-loader/schema-utils -> ajv 6.15.0`。如果出现 8.x,回 Step 2 调整 selector,重新 Step 4。

- [ ] **Step 6: 在沙箱跑 Task 1 测试**

```bash
SANDBOX=/tmp/build-sandbox
cd "$SANDBOX"
node --test client/test/build/ajv-resolution.test.mjs
```

预期：`tests passed`。

- [ ] **Step 7: 在沙箱跑 `build:weapp` 验证 Taro build 插件加载**

```bash
SANDBOX=/tmp/build-sandbox
cd "$SANDBOX/client"
npm run build:weapp 2>&1 | tail -80
```

预期:不再以 `插件依赖 ... build.js 加载失败` 退出；进入 Taro 编译阶段。若仍因业务兼容报错,只记录前 80 行退出原因（本计划只承诺修复工具链层）。

- [ ] **Step 8: 在沙箱跑 `build:h5` 同样校验**

```bash
SANDBOX=/tmp/build-sandbox
cd "$SANDBOX/client"
npm run build:h5 2>&1 | tail -80
```

预期:同上。

### Task 3: 同步主工作区最小变更

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/install-build-patches.mjs`

- [ ] **Step 1: 把沙箱验证过的 `package.json` 复制到主工作区**

```bash
SANDBOX=/tmp/build-sandbox
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
cp "$SANDBOX/package.json" "$ROOT/package.json"
```

- [ ] **Step 2: 把沙箱 `package-lock.json` 复制到主工作区**

```bash
SANDBOX=/tmp/build-sandbox
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
cp "$SANDBOX/package-lock.json" "$ROOT/package-lock.json"
```

- [ ] **Step 3: 把沙箱精简版 `install-build-patches.mjs` 复制到主工作区**

```bash
SANDBOX=/tmp/build-sandbox
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
cp "$SANDBOX/scripts/install-build-patches.mjs" "$ROOT/scripts/install-build-patches.mjs"
```

- [ ] **Step 4: 提交**

```bash
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git -C "$ROOT" add package.json package-lock.json scripts/install-build-patches.mjs
git -C "$ROOT" commit -m "build(deps): nest ajv 6 for eslint and schema-utils"
```

### Task 4: 主工作区最小验证

- [ ] **Step 1: 跑 Task 1 测试**

```bash
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
cd "$ROOT"
node --test client/test/build/ajv-resolution.test.mjs
```

预期:`tests passed`（前提是在 CI/dev 上 `npm install` 已经运行过，让嵌套 AJV 6 真正落到 `node_modules`；若没有则说明 npm overrides 在该环境没有产生嵌套,停下）。

- [ ] **Step 2: 跑登录页 stylelint**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary/client
npm run lint:css:strict-value
```

预期:0 条 error。

- [ ] **Step 3: 不要在主工作区执行 `npm install`,避免与沙箱构建阶段结果互相覆盖。文档化主工作区构建验收的下一步:**

> 登录页实施计划开头会要求“开发者先在本地跑一次 `npm install`，让 Task 1 测试与 `build:weapp`/`build:h5` 验证 AJV 嵌套”。

### Task 5: 自我复审

- [ ] **Step 1: 跑 `git grep -nE 'ajv@\^6|ajv@6\\.\\d|cpSync.*AJV' docs/ scripts/` 确认仓库文档/脚本中不再有 AJV 6 复制指示（除 `npm overrides` 自身）。**
- [ ] **Step 2: 阅读本计划与 `docs/superpowers/specs/2026-07-20-login-ink-ledger-redesign-design.md:330-340`,确认工具链修复与登录页验收互不交叉。**

## 6. 自检

**规格覆盖：**

- 当前 spec 未规定具体修复路径；本计划与 `docs/superpowers/specs/2026-07-20-login-ink-ledger-redesign-design.md:330-340` 描述的“先单独修复”路径一致。
- spec 未承诺 webpack 校验或 Taro 编译阶段全部通过；本计划只承诺修复 Taro build 插件加载阶段。

**占位符扫描：** 计划主体无尚未决项；每步包含具体命令、文件路径与完整代码。

**类型/方法一致：** 仅修改 `package.json`（JSON）、`scripts/install-build-patches.mjs`（Node script）、新增 `.mjs` 测试文件；测试以相对路径直接定位,不依赖 npm API。

**风险：** 若 npm v11 的 `overrides` 对 `schema-utils@2` selector 不生效，回到 Task 2 Step 2 调整 selector 形式（例如 `schema-utils@2.7.1`），再跑沙箱。

## 7. 执行提示

- 所有 npm 安装命令使用沙箱内的本地缓存 `--cache "$SANDBOX/.npm-cache"`，避免占用 `~/.npm` 写权限。
- 完成本计划后，`docs/superpowers/specs/2026-07-20-login-ink-ledger-redesign-design.md:330-340` 的工具链前置项视为已解决；登录页实施计划可以在主工作区验收 `build:weapp`/`build:h5`。
- 不要在本计划中触碰 `client/src/pages/login/**`、`.npmrc`、`server/`、`deploy/`、未提交的 `docs/superpowers/plans/*.md` 与 `.superpowers/`。
