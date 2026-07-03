import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { syncHolidaysIfMissing } from '../src/lib/holidaySync.js'
import { prisma } from '../src/lib/db.js'

beforeEach(async () => {
  await prisma.cnHolidayYear.deleteMany({})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('syncHolidaysIfMissing', () => {
  it('fetches missing year from remote', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        holiday: {
          '01-01': { holiday: true, name: '元旦' },
          '01-26': { holiday: false, name: '补班', target: '春节' },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await syncHolidaysIfMissing([2025])

    expect(mockFetch).toHaveBeenCalledWith(
      'https://timor.tech/api/holiday/year/2025',
      expect.objectContaining({ signal: expect.any(Object) })
    )

    const row = await prisma.cnHolidayYear.findUnique({ where: { year: 2025 } })
    expect(row).not.toBeNull()
    expect(JSON.parse(row!.holidays)).toContain('20250101')
    expect(JSON.parse(row!.workdays)).toContain('20250126')
  })

  it('skips existing year', async () => {
    await prisma.cnHolidayYear.create({
      data: { year: 2025, holidays: '[]', workdays: '[]', source: 'manual' },
    })
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    await syncHolidaysIfMissing([2025])

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('continues on failure (does not throw)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', mockFetch)

    await expect(syncHolidaysIfMissing([2025])).resolves.toBeUndefined()

    const row = await prisma.cnHolidayYear.findUnique({ where: { year: 2025 } })
    expect(row).toBeNull()
  })

  it('handles non-OK HTTP status without inserting', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(syncHolidaysIfMissing([2025])).resolves.toBeUndefined()

    const row = await prisma.cnHolidayYear.findUnique({ where: { year: 2025 } })
    expect(row).toBeNull()
  })

  it('handles malformed JSON response without inserting', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('unexpected token in JSON')
      },
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(syncHolidaysIfMissing([2025])).resolves.toBeUndefined()

    const row = await prisma.cnHolidayYear.findUnique({ where: { year: 2025 } })
    expect(row).toBeNull()
  })
})
