// 默认薪资配置
export const DEFAULT_CONFIG = {
  monthlySalary: 3000,
  workStartHour: 8,
  workEndHour: 16,
  payday: 1,
}

export interface SalaryConfig {
  monthlySalary: number
  workStartHour: number
  workEndHour: number
  payday: number
}
