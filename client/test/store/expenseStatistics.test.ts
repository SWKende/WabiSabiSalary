import { describe, expect, it } from 'vitest'
import { getExpenseCategories, summarizeExpenses } from '../../src/utils/expenseStatistics'
import type { BookkeepingRecord } from '../../src/utils/store'

const entries: BookkeepingRecord[] = [
  { id: '0', type: 'expense', category: '餐飲', amount: '30', note: '', time: '2027-01-01 00:00:00' },
  { id: '1', type: 'expense', category: '餐飲', amount: '0.10', note: '', time: '2026-12-31 23:59:59' },
  { id: '2', type: 'expense', category: '餐飲', amount: '0.20', note: '', time: '2026-12-01' },
  { id: '3', type: 'expense', category: '交通', amount: '3.50', note: '', time: '2026-12-01' },
  { id: '4', type: 'income', category: '薪資', amount: '90', note: '', time: '2026-12-01' },
  { id: '5', type: 'expense', category: '旅行', amount: '12.50', note: '', time: '2026-01-01' },
  { id: '6', type: 'expense', category: '', amount: '2', note: '', time: '2025-12-31' },
]

describe('expense statistics', () => {
  it('totals a calendar month in cents and ranks categories by amount', () => {
    const result = summarizeExpenses(entries, { year: 2026, month: 12 }, [])

    expect(result.totalCents).toBe(380)
    expect(result.categories.map(({ name, cents }) => [name, cents])).toEqual([
      ['交通', 350], ['餐飲', 30],
    ])
    expect(result.categories[1].entries.map(({ record }) => record.id)).toEqual(['1', '2'])
  })

  it('filters a calendar year by one or several categories', () => {
    expect(summarizeExpenses(entries, { year: 2026 }, ['餐飲']).totalCents).toBe(30)
    expect(summarizeExpenses(entries, { year: 2026 }, ['餐飲', '旅行']).totalCents).toBe(1280)
    expect(summarizeExpenses(entries, { year: 2026 }, []).totalCents).toBe(1630)
  })

  it('keeps historical and uncategorized expenses available across all periods', () => {
    expect(getExpenseCategories(entries)).toContain('旅行')
    expect(getExpenseCategories(entries)).not.toContain('薪資')
    expect(getExpenseCategories(entries)).toContain('未分類')
    expect(summarizeExpenses(entries, { year: 2025 }, ['未分類']).totalCents).toBe(200)
    expect(summarizeExpenses(entries, { year: 2026, month: 12 }, ['旅行'])).toEqual({
      totalCents: 0,
      categories: [],
    })
  })

  it('reads historical amounts the same way as the home charts', () => {
    const legacyEntries = [{ ...entries[5], amount: '12.50元' }]

    expect(summarizeExpenses(legacyEntries, { year: 2026 }, []).totalCents).toBe(1250)
  })
})
