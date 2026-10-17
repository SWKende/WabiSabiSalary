/**
 * 本地持久化后端抽象。
 *
 * 两条实现路径：
 * - `createSqlBackend`：真机（Capacitor WebView）走 `@capacitor-community/sqlite`，数据落在
 *   设备本地 SQLite 文件，可导出、可用 SQL 统计。
 * - `createTaroStorageBackend`（见 store.ts）：纯浏览器开发与单元测试用的兜底驱动，
 *   沿用历史 Taro storage key，保证不装安卓环境也能开发和测试。
 *
 * 上层 store.ts 只认 PersistBackend，不关心底下是 SQL 还是 KV。
 */

/** 记账条目行（SQL 表结构的一一映射，amount 用数值，time 存本地时间串不做时区转换） */
export interface EntryRow {
  id: string
  type: string
  amount: number
  category: string
  note: string | null
  occurred_at: string
  created_at: string
  updated_at: string
}

/** 配置/设置/缓存行，value 为 JSON 字符串 */
export interface MetaRow {
  key: string
  value: string
  updated_at: string
}

export interface PersistBackend {
  /** 'sqlite' | 'storage'，用于诊断与测试断言 */
  name: string
  init(): Promise<void>
  loadAllMeta(): Promise<MetaRow[]>
  writeMeta(row: MetaRow): Promise<void>
  deleteMeta(key: string): Promise<void>
  loadAllEntries(): Promise<EntryRow[]>
  upsertEntry(row: EntryRow): Promise<void>
  deleteEntry(id: string): Promise<void>
}

/** 最小 SQL 执行器抽象，方便用假驱动做单元测试 */
export interface SqlExecutor {
  /** 执行 DDL / 多语句脚本 */
  execute(sql: string): Promise<void>
  /** 执行写入语句 */
  run(sql: string, params?: unknown[]): Promise<void>
  /** 执行查询语句 */
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
}

/**
 * 建表语句。必须逐条执行：真机上把多条 DDL 拼成一串交给 @capacitor-community/sqlite，
 * 驱动会静默吞掉后面的语句，只建成第一张表，之后读取报 no such table: meta。
 */
export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    note TEXT,
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_entries_occurred ON entries(occurred_at DESC)`,
]

const REQUIRED_TABLES = ['entries', 'meta']

const UPSERT_ENTRY_SQL = `INSERT INTO entries
  (id, type, amount, category, note, occurred_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    type = excluded.type,
    amount = excluded.amount,
    category = excluded.category,
    note = excluded.note,
    occurred_at = excluded.occurred_at,
    updated_at = excluded.updated_at`

const UPSERT_META_SQL = `INSERT INTO meta (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`

/** 用任意 SqlExecutor 组装出 SQL 版后端；测试里传假执行器即可覆盖 */
export function createSqlBackend(executor: SqlExecutor): PersistBackend {
  return {
    name: 'sqlite',
    async init() {
      for (const sql of SCHEMA_STATEMENTS) {
        await executor.execute(sql)
      }
      // 自检：建表没成就在这一行炸，诊断能直接指出缺哪张表，
      // 而不是等到下游 SELECT 才报一句看不懂的 no such table
      const rows = await executor.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('${REQUIRED_TABLES.join("','")}')`,
      )
      const created = new Set(rows.map((r) => r.name))
      const missing = REQUIRED_TABLES.filter((t) => !created.has(t))
      if (missing.length > 0) {
        throw new Error(`建表后自检失败，本地库缺少 ${missing.join(' / ')}`)
      }
    },
    async loadAllMeta() {
      return executor.all<MetaRow>('SELECT key, value, updated_at FROM meta')
    },
    async writeMeta(row) {
      await executor.run(UPSERT_META_SQL, [row.key, row.value, row.updated_at])
    },
    async deleteMeta(key) {
      await executor.run('DELETE FROM meta WHERE key = ?', [key])
    },
    async loadAllEntries() {
      return executor.all<EntryRow>(
        'SELECT id, type, amount, category, note, occurred_at, created_at, updated_at FROM entries ORDER BY occurred_at DESC',
      )
    },
    async upsertEntry(row) {
      await executor.run(UPSERT_ENTRY_SQL, [
        row.id,
        row.type,
        row.amount,
        row.category,
        row.note,
        row.occurred_at,
        row.created_at,
        row.updated_at,
      ])
    },
    async deleteEntry(id) {
      await executor.run('DELETE FROM entries WHERE id = ?', [id])
    },
  }
}

/**
 * 是否跑在 Capacitor 原生容器里。
 * 读 globalThis.Capacitor 而不是 import @capacitor/core：零额外打包体积，
 * 且浏览器/测试环境天然为 false。
 */
export function isNativeRuntime(): boolean {
  const cap = (globalThis as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; isPluginAvailable?: (name: string) => boolean }
  }).Capacitor
  if (!cap) return false
  if (typeof cap.isNativePlatform === 'function' && !cap.isNativePlatform()) return false
  if (typeof cap.isPluginAvailable === 'function') return cap.isPluginAvailable('CapacitorSQLite')
  return true
}

/** 打开设备本地 SQLite 并返回执行器；仅在 isNativeRuntime() 为真时调用 */
export async function createCapacitorSqlExecutor(dbName = 'salary-clock'): Promise<SqlExecutor> {
  const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite')
  const connection = new SQLiteConnection(CapacitorSQLite)
  // 签名：createConnection(database, encrypted, mode, version, readonly)
  const db = await connection.createConnection(dbName, false, 'no-encryption', 1, false)
  await db.open()

  return {
    async execute(sql: string) {
      await db.execute(`${sql};`, true, true)
    },
    async run(sql: string, params: unknown[] = []) {
      await db.run(sql, params, false, 'no', true)
    },
    async all<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const res = await db.query(sql, params, true)
      return (res.values ?? []) as T[]
    },
  }
}
