import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../../middlewares/auth.js'
import { hashPassword } from '../../lib/auth.js'

const router: Router = Router()

// 获取用户信息
router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      phone: true,
      nickname: true,
      avatar: true,
      createdAt: true,
    },
  })

  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }

  res.json(user)
})

// 更新用户信息
router.put('/profile', authMiddleware, async (req: AuthRequest, res) => {
  const { nickname, avatar } = req.body

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { nickname, avatar },
    select: {
      id: true,
      phone: true,
      nickname: true,
      avatar: true,
    },
  })

  res.json(user)
})

// 修改密码
router.put('/password', authMiddleware, async (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '新密码至少6位' })
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }

  // TODO: 验证旧密码

  const hashedPassword = await hashPassword(newPassword)
  await prisma.user.update({
    where: { id: req.userId },
    data: { password: hashedPassword },
  })

  res.json({ message: '密码修改成功' })
})

export default router
