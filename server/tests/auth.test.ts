import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../src/index.js'
import { prisma } from '../src/lib/db.js'

const app = await buildApp()

beforeEach(async () => {
  await prisma.bookkeepingEntry.deleteMany({})
  await prisma.salaryConfig.deleteMany({})
  await prisma.user.deleteMany({})
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('POST /api/auth/register', () => {
  it('registers a new user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'secret123' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.token).toBeTruthy()
    expect(body.user.username).toBe('alice')
    expect(body.user.id).toBeTruthy()
  })

  it('rejects duplicate username', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'bob', password: 'secret123' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'bob', password: 'secret123' },
    })
    expect(res.statusCode).toBe(409)
    const body = res.json()
    expect(body.error.code).toBe('USERNAME_EXISTS')
  })

  it('rejects invalid username', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'ab', password: 'secret123' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects short password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'carol', password: '123' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'dave', password: 'secret123' },
    })
  })

  it('logs in with correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'dave', password: 'secret123' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeTruthy()
  })

  it('rejects wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'dave', password: 'wrong' },
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects unknown user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: 'secret123' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('returns current user when authenticated', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'eve', password: 'secret123' },
    })
    const { token } = reg.json()

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.user.username).toBe('eve')
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: 'Bearer invalid' },
    })
    expect(res.statusCode).toBe(401)
  })
})