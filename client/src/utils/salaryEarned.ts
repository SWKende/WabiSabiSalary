import { classifyCnDate, toYYYYMMDD } from './cnHolidayCore'
import type { CnHolidayDataset } from './cnHoliday'

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6

export function resolveIsWorkday(d: Date, dataset: CnHolidayDataset | null): boolean {
  const type = classifyCnDate(toYYYYMMDD(d), dataset)
  if (type === 'workday') return true
  if (type === 'holiday') return false
  return !isWeekend(d)
}

/** 闭区间 [start, endInclusive] 内的工作日数；起止颠倒返回 0 */
export function countWorkdaysBetween(
  start: Date,
  endInclusive: Date,
  dataset: CnHolidayDataset | null,
): number {
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(endInclusive.getFullYear(), endInclusive.getMonth(), endInclusive.getDate())
  let count = 0
  while (cursor <= last) {
    if (resolveIsWorkday(cursor, dataset)) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export function countWorkdaysInMonth(
  year: number,
  month: number,
  dataset: CnHolidayDataset | null,
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (resolveIsWorkday(new Date(year, month, day), dataset)) count += 1
  }
  return Math.max(1, count)
}

/** 发薪周期起点：本月发薪日；本月还没到就回退到上月发薪日 */
export function payPeriodStart(now: Date, payday: number): Date {
  return now.getDate() >= payday
    ? new Date(now.getFullYear(), now.getMonth(), payday)
    : new Date(now.getFullYear(), now.getMonth() - 1, payday)
}

/**
 * 本发薪周期内、今天之前已完成的工作日数。
 * 必须按工作日而非自然日计：日薪的分母是当月工作日数，
 * 用自然日做分子会在有周末/假日的月份里提前超出月薪。
 */
export function completedWorkdaysInPeriod(
  now: Date,
  payday: number,
  dataset: CnHolidayDataset | null,
): number {
  const start = payPeriodStart(now, payday)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (yesterday < start) return 0
  return countWorkdaysBetween(start, yesterday, dataset)
}
