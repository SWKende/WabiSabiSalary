import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage = new Map<string, unknown>()
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value) },
    removeStorageSync: (key: string) => { storage.delete(key) },
  },
}))

import * as store from '../../src/utils/store'
import {
  BACKUP_APP,
  BACKUP_VERSION,
  BACKUP_REMINDER_DAYS,
  BACKUP_STAMP_KEY,
  applySnapshot,
  backupNotice,
  dumpSnapshot,
  markBackupDone,
  parseBackup,
  type BackupFile,
} from '../../src/utils/backup'

const record = (id: string, amount: number) => ({
  id,
  type: 'expense' as const,
  amount,
  category: '餐飲',
  note: '午餐',
  time: '2026-10-11 12:30:00',
})

async function bootstrapWithData() {
  storage.clear()
  store.__resetStore()
  await store.bootstrapStore()
}

describe('parseBackup', () => {
  const good: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: '2026-10-18T00:00:00.000Z',
    records: [record('a', 35)],
    meta: { salary_config: { monthlySalary: 3000 } },
  }

  it('接受结构完整的备份', () => {
    expect(parseBackup(JSON.stringify(good)).records).toHaveLength(1)
  })

  // 校验必须发生在写入之前：否则一个坏文件会先把本机数据清空
  it.each([
    ['不是 JSON', 'not json at all'],
    ['app 不对', JSON.stringify({ ...good, app: 'other' })],
    ['version 不认识', JSON.stringify({ ...good, version: 999 })],
    ['records 不是数组', JSON.stringify({ ...good, records: 'x' })],
    ['meta 不是对象', JSON.stringify({ ...good, meta: [] })],
    ['缺 records 字段', JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, meta: {} })],
  ])('拒绝非法备份（%s）', (_label, raw) => {
    expect(() => parseBackup(raw)).toThrow()
  })
})

describe('备份提醒', () => {
  beforeEach(async () => {
    await bootstrapWithData()
  })

  it('从未备份过时给出「从未备份」提示', () => {
    expect(backupNotice({ degraded: false })).toContain('从未备份')
  })

  it('markBackupDone 之后短期内不再打扰', async () => {
    markBackupDone()
    await store.flushStore()
    expect(backupNotice({ degraded: false })).toBeNull()
  })

  it('超过 BACKUP_REMINDER_DAYS 天重新提醒，并带上天数', () => {
    const stale = new Date(Date.now() - (BACKUP_REMINDER_DAYS + 5) * 86_400_000).toISOString()
    store.writeJSON(BACKUP_STAMP_KEY, stale)
    const notice = backupNotice({ degraded: false })
    expect(notice).toContain(String(BACKUP_REMINDER_DAYS + 5))
  })

  // 降级时数据落在 WebView 缓存里，比 SQLite 更容易被清掉，所以不等天数直接提醒
  it('降级时立刻提醒，不管上次备份多久以前', async () => {
    markBackupDone()
    await store.flushStore()
    expect(backupNotice({ degraded: true })).toContain('本地库异常')
  })

  it('时间戳被写坏时按「从未备份」处理，不崩', () => {
    store.writeJSON(BACKUP_STAMP_KEY, '昨天说的')
    expect(backupNotice({ degraded: false })).toContain('从未备份')
  })
})

describe('dumpSnapshot / applySnapshot', () => {
  beforeEach(async () => {
    await bootstrapWithData()
  })

  it('dump 仅导出记账与仍使用的配置', async () => {
    store.addRecord(record('a', 35))
    store.addRecord(record('b', 12))
    store.writeJSON('salary_config', { monthlySalary: 3000 })
    store.writeJSON('home_page_preference', 'salary')
    store.writeJSON('cn_holiday_dataset_v1', { byDate: {} })
    store.writeJSON('bookkeeping_settings', { showMonthlyBar: false })
    await store.flushStore()

    const dump = dumpSnapshot()
    expect(dump.app).toBe(BACKUP_APP)
    expect(dump.records.map((r) => r.id).sort()).toEqual(['a', 'b'])
    expect(dump.meta).toEqual({ bookkeeping_settings: { showMonthlyBar: false } })
  })

  it('往返一致：dump → apply → dump 内容不变', async () => {
    store.addRecord(record('a', 35))
    store.writeJSON('bookkeeping_settings', { showMonthlyPie: false })
    await store.flushStore()

    const first = dumpSnapshot()
    await applySnapshot(first)
    const second = dumpSnapshot()

    expect(second.records).toEqual(first.records)
    expect(second.meta).toEqual(first.meta)
  })

  it('旧工资时钟备份可恢复账目和图表设置，但不恢复已下线的配置', async () => {
    const oldBackup = JSON.stringify({
      app: 'salary-clock',
      version: 1,
      records: [{ ...record('income', 5000), type: 'income', category: '薪資' }],
      meta: {
        salary_config: { monthlySalary: 5000 },
        home_page_preference: 'salary',
        cn_holiday_dataset_v1: { byDate: {} },
        bookkeeping_settings: { showWeeklyBar: false },
      },
    })

    const parsed = parseBackup(oldBackup)
    expect(parsed.meta).toEqual({ bookkeeping_settings: { showWeeklyBar: false } })
    await applySnapshot(parsed)

    expect(store.listRecords()).toMatchObject([{ type: 'income', category: '薪資', amount: '5000' }])
    expect(store.metaKeys()).toEqual(['bookkeeping_settings'])
  })

  it('apply 是整库覆盖：本机多出来的记录会被清掉', async () => {
    store.addRecord(record('keep', 1))
    store.addRecord(record('gone', 2))
    await store.flushStore()

    const backup: BackupFile = {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: '2026-10-18T00:00:00.000Z',
      records: [record('keep', 1)],
      meta: {},
    }
    const result = await applySnapshot(backup)

    expect(result.records).toBe(1)
    expect(store.listRecords().map((r) => r.id)).toEqual(['keep'])
  })

  it('apply 会清掉备份里没有的旧配置', async () => {
    store.writeJSON('home_page_preference', 'bookkeeping')
    await store.flushStore()
    expect(store.readJSON('home_page_preference', null)).toBe('bookkeeping')

    await applySnapshot({
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: '2026-10-18T00:00:00.000Z',
      records: [],
      meta: {},
    })

    expect(store.readJSON('home_page_preference', null)).toBeNull()
  })

  it('非法备份在写入前就被挡下，现有数据不受影响', async () => {
    store.addRecord(record('a', 35))
    await store.flushStore()

    expect(() => parseBackup('{"app":"wrong","version":1,"records":[],"meta":{}}')).toThrow()
    expect(store.listRecords()).toHaveLength(1)
  })

  it.each([null, {}, { amount: { toString: null }, time: '2026-10-11' }])(
    '拒绝带有损坏账目的备份：%j',
    async (invalidRecord) => {
      store.addRecord(record('keep', 35))
      await store.flushStore()
      const raw = JSON.stringify({ ...dumpSnapshot(), records: [record('valid', 10), invalidRecord] })

      expect(() => parseBackup(raw)).toThrow('第 2 条')
      expect(store.listRecords().map((entry) => entry.id)).toEqual(['keep'])
    },
  )
})
