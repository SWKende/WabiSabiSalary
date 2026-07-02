import { describe, it, expect, beforeAll } from 'vitest'
import { signToken, verifyToken } from '../src/lib/jwt.js'

describe('jwt', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-jest-suite'
  })

  it('signs and verifies a token', () => {
    const token = signToken({ userId: 'u1', username: 'alice' })
    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3)

    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload?.userId).toBe('u1')
    expect(payload?.username).toBe('alice')
  })

  it('returns null for invalid token', () => {
    expect(verifyToken('invalid.token.here')).toBeNull()
  })

  it('returns null for token signed with different secret', () => {
    process.env.JWT_SECRET = 'secret-a'
    const token = signToken({ userId: 'u2', username: 'bob' })

    process.env.JWT_SECRET = 'secret-b'
    expect(verifyToken(token)).toBeNull()

    process.env.JWT_SECRET = 'test-secret-for-jest-suite'
  })
})