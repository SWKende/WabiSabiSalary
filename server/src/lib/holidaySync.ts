import cron from 'node-cron'
import { prisma } from './db.js'

const REMOTE_BASE = 'https://timor.tech/api/holiday/year'

interface HolidayData {
  holidays: string[]
  workdays: string[]
}

function parseTimorResponse(year: number, json: any): HolidayData {
  const holidays: string[] = []
  const workdays: string[] = []
  const holidayMap = json?.holiday ?? {}

  for (const [mmdd, info] of Object.entries(holidayMap)) {
    const date = `${year}${mmdd.replace('-', '')}`
    if ((info as any)?.holiday === true) {
      holidays.push(date)
    } else if ((info as any)?.holiday === false) {
      workdays.push(date)
    }
  }

  return { holidays: holidays.sort(), workdays: workdays.sort() }
}

async function fetchYear(year: number): Promise<HolidayData> {
  const res = await fetch(`${REMOTE_BASE}/${year}`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return parseTimorResponse(year, json)
}

async function upsertYear(year: number, data: HolidayData): Promise<void> {
  await prisma.cnHolidayYear.upsert({
    where: { year },
    update: {
      holidays: JSON.stringify(data.holidays),
      workdays: JSON.stringify(data.workdays),
      source: 'sync',
      updatedAt: new Date(),
    },
    create: {
      year,
      holidays: JSON.stringify(data.holidays),
      workdays: JSON.stringify(data.workdays),
      source: 'sync',
      note: `自动同步 @ ${new Date().toISOString()}`,
    },
  })
}

export async function syncHolidaysIfMissing(years: number[]): Promise<void> {
  for (const year of years) {
    try {
      const exists = await prisma.cnHolidayYear.findUnique({ where: { year } })
      if (!exists) {
        console.log(`[holiday-sync] ${year} 缺失，开始从远程拉取...`)
        const data = await fetchYear(year)
        await upsertYear(year, data)
        console.log(`[holiday-sync] ${year} 同步成功 (节假日 ${data.holidays.length} 个 / 补班 ${data.workdays.length} 个)`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[holiday-sync] ${year} 同步失败: ${message}`)
    }
  }
}

export function startHolidaySyncCron(): void {
  cron.schedule('0 3 * * *', async () => {
    const now = new Date()
    const years = [now.getFullYear(), now.getFullYear() + 1]
    console.log(`[holiday-sync] 定时任务触发，检查 ${years.join(', ')}`)
    await syncHolidaysIfMissing(years)
  })
  console.log('[holiday-sync] 定时任务已注册：每天 03:00 检查')
}
