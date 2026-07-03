import { apiRequest } from './client'
import type { AuthResponse, User } from './types'

export function register(username: string, password: string) {
  return apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: { username, password },
  })
}

export function login(username: string, password: string) {
  return apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  })
}

export function me() {
  return apiRequest<{ user: User }>('/api/auth/me')
}
