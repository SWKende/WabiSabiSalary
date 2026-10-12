# Trae Salary 添加后端设计稿

> **⚠️ 已被取代（2026-10-11）：** 账号、云同步、服务端节假日代理均已下线，数据改存设备本地 SQLite。

**日期**：2026-07-02
**状态**：待用户审阅
**项目**：trae-salary（微信小程序 + Taro 4.2 + TypeScript）

---

## 1. 背景与目标

### 现状

`trae-salary` 是一个 Taro 多端工资计算器小程序，主要运行在微信端。当前架构：

- **数据全部本地**：`Taro.setStorageSync()` 存工资配置、记账条目、首页偏好
- **节假日本地打包**：`constants/cn-holiday-fallback.json` 随小程序发布
- **所有计算纯前端**：秒薪、日薪、月薪累计等

### 问题

1. 换设备或重装小程序后所有数据丢失
2. 节假日数据每年要更新版本并发布新版本
3. 没有多端数据同步能力

### 目标

引入一个轻量后端，实现：
1. **账号密码注册/登录**
2. **工资配置和记账数据云端持久化**
3. **多设备数据同步**
4. **节假日数据云端管理 + 自动同步**
5. **未来兼容 App 端**（架构上不绑定微信身份）

### 非目标（YAGNI）

- 微信一键登录（项目目前以小程序为主，但未来 App 端需要更通用身份）
- 忘记密码流程
- 社交分享 / 排行榜
- 数据导出
- 多用户协作
- 工资计算本身（纯前端数学，无需后端参与）
- 首页偏好同步（保持本地）

---

## 2. 方案对比与决策

| 维度 | 极简自托管（✅ 选） | 生产级自托管 | 全托管 BaaS |
|------|---------------------|--------------|-------------|
| 后端语言 | Node.js 20 + TS | Node.js 20 + TS | TypeScript SDK |
| 框架 | Fastify | Fastify + 集群 | Supabase/AppWrite |
| 数据库 | SQLite | PostgreSQL | 平台内置 |
| 部署 | Docker + Caddy | Docker + Caddy | 一键 |
| 运维 | 极低 | 中 | 极低 |
| 数据归属 | ✅ 自己服务器 | ✅ 自己服务器 | ❌ 第三方 |
| 费用 | 仅服务器 | 仅服务器 | 免费 + 超出 |

**选择极简自托管**的理由：单人小工具场景下 SQLite 完全够用；零 HTTPS 配置（Caddy 自动证书）；前后端 TS 一致；未来真需要可平滑迁移到 PG。

---

## 3. 架构总览

```
┌───────────────────────────────────────────────────────┐
│              微信小程序（用户设备）                     │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Taro App (React + TS)                          │  │
│  │  ├─ pages/index  ─┐                             │  │
│  │  ├─ pages/login   ─┼─► api/ 客户端模块          │  │
│  │  └─ components/   ─┘       │                    │  │
│  │         │                  ▼                    │  │
│  │   Taro Storage (缓存)    HTTPS 请求             │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────┬────────────────────────────┘
                           │ HTTPS（Caddy 自动证书）
                           ▼
┌───────────────────────────────────────────────────────┐
│              云服务器（Docker Compose）                │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Caddy (80/443)                                 │  │
│  │  - 自动申请 Let's Encrypt 证书                  │  │
│  │  - reverse_proxy app:3000                       │  │
│  └──────────────────┬──────────────────────────────┘  │
│                     ▼                                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │  App (Node.js 20 + Fastify, 3000)               │  │
│  │  - JWT 鉴权中间件                              │  │
│  │  - REST API 路由                                │  │
│  │  - Prisma ORM                                   │  │
│  │  - 节假日自动同步（启动 + 每日 03:00）          │  │
│  └──────────────────┬──────────────────────────────┘  │
│                     ▼                                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │  SQLite (./data/salary.db)                      │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### 仓库目录结构

```
trae-salary/                 ← 单一 git 仓库，三大块清晰分离
│
├── client/                  ← 💚 客户端（Taro 微信小程序）
│   ├── api/                 # 🆕 后端 API 客户端
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── config.ts
│   │   ├── entries.ts
│   │   ├── holidays.ts
│   │   └── types.ts
│   ├── pages/
│   │   ├── index/           # ✏️ 改造：本地→云端同步
│   │   └── login/           # 🆕 登录注册页
│   ├── components/
│   │   └── Bookkeeping/     # ✏️ 改造：写入时同步云端
│   ├── utils/
│   │   └── cnHoliday.ts     # ✏️ 改造：从云端拉取
│   ├── constants/
│   │   └── cn-holiday-fallback.json  # 🗑️ 删除
│   ├── app.tsx
│   ├── app.config.ts
│   ├── app.scss
│   ├── app.boot.ts
│   ├── index.html
│   ├── project.config.json
│   ├── babel.config.js
│   ├── tsconfig.json
│   ├── package.json
│   └── (dist/ 等构建产物)
│
├── server/                  ← 💙 服务端（Node.js 后端）
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── config.ts
│   │   │   ├── entries.ts
│   │   │   └── holidays.ts
│   │   ├── plugins/
│   │   │   └── auth.ts
│   │   ├── lib/
│   │   │   ├── db.ts
│   │   │   ├── jwt.ts
│   │   │   ├── password.ts
│   │   │   └── holidaySync.ts
│   │   └── types/
│   │       └── shared.ts    # 共享类型定义
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.example
│
├── deploy/                  ← 💜 部署相关
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── .env.example
│
├── docs/                    # 文档（含本 spec）
│   └── superpowers/specs/
├── data/                    # 运行时数据（gitignore）
├── .gitignore
└── README.md                # ✏️ 改写：含完整部署说明
```

**重要约束：**
- `client/` 和 `server/` 是完全独立的两个项目，各自管理自己的 `package.json` 和 `node_modules`
- `deploy/` 不包含任何应用代码，只放部署编排文件
- 共享类型（`BookkeepingEntry` 等）在 `server/src/types/shared.ts` 定义，客户端在 `client/api/types.ts` 复制一份保持同步

---

## 4. 数据模型

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

/// 用户表
model User {
  id           String    @id @default(cuid())
  username     String    @unique
  passwordHash String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  config  SalaryConfig?
  entries BookkeepingEntry[]
  
  @@map("users")
}

/// 工资配置（每个用户一份）
model SalaryConfig {
  id            String   @id @default(cuid())
  userId        String   @unique
  monthlySalary Float
  workStartHour Int
  workEndHour   Int
  payday        Int
  updatedAt     DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("salary_configs")
}

/// 记账条目
model BookkeepingEntry {
  id         String   @id @default(cuid())
  userId     String
  type       String
  amount     Float
  category   String
  note       String?
  occurredAt DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, occurredAt])
  @@map("bookkeeping_entries")
}

/// 中国节假日（按年管理）
model CnHolidayYear {
  year      Int      @unique
  holidays  String   // JSON: ["20250101", ...]
  workdays  String   // JSON: ["20250126", ...]
  source    String   @default("manual")
  note      String?
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
  
  @@map("cn_holiday_years")
}
```

### 关键设计决策

1. **cuid 主键**：不可枚举、前后端都能生成
2. **onDelete: Cascade**：删除用户时清理数据
3. **Float 而非 Decimal**：记账场景精度要求不高，与前端一致
4. **节假日按年一行**：一年才发布一次，按年管理简化表结构
5. **JSON 字符串存日期数组**：SQLite 无原生数组类型，JSON 字符串最简单

---

## 5. API 设计

### 5.1 认证机制

- 成功登录/注册返回 JWT，客户端存 `Taro.Storage`
- **Token 永不过期**（按用户要求）
- 除 `/api/auth/*` 和 `/health` 外所有接口需要 `Authorization: Bearer <token>`
- 401 错误时前端清除 token 并跳转登录页

### 5.2 统一响应格式

成功：直接返回数据对象/数组
错误：
```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "用户名或密码错误" } }
```

### 5.3 接口清单

#### 🔐 认证（无需 Token）

| 方法 | 路径 | 请求体 | 成功响应 |
|------|------|--------|----------|
| POST | `/api/auth/register` | `{ username, password }` | `{ token, user }` |
| POST | `/api/auth/login` | `{ username, password }` | `{ token, user }` |
| GET | `/api/auth/me` | — | `{ user }` |

参数约束：
- `username`：3-20 字符，`^[a-zA-Z0-9_]+$`，唯一
- `password`：6-32 字符

错误码：`USERNAME_EXISTS`、`INVALID_CREDENTIALS`、`INVALID_INPUT`

#### 💰 工资配置（需要 Token）

| 方法 | 路径 | 请求体 | 响应 |
|------|------|--------|------|
| GET | `/api/config` | — | `{ monthlySalary, workStartHour, workEndHour, payday, updatedAt }` |
| PUT | `/api/config` | `{ monthlySalary, workStartHour, workEndHour, payday }` | `{ ... }` |

行为：每个用户一份配置，PUT 是 upsert。

#### 📒 记账条目（需要 Token）

| 方法 | 路径 | 请求体/参数 | 响应 |
|------|------|------------|------|
| GET | `/api/entries?from=&to=&limit=` | query | `{ entries: [...] }` |
| POST | `/api/entries` | `{ type, amount, category, note?, occurredAt }` | `{ entry }` |
| PUT | `/api/entries/:id` | `{ type?, amount?, category?, note?, occurredAt? }` | `{ entry }` |
| DELETE | `/api/entries/:id` | — | `{ success: true }` |

字段：
- `type`：`"income" | "expense"`
- `amount`：数字，> 0
- `category`：字符串
- `note`：可选
- `occurredAt`：ISO 8601

GET 默认按 `occurredAt` 倒序，默认 `limit=500`，可选 `from`/`to` 时间范围。

#### 🗓️ 节假日（需要 Token）

| 方法 | 路径 | 参数 | 响应 |
|------|------|------|------|
| GET | `/api/holidays?years=2025,2026` | query | `{ years: [{ year, holidays, workdays }] }` |

错误码：`INVALID_YEAR`

#### 💚 健康检查（无需 Token）

| 方法 | 路径 | 响应 |
|------|------|------|
| GET | `/health` | `{ status: "ok", uptime: 123 }` |

### 5.4 同步策略

**前端逻辑：**

1. **登录/注册成功** → 跳首页 + 触发 `initialSync()`
2. **`initialSync()`** 流程：
   - GET /api/config → 写入 `Taro.Storage('salary_config')`
   - GET /api/entries（最近 90 天）→ 写入 `Taro.Storage('entries')`
   - GET /api/holidays（当前年+下一年）→ 写入 `Taro.Storage('cn_holiday_dataset_v1')`
   - 重试待同步队列
3. **用户操作时**：本地先更新（保证 UI 立即响应）→ 后台同步云端 → 失败标记待重试
4. **Token 401**：清除本地 token + 跳转登录页

**冲突处理**：
- 不做复杂合并。每条记账有 cuid，同 id 后写覆盖前写。
- 工资配置是 upsert，最后一次保存为准。

---

## 6. 节假日自动同步

### 触发时机

| 时机 | 检查范围 | 失败行为 |
|------|---------|---------|
| 应用启动 | 当前年 + 下一年 | 打印警告，不影响启动 |
| 每天 03:00 | 当前年 + 下一年 | 同上 |

### 实现要点

- 数据源：`https://timor.tech/api/holiday/year/{year}`（已有依赖）
- 缺失才拉取（用 `findUnique` 判断）
- 8 秒超时（`AbortSignal.timeout`）
- upsert 到 `CnHolidayYear`，source 标 `'sync'`
- 失败时前端 fallback 到普通周末判断

### 失败兜底

- 服务端 API 调用失败 → 日志告警 + 启动正常
- 前端 `classifyCnDate` 返回 `'unknown'` → 业务层按 `isWeekend()` 处理

---

## 7. 部署架构

### 7.1 部署目录

```
/opt/trae-salary/
├── client/                # 客户端代码（git pull 或 scp 上传）
├── server/                # 服务端代码
├── deploy/                # 部署编排
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── .env               # 由 .env.example 复制而来
├── data/
│   ├── salary.db          # SQLite 数据
│   ├── caddy_data/        # Let's Encrypt 证书
│   └── caddy_config/
└── logs/
    ├── app/
    └── caddy/
```

### 7.2 docker-compose.yml

两个服务：`app`（Node.js）和 `caddy`（反向代理），共享 `internal` 网络。`app` 通过 `expose: 3000` 仅在内部网络暴露，`caddy` 对外暴露 80/443。

### 7.3 Caddyfile

```caddyfile
your-domain.com {
    reverse_proxy app:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }
    log {
        output file /var/log/caddy/access.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}

http://your-domain.com {
    redir https://{host}{uri} permanent
}
```

### 7.4 Dockerfile（server/）

- 多阶段构建：`node:20-alpine` builder + runtime
- 启动时自动 `npx prisma migrate deploy`
- 健康检查：每 30 秒 `wget --spider http://localhost:3000/health`

### 7.5 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `JWT_SECRET` | ✅ | 用 `openssl rand -hex 32` 生成 |
| `PORT` | ❌ | 默认 3000 |
| `DATABASE_URL` | ❌ | 默认 `file:/data/salary.db` |
| `TZ` | ❌ | 默认 `Asia/Shanghai` |

前端构建时需注入：`TARO_APP_API_BASE_URL`（如 `https://salary.example.com`）

设置方式（开发）：
```bash
# client/api/client.ts 中读取
const BASE_URL = process.env.TARO_APP_API_BASE_URL || 'http://localhost:3000'
```

Taro 编译时自动将以 `TARO_APP_` 开头的环境变量注入到 `process.env`。生产构建（在 `client/` 目录下执行）：
```bash
cd client
TARO_APP_API_BASE_URL=https://salary.example.com npm run build:weapp
```

### 7.6 用户部署步骤（极简）

```bash
# 1. SSH 登录
ssh user@your-server-ip

# 2. 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登录

# 3. 上传代码到 /opt/trae-salary（包含 client/、server/、deploy/ 三个目录）

# 4. 配置环境变量和域名
cd /opt/trae-salary/deploy
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
nano Caddyfile   # 替换域名

# 5. 启动
docker compose up -d
docker compose logs -f app
```

### 7.7 数据备份

首次部署需创建备份目录：
```bash
sudo mkdir -p /backup && sudo chown $USER:$USER /backup
```

crontab 配置：
```bash
crontab -e
```

```cron
# 每天凌晨 2 点备份 SQLite，保留 30 天
0 2 * * * cp /opt/trae-salary/data/salary.db /backup/salary-$(date +\%Y\%m\%d).db && find /backup -name "salary-*.db" -mtime +30 -delete
```

恢复：
```bash
cd /opt/trae-salary/deploy
docker compose down
cp /backup/salary-YYYYMMDD.db /opt/trae-salary/data/salary.db
docker compose up -d
```

---

## 8. 前端改造

### 8.1 新增 `client/api/` 模块

- `client.ts`：fetch 封装 + JWT 注入 + 错误处理 + `ApiError` 类
- `auth.ts` / `config.ts` / `entries.ts` / `holidays.ts`：按域拆分
- `types.ts`：与后端共享类型（从 `server/src/types/shared.ts` 同步）

### 8.2 新增登录页 `client/pages/login/`

- 极简卡片 UI：用户名、密码、登录/注册按钮
- 注册成功自动登录
- 登录成功跳首页 + 触发 `initialSync()`

### 8.3 现有页面的改造点

**`client/pages/index/index.tsx`**：
- `saveConfig`：先本地后云端，失败标记待重试
- 启动时如果已登录，调用 `initialSync()`
- 401 错误处理（清除 token + 跳转）

**`client/components/Bookkeeping/`**：
- 添加/修改/删除记账时，先本地后云端
- 替换本地条目 id 为云端返回 id

**`client/utils/cnHoliday.ts`**：
- 移除 `cn-holiday-fallback.json` 引用
- 改为从云端拉取，缓存到 `Taro.Storage`

### 8.4 离线降级

| 场景 | 行为 |
|------|------|
| 网络正常 | 实时同步云端 |
| 临时断网 | 本地更新 + 标记"待同步"，下次重试 |
| 401 / Token 失效 | 清除 token + 跳转登录 |
| 首次打开无网络 | 提示"请连接网络登录" |

---

## 9. 测试策略

| 层 | 工具 | 范围 |
|----|------|------|
| 后端单元 | Vitest | `lib/password.ts`、`lib/jwt.ts`、`lib/holidaySync.ts` |
| 后端 API | Vitest + supertest-fetch | 认证、config、entries、holidays 完整接口 |
| 前端 API 客户端 | Vitest + mock | `client.ts` 的错误处理、token 注入 |
| 端到端 | 手动 | 注册→登录→改工资→记账→换设备验证 |

不追求 100% 覆盖率，核心是认证、CRUD、同步必须有测试。

---

## 10. 实施步骤（预估 12-15 小时）

| 阶段 | 内容 | 预计时间 |
|------|------|----------|
| 1 | 后端骨架（目录、Prisma、Fastify、Docker） | 1-2 小时 |
| 2 | 认证（bcrypt、JWT、注册/登录/me） | 1 小时 |
| 3 | 业务接口（config、entries、holidays） | 2 小时 |
| 4 | 节假日自动同步 | 30 分钟 |
| 5 | 前端 API 客户端 | 1 小时 |
| 6 | 登录页 | 1 小时 |
| 7 | 改造现有页面（工资、记账、节假日） | 2-3 小时 |
| 8 | 初始同步 + 重试机制 | 1 小时 |
| 9 | README 编写 | 30 分钟 |
| 10 | 端到端验证 + 部署到云服务器 | 1 小时 |

---

## 11. README 大纲

1. 项目介绍 + 功能特性
2. 项目结构（突出 `client/`、`server/`、`deploy/` 三大块）
3. **本地开发**
   - 前端：`cd client && npm install && npm run dev:weapp`
   - 后端：`cd server && npm install && npx prisma migrate dev && npm run dev`
4. **部署到云服务器**（生产环境，步骤化）
   - 前提条件（服务器、域名、DNS）
   - 安装 Docker
   - 上传代码到 `/opt/trae-salary`（含 client/、server/、deploy/）
   - `cd deploy && cp .env.example .env`，配置 `JWT_SECRET` 和 Caddyfile 域名
   - `docker compose up -d`
   - 构建小程序：`cd ../client && TARO_APP_API_BASE_URL=https://你的域名 npm run build:weapp`
   - 用微信开发者工具上传发布
5. **运维**（状态查看、重启、升级、备份、恢复、节假日日志）
6. **常见问题**（忘记密码、数据丢失、换域名、证书失败、客户端如何切换 API 地址）
7. 技术栈列表

---

## 12. 风险与权衡

| 风险 | 缓解措施 |
|------|---------|
| SQLite 单点故障 | 每日定时备份到独立目录，保留 30 天 |
| Caddy 证书申请失败 | README 列出排查清单（端口、DNS） |
| timor.tech 节假日 API 挂掉 | 8s 超时 + 失败 fallback + 不影响启动 |
| 单机性能上限 | 当前是单人工具，~100 QPS 足够；未来需要可迁 PG |
| 客户端 API base URL 硬编码 | 通过构建环境变量 `TARO_APP_API_BASE_URL` 注入 |
| Token 不过期 → 设备丢失无法远程失效 | 用户接受此权衡 |

---

## 13. 最终决策汇总

| 项 | 选择 |
|----|------|
| 动机 | 多设备数据同步/备份 |
| 登录 | 账号 + 密码（无忘记密码） |
| 部署 | 云服务器 + Docker + Caddy（自动 HTTPS） |
| 后端技术 | Node.js 20 + Fastify + Prisma + SQLite + JWT（无过期） |
| 节假日 | 数据库 + 启动时/每日 03:00 自动同步 |
| 工资计算 | 纯前端本地 |
| 首页偏好 | 纯前端本地 |
| API 风格 | REST + JSON + 统一错误格式 |
| 同步策略 | 启动拉取 + 操作时实时推送 |
| 文档 | 完整 README（部署 + 运维 + FAQ） |

---

## 附录 A：共享类型定义

```typescript
export interface User {
  id: string
  username: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface SalaryConfig {
  monthlySalary: number
  workStartHour: number
  workEndHour: number
  payday: number
  updatedAt?: string
}

export type EntryType = 'income' | 'expense'

export interface BookkeepingEntry {
  id: string
  type: EntryType
  amount: number
  category: string
  note?: string
  occurredAt: string  // ISO 8601
  createdAt: string
  updatedAt: string
}

export interface HolidayYearData {
  year: number
  holidays: string[]  // YYYYMMDD
  workdays: string[]
}

export interface ApiError {
  code: string
  message: string
}
```