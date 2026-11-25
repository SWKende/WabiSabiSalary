import { EXPENSE_CATEGORIES } from '../constants/bookkeeping'
import { parseRecordDateTime } from './format'
import type { BookkeepingRecord } from './store'

export interface ExpensePeriod {
  year: number
  month?: number // 1–12，省略时统计全年
}

interface CategoryTotal {
  name: string
  cents: number
  entries: { record: BookkeepingRecord; cents: number }[]
}

function categoryName(record: BookkeepingRecord): string {
  return record.category.trim() || '未分類'
}

export function getExpenseCategories(records: readonly BookkeepingRecord[]): string[] {
  const categories = new Set(EXPENSE_CATEGORIES)
  for (const record of records) {
    if (record.type === 'expense') categories.add(categoryName(record))
  }
  return [...categories]
}

export function summarizeExpenses(
  records: readonly BookkeepingRecord[],
  { year, month }: ExpensePeriod,
  selectedCategories: readonly string[],
): { totalCents: number; categories: CategoryTotal[] } {
  const selected = new Set(selectedCategories)
  const totals = new Map<string, CategoryTotal>()
  let totalCents = 0

  for (const record of records) {
    if (record.type !== 'expense') continue
    const name = categoryName(record)
    if (selected.size > 0 && !selected.has(name)) continue
    const date = parseRecordDateTime(record.time)
    if (!date || date.getFullYear() !== year) continue
    if (month !== undefined && date.getMonth() + 1 !== month) continue

    const cents = Math.round(Number.parseFloat(record.amount) * 100)
    if (!Number.isFinite(cents)) continue
    const category = totals.get(name) ?? { name, cents: 0, entries: [] }
    category.cents += cents
    category.entries.push({ record, cents })
    totals.set(name, category)
    totalCents += cents
  }

  return { totalCents, categories: [...totals.values()].sort((a, b) => b.cents - a.cents) }
}
