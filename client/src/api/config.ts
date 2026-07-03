import { apiRequest } from './client'
import type { SalaryConfig } from './types'

export function getConfig() {
  return apiRequest<SalaryConfig>('/api/config')
}

export function updateConfig(config: Omit<SalaryConfig, 'updatedAt'>) {
  return apiRequest<SalaryConfig>('/api/config', {
    method: 'PUT',
    body: config,
  })
}
