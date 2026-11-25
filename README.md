# 记账

一个面向安卓的**纯本地记账工具**，打开即进入账本。

**没有后端，没有账号，没有云同步。** 数据存在手机本地的 SQLite 里，断网可用。

## 功能特性

- 记录与编辑收入、支出，支持分类、日期和备注
- 查看本月收支、近 7 日柱状图、月度趋势和分类占比
- 在记账设置里导出或导入 JSON 备份

## 技术栈

| 层 | 选型 |
|---|---|
| 界面 | Taro 4.2 + React 18 + TypeScript + SCSS（H5 target） |
| 容器 | Capacitor 8（WebView 壳，Android） |
| 存储 | `@capacitor-community/sqlite`（设备本地 SQLite） |
| 出包 | GitHub Actions（JDK 21 + Android SDK + Gradle） |

转型的取舍与依据记录在 `docs/superpowers/plans/2026-10-11-android-local-app.md`。

## 目录结构

```
trae-salary/
├── client/
│   ├── src/
│   │   ├── pages/index/       记账首页与设置
│   │   ├── components/        记账面板、图表、数字键盘、日期选择
│   │   ├── utils/store.ts     本地数据仓库：内存读 + 异步写队列
│   │   ├── utils/db.ts        SQLite 后端与 storage 兜底后端
│   │   ├── utils/backup.ts    账本备份与恢复
│   │   └── styles/            三层 design token（L1 原语 / L2 语义 / L3 组件）
│   ├── assets/icon-source.png 图标与启动图源文件
│   ├── android/               Capacitor 生成的安卓工程（已入库）
│   └── capacitor.config.ts
├── docs/superpowers/          设计与实施文档
└── .github/workflows/         云端构建
```

## 一、本地开发

```bash
npm install
cd client
npm run dev:h5
```

起完直接访问终端打印的两个地址，存盘即自动重编译并刷新页面（webpack-dev-server 自带，不需要再另起静态服务器）：

| 地址 | 怎么看 |
| --- | --- |
| `http://localhost:10086` | 电脑上开，浏览器设备模拟调到 390px 宽 |
| `http://<本机局域网IP>:10086` | 手机连同一个 WiFi 直接用系统浏览器开，摸真实屏幕宽度 |

路由是 hash 形式，首页为 `http://localhost:10086/#/pages/index/index`。

### H5 预览能覆盖什么、不能覆盖什么

React 代码、SCSS、store 上层 API 完全同一套，界面与交互逻辑都能直接看到；差别只在容器：

| | H5 预览 | 真机 APK |
| --- | --- | --- |
| 存储后端 | localStorage（`store.ts` 的 storage 兜底驱动） | `@capacitor-community/sqlite` |
| 导出备份 | 浏览器下载或分享 | 系统分享面板 |
| 字体 | 电脑字体 | 安卓系统字体（明朝体会被顶掉） |
| 状态栏 / 安全区 / 返回手势 | 无 | 有 |

改动一旦涉及 SQLite、Capacitor 插件、图标/启动图、原生返回键行为，H5 预览不能代替真机，走[第二节](#二出-apk)出包回装。

### 校验命令

```bash
cd client
npm run typecheck                    # tsc --noEmit
npm run lint                         # stylelint 严格值守卫
npm test                             # vitest（含 store 单测）+ node:test
npm run test:store                   # 只跑存储层测试
```

### Design Tokens

三层 Token 体系（Primitive → Semantic → Component）集中在 `client/src/styles/`。业务 SCSS 一律通过 `@use '@/styles/variables' as *;` 取 token，不写裸 hex / px 字号 / px 间距 / px 圆角；尺寸单位用 `rpx`（Taro 750 稿基线）。

```scss
@use '@/styles/variables' as *;

.my-card {
  padding: $space-card-padding-md;
  background: $color-bg-surface;
  border-radius: $radius-md;
  font-size: $font-body-md;
}
```

守卫由 `.github/workflows/android.yml` 的 verify job 执行：`npm run lint`（strict-value）与 `npm test` 任一失败即不出包。`src/pages/index/index.scss` 与 `src/components/Bookkeeping/index.scss` 因存量字面量在 `.stylelintrc.strict-value.yml` 中整文件豁免，属在途债务。

## 二、出 APK

### 方式 A：云端构建（推荐，本机不需要 Android 环境）

推送到 GitHub 后，Actions 会自动跑 `verify → apk`；也可在 Actions 页面点 **Run workflow** 手动触发。几分钟后在运行记录的 Artifacts 里下载 `WabiSabiBookkeeping-debug-apk`，解压得到 `app-debug.apk`，传到手机安装即可。

### 方式 B：本机构建

需要先装好 JDK 21 与 Android SDK（最省事的方式是安装 Android Studio），然后：

```bash
cd client
npm run android:apk        # build:h5 → cap sync android → gradlew assembleDebug
# 产物：client/android/app/build/outputs/apk/debug/app-debug.apk
```

连了真机时可以直接装：

```bash
cd client && npm run build:android && npm run android:install
```

改了前端代码后必须重新 `cap sync`，否则安卓工程里还是旧的 web 产物（`npm run build:android` 已包含这一步）。

### 关于安装提示

debug 包未签名上架，安装时系统会提示「来自未知来源」，允许即可。要做成可长期使用的 release 包，需要自己的 keystore：生成后把 `KEYSTORE_BASE64`、`KEYSTORE_PASSWORD`、`KEY_ALIAS`、`KEY_PASSWORD` 配到仓库 Secrets，并在 `client/android/app/build.gradle` 里接上 `signingConfigs`。

## 三、数据与备份

真机继续沿用原 Android 包名和 SQLite 库名，使用相同签名覆盖安装可保留账目。数据库内的 `entries` 保存记账条目，`meta` 保存设置。

- 卸载应用或清除应用数据 = 数据丢失，Android 的系统备份不会替你导出。
- 点首页右下角齿轮，进入「数据备份」。导入前会提示确认，确认后将覆盖当前账目和记账设置。
- 兼容旧版「工资时钟」导出的 JSON，只恢复账目和记账设置，不恢复已下线的功能配置。
- 从更早的版本升级时，SQLite 首次建库会自动迁移 localStorage/Taro storage 中的账目与记账设置。

## 四、常见问题

**Q：为什么字体在某些手机上不是明朝体？**
SCSS 只声明了 `font-family: 'Noto Serif SC', 'Shippori Mincho B1', ...`，没有内嵌字体，实际取决于系统是否装了这些字体。要稳定需要 `@font-face` 内嵌子集，尚未做。

**Q：微信里打开的 H5 和小程序还能用吗？**
构建脚本已收敛到安卓与 H5，小程序端插件已移除；`client/dist` 现在是 H5 产物目录，供 Capacitor 打包。

**Q：记账记错了想改？**
点击「最近記錄」中的条目即可编辑。

## 五、已知缺口

- 明朝体字体内嵌
