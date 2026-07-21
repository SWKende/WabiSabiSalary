import { describe, expect, it } from 'vitest'
import { validateCredentials } from '../../src/pages/login/validation'

describe('validateCredentials', () => {
  it('rejects empty username or password in login mode', () => {
    const r1 = validateCredentials('login', '', 'abcdef')
    expect(r1).toEqual({ normalizedUsername: '', error: '请输入用户名和密码' })
    const r2 = validateCredentials('login', 'alice', '')
    expect(r2.error).toBe('请输入用户名和密码')
  })

  it('normalizes leading and trailing whitespace from username', () => {
    const r = validateCredentials('login', '  alice  ', 'abcdef')
    expect(r.error).toBeNull()
    expect(r.normalizedUsername).toBe('alice')
  })

  it('does not fabricate login mode credential correctness', () => {
    const r = validateCredentials('login', 'alice', 'wrong')
    expect(r.error).toBeNull()
    expect(r.normalizedUsername).toBe('alice')
  })

  it('rejects register username shorter than 3 chars', () => {
    const r = validateCredentials('register', 'al', 'abcdef')
    expect(r.error).toMatch(/3-20/)
  })

  it('rejects register username longer than 20 chars', () => {
    const r = validateCredentials('register', 'a'.repeat(21), 'abcdef')
    expect(r.error).toMatch(/3-20/)
  })

  it('rejects register username containing disallowed characters', () => {
    for (const bad of ['al ce', 'al-ce', 'al@ce', 'al.ce', '用户', '中 文']) {
      const r = validateCredentials('register', bad, 'abcdef')
      expect(r.error).toMatch(/3-20/)
    }
  })

  it('rejects register password shorter than 6 chars', () => {
    const r = validateCredentials('register', 'alice', '12345')
    expect(r.error).toMatch(/6-32/)
  })

  it('rejects register password longer than 32 chars', () => {
    const r = validateCredentials('register', 'alice', 'a'.repeat(33))
    expect(r.error).toMatch(/6-32/)
  })

  it('accepts valid register input', () => {
    const r = validateCredentials('register', 'alice_01', 'secret_001'.padEnd(6, 'x'))
    expect(r.error).toBeNull()
    expect(r.normalizedUsername).toBe('alice_01')
  })

  it('accepts valid login input', () => {
    const r = validateCredentials('login', 'alice_01', 'anything_at_all_32+')
    expect(r.error).toBeNull()
    expect(r.normalizedUsername).toBe('alice_01')
  })
})
