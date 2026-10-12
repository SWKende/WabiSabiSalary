import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

const storage = new Map<string, unknown>()
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value) },
    removeStorageSync: (key: string) => { storage.delete(key) },
  },
}))

import * as store from '../../src/utils/store'
import type { PersistBackend } from '../../src/utils/db'

function fakeSqliteBackend(): PersistBackend {
  return {
    name: 'sqlite',
    async init() {},
    async loadAllMeta() { return [] },
    async writeMeta() {},
    async deleteMeta() {},
    async loadAllEntries() { return [] },
    async upsertEntry() {},
    async deleteEntry() {},
  }
}

/** 原生桥接不返回：所有方法永久挂起 */
function hangingBackend(): PersistBackend {
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

function pretendNative(on: boolean) {
  const target = globalThis as unknown as { Capacitor?: unknown }
  if (on) {
    target.Capacitor = {
      isNativePlatform: () => true,
      isPluginAvailable: () => true,
      getPlatform: () => 'android',
    }
  } else {
    delete target.Capacitor
  }
}

beforeEach(() => {
  storage.clear()
  store.__resetStore()
})

afterEach(() => {
  pretendNative(false)
})

describe('storageDiagnostics', () => {
  it('浏览器开发环境：storage 后端且不算降级', async () => {
    pretendNative(false)
    await store.bootstrapStore()
    expect(store.storageDiagnostics?.()).toEqual({ backend: 'storage', native: false, degraded: false })
  })

  it('真机上 SQLite 正常工作：degraded 为 false', async () => {
    pretendNative(true)
    await store.bootstrapStore({ backend: fakeSqliteBackend() })
    expect(store.storageDiagnostics?.()).toEqual({ backend: 'sqlite', native: true, degraded: false })
  })

  it('真机上落到 storage：degraded 为 true（这就是装机要看的信号）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    pretendNative(true)
    await store.bootstrapStore({ backend: hangingBackend(), openTimeoutMs: 20 })
    expect(store.storageDiagnostics?.()).toEqual({ backend: 'storage', native: true, degraded: true })
    warn.mockRestore()
  })

  it('报告的是启动时的环境，而不是渲染时重新探测的结果', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    pretendNative(true)
    await store.bootstrapStore({ backend: hangingBackend(), openTimeoutMs: 20 })
    // @capacitor/core 被 import 后会用真实对象覆盖 window.Capacitor，
    // 浏览器里那时 isNativePlatform() 变 false；诊断不能因此翻供
    pretendNative(false)
    expect(store.storageDiagnostics?.()).toEqual({ backend: 'storage', native: true, degraded: true })
    warn.mockRestore()
  })
})
