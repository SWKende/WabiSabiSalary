import Taro from '@tarojs/taro'
import * as api from '../api'
import {
  toYYYYMMDD as toYYYYMMDDCore,
  normalizeYYYYMMDD as normalizeYYYYMMDDCore,
  uniqSorted as uniqSortedCore,
  extractTimorYearHolidayData,
} from './cnHolidayCore'

export type CnDayType = 'holiday' | 'workday' | 'normal' | 'unknown'

export interface CnHolidayDataset {
  years: number[]
  holidays: string[]
  workdays: string[]
  fetchedAt: string
  source: 'remote' | 'cache' | 'fallback'
}

const STORAGE_KEY = 'cn_holiday_dataset_v1'
const PROVIDER_BASE_URL = 'https://timor.tech/api/holiday/year/'

export function toYYYYMMDD(d: Date): string {
  return toYYYYMMDDCore(d)
}

export function normalizeYYYYMMDD(input: string, yearHint?: number): string | null {
  return normalizeYYYYMMDDCore(input, yearHint)
}

function uniqSorted(list: string[]): string[] {
  return uniqSortedCore(list) as string[]
}

function safeParseDataset(raw: any): CnHolidayDataset | null {
  if (!raw || typeof raw !== 'object') return null
  const years: number[] = Array.isArray(raw.years)
    ? (raw.years.filter((n: unknown) => Number.isInteger(n) && typeof n === 'number') as number[])
    : []
  const holidays: string[] = Array.isArray(raw.holidays) ? raw.holidays.map(String) : []
  const workdays: string[] = Array.isArray(raw.workdays) ? raw.workdays.map(String) : []
  const fetchedAt = typeof raw.fetchedAt === 'string' ? raw.fetchedAt : new Date(0).toISOString()
  const source =
    raw.source === 'remote' || raw.source === 'cache' || raw.source === 'fallback' ? raw.source : 'cache'
  const normalizedHolidays = uniqSorted(
    holidays
      .map((x: string) => normalizeYYYYMMDD(x))
      .filter((x): x is string => Boolean(x)),
  )
  const normalizedWorkdays = uniqSorted(
    workdays
      .map((x: string) => normalizeYYYYMMDD(x))
      .filter((x): x is string => Boolean(x)),
  )
  const normalizedYears = Array.from(new Set(years)).sort((a, b) => a - b)
  return {
    years: normalizedYears,
    holidays: normalizedHolidays,
    workdays: normalizedWorkdays,
    fetchedAt,
    source,
  }
}

export function readCnHolidayDatasetSync(): CnHolidayDataset | null {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return safeParseDataset(parsed)
  } catch {
    return null
  }
}

function writeCnHolidayDatasetSync(dataset: CnHolidayDataset) {
  try {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(dataset))
  } catch {
    /* ignore */
  }
}

export function classifyCnDate(dateYYYYMMDD: string, dataset: CnHolidayDataset | null): CnDayType {
  const date = normalizeYYYYMMDD(dateYYYYMMDD)
  if (!date) return 'unknown'
  if (!dataset) return 'unknown'
  if (dataset.workdays.includes(date)) return 'workday'
  if (dataset.holidays.includes(date)) return 'holiday'
  return 'normal'
}

function isCoveringYears(dataset: CnHolidayDataset | null, years: number[]): boolean {
  if (!dataset) return false
  return years.every((y) => dataset.years.includes(y))
}

async function fetchYearFromProvider(year: number): Promise<{ holidays: string[]; workdays: string[] }> {
  const url = `${PROVIDER_BASE_URL}${year}`
  const res = await Taro.request({ url, method: 'GET', timeout: 8000 })
  return extractTimorYearHolidayData(year, res.data) as { holidays: string[]; workdays: string[] }
}

export async function ensureCnHolidayDataset(params?: {
  baseDate?: Date
  years?: number[]
}): Promise<CnHolidayDataset> {
  const base = params?.baseDate ?? new Date()
  const years = params?.years ?? [base.getFullYear(), base.getFullYear() + 1, base.getFullYear() + 2]

  // 1. 优先读本地缓存
  const cached = readCnHolidayDatasetSync()
  if (isCoveringYears(cached, years)) return cached!

  // 2. 如果已登录，尝试从云端拉取
  if (api.getToken()) {
    try {
      const { years: yearData } = await api.getHolidays(years)
      const merged: CnHolidayDataset = safeParseDataset({
        years: uniqSorted([
          ...(cached?.years ?? []).map(String),
          ...yearData.map((y) => String(y.year)),
        ]).map((x) => Number(x)),
        holidays: uniqSorted([...(cached?.holidays ?? []), ...yearData.flatMap((y) => y.holidays)]),
        workdays: uniqSorted([...(cached?.workdays ?? []), ...yearData.flatMap((y) => y.workdays)]),
        fetchedAt: new Date().toISOString(),
        source: 'remote',
      })!
      if (isCoveringYears(merged, years)) {
        writeCnHolidayDatasetSync(merged)
        return merged
      }
      // 云端数据不足以覆盖全部年份，回退到 timor.tech 单年拉取
      const missingYears = years.filter((y) => !merged.years.includes(y))
      try {
        const fetched = await Promise.all(missingYears.map(fetchYearFromProvider))
        const enhanced: CnHolidayDataset = safeParseDataset({
          years: uniqSorted([
            ...merged.years.map(String),
            ...missingYears.map(String),
          ]).map((x) => Number(x)),
          holidays: uniqSorted([...merged.holidays, ...fetched.flatMap((x) => x.holidays)]),
          workdays: uniqSorted([...merged.workdays, ...fetched.flatMap((x) => x.workdays)]),
          fetchedAt: new Date().toISOString(),
          source: 'remote',
        })!
        writeCnHolidayDatasetSync(enhanced)
        return enhanced
      } catch {
        writeCnHolidayDatasetSync(merged)
        return merged
      }
    } catch (err) {
      console.warn('[cnHoliday] 云端拉取失败', err)
    }
  }

  // 3. 未登录或云端失败：尝试外部 timor.tech（覆盖所需年份）
  try {
    const fetched = await Promise.all(years.map(fetchYearFromProvider))
    const fromRemote: CnHolidayDataset = safeParseDataset({
      years: uniqSorted([
        ...(cached?.years ?? []).map(String),
        ...years.map(String),
      ]).map((x) => Number(x)),
      holidays: uniqSorted([...(cached?.holidays ?? []), ...fetched.flatMap((x) => x.holidays)]),
      workdays: uniqSorted([...(cached?.workdays ?? []), ...fetched.flatMap((x) => x.workdays)]),
      fetchedAt: new Date().toISOString(),
      source: 'remote',
    })!
    writeCnHolidayDatasetSync(fromRemote)
    return fromRemote
  } catch {
    // 4. 完全失败 → 返回本地缓存或空数据集
    return cached ?? {
      years: [],
      holidays: [],
      workdays: [],
      fetchedAt: new Date(0).toISOString(),
      source: 'cache',
    }
  }
}
