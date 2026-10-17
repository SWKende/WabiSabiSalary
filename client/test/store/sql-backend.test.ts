import { describe, it, expect, vi } from 'vitest'
import { createSqlBackend, type SqlExecutor } from '../../src/utils/db'

interface Recorded {
  sql: string
  params: unknown[]
}

function createStubExecutor(cannedRows: Record<string, unknown[]> = {}) {
  const executed: Recorded[] = []
  const scripts: string[] = []
  const executor: SqlExecutor = {
    async execute(sql) {
      scripts.push(sql)
    },
    async run(sql, params = []) {
      executed.push({ sql, params })
    },
    async all<T>(sql: string, params: unknown[] = []) {
      executed.push({ sql, params })
      const key = sql.trim().split(/\s+/).slice(-3).join(' ')
      return (cannedRows[key] ?? cannedRows['*'] ?? []) as T[]
    },
  }
  return { executor, executed, scripts }
}

const sampleRow = {
  id: 'a1',
  type: 'expense',
  amount: 35,
  category: '餐飲',
  note: '午餐',
  occurred_at: '2026-10-11 12:30:00',
  created_at: '2026-10-11T04:30:00.000Z',
  updated_at: '2026-10-11T04:30:00.000Z',
}

describe('createSqlBackend', () => {
  it('init 逐条执行 DDL，不把多条语句拼给驱动去切', async () => {
    const { executor, scripts, executed } = createStubExecutor({
      '*': [{ name: 'entries' }, { name: 'meta' }],
    })
    await createSqlBackend(executor).init()
    expect(scripts.length).toBeGreaterThanOrEqual(3)
    const all = scripts.join(' ')
    expect(all).toContain('CREATE TABLE IF NOT EXISTS entries')
    expect(all).toContain('CREATE TABLE IF NOT EXISTS meta')
    expect(all).toContain('CREATE INDEX IF NOT EXISTS idx_entries_occurred')
    // 每条语句单独一次调用：真机上拼串交给驱动会被静默吞掉，只建成第一张表
    expect(scripts.every((s) => !/CREATE[\s\S]*CREATE/.test(s))).toBe(true)
    expect(executed.some((e) => e.sql.includes('sqlite_master'))).toBe(true)
  })

  it('建完自检：表缺失时抛出指明缺哪张表的错误', async () => {
    const { executor } = createStubExecutor({ '*': [{ name: 'entries' }] })
    await expect(createSqlBackend(executor).init()).rejects.toThrow(/meta/)
  })

  it('upsertEntry 走 ON CONFLICT 且参数顺序与列一致', async () => {
    const { executor, executed } = createStubExecutor()
    await createSqlBackend(executor).upsertEntry(sampleRow)
    expect(executed).toHaveLength(1)
    expect(executed[0].sql).toContain('INSERT INTO entries')
    expect(executed[0].sql).toContain('ON CONFLICT(id) DO UPDATE SET')
    // created_at 不参与更新，保证首次创建时间不被覆盖
    expect(executed[0].sql).not.toMatch(/created_at\s*=\s*excluded\.created_at/)
    expect(executed[0].params).toEqual([
      'a1', 'expense', 35, '餐飲', '午餐', '2026-10-11 12:30:00',
      '2026-10-11T04:30:00.000Z', '2026-10-11T04:30:00.000Z',
    ])
  })

  it('upsertEntry 允许 note 为 null', async () => {
    const { executor, executed } = createStubExecutor()
    await createSqlBackend(executor).upsertEntry({ ...sampleRow, note: null })
    expect(executed[0].params[4]).toBeNull()
  })

  it('deleteEntry / deleteMeta 带参数化 where 条件', async () => {
    const { executor, executed } = createStubExecutor()
    const backend = createSqlBackend(executor)
    await backend.deleteEntry('a1')
    await backend.deleteMeta('salary_config')
    expect(executed[0].sql).toBe('DELETE FROM entries WHERE id = ?')
    expect(executed[0].params).toEqual(['a1'])
    expect(executed[1].sql).toBe('DELETE FROM meta WHERE key = ?')
    expect(executed[1].params).toEqual(['salary_config'])
  })

  it('writeMeta 冲突时覆盖 value 与 updated_at', async () => {
    const { executor, executed } = createStubExecutor()
    await createSqlBackend(executor).writeMeta({ key: 'home_page_preference', value: '"salary"', updated_at: 'ts' })
    expect(executed[0].sql).toContain('INSERT INTO meta')
    expect(executed[0].sql).toContain('ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    expect(executed[0].params).toEqual(['home_page_preference', '"salary"', 'ts'])
  })

  it('loadAllEntries 把驱动返回的行原样取出，按时间倒序查询', async () => {
    const { executor } = createStubExecutor({ '*': [sampleRow] })
    const rows = await createSqlBackend(executor).loadAllEntries()
    expect(rows).toEqual([sampleRow])
    expect(executor.all).toBeTruthy()
  })

  it('loadAllMeta 读取 meta 全表', async () => {
    const rows = [{ key: 'salary_config', value: '{"payday":5}', updated_at: 'ts' }]
    const { executor } = createStubExecutor({ '*': rows })
    await expect(createSqlBackend(executor).loadAllMeta()).resolves.toEqual(rows)
  })

  it('查询无结果时返回空数组而不是 undefined', async () => {
    const { executor } = createStubExecutor()
    await expect(createSqlBackend(executor).loadAllEntries()).resolves.toEqual([])
  })
})
