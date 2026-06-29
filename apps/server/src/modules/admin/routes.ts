import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { adminAuthMiddleware, superAdminOnly, type AdminAuthRequest } from '../../middlewares/admin-auth.js'
import { comparePassword, hashPassword, generateAdminToken } from '../../lib/admin-auth.js'
import { refreshCacheSection } from '../../lib/config.js'
import { generateFortunePDF, generateDivinationPDF, generateFengshuiHomePDF } from '../../lib/pdf.js'

const prisma = new PrismaClient()
const router: Router = Router()

// ============ 管理员登录 ============

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

// 当前管理员修改自己的昵称
router.put('/me/nickname', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const { nickname } = req.body
    await prisma.admin.update({ where: { id: req.adminId }, data: { nickname: nickname || null } })
    res.json({ message: '昵称修改成功', nickname: nickname || null })
  } catch (error) { console.error(error); res.status(500).json({ error: '修改失败' }) }
})

// 当前管理员修改自己的密码
router.put('/me/password', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '旧密码不能为空，新密码至少6位' })
    }
    const admin = await prisma.admin.findUnique({ where: { id: req.adminId } })
    if (!admin) return res.status(404).json({ error: '管理员不存在' })

    const valid = await comparePassword(oldPassword, admin.password)
    if (!valid) return res.status(400).json({ error: '旧密码错误' })

    const hashed = await hashPassword(newPassword)
    await prisma.admin.update({ where: { id: req.adminId }, data: { password: hashed } })
    res.json({ message: '密码修改成功' })
  } catch (error) {
    console.error('Change own password error:', error)
    res.status(500).json({ error: '修改失败' })
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

// ============ 管理员管理（仅超级管理员） ============

router.get('/admins', adminAuthMiddleware, superAdminOnly, async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      select: { id: true, username: true, nickname: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json(admins)
  } catch (error) {
    console.error('List admins error:', error)
    res.status(500).json({ error: '获取管理员列表失败' })
  }
})

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

// 编辑管理员（仅超级管理员，含用户名重名校验）
router.put('/admins/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { username, nickname, role } = req.body
    const admin = await prisma.admin.findUnique({ where: { id } })
    if (!admin) return res.status(404).json({ error: '管理员不存在' })
    const data: Record<string, any> = {}
    if (username !== undefined) {
      if (!username || username.trim().length < 2) return res.status(400).json({ error: '用户名至少2个字符' })
      const dup = await prisma.admin.findFirst({ where: { username: username.trim(), NOT: { id } } })
      if (dup) return res.status(400).json({ error: '用户名已存在' })
      data.username = username.trim()
    }
    if (nickname !== undefined) data.nickname = nickname || null
    if (role !== undefined) data.role = role
    const updated = await prisma.admin.update({ where: { id }, data, select: { id: true, username: true, nickname: true, role: true, status: true, createdAt: true } })
    res.json(updated)
  } catch (e) { console.error(e); res.status(500).json({ error: '编辑失败' }) }
})

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

// ============ 用户管理（管理员） ============

// 获取用户列表
router.get('/users', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = '1', pageSize = '20', keyword, status } = req.query as Record<string, string>

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20))

    const where: any = {}
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { phone: { contains: keyword } },
        { email: { contains: keyword } },
        { nickname: { contains: keyword } },
        { realName: { contains: keyword } },
      ]
    }
    if (status !== undefined && status !== '') {
      where.status = parseInt(status)
    }

    const [list, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          phone: true,
          email: true,
          realName: true,
          nickname: true,
          gender: true,
          realNameStatus: true,
          loginType: true,
          registrationMethod: true,
          imageCount: true,
          consultCount: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
      prisma.user.count({ where }),
    ])

    res.json({ list, total, page: pageNum, pageSize: pageSizeNum })
  } catch (error) {
    console.error('List users error:', error)
    res.status(500).json({ error: '获取用户列表失败' })
  }
})

// 获取用户详情
router.get('/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
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
        wechatOpenId: true,
        birthAddress: true,
        company: true,
        companyAddress: true,
        industry: true,
        profession: true,
        remark: true,
        realNameStatus: true,
        idCard: true,
        loginType: true,
        registrationMethod: true,
        imageCount: true,
        consultCount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    res.json(user)
  } catch (error) {
    console.error('Get user detail error:', error)
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

// 更新用户信息（超级管理员，含重复校验）
router.put('/users/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const data: Record<string, any> = {}

    // 唯一性字段校验
    if (body.username !== undefined) {
      if (!body.username || body.username.trim().length < 2) {
        return res.status(400).json({ error: '用户名至少2个字符' })
      }
      const dup = await prisma.user.findFirst({ where: { username: body.username, NOT: { id } } })
      if (dup) return res.status(400).json({ error: '该用户名已被使用' })
      data.username = body.username.trim()
    }

    if (body.phone !== undefined) {
      if (body.phone) {
        if (!/^1[3-9]\d{9}$/.test(body.phone)) {
          return res.status(400).json({ error: '手机号格式不正确' })
        }
        const dup = await prisma.user.findFirst({ where: { phone: body.phone, NOT: { id } } })
        if (dup) return res.status(400).json({ error: '该手机号已被使用' })
      }
      data.phone = body.phone || null
    }

    if (body.email !== undefined) {
      if (body.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
          return res.status(400).json({ error: '邮箱格式不正确' })
        }
        const dup = await prisma.user.findFirst({ where: { email: body.email, NOT: { id } } })
        if (dup) return res.status(400).json({ error: '该邮箱已被使用' })
      }
      data.email = body.email || null
    }

    if (body.wechat !== undefined) {
      if (body.wechat) {
        const dup = await prisma.user.findFirst({ where: { wechat: body.wechat, NOT: { id } } })
        if (dup) return res.status(400).json({ error: '该微信号已被使用' })
      }
      data.wechat = body.wechat || null
    }

    // 可修改字段
    if (body.realName !== undefined) data.realName = body.realName || null
    if (body.nickname !== undefined) data.nickname = body.nickname || null
    if (body.gender !== undefined) data.gender = body.gender || null
    if (body.birthYear !== undefined) data.birthYear = body.birthYear || null
    if (body.birthMonth !== undefined) data.birthMonth = body.birthMonth || null
    if (body.birthDay !== undefined) data.birthDay = body.birthDay || null
    if (body.birthHour !== undefined) data.birthHour = body.birthHour || null
    if (body.avatar !== undefined) data.avatar = body.avatar || null
    if (body.qq !== undefined) data.qq = body.qq || null
    if (body.birthAddress !== undefined) data.birthAddress = body.birthAddress || null
    if (body.company !== undefined) data.company = body.company || null
    if (body.companyAddress !== undefined) data.companyAddress = body.companyAddress || null
    if (body.industry !== undefined) data.industry = body.industry || null
    if (body.profession !== undefined) data.profession = body.profession || null
    if (body.remark !== undefined) data.remark = body.remark || null
    if (body.status !== undefined) data.status = body.status
    if (body.imageCount !== undefined) data.imageCount = body.imageCount
    if (body.consultCount !== undefined) data.consultCount = body.consultCount

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, username: true, phone: true, email: true,
        realName: true, nickname: true, gender: true,
        realNameStatus: true, status: true,
        imageCount: true, consultCount: true,
        createdAt: true, updatedAt: true,
      },
    })

    res.json(updated)
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ error: '更新用户信息失败' })
  }
})

// 实名认证审核
router.put('/users/:id/real-name', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body // "verified" | "unverified"

    if (!['verified', 'unverified'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' })
    }

    await prisma.user.update({
      where: { id },
      data: { realNameStatus: status },
    })

    res.json({ message: status === 'verified' ? '实名认证已通过' : '实名认证已驳回' })
  } catch (error) {
    console.error('Update real-name status error:', error)
    res.status(500).json({ error: '审核失败' })
  }
})

// 调整消费次数
router.put('/users/:id/consumption', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { imageCount, consultCount } = req.body

    const data: Record<string, number> = {}
    if (imageCount !== undefined) data.imageCount = Math.max(0, parseInt(imageCount) || 0)
    if (consultCount !== undefined) data.consultCount = Math.max(0, parseInt(consultCount) || 0)

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: '请提供要调整的次数' })
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, imageCount: true, consultCount: true },
    })

    res.json(user)
  } catch (error) {
    console.error('Update consumption error:', error)
    res.status(500).json({ error: '调整失败' })
  }
})

// 修改用户密码（超级管理员）
router.put('/users/:id/password', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { password } = req.body
    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' })
    }
    const hashed = await hashPassword(password)
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } })
    res.json({ message: '密码修改成功' })
  } catch (error) {
    console.error('Update user password error:', error)
    res.status(500).json({ error: '修改失败' })
  }
})

// 删除用户及所有关联数据（超级管理员）
router.delete('/users/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return res.status(404).json({ error: '用户不存在' })

    // 删除所有关联数据（Prisma cascade 已处理 analyses / histories / fengshuiHomes / fortuneRecords / divinationRecords / conversations）
    // 但 conversations → messages 的 cascade 需要确保
    // 先手动删除 messages
    const conversations = await prisma.conversation.findMany({ where: { userId: id }, select: { id: true } })
    for (const conv of conversations) {
      await prisma.message.deleteMany({ where: { conversationId: conv.id } })
    }
    await prisma.conversation.deleteMany({ where: { userId: id } })

    // 删除用户（cascade 会自动删除 analyses, histories, fengshuiHomes, fortuneRecords, divinationRecords）
    await prisma.user.delete({ where: { id } })

    res.json({ message: '用户及所有关联数据已删除' })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({ error: '删除失败' })
  }
})

// 启用/禁用用户
router.put('/users/:id/status', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (typeof status !== 'number' || ![0, 1].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' })
    }

    await prisma.user.update({ where: { id }, data: { status } })
    res.json({ message: status === 1 ? '已启用' : '已禁用' })
  } catch (error) {
    console.error('Update user status error:', error)
    res.status(500).json({ error: '操作失败' })
  }
})

// ============ 系统配置 ============

// 获取所有配置（合并数据库存储值 + .env 默认值）
router.get('/config/all', adminAuthMiddleware, async (_req, res) => {
  try {
    const configs = await prisma.config.findMany()
    const saved: Record<string, any> = {}
    for (const c of configs) { saved[c.key] = c.value }

    // 端口默认值
    const ports = {
      POSTGRES_PORT: '5432',
      REDIS_PORT: '6379',
      MINIO_API_PORT: '9000',
      MINIO_CONSOLE_PORT: '9001',
      SERVER_PORT: process.env.PORT || '3001',
      NGINX_PORT: '8110',
      ...saved.ports,
    }

    // 过滤占位符值
    const env = (key: string, fallback: string = '') => {
      const val = process.env[key] || ''
      if (val.startsWith('your-') || val === 'xxx' || val === '') return fallback
      return val
    }

    // 第三方接口默认值（从环境变量读取，过滤占位符）
    const thirdParty = {
      SMTP_HOST: env('SMTP_HOST', 'smtp.qq.com'),
      SMTP_PORT: env('SMTP_PORT', '465'),
      SMTP_USER: env('SMTP_USER'),
      SMTP_PASS: env('SMTP_PASS'),
      SMTP_FROM: env('SMTP_FROM'),
      QWEATHER_API_HOST: env('QWEATHER_API_HOST'),
      QWEATHER_PROJECT_ID: env('QWEATHER_PROJECT_ID'),
      QWEATHER_CREDENTIAL_ID: env('QWEATHER_CREDENTIAL_ID'),
      TDT_KEY: env('TDT_KEY'),
      AMAP_KEY: env('AMAP_KEY', '82f312a45f750e9962fff34d82421215'),
      ...saved.thirdParty,
    }

    // 大模型参数默认值（从环境变量读取）
    const aiModel = {
      AI_CHAT_URL: process.env.AI_CHAT_URL || '',
      AI_CHAT_KEY: process.env.AI_CHAT_KEY || '',
      AI_CHAT_MODEL: process.env.AI_CHAT_MODEL || '',
      AI_IMAGE_URL: process.env.AI_IMAGE_URL || '',
      AI_IMAGE_EDIT_URL: process.env.AI_IMAGE_EDIT_URL || '',
      AI_IMAGE_KEY: process.env.AI_IMAGE_KEY || process.env.AI_CHAT_KEY || '',
      AI_IMAGE_MODEL: process.env.AI_IMAGE_MODEL || '',
      ...saved.aiModel,
    }

    res.json({ ports, thirdParty, aiModel })
  } catch (error) {
    console.error('Get configs error:', error)
    res.status(500).json({ error: '获取配置失败' })
  }
})

// 保存端口配置（含冲突检测）
router.put('/config/ports', adminAuthMiddleware, async (req, res) => {
  try {
    const ports = req.body
    // 检测冲突：检查 Docker 已使用的端口（通过检查端口是否可达）
    const conflicts: string[] = []
    const net = await import('net')
    for (const [name, port] of Object.entries(ports)) {
      if (!port) continue
      const portNum = parseInt(port as string)
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        conflicts.push(`${name}: 端口号无效 (${port})`)
        continue
      }
      // 尝试连接检测端口是否被占用
      await new Promise<void>((resolve) => {
        const socket = new net.Socket()
        socket.setTimeout(500)
        socket.on('connect', () => {
          conflicts.push(`${name}: 端口 ${port} 已被占用`)
          socket.destroy()
          resolve()
        })
        socket.on('error', () => resolve())
        socket.on('timeout', () => { socket.destroy(); resolve() })
        socket.connect(portNum, '127.0.0.1')
      })
    }
    // 也检测内部是否有重复
    const seen: Record<string, string> = {}
    for (const [name, port] of Object.entries(ports)) {
      if (!port) continue
      if (seen[port as string]) {
        conflicts.push(`${name} 与 ${seen[port as string]} 端口冲突 (${port})`)
      }
      seen[port as string] = name
    }

    if (conflicts.length > 0) {
      return res.json({ conflicts })
    }

    await prisma.config.upsert({
      where: { key: 'ports' },
      update: { value: ports },
      create: { key: 'ports', value: ports, desc: '端口映射配置' },
    })
    refreshCacheSection('ports', ports)
    res.json({ message: '保存成功' })
  } catch (error) {
    console.error('Save ports error:', error)
    res.status(500).json({ error: '保存失败' })
  }
})

// 保存第三方接口配置
router.put('/config/third-party', adminAuthMiddleware, async (req, res) => {
  try {
    await prisma.config.upsert({
      where: { key: 'thirdParty' },
      update: { value: req.body },
      create: { key: 'thirdParty', value: req.body, desc: '第三方接口配置' },
    })
    refreshCacheSection('thirdParty', req.body)
    res.json({ message: '保存成功' })
  } catch (error) {
    console.error('Save third-party error:', error)
    res.status(500).json({ error: '保存失败' })
  }
})

// 保存大模型参数
router.put('/config/ai-model', adminAuthMiddleware, async (req, res) => {
  try {
    await prisma.config.upsert({
      where: { key: 'aiModel' },
      update: { value: req.body },
      create: { key: 'aiModel', value: req.body, desc: '大模型参数配置' },
    })
    refreshCacheSection('aiModel', req.body)
    res.json({ message: '保存成功' })
  } catch (error) {
    console.error('Save AI model error:', error)
    res.status(500).json({ error: '保存失败' })
  }
})

// ============ 服务测试 ============

// 测试邮箱
router.post('/test/email', adminAuthMiddleware, async (req, res) => {
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = req.body
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      host: SMTP_HOST, port: parseInt(SMTP_PORT) || 465, secure: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
    await transporter.verify()
    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to: SMTP_USER,
      subject: '风水地球仪 - 邮箱测试',
      text: '这是一封测试邮件，如果您收到此邮件，说明邮箱配置正确。',
    })
    res.json({ success: true, message: '测试邮件已发送，请检查收件箱' })
  } catch (e: any) {
    res.json({ success: false, message: `邮箱测试失败：${e.message}` })
  }
})

// 测试和风天气
router.post('/test/qweather', adminAuthMiddleware, async (req, res) => {
  try {
    const { QWEATHER_API_HOST, QWEATHER_PROJECT_ID, QWEATHER_CREDENTIAL_ID } = req.body
    const privateKeyPath = process.env.QWEATHER_PRIVATE_KEY_PATH || ''
    if (!privateKeyPath) throw new Error('未配置私钥路径')
    if (!QWEATHER_API_HOST) throw new Error('未配置 API 地址')

    // 用 Node.js 原生 crypto 生成 Ed25519 JWT（与 globe 模块一致）
    const fs = await import('fs')
    const crypto = await import('node:crypto')

    // 检查路径是否为文件（Docker 挂载文件不存在时会创建目录）
    const stat = fs.statSync(privateKeyPath)
    if (stat.isDirectory()) {
      throw new Error('私钥文件不存在（Docker 将挂载路径创建为目录）。请在宿主机创建 secrets/qweather-ed25519.pem 文件后重新部署')
    }
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8')

    function b64url(v: Record<string, unknown>): string {
      return Buffer.from(JSON.stringify(v)).toString('base64url')
    }
    const pid = QWEATHER_PROJECT_ID || process.env.QWEATHER_PROJECT_ID || ''
    const kid = QWEATHER_CREDENTIAL_ID || process.env.QWEATHER_CREDENTIAL_ID || ''
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'EdDSA', kid }
    const payload = { sub: pid, iat: now, exp: now + 900 }
    const signingInput = `${b64url(header)}.${b64url(payload)}`
    const sig = crypto.sign(null, Buffer.from(signingInput), privateKey)
    const token = `${signingInput}.${sig.toString('base64url')}`

    const url = `https://${QWEATHER_API_HOST}/v7/weather/now?location=101010100`
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
    const data: any = await resp.json()

    if (data.code === '200') {
      res.json({ success: true, message: `和风天气连接成功：${data.now?.text || 'OK'} ${data.now?.temp || ''}°C` })
    } else {
      res.json({ success: false, message: `和风天气返回错误：code=${data.code}` })
    }
  } catch (e: any) {
    res.json({ success: false, message: `和风天气测试失败：${e.message}` })
  }
})

// 测试 AI 对话
router.post('/test/ai-chat', adminAuthMiddleware, async (req, res) => {
  try {
    const { AI_CHAT_URL, AI_CHAT_KEY, AI_CHAT_MODEL } = req.body
    const resp = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_CHAT_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_CHAT_MODEL, messages: [{ role: 'user', content: 'hi' }] }),
      signal: AbortSignal.timeout(30000),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data: any = await resp.json()
    const reply = data.choices?.[0]?.message?.content || '(empty)'
    res.json({ success: true, message: `AI 对话测试成功：${reply.slice(0, 100)}` })
  } catch (e: any) {
    res.json({ success: false, message: `AI 对话测试失败：${e.message}` })
  }
})

// 测试生图
router.post('/test/ai-image', adminAuthMiddleware, async (req, res) => {
  try {
    const { AI_IMAGE_URL, AI_IMAGE_KEY, AI_IMAGE_MODEL } = req.body
    const resp = await fetch(AI_IMAGE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_IMAGE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_IMAGE_MODEL, prompt: 'a red dot', n: 1, size: '256x256' }),
      signal: AbortSignal.timeout(90000),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data: any = await resp.json()
    if (data.data?.[0]) {
      res.json({ success: true, message: '生图测试成功：API 返回图片' })
    } else {
      res.json({ success: false, message: `生图返回异常：${JSON.stringify(data).slice(0, 200)}` })
    }
  } catch (e: any) {
    res.json({ success: false, message: `生图测试失败：${e.message}` })
  }
})

// 测试修图
router.post('/test/ai-edit', adminAuthMiddleware, async (req, res) => {
  try {
    const { AI_IMAGE_EDIT_URL, AI_IMAGE_KEY, AI_IMAGE_MODEL } = req.body
    // 生成一个 1x1 的红色 PNG 作为测试原图
    const tinyImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64')
    const form = new FormData()
    form.append('model', AI_IMAGE_MODEL)
    form.append('prompt', 'change red to blue')
    form.append('n', '1')
    form.append('size', '256x256')
    form.append('image', new Blob([tinyImage], { type: 'image/png' }), 'test.png')
    const resp = await fetch(AI_IMAGE_EDIT_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_IMAGE_KEY}` },
      body: form,
      signal: AbortSignal.timeout(90000),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data: any = await resp.json()
    if (data.data?.[0]) {
      res.json({ success: true, message: '修图测试成功：API 返回编辑后的图片' })
    } else {
      res.json({ success: false, message: `修图返回异常：${JSON.stringify(data).slice(0, 200)}` })
    }
  } catch (e: any) {
    res.json({ success: false, message: `修图测试失败：${e.message}` })
  }
})

// ============ 数据概览 ============

router.get('/dashboard', adminAuthMiddleware, async (_req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [totalUsers, todayUsers, totalAnalyses, todayAnalyses, totalFengshui, totalFortune, totalDivination, totalConversations, recentActivity] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.analysis.count(),
      prisma.analysis.count({ where: { createdAt: { gte: today } } }),
      prisma.fengshuiHome.count(),
      prisma.fortuneRecord.count(),
      prisma.divinationRecord.count(),
      prisma.conversation.count(),
      // 最近7天每日趋势
      (async () => {
        const days: string[] = []; const userCounts: number[] = []; const analysisCounts: number[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today); d.setDate(d.getDate() - i)
          const day = `${d.getMonth() + 1}-${d.getDate()}`
          days.push(day)
          userCounts.push(await prisma.user.count({ where: { createdAt: { gte: d, lt: new Date(d.getTime() + 86400000) } } }))
          analysisCounts.push(await prisma.analysis.count({ where: { createdAt: { gte: d, lt: new Date(d.getTime() + 86400000) } } }))
        }
        return { days, userCounts, analysisCounts }
      })(),
    ])

    res.json({
      stats: { totalUsers, todayUsers, totalAnalyses, todayAnalyses, totalFengshui, totalFortune, totalDivination, totalConversations },
      chart: recentActivity,
    })
  } catch (e) { console.error(e); res.status(500).json({ error: '获取失败' }) }
})

// ============ 地理分析记录管理 ============

router.get('/analyses', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = '1', pageSize = '20', username = '', startDate = '', endDate = '' } = req.query as Record<string, string>
    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
    const where: any = {}
    if (username.trim()) where.user = { username: { contains: username.trim() } }
    const sDate = startDate?.trim()
    const eDate = endDate?.trim()
    const tryParse = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? null : d }
    if (sDate) {
      const d = tryParse(sDate + 'T00:00:00.000Z') || tryParse(sDate)
      if (d) where.createdAt = { ...where.createdAt, gte: d }
    }
    if (eDate) {
      const d = tryParse(eDate + 'T23:59:59.999Z') || tryParse(eDate)
      if (d) where.createdAt = { ...where.createdAt, lte: d }
    }
    const [list, total] = await Promise.all([
      prisma.analysis.findMany({
        where,
        select: { id: true, userId: true, user: { select: { username: true } }, longitude: true, latitude: true, altitude: true, address: true, result: true, createdAt: true },
        orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * pageSizeNum, take: pageSizeNum,
      }),
      prisma.analysis.count({ where }),
    ])
    res.json({ list, total, page: pageNum, pageSize: pageSizeNum })
  } catch (e) { console.error(e); res.status(500).json({ error: '获取失败' }) }
})

router.delete('/analyses/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try {
    await prisma.analysis.deleteMany({ where: { id: req.params.id } })
    res.json({ message: '删除成功' })
  } catch (e) { console.error(e); res.status(500).json({ error: '删除失败' }) }
})

// ============ 居家风水记录管理 ============

router.get('/fengshui-homes', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = '1', pageSize = '20', username = '', startDate = '', endDate = '' } = req.query as Record<string, string>
    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
    const where: any = {}
    const tryParse = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? null : d }
    if (username.trim()) where.user = { username: { contains: username.trim() } }
    const sd = tryParse(startDate); if (sd) where.createdAt = { ...where.createdAt, gte: sd }
    const ed = tryParse(endDate + 'T23:59:59.999Z'); if (ed) where.createdAt = { ...where.createdAt, lte: ed }
    const [list, total] = await Promise.all([
      prisma.fengshuiHome.findMany({ where, select: { id: true, userId: true, user: { select: { username: true } }, images: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * pageSizeNum, take: pageSizeNum }),
      prisma.fengshuiHome.count({ where }),
    ])
    res.json({ list, total, page: pageNum, pageSize: pageSizeNum })
  } catch (e) { console.error(e); res.status(500).json({ error: '获取失败' }) }
})

router.get('/fengshui-homes/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const r = await prisma.fengshuiHome.findUnique({ where: { id: req.params.id } })
    if (!r) return res.status(404).json({ error: '不存在' })
    res.json(r)
  } catch (e) { console.error(e); res.status(500).json({ error: '获取失败' }) }
})

router.delete('/fengshui-homes/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try { await prisma.fengshuiHome.deleteMany({ where: { id: req.params.id } }); res.json({ message: '删除成功' }) }
  catch (e) { console.error(e); res.status(500).json({ error: '删除失败' }) }
})

// ============ 流年大运记录管理 ============

router.get('/fortune-records', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = '1', pageSize = '20', username = '', startDate = '', endDate = '' } = req.query as Record<string, string>
    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
    const where: any = {}
    const tryParse = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? null : d }
    if (username.trim()) where.user = { username: { contains: username.trim() } }
    const sd = tryParse(startDate); if (sd) where.createdAt = { ...where.createdAt, gte: sd }
    const ed = tryParse(endDate + 'T23:59:59.999Z'); if (ed) where.createdAt = { ...where.createdAt, lte: ed }
    const [list, total] = await Promise.all([
      prisma.fortuneRecord.findMany({ where, select: { id: true, userId: true, user: { select: { username: true } }, name: true, predictYear: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * pageSizeNum, take: pageSizeNum }),
      prisma.fortuneRecord.count({ where }),
    ])
    res.json({ list, total, page: pageNum, pageSize: pageSizeNum })
  } catch (e) { console.error(e); res.status(500).json({ error: '获取失败' }) }
})

router.get('/fortune-records/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const r = await prisma.fortuneRecord.findUnique({ where: { id: req.params.id } })
    if (!r) return res.status(404).json({ error: '不存在' })
    res.json(r)
  } catch (e) { console.error(e); res.status(500).json({ error: '获取失败' }) }
})

router.delete('/fortune-records/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try { await prisma.fortuneRecord.deleteMany({ where: { id: req.params.id } }); res.json({ message: '删除成功' }) }
  catch (e) { console.error(e); res.status(500).json({ error: '删除失败' }) }
})

// ============ 八卦问事记录管理 ============

router.get('/divination-records', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = '1', pageSize = '20', username = '', startDate = '', endDate = '' } = req.query as Record<string, string>
    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
    const where: any = {}
    const tryParse = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? null : d }
    if (username.trim()) where.user = { username: { contains: username.trim() } }
    const sd = tryParse(startDate); if (sd) where.createdAt = { ...where.createdAt, gte: sd }
    const ed = tryParse(endDate + 'T23:59:59.999Z'); if (ed) where.createdAt = { ...where.createdAt, lte: ed }
    const [list, total] = await Promise.all([
      prisma.divinationRecord.findMany({ where, select: { id: true, userId: true, user: { select: { username: true } }, name: true, question: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * pageSizeNum, take: pageSizeNum }),
      prisma.divinationRecord.count({ where }),
    ])
    res.json({ list, total, page: pageNum, pageSize: pageSizeNum })
  } catch (e) { console.error(e); res.status(500).json({ error: '获取失败' }) }
})

router.delete('/divination-records/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try { await prisma.divinationRecord.deleteMany({ where: { id: req.params.id } }); res.json({ message: '删除成功' }) }
  catch (e) { console.error(e); res.status(500).json({ error: '删除失败' }) }
})

router.get('/divination-records/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const r = await prisma.divinationRecord.findUnique({ where: { id: req.params.id } })
    if (!r) return res.status(404).json({ error: '不存在' })
    res.json(r)
  } catch (e) { console.error(e); res.status(500).json({ error: '获取失败' }) }
})

// ============ AI 创作记录管理 ============

router.get('/ai-records', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = '1', pageSize = '20', username = '', prompt = '', type = '', startDate = '', endDate = '' } = req.query as Record<string, string>
    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
    const where: any = { type: { in: ['gen', 'edit'] } }
    if (username.trim()) where.user = { username: { contains: username.trim() } }
    if (type) where.type = type
    const tryParse = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? null : d }
    const sd = tryParse(startDate); if (sd) where.createdAt = { ...where.createdAt, gte: sd }
    const ed = tryParse(endDate + 'T23:59:59.999Z'); if (ed) where.createdAt = { ...where.createdAt, lte: ed }
    const [raw, total] = await Promise.all([
      prisma.history.findMany({
        where,
        select: { id: true, userId: true, user: { select: { username: true } }, type: true, content: true, createdAt: true },
        orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * pageSizeNum, take: pageSizeNum,
      }),
      prisma.history.count({ where }),
    ])
    let list = raw
    if (prompt.trim()) {
      const kw = prompt.trim().toLowerCase()
      list = raw.filter(r => String((r.content as any)?.prompt || '').toLowerCase().includes(kw))
    }
    res.json({ list, total, page: pageNum, pageSize: pageSizeNum })
  } catch (e) { console.error(e); res.status(500).json({ error: '获取失败' }) }
})

router.delete('/ai-records/:id', adminAuthMiddleware, superAdminOnly, async (req, res) => {
  try { await prisma.history.deleteMany({ where: { id: req.params.id } }); res.json({ message: '删除成功' }) }
  catch (e) { console.error(e); res.status(500).json({ error: '删除失败' }) }
})

// ============ 管理员 PDF 下载 ============

router.get('/pdf/fortune/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const record = await prisma.fortuneRecord.findUnique({ where: { id: req.params.id } })
    if (!record) return res.status(404).json({ error: '记录不存在' })
    const birthInfo = record.isLunar
      ? `农历 ${record.birthYear}年${record.birthMonth}月${record.birthDay}日 ${record.birthHour}时`
      : `公历 ${record.birthYear}年${record.birthMonth}月${record.birthDay}日 ${record.birthHour}时`
    generateFortunePDF(res, {
      name: record.name,
      gender: record.gender,
      birthInfo,
      baZi: (record.baZi as any) || { yearPillar: '', monthPillar: '', dayPillar: '', timePillar: '' },
      zodiac: record.zodiac || '',
      constellation: record.constellation || '',
      predictYear: record.predictYear,
      result: (record.result as any)?.analysis || '',
      birthAddress: record.birthAddress,
      company: record.company,
      industry: record.industry,
      profession: record.profession,
      remark: record.remark,
    })
  } catch (e) { console.error(e); res.status(500).json({ error: 'PDF 生成失败' }) }
})

router.get('/pdf/divination/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const record = await prisma.divinationRecord.findUnique({ where: { id: req.params.id } })
    if (!record) return res.status(404).json({ error: '记录不存在' })
    const hex = record.hexagram as any
    generateDivinationPDF(res, {
      name: record.name,
      gender: record.gender,
      question: record.question,
      hexagram: {
        originalName: hex.originalName || '',
        originalSymbol: hex.originalSymbol || '',
        originalGuaCi: hex.originalGuaCi || '',
        changedName: hex.changedName || undefined,
        changedSymbol: hex.changedSymbol || undefined,
        changingLines: hex.changingLines || [],
        yaoCi: hex.yaoCi || [],
      },
      result: (record.result as any)?.analysis || '',
    })
  } catch (e) { console.error(e); res.status(500).json({ error: 'PDF 生成失败' }) }
})

router.get('/pdf/fengshui-home/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const record = await prisma.fengshuiHome.findUnique({ where: { id: req.params.id } })
    if (!record) return res.status(404).json({ error: '记录不存在' })
    generateFengshuiHomePDF(res, {
      descriptions: record.descriptions || [],
      result: (record.result as any)?.analysis || '',
      createdAt: record.createdAt.toISOString(),
    })
  } catch (e) { console.error(e); res.status(500).json({ error: 'PDF 生成失败' }) }
})

export default router
