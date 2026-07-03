import { describe, it, expect, beforeEach, vi } from 'vitest'

// mock Taro
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    request: vi.fn(),
  },
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  request: vi.fn(),
}))

import Taro from '@tarojs/taro'
import { apiRequest, ApiError, getToken, setToken, clearToken } from '../client'

describe('api/client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearToken()
  })

  describe('token storage', () => {
    it('stores and retrieves token', () => {
      setToken('test-token-abc')
      expect(getToken()).toBe('test-token-abc')
    })

    it('returns null when no token', () => {
      ;(Taro.getStorageSync as any).mockReturnValue('')
      expect(getToken()).toBeNull()
    })

    it('clears token', () => {
      setToken('test')
      clearToken()
      expect(getToken()).toBeNull()
    })
  })

  describe('apiRequest', () => {
    it('sends request with bearer token', async () => {
      setToken('my-token')
      ;(Taro.request as any).mockResolvedValue({
        statusCode: 200,
        data: { ok: true },
      })

      const result = await apiRequest<{ ok: boolean }>('/api/test')
      expect(result.ok).toBe(true)
      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/api/test'),
          header: expect.objectContaining({ Authorization: 'Bearer my-token' }),
        }),
      )
    })

    it('omits auth header when no token', async () => {
      ;(Taro.request as any).mockResolvedValue({
        statusCode: 200,
        data: { ok: true },
      })

      await apiRequest('/api/test')
      const call = (Taro.request as any).mock.calls[0][0]
      expect(call.header.Authorization).toBeUndefined()
    })

    it('throws ApiError on non-2xx response', async () => {
      ;(Taro.request as any).mockResolvedValue({
        statusCode: 401,
        data: { error: { code: 'UNAUTHORIZED', message: '需要登录' } },
      })

      await expect(apiRequest('/api/test')).rejects.toThrow(ApiError)
      await expect(apiRequest('/api/test')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        status: 401,
      })
    })

    it('throws generic ApiError on non-2xx without error body', async () => {
      ;(Taro.request as any).mockResolvedValue({
        statusCode: 500,
        data: null,
      })

      await expect(apiRequest('/api/test')).rejects.toMatchObject({
        code: 'UNKNOWN',
        status: 500,
      })
    })

    it('throws NETWORK_ERROR ApiError when Taro.request rejects', async () => {
      ;(Taro.request as any).mockRejectedValue(new Error('request:fail'))

      await expect(apiRequest('/api/test')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        status: 0,
      })
    })

    it('skips empty/undefined query params', async () => {
      ;(Taro.request as any).mockResolvedValue({ statusCode: 200, data: {} })
      await apiRequest('/api/entries', {
        query: { from: '', to: '2026-01-01', limit: 10 } as any,
      })
      const url = (Taro.request as any).mock.calls[0][0].url as string
      expect(url).not.toContain('from=')
      expect(url).toContain('to=2026-01-01')
      expect(url).toContain('limit=10')
    })
  })
})
