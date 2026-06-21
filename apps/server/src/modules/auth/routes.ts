import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { hashPassword, comparePassword, generateToken } from '../../lib/auth.js'
import { sendEmailCode, verifyEmailCode } from '../../lib/email.js'
import { generateQrcode, checkScanStatus, confirmScan } from '../../lib/wechat-mock.js'
import { authMiddleware, type AuthRequest } from '../../middlewares/auth.js'

const router: Router = Router()

// ============ 工具函数 ============

/** 检测账号类型 */
function detectAccountType(account: string): 'phone' | 'email' | 'wechat' | 'username' | null {
  if (/^1[3-9]\d{9}$/.test(account)) return 'phone'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) return 'email'
  if (/^wx_/.test(account)) return 'wechat'
  if (account.length >= 2 && account.length <= 30) return 'username'
  return null
}

/** 根据账号类型查找用户 */
async function findUserByAccount(account: string, type: ReturnType<typeof detectAccountType>) {
  if (!type) return null

  if (type === 'phone') return prisma.user.findUnique({ where: { phone: account } })
  if (type === 'email') return prisma.user.findUnique({ where: { email: account } })
  if (type === 'wechat') return prisma.user.findUnique({ where: { wechat: account } })
  if (type === 'username') return prisma.user.findUnique({ where: { username: account } })
  return null
}

/** 生成随机用户名 */
function generateUsername(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${prefix}_${suffix}`
}

/** 格式化用户信息 */
function formatUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    phone: user.phone || null,
    email: user.email || null,
    nickname: user.nickname,
    avatar: user.avatar,
    loginType: user.loginType,
    registrationMethod: user.registrationMethod,
    imageCount: user.imageCount,
    consultCount: user.consultCount,
  }
}

/** 获取唯一用户名（带重试） */
async function getUniqueUsername(baseName: string): Promise<string> {
  let username = baseName
  let attempts = 0
  while (attempts < 10) {
    const exists = await prisma.user.findUnique({ where: { username } })
    if (!exists) return username
    username = generateUsername(baseName.split('_')[0])
    attempts++
  }
  throw new Error('无法生成唯一用户名')
}

// ============ 发送验证码 ============

// 发送短信验证码（模拟）
router.post('/sms-code', async (req, res) => {
  const { phone } = req.body

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '请输入正确的手机号' })
  }

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
  const { phone, email, wechat, password, smsCode, emailCode, loginType } = req.body

  if (!password || password.length < 6) {
    return res.status(400).json({ error: '密码至少6位' })
  }

  // 邮箱注册（默认）
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

    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      return res.status(400).json({ error: '该邮箱已注册' })
    }

    const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9一-龥]/g, '').slice(0, 12) || 'user'
    const username = await getUniqueUsername(emailPrefix)

    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        nickname: `用户${emailPrefix.slice(-4)}`,
        loginType: 'email',
        registrationMethod: 'email',
      },
    })

    const token = generateToken(user.id)
    return res.json({ token, user: formatUser(user) })
  }

  // 手机号注册
  if (phone) {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确的手机号' })
    }
    if (!smsCode) {
      return res.status(400).json({ error: '请输入短信验证码' })
    }

    const existingPhone = await prisma.user.findUnique({ where: { phone } })
    if (existingPhone) {
      return res.status(400).json({ error: '该手机号已注册' })
    }

    const username = await getUniqueUsername(`user_${phone.slice(-4)}`)

    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        phone,
        username,
        password: hashedPassword,
        nickname: `用户${phone.slice(-4)}`,
        loginType: 'phone',
        registrationMethod: 'phone',
      },
    })

    const token = generateToken(user.id)
    return res.json({ token, user: formatUser(user) })
  }

  // 微信号注册
  if (wechat) {
    if (wechat.length < 2 || wechat.length > 30) {
      return res.status(400).json({ error: '微信号格式不正确' })
    }

    const existingWechat = await prisma.user.findUnique({ where: { wechat } })
    if (existingWechat) {
      return res.status(400).json({ error: '该微信号已注册' })
    }

    const username = await getUniqueUsername(`wx_${wechat.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`)

    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        wechat,
        username,
        password: hashedPassword,
        loginType: 'wechat',
        registrationMethod: 'wechat',
      },
    })

    const token = generateToken(user.id)
    return res.json({ token, user: formatUser(user) })
  }

  return res.status(400).json({ error: '请提供邮箱、手机号或微信号' })
})

// ============ 登录 ============

router.post('/login', async (req, res) => {
  const { account, phone, email, password, smsCode, emailCode, loginType } = req.body

  // 统一 account 字段（兼容旧版 phone/email 字段）
  const loginAccount = account || phone || email

  if (!loginAccount) {
    return res.status(400).json({ error: '请输入账号' })
  }

  // 检测账号类型
  const accountType = detectAccountType(loginAccount)

  // 根据登录方式处理
  const authType = loginType || 'password'

  // 特殊登录方式：邮箱验证码登录
  if (authType === 'email') {
    if (accountType !== 'email') {
      return res.status(400).json({ error: '邮箱验证码登录请使用邮箱账号' })
    }
    if (!emailCode) {
      return res.status(400).json({ error: '请输入邮箱验证码' })
    }
    if (!verifyEmailCode(loginAccount, emailCode)) {
      return res.status(400).json({ error: '验证码错误或已过期' })
    }

    const user = await prisma.user.findUnique({ where: { email: loginAccount } })
    if (!user) {
      return res.status(400).json({ error: '用户不存在' })
    }
    if (user.status === 0) {
      return res.status(400).json({ error: '账号已被禁用' })
    }

    const token = generateToken(user.id)
    return res.json({ token, user: formatUser(user) })
  }

  // 特殊登录方式：短信验证码登录
  if (authType === 'sms') {
    if (accountType !== 'phone') {
      return res.status(400).json({ error: '短信验证码登录请使用手机号' })
    }
    if (!smsCode) {
      return res.status(400).json({ error: '请输入短信验证码' })
    }
    // TODO: 验证短信验证码

    const user = await prisma.user.findUnique({ where: { phone: loginAccount } })
    if (!user) {
      return res.status(400).json({ error: '用户不存在' })
    }
    if (user.status === 0) {
      return res.status(400).json({ error: '账号已被禁用' })
    }

    const token = generateToken(user.id)
    return res.json({ token, user: formatUser(user) })
  }

  // 默认：密码登录 — 支持邮箱/手机号/微信号/用户名
  if (authType === 'password') {
    if (!password) {
      return res.status(400).json({ error: '请输入密码' })
    }

    const user = await findUserByAccount(loginAccount, accountType)
    if (!user) {
      return res.status(400).json({ error: '用户不存在' })
    }
    if (user.status === 0) {
      return res.status(400).json({ error: '账号已被禁用' })
    }

    const isValid = await comparePassword(password, user.password || '')
    if (!isValid) {
      return res.status(400).json({ error: '密码错误' })
    }

    const token = generateToken(user.id)
    return res.json({ token, user: formatUser(user) })
  }

  return res.status(400).json({ error: '不支持的登录方式' })
})

// ============ 微信扫码登录 ============

router.get('/wechat/qrcode', (_req, res) => {
  const qrcode = generateQrcode()
  res.json(qrcode)
})

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

  if (state.status === 'confirmed') {
    let user = await prisma.user.findUnique({
      where: { wechatOpenId: state.userId! },
    })

    if (!user) {
      const username = await getUniqueUsername(`wx_${state.userId!.slice(-8)}`)
      user = await prisma.user.create({
        data: {
          wechatOpenId: state.userId!,
          username,
          nickname: state.nickname || `微信用户${state.userId!.slice(-4)}`,
          loginType: 'wechat',
          registrationMethod: 'wechat',
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

// ============ 实名认证 ============

// 提交实名认证
router.post('/real-name', authMiddleware, async (req: AuthRequest, res) => {
  const { realName, idCard } = req.body

  if (!realName || !idCard) {
    return res.status(400).json({ error: '请填写姓名和身份证号' })
  }

  if (!/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard)) {
    return res.status(400).json({ error: '身份证号格式不正确' })
  }

  // 检查身份证是否已被认证
  const existingIdCard = await prisma.user.findFirst({
    where: { idCard, realNameStatus: 'verified', NOT: { id: req.userId } },
  })
  if (existingIdCard) {
    return res.status(400).json({ error: '该身份证号已被认证' })
  }

  await prisma.user.update({
    where: { id: req.userId },
    data: {
      realName,
      idCard,
      realNameStatus: 'pending',
    },
  })

  res.json({ message: '实名认证已提交，等待审核' })
})

// 获取实名认证状态
router.get('/real-name/status', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { realName: true, idCard: true, realNameStatus: true },
  })

  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }

  res.json(user)
})

// ============ 用户信息 ============

// 获取当前用户
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
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

// 退出登录
router.post('/logout', (_req, res) => {
  res.json({ message: '退出成功' })
})

export default router
