export type LoginMode = 'login' | 'register'

export interface ValidationResult {
  normalizedUsername: string
  error: string | null
}

// 与 server/src/routes/auth.ts 保持一致:USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/,
// 密码长度 6-32。服务端变化时,本模块与其测试必须在同一变更中同步。
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export function validateCredentials(
  mode: LoginMode,
  rawUsername: string,
  password: string,
): ValidationResult {
  const normalizedUsername = (rawUsername ?? '').trim()

  if (!normalizedUsername || !password) {
    return { normalizedUsername, error: '请输入用户名和密码' }
  }

  if (mode === 'register') {
    if (!USERNAME_RE.test(normalizedUsername)) {
      return {
        normalizedUsername,
        error: '用户名需为 3-20 位字母/数字/下划线',
      }
    }
    if (password.length < 6 || password.length > 32) {
      return {
        normalizedUsername,
        error: '密码长度需为 6-32',
      }
    }
  }

  return { normalizedUsername, error: null }
}
