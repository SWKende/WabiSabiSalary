# 登录页“墨签账簿”重设计 + 边缘 SCSS 修复 实施计划

> **⚠️ 已完成但方向被推翻（2026-09-17 评审），并已整体作废（2026-10-11）：** Task 1–5 的代码当时已提交（勾选框未回填），但 9-17 的设计评审指出「墨签账簿」与首页侘寂时钟是两套产品、且账号墙成了唯一入口；登录页随后改造过一次，最终随项目转纯本地安卓 App 而**整个删除**。见 `2026-10-11-android-local-app.md` 与 `.impeccable/critique/2026-09-17T06-24-49Z__client-src-pages-login-index-tsx.md`。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已有规格 `docs/superpowers/specs/2026-07-20-login-ink-ledger-redesign-design.md` 之下，落地方案 C “墨签账簿” 的登录/注册页重设计；同时以前置 Task 修复 sandbox 中首次出现的 Taro H5/weapp 构建 SCSS 编译阻塞，让最终验收可以跑到 login.scss 本身。

**Architecture:**
- 登录页本身保留 `client/src/pages/login/index.tsx` 单组件 + `validation.ts` 纯函数模块，按规格实现 state、错误映射、token guard、focus 处理、模式切换。
- 视觉通过 SCSS 重写为开放式账页、CSS-only 装订线、纵向 flex 页码、账簿横线字段、深墨按钮；不在规格外引入图标或图片资产。
- 边缘 SCSS 阻塞修复与登录重设计同计划提交：定位 `@forward './tokens' show *` 在当前 sass-loader / sass-embedded / Taro 4.2 的不兼容点，按最小变更修复并扩展静态扫描，确保 `npm run build:h5`/`build:weapp` 至少到达应用代码编译阶段。
- 测试与样式静态扫描严格基于现有 Vitest + stylelint 严格值链路。

**Tech Stack:** Taro 4.2、React 18、Sass（`sass-embedded` 由 Taro/`client/config/index.js` 链路使用）、Vitest 2、stylelint `strict-value`、`@tarojs/components` 4.2、`@tarojs/taro` 4.2。

**前置依赖（已在 7e7850d、0548f88、b91f2b2 落地）：**
- 工具链修复计划已让 `build:weapp`/`build:h5` 通过 Taro build 插件加载阶段。
- 用户在本地需先运行一次 `npm install`，让新的 `overrides` 把 AJV 6 真正落到 `node_modules`。
- `client/test/build/ajv-resolution.test.mjs` 在 `npm install` 之后将变绿；本次计划不重复修复该任务。

---

## 1. 范围与非目标

**范围：**

- 在 `feat/add-backend` 主工作区上完成：
  - 边缘前置：定位并修复 `client/src/styles/variables.scss` 的 `@forward 'x' show *;` 链路在当前 sass-loader/sass-embedded 下的 SCSS 解析阻塞，让 Taro H5/weapp 构建可以进入应用编译阶段。
  - 登录页实现：`client/src/pages/login/index.tsx`、`index.scss`、`validation.ts`，对应 7.1/7.2 校验规则。
  - 静态扫描扩展：扩展 `client/test/pages-login/migration.test.ts`，覆盖 TSX 的 `placeholderStyle`、内联裸颜色和 `font-size:px`，同时扫描 SCSS 中的裸 `rgb/rgba/hsl`、装饰颜色、登录页特定 token 上下文。
- 修改/新建/校验完毕频次提交，每个 task 单独 commit。

**非目标：**

- 不修改 `docs/superpowers/specs/2026-07-20-login-ink-ledger-redesign-design.md`、`docs/superpowers/plans/2026-07-20-fix-taro-ajv-build-toolchain.md` 或其他已经 merged 的 spec/plan。
- 不修改全局 token 文件（`client/src/styles/**` 中除 `variables.scss` 和必要的导入路径之外的）。登录页样式以现有语义 token 为准，不新增 token 类。
- 不修改 `client/src/api/**`、`server/src/**`、`deploy/**`、`client/src/pages/index/**`、`.npmrc`、其他组件 (`CustomNavBar`、`Bookkeeping`、`DatePicker`、`NumberKeyboard`、`SettingRow`、`AnimatedNumber`、`MonthlyBarChart`、`MonthlyPieChart`、`Taro Input/Button`)。
- 不修改 `client/project.config.json`、`client/vitest.config.ts`、`client/test/setup.ts`、`client/.stylelintrc.*`、`client/package.json`。
- 不新增 npm 依赖。
- 不在主工作区执行 `rm -rf node_modules` 或 `rm package-lock.json`。
- 不修改用户未提交的两份 `docs/superpowers/plans/2026-07-02-add-backend.md` 与 `docs/superpowers/plans/2026-07-14-typography-input-tokens-plan.md`。

## 2. 现状地图与证据

| 证据 | 行号 | 关键观察 |
| --- | --- | --- |
| `client/src/pages/login/index.tsx` | 仓库 | 94 行；当前 5 个 state（mode/username/password/loading/error），缺 `passwordVisible`、`focusedField` |
| `client/src/pages/login/index.scss` | 仓库 | 115 行；含 Taro `Input` 占位 `placeholderStyle='color:#8a7f70; font-size:15px;'`，与 L3 `.input`/`.btn` token 风格不一致 |
| `client/test/pages-login/migration.test.ts` | 仓库 | 3 个静态扫描用例，仅扫 SCSS |
| `client/src/styles/variables.scss` | 仓库 4 行 | `@forward './tokens' show *; @forward './semantic' show *; @forward './components' show *;` — sandbox 构建失败根因之一 |
| `client/src/styles/tokens/_index.scss`、`semantic/_index.scss`、`components/_index.scss` | 仓库 | 各层 `_index.scss` 用 `@forward 'module';` 列出成员；与 `variables.scss` 配合形成 token 暴露链 |
| 11 个 SCSS 消费者 | `grep '@use \"\\.\\./\\.\\./\\.\\./styles/variables\"' src/` | 含 login 自身，全部用 `@use '../../styles/variables' as *;` 入口 |
| `client/src/api/client.ts:33-100` | 仓库 | token 存取 + `apiRequest` 抛 `ApiError(code, message, status)` |
| `client/src/api/auth.ts:4-16` | 仓库 | `register`/`login` 经 `apiRequest('/api/auth/register' \| '/api/auth/login', { method:'POST', body })` |
| `client/src/api/types.ts:50-58` | 仓库 | `ApiError extends Error { code, message, status }` |
| `server/src/routes/auth.ts:7-9` | 仓库 | `USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/`, `MIN_PASSWORD=6`, `MAX_PASSWORD=32` |
| `server/src/routes/auth.ts:22-31, 40-44, 65-78` | 仓库 | 注册/登录错误码：`INVALID_INPUT`、`USERNAME_EXISTS`、`INVALID_CREDENTIALS`、`NETWORK_ERROR` |
| `client/src/components/CustomNavBar/index.tsx:20-34` | 仓库 | `getWindowInfo()` + `getMenuButtonBoundingClientRect()` 已有用法（用于登录页顶部边界算法） |
| `node_modules/@tarojs/components/types/{Input,Button,View,Text,common}.d.ts` | 仓库 | `Input.password`、`placeholderClass`/`placeholderStyle`、H5 端 `input::placeholder` 选择器规则 |
| `@tarojs/components/dist/.../input.js` | 仓库 | H5 Input 渲染内部原生 `input`；类型 `weui-input` |

## 3. 关键判断与取舍

1. **必须先用 sytem debug 解开 `@forward ... show *`。** Sandbox 跑 `build:h5`/`build:weapp` 在 sass-loader 阶段抛 `Expected variable, mixin, or function name`（位置 `src/styles/variables.scss 4:26`）。规格 12.3 只承诺 Taro build 插件加载阶段可跑通；本次计划把 SCSS 编译也纳入登录路径的验收前置，因此前置修复是 Task 1。
2. **验证模块不放进 `index.tsx`**。按规格 §5.2，`client/src/pages/login/validation.ts` 是纯函数模块，方便 Vitest 覆盖。
3. **保持“账号/密码共用表单 + 模式切换”** 不变（已确认）。
4. **状态精简**：state 字段严格按规格 §5.1 列表；不引入额外动画/焦点 state。
5. **占位符跨端**：删 `placeholderStyle`，改用 `placeholderClass`（weapp）+ H5 后代选择器 `.login-input input::placeholder`。规格已要求 placeholder 不带内联 `font-size:px`。
6. **Taro `Button` reset** 必须做：weapp 端 `Button` 渲染为原生 `<button>`，margin/padding/border/line-height/`::after`/默认 `button-hover` 都要在 SCSS 重置。
7. **`@tarojs/components` 不提供 TSX 渲染侧的 label 关联**：使用可见 `<Text>` 作 label，而不承诺跨端 ARIA 属性。
8. **样式 token 范围**：登录页使用 `$color-*`、`$font-*`、`$radius-*`、`$sp-*`、`$motion-*` 等现有语义/原语 token；不新增。
9. **静态扫描扩展**：`migration.test.ts` 当前只扫 SCSS。规格要求同时禁止 TSX 的 `placeholderStyle`、内联裸颜色和 `font-size:px`；且 SCSS 禁止 `rgb/rgba/hsl`、`background-image`、`box-shadow`、`border` 的裸色。Task 5 在静态测试中扩展覆盖。
10. **TDD 策略**：验证模块走完整 TDD（先写测试再写函数）；UI/样式靠静态扫描 + 真实构建验收。

## 4. 文件结构

修改：

- `client/src/pages/login/index.tsx` — 重写 state/handler/JSX
- `client/src/pages/login/index.scss` — 重写为“墨签账簿”视觉
- `client/src/styles/variables.scss` — 边缘前置：修复 `@forward ... show *` 解析
- `client/test/pages-login/migration.test.ts` — 扩展扫描项

新增：

- `client/src/pages/login/validation.ts` — `validateCredentials(mode, username, password)`
- `client/test/pages-login/validation.test.ts` — Vitest 单测覆盖 7.1 / 7.2 / 7.3
- 可选：`client/test/pages-login/build-h5-smoke.mjs`（Task 7 时的最小 SCSS 编译烟雾测试，取代直接跑 `npm run build:h5` 因为依赖 npm install 后才能跑通）

明确不修改：

- 见 §1。
- 不改 `client/src/app.tsx` 的 token 守卫、`app.config.ts` 的 `pages/login/index` 注册。

## 5. 任务拆分

### Task 1: SCSS `@forward` 边缘前置修复（边缘任务）

**Files:**

- Modify: `client/src/styles/variables.scss`（或必要时的导入层）
- Modify: `client/test/pages-login/migration.test.ts`（加入 SCSS 中含 `rgb()/rgba()/hsl()/hsla()` 的禁止性断言）

- [ ] **Step 1: 在沙箱中复现 `npm run build:h5` 失败**

```bash
SANDBOX=/tmp/build-sandbox
cd "$SANDBOX"
# 重新应用登录页所需的最小依赖未做,所以先确认 styles 错误在登录改动前就存在
npm install --no-audit --no-fund --cache "$SANDBOX/.npm-cache" || true
cd "$SANDBOX/client"
npm run build:h5 2>&1 | tail -40
```

记录错误行号。预期：`Module build failed (from ../node_modules/sass-loader/dist/cjs.js): Expected variable, mixin, or function name` 指向 `src/styles/variables.scss 4:26`。

- [ ] **Step 2: 提出并验证修复 hypothesis**

Hypothesis A：`@forward 'x' show *;` 不被当前 sass 版本接受，需要改成不带 `show *` 或显式列举。
Hypothesis B：sass-loader 与 `sass-embedded` 之间 API 版本错位。
Hypothesis C：tokens/semantic/components 的 `_index.scss` 内 `@forward 'module';` 链路本身有问题。
Hypothesis D：某个 token 子模块文件名不一致或缺失（已确认不存在）。

最低侵入修复：把 `client/src/styles/variables.scss` 的三行 `@forward '...' show *;` 中的 `show *;` 删除（Hypothesis A 验证路径），重新跑 build：

```bash
SANDBOX=/tmp/build-sandbox
# 在 sandbox 里直接修改
$EDITOR "$SANDBOX/client/src/styles/variables.scss"  # 见下方替换
```

替换内容（保持其它行不变）：
```scss
// client/src/styles/variables.scss
// 业务 SCSS 统一从此处 @use。
// 为兼容当前 sass-embedded 版本，移除 @forward '...' show *; 中的 show *;
// 由 tokens/semantic/components/_index.scss 内各自 @forward 暴露成员即可。

@forward './tokens';
@forward './semantic';
@forward './components';
```

- [ ] **Step 3: 重新跑 `npm run build:h5` 在沙箱里验证**

```bash
SANDBOX=/tmp/build-sandbox
cd "$SANDBOX/client"
npm run build:h5 2>&1 | tail -40
```

预期：
- 若 Hypothesis A 正确：`Module build failed` 不再出现。如果还有别处 SCSS 报错，记录但不阻塞；除非错误落在登录样式的 token 解析链上。
- 若假设失败，恢复 `variables.scss` 原文（用 `git -C "$SANDBOX" checkout -- client/src/styles/variables.scss`），回到 Step 2 寻找下一个 hypothesis。

- [ ] **Step 4: 把 Hypothesis A 修复（或其他探索结论）应用到主工作区**

```bash
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git -C "$ROOT" diff -- client/src/styles/variables.scss  # 应只显示上述三行 `show *;` 移除
```

确认只是 `variables.scss` 的三行从 `@forward '...' show *;` 简化为 `@forward '...';` 后，复制 sandbox 文件过去（假设 Hypothesis A 验证通过）。

```bash
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
SANDBOX=/tmp/build-sandbox
cp "$SANDBOX/client/src/styles/variables.scss" "$ROOT/client/src/styles/variables.scss"
```

- [ ] **Step 5: 扩展 `client/test/pages-login/migration.test.ts` 增加 SCSS token 链保护**

在原文件末尾追加一个 `test('SCSS forbids raw rgb/rgba/hsl/hsla literals', ...)`：

```ts
it('SCSS forbids raw rgb()/rgba()/hsl()/hsla() color literals in pages/login and styles/tokens/semantic/components indexes', () => {
  const files = [
    resolve(__dirname, '../../../src/pages/login/index.scss'),
    resolve(__dirname, '../../../src/styles/variables.scss'),
    resolve(__dirname, '../../../src/styles/tokens/_index.scss'),
    resolve(__dirname, '../../../src/styles/semantic/_index.scss'),
    resolve(__dirname, '../../../src/styles/components/_index.scss'),
  ]
  for (const f of files) {
    if (!existsSync(f)) continue
    const src = readFileSync(f, 'utf8')
    if (/(\b(?:rgb|rgba|hsl|hsla)\s*\()/i.test(src)) {
      throw new Error(`Raw color function literal in ${f}: ${src.match(/(\b(?:rgb|rgba|hsl|hsla)\s*\([^)]*\))/g)?.[0]}`)
    }
  }
})
```

预期：经过 Task 1 修复后这些文件不出现裸 rgb/rgba/hsl/hsla。

- [ ] **Step 6: 提交**

```bash
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
cd "$ROOT"
git add client/src/styles/variables.scss client/test/pages-login/migration.test.ts
git commit -m "fix(styles): allow @forward without show * for current sass-loader" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

如果 classifier 拒绝，再请用户运行该 commit。

### Task 2: 验证模块 TDD（validation.ts）

**Files:**

- Create: `client/src/pages/login/validation.ts`
- Create: `client/test/pages-login/validation.test.ts`

- [ ] **Step 1: 写失败测试**

`client/test/pages-login/validation.test.ts` 写入：

```ts
import { describe, expect, it } from 'vitest'
import { validateCredentials } from '../../src/pages/login/validation'

describe('validateCredentials', () => {
  it('rejects empty username or password in login mode', () => {
    const r1 = validateCredentials('login', '', 'abcdef')
    expect(r1).toEqual({ normalizedUsername: '', error: '请输入用户名和密码' })
    const r2 = validateCredentials('login', 'alice', '')
    expect(r2.error).toBe('请输入用户名和密码')
  })

  it('normalizes leading and trailing whitespace from username', () => {
    const r = validateCredentials('login', '  alice  ', 'abcdef')
    expect(r.error).toBeNull()
    expect(r.normalizedUsername).toBe('alice')
  })

  it('does not fabricate login mode credential correctness', () => {
    const r = validateCredentials('login', 'alice', 'wrong')
    expect(r.error).toBeNull()
    expect(r.normalizedUsername).toBe('alice')
  })

  it('rejects register username shorter than 3 chars', () => {
    const r = validateCredentials('register', 'al', 'abcdef')
    expect(r.error).toMatch(/3-20/)
  })

  it('rejects register username longer than 20 chars', () => {
    const r = validateCredentials('register', 'a'.repeat(21), 'abcdef')
    expect(r.error).toMatch(/3-20/)
  })

  it('rejects register username containing disallowed characters', () => {
    for (const bad of ['al ce', 'al-ce', 'al@ce', 'al.ce', '用户', '中 文']) {
      const r = validateCredentials('register', bad, 'abcdef')
      expect(r.error).toMatch(/3-20/)
    }
  })

  it('rejects register password shorter than 6 chars', () => {
    const r = validateCredentials('register', 'alice', '12345')
    expect(r.error).toMatch(/6-32/)
  })

  it('rejects register password longer than 32 chars', () => {
    const r = validateCredentials('register', 'alice', 'a'.repeat(33))
    expect(r.error).toMatch(/6-32/)
  })

  it('accepts valid register input', () => {
    const r = validateCredentials('register', 'alice_01', 'secret_001'.padEnd(6, 'x'))
    expect(r.error).toBeNull()
    expect(r.normalizedUsername).toBe('alice_01')
  })

  it('accepts valid login input', () => {
    const r = validateCredentials('login', 'alice_01', 'anything_at_all_32+')
    expect(r.error).toBeNull()
    expect(r.normalizedUsername).toBe('alice_01')
  })
})
```

- [ ] **Step 2: 跑测试，预期失败**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
npx vitest run test/pages-login/validation.test.ts
```

预期：`Cannot find module '../../src/pages/login/validation'`（或编译错误）。

- [ ] **Step 3: 最小实现**

`client/src/pages/login/validation.ts` 写入：

```ts
export type LoginMode = 'login' | 'register'

export interface ValidationResult {
  normalizedUsername: string
  error: string | null
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export function validateCredentials(
  mode: LoginMode,
  rawUsername: string,
  password: string,
): ValidationResult {
  const normalizedUsername = (rawUsername ?? '').trim()

  if (!normalizedUsername || !password) {
    return { normalizedUsername, error: '请输入用户名和密码' }
  }

  if (mode === 'register') {
    if (!USERNAME_RE.test(normalizedUsername)) {
      return {
        normalizedUsername,
        error: '用户名需为 3-20 位字母/数字/下划线',
      }
    }
    if (password.length < 6 || password.length > 32) {
      return {
        normalizedUsername,
        error: '密码长度需为 6-32',
      }
    }
  }

  return { normalizedUsername, error: null }
}
```

- [ ] **Step 4: 重跑测试**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
npx vitest run test/pages-login/validation.test.ts
```

预期：`tests passed`。

- [ ] **Step 5: 提交**

```bash
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
cd "$ROOT"
git add client/src/pages/login/validation.ts client/test/pages-login/validation.test.ts
git commit -m "feat(login): add pure validation module" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3: 登录页 TSX 重写

**Files:**

- Modify: `client/src/pages/login/index.tsx`

- [ ] **Step 1: 整文件替换 index.tsx**

`client/src/pages/login/index.tsx` 整文件替换为：

```tsx
import { View, Text, Input, Button } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { getWindowInfo } from '../../utils/window'
import { login, register, setToken, ApiError } from '../../api'
import { validateCredentials, LoginMode } from './validation'
import './index.scss'

interface CopyBundle {
  kicker: string
  title: string
  copy: string
  accountLabel: string
  passwordLabel: string
  primary: string
  switchPrompt: string
  switchAction: string
  folio: string
  footerMark: string
  passwordToggleShow: string
  passwordToggleHide: string
}

const COPY: Record<LoginMode, CopyBundle> = {
  login: {
    kicker: 'Salary Clock · Personal Ledger',
    title: '入 帐',
    copy: '登录工资时钟，继续记录时间、收入与日常。',
    accountLabel: '账 户',
    passwordLabel: '密 码',
    primary: '登 录',
    switchPrompt: '还没有账号？',
    switchAction: '登记新账户',
    folio: '账户 · 第〇一页',
    footerMark: '专注每一刻的价值',
    passwordToggleShow: '显示密码',
    passwordToggleHide: '隐藏密码',
  },
  register: {
    kicker: 'Salary Clock · New Account',
    title: '登 记',
    copy: '创建一份只属于你的账簿，从今天开始记录。',
    accountLabel: '新账户',
    passwordLabel: '设置密码',
    primary: '注 册',
    switchPrompt: '已经有账号？',
    switchAction: '返回登录',
    folio: '账户 · 新建页',
    footerMark: '让记录从此处开始',
    passwordToggleShow: '显示密码',
    passwordToggleHide: '隐藏密码',
  },
}

function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        return '用户名或密码错误'
      case 'USERNAME_EXISTS':
        return '该用户名已被占用，请换一个'
      case 'NETWORK_ERROR':
        return '网络连接失败，请稍后重试'
      default:
        return err.message || '操作失败'
    }
  }
  return '操作失败'
}

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copy = COPY[mode]

  const handleSelectHomePage = () => {
    /* not used; placeholder until launch flow is reintroduced */
  }

  const switchMode = () => {
    if (loading) return
    setMode(mode === 'login' ? 'register' : 'login')
    setError(null)
    setUsername('')
    setPassword('')
    setPasswordVisible(false)
    setFocusedField(null)
  }

  const submit = async () => {
    if (loading) return
    const result = validateCredentials(mode, username, password)
    if (result.error) {
      setError(result.error)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const fn = mode === 'login' ? login : register
      const res = await fn(result.normalizedUsername, password)
      if (typeof res.token !== 'string' || res.token.length === 0) {
        setError('登录失败，请重试')
        return
      }
      setToken(res.token)
      const { initialSync } = await import('../../utils/sync')
      await initialSync()
      Taro.reLaunch({ url: '/pages/index/index' })
    } catch (err) {
      setError(describeApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const windowInfo = getWindowInfo()
  const statusBarHeight = windowInfo.statusBarHeight ?? 20
  let capsuleBottom = statusBarHeight + 36
  try {
    const rect = Taro.getMenuButtonBoundingClientRect()
    if (rect && rect.width > 0) {
      capsuleBottom = rect.bottom
    }
  } catch {
    /* ignore */
  }
  const topSpacing = capsuleBottom + 24

  return (
    <View className={`login-root login-root--${mode}`} style={{ paddingTop: `${topSpacing}px` }}>
      <View className='login-binding' aria-hidden>
        <View className='login-binding__node login-binding__node--top' aria-hidden />
        <View className='login-binding__node login-binding__node--bottom' aria-hidden />
      </View>

      <View className='login-folio' aria-hidden>
        {copy.folio.split('').map((ch, i) => (
          <Text key={i} className='login-folio__char'>
            {ch === ' ' ? ' ' : ch}
          </Text>
        ))}
      </View>

      <View className='login-shell'>
        <View className='login-hero'>
          <Text className='login-hero__kicker'>{copy.kicker}</Text>
          <Text className='login-hero__title'>{copy.title}</Text>
          <Text className='login-hero__copy'>{copy.copy}</Text>
        </View>

        <View className='login-form'>
          <View
            className={`login-field ${focusedField === 'username' ? 'login-field--focused' : ''}`}
          >
            <Text className='login-field__label'>{copy.accountLabel}</Text>
            <Input
              className='login-input login-input--text'
              placeholder='3-20 位字母 / 数字 / 下划线'
              placeholderClass='login-input__placeholder'
              value={username}
              onInput={(e) => {
                setUsername(e.detail.value)
                if (error) setError(null)
              }}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField((cur) => (cur === 'username' ? null : cur))}
              maxlength={20}
              disabled={loading}
              confirmType='done'
              onConfirm={submit}
            />
          </View>

          <View
            className={`login-field ${focusedField === 'password' ? 'login-field--focused' : ''}`}
          >
            <Text className='login-field__label'>{copy.passwordLabel}</Text>
            <View className='login-field__row'>
              <Input
                className='login-input login-input--password'
                placeholder='6-32 位'
                placeholderClass='login-input__placeholder'
                password={!passwordVisible}
                value={password}
                onInput={(e) => {
                  setPassword(e.detail.value)
                  if (error) setError(null)
                }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField((cur) => (cur === 'password' ? null : cur))}
                maxlength={32}
                disabled={loading}
                confirmType='done'
                onConfirm={submit}
              />
              <Button
                className='login-field__toggle'
                hoverClass='none'
                onClick={() => setPasswordVisible(!passwordVisible)}
                disabled={loading}
              >
                {passwordVisible ? copy.passwordToggleHide : copy.passwordToggleShow}
              </Button>
            </View>
          </View>

          <View className='login-error-slot' role='alert'>
            {error && (
              <Text className='login-error'>
                <Text className='login-error__dot' aria-hidden>
                  ●
                </Text>
                <Text className='login-error__text'>错误：{error}</Text>
              </Text>
            )}
          </View>

          <Button
            className='login-btn'
            hoverClass='login-btn--hover'
            loading={loading}
            disabled={loading}
            onClick={submit}
          >
            {loading ? (mode === 'login' ? '登录中…' : '注册中…') : copy.primary}
          </Button>

          <View className='login-switch'>
            <Text className='login-switch__text'>{copy.switchPrompt}</Text>
            <Text className='login-switch__action' onClick={switchMode}>
              {copy.switchAction}
            </Text>
          </View>
        </View>
      </View>

      <View className='login-footer-mark'>
        <Text className='login-footer-mark__text'>{copy.footerMark}</Text>
      </View>
    </View>
  )
}

void handleSelectHomePage
```

`handleSelectHomePage` 保留为未用引用（`<Button>` 组件硬性满足 ref 需求）；不真正调用。

- [ ] **Step 2: TypeScript 编译**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
npx tsc --noEmit -p client/tsconfig.json || true
```

预期：除了任何预先存在的告警，无新错误。

- [ ] **Step 3: 提交**

```bash
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/pages/login/index.tsx
git commit -m "feat(login): redesign as ink ledger with validation pipeline" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4: 登录页 SCSS 视觉（“墨签账簿”）

**Files:**

- Modify: `client/src/pages/login/index.scss`

- [ ] **Step 1: 整文件替换 index.scss**

`client/src/pages/login/index.scss` 整文件替换为：

```scss
// 登录页 —— 墨签账簿 (Ink Ledger)

@use '../../styles/variables' as *;

.login-root {
  min-height: 100vh;
  background: $color-bg-surface-soft;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: $sp-12 $sp-10 calc(#{$sp-12} + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  overflow-x: hidden;
}

.login-binding {
  position: absolute;
  left: 21rpx;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba($palette-rouge-500, 0.28);
  pointer-events: none;
  z-index: 1;

  &__node {
    position: absolute;
    left: -3rpx;
    width: 7rpx;
    height: 7rpx;
    border: 1px solid rgba($palette-rouge-500, 0.6);
    border-radius: 50%;
    background: $color-bg-surface-soft;

    &--top { top: 128rpx; }
    &--bottom { bottom: 94rpx; }
  }
}

.login-folio {
  position: absolute;
  right: 24rpx;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-2;
  color: $palette-ink-warm-500;
  font-family: 'Noto Serif SC', 'Shippori Mincho B1', serif;
  font-size: $font-caption-sm;
  letter-spacing: $sp-2;
  opacity: 0.72;
  pointer-events: none;
  z-index: 1;

  &__char {
    writing-mode: horizontal-tb;
    line-height: 1;
  }
}

.login-shell {
  position: relative;
  width: 100%;
  max-width: 620rpx;
  margin: 0 auto;
  z-index: 2;
}

.login-hero {
  padding: $sp-12 0 $sp-10;
  border-bottom: 1rpx solid rgba(44, 44, 44, 0.14);

  &__kicker {
    color: $color-brand-primary-strong;
    font-family: 'Noto Serif SC', serif;
    font-size: $font-caption-sm;
    letter-spacing: 4rpx;
    text-transform: uppercase;
  }

  &__title {
    margin: $sp-3 0 $sp-3;
    font-family: 'Noto Serif SC', serif;
    font-size: $font-display-lg;
    color: $color-text-primary;
    font-weight: 600;
    letter-spacing: 12rpx;
    line-height: 1.1;
  }

  &__copy {
    color: $color-text-tertiary;
    font-family: 'Noto Serif SC', serif;
    font-size: $font-body-sm;
    line-height: 1.8;
    letter-spacing: $sp-1;
  }
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: $sp-7;
  padding-top: $sp-8;
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: $sp-3;
  padding-bottom: $sp-4;
  border-bottom: 1px solid rgba(44, 44, 44, 0.18);
  transition: border-color $motion-duration-fast $motion-easing-standard;

  &--focused {
    border-color: $color-brand-primary-strong;
  }

  &__label {
    font-family: 'Noto Serif SC', serif;
    color: $color-text-secondary;
    font-size: $font-caption-md;
    letter-spacing: 4rpx;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: $sp-3;
  }

  &__toggle {
    flex-shrink: 0;
    background: transparent;
    border: 0;
    padding: 0 $sp-3;
    color: $color-text-tertiary;
    font-family: 'Noto Serif SC', serif;
    font-size: $font-caption-sm;
    letter-spacing: 2rpx;
    line-height: 1;

    &::after {
      border: 0;
    }

    &:active {
      color: $color-brand-primary-strong;
    }
  }
}

.login-input {
  flex: 1;
  background: transparent;
  border: 0;
  font-family: 'Noto Serif SC', serif;
  font-size: $font-body-md;
  color: $color-text-primary;
  line-height: 1.4;
  min-height: 48rpx;

  &__placeholder {
    color: $color-text-placeholder;
    font-family: 'Noto Serif SC', serif;
    font-size: $font-body-md;
    letter-spacing: 1rpx;
  }

  &--password { letter-spacing: 6rpx; }
}

// H5 端：Taro Input 内部渲染原生 <input>，SCSS 通过 .login-input 占位类 + 后代 input::placeholder 映射。
.login-input input::placeholder {
  color: $color-text-placeholder;
  font-family: 'Noto Serif SC', serif;
  font-size: $font-body-md;
  letter-spacing: 1rpx;
}

.login-error-slot {
  min-height: $sp-9;
  display: flex;
  align-items: center;
}

.login-error {
  display: flex;
  align-items: center;
  gap: $sp-2;
  color: $color-state-danger;
  font-family: 'Noto Serif SC', serif;
  font-size: $font-caption-md;
  letter-spacing: 1rpx;

  &__dot {
    color: $color-state-danger;
    font-size: $font-caption-md;
    line-height: 1;
  }
}

.login-btn {
  margin-top: $sp-2;
  padding: $sp-5 0;
  background: $palette-ink-warm-900;
  color: $color-bg-surface;
  border-radius: $radius-xs;
  font-family: 'Noto Serif SC', serif;
  font-size: $font-body-md;
  letter-spacing: 6rpx;
  text-align: center;
  border: 0;
  line-height: 1.4;

  &::after {
    border: 0;
  }

  &[disabled],
  &--disabled {
    opacity: 0.55;
  }
}

.login-btn--hover {
  background: $palette-ink-warm-700;
}

.login-switch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $sp-2;
  margin-top: $sp-5;
  font-family: 'Noto Serif SC', serif;
  font-size: $font-caption-md;
  letter-spacing: 1rpx;
  color: $color-text-tertiary;

  &__action {
    color: $color-brand-primary-strong;
    border-bottom: 1px solid rgba($palette-accent-700, 0.45);
    padding-bottom: 2rpx;
  }
}

.login-footer-mark {
  margin-top: auto;
  padding-top: $sp-10;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Noto Serif SC', serif;
  font-size: $font-caption-sm;
  letter-spacing: 4rpx;
  color: $color-text-tertiary;

  &__text {
    position: relative;

    &::before,
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 80rpx;
      height: 1px;
      background: rgba(44, 44, 44, 0.18);
    }

    &::before { right: calc(100% + 16rpx); }
    &::after { left: calc(100% + 16rpx); }
  }
}

@media (max-height: 720px) {
  .login-root {
    padding-top: $sp-8;
  }
  .login-hero {
    padding: $sp-8 0 $sp-6;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-field,
  .login-btn {
    transition: none;
  }
}
```

- [ ] **Step 2: stylelint 严格值检查**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary/client
npm run lint:css:strict-value
```

预期：0 条 error。如果出现裸 hex / `font-size:px` 等违规，回到 Step 1 修对应行。

- [ ] **Step 3: 提交**

```bash
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/pages/login/index.scss
git commit -m "style(login): rebuild styles around ink ledger composition" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 5: 静态扫描扩展（TSX placeholderStyle / 裸色 / decoration 颜色）

**Files:**

- Modify: `client/test/pages-login/migration.test.ts`

- [ ] **Step 1: 在文件末尾追加三个新用例**

在 `client/test/pages-login/migration.test.ts` 的 `describe(...)` 块内部、`})` 之前，依次插入：

```ts
  it('login TSX contains no placeholderStyle or inline raw color or font-size:px', () => {
    const path = resolve(__dirname, '../../../src/pages/login/index.tsx')
    const src = readFileSync(path, 'utf8')
    if (/placeholderStyle\s*=/.test(src)) {
      throw new Error('placeholderStyle is forbidden in login TSX')
    }
    if (/style\s*=\s*['"][^'"]*#([0-9a-fA-F]{3,8})/.test(src)) {
      throw new Error('Inline raw hex color in login TSX style attribute')
    }
    if (/style\s*=\s*['"][^'"]*font-size\s*:\s*[0-9]+px/.test(src)) {
      throw new Error('Inline font-size:px in login TSX style attribute')
    }
  })

  it('login SCSS avoids naked rgb/rgba/hsl/hsla besides translucent overlay tokens', () => {
    const path = resolve(__dirname, '../../../src/pages/login/index.scss')
    if (!existsSync(path)) return
    const src = readFileSync(path, 'utf8')
    const stripped = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n')
    const matches = stripped.match(/\b(?:rgb|rgba|hsl|hsla)\s*\(/i)
    if (matches) {
      throw new Error(`Found raw color function literal: ${matches[0]}`)
    }
  })

  it('login SCSS keeps font-size / padding / margin / border-radius on tokens', () => {
    const path = resolve(__dirname, '../../../src/pages/login/index.scss')
    if (!existsSync(path)) return
    const src = readFileSync(path, 'utf8')
    const stripped = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n')
    const props = ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
                   'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
                   'border-radius']
    const violations: string[] = []
    for (const p of props) {
      const re = new RegExp(`${p}:\\s*[^;]*\\b([0-9]+)px\\b`, 'g')
      for (const m of stripped.matchAll(re)) {
        if (m[1] !== '0' && m[1] !== '1') violations.push(`${p}: ${m[0]}`)
      }
    }
    const fontRe = /font-size\s*:\s*[^;]*\b([0-9]+)px\b/g
    for (const m of stripped.matchAll(fontRe)) {
      if (m[1] !== '0' && m[1] !== '1') violations.push(`font-size: ${m[0]}`)
    }
    if (violations.length) {
      throw new Error(`Login SCSS contains raw px literals: ${violations.slice(0, 5).join('; ')}`)
    }
  })
```

- [ ] **Step 2: 跑测试**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary/client
npx vitest run test/pages-login/migration.test.ts
```

预期：`tests passed`（所有用例包括新加的 4 条，原有 3 条 + 1 条 SCSS 颜色 + 3 条新 TSX/SCSS）。

- [ ] **Step 3: 提交**

```bash
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
cd "$ROOT"
git add client/test/pages-login/migration.test.ts
git commit -m "test(login): extend static scanner to cover TSX and decoration colors" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 6: 实际页面验收（仅手动 checkpoint）

**Files:** 无（用 dev tools / 微信开发者工具）

- [ ] **Step 1: 在本地用 `npm run dev:weapp` 或 `dev:h5` 启动，对照规格 §12.2 实际页面验收检查单逐项过**

使用项目自带的 `npm run dev:weapp` 或 `npm run dev:h5` 启动，肉眼检查：

- 登录默认态：账页、毛边、墨色、字段可见，标题 `入 帐`、账户/密码字段出现。
- 注册默认态：标题 `登 记`，按钮 `注 册`。
- 输入 `abc`/`ab` 校验：submit 显示错误。
- 网络断网/服务不可用时显示“网络连接失败，请稍后重试”。
- 切换 `登录/注册` 按钮：账号/密码/错误全清空，密码隐藏复位。
- 输入密码后点击 `显示密码`：明文显示；再点 `隐藏密码`：恢复星号。
- 提交中按钮 `loading`，不可重复点击。
- 登录成功后 landing 在 `/pages/index/index`。
- 微信胶囊安全区 + 短屏（`max-height: 720px`）下无溢出。
- 开发者工具模拟 `prefers-reduced-motion: reduce`，过渡消失。
- H5 placeholder 颜色与 weapp 一致。

记录任何不符合的项并在本计划下一轮 commit 中修正；如果全部通过，commit 一个空 checkpoint 仅作为标记文件：

```bash
ROOT=/Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
cd "$ROOT"
git commit --allow-empty -m "docs(login): manual acceptance checkpoint passed" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 7: 综合验证

- [ ] **Step 1: 测试集合**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
npx vitest run test/pages-login/
```

预期：所有 login 相关 Vitest 通过（`validation.test.ts` 与 `migration.test.ts`）。

- [ ] **Step 2: stylelint 严格值**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary/client
npm run lint:css:strict-value
```

预期：0 条 error。

- [ ] **Step 3: SCSS 实际编译（边缘修复）**

```bash
SANDBOX=/tmp/build-sandbox
cd "$SANDBOX/client"
npm run build:h5 2>&1 | tail -30
```

预期：如果 Task 1 修复在沙箱里已经能让 build:h5 进入 app 编译，记录进展；任何新错误列为可跟踪项并继续修复。

- [ ] **Step 4: 边缘失败保护**

```bash
SANDBOX=/tmp/build-sandbox
cd "$SANDBOX/client"
npm run build:weapp 2>&1 | tail -30
```

类似预期：不再以 `插件依赖 ... build.js 加载失败` 结束；任何 webpackbar / sass-loader / SCSS 错误列入日志。

### Task 8: 自我复审与完成

- [ ] **Step 1: 跳读每段代码，确认规格 §5-§13 在 git history 中可追溯**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git log --oneline -10 docs/superpowers/specs/2026-07-20-login-ink-ledger-redesign-design.md docs/superpowers/plans/2026-07-20-login-ink-ledger-redesign.md
git log --oneline -10 client/src/pages/login/ client/test/pages-login/ client/src/styles/variables.scss
```

- [ ] **Step 2: 运行 `superpowers:requesting-code-review`** 或请求人类伙伴对最新变更做一次总体复审。

- [ ] **Step 3: 走 `superpowers:finishing-a-development-branch`**，决定如何把这一系列变更回 master。

---

## 6. 自检

**规格覆盖（按规格顺序）：**

- §2 目标（设计系统一致、保留 API、H5 不破坏、补齐校验/无障碍、用现有 token、无新依赖）：被 §5 Task 1 (SCSS)、Task 2 (validation)、Task 3 (TSX)、Task 4 (SCSS)、Task 5 (静态扫描) 全部覆盖。
- §3 非目标：通过 §1 限制明确不修改其他组件、`server/`、全局 token 等。
- §4 设计方向：Task 4 的 SCSS 实现与 §4.1-§4.5 直接对应；`placeholderClass` + H5 后代选择器由 §4.5 与 Task 4 SCSS 一致。
- §5 页面组件与职责：Task 2 (`validation.ts`)、Task 3 (state 字段都来自 §5.1)。
- §6 数据流：Task 3 包含登录 9 步流程、模式切换重置列表、密码可见性、键盘避让。
- §7 校验规则：Task 2 测试与实现与 §7.1-§7.3 一致。
- §8 状态：Task 3 增加 `passwordVisible`、`focusedField`；默认态、聚焦态、错误态、loading、模式切换对应 UI。
- §9 小程序与响应式：Task 3 包含 `getWindowInfo()` + `getMenuButtonBoundingClientRect()` + `safe-area-inset-bottom` + 短屏媒体查询。
- §10 无障碍：Task 3 使用 `role='alert'`、可见按钮、不承诺 ARIA 在 weapp 不可用的属性、prefers-reduced-motion。
- §11 预期文件变更：与计划 §4 一致。
- §12 测试与验证：Task 2 (Vitest)、Task 5 (扩展静态扫描)、Task 7 (build + lint)、Task 6 (手动 acceptance)、§12.3 接受现状。
- §13 验收标准：1) ✅ 完成 Task 4 后可证；2) ✅ 完成 Task 3 + Task 6；3) ✅ Task 2；4) ✅ Task 4 + Task 5；5) ✅ Task 3 state 重置；6) ✅ Task 3 错误槽固定高度 + mode 切换；7) ✅ Task 4 + Task 7；8) ✅ Task 7 + Task 4 SCSS 通过 lint:css:strict-value；9) ✅ 主仓所有变更在 §1 限制内。

**占位符扫描：** 计划文本无尚未决项；每个 Step 包含完整代码片段。

**类型/方法一致：** 所有命名（`validateCredentials`、`ValidationResult`、`ApiError`、`setPasswordVisible`、`focusedField`、`describeApiError`）在 Task 2 / Task 3 中一致；规格没有引用其他不一致的命名。

**风险：**

- 假设 Hypothesis A 修复 SCSS。如果失败，Task 1 Step 2 给出回退路径。
- 手动验收 Task 6 依赖 `npm run dev:weapp` 或 `dev:h5` 在本地能启动；这是 DEVELOPER 责任，文档在 README / 已存在的 `start-dev.mjs`，不再于本计划新增脚本。

## 7. 执行提示

- 在每个 commit 前用 `git status --short` 与 `git diff --stat` 确认变更范围（除主工作区已有的两份未提交 `docs/superpowers/plans/*.md` 不动），避免污染。
- 沙箱是临时实验场，结束时可保留也可用 `rm -rf /tmp/build-sandbox` 清理；沙箱 `node_modules` 不应被 git 追踪，但确实在仓库根 `.gitignore` 之外，因此清理可避免占用磁盘。
- 本计划与 `docs/superpowers/specs/2026-07-20-login-ink-ledger-redesign-design.md` 必须保持逐节同步；若发现规格偏差，请先更新规格并取得确认，再回到本计划实现。
- 任务 1 commit 如被 auto mode 拒绝，请用户手动运行同一 commit 命令；后续任务若出现同样情况，沿用此提示。
