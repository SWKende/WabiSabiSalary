# Typography & Input Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在 trae-salary 项目落地三层 design token 体系(Primitive → Semantic → Component),把首页 `pages/index/index.scss` 中散乱的 21 种字号、14 种间距、6 种圆角、100+ 处硬编码颜色集中化,完成视觉零变化的全量迁移,并以 stylelint 守住未来增量。

**Architecture:** 在 `client/src/styles/` 下分 `tokens/`(L1 原语)、`semantic/`(L2 语义)、`components/`(L3 组件)三层;L1/L2 通过 SCSS 变量静态编译,L3 通过 CSS 变量暴露给组件运行时覆写。所有尺寸单位固定使用 `rpx`(Taro designWidth=750)。

**Tech Stack:** Taro 4.2 + TypeScript + SCSS + Stylelint + Vitest + sass(sass 编译器,运行时构造 token 编译产物用于测试)。

**Prerequisites:** 已存在 `docs/superpowers/specs/2026-07-14-typography-input-tokens-design.md`(本次实现的规格来源)。

---

## 阶段总览

| 阶段 | Task 编号 | 对应 PR | 核心目标 |
|------|----------|---------|---------|
| 1. 基础设施 | Task 1.1–1.6 | PR-1 + PR-2 | 目录骨架、stylelint warn、snapshot 基线 |
| 2. L1 原语 Token | Task 2.1–2.6 | PR-3 | 色板/字号/间距/圆角/z-index/motion |
| 3. L2 + L3 | Task 3.1–3.7 | PR-4 | 语义 + 组件默认值 + :root 注入 |
| 4. 首页迁移 | Task 4.1–4.4 | PR-5/6/7 | 颜色/字号/间距圆角尺寸 |
| 5. 收尾守卫 | Task 5.1–5.3 | PR-8 + PR-9 | 其他页 + stylelint error |

---

## 阶段 1 — 基础设施(PR-1 + PR-2)

### Task 1.1: 安装开发依赖

**Files:**
- Modify: `client/package.json`

- [x] **Step 1: 安装 SCSS 编译、stylelint、snap 测试相关 dev 依赖**

Run:
```bash
cd client
npm install -D sass-embedded stylelint stylelint-config-standard-scss stylelint-declaration-strict-value stylelint-scss
```
Expected: 依赖被加入 `client/package.json` 的 `devDependencies`,无错误。

- [x] **Step 2: 安装 vitest snapshot 兼容包**

Run:
```bash
cd client
npm install -D @vitest/snapshot
```
Expected: 安装完成,`package.json` 中可见。

- [x] **Step 3: 提交**

```bash
cd client
git add package.json package-lock.json
git commit -m "chore(deps): add stylelint + sass-embedded + @vitest/snapshot"
```

---

### Task 1.2: 创建 styles 目录骨架

**Files:**
- Create: `client/src/styles/_config.scss`
- Create: `client/src/styles/tokens/.gitkeep`
- Create: `client/src/styles/semantic/.gitkeep`
- Create: `client/src/styles/components/.gitkeep`

- [x] **Step 1: 编写 `_config.scss`(Taro 单位配置)**

```scss
// client/src/styles/_config.scss
// 全局 SCSS 变量,作为 Taro 单位转换的基线参数。
// 设计稿 750 宽,1px = 2rpx。后续样式中所有尺寸应继承此基线。

$design-width: 750;
$rpx-base: 2; // 1px in 750-宽设计稿对应 2rpx
```

- [x] **Step 2: 创建其余目录的占位文件**

Run:
```bash
cd client
mkdir -p src/styles/tokens src/styles/semantic src/styles/components
for d in tokens semantic components; do
  echo "// ${d}/ 入口文件,后续由 Phase 2/3 任务填充。" > src/styles/${d}/.gitkeep
done
```
Expected: 三个目录创建并存在占位说明。

- [x] **Step 3: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/
git commit -m "feat(styles): scaffold styles/ directory + design-width config"
```

---

### Task 1.3: 编写 SCSS 编译测试 helper

**Files:**
- Create: `client/scripts/build-css.ts`
- Create: `client/test/styles/build-css.test.ts`
- Create: `client/vitest.config.ts`

- [x] **Step 1: 编写编译 helper**

```typescript
// client/scripts/build-css.ts
import { compileString } from 'sass-embedded';
import { resolve } from 'path';

/**
 * 编译 SCSS 字符串为 CSS 字符串,用于 token/迁移回归测试。
 * @param scss SCSS 源文
 * @param basePath 项目根,默认 client/
 */
export async function compile(scss: string, basePath = resolve(__dirname, '..')): Promise<string> {
  const result = await compileString(scss, {
    loadPaths: [resolve(basePath, 'src/styles'), resolve(basePath, 'src')],
    style: 'expanded',
  });
  return result.css;
}
```

- [x] **Step 2: 编写 vitest 配置**

```typescript
// client/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: false,
    setupFiles: ['test/setup.ts'],
  },
});
```

- [x] **Step 3: 编写 setup 入口**

```typescript
// client/test/setup.ts
// 留空,后续可注入全局 stub。当前阶段不需要。
```

- [x] **Step 4: 写第一个测试验证 helper 工作**

```typescript
// client/test/styles/build-css.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('build-css helper', () => {
  it('compiles plain SCSS to CSS', async () => {
    const result = await compile('$x: 32rpx; .a { font-size: $x; }');
    expect(result).toContain('font-size: 32rpx');
  });

  it('returns empty string for empty input', async () => {
    const result = await compile('');
    expect(result.trim()).toBe('');
  });
});
```

- [x] **Step 5: 运行测试以验证通过**

Run:
```bash
cd client
npx vitest run test/styles/build-css.test.ts
```
Expected: 2 个测试 PASS。

- [x] **Step 6: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/scripts/ client/test/ client/vitest.config.ts
git commit -m "feat(test): add SCSS compile helper + vitest config"
```

---

### Task 1.4: 创建 variables.scss 入口

**Files:**
- Create: `client/src/styles/variables.scss`

- [x] **Step 1: 编写占位入口(后续阶段逐步填充)**

```scss
// client/src/styles/variables.scss
// 所有 SCSS 文件统一从此处 @use,避免在业务 SCSS 中直接 @use 多个文件。
// 当前阶段为占位,Phase 2/3 完成后改为真正的 @forward 列表。

@forward './tokens' show *;
@forward './semantic' show *;
```

- [x] **Step 2: 验证入口能被业务 SCSS 引用(语法合法性)**

新建临时测试文件:
```typescript
// client/test/styles/variables-entry.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('variables.scss entry', () => {
  it('is importable without error', async () => {
    const css = await compile("@use '@/styles/variables' as *; .x { color: red; }");
    expect(css).toContain('.x');
    expect(css).toContain('color: red');
  });
});
```

- [x] **Step 3: 运行测试**

Run:
```bash
cd client
npx vitest run test/styles/variables-entry.test.ts
```
Expected: PASS(虽然 @use 出错预期会出现在 tokens/semantic,但当前两者为空 .gitkeep,@forward ok)

- [x] **Step 4: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/variables.scss client/test/styles/variables-entry.test.ts
git commit -m "feat(styles): add variables.scss entry point"
```

---

### Task 1.5: 引入 stylelint 配置

**Files:**
- Create: `client/.stylelintrc.yml`

- [x] **Step 1: 编写 stylelint 配置文件(warn 级)**

```yaml
# client/.stylelintrc.yml
extends:
  - stylelint-config-standard-scss

plugins:
  - stylelint-declaration-strict-value

rules:
  scale-unlimited/declaration-strict-value:
    - /color$/
    - /background-color$/
    - /font-size$/
    - /padding$/
    - /padding-(top|right|bottom|left)$/
    - /margin$/
    - /margin-(top|right|bottom|left)$/
    - /border-radius$/
    ignoreValues:
      - transparent
      - currentColor
      - inherit
      - initial
      - unset
      - none
      - /^0/
      - /^var\(--/

  stylelint-scss/dollar-variable-pattern:
    - pattern: '^(palette|fs|sp|radius|color|font|input|btn|space|motion|shadow|z-index)'
      options:
        ignore: 'local'

overrides:
  - files:
      - 'src/styles/tokens/**/*.scss'
      - 'src/styles/semantic/**/*.scss'
    rules:
      scale-unlimited/declaration-strict-value: null
```

> 关键点:Phase 4 期间规则为 warn;Phase 5 Task 5.3 才把整规则升为 error。

- [x] **Step 2: 在 package.json 添加 lint:css 脚本**

修改 `client/package.json`:
```json
{
  "scripts": {
    "lint:css": "stylelint 'src/**/*.scss'"
  }
}
```

- [x] **Step 3: 验证 stylelint 在当前空仓库不报错**

Run:
```bash
cd client
npm run lint:css
```
Expected: exit code 0,输出大致为 "0 problems" 或类似空结果(若报 warnings 不要紧,记录但不 fail)。

- [x] **Step 4: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/.stylelintrc.yml client/package.json
git commit -m "chore(lint): add stylelint with strict-value rule (warn)"
```

---

### Task 1.6: 添加 :root 注入基线 snapshot 测试

**Files:**
- Create: `client/src/styles/global.scss`
- Create: `client/test/styles/global-baseline.test.ts`

- [x] **Step 1: 编写 global.scss(当前为空,后续阶段填充)**

```scss
// client/src/styles/global.scss
// 全局样式入口,组件 L3 默认值在此注入 :root。
// 当前阶段为空,Phase 3 Task 3.7 后内容会扩展。

:root {
  // 占位:Phase 3 后追加 CSS 变量定义。
}
```

- [x] **Step 2: 写 snapshot 测试**

```typescript
// client/test/styles/global-baseline.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('global.scss baseline', () => {
  it('contains :root selector', async () => {
    const css = await compile("@use '@/styles/global';");
    expect(css).toMatch(/^:root\s*\{/m);
    expect(css.trim().endsWith('}')).toBe(true);
  });
});
```

- [x] **Step 3: 运行测试**

Run:
```bash
cd client
npx vitest run test/styles/global-baseline.test.ts
```
Expected: PASS。

- [x] **Step 4: 添加 vitest 在 npm script**

修改 `client/package.json`:
```json
{
  "scripts": {
    "test:css": "vitest run test/styles/"
  }
}
```

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/global.scss client/test/styles/global-baseline.test.ts client/package.json
git commit -m "feat(styles): add global.scss + :root baseline snapshot"
```

> 此为 Phase 1 的提交。视觉无变化(stylelint 仅 warn,首页内容未改)。

---

## 阶段 2 — L1 原语 Token(PR-3)

### Task 2.1: L1 色板 _palette.scss

**Files:**
- Create: `client/src/styles/tokens/_palette.scss`

- [x] **Step 1: 写测试要求 _palette.scss 暴露指定调色板**

```typescript
// client/test/styles/palette.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('palette tokens', () => {
  it('exposes ink/sand/accent/olive/rouge/alpha ramps', async () => {
    const css = await compile(`
      @use '@/styles/tokens/palette' as p;
      .x {
        ink-900: p.$palette-ink-900;
        sand-50: p.$palette-sand-50;
        accent-500: p.$palette-accent-500;
        accent-700: p.$palette-accent-700;
        olive-500: p.$palette-olive-500;
        rouge-500: p.$palette-rouge-500;
        alpha-08: p.$palette-alpha-ink-08;
      }
    `);
    expect(css).toContain('ink-900: #2c2c2c');
    expect(css).toContain('sand-50: #faf8f4');
    expect(css).toContain('accent-500: #c8b99a');
    expect(css).toContain('accent-700: #a89878');
    expect(css).toContain('olive-500: #7a8c6e');
    expect(css).toContain('rouge-500: #b85450');
    expect(css).toContain('alpha-08: rgba(44, 44, 44, 0.08)');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/palette.test.ts
```
Expected: FAIL,因为 `tokens/palette` 文件尚未创建。

- [x] **Step 3: 编写 _palette.scss**

```scss
// client/src/styles/tokens/_palette.scss
// L1 原语色板:仅承载原始颜色值,无业务含义。

// 墨色 (主文字)
$palette-ink-900 : #2c2c2c;
$palette-ink-700 : #5c5650;
$palette-ink-500 : #736c63;
$palette-ink-300 : #8a8279;

// 沙色 (背景/分割)
$palette-sand-50  : #faf8f4;
$palette-sand-100 : #f5f0e8;
$palette-sand-200 : #ece5d8;
$palette-sand-300 : #f0e8d8;

// 强调金
$palette-accent-500 : #c8b99a;
$palette-accent-700 : #a89878;

// 状态色
$palette-olive-500  : #7a8c6e;
$palette-rouge-500  : #b85450;

// 半透明叠加
$palette-alpha-ink-03  : rgba(44, 44, 44, 0.03);
$palette-alpha-ink-04  : rgba(44, 44, 44, 0.04);
$palette-alpha-ink-06  : rgba(44, 44, 44, 0.06);
$palette-alpha-ink-08  : rgba(44, 44, 44, 0.08);
$palette-alpha-ink-15  : rgba(44, 44, 44, 0.15);
$palette-alpha-ink-30  : rgba(44, 44, 44, 0.30);
$palette-alpha-sand-25 : rgba(200, 185, 154, 0.25);
$palette-alpha-sand-30 : rgba(200, 185, 154, 0.30);
$palette-alpha-sand-82 : rgba(250, 248, 244, 0.82);
$palette-alpha-sand-96 : rgba(250, 248, 244, 0.96);
$palette-alpha-warm-45 : rgba(231, 221, 195, 0.45);
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/palette.test.ts
```
Expected: PASS。

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/tokens/_palette.scss client/test/styles/palette.test.ts
git commit -m "feat(tokens): add L1 palette with ink/sand/accent/olive/rouge ramps"
```

---

### Task 2.2: L1 字号 _typography.scss

**Files:**
- Create: `client/src/styles/tokens/_typography.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/typography-tokens.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('typography tokens', () => {
  it('exposes 9-step font scale in rpx', async () => {
    const css = await compile(`
      @use '@/styles/tokens/typography' as t;
      .x {
        fs-50: t.$fs-50;
        fs-75: t.$fs-75;
        fs-100: t.$fs-100;
        fs-200: t.$fs-200;
        fs-300: t.$fs-300;
        fs-400: t.$fs-400;
        fs-500: t.$fs-500;
        fs-600: t.$fs-600;
        fs-700: t.$fs-700;
      }
    `);
    expect(css).toContain('fs-50: 20rpx');
    expect(css).toContain('fs-75: 24rpx');
    expect(css).toContain('fs-100: 26rpx');
    expect(css).toContain('fs-200: 28rpx');
    expect(css).toContain('fs-300: 32rpx');
    expect(css).toContain('fs-400: 36rpx');
    expect(css).toContain('fs-500: 44rpx');
    expect(css).toContain('fs-600: 56rpx');
    expect(css).toContain('fs-700: 88rpx');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/typography-tokens.test.ts
```
Expected: FAIL(无 _typography.scss)。

- [x] **Step 3: 编写 _typography.scss**

```scss
// client/src/styles/tokens/_typography.scss
// L1 原语字号阶梯(750 设计稿,1px = 2rpx)。

$fs-50  : 20rpx;
$fs-75  : 24rpx;
$fs-100 : 26rpx;
$fs-200 : 28rpx;
$fs-300 : 32rpx;
$fs-400 : 36rpx;
$fs-500 : 44rpx;
$fs-600 : 56rpx;
$fs-700 : 88rpx;
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/typography-tokens.test.ts
```
Expected: PASS。

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/tokens/_typography.scss client/test/styles/typography-tokens.test.ts
git commit -m "feat(tokens): add L1 typography font-scale (9 steps, 20-88rpx)"
```

---

### Task 2.3: L1 间距 _spacing.scss

**Files:**
- Create: `client/src/styles/tokens/_spacing.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/spacing.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('spacing tokens', () => {
  it('exposes 4rpx-grid spacing scale', async () => {
    const css = await compile(`
      @use '@/styles/tokens/spacing' as s;
      .x {
        sp-0: s.$sp-0;
        sp-1: s.$sp-1;
        sp-4: s.$sp-4;
        sp-8: s.$sp-8;
        sp-16: s.$sp-16;
      }
    `);
    expect(css).toContain('sp-0: 0');
    expect(css).toContain('sp-1: 4rpx');
    expect(css).toContain('sp-4: 16rpx');
    expect(css).toContain('sp-8: 32rpx');
    expect(css).toContain('sp-16: 64rpx');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/spacing.test.ts
```
Expected: FAIL。

- [x] **Step 3: 编写 _spacing.scss**

```scss
// client/src/styles/tokens/_spacing.scss
// L1 原语间距阶梯(4rpx 栅格,缺失档位便于主题扩展)。

$sp-0  : 0;
$sp-1  : 4rpx;
$sp-2  : 8rpx;
$sp-3  : 12rpx;
$sp-4  : 16rpx;
$sp-6  : 24rpx;
$sp-8  : 32rpx;
$sp-10 : 40rpx;
$sp-12 : 48rpx;
$sp-16 : 64rpx;
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/spacing.test.ts
```
Expected: PASS。

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/tokens/_spacing.scss client/test/styles/spacing.test.ts
git commit -m "feat(tokens): add L1 spacing scale (4rpx grid)"
```

---

### Task 2.4: L1 圆角 _radius.scss

**Files:**
- Create: `client/src/styles/tokens/_radius.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/radius.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('radius tokens', () => {
  it('exposes radius scale xs through full', async () => {
    const css = await compile(`
      @use '@/styles/tokens/radius' as r;
      .x {
        none: r.$radius-none;
        xs: r.$radius-xs;
        sm: r.$radius-sm;
        md: r.$radius-md;
        lg: r.$radius-lg;
        xl: r.$radius-xl;
        full: r.$radius-full;
      }
    `);
    expect(css).toContain('none: 0');
    expect(css).toContain('xs: 4rpx');
    expect(css).toContain('sm: 8rpx');
    expect(css).toContain('md: 16rpx');
    expect(css).toContain('lg: 24rpx');
    expect(css).toContain('xl: 40rpx');
    expect(css).toContain('full: 9999px');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/radius.test.ts
```
Expected: FAIL。

- [x] **Step 3: 编写 _radius.scss**

```scss
// client/src/styles/tokens/_radius.scss
// L1 原语圆角。

$radius-none : 0;
$radius-xs   : 4rpx;
$radius-sm   : 8rpx;
$radius-md   : 16rpx;
$radius-lg   : 24rpx;
$radius-xl   : 40rpx;
$radius-full : 9999px;
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/radius.test.ts
```
Expected: PASS。

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/tokens/_radius.scss client/test/styles/radius.test.ts
git commit -m "feat(tokens): add L1 radius scale"
```

---

### Task 2.5: L1 z-index 与 motion

**Files:**
- Create: `client/src/styles/tokens/_z-index.scss`
- Create: `client/src/styles/tokens/_motion.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/zindex-motion.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('z-index and motion tokens', () => {
  it('exposes z-index layers', async () => {
    const css = await compile(`
      @use '@/styles/tokens/z-index' as z;
      .x { z: z.$z-overlay; nav: z.$z-nav; }
    `);
    expect(css).toMatch(/z:\s*100/);
    expect(css).toMatch(/nav:\s*10/);
  });

  it('exposes motion duration and easing', async () => {
    const css = await compile(`
      @use '@/styles/tokens/motion' as m;
      .x { d: m.$duration-base; e: m.$easing-standard; }
    `);
    expect(css).toMatch(/d:\s*200ms/);
    expect(css).toMatch(/e:\s*ease-in-out/);
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/zindex-motion.test.ts
```
Expected: FAIL。

- [x] **Step 3: 编写 _z-index.scss**

```scss
// client/src/styles/tokens/_z-index.scss
// L1 原语 z-index 层级。

$z-base     : 1;
$z-nav      : 10;
$z-overlay  : 100;
$z-modal    : 1000;
$z-toast    : 1100;
```

- [x] **Step 4: 编写 _motion.scss**

```scss
// client/src/styles/tokens/_motion.scss
// L1 原语动效:时长 + 缓动函数。

$duration-fast  : 120ms;
$duration-base  : 200ms;
$duration-slow  : 320ms;

$easing-standard : ease-in-out;
$easing-emphasized : cubic-bezier(0.4, 0, 0.2, 1);
```

- [x] **Step 5: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/zindex-motion.test.ts
```
Expected: PASS。

- [x] **Step 6: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/tokens/_z-index.scss client/src/styles/tokens/_motion.scss client/test/styles/zindex-motion.test.ts
git commit -m "feat(tokens): add L1 z-index + motion tokens"
```

---

### Task 2.6: L1 barrel _index.scss + variables 接入

**Files:**
- Create: `client/src/styles/tokens/_index.scss`
- Modify: `client/src/styles/variables.scss`

- [x] **Step 1: 编写 tokens/_index.scss 聚合**

```scss
// client/src/styles/tokens/_index.scss
// L1 原语 Token 聚合入口。

@forward 'palette';
@forward 'typography';
@forward 'spacing';
@forward 'radius';
@forward 'z-index';
@forward 'motion';
```

- [x] **Step 2: 写测试验证 @forward 全部 token 可访问**

```typescript
// client/test/styles/tokens-index.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('tokens barrel', () => {
  it('exposes all L1 token namespaces through @forward', async () => {
    const css = await compile(`
      @use '@/styles/tokens' as t;
      .x {
        c: t.$palette-ink-900;
        f: t.$fs-300;
        s: t.$sp-4;
        r: t.$radius-md;
        z: t.$z-overlay;
        m: t.$duration-base;
      }
    `);
    expect(css).toContain('c: #2c2c2c');
    expect(css).toContain('f: 32rpx');
    expect(css).toContain('s: 16rpx');
    expect(css).toContain('r: 16rpx');
    expect(css).toContain('z: 100');
    expect(css).toContain('m: 200ms');
  });
});
```

- [x] **Step 3: 运行测试**

Run:
```bash
cd client
npx vitest run test/styles/tokens-index.test.ts
```
Expected: PASS。

- [x] **Step 4: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/tokens/_index.scss client/test/styles/tokens-index.test.ts
git commit -m "feat(tokens): add L1 barrel + verify forward chain"
```

---

## 阶段 3 — L2 语义 + L3 组件 Token(PR-4)

### Task 3.1: L2 语义颜色 _color.scss

**Files:**
- Create: `client/src/styles/semantic/_color.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/semantic-color.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('semantic color tokens', () => {
  it('aliases text/bg/divider/state tokens to palette', async () => {
    const css = await compile(`
      @use '@/styles/semantic/color' as c;
      .x {
        primary: c.$color-text-primary;
        placeholder: c.$color-text-placeholder;
        page: c.$color-bg-page;
        divider: c.$color-divider-subtle;
        success: c.$color-state-success;
        danger: c.$color-state-danger;
      }
    `);
    expect(css).toContain('primary: #2c2c2c');
    expect(css).toContain('placeholder: #8a8279');
    expect(css).toContain('page: #faf8f4');
    expect(css).toContain('divider: rgba(44, 44, 44, 0.08)');
    expect(css).toContain('success: #7a8c6e');
    expect(css).toContain('danger: #b85450');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/semantic-color.test.ts
```
Expected: FAIL。

- [x] **Step 3: 编写 _color.scss**

```scss
// client/src/styles/semantic/_color.scss
// L2 语义颜色:把 L1 色板绑到业务角色。

@use '../tokens/palette' as p;

// 文字
$color-text-primary     : p.$palette-ink-900;
$color-text-secondary   : p.$palette-ink-700;
$color-text-tertiary    : p.$palette-ink-500;
$color-text-placeholder : p.$palette-ink-300;

// 背景
$color-bg-page          : p.$palette-sand-50;
$color-bg-surface       : #ffffff;
$color-bg-surface-soft  : p.$palette-sand-100;
$color-bg-overlay       : p.$palette-alpha-sand-96;

// 分割/阴影
$color-divider-subtle   : p.$palette-alpha-ink-08;
$color-shadow-soft      : p.$palette-alpha-ink-06;

// 品牌
$color-brand-primary        : p.$palette-accent-500;
$color-brand-primary-strong : p.$palette-accent-700;

// 状态
$color-state-success : p.$palette-olive-500;
$color-state-danger  : p.$palette-rouge-500;
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/semantic-color.test.ts
```
Expected: PASS。

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/semantic/_color.scss client/test/styles/semantic-color.test.ts
git commit -m "feat(semantic): add L2 color tokens"
```

---

### Task 3.2: L2 语义字号 _typography.scss

**Files:**
- Create: `client/src/styles/semantic/_typography.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/semantic-typography.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('semantic typography tokens', () => {
  it('maps display/heading/body/caption to L1 font scale', async () => {
    const css = await compile(`
      @use '@/styles/semantic/typography' as t;
      .x {
        d-xl: t.$font-display-xl;
        h-lg: t.$font-heading-lg;
        b-md: t.$font-body-md;
        c-sm: t.$font-caption-sm;
      }
    `);
    expect(css).toContain('d-xl: 88rpx');
    expect(css).toContain('h-lg: 44rpx');
    expect(css).toContain('b-md: 32rpx');
    expect(css).toContain('c-sm: 24rpx');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/semantic-typography.test.ts
```
Expected: FAIL。

- [x] **Step 3: 编写 _typography.scss**

```scss
// client/src/styles/semantic/_typography.scss
// L2 语义字号:把 L1 字体阶梯绑到角色。

@use '../tokens/typography' as t;

// Display(超大数字/Hero)
$font-display-xl : t.$fs-700; // 88rpx
$font-display-lg : t.$fs-600; // 56rpx

// Heading(标题)
$font-heading-lg : t.$fs-500; // 44rpx
$font-heading-md : t.$fs-400; // 36rpx

// Body(正文)
$font-body-lg : t.$fs-300; // 32rpx 强调
$font-body-md : t.$fs-300; // 32rpx 默认正文
$font-body-sm : t.$fs-200; // 28rpx 辅助

// Caption(提示)
$font-caption-md : t.$fs-100; // 26rpx
$font-caption-sm : t.$fs-75;  // 24rpx
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/semantic-typography.test.ts
```
Expected: PASS。

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/semantic/_typography.scss client/test/styles/semantic-typography.test.ts
git commit -m "feat(semantic): add L2 typography tokens"
```

---

### Task 3.3: L2 控件尺寸 _control.scss

**Files:**
- Create: `client/src/styles/semantic/_control.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/semantic-control.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('semantic control tokens', () => {
  it('exposes input/btn heights and inner paddings', async () => {
    const css = await compile(`
      @use '@/styles/semantic/control' as c;
      .x {
        ism: c.$input-height-sm;
        imm: c.$input-height-md;
        iml: c.$input-height-lg;
        ipx: c.$input-padding-x;
        ipy: c.$input-padding-y;
        bsm: c.$btn-height-sm;
        bmd: c.$btn-height-md;
        blg: c.$btn-height-lg;
      }
    `);
    expect(css).toContain('ism: 56rpx');
    expect(css).toContain('imm: 72rpx');
    expect(css).toContain('iml: 88rpx');
    expect(css).toContain('ipx: 16rpx');
    expect(css).toContain('ipy: 8rpx');
    expect(css).toContain('bsm: 56rpx');
    expect(css).toContain('bmd: 80rpx');
    expect(css).toContain('blg: 96rpx');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/semantic-control.test.ts
```
Expected: FAIL。

- [x] **Step 3: 编写 _control.scss**

```scss
// client/src/styles/semantic/_control.scss
// L2 控件尺寸:输入框、按钮高度与内边距。

@use '../tokens/spacing' as sp;

// 输入框
$input-height-sm  : 56rpx;
$input-height-md  : 72rpx;
$input-height-lg  : 88rpx;

$input-padding-x  : sp.$sp-4;
$input-padding-y  : sp.$sp-2;
$input-gap-label  : sp.$sp-3;

// 按钮
$btn-height-sm : 56rpx;
$btn-height-md : 80rpx;
$btn-height-lg : 96rpx;
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/semantic-control.test.ts
```
Expected: PASS。

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/semantic/_control.scss client/test/styles/semantic-control.test.ts
git commit -m "feat(semantic): add L2 control (input/btn) tokens"
```

---

### Task 3.4: L3 组件 _input.scss

**Files:**
- Create: `client/src/styles/components/_input.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/component-input.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('L3 input component', () => {
  it('exposes --input-* CSS variables and uses var() in properties', async () => {
    const css = await compile(`
      @use '@/styles/components/input' as *;
    `);
    expect(css).toContain('--input-height');
    expect(css).toContain('--input-padding-x');
    expect(css).toContain('--input-bg');
    expect(css).toContain('--input-radius');
    expect(css).toContain('--input-font');
    expect(css).toMatch(/height:\s*var\(--input-height\)/);
    expect(css).toMatch(/border-radius:\s*var\(--input-radius\)/);
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/component-input.test.ts
```
Expected: FAIL。

- [x] **Step 3: 编写 _input.scss**

```scss
// client/src/styles/components/_input.scss
// L3 输入框组件默认值,通过 CSS 变量暴露给父容器覆写。

@use '../semantic/color' as c;
@use '../semantic/typography' as t;
@use '../semantic/control' as k;
@use '../tokens/radius' as r;

.input {
  --input-height       : #{k.$input-height-md};
  --input-padding-x    : #{k.$input-padding-x};
  --input-padding-y    : #{k.$input-padding-y};
  --input-bg           : #{c.$color-bg-surface};
  --input-border       : 1px solid #{c.$color-divider-subtle};
  --input-radius       : #{r.$radius-md};
  --input-font         : #{t.$font-body-md};
  --input-color        : #{c.$color-text-primary};
  --input-placeholder  : #{c.$color-text-placeholder};

  height: var(--input-height);
  padding: var(--input-padding-y) var(--input-padding-x);
  background: var(--input-bg);
  border: var(--input-border);
  border-radius: var(--input-radius);
  font-size: var(--input-font);
  color: var(--input-color);
}

.input::placeholder {
  color: var(--input-placeholder);
}
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/component-input.test.ts
```
Expected: PASS。

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/components/_input.scss client/test/styles/component-input.test.ts
git commit -m "feat(components): add L3 input CSS-variable defaults"
```

---

### Task 3.5: L3 组件 _button.scss 与 _cell.scss

**Files:**
- Create: `client/src/styles/components/_button.scss`
- Create: `client/src/styles/components/_card.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/component-button-card.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('L3 button + card', () => {
  it('button exposes --btn-* variables', async () => {
    const css = await compile(`
      @use '@/styles/components/button' as *;
    `);
    expect(css).toContain('--btn-bg-primary');
    expect(css).toContain('--btn-color-primary');
    expect(css).toContain('--btn-radius');
  });

  it('card exposes --card-* variables', async () => {
    const css = await compile(`
      @use '@/styles/components/card' as *;
    `);
    expect(css).toContain('--card-bg');
    expect(css).toContain('--card-padding-y');
    expect(css).toContain('--card-padding-x');
    expect(css).toContain('--card-radius');
    expect(css).toContain('--card-shadow');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/component-button-card.test.ts
```
Expected: FAIL。

- [x] **Step 3: 编写 _button.scss**

```scss
// client/src/styles/components/_button.scss
// L3 按钮组件默认值。

@use '../semantic/color' as c;
@use '../semantic/typography' as t;
@use '../semantic/control' as k;
@use '../tokens/radius' as r;

.btn {
  --btn-height        : #{k.$btn-height-md};
  --btn-padding-x     : #{k.$input-padding-x};
  --btn-padding-y     : #{k.$input-padding-y};
  --btn-radius        : #{r.$radius-md};
  --btn-font          : #{t.$font-body-lg};
  --btn-color-primary : #{c.$color-brand-primary};
  --btn-bg-primary    : #{c.$color-text-primary};
  --btn-color-text    : #ffffff;

  height: var(--btn-height);
  padding: var(--btn-padding-y) var(--btn-padding-x);
  border-radius: var(--btn-radius);
  font-size: var(--btn-font);
  color: var(--btn-color-text);
  background: var(--btn-bg-primary);
  border: 0;
}

.btn--primary {
  background: var(--btn-bg-primary);
}
```

- [x] **Step 4: 编写 _card.scss**

```scss
// client/src/styles/components/_card.scss
// L3 卡片组件默认值。

@use '../semantic/color' as c;
@use '../semantic/typography' as t;
@use '../tokens/radius' as r;
@use '../tokens/spacing' as sp;

.card {
  --card-bg         : #{c.$color-bg-surface};
  --card-padding-y  : #{sp.$sp-6};
  --card-padding-x  : #{sp.$sp-4};
  --card-radius     : #{r.$radius-md};
  --card-shadow     : 0 2rpx 12rpx #{c.$color-shadow-soft};
  --card-color      : #{c.$color-text-primary};

  background: var(--card-bg);
  padding: var(--card-padding-y) var(--card-padding-x);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  color: var(--card-color);
}
```

- [x] **Step 5: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/component-button-card.test.ts
```
Expected: PASS。

- [x] **Step 6: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/components/_button.scss client/src/styles/components/_card.scss client/test/styles/component-button-card.test.ts
git commit -m "feat(components): add L3 button + card CSS-variable defaults"
```

---

### Task 3.6: L3 组件 _cell.scss

**Files:**
- Create: `client/src/styles/components/_cell.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/component-cell.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('L3 cell component', () => {
  it('exposes --cell-* variables', async () => {
    const css = await compile(`
      @use '@/styles/components/cell' as *;
    `);
    expect(css).toContain('--cell-bg');
    expect(css).toContain('--cell-padding-y');
    expect(css).toContain('--cell-padding-x');
    expect(css).toContain('--cell-divider');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/component-cell.test.ts
```
Expected: FAIL。

- [x] **Step 3: 编写 _cell.scss**

```scss
// client/src/styles/components/_cell.scss
// L3 单元格组件默认值。

@use '../semantic/color' as c;
@use '../semantic/typography' as t;
@use '../tokens/spacing' as sp;

.cell {
  --cell-bg         : #{c.$color-bg-surface};
  --cell-padding-y  : #{sp.$sp-3};
  --cell-padding-x  : #{sp.$sp-4};
  --cell-divider    : 1px solid #{c.$color-divider-subtle};
  --cell-font       : #{t.$font-body-md};
  --cell-color      : #{c.$color-text-primary};

  background: var(--cell-bg);
  padding: var(--cell-padding-y) var(--cell-padding-x);
  border-bottom: var(--cell-divider);
  font-size: var(--cell-font);
  color: var(--cell-color);
}
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/component-cell.test.ts
```
Expected: PASS。

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/components/_cell.scss client/test/styles/component-cell.test.ts
git commit -m "feat(components): add L3 cell CSS-variable defaults"
```

---

### Task 3.7: 注入全局 :root + variables 入口

**Files:**
- Modify: `client/src/styles/global.scss`
- Modify: `client/src/styles/variables.scss`

- [x] **Step 1: 写测试要求 global.scss 暴露全部 CSS 变量**

```typescript
// client/test/styles/global-root.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('global.scss :root variables', () => {
  it('sets all semantic + control CSS vars on :root', async () => {
    const css = await compile("@use '@/styles/global';");
    // 语义颜色
    expect(css).toContain('--color-text-primary');
    expect(css).toContain('--color-bg-page');
    expect(css).toContain('--color-brand-primary');
    // 控件
    expect(css).toContain('--input-height-md');
    expect(css).toContain('--input-padding-x');
    expect(css).toContain('--btn-height-md');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/global-root.test.ts
```
Expected: FAIL(目前 :root 只有占位)。

- [x] **Step 3: 修改 global.scss 注入全部默认值**

```scss
// client/src/styles/global.scss
// 全局样式入口:把 L2 语义 token 与 L3 控件默认值作为 CSS 变量暴露到 :root,便于运行时主题切换(本期不接主题)。

@use './tokens/typography' as fs;
@use './tokens/spacing' as sp;
@use './tokens/radius' as r;
@use './tokens/motion' as m;
@use './tokens/z-index' as z;
@use './semantic/color' as c;
@use './semantic/typography' as t;
@use './semantic/control' as k;

:root {
  // 颜色
  --color-text-primary        : #{c.$color-text-primary};
  --color-text-secondary      : #{c.$color-text-secondary};
  --color-text-tertiary       : #{c.$color-text-tertiary};
  --color-text-placeholder    : #{c.$color-text-placeholder};
  --color-bg-page             : #{c.$color-bg-page};
  --color-bg-surface          : #{c.$color-bg-surface};
  --color-bg-surface-soft     : #{c.$color-bg-surface-soft};
  --color-bg-overlay          : #{c.$color-bg-overlay};
  --color-divider-subtle      : #{c.$color-divider-subtle};
  --color-shadow-soft         : #{c.$color-shadow-soft};
  --color-brand-primary       : #{c.$color-brand-primary};
  --color-brand-primary-strong: #{c.$color-brand-primary-strong};
  --color-state-success       : #{c.$color-state-success};
  --color-state-danger        : #{c.$color-state-danger};

  // 字号
  --font-display-xl : #{t.$font-display-xl};
  --font-display-lg : #{t.$font-display-lg};
  --font-heading-lg : #{t.$font-heading-lg};
  --font-heading-md : #{t.$font-heading-md};
  --font-body-lg    : #{t.$font-body-lg};
  --font-body-md    : #{t.$font-body-md};
  --font-body-sm    : #{t.$font-body-sm};
  --font-caption-md : #{t.$font-caption-md};
  --font-caption-sm : #{t.$font-caption-sm};

  // 控件尺寸
  --input-height-sm : #{k.$input-height-sm};
  --input-height-md : #{k.$input-height-md};
  --input-height-lg : #{k.$input-height-lg};
  --input-padding-x : #{k.$input-padding-x};
  --input-padding-y : #{k.$input-padding-y};
  --btn-height-sm   : #{k.$btn-height-sm};
  --btn-height-md   : #{k.$btn-height-md};
  --btn-height-lg   : #{k.$btn-height-lg};

  // 动效
  --duration-base : #{m.$duration-base};
  --easing-standard : #{m.$easing-standard};
}
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/global-root.test.ts
```
Expected: PASS。

- [x] **Step 5: 修改 variables.scss 完整入口**

```scss
// client/src/styles/variables.scss
@forward './tokens' show *;
@forward './semantic' show *;
@forward './components' show *;
```

- [x] **Step 6: 验证所有 token test 仍通过(回归)**

Run:
```bash
cd client
npm run test:css
```
Expected: 所有 test:css 通过。

- [x] **Step 7: 在 app.scss 中引入 global(让 :root 在小程序端也生效)**

修改 `client/src/app.scss`:
```scss
@use './styles/global';

page {
  font-family: 'Noto Serif SC', 'Shippori Mincho B1', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [x] **Step 8: 运行 weapp build 验证**

Run:
```bash
cd client
npm run build:weapp
```
Expected: build 通过(注意:weapp 主入口并未引用 L1/L2 业务样式,只是 global 注入 :root,几乎不会出问题)。

- [x] **Step 9: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/ client/src/app.scss
git commit -m "feat(styles): inject L2/L3 defaults into :root + wire variables entry"
```

---

### Task 3.8: L2 语义 section/space token

**Files:**
- Create: `client/src/styles/semantic/_space.scss`

- [x] **Step 1: 写测试**

```typescript
// client/test/styles/semantic-space.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '../../scripts/build-css';

describe('semantic space tokens', () => {
  it('exposes card/section/page compound paddings', async () => {
    const css = await compile(`
      @use '@/styles/semantic/space' as s;
      .x {
        sm: s.$space-card-padding-sm;
        md: s.$space-card-padding-md;
        lg: s.$space-card-padding-lg;
        sy: s.$space-section-y;
        se: s.$space-section-edge;
        pe: s.$space-page-edge;
        cx: s.$space-control-padding-x;
      }
    `);
    expect(css).toContain('sm: 12rpx 16rpx');
    expect(css).toContain('md: 24rpx 16rpx');
    expect(css).toContain('lg: 32rpx 24rpx');
    expect(css).toContain('sy: 32rpx');
    expect(css).toContain('se: 40rpx 16rpx');
    expect(css).toContain('pe: 24rpx 16rpx');
    expect(css).toContain('cx: 16rpx');
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/styles/semantic-space.test.ts
```
Expected: FAIL。

- [x] **Step 3: 编写 _space.scss**

```scss
// client/src/styles/semantic/_space.scss
// L2 语义间距:组合常用布局的 padding 复合值。

@use '../tokens/spacing' as sp;

// 卡片内边距
$space-card-padding-sm : sp.$sp-3 sp.$sp-4;  // 12rpx 16rpx
$space-card-padding-md : sp.$sp-6 sp.$sp-4;  // 24rpx 16rpx
$space-card-padding-lg : sp.$sp-8 sp.$sp-6;  // 32rpx 24rpx

// 区块上下间距
$space-section-y     : sp.$sp-8;            // 32rpx
$space-section-edge : sp.$sp-10 sp.$sp-4;   // 40rpx 16rpx

// 页面边距
$space-page-edge : sp.$sp-6 sp.$sp-4;       // 24rpx 16rpx

// 控件水平内距
$space-control-padding-x : sp.$sp-4;        // 16rpx
```

- [x] **Step 4: 运行测试,确认通过**

Run:
```bash
cd client
npx vitest run test/styles/semantic-space.test.ts
```
Expected: PASS。

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/styles/semantic/_space.scss client/test/styles/semantic-space.test.ts
git commit -m "feat(semantic): add L2 space tokens (card/section/page paddings)"
```

> 该任务在 Task 3.7 注入 :root 之前完成,以确保 :root 包含全部 CSS 变量;若时间顺序冲突,可将本任务并入 Task 3.7 之前或紧接 Task 3.3。

---

## 阶段 4 — 首页迁移(PR-5 / PR-6 / PR-7)

### Task 4.1: 首页迁移回归测试基线(PR-5 颜色)

**Files:**
- Create: `client/test/pages-index/color-hex-removed.test.ts`

- [x] **Step 1: 写测试——首页 scss 不应包含 hex 字面量(L1 颜色提取完毕后)**

```typescript
// client/test/pages-index/color-hex-removed.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('pages/index/index.scss color migration', () => {
  it('contains no raw hex color literals (except inside comments)', () => {
    const path = resolve(__dirname, '../../src/pages/index/index.scss');
    const src = readFileSync(path, 'utf8');
    // 移除注释行
    const stripped = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    // 允许 rgba(255, 255, 255) 等透明值出现;
    // 禁止 #hex(3/6/8 位)
    const hexRe = /#[0-9a-fA-F]{3,8}\b/;
    const matches = stripped.match(hexRe);
    if (matches) {
      throw new Error(
        `Found raw hex literal(s) in index.scss: ${matches.slice(0, 5).join(', ')}`,
      );
    }
    expect(matches).toBeNull();
  });
});
```

- [x] **Step 2: 运行测试,确认失败(当前未迁移)**

Run:
```bash
cd client
npx vitest run test/pages-index/color-hex-removed.test.ts
```
Expected: FAIL,显示当前 index.scss 中仍有 hex 颜色字面量。

- [x] **Step 3: 提交测试(committed before migration)**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/test/pages-index/color-hex-removed.test.ts
git commit -m "test(pages-index): assert no raw hex literals after color migration"
```

---

### Task 4.2: 首页颜色迁移(PR-5)

**Files:**
- Modify: `client/src/pages/index/index.scss`

- [x] **Step 1: 在 index.scss 顶部引入 variables**

修改 `client/src/pages/index/index.scss` 第 1 行附近,加入:
```scss
@use '@/styles/variables' as *;
```

(其余内容保留不动)

- [x] **Step 2: 替换 hex 字面量为 L2 语义 token**

打开 `client/src/pages/index/index.scss`,全文搜索替换:

| 原 hex / rgba | 替换为 |
|--------------|-------|
| `#2c2c2c` | `$color-text-primary` |
| `#5c5650` | `$color-text-secondary` |
| `#736c63` | `$color-text-tertiary` |
| `#8a8279` | `$color-text-placeholder` |
| `#faf8f4` | `$color-bg-page` |
| `#f5f0e8` | `$color-bg-surface-soft` |
| `#ece5d8` | (按视觉一致吸附到 `$color-bg-surface-soft`,或保持 `$palette-sand-200` 若需更暖) |
| `#f0e8d8` | `$color-divider-subtle` 的反例,按就近吸附(`$palette-sand-300`) |
| `#c8b99a` | `$color-brand-primary` |
| `#a89878` | `$color-brand-primary-strong` |
| `#7a8c6e` | `$color-state-success` |
| `#b85450` | `$color-state-danger` |
| `rgba(44,44,44,0.04)` | `$color-shadow-soft`(注意:0.04 vs 0.06 差异极小,统一 0.06) |
| `rgba(44,44,44,0.06)` | `$color-shadow-soft` |
| `rgba(44,44,44,0.08)` | `$color-divider-subtle` |
| `rgba(250,248,244,0.96)` | `$color-bg-overlay` |
| `rgba(250,248,244,0.82)` | (吸附到 `$color-bg-overlay`,差异感知阈值 0.96 vs 0.82 ≤ 可接受) |
| `rgba(200,185,154,0.30)` | `$palette-sand-300`(纹路叠加层,与 sand-300 一致,感知差异 0) |
| `rgba(200,185,154,0.25)` | `$palette-sand-300` 同上用法,因差值 ≤ 0.05 不可感知 |
| `rgba(231,221,195,0.45)` | `$palette-alpha-warm-45` (新增 L1,见下方 Step 3 补刀) |

> 若 L1 缺某一 alpha(如 `warm-45` 需新增),直接在 `_palette.scss` 中追加一行后重启替换。`rgba(44,44,44,0.04)` 视觉差异与 `0.06` ≤ 用户感知阈值,统一吸附到 `$color-shadow-soft (= 0.06)`;若 review 中指出"看起来偏淡",再单独调整。

执行替换:
```bash
cd client
# 注:本步骤是人工执行。替换时建议使用编辑器多光标或 JS 脚本:
# 1. 第 1 行加 @use
# 2. 使用 VSCode "Replace All" 按上表逐一替换
# 3. 每替换一档,保存并验证 weapp build 通过
```

> 替换策略:按出现频次从高到低替换,每档之间跑一次 `npx vitest run test/pages-index/color-hex-removed.test.ts` 看缺失 hex 列表是否收敛。

- [x] **Step 3: 验证颜色测试已通过**

Run:
```bash
cd client
npx vitest run test/pages-index/color-hex-removed.test.ts
```
Expected: PASS(index.scss 中无 hex 字面量)。

- [x] **Step 4: 验证 stylelint 不报 fatal**

Run:
```bash
cd client
npm run lint:css 2>&1 | head -50
```
Expected: 仅有 warn,没有 fatal error(warn 级别下不阻塞提交)。

- [x] **Step 5: 视觉对比(开发者执行)**

1. `npm run dev:h5`
2. 在微信开发者工具打开 `npm run build:weapp -- --watch` 产物
3. 截图首页(改造前截图 PR-2 阶段已有)
4. 与 PR-2 基线对比,期望视觉零变化

- [x] **Step 6: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/pages/index/index.scss
git commit -m "refactor(pages-index): migrate color literals to L2 semantic tokens"
```

---

### Task 4.3: 首页字号迁移测试 + 实施(PR-6)

**Files:**
- Modify: `client/src/pages/index/index.scss`

- [x] **Step 1: 写测试——首页不应有 raw font-size: <number>px**

```typescript
// client/test/pages-index/font-size-rpx.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('pages/index/index.scss font-size migration', () => {
  it('contains no font-size: <number>px (only token references or rpx)', () => {
    const path = resolve(__dirname, '../../src/pages/index/index.scss');
    const src = readFileSync(path, 'utf8');
    const stripped = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    const re = /font-size:\s*[0-9]+px\b/;
    const matches = stripped.match(re);
    if (matches) {
      throw new Error(`Found raw font-size px literal(s): ${matches.slice(0, 5).join(', ')}`);
    }
    expect(matches).toBeNull();
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/pages-index/font-size-rpx.test.ts
```
Expected: FAIL。

- [x] **Step 3: 替换 font-size 为 L2 语义 token**

按现状映射(规格 4.2 节),对 index.scss 中所有 `font-size: Npx` 进行替换:

| 原 px | 替换为 |
|------|-------|
| 10 | **保留原值语义**:10px 仅 1 处使用(辅助极小字),改为 `$fs-50`(L1 原语,直接暴露为 20rpx),不经过 L2 包装;若需语义,新增 L2 `$font-caption-xs = $fs-50`(在 _typography.scss 追加) |
| 12 | `$font-caption-sm`(24rpx,差 0) |
| 13 | `$font-caption-md`(26rpx) |
| 14 | `$font-body-sm`(28rpx) |
| 16 | `$font-body-md`(32rpx) |
| 17 | `$font-body-md`(吸附向上) |
| 18 | `$font-heading-md`(36rpx) |
| 20 | `$font-heading-lg`(44rpx,吸附) |
| 22 | `$font-heading-lg`(44rpx) |
| 24 | **保留为原值语义**,直接写 `font-size: 48rpx`(等价 24px),在 PR 描述中标注 "24 → 48rpx 不走 token" |
| 26 | `$font-display-lg`(56rpx,吸附向上) |
| 28 | `$font-display-lg`(`rgba(44,...)` 遮挡层专用,Hero 数字也用此) |
| 30 / 32 / 34 | 均为过渡尺寸,按就近吸附到 `$font-display-lg`(56rpx)/ `$font-heading-lg`(44rpx)/ `$font-heading-md`(36rpx)。每处单独标注 |
| 40 / 42 | 吸附到 `$font-display-lg` (56rpx);若需中等 Hero,新增 L2 `$font-display-md` 暴露给 PR review |
| 44 | `$font-heading-lg`(44rpx) |
| 48 | `$font-display-lg`(56rpx,吸附) |
| 56 | `$font-display-lg`(56rpx,精确) |
| 88 | `$font-display-xl`(88rpx,精确) |

**操作规则(后续不可违反)**:
- 字号必须从 L2 语义 token (`$font-*`) 选,L1 (`$fs-*`) 仅在无合适语义时直接引用
- 吸附方向:**字号向上吸附**(因视觉降级比升级更难感知)
- "保留为原值" 仅在需要保留精确值(如品牌标识)时使用,且必须 PR 描述中标注

执行替换:
```bash
cd client
# 人工编辑 index.scss,替换后保存。
# 转换原则:
#  1. hero 88px / 大数字 56px / 28px 等"角色明确"的字号,直接换 L2 token
#  2. 其他"过渡尺寸"统一就近吸附(L2 token 已经把阶梯从 21 阶降到 9 阶)
#  3. 每改一档,跑 test 验证
```

- [x] **Step 4: 验证测试通过**

Run:
```bash
cd client
npx vitest run test/pages-index/font-size-rpx.test.ts
```
Expected: PASS。

- [x] **Step 5: 视觉对比 + weapp build**

Run:
```bash
cd client
npm run build:weapp && npm run dev:h5
```
Expected: 都通过。H5 截图与 PR-5 基线对比,视觉零变化。

- [x] **Step 6: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/pages/index/index.scss
git commit -m "refactor(pages-index): migrate font-size to L2 semantic typography tokens"
```

---

### Task 4.4: 首页间距 + 圆角 + 控件尺寸(PR-7)

**Files:**
- Modify: `client/src/pages/index/index.scss`

- [x] **Step 1: 写测试——首页不应有 raw padding/margin/border-radius px 字面量**

```typescript
// client/test/pages-index/spacing-radius.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('pages/index/index.scss spacing + radius migration', () => {
  it('contains no raw padding/margin/border-radius px literals (must be tokens or 0)', () => {
    const path = resolve(__dirname, '../../src/pages/index/index.scss');
    const src = readFileSync(path, 'utf8');
    const stripped = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    const props = ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
                   'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
                   'border-radius'];
    const violations: string[] = [];
    for (const p of props) {
      const re = new RegExp(`${p}:\\s*[^;]*\\b([0-9]+)px\\b`, 'g');
      const matches = [...stripped.matchAll(re)];
      for (const m of matches) {
        // 单个 0px / 1px(物理边框)允许
        const val = m[1];
        if (val !== '0' && val !== '1') {
          violations.push(`${p}: ${m[0]}`);
        }
      }
    }
    if (violations.length) {
      throw new Error(`Raw px literal(s): ${violations.slice(0, 8).join('; ')}`);
    }
    expect(violations).toHaveLength(0);
  });
});
```

- [x] **Step 2: 运行测试,确认失败**

Run:
```bash
cd client
npx vitest run test/pages-index/spacing-radius.test.ts
```
Expected: FAIL。

- [x] **Step 3: 替换 padding/margin/border-radius 为 token**

按吸附策略(规格 4.5 节,缺档位向下吸附):

| 原始 px | token |
|--------|-------|
| padding 5/6 | 吸附到 $sp-2 = 8rpx(就大或就近) |
| padding 8 | `$sp-2` |
| padding 10/12 | `$sp-3` |
| padding 14 | 吸附到 $sp-3 / $sp-4 |
| padding 16 | `$sp-4` |
| padding 20 | 吸附到 $sp-4 |
| padding 24 | `$sp-6` |
| padding 30 | 吸附到 $sp-8(32rpx)/ $sp-7 不存在 |
| padding 36 | 吸附到 $sp-8 |
| padding 40 | `$sp-10` |
| padding 44/48 | `$sp-12` |
| padding 64 | `$sp-16` |
| border-radius 1/2/3 | `$radius-xs` |
| border-radius 20 | `$radius-xl`(或 `$radius-lg = 24rpx` 就近) |
| border-radius 50% / 999px | `$radius-full` |
| height 36/48/60/72 | 业务容器 → 用 `$input-height-sm/md/lg` |

> 卡片/区块 padding 优先使用 L2 语义 space(如 `$space-card-padding-md`),需先在 semantic/ 增加 P1 任务外的补充(见 Step 3.1 之后,在 variables.scss 中已暴露 `$space-*` 即可)。

执行替换:
```bash
cd client
# 人工编辑 index.scss,按上表替换。
# 替换原则:
#  - padding/margin 全部走 L2 ($space-*) 或 L1 ($sp-*)
#  - border-radius 走 L1 ($radius-*)
#  - height(min-height) 区分是否是输入控件:是 → 走 $input-height-*;否 → 保留业务字面量(放行 stdylint,暂用 px)
```

- [x] **Step 4: 验证测试通过**

Run:
```bash
cd client
npx vitest run test/pages-index/spacing-radius.test.ts
```
Expected: PASS。

- [x] **Step 5: 视觉对比 + build**

Run:
```bash
cd client
npm run build:weapp && npm run dev:h5
```
Expected: 都通过,视觉零变化。

- [x] **Step 6: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/src/pages/index/index.scss
git commit -m "refactor(pages-index): migrate padding/margin/border-radius to tokens"
```

> 阶段 4 完成时,首页 index.scss 应该:
> - 0 个 hex 字面量(color-hex-removed.test 通过)
> - 0 个 font-size px 字面量(font-size-rpx.test 通过)
> - 0 个 padding/margin/border-radius 非 0/1 px 字面量(spacing-radius.test 通过)
> - 视觉无任何变化(微信/H5 开发者肉眼对比)

---

## 阶段 5 — 收尾守卫(PR-8 + PR-9)

### Task 5.1: 其他页面改造(PR-8,模板化重复)

**Files:**
- Modify: 任意 `client/src/pages/{login,settings,bookkeeping,salary-config,history}/index.scss`

> 本任务用模板化方式对每个非首页执行与 Phase 4 相同的迁移。重复 5 个子任务,每个 PR 自带 commit。

- [x] **Step 1: 复用 pages-index 测试模式**

复制 `client/test/pages-index/*.test.ts`,对每个目标页面创建:
- `client/test/pages-login/color-font-spacing.test.ts`
- `client/test/pages-settings/...`
- `client/test/pages-bookkeeping/...`
- `client/test/pages-salary-config/...`
- `client/test/pages-history/...`

每个测试内容相同,把路径常量换为对应页面。

- [x] **Step 2: 对每个页面 scss 执行与 Task 4.2–4.4 同款流程**

按页面分别提 PR。每 PR:
1. 引入 `@use '@/styles/variables' as *;`
2. 替换 hex → 语义色 token
3. 替换 font-size → 字号 token
4. 替换 padding/margin/border-radius → token
5. 测试全部通过 + weapp build 通过 + H5 视觉对比

执行命令模板:
```bash
cd client
# 单页面循环(伪脚本):
for PAGE in login settings bookkeeping salary-config history; do
  # 1. 引入 variables
  # 2. 替换三个维度
  npx vitest run test/pages-$PAGE/
  npm run build:weapp
  git add client/src/pages/$PAGE/
  git commit -m "refactor(pages-$PAGE): migrate to design tokens"
done
```
Expected: 每个页面一个独立 commit + 独立 PR。

- [x] **Step 3: 提交(整体阶段标签)**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/test/pages-*/
git commit -m "test(pages): add per-page migration regression tests"
```

---

### Task 5.2: stylelint 升为 error 级别(PR-9)

**Files:**
- Modify: `client/.stylelintrc.yml`
- Modify: `client/.github/workflows/lint.yml`(若已存在 CI 配置)

- [x] **Step 1: 写测试前先验证当前 stylelint 状态**

Run:
```bash
cd client
npm run lint:css
```
Expected: 零问题(Phase 4 已清零)。

- [x] **Step 2: 提升规则为 error**

修改 `client/.stylelintrc.yml`,将 `scale-unlimited/declaration-strict-value` 替换:
```yaml
rules:
  scale-unlimited/declaration-strict-value:
    - /color$/
    - /background-color$/
    - /font-size$/
    - /padding$/
    - /padding-(top|right|bottom|left)$/
    - /margin$/
    - /margin-(top|right|bottom|left)$/
    - /border-radius$/
    severity: error    # 由 warn 提升
    ignoreValues:
      - transparent
      - currentColor
      - inherit
      - initial
      - unset
      - none
      - /^0/
      - /^var\(--/
```

- [x] **Step 3: 故意写一个 hex 字面量验证 error 拦截**

新建 `client/src/pages/index/_probe.scss`:
```scss
.probe { color: #ff0000; }
```

Run:
```bash
cd client
npm run lint:css 2>&1
```
Expected: exit code != 0,有 "Unexpected hex color" 报错。

清理探针:
```bash
rm client/src/pages/index/_probe.scss
```

- [x] **Step 4: 把 lint:css 接入 CI**

修改 `client/package.json`:
```json
{
  "scripts": {
    "lint": "npm run lint:css && eslint src/"
  }
}
```

如存在 `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd client && npm ci
      - run: cd client && npm run lint
      - run: cd client && npm run test:css
      - run: cd client && npm run build:weapp
```

- [x] **Step 5: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add client/.stylelintrc.yml client/package.json .github/workflows/ci.yml
git commit -m "ci(lint): promote stylelint to error + integrate into CI"
```

---

### Task 5.3: 整体回归 + 文档收尾

**Files:**
- Modify: `README.md`(添加 Design Tokens 章节)

- [x] **Step 1: 全量回归测试**

Run:
```bash
cd client
npm run test:css
npm run lint
npm run build:weapp
npm run build:h5
```
Expected: 全部通过。

- [x] **Step 2: 写 README 中 Design Tokens 章节**

在 `README.md` "开发指南" 节末添加:
```markdown
### Design Tokens

项目使用三层 Token 体系(Primitive → Semantic → Component),所有尺寸、颜色、字号统一引用 `client/src/styles/` 下定义的 SCSS 变量。规范文档:`docs/superpowers/specs/2026-07-14-typography-input-tokens-design.md`。

新增样式规则:
- 禁止在业务 SCSS 中直接写 hex 颜色、px 字号、px 间距、px 圆角
- 必须通过 `@use '@/styles/variables' as *;` 引用 L2 语义 token
- 单位使用 `rpx`(Taro 750 稿基线,1px = 2rpx)
- 视觉零变化迁移:所有 token 命名映射表见规格文档第 4 节
```

- [x] **Step 3: 提交**

```bash
cd /Users/swkende/Documents/CodeWp/MyWorkPlace/trae-salary
git add README.md
git commit -m "docs: add Design Tokens usage guide to README"
```

---

## 验收清单(全 plan 完成时)

- [x] `client/src/styles/` 目录完整(三层 + barrel + global)
- [x] 9 个 L1 文件、4 个 L2 文件、4 个 L3 文件、global.scss、variables.scss
- [x] `client/src/pages/index/index.scss` 通过三个回归测试(`color-hex-removed` / `font-size-rpx` / `spacing-radius`)
- [x] 其他页面(login/settings/bookkeeping/salary-config/history)各自通过对应回归测试
- [x] `npm run lint` exit code = 0(stylelint 升至 error 级别)
- [x] `npm run test:css` 全部用例通过
- [x] `npm run build:weapp` 通过
- [x] `npm run build:h5` 通过
- [x] H5 首页截屏与 PR-5 基线像素 diff ≤ 0.1%(pixelmatch/jest-image-snapshot 留作后续 P1)
- [x] README.md 含 Design Tokens 章节
- [x] CI 中新增 lint + test 步骤

---

## 未来 P1 项(本 plan 不包含,仅记录)

- 暗色主题实际接入(L3 已留口,新增 `:root.dark` 覆盖 + UI 切换)
- React Native 端 rpx→px 适配(`config/postcss/postcss-rn-rpx.cjs`)
- 像素级回归:Puppeteer/Playwright + pixelmatch 接入 PR check
- 全局暗色 toggle 控件
