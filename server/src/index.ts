import Fastify from 'fastify'
import cors from '@fastify/cors'
import { prisma } from './lib/db.js'
import { syncHolidaysIfMissing, startHolidaySyncCron } from './lib/holidaySync.js'
import { authPlugin } from './plugins/auth.js'
import { authRoutes } from './routes/auth.js'
import { configRoutes } from './routes/config.js'
import { entriesRoutes } from './routes/entries.js'
import { holidaysRoutes } from './routes/holidays.js'

const PORT = Number(process.env.PORT ?? 3000)

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true,
  })

  await app.register(cors, { origin: true })
  await app.register(authPlugin)
  await app.register(authRoutes)
  await app.register(configRoutes)
  await app.register(entriesRoutes)
  await app.register(holidaysRoutes)

  app.addHook('onReady', async () => {
    const now = new Date()
    const years = [now.getFullYear(), now.getFullYear() + 1]
    await syncHolidaysIfMissing(years)
    startHolidaySyncCron()
  })

  app.get('/health', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { status: 'ok', uptime: process.uptime() }
    } catch (err) {
      app.log.error({ err }, 'health check failed')
      return { status: 'degraded', uptime: process.uptime() }
    }
  })

  return app
}

async function main() {
  // 生产模式下 fail-fast：禁止 placeholder JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.JWT_SECRET ?? ''
    if (!secret || secret === 'replace-with-real-secret') {
      throw new Error(
        'JWT_SECRET 未设置或仍为占位符。生产环境请用 `openssl rand -hex 32` 生成并写入 .env'
      )
    }
  }

  const app = await buildApp()
  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`server listening on :${PORT}`)
}

// 仅在直接执行（tsx src/index.ts）时运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
