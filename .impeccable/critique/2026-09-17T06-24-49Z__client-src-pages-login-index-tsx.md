---
target: login page vs established style
total_score: 15
p0_count: 1
p1_count: 3
timestamp: 2026-09-17T06-24-49Z
slug: client-src-pages-login-index-tsx
---
# Critique: Login vs established salary-clock language

Target: `client/src/pages/login/index.tsx`

## Heuristic scores

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | 按钮有 loading，但后端未启动时要到提交才知道；首次同步没有进度 |
| 2 | Match System / Real World | 1 | 入帐 / Personal Ledger / 页码不像每天打开的工资时钟 |
| 3 | User Control and Freedom | 1 | 无游客、无跳过、无返回；首页被守卫踢回登录 |
| 4 | Consistency and Standards | 1 | 和首页侘寂时钟是两套产品；窗口标题仍是 Taro Demo |
| 5 | Error Prevention | 2 | 注册有格式校验，登录模式把格式问题丢给服务端 |
| 6 | Recognition Rather Than Recall | 2 | 规则写在 placeholder，不记住用户名，也没解释为何要账号 |
| 7 | Flexibility and Efficiency | 1 | 只有注册/登录一条路，本机不可用 |
| 8 | Aesthetic and Minimalist Design | 2 | 装订线、竖排页码、英文眉题、箴言页脚和表单抢权重 |
| 9 | Error Recovery | 2 | 文案可读，但不贴字段、无找回密码 |
| 10 | Help and Documentation | 1 | 没说为什么要注册，也没说没有服务器会怎样 |
| **Total** | | **15/40** | **Poor** |

## Anti-patterns

LLM: 登录页像一张“墨签账簿”概念海报，不是工资时钟的第一屏。英文大写眉题、竖排页码、左侧色条、底部箴言都是常见生成物。Token 用对了，构图和隐喻是另一套产品。

Detector: `detect.mjs` 对 login/index 扫描结果为 `[]`。这是 Taro TSX/SCSS 上的假阴性，不是页面干净。

Visual overlays: 未注入。本机无 Taro `node_modules`，无法起 H5 做浏览器验收。

## Overall impression

首页已经有完整的侘寂时钟语言。登录被做成另一本账簿，又把账号做成唯一入口。所以劝退的不只是“不好看”，而是“这不像我的软件，而且还不让我先用”。

## What's working

- 登录/注册共用一表，模式切换清楚
- 错误区定高，主按钮不跳动
- 颜色和间距走了现有 token，没有退回通用蓝按钮卡片

## Priority issues

- **[P0] 账号墙是唯一入口**：`app.config` 首页是登录，`app.tsx` 无 token 就 `reLaunch` 登录。没有游客、没有本机模式。要用工资时钟，必须先有后端和账号。
- **[P1] 视觉隐喻被换掉了**：首页是侘寂时钟（和纸纹理、明朝体、大数字、软卡片）。登录是账簿（朱红装订线、竖排页码、深墨方按钮、英文眉题）。规格还写明“不把账簿样式推广到其他页面”，等于正式分叉。
- **[P1] 连自己的规格都没做完**：规格要和纸纹理和明朝体。实现没有纹理；登录 SCSS 不写 `font-family`；`login-root--${mode}` 无样式；短屏 `padding-top` 被行内 `paddingTop` 盖掉；页码在垂直居中而不是右上。
- **[P1] 文案不像这个产品**：`入 帐`、`Salary Clock · Personal Ledger`、`专注每一刻的价值` 和首页的 `目標` / `給与` / `今日不计收益` 不是同一说话人。
- **[P2] 微信原生控件会拆掉风格**：`Input`/`Button` 在小程序里经常不吃自定义字体；密码旁“显示密码”整词按钮会挤掉输入区。

## Personas

**Jordan（作者自己再打开）**：第一眼不是工资时钟。要注册才能进自己做过的页面。没有服务器就卡死。高放弃。

**Casey（手机单手）**：主按钮在中部，不是拇指区。密码行要同时对付输入和长文案按钮。

**Riley（故意找茬）**：后端没开只有提交后才报网络错误。没有游客兜底。登录模式不提前拦非法用户名。

## Cognitive load

失败项：单一焦点、视觉层级、工作记忆（用户名规则 + 必须有服务器）、渐进披露。4 项失败，对登录页来说外来负荷过高。

## Minor

- 窗口标题仍是 `Taro Demo`
- 页码在 750 稿上可能和 620rpx 内容抢边
- 错误固定带“错误：”前缀
- 工程里没有任何 `loadFontFace`，明朝体依赖设备是否已装 Noto / Shippori
- CI 只保证 token 字面量，不保证风格同一
