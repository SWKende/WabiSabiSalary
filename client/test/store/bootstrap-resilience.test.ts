import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage = new Map<string, unknown>()
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value) },
    removeStorageSync: (key: string) => { storage.delete(key) },
  },
}))

import {
  __resetStore,
  bootstrapStore,
  isStoreReady,
  storeBackendName,
} from '../../src/utils/store'
import type { PersistBackend } from '../../src/utils/db'

/** 模拟真机上原生桥接不返回：init 永远挂起 */
function createHangingBackend(): PersistBackend {
  const never = () => new Promise<never>(() => undefined)
  return {
    name: 'sqlite',
    init: never,
    loadAllMeta: never,
    writeMeta: never,
    deleteMeta: never,
    loadAllEntries: never,
    upsertEntry: never,
    deleteEntry: never,
  }
}

/** 模拟 init 报错的后端 */
function createThrowingBackend(): PersistBackend {
  const boom = () => Promise.reject(new Error('open failed'))
  return {
    name: 'sqlite',
    init: boom,
    loadAllMeta: boom,
    writeMeta: boom,
    deleteMeta: boom,
    loadAllEntries: boom,
    upsertEntry: boom,
    deleteEntry: boom,
  }
}

async function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([promise, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms))])
}

beforeEach(() => {
  storage.clear()
  __resetStore()
})

describe('bootstrapStore 的可用性兜底', () => {
  it('后端 open 挂起时超时降级到 storage，bootstrap 仍会结束', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = await settleWithin(bootstrapStore({ backend: createHangingBackend(), openTimeoutMs: 120 }), 1500)

    expect(result).not.toBe('timeout')
    expect(isStoreReady()).toBe(true)
    expect(storeBackendName()).toBe('storage')
    warn.mockRestore()
  })

  it('后端 init 抛错时降级到 storage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await bootstrapStore({ backend: createThrowingBackend(), openTimeoutMs: 500 })
    expect(isStoreReady()).toBe(true)
    expect(storeBackendName()).toBe('storage')
    warn.mockRestore()
  })

  it('降级后读写仍然可用', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    storage.set('salary_config', JSON.stringify({ payday: 11 }))
    await bootstrapStore({ backend: createHangingBackend(), openTimeoutMs: 120 })
    const { readJSON } = await import('../../src/utils/store')
    expect(readJSON('salary_config', { payday: 1 })).toEqual({ payday: 11 })
    warn.mockRestore()
  })
})
