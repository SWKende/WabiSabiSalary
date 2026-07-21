# 登录页“墨签账簿”重设计规格

## 1. 背景

当前登录页位于 `client/src/pages/login/index.tsx`，负责登录、注册、保存 token、首次同步和跳转首页。认证功能已经可用，但页面采用通用的居中表单卡片，缺少首页已有的侘寂、和纸、墨色、砂金、明朝体和宽字距等产品视觉语言。

本次重设计采用已确认的方案 C“墨签账簿”：把页面塑造成一张开放式个人账页，以留白、横线、朱红装订线和克制的排版建立品牌感，同时保留现有认证流程。

## 2. 目标

1. 让登录页与工资时钟现有侘寂设计系统保持一致。
2. 保留登录和注册共用表单、底部文字切换模式的交互。
3. 保持现有认证 API、token、首次同步和跳转流程不变。
4. 优先保证微信小程序的小屏、安全区和软键盘体验，同时不破坏 H5 构建。
5. 补齐输入校验、加载、错误、密码可见性和无障碍状态。
6. 继续使用现有设计 token，不新增图片资产或第三方依赖。

## 3. 非目标

- 不修改服务端认证接口、JWT、密码哈希或数据库结构。
- 不修改 `client/src/app.tsx` 的认证守卫。
- 不改变 token 存储和 `initialSync()` 的数据一致性策略。
- 不新增手机号、验证码、第三方登录、找回密码或用户协议流程。
- 不重构全局设计 token，也不把登录页特有的账簿样式推广到其他页面。
- 不改首页的启动选择覆盖层。
- 不在本规格内修复根工作区的 AJV/Taro 构建工具链；该问题作为独立前置维护项处理。

## 4. 已确认的设计方向

### 4.1 核心概念

页面是一张“可交互的个人账簿首页”，不是悬浮在背景上的通用表单卡片。

核心视觉元素：

- 和纸暖色页面背景与极轻纸张纹理；纹理由 CSS 生成，所有颜色来自现有语义 token。
- 页面左侧一条克制的朱红装订线及两个装订节点；使用 `$color-state-danger` 配合透明度，不新增业务色。
- 右上方纵向页码文案：登录为“账户 · 第〇一页”，注册为“账户 · 新建页”。为兼容传统 WebView 微信小程序，字符由纵向 flex 容器逐字堆叠，不使用 `writing-mode`。
- 以明朝体、宽字距和横向分隔线组织品牌区与表单区。
- 输入框使用“账簿横线”样式，而不是封闭矩形卡片。
- 主按钮为深墨色矩形，仅保留很小的圆角。
- 砂金色用于焦点、模式切换入口和次要强调。
- 错误状态使用朱红圆点与文本，不只依赖颜色。

纸张纹理、装订线、节点和分隔线均通过 CSS 生成，不增加图片资源。

### 4.2 登录模式文案

- 英文眉题：`Salary Clock · Personal Ledger`
- 主标题：`入 帐`
- 说明：`登录工资时钟，继续记录时间、收入与日常。`
- 账户标签：`账 户`
- 密码标签：`密 码`
- 主操作：`登 录`
- 模式切换：`还没有账号？登记新账户`
- 页脚短句：`专注每一刻的价值`

### 4.3 注册模式文案

- 英文眉题：`Salary Clock · New Account`
- 主标题：`登 记`
- 说明：`创建一份只属于你的账簿，从今天开始记录。`
- 账户标签：`新账户`
- 密码标签：`设置密码`
- 主操作：`注 册`
- 模式切换：`已经有账号？返回登录`
- 页脚短句：`让记录从此处开始`

### 4.4 关于视觉稿中的系统状态栏

视觉稿中的时间和微信胶囊只用于说明安全区关系。实际页面不绘制假的系统时间或胶囊。页面复用 `client/src/utils/window.ts` 的窗口信息，并读取 `Taro.getMenuButtonBoundingClientRect()`；仅当返回矩形具有有效宽度时，微信端以胶囊底部加设计系统间距作为内容顶部起点，其他情况回退到状态栏高度加同一间距。两条路径都不再叠加 `env(safe-area-inset-top)`。纵向页码必须位于该运行时顶部边界下方。平台 API 返回的 CSS 像素只用于计算设备几何，不作为视觉尺寸 token。

### 4.5 Placeholder 跨端策略

当前 TSX 中的 `placeholderStyle='color: #8a7f70; font-size: 15px;'` 必须删除。新实现不保留任何内联 placeholder 颜色或字号：

- 微信等支持 `placeholderClass` 的小程序端使用 `login-input__placeholder`，样式位于 `index.scss` 并引用 `$color-text-placeholder` 与语义字号 token。
- H5 端使用 `.login-input input::placeholder` 后代选择器，引用同一组 token；Taro 4.2 H5 的 `Input` 会渲染内部原生 `input`。
- 不以 `placeholderStyle` 作为兜底。其他非验收平台沿用平台默认 placeholder 外观。

这样既覆盖本次验收的微信小程序和 H5，也能让静态测试明确禁止 `placeholderStyle` 回流。

## 5. 页面结构与职责

### 5.1 页面组件

`client/src/pages/login/index.tsx` 继续作为唯一页面组件，管理：

- `mode: 'login' | 'register'`
- `username`
- `password`
- `passwordVisible`
- `focusedField: 'username' | 'password' | null`
- `loading`
- `error`

页面标记按以下区域组织：

1. `login-root`：安全区、滚动和纸张背景。
2. `login-binding`：装订线和装订节点，仅作装饰。
3. `login-shell`：限制内容宽度并控制短屏布局。
4. `login-folio`：竖排页码。
5. `login-hero`：眉题、主标题和说明。
6. `login-form`：账户字段、密码字段、错误区、主按钮和模式切换。
7. `login-footer-mark`：页脚分隔线与短句。

登录与注册继续复用同一组输入字段，不创建两套表单。

### 5.2 校验模块

新增页面局部的纯函数模块 `client/src/pages/login/validation.ts`。它导出 `validateCredentials(mode, username, password)`，返回 `{ normalizedUsername, error }`，只负责：

- 规范化用户名首尾空格。
- 根据登录或注册模式返回第一个校验错误。
- 不依赖 React、Taro、API 或页面状态。

这样可以直接使用 Vitest 测试规则，同时避免为两个输入框创建不必要的 React 组件。

### 5.3 样式边界

登录页样式继续放在 `client/src/pages/login/index.scss`：

- 通过 `@use '../../styles/variables' as *;` 使用现有 SCSS token。
- 业务样式优先使用 L2 语义 token，不修改全局 token。
- 不新增裸十六进制、`rgb()`/`rgba()`/`hsl()` 颜色、内联 `font-size:px` 或未授权的裸尺寸；`background-image`、`box-shadow` 和 `border` 中的颜色也必须引用 token。
- 页面特有的账簿横线、装订线和纸张纹理保持局部作用域。
- 唯一允许的运行时 `px` 是从 `getWindowInfo()` 或 `getMenuButtonBoundingClientRect()` 得到的设备几何值；静态测试不得把它误判成视觉尺寸。
- Taro `Button` 必须在页面样式中重置平台默认的 margin、padding、line-height、background、border 和 `::after` 边框，并显式设置 `hoverClass`，避免默认 `button-hover` 污染“墨签账簿”视觉。

## 6. 数据流与交互

### 6.1 登录提交

1. 用户输入账户和密码。
2. 调用 `validateCredentials()`；有错误则直接显示，没有错误则使用返回的 `normalizedUsername`。
3. 进入 loading，清空旧错误。
4. 调用现有 `login(normalizedUsername, password)`。
5. 校验响应中存在非空字符串 token；缺失时按失败处理，显示“登录失败，请重试”，不得写入存储或跳转。
6. 成功后调用 `setToken(res.token)`。
7. 动态加载并等待 `initialSync()`。
8. 调用 `Taro.reLaunch({ url: '/pages/index/index' })`。
9. 捕获 `ApiError` 时按错误码生成稳定的页面文案：`INVALID_CREDENTIALS` 显示“用户名或密码错误”，`USERNAME_EXISTS` 显示“该用户名已被占用，请换一个”，`INVALID_INPUT` 优先显示服务端的具体中文校验消息，`NETWORK_ERROR` 显示“网络连接失败，请稍后重试”；其他错误使用服务端消息或“操作失败”兜底。`finally` 中结束 loading。

### 6.2 注册提交

注册与登录使用相同流程，仅把 API 调用替换为 `register(normalizedUsername, password)`，并在调用前执行注册规则校验。

### 6.3 模式切换

模式切换继续：

- 在登录和注册之间切换。
- 清空用户名、密码和错误。
- 重置密码可见状态。
- loading 期间禁止切换。

标题、说明、字段标签、页码、主按钮和页脚文案随模式同步变化。React 不维护额外的动画状态；视觉切换只依赖 CSS 的轻微透明度过渡，`@media (prefers-reduced-motion: reduce)` 将 transition 和 animation 设为 `none`。

### 6.4 密码可见性

密码字段右侧提供“显示/隐藏”控制：

- 默认隐藏密码。
- 切换只改变输入显示方式，不改写密码值。
- 控件具有明确状态描述和足够大的触摸区域。
- 切换登录/注册模式时恢复为隐藏。

### 6.5 键盘操作

- 微信小程序沿用 Taro `Input` 默认开启的 `adjustPosition`，不重复声明该 prop。
- `cursorSpacing` 作为微信等支持平台的键盘优化；Taro 4.2 的 H5 不支持该 prop，H5 依靠页面滚动和底部间距保证可见性。
- 密码框使用完成键语义；非 loading 状态下，`onConfirm` 触发表单提交。
- 页面可纵向滚动；软键盘出现时优先保证字段、错误区和主按钮可见。

## 7. 校验规则

规则与 `server/src/routes/auth.ts` 保持一致。

### 7.1 登录模式

- 用户名和密码不能为空。
- 用户名提交前执行 `trim()`。
- 不在客户端推断凭据是否存在或是否正确；其余错误交由服务端统一返回。

### 7.2 注册模式

- 用户名必须匹配 `^[a-zA-Z0-9_]{3,20}$`。
- 密码长度必须为 6–32 位。
- 页面标签、placeholder、辅助文案和错误文案必须与规则一致。
- 客户端校验只用于减少无效请求，服务端仍是权威校验来源；服务端规则变化时，`validation.ts` 与对应测试必须在同一变更中同步。

### 7.3 错误清理

用户修改任一字段时清除旧错误，防止已失效的错误信息持续显示。

## 8. 状态设计

### 8.1 默认状态

- 横线使用低对比墨色边框。
- placeholder 使用现有 `$color-text-placeholder` 语义色。
- 主按钮为深墨背景和和纸色文字。

### 8.2 聚焦状态

- `Input` 的 `onFocus`/`onBlur` 更新 `focusedField`，当前字段横线切换为砂金强调色；不依赖微信端不稳定的 `:focus-within`。
- 可增加极轻的背景变化，但不使用明显发光效果。
- 焦点变化不能导致布局位移。

### 8.3 错误状态

错误区位于密码字段与主按钮之间，并固定保留最小高度：

- 朱红圆点与错误文本同时出现。
- 不能只通过颜色传达错误。
- 错误始终作为密码字段后的可见 `Text` 显示，并带“错误：”语义前缀。
- 错误出现和消失不推动主按钮跳动。

覆盖：

- 必填项为空。
- 注册用户名格式不正确。
- 注册密码长度不正确。
- 用户名已被占用。
- 用户名或密码错误。
- 网络超时或服务不可用。
- 未知错误兜底。

### 8.4 Loading 状态

- 主按钮必须使用 Taro `Button` 并进入真实 disabled/loading 状态。
- 文案为“登录中…”或“注册中…”。
- 禁止重复提交、显示密码切换和模式切换。
- 页面不添加独立全屏 loading 遮罩。

### 8.5 按压状态

主按钮按压时仅使用轻微缩放或墨色变化，并遵循现有 motion token。模式切换入口使用颜色和下划线变化，不做大幅位移。

## 9. 小程序与响应式设计

1. 微信小程序为首要验收平台。
2. 顶部位置按第 4.4 节的运行时边界计算：仅在 `getMenuButtonBoundingClientRect()` 返回有效宽度时按微信胶囊定位，否则使用状态栏回退值；不再叠加 `env(safe-area-inset-top)`，避免重复计算顶部安全区。
3. 底部加入 `env(safe-area-inset-bottom)`，避免 Home Indicator 遮挡页脚。
4. 页面采用可滚动布局，不使用容易被键盘破坏的绝对垂直居中。
5. 常规屏幕保留完整品牌区和页脚；短屏使用现有 `(max-height: 720px)` 媒体查询压缩品牌区垂直间距，不新增键盘高度监听 state。
6. 内容设置合理最大宽度，H5 宽屏时保持居中，不无限拉伸。
7. 所有核心操作保持至少约 88rpx 的触摸高度或等效点击区域。
8. 不依赖 hover 才能理解或完成操作。

## 10. 无障碍

- 主提交操作使用 Taro `Button`，以可见按钮文案配合真实 `disabled` 和 `loading` 属性；不依赖仅 QQ 支持的 `ariaLabel`。
- 输入框前有独立可见标签，不只依赖 placeholder。Taro 4.2 在微信端不提供通用 label 关联能力，因此不承诺跨端不可用的 ARIA 属性。
- 显示密码控制同样使用带可见文案的轻量 `Button`，文案明确为“显示密码”或“隐藏密码”。
- 错误作为密码字段后的常驻 `Text` 区域显示，并带“错误：”语义前缀；不承诺微信端不支持的 `aria-live`。
- 装订线、纸张纹理和装订节点全部由 CSS 伪元素生成，不进入组件树；纵向页码是可见文本，允许读屏读取。
- 文本和背景保持足够对比度。
- 支持 `prefers-reduced-motion`；动画完全由 CSS 控制。

## 11. 预期文件变更

修改：

- `client/src/pages/login/index.tsx`
- `client/src/pages/login/index.scss`
- `client/test/pages-login/migration.test.ts`

新增：

- `client/src/pages/login/validation.ts`
- `client/test/pages-login/validation.test.ts`

明确不修改：

- `server/src/routes/auth.ts`
- `client/src/api/auth.ts`
- `client/src/api/client.ts`
- `client/src/utils/sync.ts`
- 全局设计 token 文件
- 根 `package.json`、`package-lock.json` 和 `scripts/install-build-patches.mjs`
- 用户当前未提交的计划文档

## 12. 测试与验证

### 12.1 自动化测试

校验函数测试覆盖：

- 登录必填校验。
- 登录模式不额外伪造服务端凭据判断。
- 注册用户名少于 3 位、超过 20 位或包含非法字符。
- 注册密码少于 6 位或超过 32 位。
- 用户名首尾空格规范化。
- 合法登录和注册输入。

设计 token 静态测试覆盖：

- SCSS 中不存在裸十六进制、`rgb()`/`rgba()`/`hsl()` 颜色，包括 `background-image`、`box-shadow` 和 `border` 声明。
- SCSS 中不存在不允许的 `font-size:px`、间距和圆角尺寸。
- TSX 中不存在 `placeholderStyle`、内联裸颜色和 `font-size:px`。
- 从窗口或胶囊 API 获得的运行时 CSS 像素被明确排除，因为它们描述设备几何而非视觉 token。

测试不引入 `@tarojs/test-utils` 或其他依赖；纯函数测试和静态文件测试已覆盖本次可自动化的范围。

工程验证从 `client/` 目录执行：

- `npx vitest run test/pages-login/`：运行校验函数和登录页静态测试。
- `npm run lint:css:strict-value`：必须以 0 条 error 退出。
- `npm run build:weapp`：完成微信小程序构建。
- `npm run build:h5`：完成 H5 构建。

### 12.2 实际页面验收

在真实页面检查：

- 登录默认态。
- 注册默认态。
- 必填、格式、服务端和网络错误。
- loading 与防重复提交。
- 显示和隐藏密码。
- 模式切换后清空状态。
- 登录成功后的同步和跳转。
- 模拟成功响应缺少 token 时停留在登录页并显示兜底错误，不写存储、不跳转。
- 微信胶囊安全区与底部安全区。
- 短屏和软键盘遮挡。
- 微信传统 WebView 下的纵向页码逐字排列，不依赖 `writing-mode`。
- H5 placeholder token 样式与 Taro `Button` 默认外观重置。
- 按压态和减少动态效果；在开发者工具中模拟 `prefers-reduced-motion: reduce`，确认登录页 transition 和 animation 均被关闭。

### 12.3 已确认的构建前置阻塞

规格复核时，未修改登录代码的当前基线已经无法启动 Taro 构建：

- `npm run build:weapp` 与 `npm run build:h5` 均在加载 Taro build 插件前失败。
- `@eslint/eslintrc@2.1.4` 声明需要 `ajv@^6.12.4`，但根 `package.json` 的 override 和当前 lockfile 让它实际解析到 `ajv@8.20.0`。
- `scripts/install-build-patches.mjs` 计划从 `node_modules/@eslint/eslintrc/node_modules/` 复制 AJV 6，但当前 lockfile 和安装结果均不存在该嵌套来源，因此补丁前提不成立。
- 该错误发生在应用代码编译之前，与登录页规格或实现无关。

登录页实现可以运行纯函数测试和严格 Stylelint，但最终验收前必须通过独立维护变更恢复 Taro 构建基线。用户已确认采用“先单独修复”路径：先完成并验证工具链维护项，再开始登录页实现。本规格不授权修改根依赖与 postinstall 补丁；未解决前，不得声称微信小程序或 H5 构建通过。

## 13. 验收标准

实现完成需同时满足：

1. 登录与注册页呈现已批准的“墨签账簿”结构：开放式账页、CSS 装订线、逐字纵向页码、账簿横线字段和深墨按钮。
2. 登录、注册、token、首次同步和首页跳转继续工作；空 token 响应不会写存储或跳转。
3. 客户端注册规则与服务端一致，并以服务端校验为权威来源。
4. 页面不包含 `placeholderStyle`、裸颜色或原有内联 `font-size:px`；装饰中的颜色同样引用 token。
5. 模式切换会清空账户、密码、错误和字段焦点，并重置密码隐藏状态；loading 期间不能重复提交、切换模式或切换密码可见性。
6. 必填、用户名格式、密码长度、凭据错误、用户名占用、网络错误和未知错误均显示稳定文案，且错误出现不会推动按钮跳动。
7. Taro `Button` 默认外观已重置；微信小程序安全区、软键盘和短屏场景可操作，H5 placeholder 与按钮样式正确。
8. `npx vitest run test/pages-login/` 与严格样式检查以零错误退出；第 12.3 节的独立工具链前置项解决后，微信小程序与 H5 构建也必须以零错误退出。
9. 登录页变更本身不修改后端认证、全局 token、`project.config.json`、根依赖/补丁脚本或用户已有未提交文档。
