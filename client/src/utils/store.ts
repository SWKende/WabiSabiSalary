/**
 * 本地数据仓库：内存读 + 异步写队列。
 *
 * 为什么这么设计：页面代码（index.tsx / Bookkeeping）历史上全是同步
 * `Taro.getStorageSync` 读取，改成到处 await 会把 1000+ 行的组件搅乱。
 * 这里在启动时把 meta 表与 entries 表整体读进内存（个人记账量级下是几千条，
 * 一次性载入没有压力），同步读走内存，写入先进串行队列再落库。
 *
 * 后端选择：Capacitor 原生容器 → SQLite；纯浏览器开发 / 单元测试 → Taro storage 兜底。
 */
import Taro from '@tarojs/taro'
import {
  createCapacitorSqlExecutor,
  createSqlBackend,
  isNativeRuntime,
  type EntryRow,
  type MetaRow,
  type PersistBackend,
} from './db'

export type RecordType = 'expense' | 'income'

/** 记账记录（UI 层形状，amount 保持字符串以配合自定义数字键盘） */
export interface BookkeepingRecord {
  id: string
  type: RecordType
  amount: string
  note: string
  category: string
  /** 本地时间串 'YYYY-MM-DD HH:mm:ss' */
  time: string
}

/** 兼容旧数据：早期记录可能缺 type，按分类推断 */
function normalizeRecord(raw: Partial<BookkeepingRecord> & { id?: string; category?: string }): BookkeepingRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' && raw.id ? raw.id : createId()
  const category = typeof raw.category === 'string' ? raw.category : ''
  const type: RecordType =
    raw.type === 'income' || raw.type === 'expense'
      ? raw.type
      : category === '收入' || category === '収入'
        ? 'income'
        : 'expense'
  return {
    id,
    type,
    amount: typeof raw.amount === 'string' ? raw.amount : String(raw.amount ?? '0'),
    note: typeof raw.note === 'string' ? raw.note : '',
    category,
    time: typeof raw.time === 'string' ? raw.time : '',
  }
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function recordToRow(record: BookkeepingRecord, createdAt: string): EntryRow {
  return {
    id: record.id,
    type: record.type,
    amount: Number.parseFloat(record.amount) || 0,
    category: record.category,
    note: record.note || null,
    occurred_at: record.time,
    created_at: createdAt,
    updated_at: nowIso(),
  }
}

function rowToRecord(row: EntryRow): BookkeepingRecord {
  return {
    id: row.id,
    type: row.type === 'income' ? 'income' : 'expense',
    amount: String(row.amount),
    note: row.note ?? '',
    category: row.category,
    time: row.occurred_at,
  }
}

const LEGACY_ENTRY_KEY = 'bookkeeping_records'
const LEGACY_META_KEYS = [
  'salary_config',
  'bookkeeping_settings',
  'home_page_preference',
  'cn_holiday_dataset_v1',
] as const
const STORAGE_META_REGISTRY = 'local_meta_keys_v1'

function safeGetStorage(key: string): unknown {
  try {
    return Taro.getStorageSync(key)
  } catch {
    return null
  }
}

function safeSetStorage(key: string, value: unknown): void {
  try {
    Taro.setStorageSync(key, value)
  } catch {
    /* ignore */
  }
}

function safeRemoveStorage(key: string): void {
  try {
    Taro.removeStorageSync(key)
  } catch {
    /* ignore */
  }
}

function parseJSON(raw: unknown): unknown {
  if (raw == null || raw === '') return null
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * 兜底驱动：沿用历史 Taro storage key，让浏览器开发与测试的行为和迁移前一致。
 * 记账条目存在 LEGACY_ENTRY_KEY，meta 各占一个 key 并用注册表枚举。
 */
function createTaroStorageBackend(): PersistBackend {
  const readEntries = (): BookkeepingRecord[] => {
    const raw = parseJSON(safeGetStorage(LEGACY_ENTRY_KEY))
    if (!Array.isArray(raw)) return []
    return raw
      .map((item) => normalizeRecord(item as Partial<BookkeepingRecord>))
      .filter((item): item is BookkeepingRecord => item !== null)
  }

  const writeEntries = (records: BookkeepingRecord[]) => {
    safeSetStorage(LEGACY_ENTRY_KEY, records)
  }

  const readRegistry = (): string[] => {
    const raw = parseJSON(safeGetStorage(STORAGE_META_REGISTRY))
    return Array.isArray(raw) ? raw.map(String) : []
  }

  return {
    name: 'storage',
    async init() {
      /* 无需建表 */
    },
    async loadAllMeta() {
      const keys = Array.from(new Set([...LEGACY_META_KEYS, ...readRegistry()]))
      const rows: MetaRow[] = []
      for (const key of keys) {
        const raw = safeGetStorage(key)
        if (raw == null || raw === '') continue
        rows.push({
          key,
          value: typeof raw === 'string' ? raw : JSON.stringify(raw),
          updated_at: nowIso(),
        })
      }
      return rows
    },
    async writeMeta(row) {
      safeSetStorage(row.key, row.value)
      const registry = readRegistry()
      if (!registry.includes(row.key)) {
        safeSetStorage(STORAGE_META_REGISTRY, JSON.stringify([...registry, row.key]))
      }
    },
    async deleteMeta(key) {
      safeRemoveStorage(key)
      safeSetStorage(STORAGE_META_REGISTRY, JSON.stringify(readRegistry().filter((k) => k !== key)))
    },
    async loadAllEntries() {
      return readEntries().map((record) => recordToRow(record, nowIso()))
    },
    async upsertEntry(row) {
      const records = readEntries()
      const next = rowToRecord(row)
      const index = records.findIndex((r) => r.id === row.id)
      if (index >= 0) records.splice(index, 1, next)
      else records.unshift(next)
      writeEntries(records)
    },
    async deleteEntry(id) {
      writeEntries(readEntries().filter((r) => r.id !== id))
    },
  }
}

/** 把历史 Taro storage 数据搬进 SQL 后端；只在 SQLite 首次建库且本地有旧数据时执行 */
async function migrateFromStorage(backend: PersistBackend): Promise<{ entries: number; meta: number }> {
  const summary = { entries: 0, meta: 0 }

  const rawEntries = parseJSON(safeGetStorage(LEGACY_ENTRY_KEY))
  if (Array.isArray(rawEntries)) {
    for (const item of rawEntries) {
      const record = normalizeRecord(item as Partial<BookkeepingRecord>)
      if (!record) continue
      await backend.upsertEntry(recordToRow(record, nowIso()))
      summary.entries += 1
    }
  }

  for (const key of LEGACY_META_KEYS) {
    const raw = safeGetStorage(key)
    if (raw == null || raw === '') continue
    await backend.writeMeta({ key, value: typeof raw === 'string' ? raw : JSON.stringify(raw), updated_at: nowIso() })
    summary.meta += 1
  }

  return summary
}

let backend: PersistBackend | null = null
let ready = false
let bootstrapping: Promise<void> | null = null
let writeTail: Promise<void> = Promise.resolve()
const metaCache = new Map<string, unknown>()
let entryCache: BookkeepingRecord[] = []
/** 记录 created_at，upsert 时不覆盖首次创建时间 */
const createdAtCache = new Map<string, string>()
const readyListeners = new Set<() => void>()
/** 启动时的运行环境快照，供诊断使用（见 storageDiagnostics） */
let nativeAtBootstrap = false
/** 降级原因。真机上看不到 console，只能把它渲染到界面上 */
let degradeReason: string | null = null

function summarizeError(err: unknown): string {
  let text: string
  if (err instanceof Error) text = err.message
  else if (typeof err === 'string') text = err
  else {
    const e = err as { message?: string; errMsg?: string } | null
    try {
      text = e?.message || e?.errMsg || JSON.stringify(err)
    } catch {
      text = String(err)
    }
  }
  return text.length > 160 ? `${text.slice(0, 160)}…` : text
}

/** 原生桥接最坏情况下的等待上限；超过即降级到 storage，避免页面一直等在占位上 */
const DEFAULT_OPEN_TIMEOUT_MS = 4000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`本地库打开超时（${ms}ms）`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function markReady(): void {
  ready = true
  readyListeners.forEach((listener) => listener())
}

/** 订阅 store 就绪事件；页面用它决定挂载真实内容还是留白 */
export function subscribeStoreReady(listener: () => void): () => void {
  readyListeners.add(listener)
  return () => {
    readyListeners.delete(listener)
  }
}

function enqueueWrite(label: string, task: () => Promise<void>): void {
  writeTail = writeTail.then(task).catch((err) => {
    console.warn(`[store] ${label} 落库失败`, err)
  })
}

/** 等所有排队写入落库（测试与退出前用） */
export function flushStore(): Promise<void> {
  return writeTail
}

export function isStoreReady(): boolean {
  return ready
}

export function storeBackendName(): string {
  return backend?.name ?? 'none'
}

/**
 * 存储后端诊断。degraded 才是关键信号：真机上本该用 SQLite，
 * 若为 true 说明原生库没打开成功、当前数据其实落在 storage 里。
 *
 * native 取的是**启动时**的探测结果，不能在这里重新问一次：@capacitor/core 被 import 之后
 * 会用真实对象覆盖 globalThis.Capacitor，届时再探测会把"本来在原生里"误判成浏览器。
 */
export function storageDiagnostics(): { backend: string; native: boolean; degraded: boolean; reason: string | null } {
  const name = storeBackendName()
  return {
    backend: name,
    native: nativeAtBootstrap,
    degraded: nativeAtBootstrap && name !== 'sqlite',
    reason: degradeReason,
  }
}

/**
 * 打开本地库并载入内存。可重复调用（幂等），并发调用共享同一个 promise。
 *
 * 无论走哪条路都必须 settle：原生桥接不返回、建表失败、插件缺失，一律在超时后降级到
 * storage 驱动。页面内容依赖 store 就绪才挂载，所以这里不能一直悬着，也不能抛出去。
 *
 * options.backend 可直接注入一个 PersistBackend（测试用），否则按运行环境自动选择。
 */
export function bootstrapStore(options: {
  backend?: 'sqlite' | 'storage' | PersistBackend
  openTimeoutMs?: number
} = {}): Promise<void> {
  if (ready) return Promise.resolve()
  if (bootstrapping) return bootstrapping

  const timeoutMs = options.openTimeoutMs ?? DEFAULT_OPEN_TIMEOUT_MS
  nativeAtBootstrap = isNativeRuntime()

  const openAndLoad = async (): Promise<PersistBackend> => {
    let active: PersistBackend
    if (typeof options.backend === 'object' && options.backend !== null) {
      active = options.backend
    } else if (options.backend === 'storage' || (options.backend !== 'sqlite' && !nativeAtBootstrap)) {
      active = createTaroStorageBackend()
    } else {
      active = createSqlBackend(await createCapacitorSqlExecutor())
    }

    await active.init()

    if (active.name === 'sqlite') {
      const [existingEntries, existingMeta] = await Promise.all([active.loadAllEntries(), active.loadAllMeta()])
      if (existingEntries.length === 0 && existingMeta.length === 0) {
        const moved = await migrateFromStorage(active)
        if (moved.entries > 0 || moved.meta > 0) {
          console.log(`[store] 已从本地 storage 迁移 记账 ${moved.entries} 条 / 配置 ${moved.meta} 项`)
        }
      }
    }

    const metaRows = await active.loadAllMeta()
    metaCache.clear()
    for (const row of metaRows) {
      const parsed = parseJSON(row.value)
      if (parsed !== null) metaCache.set(row.key, parsed)
    }

    const entryRows = await active.loadAllEntries()
    entryCache = entryRows.map(rowToRecord).filter((r): r is BookkeepingRecord => Boolean(r))
    for (const row of entryRows) createdAtCache.set(row.id, row.created_at)

    return active
  }

  bootstrapping = (async () => {
    let active: PersistBackend
    try {
      active = await withTimeout(openAndLoad(), timeoutMs)
    } catch (err) {
      degradeReason = summarizeError(err)
      console.warn('[store] 本地库打开失败或超时，降级到 storage 驱动', err)
      active = createTaroStorageBackend()
      await active.init()
      const metaRows = await active.loadAllMeta()
      metaCache.clear()
      for (const row of metaRows) {
        const parsed = parseJSON(row.value)
        if (parsed !== null) metaCache.set(row.key, parsed)
      }
      entryCache = (await active.loadAllEntries()).map(rowToRecord)
    }

    backend = active
    markReady()
  })().finally(() => {
    bootstrapping = null
  })

  return bootstrapping
}

/** 同步读配置；未 bootstrap 或未写入时返回 fallback。允许存字符串/数字等原始值 */
export function readJSON<T>(key: string, fallback: T): T {
  if (!metaCache.has(key)) return fallback
  const value = metaCache.get(key)
  if (value === undefined || value === null) return fallback
  return value as T
}

/** 同步写配置：立即更新内存，异步落库 */
export function writeJSON(key: string, value: unknown): void {
  metaCache.set(key, value)
  if (!backend) return
  const row: MetaRow = { key, value: JSON.stringify(value), updated_at: nowIso() }
  const target = backend
  enqueueWrite(`meta:${key}`, () => target.writeMeta(row))
}

export function removeMeta(key: string): void {
  metaCache.delete(key)
  if (!backend) return
  const target = backend
  enqueueWrite(`meta:${key}`, () => target.deleteMeta(key))
}

/** 全部记账记录，按时间倒序 */
export function listRecords(): BookkeepingRecord[] {
  return [...entryCache].sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0))
}

export function getRecord(id: string): BookkeepingRecord | null {
  return entryCache.find((r) => r.id === id) ?? null
}

/** 新增记录：同步返回带 id 的记录，异步落库 */
export function addRecord(input: Omit<BookkeepingRecord, 'id'> & { id?: string }): BookkeepingRecord {
  const record = normalizeRecord(input as Partial<BookkeepingRecord>)
  if (!record) throw new Error('[store] addRecord 需要合法记录')
  entryCache = [record, ...entryCache.filter((r) => r.id !== record.id)]
  createdAtCache.set(record.id, nowIso())
  if (backend) {
    const target = backend
    const row = recordToRow(record, createdAtCache.get(record.id) ?? nowIso())
    enqueueWrite(`entry:${record.id}`, () => target.upsertEntry(row))
  }
  return record
}

/** 更新记录（改金额/分类/备注/日期） */
export function updateRecord(id: string, patch: Partial<Omit<BookkeepingRecord, 'id'>>): BookkeepingRecord | null {
  const current = getRecord(id)
  if (!current) return null
  const next = normalizeRecord({ ...current, ...patch, id })
  if (!next) return null
  entryCache = entryCache.map((r) => (r.id === id ? next : r))
  if (backend) {
    const target = backend
    const row = recordToRow(next, createdAtCache.get(id) ?? nowIso())
    enqueueWrite(`entry:${id}`, () => target.upsertEntry(row))
  }
  return next
}

export function removeRecord(id: string): boolean {
  const exists = entryCache.some((r) => r.id === id)
  if (!exists) return false
  entryCache = entryCache.filter((r) => r.id !== id)
  createdAtCache.delete(id)
  if (backend) {
    const target = backend
    enqueueWrite(`entry:${id}`, () => target.deleteEntry(id))
  }
  return true
}

/** 仅供测试：清空模块级状态 */
export function __resetStore(): void {
  backend = null
  ready = false
  bootstrapping = null
  writeTail = Promise.resolve()
  metaCache.clear()
  entryCache = []
  createdAtCache.clear()
  readyListeners.clear()
  nativeAtBootstrap = false
  degradeReason = null
}
