import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/admin-auth.js'

const prisma = new PrismaClient()

async function main() {
  const username = 'admin'
  const password = 'admin123'

  const existing = await prisma.admin.findUnique({ where: { username } })
  if (existing) {
    console.log('超级管理员已存在，跳过创建')
    return
  }

  const hashedPassword = await hashPassword(password)
  const admin = await prisma.admin.create({
    data: {
      username,
      password: hashedPassword,
      nickname: '超级管理员',
      role: 'super',
      status: 1,
    },
  })

  console.log(`超级管理员创建成功: ${admin.username} (ID: ${admin.id})`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
