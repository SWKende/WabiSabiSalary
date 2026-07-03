import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'
import type { HolidayYearData } from '../types/shared.js'

export const holidaysRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/holidays', { preHandler: requireAuth }, async (req, reply) => {
    const q = req.query as { years?: string }
    const yearsParam = q.years ?? ''
    const years = yearsParam.split(',').map((s) => s.trim()).filter(Boolean)

    if (years.length === 0) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'years 参数必填' } })
    }

    const parsedYears: number[] = []
    for (const y of years) {
      const n = Number(y)
      if (!Number.isInteger(n) || n < 1900 || n > 2200) {
        return reply.code(400).send({ error: { code: 'INVALID_YEAR', message: `年份 ${y} 非法` } })
      }
      parsedYears.push(n)
    }

    const rows = await prisma.cnHolidayYear.findMany({
      where: { year: { in: parsedYears } },
      orderBy: { year: 'asc' },
    })

    const result: HolidayYearData[] = rows.map((row) => ({
      year: row.year,
      holidays: JSON.parse(row.holidays),
      workdays: JSON.parse(row.workdays),
    }))

    return { years: result }
  })
}
