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
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('GET /api/config', () => {
  it('returns default config when not set', async () => {
    const token = await getToken()
    const res = await app.inject({
      method: 'GET',
      url: '/api/config',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.monthlySalary).toBe(5000)
    expect(body.workStartHour).toBe(9)
    expect(body.workEndHour).toBe(18)
    expect(body.payday).toBe(15)
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/config',
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('PUT /api/config', () => {
  it('creates config on first save', async () => {
    const token = await getToken()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: { monthlySalary: 8000, workStartHour: 10, workEndHour: 19, payday: 20 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.monthlySalary).toBe(8000)
    expect(body.workStartHour).toBe(10)
  })

  it('updates existing config', async () => {
    const token = await getToken()
    await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: { monthlySalary: 5000, workStartHour: 9, workEndHour: 18, payday: 15 },
    })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: { monthlySalary: 9000, workStartHour: 9, workEndHour: 18, payday: 15 },
    })
    const body = res.json()
    expect(body.monthlySalary).toBe(9000)
  })

  it('rejects out-of-range values', async () => {
    const token = await getToken()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: { monthlySalary: -1, workStartHour: 9, workEndHour: 18, payday: 15 },
    })
    expect(res.statusCode).toBe(400)
  })
})