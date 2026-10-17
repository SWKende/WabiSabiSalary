# 工资时钟（Salary Clock）

一个装在安卓手机上的**纯本地**工资计算器与记账工具：打开就能看见今天赚了多少、离发薪还有多久，偶尔记一笔开销。

**没有后端，没有账号，没有云同步。** 数据存在手机本地的 SQLite 里，断网可用。

## 功能特性

- 实时计算每秒工资、日薪、月薪
- 工资明细、发薪日倒计时、今日进度可视化
- 记账：分类、备注、近 7 日柱状图、月度趋势、分类占比
- 中国节假日与调休识别（直连 timor.tech 更新，内置静态数据兜底）
- 全部数据本地存储，卸载即清空

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
│   │   ├── pages/index/       首页（工资时钟 + 记账，单页双模块）
│   │   ├── components/        记账面板、图表、数字键盘、日期选择、导航栏
│   │   ├── utils/store.ts     本地数据仓库：内存读 + 异步写队列
│   │   ├── utils/db.ts        SQLite 后端与 storage 兜底后端
│   │   ├── utils/cnHoliday.ts 节假日：缓存 → timor.tech → 内置兜底
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
| 节假日请求 | 浏览器直连 timor.tech，被 CORS 挡时走内置 seed | CapacitorHttp 代发 |
| 字体 | 电脑字体 | 安卓系统字体（明朝体会被顶掉） |
| 状态栏 / 安全区 / 返回手势 | 无 | 有 |

设置面板底部的临时诊断行会打印当前后端（`本地库 sqlite` 或 `本地库 storage`），一眼分清两种环境。

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

推送到 GitHub 后，Actions 会自动跑 `verify → apk`；也可在 Actions 页面点 **Run workflow** 手动触发。几分钟后在运行记录的 Artifacts 里下载 `salary-clock-debug-apk`，解压得到 `app-debug.apk`，传到手机安装即可。

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

真机上数据在应用私有目录的 SQLite 文件 `salary-clock.db`（表：`entries` 记账条目、`meta` 配置与节假日缓存）。

- 卸载应用或清除应用数据 = 数据丢失，Android 的系统备份不会替你导出。
- 备份方式：用文件管理器把上述 db 文件拷出，或后续在设置面板加一个导出入口（尚未实现，见「已知缺口」）。
- 从旧版（有过后端的那版）升级时，`store.ts` 会在库为空时把 localStorage/Taro storage 里的旧记录与配置自动迁移进 SQLite。

## 四、常见问题

**Q：不联网能判断节假日吗？**
能。首次联网会拉取并缓存当年与未来两年；拉不到时用 `client/src/utils/holidaySeed.ts` 里的内置数据（当前含 2026 年 33 天节假日 / 6 天补班），再兜不住就按普通周末处理。每年国务院公告发布后往 `HOLIDAY_SEED` 补一份下一年即可。

**Q：为什么字体在某些手机上不是明朝体？**
SCSS 只声明了 `font-family: 'Noto Serif SC', 'Shippori Mincho B1', ...`，没有内嵌字体，实际取决于系统是否装了这些字体。要稳定需要 `@font-face` 内嵌子集，尚未做。

**Q：微信里打开的 H5 和小程序还能用吗？**
构建脚本已收敛到安卓与 H5，小程序端插件已移除；`client/dist` 现在是 H5 产物目录，供 Capacitor 打包。

**Q：记账记错了想改？**
目前只能删除重记。存储层的 `updateRecord` 已经实现并有测试，缺的是表单里的编辑入口。

## 五、已知缺口

- 记账条目的编辑入口（存储层已支持）
- 数据导出 / 备份 UI
- 明朝体字体内嵌
- WebView 每秒刷新的性能与原生仍有差距，装机后视手感决定是否改节流
