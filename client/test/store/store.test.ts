import { describe, it, expect, vi, beforeEach } from 'vitest'

const { storage } = vi.hoisted(() => ({ storage: new Map<string, unknown>() }))

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key: string, value: unknown) => {
      storage.set(key, value)
    },
    removeStorageSync: (key: string) => {
      storage.delete(key)
    },
  },
}))

import {
  __resetStore,
  addRecord,
  bootstrapStore,
  flushStore,
  getRecord,
  isStoreReady,
  listRecords,
  readJSON,
  removeMeta,
  removeRecord,
  storeBackendName,
  updateRecord,
  writeJSON,
} from '../../src/utils/store'
import type { PersistBackend, EntryRow, MetaRow } from '../../src/utils/db'

function seedLegacy() {
  storage.set(
    'bookkeeping_records',
    JSON.stringify([
      { id: 'r1', amount: '35', note: '午餐', category: '餐飲', time: '2026-10-10 12:30:00' },
      { id: 'r2', type: 'income', amount: '5000', note: '十月工资', category: '薪資', time: '2026-10-01 09:00:00' },
      { id: 'r3', amount: '12', note: '地铁', category: '収入', time: '2026-10-09 08:10:00' },
    ]),
  )
  storage.set('salary_config', JSON.stringify({ monthlySalary: 30000, workStartHour: 9, workEndHour: 18, payday: 15 }))
  storage.set('home_page_preference', JSON.stringify('bookkeeping'))
}

function createFakeBackend(initial: { entries?: EntryRow[]; meta?: MetaRow[] } = {}) {
  const entries: EntryRow[] = [...(initial.entries ?? [])]
  const meta: MetaRow[] = [...(initial.meta ?? [])]
  const writes: string[] = []
  const backend: PersistBackend & { failNext?: boolean } = {
    name: 'sqlite',
    failNext: false,
    async init() {
      writes.push('init')
    },
    async loadAllMeta() {
      return [...meta]
    },
    async writeMeta(row) {
      if (backend.failNext) {
        backend.failNext = false
        throw new Error('disk full')
      }
      const index = meta.findIndex((m) => m.key === row.key)
      if (index >= 0) meta.splice(index, 1, row)
      else meta.push(row)
      writes.push(`meta:${row.key}`)
    },
    async deleteMeta(key) {
      const index = meta.findIndex((m) => m.key === key)
      if (index >= 0) meta.splice(index, 1)
      writes.push(`del-meta:${key}`)
    },
    async loadAllEntries() {
      return [...entries].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
    },
    async upsertEntry(row) {
      if (backend.failNext) {
        backend.failNext = false
        throw new Error('disk full')
      }
      const index = entries.findIndex((e) => e.id === row.id)
      if (index >= 0) entries.splice(index, 1, row)
      else entries.push(row)
      writes.push(`entry:${row.id}`)
    },
    async deleteEntry(id) {
      const index = entries.findIndex((e) => e.id === id)
      if (index >= 0) entries.splice(index, 1)
      writes.push(`del-entry:${id}`)
    },
  }
  return { backend, writes, entries, meta }
}

beforeEach(() => {
  storage.clear()
  __resetStore()
})

describe('bootstrapStore（浏览器/测试环境走 storage 兜底）', () => {
  it('未 bootstrap 前读到默认值，bootstrap 后读到已存数据', async () => {
    seedLegacy()
    expect(isStoreReady()).toBe(false)
    expect(readJSON('salary_config', { payday: 1 })).toEqual({ payday: 1 })

    await bootstrapStore()

    expect(isStoreReady()).toBe(true)
    expect(storeBackendName()).toBe('storage')
    expect(readJSON('salary_config', { payday: 1 })).toEqual({
      monthlySalary: 30000, workStartHour: 9, workEndHour: 18, payday: 15,
    })
  })

  it('旧记录缺 type 时按分类推断，且保留原始字段', async () => {
    seedLegacy()
    await bootstrapStore()
    const records = listRecords()
    expect(records.map((r) => r.id)).toEqual(['r1', 'r3', 'r2'])
    expect(getRecord('r1')?.type).toBe('expense')
    expect(getRecord('r3')?.type).toBe('income')
    expect(getRecord('r2')?.amount).toBe('5000')
  })

  it('字符串型配置（首页偏好）可以原样读回', async () => {
    seedLegacy()
    await bootstrapStore()
    expect(readJSON('home_page_preference', 'salary')).toBe('bookkeeping')
  })

  it('重复 bootstrap 幂等，不会把内存态冲掉', async () => {
    await bootstrapStore()
    writeJSON('salary_config', { payday: 3 })
    await bootstrapStore()
    expect(readJSON('salary_config', { payday: 1 })).toEqual({ payday: 3 })
  })

  it('要求 sqlite 但原生插件不可用时降级到 storage 且不抛错', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    seedLegacy()
    await bootstrapStore({ backend: 'sqlite' })
    expect(storeBackendName()).toBe('storage')
    expect(isStoreReady()).toBe(true)
    expect(warn).toHaveBeenCalled()
    expect(readJSON('salary_config', { payday: 1 })).toMatchObject({ payday: 15 })
    warn.mockRestore()
  })
})

describe('writeJSON / readJSON', () => {
  it('同步更新内存、异步落库', async () => {
    await bootstrapStore()
    writeJSON('bookkeeping_settings', { showWeeklyBar: false, showMonthlyBar: true, showMonthlyPie: true })
    expect(readJSON('bookkeeping_settings', { showWeeklyBar: true }).showWeeklyBar).toBe(false)
    await flushStore()
    expect(JSON.parse(String(storage.get('bookkeeping_settings')))).toMatchObject({ showWeeklyBar: false })
  })

  it('removeMeta 同时清内存与存储', async () => {
    await bootstrapStore()
    writeJSON('salary_config', { payday: 7 })
    await flushStore()
    removeMeta('salary_config')
    await flushStore()
    expect(readJSON('salary_config', { payday: 1 })).toEqual({ payday: 1 })
    expect(storage.get('salary_config')).toBeUndefined()
  })

  it('未写入过的 key 返回 fallback', async () => {
    await bootstrapStore()
    expect(readJSON('never_written', { fallback: true })).toEqual({ fallback: true })
  })
})

describe('记账 CRUD', () => {
  it('addRecord 立即进内存并异步落库', async () => {
    await bootstrapStore()
    const created = addRecord({ type: 'expense', amount: '28', note: '咖啡', category: '餐飲', time: '2026-10-11 10:00:00' })
    expect(created.id).toBeTruthy()
    expect(listRecords()[0]).toMatchObject({ id: created.id, amount: '28' })
    await flushStore()
    const persisted = storage.get('bookkeeping_records') as Array<Record<string, unknown>>
    expect(persisted[0]).toMatchObject({ id: created.id, type: 'expense', amount: '28' })
  })

  it('listRecords 按时间倒序，与插入顺序无关', async () => {
    await bootstrapStore()
    addRecord({ type: 'expense', amount: '1', note: '', category: '餐飲', time: '2026-01-01 09:00:00' })
    addRecord({ type: 'expense', amount: '2', note: '', category: '餐飲', time: '2026-09-09 09:00:00' })
    addRecord({ type: 'expense', amount: '3', note: '', category: '餐飲', time: '2026-03-03 09:00:00' })
    expect(listRecords().map((r) => r.amount)).toEqual(['2', '3', '1'])
  })

  it('updateRecord 只改传入字段，其余保留', async () => {
    seedLegacy()
    await bootstrapStore()
    const next = updateRecord('r1', { amount: '42', category: '娛樂' })
    expect(next).toMatchObject({ id: 'r1', amount: '42', category: '娛樂', note: '午餐', type: 'expense' })
    await flushStore()
    const persisted = storage.get('bookkeeping_records') as Array<Record<string, unknown>>
    expect(persisted.find((r) => r.id === 'r1')).toMatchObject({ amount: '42', category: '娛樂' })
  })

  it('updateRecord 对不存在的 id 返回 null', async () => {
    await bootstrapStore()
    expect(updateRecord('missing', { amount: '1' })).toBeNull()
  })

  it('removeRecord 返回是否删掉，并同步存储', async () => {
    seedLegacy()
    await bootstrapStore()
    expect(removeRecord('r3')).toBe(true)
    expect(removeRecord('r3')).toBe(false)
    await flushStore()
    expect(listRecords().map((r) => r.id)).toEqual(['r1', 'r2'])
  })
})

describe('写队列（注入假后端）', () => {
  it('写入按调用顺序串行落库', async () => {
    const { backend, writes } = createFakeBackend()
    await bootstrapStore({ backend })
    writeJSON('salary_config', { payday: 1 })
    addRecord({ type: 'expense', amount: '5', note: '', category: '餐飲', time: '2026-10-11 09:00:00' })
    writeJSON('bookkeeping_settings', { showWeeklyBar: true })
    await flushStore()

    const applied = writes.filter((w) => w !== 'init')
    expect(applied).toHaveLength(3)
    expect(applied[0]).toBe('meta:salary_config')
    expect(applied[1]).toMatch(/^entry:/)
    expect(applied[2]).toBe('meta:bookkeeping_settings')
  })

  it('单次落库失败只告警，不阻塞后续写入', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { backend, writes } = createFakeBackend()
    await bootstrapStore({ backend })
    backend.failNext = true
    writeJSON('salary_config', { payday: 2 })
    writeJSON('salary_config', { payday: 3 })
    await flushStore()

    expect(warn).toHaveBeenCalled()
    expect(writes.filter((w) => w === 'meta:salary_config')).toHaveLength(1)
    expect(readJSON('salary_config', { payday: 0 })).toEqual({ payday: 3 })
    warn.mockRestore()
  })

  it('假后端载入的记录按 occurred_at 倒序呈现，note 为 null 时回空串', async () => {
    const { backend } = createFakeBackend({
      meta: [{ key: 'salary_config', value: '{"payday":28}', updated_at: 'ts' }],
      entries: [
        {
          id: 'x1', type: 'income', amount: 800, category: '獎金', note: null,
          occurred_at: '2026-05-05 10:00:00', created_at: 'ts', updated_at: 'ts',
        },
        {
          id: 'x2', type: 'expense', amount: 12.5, category: '交通', note: '打车',
          occurred_at: '2026-06-06 08:00:00', created_at: 'ts', updated_at: 'ts',
        },
      ],
    })
    await bootstrapStore({ backend })

    expect(readJSON('salary_config', { payday: 1 })).toEqual({ payday: 28 })
    expect(listRecords().map((r) => r.id)).toEqual(['x2', 'x1'])
    expect(getRecord('x1')).toEqual({
      id: 'x1', type: 'income', amount: '800', note: '', category: '獎金', time: '2026-05-05 10:00:00',
    })
  })

  it('空库首次启动会把旧 storage 数据迁移进 SQL 后端', async () => {
    seedLegacy()
    const { backend, writes } = createFakeBackend({ entries: [], meta: [] })
    await bootstrapStore({ backend })
    await flushStore()

    expect(writes.filter((w) => w.startsWith('entry:'))).toHaveLength(3)
    expect(writes).toContain('meta:salary_config')
    expect(writes).toContain('meta:home_page_preference')
    expect(listRecords().map((r) => r.id)).toEqual(['r1', 'r3', 'r2'])
  })

  it('库里已有数据时不重复迁移', async () => {
    seedLegacy()
    const { backend, writes } = createFakeBackend({
      meta: [{ key: 'salary_config', value: '{"payday":28}', updated_at: 'ts' }],
      entries: [
        {
          id: 'keep', type: 'expense', amount: 1, category: '餐飲', note: null,
          occurred_at: '2026-01-01 09:00:00', created_at: 'ts', updated_at: 'ts',
        },
      ],
    })
    await bootstrapStore({ backend })
    expect(writes.filter((w) => w.startsWith('entry:'))).toHaveLength(0)
    expect(readJSON('salary_config', { payday: 1 })).toEqual({ payday: 28 })
    expect(listRecords().map((r) => r.id)).toEqual(['keep'])
  })
})
