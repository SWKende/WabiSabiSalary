import Taro from '@tarojs/taro'
import { ApiError } from './types'

export { ApiError }

const TOKEN_KEY = 'auth_token'

// In-memory cache so token reads survive the Taro storage mock
// (tests mock getStorageSync to return '', which would otherwise hide set values).
let tokenCache: string | null = null

function getBaseUrl(): string {
  const url = process.env.TARO_APP_API_BASE_URL
  if (url) return url.replace(/\/+$/, '')
  // 开发环境默认值
  return 'http://localhost:3000'
}

export function getToken(): string | null {
  if (tokenCache !== null) return tokenCache
  try {
    const t = Taro.getStorageSync(TOKEN_KEY)
    if (typeof t === 'string' && t.length > 0) {
      tokenCache = t
      return t
    }
  } catch {
    /* ignore */
  }
  return null
}

export function setToken(token: string): void {
  tokenCache = token
  try {
    Taro.setStorageSync(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  tokenCache = null
  try {
    Taro.removeStorageSync(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
}

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options
  const token = getToken()
  const base = getBaseUrl()
  const url = new URL(base + path)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v))
      }
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await Taro.request({
    url: url.toString(),
    method,
    data: body,
    header: headers,
    timeout: 10000,
  })

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as T
  }

  const errBody = (res.data as any)?.error
  throw new ApiError(
    errBody?.code ?? 'UNKNOWN',
    errBody?.message ?? `HTTP ${res.statusCode}`,
    res.statusCode,
  )
}
