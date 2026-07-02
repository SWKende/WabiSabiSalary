import { prisma } from '../src/lib/db.js'

export async function cleanDatabase() {
  // 删除顺序：先删依赖方
  await prisma.bookkeepingEntry.deleteMany({})
  await prisma.salaryConfig.deleteMany({})
  await prisma.user.deleteMany({})
}