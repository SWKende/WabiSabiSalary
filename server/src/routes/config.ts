import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'

const DEFAULTS = {
  monthlySalary: 5000,
  workStartHour: 9,
  workEndHour: 18,
  payday: 15,
}

function validateConfig(body: any): { ok: true; data: typeof DEFAULTS } | { ok: false; message: string } {
  const { monthlySalary, workStartHour, workEndHour, payday } = body ?? {}
  if (typeof monthlySalary !== 'number' || monthlySalary <= 0) {
    return { ok: false, message: 'monthlySalary 必须为正数' }
  }
  if (typeof workStartHour !== 'number' || workStartHour < 0 || workStartHour > 24) {
    return { ok: false, message: 'workStartHour 必须在 0-24 之间' }
  }
  if (typeof workEndHour !== 'number' || workEndHour < 0 || workEndHour > 24) {
    return { ok: false, message: 'workEndHour 必须在 0-24 之间' }
  }
  if (typeof payday !== 'number' || payday < 1 || payday > 28) {
    return { ok: false, message: 'payday 必须在 1-28 之间' }
  }
  return { ok: true, data: { monthlySalary, workStartHour, workEndHour, payday } }
}

function serializeConfig(c: { monthlySalary: number; workStartHour: number; workEndHour: number; payday: number; updatedAt: Date }) {
  return {
    monthlySalary: c.monthlySalary,
    workStartHour: c.workStartHour,
    workEndHour: c.workEndHour,
    payday: c.payday,
    updatedAt: c.updatedAt.toISOString(),
  }
}

export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/config', { preHandler: requireAuth }, async (req) => {
    const existing = await prisma.salaryConfig.findUnique({ where: { userId: req.user!.id } })
    if (existing) return serializeConfig(existing)
    return { ...DEFAULTS, updatedAt: null }
  })

  app.put('/api/config', { preHandler: requireAuth }, async (req, reply) => {
    const validated = validateConfig(req.body)
    if (!validated.ok) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: validated.message } })
    }
    const config = await prisma.salaryConfig.upsert({
      where: { userId: req.user!.id },
      update: validated.data,
      create: { userId: req.user!.id, ...validated.data },
    })
    return serializeConfig(config)
  })
}
