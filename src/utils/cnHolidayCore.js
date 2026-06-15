export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function toYYYYMMDD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function normalizeYYYYMMDD(input, yearHint) {
  const s = String(input ?? '').trim()
  const m1 = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m1) {
    const y = Number(m1[1])
    const mo = Number(m1[2])
    const da = Number(m1[3])
    if (!isFinite(y) || !isFinite(mo) || !isFinite(da)) return null
    if (mo < 1 || mo > 12) return null
    if (da < 1 || da > 31) return null
    return `${y}-${pad2(mo)}-${pad2(da)}`
  }

  const m2 = /^(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m2 && yearHint) {
    const mo = Number(m2[1])
    const da = Number(m2[2])
    if (!isFinite(mo) || !isFinite(da)) return null
    if (mo < 1 || mo > 12) return null
    if (da < 1 || da > 31) return null
    return `${yearHint}-${pad2(mo)}-${pad2(da)}`
  }

  return null
}

export function uniqSorted(list) {
  return Array.from(new Set(list)).sort()
}

export function extractTimorYearHolidayData(year, data) {
  if (!data || typeof data !== 'object' || data.code !== 0) {
    throw new Error('holiday provider error')
  }
  const holidayObj = data.holiday
  if (!holidayObj || typeof holidayObj !== 'object') {
    return { holidays: [], workdays: [] }
  }

  const holidays = []
  const workdays = []

  for (const [k, v] of Object.entries(holidayObj)) {
    const item = v
    const dateStr = normalizeYYYYMMDD(item?.date, year) || normalizeYYYYMMDD(k, year)
    if (!dateStr) continue
    if (item?.holiday === true) holidays.push(dateStr)
    else if (item?.holiday === false) workdays.push(dateStr)
  }

  return { holidays: uniqSorted(holidays), workdays: uniqSorted(workdays) }
}

export function classifyCnDate(dateYYYYMMDD, dataset) {
  const date = normalizeYYYYMMDD(dateYYYYMMDD)
  if (!date) return 'unknown'
  if (!dataset) return 'unknown'
  if (Array.isArray(dataset.workdays) && dataset.workdays.includes(date)) return 'workday'
  if (Array.isArray(dataset.holidays) && dataset.holidays.includes(date)) return 'holiday'
  return 'normal'
}

