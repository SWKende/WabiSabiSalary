import { describe, it, expect } from 'vitest'
import {
  completedWorkdaysInPeriod,
  countWorkdaysBetween,
  countWorkdaysInMonth,
  payPeriodStart,
  resolveIsWorkday,
} from '../../src/utils/salaryEarned'
import { HOLIDAY_SEED } from '../../src/utils/holidaySeed'
import type { CnHolidayDataset } from '../../src/utils/cnHoliday'

// 用真实的 2026 内置数据集，避免测试和线上数据各说各话
const dataset: CnHolidayDataset = {
  years: [2026],
  holidays: HOLIDAY_SEED[2026].holidays,
  workdays: HOLIDAY_SEED[2026].workdays,
  fetchedAt: '2026-01-01T00:00:00.000Z',
  source: 'fallback',
}

const oct = (day: number) => new Date(2026, 9, day, 13, 20, 0)

describe('工作日判定', () => {
  it('普通工作日算', () => {
    expect(resolveIsWorkday(new Date(2026, 9, 8), dataset)).toBe(true)
  })

  it('周末不算', () => {
    expect(resolveIsWorkday(new Date(2026, 9, 17), dataset)).toBe(false)
  })

  it('法定假日不算（10/5 是周一）', () => {
    expect(resolveIsWorkday(new Date(2026, 9, 5), dataset)).toBe(false)
  })

  it('周末调休上班算（10/10 是周六）', () => {
    expect(resolveIsWorkday(new Date(2026, 9, 10), dataset)).toBe(true)
  })
})

describe('countWorkdaysInMonth', () => {
  it('2026 年 10 月是 18 个工作日', () => {
    expect(countWorkdaysInMonth(2026, 9, dataset)).toBe(18)
  })
})

describe('countWorkdaysBetween', () => {
  it('闭区间计数，且首尾都算', () => {
    // 10/8、10/9 两个工作日
    expect(countWorkdaysBetween(new Date(2026, 9, 8), new Date(2026, 9, 9), dataset)).toBe(2)
  })

  it('起止顺序颠倒时返回 0 而不是负数', () => {
    expect(countWorkdaysBetween(new Date(2026, 9, 9), new Date(2026, 9, 8), dataset)).toBe(0)
  })
})

describe('completedWorkdaysInPeriod', () => {
  it('发薪日 1 日、10/21：周期内已完成 10 个工作日', () => {
    // 10/2~10/20 里的工作日：8、9、10(调休)、12-16、19、20
    expect(completedWorkdaysInPeriod(oct(21), 1, dataset)).toBe(10)
  })

  it('发薪日就是今天：一个完成日都没有', () => {
    expect(completedWorkdaysInPeriod(oct(21), 21, dataset)).toBe(0)
  })

  it('发薪日 15 日、10/21：10/15~10/20 共 4 个工作日', () => {
    expect(completedWorkdaysInPeriod(oct(21), 15, dataset)).toBe(4)
  })

  it('跨月周期：发薪日 25 日、11/3 已完成 6 个工作日', () => {
    // 10/25~11/2：10/26-30 五个 + 11/2 一个；10/25、10/31、11/1 分别是周日、周六、周日
    expect(completedWorkdaysInPeriod(new Date(2026, 10, 3, 10, 0, 0), 25, dataset)).toBe(6)
  })

  it('周期起点落在上月时也能算对', () => {
    expect(payPeriodStart(new Date(2026, 10, 3), 25)).toEqual(new Date(2026, 9, 25))
  })
})
