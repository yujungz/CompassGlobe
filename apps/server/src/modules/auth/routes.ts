import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { hashPassword, comparePassword, generateToken } from '../../lib/auth.js'
import { sendEmailCode, verifyEmailCode } from '../../lib/email.js'
import { generateQrcode, checkScanStatus, confirmScan } from '../../lib/wechat-mock.js'
import { authMiddleware, type AuthRequest } from '../../middlewares/auth.js'

const router: Router = Router()

// ============ 发送验证码 ============

// 发送短信验证码（模拟）
router.post('/sms-code', async (req, res) => {
  const { phone } = req.body

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '请输入正确的手机号' })
  }

  // TODO: 接入真实短信服务
  console.log(`发送短信验证码到 ${phone}: 123456`)

  res.json({ message: '验证码已发送' })
})

// 发送邮箱验证码
router.post('/email-code', async (req, res) => {
  const { email } = req.body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '请输入正确的邮箱地址' })
  }

  try {
    await sendEmailCode(email)
    res.json({ message: '验证码已发送' })
  } catch (error: any) {
    console.error('发送邮箱验证码失败:', error)
    res.status(500).json({ error: '验证码发送失败，请稍后重试' })
  }
})

// ============ 注册 ============

router.post('/register', async (req, res) => {
  const { phone, email, password, smsCode, emailCode } = req.body

  if (!password || password.length < 6) {
    return res.status(400).json({ error: '密码至少6位' })
  }

  // 手机号注册
  if (phone) {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确的手机号' })
    }
    if (!smsCode) {
      return res.status(400).json({ error: '请输入短信验证码' })
    }
    // TODO: 验证短信验证码

    const existingUser = await prisma.user.findUnique({ where: { phone } })
    if (existingUser) {
      return res.status(400).json({ error: '该手机号已注册' })
    }

    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        phone,
        password: hashedPassword,
        nickname: `用户${phone.slice(-4)}`,
        loginType: 'phone',
      },
    })

    const token = generateToken(user.id)
    return res.json({
      token,
      user: formatUser(user),
    })
  }

  // 邮箱注册
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '请输入正确的邮箱地址' })
    }
    if (!emailCode) {
      return res.status(400).json({ error: '请输入邮箱验证码' })
    }
    if (!verifyEmailCode(email, emailCode)) {
      return res.status(400).json({ error: '验证码错误或已过期' })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已注册' })
    }

    const hashedPassword = await hashPassword(password)
    const emailPrefix = email.split('@')[0]
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname: `用户${emailPrefix.slice(-4)}`,
        loginType: 'email',
      },
    })

    const token = generateToken(user.id)
    return res.json({
      token,
      user: formatUser(user),
    })
  }

  return res.status(400).json({ error: '请提供手机号或邮箱' })
})

// ============ 登录 ============

router.post('/login', async (req, res) => {
  const { phone, email, password, smsCode, emailCode, loginType } = req.body

  let user: any = null

  // 根据账号类型查找用户
  if (phone) {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确的手机号' })
    }
    user = await prisma.user.findUnique({ where: { phone } })
  } else if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '请输入正确的邮箱地址' })
    }
    user = await prisma.user.findUnique({ where: { email } })
  } else {
    return res.status(400).json({ error: '请提供手机号或邮箱' })
  }

  if (!user) {
    return res.status(400).json({ error: '用户不存在' })
  }

  if (user.status === 0) {
    return res.status(400).json({ error: '账号已被禁用' })
  }

  // 密码登录
  if (loginType === 'password') {
    if (!password) {
      return res.status(400).json({ error: '请输入密码' })
    }
    const isValid = await comparePassword(password, user.password || '')
    if (!isValid) {
      return res.status(400).json({ error: '密码错误' })
    }
  }
  // 短信验证码登录
  else if (loginType === 'sms') {
    if (!smsCode) {
      return res.status(400).json({ error: '请输入短信验证码' })
    }
    // TODO: 验证短信验证码
  }
  // 邮箱验证码登录
  else if (loginType === 'email') {
    if (!emailCode) {
      return res.status(400).json({ error: '请输入邮箱验证码' })
    }
    if (!verifyEmailCode(email || user.email, emailCode)) {
      return res.status(400).json({ error: '验证码错误或已过期' })
    }
  } else {
    return res.status(400).json({ error: '不支持的登录方式' })
  }

  const token = generateToken(user.id)
  res.json({
    token,
    user: formatUser(user),
  })
})

// ============ 微信扫码登录 ============

// 获取微信二维码
router.get('/wechat/qrcode', (_req, res) => {
  const qrcode = generateQrcode()
  res.json(qrcode)
})

// 检查微信扫码状态
router.get('/wechat/check/:ticket', async (req, res) => {
  const { ticket } = req.params
  const state = checkScanStatus(ticket)

  if (!state) {
    return res.status(400).json({ error: '二维码已过期，请重新获取' })
  }

  if (state.status === 'pending') {
    return res.json({ status: 'pending', message: '等待扫码' })
  }

  if (state.status === 'scanned') {
    return res.json({ status: 'scanned', message: '已扫码，等待确认' })
  }

  // 已确认 — 查找或创建用户
  if (state.status === 'confirmed') {
    let user = await prisma.user.findUnique({
      where: { wechatOpenId: state.userId! },
    })

    if (!user) {
      // 首次扫码，自动注册
      user = await prisma.user.create({
        data: {
          wechatOpenId: state.userId!,
          nickname: state.nickname || `微信用户${state.userId!.slice(-4)}`,
          loginType: 'wechat',
        },
      })
    }

    confirmScan(ticket)

    const token = generateToken(user.id)
    return res.json({
      status: 'confirmed',
      token,
      user: formatUser(user),
    })
  }
})

// ============ 用户信息 ============

// 获取当前用户
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      phone: true,
      email: true,
      nickname: true,
      avatar: true,
      loginType: true,
      createdAt: true,
    },
  })

  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }

  res.json(user)
})

// 退出登录
router.post('/logout', (_req, res) => {
  res.json({ message: '退出成功' })
})

// ============ 工具函数 ============

function formatUser(user: any) {
  return {
    id: user.id,
    phone: user.phone || null,
    email: user.email || null,
    nickname: user.nickname,
    avatar: user.avatar,
    loginType: user.loginType,
  }
}

export default router
