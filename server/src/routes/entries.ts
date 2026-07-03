import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'
import type { BookkeepingEntry, CreateEntryInput } from '../types/shared.js'

function parseLimit(raw: string | undefined): number {
  const n = Number(raw ?? 500)
  if (!Number.isFinite(n) || n <= 0) return 500
  return Math.min(Math.floor(n), 1000)
}

function serializeEntry(e: {
  id: string
  type: string
  amount: number
  category: string
  note: string | null
  occurredAt: Date
  createdAt: Date
  updatedAt: Date
}): BookkeepingEntry {
  return {
    id: e.id,
    type: e.type as 'income' | 'expense',
    amount: e.amount,
    category: e.category,
    note: e.note ?? undefined,
    occurredAt: e.occurredAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

function validateEntry(body: any): { ok: true; data: CreateEntryInput } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: '请求体无效' }
  const { type, amount, category, note, occurredAt } = body
  if (type !== 'income' && type !== 'expense') return { ok: false, message: 'type 必须为 income 或 expense' }
  if (typeof amount !== 'number' || amount <= 0) return { ok: false, message: 'amount 必须为正数' }
  if (typeof category !== 'string' || !category) return { ok: false, message: 'category 必填' }
  if (typeof occurredAt !== 'string' || isNaN(Date.parse(occurredAt))) return { ok: false, message: 'occurredAt 必须是合法 ISO 时间' }
  if (note !== undefined && typeof note !== 'string') return { ok: false, message: 'note 必须为字符串' }
  return { ok: true, data: { type, amount, category, note, occurredAt } }
}

export const entriesRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/entries?from=&to=&limit=
  app.get('/api/entries', { preHandler: requireAuth }, async (req) => {
    const q = req.query as { from?: string; to?: string; limit?: string }
    const limit = parseLimit(q.limit)
    const where: any = { userId: req.user!.id }
    if (q.from || q.to) {
      where.occurredAt = {}
      if (q.from) where.occurredAt.gte = new Date(q.from)
      if (q.to) where.occurredAt.lte = new Date(q.to)
    }
    const entries = await prisma.bookkeepingEntry.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit,
    })
    return { entries: entries.map(serializeEntry) }
  })

  // POST /api/entries
  app.post('/api/entries', { preHandler: requireAuth }, async (req, reply) => {
    const validated = validateEntry(req.body)
    if (!validated.ok) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: validated.message } })
    }
    const entry = await prisma.bookkeepingEntry.create({
      data: {
        userId: req.user!.id,
        type: validated.data.type,
        amount: validated.data.amount,
        category: validated.data.category,
        note: validated.data.note,
        occurredAt: new Date(validated.data.occurredAt),
      },
    })
    return reply.code(201).send({ entry: serializeEntry(entry) })
  })

  // PUT /api/entries/:id
  app.put('/api/entries/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as any).id
    const existing = await prisma.bookkeepingEntry.findFirst({
      where: { id, userId: req.user!.id },
    })
    if (!existing) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '记账不存在' } })
    }

    const body = req.body as Partial<CreateEntryInput>
    const data: any = {}
    if (body.type !== undefined) {
      if (body.type !== 'income' && body.type !== 'expense') {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'type 非法' } })
      }
      data.type = body.type
    }
    if (body.amount !== undefined) {
      if (typeof body.amount !== 'number' || body.amount <= 0) {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'amount 必须为正数' } })
      }
      data.amount = body.amount
    }
    if (body.category !== undefined) data.category = body.category
    if (body.note !== undefined) {
      if (typeof body.note !== 'string') {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'note 必须为字符串' } })
      }
      data.note = body.note
    }
    if (body.occurredAt !== undefined) {
      if (isNaN(Date.parse(body.occurredAt))) {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'occurredAt 非法' } })
      }
      data.occurredAt = new Date(body.occurredAt)
    }

    const updated = await prisma.bookkeepingEntry.update({
      where: { id },
      data,
    })
    return { entry: serializeEntry(updated) }
  })

  // DELETE /api/entries/:id
  app.delete('/api/entries/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as any).id
    const existing = await prisma.bookkeepingEntry.findFirst({
      where: { id, userId: req.user!.id },
    })
    if (!existing) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '记账不存在' } })
    }
    await prisma.bookkeepingEntry.delete({ where: { id } })
    return { success: true }
  })
}
