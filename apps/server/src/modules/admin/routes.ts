import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { adminAuthMiddleware, superAdminOnly, type AdminAuthRequest } from '../../middlewares/admin-auth.js'
import { comparePassword, hashPassword, generateAdminToken } from '../../lib/admin-auth.js'

const prisma = new PrismaClient()
const router: Router = Router()

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' })
    }

    const admin = await prisma.admin.findUnique({ where: { username } })
    if (!admin) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    if (admin.status !== 1) {
      return res.status(403).json({ error: '账号已被禁用' })
    }

    const valid = await comparePassword(password, admin.password)
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    const token = generateAdminToken(admin.id, admin.role)

    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        role: admin.role,
      },
    })
  } catch (error) {
    console.error('Admin login error:', error)
    res.status(500).json({ error: '登录失败' })
  }
})

// 获取当前管理员信息
router.get('/me', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.adminId },
      select: { id: true, username: true, nickname: true, role: true, status: true, createdAt: true },
    })

    if (!admin) {
      return res.status(404).json({ error: '管理员不存在' })
    }

    res.json(admin)
  } catch (error) {
    console.error('Get admin me error:', error)
    res.status(500).json({ error: '获取信息失败' })
  }
})

// 管理员列表（仅超级管理员）
router.get('/admins', adminAuthMiddleware, superAdminOnly, async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      select: { id: true, username: true, nickname: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(admins)
  } catch (error) {
    console.error('List admins error:', error)
    res.status(500).json({ error: '获取管理员列表失败' })
  }
})

// 创建管理员（仅超级管理员）
router.post('/admins', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { username, password, nickname, role } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' })
    }

    const exists = await prisma.admin.findUnique({ where: { username } })
    if (exists) {
      return res.status(400).json({ error: '用户名已存在' })
    }

    const hashedPassword = await hashPassword(password)

    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        nickname: nickname || null,
        role: role === 'super' ? 'super' : 'normal',
      },
      select: { id: true, username: true, nickname: true, role: true, status: true, createdAt: true },
    })

    res.json(admin)
  } catch (error) {
    console.error('Create admin error:', error)
    res.status(500).json({ error: '创建管理员失败' })
  }
})

// 修改管理员密码（仅超级管理员）
router.put('/admins/:id/password', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { password } = req.body

    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' })
    }

    const admin = await prisma.admin.findUnique({ where: { id } })
    if (!admin) {
      return res.status(404).json({ error: '管理员不存在' })
    }

    const hashedPassword = await hashPassword(password)
    await prisma.admin.update({ where: { id }, data: { password: hashedPassword } })

    res.json({ message: '密码修改成功' })
  } catch (error) {
    console.error('Update admin password error:', error)
    res.status(500).json({ error: '修改密码失败' })
  }
})

// 启用/禁用管理员（仅超级管理员）
router.put('/admins/:id/status', adminAuthMiddleware, superAdminOnly, async (req: AdminAuthRequest, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (typeof status !== 'number' || ![0, 1].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' })
    }

    const admin = await prisma.admin.findUnique({ where: { id } })
    if (!admin) {
      return res.status(404).json({ error: '管理员不存在' })
    }

    if (admin.role === 'super') {
      return res.status(400).json({ error: '不能修改超级管理员状态' })
    }

    await prisma.admin.update({ where: { id }, data: { status } })
    res.json({ message: status === 1 ? '已启用' : '已禁用' })
  } catch (error) {
    console.error('Update admin status error:', error)
    res.status(500).json({ error: '修改状态失败' })
  }
})

// 删除管理员（仅超级管理员）
router.delete('/admins/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params

    const admin = await prisma.admin.findUnique({ where: { id } })
    if (!admin) {
      return res.status(404).json({ error: '管理员不存在' })
    }

    if (admin.role === 'super') {
      return res.status(400).json({ error: '不能删除超级管理员' })
    }

    await prisma.admin.delete({ where: { id } })
    res.json({ message: '删除成功' })
  } catch (error) {
    console.error('Delete admin error:', error)
    res.status(500).json({ error: '删除失败' })
  }
})

export default router
