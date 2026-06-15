import Taro from '@tarojs/taro'
import fallbackData from '../constants/cn-holiday-fallback.json'
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
  const years = Array.isArray(raw.years) ? raw.years.filter((n: any) => Number.isInteger(n)) : []
  const holidays = Array.isArray(raw.holidays) ? raw.holidays.map(String) : []
  const workdays = Array.isArray(raw.workdays) ? raw.workdays.map(String) : []
  const fetchedAt = typeof raw.fetchedAt === 'string' ? raw.fetchedAt : new Date(0).toISOString()
  const source =
    raw.source === 'remote' || raw.source === 'cache' || raw.source === 'fallback' ? raw.source : 'cache'
  const normalizedHolidays = uniqSorted(holidays.map((x) => normalizeYYYYMMDD(x)).filter(Boolean) as string[])
  const normalizedWorkdays = uniqSorted(workdays.map((x) => normalizeYYYYMMDD(x)).filter(Boolean) as string[])
  const normalizedYears = Array.from(new Set(years)).sort()
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

  const cached = readCnHolidayDatasetSync()
  if (isCoveringYears(cached, years)) return cached!

  const missingYears = years.filter((y) => !cached?.years.includes(y))
  try {
    const fetched = await Promise.all(missingYears.map(fetchYearFromProvider))
    const merged: CnHolidayDataset = safeParseDataset({
      years: uniqSorted([...(cached?.years ?? []), ...years]).map((x) => Number(x)),
      holidays: uniqSorted([...(cached?.holidays ?? []), ...fetched.flatMap((x) => x.holidays)]),
      workdays: uniqSorted([...(cached?.workdays ?? []), ...fetched.flatMap((x) => x.workdays)]),
      fetchedAt: new Date().toISOString(),
      source: 'remote',
    })!
    writeCnHolidayDatasetSync(merged)
    return merged
  } catch {
    if (cached) return { ...cached, source: 'cache' }
    const fb = safeParseDataset({ ...fallbackData, source: 'fallback' }) || {
      years: [],
      holidays: [],
      workdays: [],
      fetchedAt: new Date(0).toISOString(),
      source: 'fallback' as const,
    }
    return fb
  }
}
