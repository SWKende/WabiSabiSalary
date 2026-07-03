import Taro from '@tarojs/taro'
import * as api from '../api'
import { ensureCnHolidayDataset } from './cnHoliday'

const PENDING_KEY = 'pending_sync_queue'

export type PendingOp =
  | { type: 'createEntry'; payload: api.CreateEntryInput; tempId: string }
  | { type: 'updateEntry'; id: string; payload: Partial<api.CreateEntryInput> }
  | { type: 'deleteEntry'; id: string }
  | { type: 'updateConfig'; payload: Omit<api.SalaryConfig, 'updatedAt'> }

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