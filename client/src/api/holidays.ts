import { apiRequest } from './client'
import type { HolidayYearData } from './types'

export function getHolidays(years: number[]) {
  return apiRequest<{ years: HolidayYearData[] }>('/api/holidays', {
    query: { years: years.join(',') },
  })
}
