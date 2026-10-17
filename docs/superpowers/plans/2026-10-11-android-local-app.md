# 安卓本地 App 化 实施计划（去后端 + SQLite + Capacitor）

**日期：** 2026-10-11
**状态：** 代码与工程已完成，等待 GitHub 仓库与首次云端构建
**取代：** `2026-07-02-add-backend.md`、`2026-07-02-add-backend-design.md`（后端与云同步能力整体下线）

**Goal:** 把 trae-salary 从「微信小程序 + 自建后端云同步」转型为**可安装在安卓手机上的纯本地 App**：数据存在设备本地 SQLite，不依赖任何服务端。

**Tech Stack:** Taro 4.2（H5 target）+ React 18 + TypeScript + SCSS → Capacitor 8 安卓壳 → `@capacitor-community/sqlite` 本地库 → GitHub Actions 云端构建 APK。

---

## 1. 为什么是这条路

三个候选方案与实测依据：

| 方案 | 结论 | 依据 |
|---|---|---|
| Taro `build:rn`（React Native） | **否决** | RN 无 CSS 层。项目有 3573 行 SCSS，其中 `::before/::after` 14 处、`:active` 25、`@keyframes` 19、`animation` 23、`transition` 25、`transform` 42、`position: fixed` 9、渐变 8、`box-shadow` 5、`letter-spacing` 76 —— 视觉层等于全部重写，而侘寂时钟的视觉正是产品本体。且 `@tarojs/rn-runner` 未安装，Taro 4.x 的 RN 链路活跃度明显低于 Expo。 |
| Expo / RN 原生重写 | 备选，成本最高 | 逻辑层（`api/`、`sync.ts`、`validation.ts`、`cnHolidayCore`）可平移，但 UI 与样式要重画，2–4 周。 |
| **Taro H5 产物 + Capacitor 套壳** | **采用** | 已实测：`npm run build:h5` 编译通过，产物在本地静态服务器 + 后端环境下完整跑通（每秒工资跳动、今日进度、发薪倒计时、记账增删、柱状/饼图），视觉 100% 复用。当时把 37 条 Taro「暂时不支持 API」当成了无害警告，见下方更正。 |

**跨端依赖面实测：** 全项目只用 15 个 Taro API，唯一小程序专属是 `Taro.getMenuButtonBoundingClientRect`；组件只用 View / Text / Input / Button / ScrollView / Image，**没有 Canvas**（两个图表是纯 View + CSS 画的）。

> 更正（2026-10-15，H5 预览实测）：原先记的「3 处调用均已有 `statusBarHeight` 兜底」是错的。该 API 在 H5 里返回的是**被 reject 的 Promise**，`try/catch` 抓不到，于是每次渲染抛一条未处理拒绝（导航栏每秒重渲染一次 → 1 条/秒），且 `statusBarHeight` 在 H5 取到 `NaN`，`height: NaNpx` 被浏览器整条丢弃。既然安卓壳和浏览器都不存在微信胶囊，这条适配已连同 `utils/window.ts` 一起删除，由 `test/components-custom-nav-bar/no-miniprogram-api.test.ts` 守住不回退。

## 2. 关键判断

1. **项目本来就是本地优先。** 数据全部落在设备本地（`bookkeeping_records` / `salary_config` / `bookkeeping_settings` / `cn_holiday_dataset_v1`），后端只是「登录后多同步一份」，`api.getToken()` 为空时全走本地。API 耦合点仅 12 处、集中在 3 个文件。所以下线后端是**拆增强层，不是拆承重墙**。
2. **节假日不需要后端。** `cnHoliday.ts` 本来就有四级降级：本地缓存 → 云端 → **直连 timor.tech** → 空集兜底。第三级就是无后端路径。Taro H5 的 `request` 走 XMLHttpRequest，Capacitor 的原生 HTTP 层（`CapacitorHttp`）会接管它，因此 WebView 内访问 timor.tech 不受 CORS 限制。另外把 2026 年数据（33 节假日 / 6 补班，已从 timor.tech 实拉验证）内置为静态兜底，断网也能正确判断工作日。
3. **SQLite 用「内存读 + 异步写」适配层。** 现有 UI 全是同步 `getStorageSync` 读取，若改成到处 await 会把 1092 行的 index.tsx 搅乱。方案：启动时 `bootstrapStore()` 把 meta 表与 entries 表读进内存，同步读走内存，写入进异步队列落 SQLite。UI 代码结构基本不动。
4. **浏览器里保留 localStorage 兜底驱动。** 同一套 store API，原生走 SQLite、纯浏览器开发走 Taro storage，这样不装 Android 环境也能日常开发与测试。

## 3. 文件结构

```
删除：server/                     Fastify + Prisma + 全部后端测试
删除：deploy/                     Docker Compose + Caddy
删除：scripts/e2e-client-vs-server.mjs
删除：client/src/api/             REST 客户端
删除：client/src/utils/sync.ts    云同步与重试队列
删除：client/src/pages/login/     账号墙

新增：client/src/utils/db.ts            SQLite 驱动 + 建表 + 兜底驱动
新增：client/src/utils/store.ts         内存读 / 异步写队列 / 旧数据迁移
新增：client/src/utils/holidaySeed.ts   2026 节假日静态兜底
新增：client/capacitor.config.ts        webDir / androidScheme / CapacitorHttp
新增：client/android/                   Capacitor 生成的安卓工程（提交入库供 CI 构建）
新增：.github/workflows/android.yml     JDK 21 + Android SDK → assembleDebug → artifact
```

## 4. 数据模型

```sql
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, amount REAL NOT NULL,
  category TEXT NOT NULL, note TEXT, occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entries_occurred ON entries(occurred_at DESC);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);
```

`meta` 存 `salary_config` / `bookkeeping_settings` / `home_page` / `cn_holiday_dataset_v1`；`entries` 存记账条目。首次启动若表为空且存在旧 Taro storage 数据，自动迁移。

## 5. 验收标准

- `npm run test:all`（client vitest + node:test + stylelint strict-value）全绿，且新增 store 测试覆盖 CRUD / 写队列 / 迁移 / 降级。
- `npm run build:h5` 通过；浏览器实测：记一笔 → 刷新 → 数据仍在；改工资配置 → 刷新 → 仍在；无网络时节假日判定仍正确。
- GitHub Actions 产出可安装 APK，手机上装完能记账、能看每秒工资。
- 仓库内不再有任何指向后端的代码路径；README 不再有部署/云同步/Caddy 章节。

## 6. 实施状态（2026-10-12）

**已完成并验证：**

- 后端下线：`server/`、`deploy/`、`scripts/e2e-client-vs-server.mjs`、`client/src/api/`、`utils/sync.ts`、`pages/login/` 全部删除；`app.config.ts` 只剩 index 页；`index.tsx` / `Bookkeeping` / `cnHoliday` 里的 12 处 API 耦合清零。
- 存储层：`utils/db.ts`（PersistBackend + SQL 后端 + storage 兜底后端 + 原生探测）与 `utils/store.ts`（内存读 + 串行写队列 + 首次迁移 + 失败降级）。新增 26 个测试（`test/store/`），全库 vitest 76 通过、node:test 7 通过。
- 顺手修掉的历史债：`tsconfig.json` 缺 `dom` lib 导致 3 个 tsc 报错（现在 0 error）；`src/app.boot.ts` 是模板遗留死代码（Taro H5 运行时自行挂载），已删。
- Capacitor：`capacitor.config.ts`、`client/android/` 工程已生成并 `cap sync`，SQLite 插件注册成功；图标与启动图按侘寂时钟语言生成并铺满 5 个密度（底色归一到 #f5f0e8，与 App 背景一致）。
- 依赖收敛：移除 7 个平台插件与 `escape-html`，`workspaces` 只剩 client；`npm ci` 一致性已预检。
- 无后端实跑验证：`build:h5` 产物在浏览器中冷启动 → 记账两条 → 刷新后「本月收支 -41.00 / 两条记录」仍在；节假日成功直连 timor.tech 并缓存 2026–2028；控制台 0 error（仅小程序专属 API 的降级警告）。
- 样式守卫：`stylelint strict-value` 全绿。

**待办（需要作者本人动作）：**

1. 建 GitHub 仓库并推送（本机无 `gh`、keychain 无 GitHub 凭据），首次 Actions 构建出 debug APK。
2. 装机后验证三件这里测不了的事：SQLite 真机建库与读写、WebView 里每秒数字的流畅度、明朝体是否被系统字体顶掉。
3. 下一轮功能：记账条目的编辑入口（`store.updateRecord` 已就绪，缺 UI）、数据导出备份、明朝体字体内嵌。

## 7. 已知遗留（本轮不做，记录在案）

- 明朝体（Noto Serif SC / Shippori Mincho B1）目前只声明 `font-family` 依赖设备字体，未内嵌字体子集；安卓上若回退到无衬线黑体，需另开一轮 `@font-face` + 子集化。
- 记账条目「编辑」能力（改金额/分类）在云同步时代就没接 UI，本轮 SQLite 化时顺带把 store 层做成支持 update，UI 入口留作下一轮。
- WebView 每秒刷新的性能与原生有差距，装机后实测若不满意再考虑把数字区改成 `requestAnimationFrame` 节流。
- `client/config/index.js` 的 `outputRoot: 'dist'` 为全平台共用；本轮删掉非安卓构建脚本，避免 weapp 产物覆盖 h5。
