# Trae Salary 字号与输入框尺寸 Token 化设计稿

**日期**:2026-07-14
**状态**:待用户审阅
**项目**:trae-salary(微信小程序 + Taro 4.2 + TypeScript 多端)

---

## 1. 背景与目标

### 现状

`client/src/pages/index/index.tsx` 共 1075 行(对应 `index.scss` 共 1409 行);首页配色采用日式侘寂风,主要使用墨色 + 米色 + 金棕三色系。所有尺寸直接硬编码:

- **字号**:21 种不同 px 值(10/12/13/14/16/17/18/20/22/24/26/28/30/32/34/40/42/44/48/56/88),分布于首页约 50+ 处
- **间距**:14 种不同 px 值(5/6/8/10/12/14/16/20/24/30/36/40/48/64)
- **圆角**:6 种(1/2/3/20/50%/999px)
- **颜色**:100+ 处直接写 hex 或 rgba
- `client/src/app.scss` 仅 5 行,只设字体族与反锯齿
- `client/src/constants/` 仅有 `salary.ts`,没有任何 design token / variables 文件
- 项目内完全没有单位转换工具,所有数字均为 `px` 字面量

### 问题

1. **响应式失效**:`px` 在微信小程序与 H5 中不会随屏宽缩放,导致 320px 与 414px 屏上视觉差异巨大,首页 hero 数字在窄屏容易溢出
2. **维护成本**:改一次字号需要全局搜索替换;新版设计改 5 处就要查 50 行
3. **样式噪声**:13px、17px、20px、24px 等"非典型"过渡尺寸大量存在,无意识积累,UI 节奏被破坏
4. **未来主题化受阻**:若要上暗色主题或品牌切换,没有语义层无从下手
5. **代码 review 困难**:无法在 lint 层强制"必须走 token",靠 review 把关不可靠

### 目标

落地一套**三层 design token 体系**(Primitive → Semantic → Component),把首页字号、间距、圆角、输入框/控件尺寸、颜色一并集中化,完成一次"视觉零变化"的全量改造,并以 stylelint 守住未来增量。具体:

1. **L1 原语层**:建立不可绕过的色板、字号阶梯、间距栅格、圆角、动效原语
2. **L2 语义层**:把语义角色(text-primary / bg-surface / font-display-xl / input-height-md …)作为唯一调用入口
3. **L3 组件层**:以 CSS 变量暴露组件内部可覆盖项,为未来主题化留口
4. **单位统一**:`px` 物理像素(边框、阴影偏移、位移)与 `rpx`(字号、间距、圆角、控件尺寸)分离,Taro designWidth=750 基线
5. **质量门禁**:stylelint-declaration-strict-value 强制 `font-size / padding / margin / border-radius / color / background-color` 引用 SCSS 变量
6. **可演进**:架构本身为未来暗色主题 / 多主题切换 / 用户字号偏好等场景留口

### 非目标(YAGNI)

- 暗色主题实际接入(仅留 L3 钩子)
- 动态字号(用户偏好 `setTextSize`)
- React Native 实际 rpx→px 适配(本项目主战场为 weapp + h5)
- 主题色切换 UI
- 第三方组件库(ECharts、NutUI 等)内部样式的 token 改造
- 第三方 API 提供的设计稿调整

---

## 2. 提炼要点(从 `client/src/pages/index/index.scss` 实际抽取)

### 2.1 字号现状分布

| 当前 px | 出现次数(估算) | 主要场景 |
|---------|----------------|---------|
| 88 | 1 | 首页 hero 已赚金额 |
| 56 | 1 | 次级 hero 数字 |
| 48 | 1 | 弹层/大数字 |
| 44 | 2 | 超大标题 |
| 42 | 1 | 大标题 |
| 40 | 3 | 主数字 |
| 34 | 1 | 标题 |
| 32 | 1 | 标题 |
| 30 | 1 | 大数字 |
| 28 | 7 | 数字 / 重要节点 |
| 26 | 2 | 大标题 |
| 24 | 2 | 标题 |
| 22 | 4 | 区块标题 |
| 20 | 2 | 二级标题/按钮 |
| 18 | 3 | 中等标题 |
| 17 | 1 | 略大正文 |
| 16 | 5 | 基础正文 |
| 14 | 2 | 辅助文字 |
| 13 | 2 | 次要正文 |
| 12 | 2 | 标签 |
| 10 | 1 | 极小字 |

> 21 种值横跨一屏 UI,典型字号阶梯设计为 7-9 阶,大量过渡值无意保留。

### 2.2 输入框 / 控件尺寸现状

`pages/index` 中可见的"输入相关容器"高度:`36px / 48px / 60px / 72px / 160px / 168px / 180px`。其中:

- 36 / 48 / 60 / 72 属于"控件级别"(真正的输入框、按钮、单元格)
- 160 / 168 / 180 属于"卡片级别",非输入控件本身的高度

宽度、横竖向、padding / margin 也无规范,见 2.3。

### 2.3 间距现状分布

`index.scss` 中可识别 padding 字面量(仅统计有数字的):

```
padding: 40px 64px         (页头)
padding: 48px 16px 44px    (卡片大留白)
padding: 44px 24px         (卡片)
padding: 32px 32px 24px    (中等卡片)
padding: 32px 24px         (中等)
padding: 30px 24px         (略紧)
padding: 24px 36px 20px    (页脚)
padding: 24px 24px         (基础卡片)
padding: 20px 32px 36px    (反向)
padding: 14px 16px         (单元格)
padding: 12px 32px 24px    (卡片)
padding: 12px 14px         (小单元格)
padding: 8px 4px           (小标签)
padding: 8px 20px          (按钮)
padding: 6px 12px          (徽标)
padding: 5px 14px          (徽标变体)
padding: 5px 12px          (徽标紧凑)
```

> 14 种不同的 padding 组合,其中至少 6 种可被归并为"$space-card-padding-md"。

### 2.4 颜色现状分布(出现次数 ≥ 3)

| 颜色 | 次数 | 语义 |
|------|------|------|
| `#2c2c2c` | 18 | 主文字 |
| `rgba(44,44,44,0.08)` | 17 | 阴影 / 分割线 |
| `#8a8279` | 16 | 灰咖点缀 |
| `#c8b99a` | 11 | 主金 |
| `#faf8f4` | 10 | 页面背景 |
| `#a89878` | 10 | 深金 |
| `rgba(44,44,44,0.06)` | 8 | 弱分割 |
| `#7a8c6e` | 7 | 绿(正向) |
| `#5c5650` | 7 | 副文字 |
| `#f5f0e8` | 4 | 浅柔区 |
| `#b85450` | 4 | 红(警示) |
| `rgba(44,44,44,0.04)` | 3 | 极弱分割 |
| `#f0e8d8` | 3 | 微弱对比背景 |
| `#ece5d8` | 3 | 分隔背景 |
| `#736c63` | 3 | 灰咖正文 |

---

## 3. 三层 Token 架构

### 3.1 模型

```
┌──────────────────────────────────────────────────────────────┐
│  L1 原语 Token (Primitive)                                   │
│  ─ 只承载原始值,无业务含义,可跨主题复用                         │
│  例: $palette-ink-900: #2c2c2c, $fs-300: 32rpx, $sp-4: 16rpx │
├──────────────────────────────────────────────────────────────┤
│  L2 语义 Token (Semantic)                                    │
│  ─ 用业务/角色名承载"为何而用",可指向不同原语实现主题切换        │
│  例: $color-text-primary → $palette-ink-900                   │
│      $font-display-xl    → $fs-700                           │
│      $input-height-md    → 72rpx                             │
├──────────────────────────────────────────────────────────────┤
│  L3 组件 Token (Component) — CSS 自定义属性                    │
│  ─ 暴露给具体组件的内部变量,运行时可由父容器覆写                 │
│  例: .input { height: var(--input-height); ... }              │
│      .input-cell { --input-height: 88rpx; }                   │
└──────────────────────────────────────────────────────────────┘
```

三层优势:
- L1 不变,改动 L2 即可换主题(留出未来暗色/多色主题口子)
- L3 用 CSS 变量,可由父容器覆写,便于处理"同一组件在不同容器内尺寸不同"
- L2 为唯一调用入口,业务文件只能接触 L2/L3,L1 通过 SCSS @use 隐藏

### 3.2 文件结构

```
client/src/styles/
├── _config.scss                 # Taro unit 配置(pxTransform base = 32)
├── tokens/                      # L1 原语
│   ├── _palette.scss            # 色板:ink / sand / accent / olive / rouge
│   ├── _typography.scss         # 字号阶梯 fs-50 ~ fs-700, lineHeight, fontFamily
│   ├── _spacing.scss            # sp-0 ~ sp-16 (4rpx 栅格)
│   ├── _radius.scss             # radius-xs/sm/md/lg/xl/full
│   ├── _z-index.scss
│   ├── _motion.scss             # duration-fast/base/slow, easing
│   └── _index.scss              # @forward
├── semantic/                    # L2 语义
│   ├── _color.scss              # color-text-primary / color-bg-surface ...
│   ├── _typography.scss         # font-display-xl / font-body-md ...
│   ├── _control.scss            # input-height-md / btn-height-md ...
│   └── _index.scss
├── components/                  # L3 组件默认值
│   ├── _button.scss
│   ├── _cell.scss
│   ├── _input.scss              # 输入框专用
│   └── _card.scss
├── variables.scss               # 单一入口 @use './tokens' as * 等
└── global.scss                  # 把 L3 默认值注入 :root
```

`pages/index/index.scss` 等业务文件顶部:
```scss
@use '@/styles/variables' as *;
```
之后只通过 `$font-display-xl` 等 L2 调用。

### 3.3 命名规范

| 层级 | 前缀 | 例子 |
|------|------|------|
| L1 颜色 | `$palette-{色族}-{亮度}` | `$palette-ink-900`, `$palette-sand-50` |
| L1 字号 | `$fs-{3 位数字,T-shirt 化}` | `$fs-100` … `$fs-700` |
| L1 间距 | `$sp-{0-16}` | `$sp-4 = 16rpx` |
| L1 圆角 | `$radius-{xs/sm/md/lg/xl/full}` | `$radius-md: 16rpx` |
| L2 语义颜色 | `$color-{角色}-{修饰}` | `$color-text-primary`, `$color-bg-surface-raised` |
| L2 语义字号 | `$font-{display/heading/body/caption}-{级别}` | `$font-display-xl` |
| L2 控件尺寸 | `${控件}-{属性}-{级别}` | `$input-height-md: 72rpx`, `$btn-height-sm` |
| L3 组件 CSS 变量 | `--{组件}-{属性}` | `--btn-primary-bg`, `--input-padding-x` |

> 每个 L1 都只暴露"值",L2 才决定"用谁";L3 才决定"在组件里用谁"。改顺序:调 L1 → 全局生效;调 L2 → 主题级生效;改 L3 → 仅组件级。

---

## 4. Token 映射草案

### 4.1 L1 字号阶梯

```
$fs-50   : 20rpx     (替代现状 10px,保底最小清晰度)
$fs-75   : 24rpx     (替代 12px)
$fs-100  : 26rpx     (替代 13px)
$fs-200  : 28rpx     (替代 14px)
$fs-300  : 32rpx     (替代 16px)   ← 基础正文
$fs-400  : 36rpx     (替代 18px)
$fs-500  : 44rpx     (替代 22px)
$fs-600  : 56rpx     (替代 28px)
$fs-700  : 88rpx     (替代 44px,主页 hero) ← 现状 88px 直接保留
```

> 说明:`px` → `rpx` 是 2 倍换算(750 稿基线)。Tailwind 风 50/75/100/200 命名便于读懂——不像 `xxl/lg` 含糊。现状里 `17/20/24/26/30/34/40/42/48` 等"非典型"尺寸在迁移时按就近归并。

### 4.2 L2 语义字号

| 角色 | Token | 引到 L1 | 原 px | 现状样式示例 |
|------|-------|---------|-------|--------------|
| Hero 数字 | `$font-display-xl` | `$fs-700` | 88 | `.hero-amount` |
| 大数字 | `$font-display-lg` | `$fs-600` | 56 | 弹层显示 / 重要数字 |
| 标题 | `$font-heading-lg` | `$fs-500` | 44 | 段落级标题 |
| 段落标题 | `$font-heading-md` | `$fs-400` | 36 | `.cell-title` 等 |
| 正文-强调 | `$font-body-lg` | `$fs-300` | 32 | 按钮文字 / 主表单 |
| 正文-常规 | `$font-body-md` | `$fs-300` | 32 | 段落正文(默认) |
| 辅助正文 | `$font-body-sm` | `$fs-200` | 28 | 标签 / 描述 |
| 提示文字 | `$font-caption-md` | `$fs-100` | 26 | 次级提示 |
| 极小字 | `$font-caption-sm` | `$fs-75` | 24 | 版权 / 时间戳 |

### 4.3 L1 色板

```
$palette-ink-900   : #2c2c2c
$palette-ink-700   : #5c5650
$palette-ink-500   : #736c63
$palette-ink-300   : #8a8279
$palette-sand-50   : #faf8f4
$palette-sand-100  : #f5f0e8
$palette-sand-200  : #ece5d8
$palette-sand-300  : #f0e8d8
$palette-accent-500: #c8b99a
$palette-accent-700: #a89878
$palette-olive-500 : #7a8c6e
$palette-rouge-500 : #b85450

$palette-alpha-ink-03 : rgba(44,44,44,0.03)
$palette-alpha-ink-04 : rgba(44,44,44,0.04)
$palette-alpha-ink-06 : rgba(44,44,44,0.06)
$palette-alpha-ink-08 : rgba(44,44,44,0.08)
$palette-alpha-ink-15 : rgba(44,44,44,0.15)
$palette-alpha-ink-30 : rgba(44,44,44,0.30)
$palette-alpha-sand-96: rgba(250,248,244,0.96)
$palette-alpha-sand-82: rgba(250,248,244,0.82)
$palette-alpha-sand-25: rgba(200,185,154,0.25)
$palette-alpha-sand-30: rgba(200,185,154,0.30)
$palette-alpha-warm-45: rgba(231,221,195,0.45)
```

### 4.4 L2 语义颜色

| 语义 | Token | 绑到 |
|------|-------|------|
| 主文字 | `$color-text-primary` | `$palette-ink-900` |
| 副文字 | `$color-text-secondary` | `$palette-ink-700` |
| 弱化文字 | `$color-text-tertiary` | `$palette-ink-500` |
| 占位 | `$color-text-placeholder` | `$palette-ink-300` |
| 页面背景 | `$color-bg-page` | `$palette-sand-50` |
| 卡片背景 | `$color-bg-surface` | `#ffffff` |
| 浅柔背景 | `$color-bg-surface-soft` | `$palette-sand-100` |
| 浮层 | `$color-bg-overlay` | `$palette-alpha-sand-96` |
| 分割线-弱 | `$color-divider-subtle` | `$palette-alpha-ink-08` |
| 阴影 | `$color-shadow-soft` | `$palette-alpha-ink-06` |
| 主品牌 | `$color-brand-primary` | `$palette-accent-500` |
| 主品牌-深 | `$color-brand-primary-strong` | `$palette-accent-700` |
| 正向 | `$color-state-success` | `$palette-olive-500` |
| 警示 | `$color-state-danger` | `$palette-rouge-500` |

### 4.5 L1 间距(4rpx 栅格)

```
$sp-0 : 0
$sp-1 : 4rpx
$sp-2 : 8rpx
$sp-3 : 12rpx
$sp-4 : 16rpx     ← 基础间距
$sp-6 : 24rpx
$sp-8 : 32rpx
$sp-10: 40rpx
$sp-12: 48rpx
$sp-16: 64rpx
```

> **吸附策略**:迁移期遇到不在定义阶梯上的原始值(如 `36px / 20px / 30px / 44px` 等),统一**向下吸附**到最近的阶梯值。这样能保证视觉差异在用户感知阈值以下(~2px),同时避免阶梯膨胀。开发者 review 时不再讨论"应该选 $sp-8 还是 $sp-9",节省 PR 沟通成本。

### 4.6 L2 语义间距

| 角色 | Token | 值 |
|------|-------|----|
| 卡片内边距-紧凑 | `$space-card-padding-sm` | `$sp-3 $sp-4` |
| 卡片内边距-常规 | `$space-card-padding-md` | `$sp-6 $sp-4` |
| 卡片内边距-舒展 | `$space-card-padding-lg` | `$sp-8 $sp-6` |
| 区块上下间距 | `$space-section-y` | `$sp-8` |
| 区块首尾留白 | `$space-section-edge` | `$sp-10 $sp-4` |
| 页面边距 | `$space-page-edge` | `$sp-6 $sp-4` |
| 控件水平内距 | `$space-control-padding-x` | `$sp-4` |

迁移映射样例(原值不在定义阶梯上的,以最近阶梯吸附):
- 原 `padding: 48px 16px 44px` → `$space-card-padding-lg`(并就近归并第三值;48→48rpx/$sp-12、44→48rpx/$sp-12)
- 原 `padding: 40px 64px` → `$sp-10 $sp-16`(40px→40rpx、64px→64rpx)
- 原 `padding: 24px 36px 20px` → `$sp-6 $sp-8 $sp-4`(36px 向下吸附到 32rpx/$sp-8,20px 向下吸附到 16rpx/$sp-4)

### 4.7 L1 圆角

```
$radius-none : 0
$radius-xs   : 4rpx    (合并原 1/2/3 px)
$radius-sm   : 8rpx
$radius-md   : 16rpx
$radius-lg   : 24rpx
$radius-xl   : 40rpx   (原 20px)
$radius-full : 9999px
```

### 4.8 L2 控件尺寸

```
$input-height-sm : 56rpx     (轻量输入:单数字)
$input-height-md : 72rpx     (标准输入:数字+单位)
$input-height-lg : 88rpx     (大输入:含上下 padding + 图标)

$input-padding-x : $sp-4    (16rpx)
$input-padding-y : $sp-2    (8rpx)
$input-gap-label : $sp-3    (12rpx)

$btn-height-sm   : 56rpx
$btn-height-md   : 80rpx
$btn-height-lg   : 96rpx
```

迁移映射样例:
- 首页 `height: 36px / 48px / 60px / 72px` → 按 4px 栅格就近对齐 `$input-height-sm/md/lg`
- 首页 `height: 160px / 168px / 180px` 非输入,作为业务属性而非 token,改用 `min-height` + 业务变量

### 4.9 L3 组件默认(以 Input 为例)

```scss
.input {
  --input-height    : 72rpx;
  --input-padding-x : #{$sp-4};
  --input-padding-y : #{$sp-2};
  --input-bg        : #{$color-bg-surface};
  --input-border    : 1px solid #{$color-divider-subtle};
  --input-radius    : #{$radius-md};
  --input-font      : #{$font-body-md};
  --input-color     : #{$color-text-primary};
  --input-placeholder: #{$color-text-placeholder};

  height: var(--input-height);
  padding: var(--input-padding-y) var(--input-padding-x);
  background: var(--input-bg);
  border: var(--input-border);
  border-radius: var(--input-radius);
  font: var(--input-font);
  color: var(--input-color);
  &::placeholder { color: var(--input-placeholder); }
}
```

某特殊容器"想要更小输入框"只需覆写一行:

```scss
.input-cell.is-compact { --input-height: 56rpx; }
```

---

## 5. 多端适配策略

### 5.1 单位策略

| 内容 | 源文件写法 | 说明 |
|------|-----------|------|
| 字号 / 间距 / 圆角 / 控件尺寸 | **全部 `rpx`** | Taro designWidth=750 |
| 边框 / 阴影偏移 / 1px 物理线 | **`px`** | 物理像素,不应随屏宽变 |
| transform 偏移 | **`px`** | 同上 |
| 颜色 / z-index / duration / opacity | 不带单位 | 原样 |

`rpx` 与 `px` 换算固定为 ×2(750 稿)。`$fs-300: 32rpx` 对应原 `16px`。

### 5.2 多端适配矩阵

```
┌──────────────────┬──────────────┬──────────────────────────┐
│ 目标平台          │ 单位处理     │ 备注                     │
├──────────────────┼──────────────┼──────────────────────────┤
│ weapp(主)        │ rpx 原生     │ 主战场                   │
│ h5                │ rpx → calc  │ Taro 构建器自动处理      │
│ harmony-hybrid    │ rpx 原生     │ 新支持                   │
│ alipay/swan/jd/  │ rpx 原生     │ 多端插件同款行为         │
│ qq/tt             │              │                          │
│ rn                │ rpx → 2*px  │ 需新增 postcss 插件      │
│                   │              │ 一期不交付(YAGNI)        │
└──────────────────┴──────────────┴──────────────────────────┘
```

一期适配范围:**weapp + h5**。RN 的 px 转换插件作为预留,放在 `config/postcss/` 目录下,但本期不接 RN。

### 5.3 主题切换路线

本设计**不接入暗色主题**,仅留出"能接"的口子:

- L2 语义层全部同时输出 SCSS 变量 + 同名 `--color-text-primary` 等 CSS 变量(在 `:root` 中初始化)
- 组件层只用 CSS 变量 → `var(--input-height)`,不直接 `$input-height-md`
- 未来只需在 `:root.dark { --color-text-primary: … }` 中覆写即可换主题

---

## 6. 迁移路径

### 6.1 PR 切分

```
PR-1 架构骨架 ★
   新建 client/src/styles/ 全部目录
   variables.scss 入口
   app.scss 引入基础重置
   风险:无视觉变化

PR-2 stylelint + snapshot 基线 ★
   安装 stylelint + stylelint-config-standard-scss +
   stylelint-declaration-strict-value(白名单 px/transparent 等)
   强制规则:font-size / padding / margin / border-radius /
            color / background-color 必须引用 SCSS 变量
   vitest snapshot 当前 styles 编译结果(留基线)

PR-3 L1 原语 Token(色板 + 字号 + 间距 + 圆角) ★
   tokens/_palette.scss 等 5 个
   仅新增文件,不改动业务
   风险:无

PR-4 L2 语义 Token + L3 组件默认值 ★
   semantic/_color.scss 等 4 个
   components/_input.scss 等 4 个
   global.scss 把 L3 默认值注入 :root

PR-5 index.scss 颜色迁移(从 hex → token) ★
   约 100 处
   视觉零变化(只换名字)

PR-6 index.scss 字号迁移(从 px → token) ★
   约 50 处
   视觉零变化

PR-7 index.scss 间距 + 圆角 + 控件尺寸 ★
   约 90 处
   视觉零变化

PR-8 其他页面改造 ★
   pages/login, pages/settings, pages/bookkeeping,
   pages/salary-config, pages/history 等
   每个页面一个 PR,模板化(只改 token 不动结构)

PR-9 stylelint 守卫开启(error 级别) ★
   scripts/lint-css.sh 在 CI 中跑
   新代码出现裸 px 报错
```

> ★ 表示该 PR 可独立 review。单 PR 控制在 5-100 处替换之间,避免 review 疲劳。

### 6.2 PR 验证流程

每个迁移 PR 必须通过:
1. `npm run build:weapp` 通过
2. `npm run dev:h5` 启动,人为对比首页截图(开发者保存前后截图)
3. `npm run test` snapshot 通过(styles 相关)
4. PR 模板粘贴 Before / After 像素对比图

### 6.3 PR 模板(示例)

```markdown
## Token 迁移 PR: {类型}

### 变更
- L: [ ] 颜色
- [ ] 字号
- [ ] 间距
- [ ] 圆角
- [ ] 控件尺寸

### 涉及文件
- pages/.../index.scss
- pages/.../index.tsx(如有)

### 验证
- [ ] build:weapp 通过
- [ ] dev:h5 首页对比无视觉差异(贴截图)
- [ ] vitest snapshot 通过
- [ ] stylelint 通过

### 替换处数量
N 处
```

---

## 7. 质量门禁

### 7.1 工具链

| 层级 | 工具 | 内容 |
|------|------|------|
| 静态 | `stylelint` | `font-size` / `padding` / `margin` / `border-radius` / `color` / `background-color` 必须为 SCSS var 或白名单关键字 |
| 静态 | `stylelint-scss/dollar-variable-pattern` | 强制 `$fs-XXX` / `$color-XXX` 等命名 |
| 静态 | `eslint` 已有 | 不变 |
| 单元 | `vitest` + `@tarojs/test-utils` | snapshot 测试 `styles/global.scss` 编译结果结构稳定 |
| 集成(H5) | `vitest` + `puppeteer` 或 `playwright` | 截屏首页 + 后续 token 改造基线对比(像素 diff ≤ 0.1%) |
| 集成(WeApp) | 手工 | `npm run build:weapp -- --watch` + 微信开发者工具真实预览,人工确认 |
| CI | GitHub Actions | lint + unit + H5 smoke 三步 |

### 7.2 stylelint 核心规则(.stylelintrc.yml 节选)

```yaml
plugins:
  - stylelint-declaration-strict-value

rules:
  scale-unlimited/declaration-strict-value:
    - /color/
    - /background-color/
    - /font-size/
    - /padding/
    - /margin/
    - /border-radius/
    ignoreValues:
      - transparent
      - currentColor
      - inherit
      - initial
      - unset
      - none
      - 0
      - /^var\(--/

  stylelint-scss/dollar-variable-pattern:
    - pattern: '^(fs|sp|radius|palette|color|font|input|btn|space|motion|shadow|z-index)'
    - { ignore: 'local' }
```

> 第 2 PR 阶段先以 `warn` 级别引入,等业务全迁完(PR-9)再升为 `error`。

### 7.3 像素 diff 阈值

- 阈值 0.1% 为迁移期临时值
- 改造稳定后将收紧到 0.05%
- 工具:`pixelmatch` / `jest-image-snapshot`

---

## 8. 风险与权衡

| 风险 | 缓解 |
|------|------|
| 单 PR 改动 50+ 处,review 易疲劳 | 按 token domain 切分(色/字/间距/圆角/尺寸)+ 写 helper 脚本辅助 |
| `rpx` 静态编译在 SCSS 中行为不一致 | 仅用作字面量,避免 `rpx / 2` 等运算 |
| 文本字号统一化后视觉收紧/变松 | 迁移 PR 全部要求"视觉零变化";hero 88rpx 保留,其余就近归并 |
| L1 命名具先入为主,后期大规模改名成本高 | 一次定稿,后续只追加不修改 |
| stylelint 规则过严导致旧组件无法合并 | PR-2 引入时先用 warn,等业务全迁完再开 error |
| 第三方组件库样式未覆盖,仍出现裸 px | 第三方库样式不在 stylelint 范围内;需改造时单独评估 |
| 设计稿 375/750 切换时同步未跟上 | 文档中明示:本 token 以 750 稿为唯一基线 |

---

## 9. 文档与参考

- 仓库现存历史规格:`docs/superpowers/specs/2026-07-02-add-backend-design.md`(章节风格沿用)
- 后续实施计划:由 `superpowers:writing-plans` skill 输出到 `docs/superpowers/plans/`
- 实施完成后用户使用手册:`README.md` 中补一段"Design Tokens"章节

---

**版本**:v1.0
**作者**:SWKENDE
**最后更新**:2026-07-14
