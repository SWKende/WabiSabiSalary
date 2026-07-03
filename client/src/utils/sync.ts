import Taro from '@tarojs/taro'
import * as api from '../api'
import { ensureCnHolidayDataset } from './cnHoliday'

const PENDING_KEY = 'pending_sync_queue'
const CONFIG_KEY = 'salary_config'

export type PendingOp =
  | { type: 'createEntry'; payload: api.CreateEntryInput; tempId: string }
  | { type: 'updateEntry'; id: string; payload: Partial<api.CreateEntryInput> }
  | { type: 'deleteEntry'; id: string }
  | { type: 'updateConfig'; payload: Omit<api.SalaryConfig, 'updatedAt'> }

/** 本地存储的工资配置（包含云端 updatedAt 字段，便于做时间戳比较） */
type StoredConfig = api.SalaryConfig

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

function readStoredConfig(): StoredConfig | null {
  try {
    const raw = Taro.getStorageSync(CONFIG_KEY)
    if (raw && typeof raw === 'object') return raw as StoredConfig
  } catch {
    /* ignore */
  }
  return null
}

function writeStoredConfig(value: StoredConfig): void {
  try {
    Taro.setStorageSync(CONFIG_KEY, value)
  } catch {
    /* ignore */
  }
}

export function enqueueSync(op: PendingOp): void {
  const q = readQueue()
  q.push(op)
  writeQueue(q)
}

// ----- in-flight de-dupe -----
// initialSync can be called from login submit, index mount, and (defensively)
// the index initialSync wraparound all within ~1 second of first login.
// Without a guard we would triple-pull config / entries / holidays and
// triple-retry the pending queue, which can double-create entries.
let initialInflight: Promise<void> | null = null
let retryInflight: Promise<void> | null = null

export async function initialSync(): Promise<void> {
  if (!api.getToken()) return
  if (initialInflight) return initialInflight
  initialInflight = (async () => {
    // 工资配置（按 updatedAt 智能合并，避免覆盖本地更新的版本）
    try {
      const remote = await api.getConfig()
      const local = readStoredConfig()
      const remoteTs = remote.updatedAt ?? ''
      const localTs = (local?.updatedAt as string | null | undefined) ?? ''
      if (!local || (remoteTs && (!localTs || remoteTs > localTs))) {
        writeStoredConfig(remote)
      }
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
  })().finally(() => {
    initialInflight = null
  })
  return initialInflight
}

export async function retryPendingSyncs(): Promise<void> {
  if (!api.getToken()) return
  if (retryInflight) return retryInflight
  retryInflight = (async () => {
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
  })().finally(() => {
    retryInflight = null
  })
  return retryInflight
}
