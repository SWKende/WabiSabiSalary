import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../src/index.js'
import { prisma } from '../src/lib/db.js'
import { cleanDatabase } from './helpers.js'

const app = await buildApp()

async function getToken(username = 'alice'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, password: 'secret123' },
  })
  const body = res.json()
  return body.token
}

beforeEach(async () => {
  await cleanDatabase()
  await prisma.cnHolidayYear.deleteMany({})
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('GET /api/holidays', () => {
  it('returns empty when no data', async () => {
    const token = await getToken()
    const res = await app.inject({
      method: 'GET',
      url: '/api/holidays?years=2025',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.years).toEqual([])
  })

  it('returns holidays for requested years', async () => {
    const token = await getToken()
    await prisma.cnHolidayYear.create({
      data: {
        year: 2025,
        holidays: JSON.stringify(['20250101', '20250210']),
        workdays: JSON.stringify(['20250126']),
        source: 'test',
      },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/holidays?years=2025',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.years.length).toBe(1)
    expect(body.years[0].holidays).toEqual(['20250101', '20250210'])
    expect(body.years[0].workdays).toEqual(['20250126'])
  })

  it('rejects invalid years param', async () => {
    const token = await getToken()
    const res = await app.inject({
      method: 'GET',
      url: '/api/holidays?years=abc',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/holidays?years=2025',
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns multiple years requested via comma-separated list', async () => {
    const token = await getToken()
    await prisma.cnHolidayYear.create({
      data: { year: 2025, holidays: '["20250101"]', workdays: '[]', source: 'test' },
    })
    await prisma.cnHolidayYear.create({
      data: { year: 2026, holidays: '["20260217"]', workdays: '["20260214"]', source: 'test' },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/holidays?years=2026,2025',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.years.length).toBe(2)
    expect(body.years[0].year).toBe(2025)
    expect(body.years[1].year).toBe(2026)
    expect(body.years[1].workdays).toEqual(['20260214'])
  })
})
