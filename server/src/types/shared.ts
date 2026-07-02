export interface User {
  id: string
  username: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface SalaryConfig {
  monthlySalary: number
  workStartHour: number
  workEndHour: number
  payday: number
  updatedAt?: string
}

export type EntryType = 'income' | 'expense'

export interface BookkeepingEntry {
  id: string
  type: EntryType
  amount: number
  category: string
  note?: string
  occurredAt: string
  createdAt: string
  updatedAt: string
}

export interface CreateEntryInput {
  type: EntryType
  amount: number
  category: string
  note?: string
  occurredAt: string
}

export interface HolidayYearData {
  year: number
  holidays: string[]
  workdays: string[]
}

export interface ApiErrorBody {
  code: string
  message: string
}