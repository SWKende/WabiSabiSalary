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

async function loginToken(username: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
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

const sampleEntry = {
  type: 'expense' as const,
  amount: 35.5,
  category: '餐饮',
  note: '午餐',
  occurredAt: '2025-07-01T12:00:00.000Z',
}

describe('POST /api/entries', () => {
  it('creates a new entry', async () => {
    const token = await getToken()
    const res = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: sampleEntry,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.entry.id).toBeTruthy()
    expect(body.entry.amount).toBe(35.5)
    expect(body.entry.type).toBe('expense')
  })

  it('rejects negative amount', async () => {
    const token = await getToken()
    const res = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: { ...sampleEntry, amount: -1 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects invalid type', async () => {
    const token = await getToken()
    const res = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: { ...sampleEntry, type: 'invalid' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/entries', () => {
  it('returns entries for current user', async () => {
    const token = await getToken()
    await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: sampleEntry,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/entries',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.entries.length).toBe(1)
    expect(body.entries[0].amount).toBe(35.5)
  })

  it('does not return other users entries', async () => {
    await getToken('alice')
    const bobToken = await getToken('bob')
    await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      payload: sampleEntry,
    })
    const aliceToken = await loginToken('alice')
    const res = await app.inject({
      method: 'GET',
      url: '/api/entries',
      headers: { Authorization: `Bearer ${aliceToken}` },
    })
    const body = res.json()
    expect(body.entries.length).toBe(0)
  })

  it('filters by date range', async () => {
    const token = await getToken()
    await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: { ...sampleEntry, occurredAt: '2025-06-01T00:00:00.000Z' },
    })
    await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: { ...sampleEntry, occurredAt: '2025-07-15T00:00:00.000Z' },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/entries?from=2025-07-01&to=2025-07-31',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = res.json()
    expect(body.entries.length).toBe(1)
  })
})

describe('PUT /api/entries/:id', () => {
  it('updates entry', async () => {
    const token = await getToken()
    const created = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: sampleEntry,
    })
    const createdBody = created.json()

    const res = await app.inject({
      method: 'PUT',
      url: `/api/entries/${createdBody.entry.id}`,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: { amount: 50 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.entry.amount).toBe(50)
  })

  it('returns 404 for other users entry', async () => {
    await getToken('alice')
    const bobToken = await getToken('bob')
    const created = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      payload: sampleEntry,
    })
    const createdBody = created.json()

    const aliceToken = await loginToken('alice')

    const res = await app.inject({
      method: 'PUT',
      url: `/api/entries/${createdBody.entry.id}`,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      payload: { amount: 999 },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/entries/:id', () => {
  it('deletes entry', async () => {
    const token = await getToken()
    const created = await app.inject({
      method: 'POST',
      url: '/api/entries',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      payload: sampleEntry,
    })
    const createdBody = created.json()

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/entries/${createdBody.entry.id}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })
})
