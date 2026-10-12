# Trae Salary 添加后端 Implementation Plan

> **⚠️ 已被取代（2026-10-11）：** 后端与云同步能力整体下线，项目转为纯本地安卓 App。见 `2026-10-11-android-local-app.md`。本文件保留作历史决策记录，`server/` 与 `deploy/` 目录已删除，可从 git 历史找回。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 为 trae-salary 项目添加 Node.js 后端，实现账号密码登录、工资配置/记账条目云端同步、节假日云端管理 + 自动同步；通过 Docker + Caddy 一键部署到云服务器。

**Architecture:** 单一 git 仓库，目录分为 `client/`（Taro 小程序）、`server/`（Node.js + Fastify + Prisma + SQLite）、`deploy/`（Docker Compose + Caddy）。前后端通过 REST + JSON + JWT 通信。节假日数据由服务端启动时和每日 03:00 自动从 timor.tech 同步。

**Tech Stack:**
- 前端：Taro 4.2 + React 18 + TypeScript
- 后端：Node.js 20 + Fastify 4 + Prisma 5 + SQLite + JWT + bcrypt
- 部署：Docker + Docker Compose + Caddy 2（自动 HTTPS）
- 测试：Vitest + supertest-fetch

**Spec 参考：** `docs/superpowers/specs/2026-07-02-add-backend-design.md`

---

## 文件结构总览

```
trae-salary/
├── client/                              # 前端
│   ├── api/                             # 🆕 后端 API 客户端
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── config.ts
│   │   ├── entries.ts
│   │   ├── holidays.ts
│   │   └── types.ts
│   ├── pages/
│   │   ├── index/                       # ✏️ 改造
│   │   └── login/                       # 🆕
│   ├── components/Bookkeeping/          # ✏️ 改造
│   ├── utils/
│   │   ├── cnHoliday.ts                 # ✏️ 改造
│   │   └── sync.ts                      # 🆕
│   ├── app.tsx                          # ✏️ 改造
│   ├── app.config.ts                    # ✏️ 改造
│   └── (其他现有文件)
├── server/                              # 后端
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── config.ts
│   │   │   ├── entries.ts
│   │   │   └── holidays.ts
│   │   ├── plugins/auth.ts
│   │   ├── lib/
│   │   │   ├── db.ts
│   │   │   ├── jwt.ts
│   │   │   ├── password.ts
│   │   │   └── holidaySync.ts
│   │   └── types/shared.ts
│   ├── tests/
│   │   ├── helpers.ts
│   │   ├── password.test.ts
│   │   ├── jwt.test.ts
│   │   ├── auth.test.ts
│   │   ├── config.test.ts
│   │   ├── entries.test.ts
│   │   ├── holidays.test.ts
│   │   └── holidaySync.test.ts
│   ├── prisma/schema.prisma
│   ├── prisma/migrations/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── Dockerfile
├── deploy/                              # 部署
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── .env.example
├── data/                                # gitignore
└── README.md                            # ✏️ 改写
```

---

## 任务列表

| # | 任务 | 预估 |
|---|------|------|
| 1 | server 项目初始化 | 30 分钟 |
| 2 | Prisma schema 和迁移 | 20 分钟 |
| 3 | 密码哈希 + JWT 工具（TDD） | 30 分钟 |
| 4 | Fastify 入口 + 健康检查 | 20 分钟 |
| 5 | 认证路由 + 鉴权中间件（TDD） | 1 小时 |
| 6 | 工资配置路由（TDD） | 30 分钟 |
| 7 | 记账条目路由（TDD） | 1 小时 |
| 8 | 节假日路由（TDD） | 30 分钟 |
| 9 | 节假日自动同步（TDD） | 30 分钟 |
| 10 | Docker 化 | 1 小时 |
| 11 | 搬迁前端代码到 client/ | 30 分钟 |
| 12 | 前端 API 客户端（TDD） | 1 小时 |
| 13 | 登录页 | 1 小时 |
| 14 | 工资配置同步改造 | 1 小时 |
| 15 | 记账同步改造 | 1 小时 |
| 16 | 节假日云端化改造 | 30 分钟 |
| 17 | 初始同步 + 重试机制 | 1 小时 |
| 18 | README 改写 | 30 分钟 |
| 19 | 端到端验证 + 部署 | 1 小时 |

---

## Task 1: server 项目初始化

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `server/.gitignore`
- Create: `server/src/index.ts`

- [x] **Step 1: 创建 server/package.json**

```json
{
  "name": "trae-salary-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.1",
    "@prisma/client": "^5.18.0",
    "bcrypt": "^5.1.1",
    "fastify": "^4.28.1",
    "jsonwebtoken": "^9.0.2",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.14.13",
    "@types/node-cron": "^3.0.11",
    "pino-pretty": "^11.2.2",
    "prisma": "^5.18.0",
    "supertest-fetch": "^1.5.0",
    "tsx": "^4.16.5",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [x] **Step 2: 创建 server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [x] **Step 3: 创建 server/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
})
```

- [x] **Step 4: 创建 server/.gitignore**

```
node_modules/
dist/
.env
*.log
data/*.db
data/*.db-journal
```

- [x] **Step 5: 创建最小入口 server/src/index.ts**

```typescript
console.log('trae-salary-server starting...')
```

- [x] **Step 6: 安装依赖**

```bash
cd server && npm install
```

Expected: 安装成功，无错误。如果 bcrypt 安装失败，可能需要 `npm rebuild bcrypt`（在 macOS 上通常无需操作）。

- [x] **Step 7: 验证 TypeScript 能编译**

```bash
cd server && npx tsc --noEmit
```

Expected: 无错误输出。

- [x] **Step 8: 运行入口确认环境正常**

```bash
cd server && npx tsx src/index.ts
```

Expected: 输出 `trae-salary-server starting...`，按 Ctrl+C 退出。

- [x] **Step 9: 提交**

```bash
git add server/
git commit -m "feat(server): initialize server project with TypeScript + Vitest"
```

---

## Task 2: Prisma schema 和迁移

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/.env`
- Create: `server/.env.example`

- [x] **Step 1: 创建 server/.env.example**

```bash
# 必填：JWT 签名密钥（用 openssl rand -hex 32 生成）
JWT_SECRET=please-generate-with-openssl-rand-hex-32

# 可选
PORT=3000
DATABASE_URL=file:./data/salary.db
TZ=Asia/Shanghai
```

- [x] **Step 2: 创建 server/.env（开发用）**

```bash
JWT_SECRET=dev-secret-please-replace-in-production-with-openssl-rand
PORT=3000
DATABASE_URL=file:./data/salary.db
TZ=Asia/Shanghai
```

- [x] **Step 3: 创建 server/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

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

model CnHolidayYear {
  year      Int      @unique
  holidays  String
  workdays  String
  source    String   @default("manual")
  note      String?
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
  
  @@map("cn_holiday_years")
}
```

- [x] **Step 4: 创建 data 目录并执行首次迁移**

```bash
cd server && mkdir -p ../data && npx prisma migrate dev --name init
```

Expected:
- 创建 `server/prisma/migrations/{timestamp}_init/migration.sql`
- 自动执行 `prisma generate`
- 提示创建数据库文件 `server/data/salary.db`

注意：SQLite 文件实际会创建在 `server/data/salary.db`（相对 prisma/schema.prisma 的路径）。生产部署时我们用绝对路径 `/data/salary.db`。

- [x] **Step 5: 验证 schema 正确**

```bash
cd server && npx prisma db pull --print
```

Expected: 输出当前数据库结构，与 schema.prisma 一致。

- [x] **Step 6: 提交**

```bash
git add server/prisma/ server/.env.example server/.env
git commit -m "feat(server): add Prisma schema with initial migration"
```

注意：`.env` 已在 .gitignore 中，不会被提交。如需共享环境变量模板，提交 `.env.example`。

---

## Task 3: 密码哈希 + JWT 工具（TDD）

**Files:**
- Create: `server/src/lib/password.ts`
- Create: `server/src/lib/jwt.ts`
- Create: `server/tests/password.test.ts`
- Create: `server/tests/jwt.test.ts`

### 子任务 3a: 密码哈希

- [x] **Step 1: 写失败测试 server/tests/password.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../src/lib/password.js'

describe('password', () => {
  it('hashes and verifies the correct password', async () => {
    const hash = await hashPassword('hello123')
    expect(hash).not.toBe('hello123')
    expect(hash.length).toBeGreaterThan(20)
    
    const ok = await verifyPassword('hello123', hash)
    expect(ok).toBe(true)
  })

  it('rejects incorrect password', async () => {
    const hash = await hashPassword('hello123')
    const ok = await verifyPassword('wrong', hash)
    expect(ok).toBe(false)
  })

  it('produces different hashes for the same input (salt)', async () => {
    const hash1 = await hashPassword('same')
    const hash2 = await hashPassword('same')
    expect(hash1).not.toBe(hash2)
  })
})
```

- [x] **Step 2: 运行测试确认失败**

```bash
cd server && npm test
```

Expected: FAIL with "Cannot find module '../src/lib/password.js'" 或类似 import 错误。

- [x] **Step 3: 实现 server/src/lib/password.ts**

```typescript
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

- [x] **Step 4: 运行测试确认通过**

```bash
cd server && npm test
```

Expected: password 测试组 3/3 PASS。

- [x] **Step 5: 提交**

```bash
git add server/src/lib/password.ts server/tests/password.test.ts
git commit -m "feat(server): add password hash/verify utility with bcrypt"
```

### 子任务 3b: JWT

- [x] **Step 6: 写失败测试 server/tests/jwt.test.ts**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { signToken, verifyToken } from '../src/lib/jwt.js'

describe('jwt', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-jest-suite'
  })

  it('signs and verifies a token', () => {
    const token = signToken({ userId: 'u1', username: 'alice' })
    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3)
    
    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload?.userId).toBe('u1')
    expect(payload?.username).toBe('alice')
  })

  it('returns null for invalid token', () => {
    expect(verifyToken('invalid.token.here')).toBeNull()
  })

  it('returns null for token signed with different secret', () => {
    process.env.JWT_SECRET = 'secret-a'
    const token = signToken({ userId: 'u2', username: 'bob' })
    
    process.env.JWT_SECRET = 'secret-b'
    expect(verifyToken(token)).toBeNull()
    
    process.env.JWT_SECRET = 'test-secret-for-jest-suite'
  })
})
```

- [x] **Step 7: 运行测试确认失败**

```bash
cd server && npm test
```

Expected: jwt 测试组 FAIL with "Cannot find module"。

- [x] **Step 8: 实现 server/src/lib/jwt.ts**

```typescript
import jwt from 'jsonwebtoken'

export interface JwtPayload {
  userId: string
  username: string
}

function getSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret())
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret())
    if (typeof decoded === 'string') return null
    if (typeof decoded.userId !== 'string' || typeof decoded.username !== 'string') return null
    return { userId: decoded.userId, username: decoded.username }
  } catch {
    return null
  }
}
```

注意：按用户要求，token 不设过期时间（永不过期）。

- [x] **Step 9: 运行测试确认通过**

```bash
cd server && npm test
```

Expected: 全部测试 PASS（password 3 个 + jwt 3 个）。

- [x] **Step 10: 提交**

```bash
git add server/src/lib/jwt.ts server/tests/jwt.test.ts
git commit -m "feat(server): add JWT sign/verify utility (no expiration)"
```

---

## Task 4: Fastify 入口 + 健康检查

**Files:**
- Create: `server/src/index.ts` (替换 Task 1 的最小入口)
- Create: `server/src/lib/db.ts`

- [x] **Step 1: 创建 Prisma client 单例 server/src/lib/db.ts**

```typescript
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})
```

- [x] **Step 2: 重写 server/src/index.ts 加入 Fastify 和健康检查**

```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { prisma } from './lib/db.js'

const PORT = Number(process.env.PORT ?? 3000)

async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'development' 
      ? { transport: { target: 'pino-pretty' } }
      : true,
  })

  await app.register(cors, { origin: true })

  // 健康检查
  app.get('/health', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { status: 'ok', uptime: process.uptime() }
    } catch (err) {
      app.log.error({ err }, 'health check failed')
      return { status: 'degraded', uptime: process.uptime() }
    }
  })

  return app
}

async function main() {
  const app = await buildApp()
  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`server listening on :${PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [x] **Step 3: 验证启动**

```bash
cd server && npx tsx src/index.ts
```

Expected: 输出 `server listening on :3000`。

- [x] **Step 4: 在另一个终端测试健康检查**

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok","uptime":0.xxx}` 或类似 JSON。

- [x] **Step 5: 停止服务器（Ctrl+C）**

- [x] **Step 6: 提交**

```bash
git add server/src/index.ts server/src/lib/db.ts
git commit -m "feat(server): add Fastify app with health check endpoint"
```

---

## Task 5: 认证路由 + 鉴权中间件（TDD）

**Files:**
- Create: `server/src/plugins/auth.ts`
- Create: `server/src/routes/auth.ts`
- Create: `server/src/types/shared.ts`
- Create: `server/tests/helpers.ts`
- Create: `server/tests/auth.test.ts`
- Modify: `server/src/index.ts`

### 子任务 5a: 测试 helper

- [x] **Step 1: 创建 server/tests/helpers.ts**

```typescript
import { prisma } from '../src/lib/db.js'

export async function cleanDatabase() {
  // 删除顺序：先删依赖方
  await prisma.bookkeepingEntry.deleteMany({})
  await prisma.salaryConfig.deleteMany({})
  await prisma.user.deleteMany({})
}
```

注：测试中用 `buildApp`（从 src/index.js）而非 buildTestApp，所以 helper 只保留数据库清理工具。

### 子任务 5b: 共享类型

- [x] **Step 2: 创建 server/src/types/shared.ts**

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
  occurredAt: string
  createdAt: string
  updatedAt: string
}

export interface CreateEntryInput {
  type: EntryType
  amount: number
  category: string
  note?: string
  occurredAt: string
}

export interface HolidayYearData {
  year: number
  holidays: string[]
  workdays: string[]
}

export interface ApiErrorBody {
  code: string
  message: string
}
```

### 子任务 5c: 鉴权插件

- [x] **Step 3: 创建 server/src/plugins/auth.ts**

```typescript
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { verifyToken } from '../lib/jwt.js'
import { prisma } from '../lib/db.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; username: string }
  }
}

export const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('user', null)

  app.addHook('preHandler', async (req: FastifyRequest) => {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      // 未带 token，放行（具体路由用 requireAuth 校验）
      return
    }
    const token = auth.slice(7)
    const payload = verifyToken(token)
    if (!payload) return

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (user) {
      req.user = { id: user.id, username: user.username }
    }
  })
}

/** 装饰器：要求鉴权。失败返回 401 */
export const requireAuth = async (req: FastifyRequest, reply: any) => {
  if (!req.user || !req.user.id) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: '需要登录' } })
    return reply
  }
}
```

### 子任务 5d: 认证路由

- [x] **Step 4: 创建 server/src/routes/auth.ts**

```typescript
import type { FastifyPluginAsync } from 'fastify'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { signToken } from '../lib/jwt.js'
import { prisma } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'
import type { AuthResponse } from '../types/shared.js'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const MIN_PASSWORD = 6
const MAX_PASSWORD = 32

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/auth/register
  app.post('/api/auth/register', async (req, reply) => {
    const body = req.body as { username?: string; password?: string }
    const username = body?.username?.trim()
    const password = body?.password

    if (!username || !password) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: '用户名和密码必填' } })
    }
    if (!USERNAME_RE.test(username)) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: '用户名需为 3-20 位字母/数字/下划线' } })
    }
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: `密码长度需为 ${MIN_PASSWORD}-${MAX_PASSWORD}` } })
    }

    const exists = await prisma.user.findUnique({ where: { username } })
    if (exists) {
      return reply.code(409).send({ error: { code: 'USERNAME_EXISTS', message: '用户名已被占用' } })
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { username, passwordHash },
    })

    const token = signToken({ userId: user.id, username: user.username })
    const response: AuthResponse = {
      token,
      user: { id: user.id, username: user.username },
    }
    return reply.code(201).send(response)
  })

  // POST /api/auth/login
  app.post('/api/auth/login', async (req, reply) => {
    const body = req.body as { username?: string; password?: string }
    const username = body?.username?.trim()
    const password = body?.password

    if (!username || !password) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: '用户名和密码必填' } })
    }

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } })
    }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } })
    }

    const token = signToken({ userId: user.id, username: user.username })
    const response: AuthResponse = {
      token,
      user: { id: user.id, username: user.username },
    }
    return reply.send(response)
  })

  // GET /api/auth/me
  app.get('/api/auth/me', { preHandler: requireAuth }, async (req, reply) => {
    return reply.send({ user: { id: req.user.id, username: req.user.username } })
  })
}
```

### 子任务 5e: 接入到 index.ts

- [x] **Step 5: 修改 server/src/index.ts 注册插件和路由**

```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { prisma } from './lib/db.js'
import { authPlugin } from './plugins/auth.js'
import { authRoutes } from './routes/auth.js'

const PORT = Number(process.env.PORT ?? 3000)

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true,
  })

  await app.register(cors, { origin: true })
  await app.register(authPlugin)
  await app.register(authRoutes)

  app.get('/health', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { status: 'ok', uptime: process.uptime() }
    } catch (err) {
      app.log.error({ err }, 'health check failed')
      return { status: 'degraded', uptime: process.uptime() }
    }
  })

  return app
}

async function main() {
  const app = await buildApp()
  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`server listening on :${PORT}`)
}

// 仅在直接执行（tsx src/index.ts）时运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
```

### 子任务 5f: 测试

- [x] **Step 6: 创建 server/tests/auth.test.ts**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import sfetch from 'supertest-fetch'
import { buildApp } from '../src/index.js'
import { prisma } from '../src/lib/db.js'

const app = await buildApp()
const fetch = sfetch(app.server)

beforeEach(async () => {
  await prisma.bookkeepingEntry.deleteMany({})
  await prisma.salaryConfig.deleteMany({})
  await prisma.user.deleteMany({})
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('POST /api/auth/register', () => {
  it('registers a new user', async () => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'secret123' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.token).toBeTruthy()
    expect(body.user.username).toBe('alice')
    expect(body.user.id).toBeTruthy()
  })

  it('rejects duplicate username', async () => {
    await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob', password: 'secret123' }),
    })
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob', password: 'secret123' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('USERNAME_EXISTS')
  })

  it('rejects invalid username', async () => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ab', password: 'secret123' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects short password', async () => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'carol', password: '123' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dave', password: 'secret123' }),
    })
  })

  it('logs in with correct credentials', async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dave', password: 'secret123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBeTruthy()
  })

  it('rejects wrong password', async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dave', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects unknown user', async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody', password: 'secret123' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('returns current user when authenticated', async () => {
    const reg = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'eve', password: 'secret123' }),
    })
    const { token } = await reg.json()
    
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.username).toBe('eve')
  })

  it('returns 401 without token', async () => {
    const res = await fetch('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: 'Bearer invalid' },
    })
    expect(res.status).toBe(401)
  })
})
```

- [x] **Step 7: 运行测试确认通过**

```bash
cd server && npm test
```

Expected: 所有测试 PASS（包括之前的 password 3 个、jwt 3 个，加上 auth 11 个）。

- [x] **Step 8: 手动验证**

```bash
cd server && npx tsx src/index.ts
```

```bash
# 另一个终端
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

Expected: 201，返回 token 和 user 对象。

- [x] **Step 9: 停止服务器（Ctrl+C）**

- [x] **Step 10: 提交**

```bash
git add server/src/plugins/auth.ts server/src/routes/auth.ts server/src/types/shared.ts server/tests/helpers.ts server/tests/auth.test.ts server/src/index.ts
git commit -m "feat(server): add auth routes (register/login/me) with JWT auth plugin"
```

---

## Task 6: 工资配置路由（TDD）

**Files:**
- Create: `server/src/routes/config.ts`
- Create: `server/tests/config.test.ts`
- Modify: `server/src/index.ts`

- [x] **Step 1: 写失败测试 server/tests/config.test.ts**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import sfetch from 'supertest-fetch'
import { buildApp } from '../src/index.js'
import { prisma } from '../src/lib/db.js'

const app = await buildApp()
const fetch = sfetch(app.server)

async function getToken(username = 'alice'): Promise<string> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'secret123' }),
  })
  const body = await res.json()
  return body.token
}

beforeEach(async () => {
  await prisma.bookkeepingEntry.deleteMany({})
  await prisma.salaryConfig.deleteMany({})
  await prisma.user.deleteMany({})
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('GET /api/config', () => {
  it('returns default config when not set', async () => {
    const token = await getToken()
    const res = await fetch('/api/config', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.monthlySalary).toBe(5000)
    expect(body.workStartHour).toBe(9)
    expect(body.workEndHour).toBe(18)
    expect(body.payday).toBe(15)
  })

  it('returns 401 without token', async () => {
    const res = await fetch('/api/config')
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/config', () => {
  it('creates config on first save', async () => {
    const token = await getToken()
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ monthlySalary: 8000, workStartHour: 10, workEndHour: 19, payday: 20 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.monthlySalary).toBe(8000)
    expect(body.workStartHour).toBe(10)
  })

  it('updates existing config', async () => {
    const token = await getToken()
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ monthlySalary: 5000, workStartHour: 9, workEndHour: 18, payday: 15 }),
    })
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ monthlySalary: 9000, workStartHour: 9, workEndHour: 18, payday: 15 }),
    })
    const body = await res.json()
    expect(body.monthlySalary).toBe(9000)
  })

  it('rejects out-of-range values', async () => {
    const token = await getToken()
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ monthlySalary: -1, workStartHour: 9, workEndHour: 18, payday: 15 }),
    })
    expect(res.status).toBe(400)
  })
})
```

- [x] **Step 2: 运行测试确认失败**

```bash
cd server && npm test
```

Expected: config 测试组 FAIL with "Cannot find module" 或 404。

- [x] **Step 3: 实现 server/src/routes/config.ts**

```typescript
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'

const DEFAULTS = {
  monthlySalary: 5000,
  workStartHour: 9,
  workEndHour: 18,
  payday: 15,
}

function validateConfig(body: any): { ok: true; data: typeof DEFAULTS } | { ok: false; message: string } {
  const { monthlySalary, workStartHour, workEndHour, payday } = body ?? {}
  if (typeof monthlySalary !== 'number' || monthlySalary <= 0) {
    return { ok: false, message: 'monthlySalary 必须为正数' }
  }
  if (typeof workStartHour !== 'number' || workStartHour < 0 || workStartHour > 24) {
    return { ok: false, message: 'workStartHour 必须在 0-24 之间' }
  }
  if (typeof workEndHour !== 'number' || workEndHour < 0 || workEndHour > 24) {
    return { ok: false, message: 'workEndHour 必须在 0-24 之间' }
  }
  if (typeof payday !== 'number' || payday < 1 || payday > 28) {
    return { ok: false, message: 'payday 必须在 1-28 之间' }
  }
  return { ok: true, data: { monthlySalary, workStartHour, workEndHour, payday } }
}

function serializeConfig(c: { monthlySalary: number; workStartHour: number; workEndHour: number; payday: number; updatedAt: Date }) {
  return {
    monthlySalary: c.monthlySalary,
    workStartHour: c.workStartHour,
    workEndHour: c.workEndHour,
    payday: c.payday,
    updatedAt: c.updatedAt.toISOString(),
  }
}

export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/config', { preHandler: requireAuth }, async (req) => {
    const existing = await prisma.salaryConfig.findUnique({ where: { userId: req.user.id } })
    if (existing) return serializeConfig(existing)
    return { ...DEFAULTS, updatedAt: new Date().toISOString() }
  })

  app.put('/api/config', { preHandler: requireAuth }, async (req, reply) => {
    const validated = validateConfig(req.body)
    if (!validated.ok) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: validated.message } })
    }
    const config = await prisma.salaryConfig.upsert({
      where: { userId: req.user.id },
      update: validated.data,
      create: { userId: req.user.id, ...validated.data },
    })
    return serializeConfig(config)
  })
}
```

- [x] **Step 4: 注册到 server/src/index.ts**

修改 `buildApp()` 函数，在 `await app.register(authRoutes)` 后添加：

```typescript
  await app.register(configRoutes)
```

- [x] **Step 5: 运行测试确认通过**

```bash
cd server && npm test
```

Expected: config 测试组 5/5 PASS。

- [x] **Step 6: 提交**

```bash
git add server/src/routes/config.ts server/tests/config.test.ts server/src/index.ts
git commit -m "feat(server): add salary config routes (GET/PUT)"
```

---

## Task 7: 记账条目路由（TDD）

**Files:**
- Create: `server/src/routes/entries.ts`
- Create: `server/tests/entries.test.ts`
- Modify: `server/src/index.ts`

- [x] **Step 1: 写失败测试 server/tests/entries.test.ts**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import sfetch from 'supertest-fetch'
import { buildApp } from '../src/index.js'
import { prisma } from '../src/lib/db.js'

const app = await buildApp()
const fetch = sfetch(app.server)

async function getToken(username = 'alice'): Promise<string> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'secret123' }),
  })
  return (await res.json()).token
}

beforeEach(async () => {
  await prisma.bookkeepingEntry.deleteMany({})
  await prisma.salaryConfig.deleteMany({})
  await prisma.user.deleteMany({})
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

const sampleEntry = {
  type: 'expense' as const,
  amount: 35.5,
  category: '餐饮',
  note: '午餐',
  occurredAt: '2025-07-01T12:00:00.000Z',
}

describe('POST /api/entries', () => {
  it('creates a new entry', async () => {
    const token = await getToken()
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(sampleEntry),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.entry.id).toBeTruthy()
    expect(body.entry.amount).toBe(35.5)
    expect(body.entry.type).toBe('expense')
  })

  it('rejects negative amount', async () => {
    const token = await getToken()
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...sampleEntry, amount: -1 }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects invalid type', async () => {
    const token = await getToken()
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...sampleEntry, type: 'invalid' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/entries', () => {
  it('returns entries for current user', async () => {
    const token = await getToken()
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(sampleEntry),
    })
    const res = await fetch('/api/entries', { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries.length).toBe(1)
    expect(body.entries[0].amount).toBe(35.5)
  })

  it('does not return other users entries', async () => {
    await getToken('alice')
    const bobToken = await getToken('bob')
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify(sampleEntry),
    })
    const aliceToken = (await (await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'secret123' }),
    })).json()).token
    const res = await fetch('/api/entries', { headers: { Authorization: `Bearer ${aliceToken}` } })
    const body = await res.json()
    expect(body.entries.length).toBe(0)
  })

  it('filters by date range', async () => {
    const token = await getToken()
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...sampleEntry, occurredAt: '2025-06-01T00:00:00.000Z' }),
    })
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...sampleEntry, occurredAt: '2025-07-15T00:00:00.000Z' }),
    })
    const res = await fetch('/api/entries?from=2025-07-01&to=2025-07-31', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    expect(body.entries.length).toBe(1)
  })
})

describe('PUT /api/entries/:id', () => {
  it('updates entry', async () => {
    const token = await getToken()
    const created = await (await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(sampleEntry),
    })).json()
    
    const res = await fetch(`/api/entries/${created.entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: 50 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entry.amount).toBe(50)
  })

  it('returns 404 for other users entry', async () => {
    await getToken('alice')
    const bobToken = await getToken('bob')
    const created = await (await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify(sampleEntry),
    })).json()
    
    const aliceToken = (await (await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'secret123' }),
    })).json()).token
    
    const res = await fetch(`/api/entries/${created.entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ amount: 999 }),
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/entries/:id', () => {
  it('deletes entry', async () => {
    const token = await getToken()
    const created = await (await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(sampleEntry),
    })).json()
    
    const res = await fetch(`/api/entries/${created.entry.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
  })
})
```

- [x] **Step 2: 运行测试确认失败**

```bash
cd server && npm test
```

Expected: entries 测试组 FAIL。

- [x] **Step 3: 实现 server/src/routes/entries.ts**

```typescript
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'
import type { BookkeepingEntry, CreateEntryInput } from '../types/shared.js'

function serializeEntry(e: {
  id: string
  type: string
  amount: number
  category: string
  note: string | null
  occurredAt: Date
  createdAt: Date
  updatedAt: Date
}): BookkeepingEntry {
  return {
    id: e.id,
    type: e.type as 'income' | 'expense',
    amount: e.amount,
    category: e.category,
    note: e.note ?? undefined,
    occurredAt: e.occurredAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

function validateEntry(body: any): { ok: true; data: CreateEntryInput } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: '请求体无效' }
  const { type, amount, category, note, occurredAt } = body
  if (type !== 'income' && type !== 'expense') return { ok: false, message: 'type 必须为 income 或 expense' }
  if (typeof amount !== 'number' || amount <= 0) return { ok: false, message: 'amount 必须为正数' }
  if (typeof category !== 'string' || !category) return { ok: false, message: 'category 必填' }
  if (typeof occurredAt !== 'string' || isNaN(Date.parse(occurredAt))) return { ok: false, message: 'occurredAt 必须是合法 ISO 时间' }
  if (note !== undefined && typeof note !== 'string') return { ok: false, message: 'note 必须为字符串' }
  return { ok: true, data: { type, amount, category, note, occurredAt } }
}

export const entriesRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/entries?from=&to=&limit=
  app.get('/api/entries', { preHandler: requireAuth }, async (req) => {
    const q = req.query as { from?: string; to?: string; limit?: string }
    const limit = Math.min(Number(q.limit ?? 500), 1000)
    const where: any = { userId: req.user.id }
    if (q.from || q.to) {
      where.occurredAt = {}
      if (q.from) where.occurredAt.gte = new Date(q.from)
      if (q.to) where.occurredAt.lte = new Date(q.to)
    }
    const entries = await prisma.bookkeepingEntry.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit,
    })
    return { entries: entries.map(serializeEntry) }
  })

  // POST /api/entries
  app.post('/api/entries', { preHandler: requireAuth }, async (req, reply) => {
    const validated = validateEntry(req.body)
    if (!validated.ok) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: validated.message } })
    }
    const entry = await prisma.bookkeepingEntry.create({
      data: {
        userId: req.user.id,
        type: validated.data.type,
        amount: validated.data.amount,
        category: validated.data.category,
        note: validated.data.note,
        occurredAt: new Date(validated.data.occurredAt),
      },
    })
    return reply.code(201).send({ entry: serializeEntry(entry) })
  })

  // PUT /api/entries/:id
  app.put('/api/entries/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as any).id
    const existing = await prisma.bookkeepingEntry.findFirst({
      where: { id, userId: req.user.id },
    })
    if (!existing) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '记账不存在' } })
    }
    
    const body = req.body as Partial<CreateEntryInput>
    const data: any = {}
    if (body.type !== undefined) {
      if (body.type !== 'income' && body.type !== 'expense') {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'type 非法' } })
      }
      data.type = body.type
    }
    if (body.amount !== undefined) {
      if (typeof body.amount !== 'number' || body.amount <= 0) {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'amount 必须为正数' } })
      }
      data.amount = body.amount
    }
    if (body.category !== undefined) data.category = body.category
    if (body.note !== undefined) data.note = body.note
    if (body.occurredAt !== undefined) {
      if (isNaN(Date.parse(body.occurredAt))) {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'occurredAt 非法' } })
      }
      data.occurredAt = new Date(body.occurredAt)
    }
    
    const updated = await prisma.bookkeepingEntry.update({
      where: { id },
      data,
    })
    return { entry: serializeEntry(updated) }
  })

  // DELETE /api/entries/:id
  app.delete('/api/entries/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as any).id
    const existing = await prisma.bookkeepingEntry.findFirst({
      where: { id, userId: req.user.id },
    })
    if (!existing) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '记账不存在' } })
    }
    await prisma.bookkeepingEntry.delete({ where: { id } })
    return { success: true }
  })
}
```

- [x] **Step 4: 注册到 server/src/index.ts**

在 `await app.register(configRoutes)` 后添加：

```typescript
  await app.register(entriesRoutes)
```

- [x] **Step 5: 运行测试确认通过**

```bash
cd server && npm test
```

Expected: entries 测试组 9/9 PASS。

- [x] **Step 6: 提交**

```bash
git add server/src/routes/entries.ts server/tests/entries.test.ts server/src/index.ts
git commit -m "feat(server): add bookkeeping entry CRUD routes"
```

---

## Task 8: 节假日路由（TDD）

**Files:**
- Create: `server/src/routes/holidays.ts`
- Create: `server/tests/holidays.test.ts`
- Modify: `server/src/index.ts`

- [x] **Step 1: 写失败测试 server/tests/holidays.test.ts**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import sfetch from 'supertest-fetch'
import { buildApp } from '../src/index.js'
import { prisma } from '../src/lib/db.js'

const app = await buildApp()
const fetch = sfetch(app.server)

async function getToken(username = 'alice'): Promise<string> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'secret123' }),
  })
  return (await res.json()).token
}

beforeEach(async () => {
  await prisma.cnHolidayYear.deleteMany({})
  await prisma.bookkeepingEntry.deleteMany({})
  await prisma.salaryConfig.deleteMany({})
  await prisma.user.deleteMany({})
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('GET /api/holidays', () => {
  it('returns empty when no data', async () => {
    const token = await getToken()
    const res = await fetch('/api/holidays?years=2025', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.years).toEqual([])
  })

  it('returns holidays for requested years', async () => {
    const token = await getToken()
    await prisma.cnHolidayYear.create({
      data: {
        year: 2025,
        holidays: JSON.stringify(['20250101', '20250210']),
        workdays: JSON.stringify(['20250126']),
        source: 'test',
      },
    })
    const res = await fetch('/api/holidays?years=2025', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    expect(body.years.length).toBe(1)
    expect(body.years[0].holidays).toEqual(['20250101', '20250210'])
    expect(body.years[0].workdays).toEqual(['20250126'])
  })

  it('rejects invalid years param', async () => {
    const token = await getToken()
    const res = await fetch('/api/holidays?years=abc', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 without token', async () => {
    const res = await fetch('/api/holidays?years=2025')
    expect(res.status).toBe(401)
  })
})
```

- [x] **Step 2: 运行测试确认失败**

```bash
cd server && npm test
```

Expected: holidays 测试组 FAIL。

- [x] **Step 3: 实现 server/src/routes/holidays.ts**

```typescript
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'
import type { HolidayYearData } from '../types/shared.js'

export const holidaysRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/holidays', { preHandler: requireAuth }, async (req, reply) => {
    const q = req.query as { years?: string }
    const yearsParam = q.years ?? ''
    const years = yearsParam.split(',').map((s) => s.trim()).filter(Boolean)
    
    if (years.length === 0) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'years 参数必填' } })
    }
    
    const parsedYears: number[] = []
    for (const y of years) {
      const n = Number(y)
      if (!Number.isInteger(n) || n < 1900 || n > 2200) {
        return reply.code(400).send({ error: { code: 'INVALID_YEAR', message: `年份 ${y} 非法` } })
      }
      parsedYears.push(n)
    }
    
    const rows = await prisma.cnHolidayYear.findMany({
      where: { year: { in: parsedYears } },
      orderBy: { year: 'asc' },
    })
    
    const result: HolidayYearData[] = rows.map((row) => ({
      year: row.year,
      holidays: JSON.parse(row.holidays),
      workdays: JSON.parse(row.workdays),
    }))
    
    return { years: result }
  })
}
```

- [x] **Step 4: 注册到 server/src/index.ts**

在 `await app.register(entriesRoutes)` 后添加：

```typescript
  await app.register(holidaysRoutes)
```

- [x] **Step 5: 运行测试确认通过**

```bash
cd server && npm test
```

Expected: holidays 测试组 4/4 PASS。

- [x] **Step 6: 提交**

```bash
git add server/src/routes/holidays.ts server/tests/holidays.test.ts server/src/index.ts
git commit -m "feat(server): add holidays query route"
```

---

## Task 9: 节假日自动同步（TDD）

**Files:**
- Create: `server/src/lib/holidaySync.ts`
- Create: `server/tests/holidaySync.test.ts`
- Modify: `server/src/index.ts`

- [x] **Step 1: 写失败测试 server/tests/holidaySync.test.ts**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { syncHolidaysIfMissing } from '../src/lib/holidaySync.js'
import { prisma } from '../src/lib/db.js'

beforeEach(async () => {
  await prisma.cnHolidayYear.deleteMany({})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('syncHolidaysIfMissing', () => {
  it('fetches missing year from remote', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        holiday: {
          '01-01': { holiday: true, name: '元旦' },
          '01-26': { holiday: false, name: '补班', target: '春节' },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)
    
    await syncHolidaysIfMissing([2025])
    
    expect(mockFetch).toHaveBeenCalledWith(
      'https://timor.tech/api/holiday/year/2025',
      expect.objectContaining({ signal: expect.any(Object) })
    )
    
    const row = await prisma.cnHolidayYear.findUnique({ where: { year: 2025 } })
    expect(row).not.toBeNull()
    expect(JSON.parse(row!.holidays)).toContain('20250101')
    expect(JSON.parse(row!.workdays)).toContain('20250126')
  })

  it('skips existing year', async () => {
    await prisma.cnHolidayYear.create({
      data: { year: 2025, holidays: '[]', workdays: '[]', source: 'manual' },
    })
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    
    await syncHolidaysIfMissing([2025])
    
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('continues on failure (does not throw)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', mockFetch)
    
    await expect(syncHolidaysIfMissing([2025])).resolves.toBeUndefined()
    
    const row = await prisma.cnHolidayYear.findUnique({ where: { year: 2025 } })
    expect(row).toBeNull()
  })
})
```

- [x] **Step 2: 运行测试确认失败**

```bash
cd server && npm test
```

Expected: holidaySync 测试组 FAIL。

- [x] **Step 3: 实现 server/src/lib/holidaySync.ts**

```typescript
import cron from 'node-cron'
import { prisma } from './db.js'

const REMOTE_BASE = 'https://timor.tech/api/holiday/year'

interface HolidayData {
  holidays: string[]
  workdays: string[]
}

function parseTimorResponse(year: number, json: any): HolidayData {
  const holidays: string[] = []
  const workdays: string[] = []
  const holidayMap = json?.holiday ?? {}
  
  for (const [mmdd, info] of Object.entries(holidayMap)) {
    const date = `${year}${mmdd.replace('-', '')}`
    if ((info as any)?.holiday === true) {
      holidays.push(date)
    } else if ((info as any)?.holiday === false) {
      workdays.push(date)
    }
  }
  
  return { holidays: holidays.sort(), workdays: workdays.sort() }
}

async function fetchYear(year: number): Promise<HolidayData> {
  const res = await fetch(`${REMOTE_BASE}/${year}`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return parseTimorResponse(year, json)
}

async function upsertYear(year: number, data: HolidayData): Promise<void> {
  await prisma.cnHolidayYear.upsert({
    where: { year },
    update: {
      holidays: JSON.stringify(data.holidays),
      workdays: JSON.stringify(data.workdays),
      source: 'sync',
      updatedAt: new Date(),
    },
    create: {
      year,
      holidays: JSON.stringify(data.holidays),
      workdays: JSON.stringify(data.workdays),
      source: 'sync',
      note: `自动同步 @ ${new Date().toISOString()}`,
    },
  })
}

export async function syncHolidaysIfMissing(years: number[]): Promise<void> {
  for (const year of years) {
    try {
      const exists = await prisma.cnHolidayYear.findUnique({ where: { year } })
      if (!exists) {
        console.log(`[holiday-sync] ${year} 缺失，开始从远程拉取...`)
        const data = await fetchYear(year)
        await upsertYear(year, data)
        console.log(`[holiday-sync] ${year} 同步成功 (节假日 ${data.holidays.length} 个 / 补班 ${data.workdays.length} 个)`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[holiday-sync] ${year} 同步失败: ${message}`)
    }
  }
}

export function startHolidaySyncCron(): void {
  cron.schedule('0 3 * * *', async () => {
    const now = new Date()
    const years = [now.getFullYear(), now.getFullYear() + 1]
    console.log(`[holiday-sync] 定时任务触发，检查 ${years.join(', ')}`)
    await syncHolidaysIfMissing(years)
  })
  console.log('[holiday-sync] 定时任务已注册：每天 03:00 检查')
}
```

- [x] **Step 4: 在 server/src/index.ts 启动 hook 中调用**

修改 `buildApp()`，在健康检查前添加：

```typescript
  app.addHook('onReady', async () => {
    const now = new Date()
    const years = [now.getFullYear(), now.getFullYear() + 1]
    await syncHolidaysIfMissing(years)
    startHolidaySyncCron()
  })
```

并在文件顶部添加 import：

```typescript
import { syncHolidaysIfMissing, startHolidaySyncCron } from './lib/holidaySync.js'
```

- [x] **Step 5: 运行测试确认通过**

```bash
cd server && npm test
```

Expected: holidaySync 测试组 3/3 PASS。

- [x] **Step 6: 手动验证（可选，依赖外网）**

```bash
cd server && rm -f data/salary.db && npx prisma migrate deploy && npx tsx src/index.ts
```

观察启动日志中是否有 `[holiday-sync]` 输出（如 `[holiday-sync] 2026 缺失，开始从远程拉取...`）。如果外网不通，会看到警告但不影响启动。

Ctrl+C 停止。

- [x] **Step 7: 提交**

```bash
git add server/src/lib/holidaySync.ts server/tests/holidaySync.test.ts server/src/index.ts
git commit -m "feat(server): add holiday auto-sync (startup + daily 03:00 cron)"
```

---

## Task 10: Docker 化

**Files:**
- Create: `server/Dockerfile`
- Create: `deploy/docker-compose.yml`
- Create: `deploy/Caddyfile`
- Create: `deploy/.env.example`

- [x] **Step 1: 创建 server/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ---- Runtime ----
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

RUN apk add --no-cache wget

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --spider -q http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

- [x] **Step 2: 创建 deploy/.env.example**

```bash
# 必填：用 openssl rand -hex 32 生成
JWT_SECRET=replace-with-real-secret

# 可选
TZ=Asia/Shanghai
```

- [x] **Step 3: 创建 deploy/Caddyfile（占位域名，需替换）**

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

- [x] **Step 4: 创建 deploy/docker-compose.yml**

```yaml
version: '3.8'

services:
  app:
    build:
      context: ../server
      dockerfile: Dockerfile
    container_name: trae-salary-app
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - DATABASE_URL=file:/data/salary.db
      - PORT=3000
    volumes:
      - ../data:/data
      - ../logs/app:/app/logs
    depends_on:
      - caddy
    networks:
      - internal
    expose:
      - "3000"

  caddy:
    image: caddy:2
    container_name: trae-salary-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ../data/caddy_data:/data
      - ../data/caddy_config:/config
      - ../logs/caddy:/var/log/caddy
    networks:
      - internal
    depends_on:
      - app

networks:
  internal:
    driver: bridge
```

- [x] **Step 5: 验证 docker 构建（不启动）**

```bash
docker --version
docker compose version
```

如果 docker 未安装，跳过此步骤直接提交。

- [x] **Step 6: 提交**

```bash
git add server/Dockerfile deploy/
git commit -m "feat(deploy): add Docker setup with Caddy reverse proxy + auto HTTPS"
```

注意：本地有 docker 可选 `cd deploy && cp .env.example .env && echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env && docker compose up -d --build` 端到端验证。验证后 `docker compose down -v`。

---

## Task 11: 搬迁前端代码到 client/

**Files:**
- Move: 所有 `src/**`、`project.config.json`、`babel.config.js`、`tsconfig.json`、`index.html` → `client/`
- Modify: `client/tsconfig.json`（如有需要）
- Modify: `client/project.config.json` 的 miniprogramRoot（如有需要）
- Create: `client/types/` 暂不使用，可选
- Create: `client/vitest.config.ts`

- [x] **Step 1: 用 git mv 移动整个 src/ 到 client/**

```bash
mkdir -p client
git mv src client/src
```

- [x] **Step 2: 移动其他前端相关文件到 client/**

```bash
git mv project.config.json client/project.config.json
git mv project.private.config.json client/project.private.config.json
git mv babel.config.js client/babel.config.js
git mv tsconfig.json client/tsconfig.json
git mv index.html client/index.html
```

- [x] **Step 3: 移动根 package.json 到 client/ 并修改 name**

检查根目录是否有 package.json。如果有 scripts 字段（dev:weapp 等），移动：

```bash
git mv package.json client/package.json
```

移动后立即修改 `client/package.json`，把 `"name": "trae-salary"` 改为 `"name": "trae-salary-client"`（避免和根 workspaces 冲突）。

如果根目录 package.json 仅是 @types 之类辅助用途，可以保留在根。但因为所有前端 npm 脚本都在 client/ 下，移动更清晰。

- [x] **Step 4: 添加客户端 vitest 配置**

创建 `client/vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

- [x] **Step 5: 安装 vitest 到 client**

修改 `client/package.json` 的 devDependencies，添加：

```json
"vitest": "^2.0.5",
"@vitest/ui": "^2.0.5"
```

然后：

```bash
cd client && npm install
```

- [x] **Step 6: 创建根目录 package.json（workspaces 入口）**

移动原根 package.json 后，根目录就没有 package.json 了。创建新的根 `package.json` 作为 npm workspaces 入口：

```json
{
  "name": "trae-salary",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["client", "server"]
}
```

并在根目录运行 `npm install`（创建顶层 node_modules 链接）。

- [x] **Step 7: 验证前端还能开发**

```bash
cd client && npm run dev:weapp
```

Expected: Taro 编译成功，监听文件变化。如有路径错误，根据提示修复。

- [x] **Step 8: 在微信开发者工具中打开**

打开微信开发者工具，导入项目指向 `client/dist/` 目录（构建产物）。

Expected: 能正常预览小程序。

- [x] **Step 9: 提交**

```bash
git add client/ package.json package-lock.json
git commit -m "refactor: move frontend code from src/ to client/ for cleaner layout"
```

---

## Task 12: 前端 API 客户端（TDD）

**Files:**
- Create: `client/src/api/types.ts`
- Create: `client/src/api/client.ts`
- Create: `client/src/api/auth.ts`
- Create: `client/src/api/config.ts`
- Create: `client/src/api/entries.ts`
- Create: `client/src/api/holidays.ts`
- Create: `client/src/api/__tests__/client.test.ts`

### 子任务 12a: 共享类型

- [x] **Step 1: 创建 client/src/api/types.ts**

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
  occurredAt: string
  createdAt: string
  updatedAt: string
}

export interface CreateEntryInput {
  type: EntryType
  amount: number
  category: string
  note?: string
  occurredAt: string
}

export interface HolidayYearData {
  year: number
  holidays: string[]
  workdays: string[]
}

export interface ApiErrorBody {
  code: string
  message: string
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
```

注意：与 `server/src/types/shared.ts` 保持一致。每次后端类型修改时同步更新。

### 子任务 12b: 客户端核心

- [x] **Step 2: 写失败测试 client/src/api/__tests__/client.test.ts**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

// mock Taro
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    request: vi.fn(),
  },
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  request: vi.fn(),
}))

import Taro from '@tarojs/taro'
import { apiRequest, ApiError, getToken, setToken, clearToken } from '../client'

describe('api/client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearToken()
  })

  describe('token storage', () => {
    it('stores and retrieves token', () => {
      setToken('test-token-abc')
      expect(getToken()).toBe('test-token-abc')
    })

    it('returns null when no token', () => {
      ;(Taro.getStorageSync as any).mockReturnValue('')
      expect(getToken()).toBeNull()
    })

    it('clears token', () => {
      setToken('test')
      clearToken()
      expect(getToken()).toBeNull()
    })
  })

  describe('apiRequest', () => {
    it('sends request with bearer token', async () => {
      setToken('my-token')
      ;(Taro.request as any).mockResolvedValue({
        statusCode: 200,
        data: { ok: true },
      })

      const result = await apiRequest<{ ok: boolean }>('/api/test')
      expect(result.ok).toBe(true)
      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/api/test'),
          header: expect.objectContaining({ Authorization: 'Bearer my-token' }),
        }),
      )
    })

    it('omits auth header when no token', async () => {
      ;(Taro.request as any).mockResolvedValue({
        statusCode: 200,
        data: { ok: true },
      })

      await apiRequest('/api/test')
      const call = (Taro.request as any).mock.calls[0][0]
      expect(call.header.Authorization).toBeUndefined()
    })

    it('throws ApiError on non-2xx response', async () => {
      ;(Taro.request as any).mockResolvedValue({
        statusCode: 401,
        data: { error: { code: 'UNAUTHORIZED', message: '需要登录' } },
      })

      await expect(apiRequest('/api/test')).rejects.toThrow(ApiError)
      await expect(apiRequest('/api/test')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        status: 401,
      })
    })

    it('throws generic ApiError on non-2xx without error body', async () => {
      ;(Taro.request as any).mockResolvedValue({
        statusCode: 500,
        data: null,
      })

      await expect(apiRequest('/api/test')).rejects.toMatchObject({
        code: 'UNKNOWN',
        status: 500,
      })
    })
  })
})
```

- [x] **Step 3: 运行测试确认失败**

```bash
cd client && npx vitest run
```

Expected: FAIL with module not found。

- [x] **Step 4: 实现 client/src/api/client.ts**

```typescript
import Taro from '@tarojs/taro'
import { ApiError } from './types'

const TOKEN_KEY = 'auth_token'

function getBaseUrl(): string {
  const url = process.env.TARO_APP_API_BASE_URL
  if (url) return url.replace(/\/+$/, '')
  // 开发环境默认值
  return 'http://localhost:3000'
}

export function getToken(): string | null {
  try {
    const t = Taro.getStorageSync(TOKEN_KEY)
    if (typeof t === 'string' && t.length > 0) return t
  } catch {
    /* ignore */
  }
  return null
}

export function setToken(token: string): void {
  try {
    Taro.setStorageSync(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  try {
    Taro.removeStorageSync(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
}

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options
  const token = getToken()
  const base = getBaseUrl()
  const url = new URL(base + path)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v))
      }
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await Taro.request({
    url: url.toString(),
    method,
    data: body,
    header: headers,
    timeout: 10000,
  })

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as T
  }

  const errBody = (res.data as any)?.error
  throw new ApiError(
    errBody?.code ?? 'UNKNOWN',
    errBody?.message ?? `HTTP ${res.statusCode}`,
    res.statusCode,
  )
}
```

- [x] **Step 5: 运行测试确认通过**

```bash
cd client && npx vitest run
```

Expected: client.test.ts 7/7 PASS。

### 子任务 12c: 各域 API 模块

- [x] **Step 6: 创建 client/src/api/auth.ts**

```typescript
import { apiRequest } from './client'
import type { AuthResponse, User } from './types'

export function register(username: string, password: string) {
  return apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: { username, password },
  })
}

export function login(username: string, password: string) {
  return apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  })
}

export function me() {
  return apiRequest<{ user: User }>('/api/auth/me')
}
```

- [x] **Step 7: 创建 client/src/api/config.ts**

```typescript
import { apiRequest } from './client'
import type { SalaryConfig } from './types'

export function getConfig() {
  return apiRequest<SalaryConfig>('/api/config')
}

export function updateConfig(config: Omit<SalaryConfig, 'updatedAt'>) {
  return apiRequest<SalaryConfig>('/api/config', {
    method: 'PUT',
    body: config,
  })
}
```

- [x] **Step 8: 创建 client/src/api/entries.ts**

```typescript
import { apiRequest } from './client'
import type { BookkeepingEntry, CreateEntryInput } from './types'

export function listEntries(params?: { from?: string; to?: string; limit?: number }) {
  return apiRequest<{ entries: BookkeepingEntry[] }>('/api/entries', { query: params })
}

export function createEntry(input: CreateEntryInput) {
  return apiRequest<{ entry: BookkeepingEntry }>('/api/entries', {
    method: 'POST',
    body: input,
  })
}

export function updateEntry(id: string, input: Partial<CreateEntryInput>) {
  return apiRequest<{ entry: BookkeepingEntry }>(`/api/entries/${id}`, {
    method: 'PUT',
    body: input,
  })
}

export function deleteEntry(id: string) {
  return apiRequest<{ success: boolean }>(`/api/entries/${id}`, {
    method: 'DELETE',
  })
}
```

- [x] **Step 9: 创建 client/src/api/holidays.ts**

```typescript
import { apiRequest } from './client'
import type { HolidayYearData } from './types'

export function getHolidays(years: number[]) {
  return apiRequest<{ years: HolidayYearData[] }>('/api/holidays', {
    query: { years: years.join(',') },
  })
}
```

- [x] **Step 10: 创建 client/src/api/index.ts 统一导出**

```typescript
export * from './client'
export * from './auth'
export * from './config'
export * from './entries'
export * from './holidays'
export * from './types'
```

- [x] **Step 11: 提交**

```bash
git add client/src/api/ client/package.json client/package-lock.json client/vitest.config.ts
git commit -m "feat(client): add API client with auth/config/entries/holidays modules"
```

---

## Task 13: 登录页

**Files:**
- Create: `client/src/pages/login/index.config.ts`
- Create: `client/src/pages/login/index.tsx`
- Create: `client/src/pages/login/index.scss`
- Modify: `client/src/app.config.ts`
- Modify: `client/src/app.tsx`（加入登录态检查）

- [x] **Step 1: 创建 client/src/pages/login/index.config.ts**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  backgroundColor: '#f5f0e8',
})
```

- [x] **Step 2: 创建 client/src/pages/login/index.scss**

```scss
.login-root {
  min-height: 100vh;
  background: #f5f0e8;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120px 40px 40px;
  box-sizing: border-box;
}

.login-title {
  font-size: 28px;
  color: #3a3530;
  font-weight: 600;
  margin-bottom: 12px;
}

.login-subtitle {
  font-size: 14px;
  color: #8a7f70;
  margin-bottom: 60px;
}

.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-input {
  background: #ffffff;
  border-radius: 12px;
  padding: 18px 20px;
  font-size: 16px;
  color: #3a3530;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.login-btn {
  margin-top: 24px;
  background: #3a3530;
  color: #fff;
  border-radius: 12px;
  padding: 18px;
  text-align: center;
  font-size: 16px;
  font-weight: 500;

  &--secondary {
    background: transparent;
    color: #3a3530;
    border: 1px solid #3a3530;
    margin-top: 12px;
  }

  &--disabled {
    opacity: 0.5;
  }
}

.login-error {
  color: #c0392b;
  font-size: 13px;
  margin-top: 12px;
  text-align: center;
}

.login-switch {
  margin-top: 24px;
  font-size: 13px;
  color: #8a7f70;
  text-align: center;

  &__link {
    color: #3a3530;
    text-decoration: underline;
    margin-left: 6px;
  }
}
```

- [x] **Step 3: 创建 client/src/pages/login/index.tsx**

```tsx
import { View, Text, Input } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { login, register, setToken } from '../../api'
import './index.scss'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const fn = mode === 'login' ? login : register
      const res = await fn(username, password)
      setToken(res.token)
      Taro.reLaunch({ url: '/pages/index/index' })
    } catch (err: any) {
      setError(err?.message ?? '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='login-root'>
      <Text className='login-title'>{mode === 'login' ? '欢迎回来' : '创建账号'}</Text>
      <Text className='login-subtitle'>{mode === 'login' ? '登录以同步你的数据' : '注册后可在多设备同步'}</Text>

      <View className='login-form'>
        <Input
          className='login-input'
          placeholder='用户名（3-20 位字母/数字/下划线）'
          value={username}
          onInput={(e) => setUsername(e.detail.value)}
          maxlength={20}
        />
        <Input
          className='login-input'
          placeholder='密码（6-32 位）'
          password
          value={password}
          onInput={(e) => setPassword(e.detail.value)}
          maxlength={32}
        />

        <View
          className={`login-btn ${loading ? 'login-btn--disabled' : ''}`}
          onClick={loading ? undefined : submit}
        >
          <Text>{loading ? '处理中...' : mode === 'login' ? '登 录' : '注 册'}</Text>
        </View>

        {error && <Text className='login-error'>{error}</Text>}

        <View className='login-switch'>
          <Text>{mode === 'login' ? '还没有账号？' : '已有账号？'}</Text>
          <Text className='login-switch__link' onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? '立即注册' : '立即登录'}
          </Text>
        </View>
      </View>
    </View>
  )
}
```

- [x] **Step 4: 在 client/src/app.config.ts 注册登录页路由**

修改 `pages` 数组，把登录页放在第一位（默认页）：

```typescript
export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/index/index',
  ],
  window: {
    navigationStyle: 'custom',
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f5f0e8',
    navigationBarTitleText: 'Taro Demo',
    navigationBarTextStyle: 'black',
  },
})
```

- [x] **Step 5: 修改 client/src/app.tsx 加入登录态检查**

修改 `client/src/app.tsx`：

```tsx
import { PropsWithChildren } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getToken } from './api'

export default function App({ children }: PropsWithChildren) {
  useDidShow(() => {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    const currentPath = current?.route ?? ''
    
    // 在登录页不需要检查
    if (currentPath.startsWith('pages/login')) return
    
    const token = getToken()
    if (!token) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  return children
}
```

- [x] **Step 6: 手动验证**

```bash
cd client && npm run dev:weapp
```

在微信开发者工具中：
1. 打开后应该直接进入登录页（因为没 token）
2. 输入用户名密码测试登录
3. 登录失败应该提示错误
4. 登录成功应该跳到首页

- [x] **Step 7: 提交**

```bash
git add client/src/pages/login/ client/src/app.config.ts client/src/app.tsx
git commit -m "feat(client): add login/register page with auth state check"
```

---

## Task 14: 工资配置同步改造

**Files:**
- Modify: `client/src/pages/index/index.tsx`

- [x] **Step 1: 在 client/src/pages/index/index.tsx 顶部 import API**

在 import 块添加：

```typescript
import * as api from '../../api'
```

- [x] **Step 2: 找到 saveConfig 函数并改造**

定位到 `saveConfig` 函数（约 469-476 行），替换为：

```typescript
  // 保存配置（本地 + 云端）
  const saveConfig = useCallback(async (newConfig: SalaryConfig) => {
    // 1. 立即更新本地（保证 UI 响应）
    setConfig(newConfig)
    try {
      Taro.setStorageSync('salary_config', newConfig)
    } catch {
      /* ignore */
    }

    // 2. 同步到云端
    try {
      const updated = await api.updateConfig(newConfig)
      try {
        Taro.setStorageSync('salary_config', updated)
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.warn('[sync] 工资配置同步失败', err)
      // TODO: Task 17 加入待重试队列
    }
  }, [])
```

- [x] **Step 3: 找到 applySettings 函数并改造**

定位到 `applySettings` 函数（约 537-551 行），将 `saveConfig(parsed)` 改为：

```typescript
    saveConfig(parsed)
```

由于 `saveConfig` 现在是 async，但 UI 不需要等待完成。fire-and-forget 模式。

- [x] **Step 4: 在组件顶部加入 useEffect 启动时拉取云端**

在已有的 `useEffect(() => { ... }, [])`（约 357 行的节假日同步）之后，添加：

```typescript
  // 启动时如果已登录，从云端拉取最新工资配置
  useEffect(() => {
    if (!api.getToken()) return
    ;(async () => {
      try {
        const remote = await api.getConfig()
        // 仅当云端数据更新时覆盖本地
        const localStr = (() => {
          try { return Taro.getStorageSync('salary_config') } catch { return null }
        })()
        if (!localStr || (remote.updatedAt && (!localStr.updatedAt || remote.updatedAt > localStr.updatedAt))) {
          setConfig(remote)
          try {
            Taro.setStorageSync('salary_config', remote)
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        console.warn('[sync] 拉取工资配置失败', err)
      }
    })()
  }, [])
```

- [x] **Step 5: 手动验证**

1. 启动 server: `cd server && npx tsx src/index.ts`
2. 启动小程序: `cd client && npm run dev:weapp`
3. 登录后修改工资配置，查看 server 日志是否有 PUT /api/config 请求
4. 退出登录再登录，验证配置被正确恢复

- [x] **Step 6: 提交**

```bash
git add client/src/pages/index/index.tsx
git commit -m "feat(client): sync salary config to cloud on save + pull on startup"
```

---

## Task 15: 记账同步改造

**Files:**
- Modify: `client/src/components/Bookkeeping/index.tsx`（或类似文件，需先读确认结构）

- [x] **Step 1: 阅读 Bookkeeping 组件结构**

```bash
ls client/src/components/Bookkeeping/
```

查看现有文件结构。预期有：
- `index.tsx` 或多个组件文件
- 包含添加/修改/删除记账的逻辑

记下文件中：
- 添加记账的函数名（如 `addEntry`、`handleAdd`）
- 修改记账的函数名
- 删除记账的函数名
- 本地存储键名（如 `entries`）

- [x] **Step 2: 在 Bookkeeping 组件顶部加入 import**

```typescript
import * as api from '../../api'
```

- [x] **Step 3: 改造添加记账函数**

找到添加记账的函数（典型代码会读 storage、push 新条目、写回 storage）。改造为：

```typescript
  // 伪代码示意，根据实际函数名调整
  const handleAddEntry = async (newEntry: BookkeepingEntry) => {
    // 1. 生成临时 ID（如果是新条目）
    const tempEntry = { ...newEntry, id: newEntry.id || `temp-${Date.now()}` }
    
    // 2. 本地先存
    const localEntries = readLocalEntries()
    const updated = [...localEntries, tempEntry]
    writeLocalEntries(updated)
    
    // 3. 同步云端
    try {
      const res = await api.createEntry({
        type: tempEntry.type,
        amount: tempEntry.amount,
        category: tempEntry.category,
        note: tempEntry.note,
        occurredAt: tempEntry.occurredAt,
      })
      // 用云端返回的 id 替换临时 id
      const finalEntries = updated.map((e) => e.id === tempEntry.id ? res.entry : e)
      writeLocalEntries(finalEntries)
    } catch (err) {
      console.warn('[sync] 创建记账失败', err)
      // TODO: Task 17 加入待重试队列
    }
  }
```

- [x] **Step 4: 改造修改记账函数**

```typescript
  const handleUpdateEntry = async (id: string, patch: Partial<BookkeepingEntry>) => {
    // 本地先更新
    const localEntries = readLocalEntries()
    const updated = localEntries.map((e) => e.id === id ? { ...e, ...patch } : e)
    writeLocalEntries(updated)
    
    // 云端更新
    try {
      await api.updateEntry(id, patch)
    } catch (err) {
      console.warn('[sync] 更新记账失败', err)
    }
  }
```

- [x] **Step 5: 改造删除记账函数**

```typescript
  const handleDeleteEntry = async (id: string) => {
    // 本地先删除
    const localEntries = readLocalEntries()
    writeLocalEntries(localEntries.filter((e) => e.id !== id))
    
    // 云端删除
    try {
      await api.deleteEntry(id)
    } catch (err) {
      console.warn('[sync] 删除记账失败', err)
    }
  }
```

- [x] **Step 6: 在 Bookkeeping 组件挂载时从云端拉取**

在组件的 `useEffect` 钩子中加入：

```typescript
  useEffect(() => {
    if (!api.getToken()) return
    ;(async () => {
      try {
        const from = new Date(Date.now() - 90 * 86400 * 1000).toISOString().slice(0, 10)
        const to = new Date().toISOString().slice(0, 10)
        const { entries: remoteEntries } = await api.listEntries({ from, to, limit: 500 })
        
        // 合并：远程优先（基于 updatedAt）
        const localEntries = readLocalEntries()
        const remoteMap = new Map(remoteEntries.map((e) => [e.id, e]))
        const merged = [...remoteEntries]
        for (const local of localEntries) {
          // 本地有的、远程没有的（可能是离线新增的）保留并标记待同步
          if (!remoteMap.has(local.id) && !local.id.startsWith('temp-')) {
            merged.push(local)
          }
        }
        writeLocalEntries(merged)
      } catch (err) {
        console.warn('[sync] 拉取记账失败', err)
      }
    })()
  }, [])
```

- [x] **Step 7: 手动验证**

1. 登录后添加一笔记账
2. 查看 server 日志确认 POST /api/entries
3. 退出登录再登录，验证记账数据被正确恢复

- [x] **Step 8: 提交**

```bash
git add client/src/components/Bookkeeping/
git commit -m "feat(client): sync bookkeeping entries to cloud on CRUD + pull on mount"
```

---

## Task 16: 节假日云端化改造

**Files:**
- Modify: `client/src/utils/cnHoliday.ts`
- Delete: `client/src/constants/cn-holiday-fallback.json`（如果完全不再用）

- [x] **Step 1: 在 cnHoliday.ts 顶部加入 import**

```typescript
import * as api from '../api'
```

- [x] **Step 2: 修改 ensureCnHolidayDataset 优先从云端拉取**

找到 `ensureCnHolidayDataset` 函数（约 94 行）。改造为：

```typescript
export async function ensureCnHolidayDataset(params?: {
  baseDate?: Date
  years?: number[]
}): Promise<CnHolidayDataset> {
  const base = params?.baseDate ?? new Date()
  const years = params?.years ?? [base.getFullYear(), base.getFullYear() + 1, base.getFullYear() + 2]

  // 1. 优先读本地缓存
  const cached = readCnHolidayDatasetSync()
  if (isCoveringYears(cached, years)) return cached!

  // 2. 尝试从云端拉取（需要登录）
  if (api.getToken()) {
    try {
      const { years: yearData } = await api.getHolidays(years)
      const merged: CnHolidayDataset = {
        years: uniqSorted([
          ...(cached?.years ?? []),
          ...yearData.map((y) => y.year),
        ]) as unknown as number[],
        holidays: uniqSorted([
          ...(cached?.holidays ?? []),
          ...yearData.flatMap((y) => y.holidays),
        ]),
        workdays: uniqSorted([
          ...(cached?.workdays ?? []),
          ...yearData.flatMap((y) => y.workdays),
        ]),
        fetchedAt: new Date().toISOString(),
        source: 'remote',
      }
      writeCnHolidayDatasetSync(merged)
      return merged
    } catch (err) {
      console.warn('[cnHoliday] 云端拉取失败', err)
    }
  }

  // 3. 返回本地缓存（可能为空）
  return cached ?? {
    years: [],
    holidays: [],
    workdays: [],
    fetchedAt: new Date(0).toISOString(),
    source: 'cache',
  }
}
```

- [x] **Step 3: 移除 fallback 引用**

修改文件顶部 import：

```typescript
// 删除这一行：
// import fallbackData from '../constants/cn-holiday-fallback.json'
```

把函数内用到 fallbackData 的逻辑（第 106-114 行）替换为上面的云端版本。

- [x] **Step 4: 删除 fallback JSON 文件**

```bash
git rm client/src/constants/cn-holiday-fallback.json
```

- [x] **Step 5: 手动验证**

1. 登录后启动小程序，查看 dev tools 是否调用了 GET /api/holidays
2. 验证今天的节假日判断正确
3. 跨年时验证跨年数据正确

- [x] **Step 6: 提交**

```bash
git add client/src/utils/cnHoliday.ts
git commit -m "refactor(client): load holidays from cloud API instead of bundled JSON"
```

---

## Task 17: 初始同步 + 重试机制

**Files:**
- Create: `client/src/utils/sync.ts`
- Modify: `client/src/pages/login/index.tsx`
- Modify: `client/src/pages/index/index.tsx`（启动时触发）

- [x] **Step 1: 创建 client/src/utils/sync.ts**

```typescript
import Taro from '@tarojs/taro'
import * as api from '../api'
import { ensureCnHolidayDataset } from './cnHoliday'

const PENDING_KEY = 'pending_sync_queue'

type PendingOp = 
  | { type: 'createEntry'; payload: api.CreateEntryInput; tempId: string }
  | { type: 'updateEntry'; id: string; payload: Partial<api.CreateEntryInput> }
  | { type: 'deleteEntry'; id: string }
  | { type: 'updateConfig'; payload: api.SalaryConfig }

function readQueue(): PendingOp[] {
  try {
    const raw = Taro.getStorageSync(PENDING_KEY)
    if (Array.isArray(raw)) return raw
  } catch {
    /* ignore */
  }
  return []
}

function writeQueue(queue: PendingOp[]): void {
  try {
    Taro.setStorageSync(PENDING_KEY, queue)
  } catch {
    /* ignore */
  }
}

export function enqueueSync(op: PendingOp): void {
  const q = readQueue()
  q.push(op)
  writeQueue(q)
}

export async function retryPendingSyncs(): Promise<void> {
  if (!api.getToken()) return
  const queue = readQueue()
  if (queue.length === 0) return
  
  const remaining: PendingOp[] = []
  for (const op of queue) {
    try {
      switch (op.type) {
        case 'createEntry':
          await api.createEntry(op.payload)
          break
        case 'updateEntry':
          await api.updateEntry(op.id, op.payload)
          break
        case 'deleteEntry':
          await api.deleteEntry(op.id)
          break
        case 'updateConfig':
          await api.updateConfig(op.payload)
          break
      }
    } catch (err) {
      console.warn('[sync] 重试失败，保留在队列', err)
      remaining.push(op)
    }
  }
  writeQueue(remaining)
}

/** 登录后调用：一次性拉取工资配置、记账、节假日 */
export async function initialSync(): Promise<void> {
  if (!api.getToken()) return
  
  // 工资配置
  try {
    const config = await api.getConfig()
    Taro.setStorageSync('salary_config', config)
  } catch (err) {
    console.warn('[sync] 拉取工资配置失败', err)
  }
  
  // 记账（最近 90 天）
  try {
    const from = new Date(Date.now() - 90 * 86400 * 1000).toISOString().slice(0, 10)
    const to = new Date().toISOString().slice(0, 10)
    const { entries } = await api.listEntries({ from, to, limit: 500 })
    Taro.setStorageSync('bookkeeping_entries', entries)
  } catch (err) {
    console.warn('[sync] 拉取记账失败', err)
  }
  
  // 节假日
  try {
    await ensureCnHolidayDataset()
  } catch (err) {
    console.warn('[sync] 拉取节假日失败', err)
  }
  
  // 重试待同步队列
  await retryPendingSyncs()
}
```

- [x] **Step 2: 在登录成功时触发 initialSync**

修改 `client/src/pages/login/index.tsx` 的 `submit` 函数，在 `setToken(res.token)` 之后添加：

```typescript
      setToken(res.token)
      const { initialSync } = await import('../../utils/sync')
      await initialSync()
      Taro.reLaunch({ url: '/pages/index/index' })
```

- [x] **Step 3: 在首页 mount 时也调用一次（防御）**

在 `client/src/pages/index/index.tsx` 已有 `useEffect(() => { ... }, [])` 中加入（如没有则新建）：

```typescript
  useEffect(() => {
    ;(async () => {
      const { initialSync } = await import('../../utils/sync')
      await initialSync()
    })()
  }, [])
```

- [x] **Step 4: 把 Task 14/15 中的 TODO 替换为 enqueueSync**

回到 `client/src/pages/index/index.tsx` 的 `saveConfig`，把：
```typescript
    } catch (err) {
      console.warn('[sync] 工资配置同步失败', err)
      // TODO: Task 17 加入待重试队列
    }
```

替换为：
```typescript
    } catch (err) {
      console.warn('[sync] 工资配置同步失败，加入重试队列', err)
      const { enqueueSync } = await import('../../utils/sync')
      enqueueSync({ type: 'updateConfig', payload: newConfig })
    }
```

类似地，Task 15 中的记账 CRUD 函数也要在 catch 块加入 `enqueueSync` 调用。

- [x] **Step 5: 手动验证离线场景**

1. 关闭 server
2. 在小程序中修改工资配置 → 应该看到 `[sync] 工资配置同步失败`
3. 重启 server
4. 重新进入小程序 → `initialSync` 应触发 `retryPendingSyncs`，失败的配置被同步

- [x] **Step 6: 提交**

```bash
git add client/src/utils/sync.ts client/src/pages/login/index.tsx client/src/pages/index/index.tsx client/src/components/Bookkeeping/
git commit -m "feat(client): add initial sync + offline retry queue"
```

---

## Task 18: README 改写

**Files:**
- Modify: `README.md`
- Delete: `README.en.md`（保留也行，但统一中文）

- [x] **Step 1: 用以下内容覆盖 README.md**

```markdown
# Trae Salary 工资计算器

Taro 多端（微信小程序为主）的工资计算器和记账工具，支持**多设备云同步**。

## 功能特性

- 实时计算每秒工资、日薪、月薪
- 工资明细、发薪日倒计时、今日进度可视化
- 完整记账功能（分类、图表、统计）
- 多设备云同步（注册账号后数据自动同步）
- 中国节假日智能识别（数据云端自动更新）

## 项目结构

```
trae-salary/
├── client/    前端（Taro 微信小程序）
├── server/    后端（Node.js + Fastify + Prisma + SQLite）
├── deploy/    部署（Docker Compose + Caddy）
├── data/      运行时数据（gitignore）
└── docs/      设计文档
```

## 一、本地开发

### 前端

```bash
cd client
npm install
npm run dev:weapp
```

然后用微信开发者工具导入 `client/dist/` 目录。

API 地址默认是 `http://localhost:3000`。要指向其他地址：

```bash
TARO_APP_API_BASE_URL=https://your-api.example.com npm run dev:weapp
```

### 后端

```bash
cd server
npm install
cp .env.example .env
# 编辑 .env，填入 JWT_SECRET（用 openssl rand -hex 32 生成）
npx prisma migrate dev
npm run dev
```

默认端口 3000。运行 `npm test` 跑全部测试。

## 二、部署到云服务器（生产环境）

### 前提条件

- 一台云服务器（最低 1 核 1GB 内存，推荐 2 核 2GB）
- 一个域名（如 `salary.example.com`），A 记录解析到服务器 IP
- 服务器 80 和 443 端口在防火墙开放

### 部署步骤

#### 1. 安装 Docker

```bash
ssh user@your-server-ip
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exit
# 重新登录 SSH
```

#### 2. 上传代码

```bash
# 在本地
scp -r trae-salary user@your-server-ip:/tmp/

# 在服务器
sudo mkdir -p /opt/trae-salary
sudo mv /tmp/trae-salary/* /opt/trae-salary/
sudo chown -R $USER:$USER /opt/trae-salary
cd /opt/trae-salary
```

#### 3. 配置环境变量和域名

```bash
cd deploy
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
nano Caddyfile  # 把所有 "your-domain.com" 替换为你的实际域名
```

#### 4. 启动

```bash
docker compose up -d
docker compose logs -f app
# 看到 "server listening on :3000" 即可 Ctrl+C 退出日志跟踪
```

首次启动时 Caddy 会自动向 Let's Encrypt 申请 HTTPS 证书。如果失败，查看 FAQ。

#### 5. 构建小程序（带正确 API 地址）

```bash
cd ../client
TARO_APP_API_BASE_URL=https://salary.example.com npm run build:weapp
```

然后用微信开发者工具打开 `client/dist/`，上传发布。

### 验证

```bash
curl https://salary.example.com/health
# 应返回 {"status":"ok","uptime":...}
```

打开小程序，注册账号，添加一笔记账。然后退出登录，在另一台设备登录同一账号，应能看到数据。

## 三、运维

### 查看运行状态

```bash
cd /opt/trae-salary/deploy
docker compose ps              # 容器状态
docker compose logs -f app     # 应用日志（Ctrl+C 退出）
tail -f ../logs/caddy/access.log  # 访问日志
```

### 重启服务

```bash
docker compose restart
```

### 升级代码

```bash
cd /opt/trae-salary
git pull  # 或重新上传新代码
cd deploy
docker compose up -d --build
```

### 数据备份

设置每日自动备份：

```bash
mkdir -p /backup
crontab -e
```

添加：

```
0 2 * * * cp /opt/trae-salary/data/salary.db /backup/salary-$(date +\%Y\%m\%d).db && find /backup -name "salary-*.db" -mtime +30 -delete
```

### 数据恢复

```bash
cd /opt/trae-salary/deploy
docker compose down
cp /backup/salary-YYYYMMDD.db /opt/trae-salary/data/salary.db
docker compose up -d
```

### 节假日同步日志

```bash
docker compose logs app | grep holiday-sync
```

正常情况下，启动时会有 `[holiday-sync] XXXX 缺失，开始从远程拉取...` 或 `[holiday-sync] 定时任务已注册`。

## 四、常见问题

**Q: 忘记密码怎么办？**

A: 当前版本不支持密码找回。如需重置：
```bash
cd /opt/trae-salary/deploy
docker compose exec app npx prisma studio
```
打开浏览器访问 `http://your-server-ip:5555`，手动修改 user 表的 passwordHash（用 bcrypt 在线工具生成新密码的哈希）。

**Q: 数据会丢吗？**

A: SQLite 数据在服务器本地，建议按上文开启每日备份。建议同时将 `/backup` 目录同步到云存储（OSS/S3）。

**Q: 怎么换域名？**

A: 修改 `deploy/Caddyfile` 中的域名，重新 `docker compose up -d` 即可。Caddy 会自动重新申请证书。

**Q: Caddy 证书申请失败？**

排查清单：
1. `curl ifconfig.me` 确认服务器 IP 正确
2. `nslookup your-domain.com` 确认 DNS 已生效
3. 服务器 80/443 端口是否开放：`sudo ufw status`
4. `docker compose logs caddy` 看具体错误

**Q: 怎么修改 API 地址（如换服务器）？**

A: 重新构建小程序时设置新的 `TARO_APP_API_BASE_URL`：
```bash
cd client
TARO_APP_API_BASE_URL=https://new-api.example.com npm run build:weapp
```

**Q: 服务端节假日同步失败会影响使用吗？**

A: 不会。失败时前端会按普通周末处理，业务正常运行。

## 五、技术栈

### 前端
- Taro 4.2 + React 18 + TypeScript
- Sass

### 后端
- Node.js 20 + Fastify 4
- Prisma 5 + SQLite
- bcrypt（密码哈希）
- jsonwebtoken（Token）
- node-cron（定时任务）
- Vitest（测试）

### 部署
- Docker + Docker Compose
- Caddy 2（自动 HTTPS）
```

- [x] **Step 2: 删除 README.en.md（如不需要英文版）**

```bash
git rm README.en.md
```

如果想保留作为国际化模板，跳过此步。

- [x] **Step 3: 提交**

```bash
git add README.md
git commit -m "docs: rewrite README with deployment, operations, and FAQ"
```

---

## Task 19: 端到端验证 + 部署

**Files:** 无新增，主要验证全流程

- [x] **Step 1: 本地启动后端**

```bash
cd server
npx tsx src/index.ts
```

预期：监听 :3000，启动日志显示节假日同步尝试。

- [x] **Step 2: 启动小程序**

```bash
cd client
npm run dev:weapp
```

打开微信开发者工具。

- [x] **Step 3: 完整流程测试**

| 步骤 | 预期 |
|------|------|
| 1. 打开小程序 | 跳到登录页 |
| 2. 注册新账号（username: e2e_user, password: test123） | 自动登录跳首页 |
| 3. 修改月薪为 8000 | 设置面板里修改后保存，看到 `[sync] PUT /api/config 200` |
| 4. 切换到记账模块 | 看到空列表 |
| 5. 添加一笔记账：35 元、餐饮 | 看到新条目，server 日志有 `POST /api/entries` |
| 6. 修改这笔记账为 50 元 | 看到金额变化，server 日志有 `PUT /api/entries/:id` |
| 7. 删除这笔记账 | 条目消失，server 日志有 `DELETE /api/entries/:id` |
| 8. 退出登录（在设置里加个"退出登录"按钮或清 storage） | 跳回登录页 |
| 9. 重新登录 | 数据恢复（之前加的记账应还在，但第 7 步删了的应该没了） |
| 10. 关闭 server，添加一笔记账 | 提示同步失败，仍显示在本地 |
| 11. 重启 server | 重试同步，新记账出现在云端 |

如果任何步骤失败，根据 server/小程序日志排查。

- [x] **Step 4: 添加"退出登录"按钮（如未实现）**

在首页设置面板底部加一个"退出登录"按钮，调用 `clearToken()` 后 reLaunch 到登录页。

- [x] **Step 5: 在云服务器部署（生产环境）**

按 README 第二节的步骤完整执行：
1. SSH 登录
2. 安装 Docker
3. 上传代码
4. 配置 .env 和 Caddyfile
5. `docker compose up -d`
6. 验证 `curl https://your-domain.com/health`
7. 在本地构建小程序：`TARO_APP_API_BASE_URL=https://your-domain.com npm run build:weapp`
8. 用微信开发者工具上传发布

- [x] **Step 6: 配置每日备份**

```bash
mkdir -p /backup
crontab -e
```

粘贴备份 cron（同 README）。

- [x] **Step 7: 提交（如有新增代码）**

```bash
git add .
git status  # 检查无意外文件
git commit -m "feat: end-to-end verification and production deployment"
```

如果没有改动，跳过此步。

- [x] **Step 8: 在 git 上加 tag 标记这次发布**

```bash
git tag -a v1.1.0 -m "添加后端，支持多设备同步"
git push origin v1.1.0  # 如果有远程仓库
```