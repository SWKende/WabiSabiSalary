import type { FastifyPluginAsync } from 'fastify'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { signToken } from '../lib/jwt.js'
import { prisma } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'
import type { AuthResponse } from '../types/shared.js'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const MIN_PASSWORD = 6
const MAX_PASSWORD = 32

// Pre-computed dummy bcrypt hash for timing-safe login. Ensures the
// missing-user branch performs an equivalent bcrypt compare to the
// real-password branch, preventing username enumeration via timing.
const DUMMY_HASH_PROMISE = hashPassword('timing-safety-dummy')

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/auth/register
  app.post('/api/auth/register', async (req, reply) => {
    const body = req.body as { username?: string; password?: string }
    const username = body?.username?.trim()
    const password = body?.password

    if (!username || !password) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: '用户名和密码必填' } })
    }
    if (!USERNAME_RE.test(username)) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: '用户名需为 3-20 位字母/数字/下划线' } })
    }
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: `密码长度需为 ${MIN_PASSWORD}-${MAX_PASSWORD}` } })
    }

    const passwordHash = await hashPassword(password)
    let user
    try {
      user = await prisma.user.create({
        data: { username, passwordHash },
      })
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 'P2002') {
        return reply.code(409).send({ error: { code: 'USERNAME_EXISTS', message: '用户名已被占用' } })
      }
      throw err
    }

    const token = signToken({ userId: user.id, username: user.username })
    const response: AuthResponse = {
      token,
      user: { id: user.id, username: user.username },
    }
    return reply.code(201).send(response)
  })

  // POST /api/auth/login
  app.post('/api/auth/login', async (req, reply) => {
    const body = req.body as { username?: string; password?: string }
    const username = body?.username?.trim()
    const password = body?.password

    if (!username || !password) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: '用户名和密码必填' } })
    }

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      // Run a bcrypt compare against a dummy hash to keep timing roughly
      // equivalent to the real-password branch and prevent username
      // enumeration via response time.
      const dummyHash = await DUMMY_HASH_PROMISE
      await verifyPassword(password, dummyHash)
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } })
    }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } })
    }

    const token = signToken({ userId: user.id, username: user.username })
    const response: AuthResponse = {
      token,
      user: { id: user.id, username: user.username },
    }
    return reply.send(response)
  })

  // GET /api/auth/me
  app.get('/api/auth/me', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.user!
    return reply.send({ user: { id: user.id, username: user.username } })
  })
}