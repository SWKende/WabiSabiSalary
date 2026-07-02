import jwt from 'jsonwebtoken'

export interface JwtPayload {
  userId: string
  username: string
}

function getSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret())
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret())
    if (typeof decoded === 'string') return null
    if (typeof decoded.userId !== 'string' || typeof decoded.username !== 'string') return null
    return { userId: decoded.userId, username: decoded.username }
  } catch {
    return null
  }
}