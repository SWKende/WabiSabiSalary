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

// mock the cnHoliday helper to avoid network/storage side effects
vi.mock('../cnHoliday', () => ({
  ensureCnHolidayDataset: vi.fn().mockResolvedValue({ years: [], holidays: [], workdays: [], fetchedAt: '', source: 'cache' }),
}))

// mock the api barrel so we can assert call shapes without going through the network
vi.mock('../../api', () => {
  return {
    getToken: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    listEntries: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    getHolidays: vi.fn(),
  }
})

import Taro from '@tarojs/taro'
import * as api from '../../api'
import { ensureCnHolidayDataset } from '../cnHoliday'

// Import after mocks are wired up
import { enqueueSync, retryPendingSyncs, initialSync } from '../sync'

const PENDING_KEY = 'pending_sync_queue'

function setStoredQueue(queue: any[]): void {
  ;(Taro.getStorageSync as any).mockImplementation((key: string) => {
    if (key === PENDING_KEY) return queue
    return ''
  })
}

function getStoredQueue(): any[] {
  const calls = (Taro.setStorageSync as any).mock.calls
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i][0] === PENDING_KEY) return calls[i][1]
  }
  return []
}

describe('utils/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.getToken as any).mockReturnValue('test-token')
  })

  describe('enqueueSync', () => {
    it('adds an op to the empty queue', () => {
      setStoredQueue([])
      enqueueSync({ type: 'updateConfig', payload: { monthlySalary: 1, workStartHour: 9, workEndHour: 18, payday: 15 } as any })

      const stored = getStoredQueue()
      expect(stored).toHaveLength(1)
      expect(stored[0].type).toBe('updateConfig')
    })

    it('appends to an existing queue without losing prior ops', () => {
      setStoredQueue([{ type: 'deleteEntry', id: 'abc' }])
      enqueueSync({ type: 'createEntry', payload: {} as any, tempId: 'temp-1' })

      const stored = getStoredQueue()
      expect(stored).toHaveLength(2)
      expect(stored[0]).toEqual({ type: 'deleteEntry', id: 'abc' })
      expect(stored[1].type).toBe('createEntry')
    })

    it('initializes queue when storage returns non-array value', () => {
      ;(Taro.getStorageSync as any).mockReturnValue('')
      enqueueSync({ type: 'deleteEntry', id: 'x' })

      const stored = getStoredQueue()
      expect(stored).toHaveLength(1)
      expect(stored[0]).toEqual({ type: 'deleteEntry', id: 'x' })
    })
  })

  describe('retryPendingSyncs', () => {
    it('returns early when there is no token', async () => {
      ;(api.getToken as any).mockReturnValue(null)
      setStoredQueue([{ type: 'updateConfig', payload: {} as any }])

      await retryPendingSyncs()

      expect(api.createEntry).not.toHaveBeenCalled()
      expect(api.updateEntry).not.toHaveBeenCalled()
      expect(api.deleteEntry).not.toHaveBeenCalled()
      expect(api.updateConfig).not.toHaveBeenCalled()
    })

    it('returns early when queue is empty', async () => {
      setStoredQueue([])
      await retryPendingSyncs()
      expect(api.updateConfig).not.toHaveBeenCalled()
    })

    it('calls api.createEntry for createEntry ops', async () => {
      setStoredQueue([{ type: 'createEntry', payload: { type: 'expense', amount: 10, category: '餐飲', occurredAt: '2026-01-01T00:00:00.000Z' } as any, tempId: 'temp-1' }])
      ;(api.createEntry as any).mockResolvedValue({ entry: { id: 'srv-1' } })

      await retryPendingSyncs()

      expect(api.createEntry).toHaveBeenCalledWith({ type: 'expense', amount: 10, category: '餐飲', occurredAt: '2026-01-01T00:00:00.000Z' })
      const stored = getStoredQueue()
      expect(stored).toHaveLength(0)
    })

    it('calls api.updateEntry for updateEntry ops', async () => {
      setStoredQueue([{ type: 'updateEntry', id: 'abc', payload: { amount: 99 } as any }])
      ;(api.updateEntry as any).mockResolvedValue({ entry: { id: 'abc' } })

      await retryPendingSyncs()

      expect(api.updateEntry).toHaveBeenCalledWith('abc', { amount: 99 })
    })

    it('calls api.deleteEntry for deleteEntry ops', async () => {
      setStoredQueue([{ type: 'deleteEntry', id: 'xyz' }])
      ;(api.deleteEntry as any).mockResolvedValue({ success: true })

      await retryPendingSyncs()

      expect(api.deleteEntry).toHaveBeenCalledWith('xyz')
    })

    it('calls api.updateConfig for updateConfig ops', async () => {
      const cfg = { monthlySalary: 100, workStartHour: 9, workEndHour: 18, payday: 15 }
      setStoredQueue([{ type: 'updateConfig', payload: cfg as any }])
      ;(api.updateConfig as any).mockResolvedValue(cfg)

      await retryPendingSyncs()

      expect(api.updateConfig).toHaveBeenCalledWith(cfg)
    })

    it('preserves failed ops in the queue', async () => {
      setStoredQueue([
        { type: 'createEntry', payload: { type: 'expense', amount: 10, category: 'a', occurredAt: '2026-01-01' } as any, tempId: 'temp-1' },
        { type: 'deleteEntry', id: 'will-fail' },
        { type: 'deleteEntry', id: 'will-ok' },
      ])
      ;(api.createEntry as any).mockResolvedValue({ entry: { id: 'srv' } })
      ;(api.deleteEntry as any).mockImplementation((id: string) => {
        if (id === 'will-fail') return Promise.reject(new Error('network down'))
        return Promise.resolve({ success: true })
      })

      await retryPendingSyncs()

      const stored = getStoredQueue()
      expect(stored).toHaveLength(1)
      expect(stored[0]).toEqual({ type: 'deleteEntry', id: 'will-fail' })
    })

    it('writes the remaining queue back to storage', async () => {
      setStoredQueue([{ type: 'deleteEntry', id: 'fail' }])
      ;(api.deleteEntry as any).mockRejectedValue(new Error('boom'))

      await retryPendingSyncs()

      const stored = getStoredQueue()
      expect(stored).toEqual([{ type: 'deleteEntry', id: 'fail' }])
    })
  })

  describe('initialSync', () => {
    it('returns early when there is no token', async () => {
      ;(api.getToken as any).mockReturnValue(null)

      await initialSync()

      expect(api.getConfig).not.toHaveBeenCalled()
      expect(api.listEntries).not.toHaveBeenCalled()
      expect(ensureCnHolidayDataset).not.toHaveBeenCalled()
    })

    it('pulls config, entries, holidays and retries the queue', async () => {
      const cfg = { monthlySalary: 100, workStartHour: 9, workEndHour: 18, payday: 15, updatedAt: '2026-01-01' }
      ;(api.getConfig as any).mockResolvedValue(cfg)
      ;(api.listEntries as any).mockResolvedValue({ entries: [{ id: 'e1' }] })
      ;(ensureCnHolidayDataset as any).mockResolvedValue({ years: [], holidays: [], workdays: [], fetchedAt: '', source: 'remote' })

      await initialSync()

      expect(api.getConfig).toHaveBeenCalled()
      expect(api.listEntries).toHaveBeenCalledWith(expect.objectContaining({ from: expect.any(String), to: expect.any(String), limit: 500 }))
      expect(ensureCnHolidayDataset).toHaveBeenCalled()
    })

    it('writes pulled data into storage', async () => {
      const cfg = { monthlySalary: 100, workStartHour: 9, workEndHour: 18, payday: 15, updatedAt: '2026-01-01' }
      ;(api.getConfig as any).mockResolvedValue(cfg)
      ;(api.listEntries as any).mockResolvedValue({ entries: [{ id: 'e1' }] })
      ;(ensureCnHolidayDataset as any).mockResolvedValue({})

      await initialSync()

      const setCalls = (Taro.setStorageSync as any).mock.calls
      const keys = setCalls.map((c: any[]) => c[0])
      expect(keys).toContain('salary_config')
      expect(keys).toContain('bookkeeping_entries')
    })

    it('continues retrying the pending queue after pulling data', async () => {
      setStoredQueue([{ type: 'deleteEntry', id: 'q1' }])
      ;(api.deleteEntry as any).mockResolvedValue({ success: true })
      ;(api.getConfig as any).mockResolvedValue({})
      ;(api.listEntries as any).mockResolvedValue({ entries: [] })

      await initialSync()

      expect(api.deleteEntry).toHaveBeenCalledWith('q1')
    })

    it('does not throw when individual pulls fail', async () => {
      ;(api.getConfig as any).mockRejectedValue(new Error('config fail'))
      ;(api.listEntries as any).mockResolvedValue({ entries: [] })
      ;(ensureCnHolidayDataset as any).mockResolvedValue({})

      await expect(initialSync()).resolves.toBeUndefined()
    })

    it('dedupes concurrent initialSync calls (api.getConfig called once)', async () => {
      const cfg = { monthlySalary: 100, workStartHour: 9, workEndHour: 18, payday: 15, updatedAt: '2026-01-01' }
      let resolveConfig: (v: any) => void = () => {}
      ;(api.getConfig as any).mockImplementation(
        () => new Promise((res) => {
          resolveConfig = res
        })
      )
      ;(api.listEntries as any).mockResolvedValue({ entries: [] })
      ;(ensureCnHolidayDataset as any).mockResolvedValue({})

      const p1 = initialSync()
      const p2 = initialSync()
      const p3 = initialSync()

      // release the config pull
      resolveConfig(cfg)
      await Promise.all([p1, p2, p3])

      expect(api.getConfig).toHaveBeenCalledTimes(1)
    })
  })

  describe('concurrent-call de-dupe', () => {
    it('retryPendingSyncs dedupes concurrent calls', async () => {
      setStoredQueue([{ type: 'deleteEntry', id: 'q1' }])
      let resolveDelete: (v: any) => void = () => {}
      ;(api.deleteEntry as any).mockImplementation(
        () => new Promise((res) => {
          resolveDelete = res
        })
      )

      const p1 = retryPendingSyncs()
      const p2 = retryPendingSyncs()

      resolveDelete({ success: true })
      await Promise.all([p1, p2])

      expect(api.deleteEntry).toHaveBeenCalledTimes(1)
    })
  })
})