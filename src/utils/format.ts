// 格式化：固定小数位，避免 toLocaleString 的不确定性
export function formatMoney2(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatMoney4(amount: number): string {
  return amount.toFixed(4)
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function parseRecordDateTime(time: string): Date | null {
  const localMatch = time.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  )

  if (localMatch) {
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = localMatch
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  }

  const parsed = new Date(time)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatRecordTime(time: string): string {
  const date = parseRecordDateTime(time)
  if (!date) return time
  return `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月${pad2(date.getDate())}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function createRecordTime(dateStr: string, now: Date = new Date()): string {
  return `${dateStr} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
}

export function getRecordDateKey(time: string): string {
  const date = parseRecordDateTime(time)
  return date ? formatLocalDate(date) : time.slice(0, 10)
}

export function isRecordOnDate(time: string, dateStr: string): boolean {
  return getRecordDateKey(time) === dateStr
}

export function isRecordInMonth(time: string, year: number, month: number): boolean {
  const date = parseRecordDateTime(time)
  return !!date && date.getFullYear() === year && date.getMonth() === month
}
