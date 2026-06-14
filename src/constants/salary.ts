// 默认薪资配置
export const DEFAULT_CONFIG = {
  monthlySalary: 3000,
  workDaysPerMonth: 30,
  workHoursPerDay: 8,
  workStartHour: 8,
  workEndHour: 16,
  payday: 1,
}

export interface SalaryConfig {
  monthlySalary: number
  workDaysPerMonth: number
  workHoursPerDay: number
  workStartHour: number
  workEndHour: number
  payday: number
}