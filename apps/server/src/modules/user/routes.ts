import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../../middlewares/auth.js'
import { hashPassword, comparePassword } from '../../lib/auth.js'
import { getConsumption } from '../../lib/consumption.js'

const router: Router = Router()

// 获取用户完整信息
router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      username: true,
      phone: true,
      email: true,
      realName: true,
      nickname: true,
      gender: true,
      birthYear: true,
      birthMonth: true,
      birthDay: true,
      birthHour: true,
      avatar: true,
      wechat: true,
      qq: true,
      birthAddress: true,
      company: true,
      companyAddress: true,
      industry: true,
      profession: true,
      realNameStatus: true,
      idCard: true,
      loginType: true,
      registrationMethod: true,
      imageCount: true,
      consultCount: true,
      status: true,
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
  const {
    username, realName, nickname, gender,
    birthYear, birthMonth, birthDay, birthHour,
    avatar, wechat, qq,
    birthAddress, company, companyAddress,
    industry, profession,
  } = req.body

  // 构建更新数据
  const data: Record<string, any> = {}

  // 用户名：唯一性校验
  if (username !== undefined) {
    if (!username || username.trim().length < 2) {
      return res.status(400).json({ error: '用户名至少2个字符' })
    }
    const existing = await prisma.user.findFirst({
      where: { username, NOT: { id: req.userId } },
    })
    if (existing) {
      return res.status(400).json({ error: '该用户名已被使用' })
    }
    data.username = username.trim()
  }

  // 微信号：唯一性校验
  if (wechat !== undefined) {
    if (wechat) {
      const existing = await prisma.user.findFirst({
        where: { wechat, NOT: { id: req.userId } },
      })
      if (existing) {
        return res.status(400).json({ error: '该微信号已被使用' })
      }
    }
    data.wechat = wechat || null
  }

  // 手机号：唯一性校验（通常不应由用户自行修改，但允许）
  if (req.body.phone !== undefined) {
    const phone = req.body.phone
    if (phone) {
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: '手机号格式不正确' })
      }
      const existing = await prisma.user.findFirst({
        where: { phone, NOT: { id: req.userId } },
      })
      if (existing) {
        return res.status(400).json({ error: '该手机号已被使用' })
      }
    }
    data.phone = phone || null
  }

  // 邮箱：唯一性校验
  if (req.body.email !== undefined) {
    const email = req.body.email
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: '邮箱格式不正确' })
      }
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: req.userId } },
      })
      if (existing) {
        return res.status(400).json({ error: '该邮箱已被使用' })
      }
    }
    data.email = email || null
  }

  // 其他字段
  if (realName !== undefined) data.realName = realName || null
  if (nickname !== undefined) data.nickname = nickname || null
  if (gender !== undefined) data.gender = gender || null
  if (birthYear !== undefined) data.birthYear = birthYear || null
  if (birthMonth !== undefined) data.birthMonth = birthMonth || null
  if (birthDay !== undefined) data.birthDay = birthDay || null
  if (birthHour !== undefined) data.birthHour = birthHour || null
  if (avatar !== undefined) data.avatar = avatar || null
  if (qq !== undefined) data.qq = qq || null
  if (birthAddress !== undefined) data.birthAddress = birthAddress || null
  if (company !== undefined) data.company = company || null
  if (companyAddress !== undefined) data.companyAddress = companyAddress || null
  if (industry !== undefined) data.industry = industry || null
  if (profession !== undefined) data.profession = profession || null

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' })
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data,
    select: {
      id: true,
      username: true,
      phone: true,
      email: true,
      realName: true,
      nickname: true,
      gender: true,
      birthYear: true,
      birthMonth: true,
      birthDay: true,
      birthHour: true,
      avatar: true,
      wechat: true,
      qq: true,
      birthAddress: true,
      company: true,
      companyAddress: true,
      industry: true,
      profession: true,
      realNameStatus: true,
      idCard: true,
      loginType: true,
      registrationMethod: true,
      imageCount: true,
      consultCount: true,
      status: true,
      createdAt: true,
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

  // 验证旧密码
  if (user.password) {
    if (!oldPassword) {
      return res.status(400).json({ error: '请输入旧密码' })
    }
    const isValid = await comparePassword(oldPassword, user.password)
    if (!isValid) {
      return res.status(400).json({ error: '旧密码错误' })
    }
  }

  const hashedPassword = await hashPassword(newPassword)
  await prisma.user.update({
    where: { id: req.userId },
    data: { password: hashedPassword },
  })

  res.json({ message: '密码修改成功' })
})

// 获取消费次数
router.get('/consumption', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const consumption = await getConsumption(req.userId!)
    res.json(consumption)
  } catch (error) {
    console.error('获取消费信息失败:', error)
    res.status(500).json({ error: '获取失败' })
  }
})

export default router
