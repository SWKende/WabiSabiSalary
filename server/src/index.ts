import Fastify from 'fastify'
import cors from '@fastify/cors'
import { prisma } from './lib/db.js'
import { authPlugin } from './plugins/auth.js'
import { authRoutes } from './routes/auth.js'
import { configRoutes } from './routes/config.js'

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
