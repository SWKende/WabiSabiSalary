import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../src/lib/password.js'

describe('password', () => {
  it('hashes and verifies the correct password', async () => {
    const hash = await hashPassword('hello123')
    expect(hash).not.toBe('hello123')
    expect(hash.length).toBeGreaterThan(20)

    const ok = await verifyPassword('hello123', hash)
    expect(ok).toBe(true)
  })

  it('rejects incorrect password', async () => {
    const hash = await hashPassword('hello123')
    const ok = await verifyPassword('wrong', hash)
    expect(ok).toBe(false)
  })

  it('produces different hashes for the same input (salt)', async () => {
    const hash1 = await hashPassword('same')
    const hash2 = await hashPassword('same')
    expect(hash1).not.toBe(hash2)
  })
})