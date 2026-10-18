import {
  addRecord,
  flushStore,
  listRecords,
  metaKeys,
  readJSON,
  removeMeta,
  removeRecord,
  writeJSON,
  type BookkeepingRecord,
} from './store'

export const BACKUP_APP = 'salary-clock'
export const BACKUP_VERSION = 1

/** 上次成功导出/导入的时间戳，存在 meta 里 */
export const BACKUP_STAMP_KEY = 'backup_last_done_at'
/** 超过这么多天没备份就开始提醒 */
export const BACKUP_REMINDER_DAYS = 30

const DAY_MS = 86_400_000

export function markBackupDone(): void {
  writeJSON(BACKUP_STAMP_KEY, new Date().toISOString())
}

/**
 * 设置面板那行小字该说什么，null 表示不用说。
 * 降级优先于天数 —— 那时数据在 WebView 缓存里，比 SQLite 更容易被系统清掉。
 */
export function backupNotice(state: { degraded: boolean }, now: number = Date.now()): string | null {
  if (state.degraded) {
    return '本地库异常，数据暂未落 SQLite，请立即导出备份'
  }

  const stamp = readJSON<unknown>(BACKUP_STAMP_KEY, '')
  const at = typeof stamp === 'string' ? Date.parse(stamp) : Number.NaN
  if (Number.isNaN(at)) {
    return '从未备份过，建议现在导出一份'
  }

  const days = Math.floor((now - at) / DAY_MS)
  if (days < BACKUP_REMINDER_DAYS) return null
  return `已 ${days} 天未备份，建议导出一份`
}

export interface BackupFile {
  app: string
  version: number
  exportedAt: string
  records: BookkeepingRecord[]
  meta: Record<string, unknown>
}

/** 当前全部数据。JSON 而非 .db：SQLite 与 storage 两条后端都能导入导出 */
export function dumpSnapshot(): BackupFile {
  const meta: Record<string, unknown> = {}
  for (const key of metaKeys()) {
    meta[key] = readJSON(key, null)
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    records: listRecords(),
    meta,
  }
}

/**
 * 解析并校验。必须在任何写入之前跑完：
 * 一个坏文件如果走到一半才发现不对，本机数据已经被清空了。
 */
export function parseBackup(raw: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('备份文件不是合法的 JSON')
  }
  if (!data || typeof data !== 'object') {
    throw new Error('备份文件内容不是对象')
  }

  const file = data as Partial<BackupFile>
  if (file.app !== BACKUP_APP) {
    throw new Error(`这不是工资时钟的备份（app = ${String(file.app)}）`)
  }
  if (file.version !== BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${String(file.version)}`)
  }
  if (!Array.isArray(file.records)) {
    throw new Error('备份缺少 records 数组')
  }
  if (!file.meta || typeof file.meta !== 'object' || Array.isArray(file.meta)) {
    throw new Error('备份缺少 meta 对象')
  }

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '',
    records: file.records,
    meta: file.meta as Record<string, unknown>,
  }
}

/** 整库覆盖：先清空，再写入备份内容 */
export async function applySnapshot(file: BackupFile): Promise<{ records: number; meta: number }> {
  for (const record of listRecords()) {
    removeRecord(record.id)
  }
  for (const key of metaKeys()) {
    removeMeta(key)
  }
  for (const [key, value] of Object.entries(file.meta)) {
    writeJSON(key, value)
  }
  for (const record of file.records) {
    addRecord(record)
  }
  await flushStore()

  return { records: file.records.length, meta: Object.keys(file.meta).length }
}
