import Taro from '@tarojs/taro'
import { readJSON, writeJSON } from './store'
import { HOLIDAY_SEED, HOLIDAY_SEED_YEARS } from './holidaySeed'
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

/** 从本地库同步读取已缓存的节假日数据 */
export function readCnHolidayDatasetSync(): CnHolidayDataset | null {
  const raw = readJSON<any>(STORAGE_KEY, null)
  if (!raw) return null
  const parsed = typeof raw === 'string' ? safeParseDataset(tryParse(raw)) : safeParseDataset(raw)
  return parsed ? { ...parsed, source: 'cache' } : null
}

function tryParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function writeCnHolidayDataset(dataset: CnHolidayDataset): void {
  writeJSON(STORAGE_KEY, dataset)
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

/** 把内置静态数据里能覆盖的年份拼进数据集，用于断网兜底 */
function applySeed(years: number[], base: CnHolidayDataset | null): CnHolidayDataset {
  const covered = years.filter((y) => HOLIDAY_SEED_YEARS.includes(y))
  const extra = covered.map((y) => HOLIDAY_SEED[y])
  return {
    years: uniqSorted([...(base?.years ?? []).map(String), ...covered.map(String)]).map(Number).sort((a, b) => a - b),
    holidays: uniqSorted([...(base?.holidays ?? []), ...extra.flatMap((x) => x.holidays)]),
    workdays: uniqSorted([...(base?.workdays ?? []), ...extra.flatMap((x) => x.workdays)]),
    fetchedAt: base?.fetchedAt ?? new Date(0).toISOString(),
    source: 'fallback',
  }
}

/**
 * 保证拿到覆盖所需年份的节假日数据。
 *
 * 顺序：本地库缓存 → 直连 timor.tech（Capacitor 容器内由原生 HTTP 代发，不受 CORS 限制）
 * → 内置静态数据兜底。兜底结果不写缓存，下次启动仍会重试拉取。
 */
export async function ensureCnHolidayDataset(params?: {
  baseDate?: Date
  years?: number[]
}): Promise<CnHolidayDataset> {
  const base = params?.baseDate ?? new Date()
  const years = params?.years ?? [base.getFullYear(), base.getFullYear() + 1, base.getFullYear() + 2]

  const cached = readCnHolidayDatasetSync()
  if (isCoveringYears(cached, years)) return cached!

  const missingYears = years.filter((y) => !(cached?.years ?? []).includes(y))

  try {
    const fetched = await Promise.all(missingYears.map(fetchYearFromProvider))
    const merged: CnHolidayDataset = safeParseDataset({
      years: uniqSorted([...(cached?.years ?? []).map(String), ...missingYears.map(String)])
        .map(Number)
        .sort((a, b) => a - b),
      holidays: uniqSorted([...(cached?.holidays ?? []), ...fetched.flatMap((x) => x.holidays)]),
      workdays: uniqSorted([...(cached?.workdays ?? []), ...fetched.flatMap((x) => x.workdays)]),
      fetchedAt: new Date().toISOString(),
      source: 'remote',
    })!
    writeCnHolidayDataset(merged)
    return merged
  } catch (err) {
    console.warn('[cnHoliday] 拉取节假日失败，使用本地缓存或内置数据', err)
    return applySeed(years, cached)
  }
}
