import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { verifyToken } from '../lib/jwt.js'
import { prisma } from '../lib/db.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; username: string } | null
  }
}

const authPluginInner: FastifyPluginAsync = async (app) => {
  app.decorateRequest('user', null)

  app.addHook('preHandler', async (req: FastifyRequest) => {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      // 未带 token，放行（具体路由用 requireAuth 校验）
      return
    }
    const token = auth.slice(7)
    const payload = verifyToken(token)
    if (!payload) return

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (user) {
      req.user = { id: user.id, username: user.username }
    }
  })
}

// 用 fastify-plugin 打破封装，让装饰器和 hook 暴露给后续注册的路由
export const authPlugin = fp(authPluginInner, { name: 'auth-plugin' })

/** 装饰器：要求鉴权。失败返回 401 */
export const requireAuth = async (req: FastifyRequest, reply: any) => {
  if (!req.user || !req.user.id) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: '需要登录' } })
    return reply
  }
}