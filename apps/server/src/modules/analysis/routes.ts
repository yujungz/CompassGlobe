import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../../middlewares/auth.js'
import { chatCompletion, isAiChatConfigured } from '../../lib/ai.js'
import { consumeConsult } from '../../lib/consumption.js'
import { buildFengShuiPrompt } from './prompt.js'

const router: Router = Router()

// AI 风水分析：基于位置上下文生成报告并落库
router.post('/analyze', authMiddleware, async (req: AuthRequest, res) => {
  const { longitude, latitude, altitude, address, weather, bagua } = req.body

  if (!longitude || !latitude) {
    return res.status(400).json({ error: '缺少位置信息' })
  }
  if (!isAiChatConfigured()) {
    return res.status(503).json({ error: 'AI 服务未配置' })
  }

  let content: string
  try {
    content = await chatCompletion(
      buildFengShuiPrompt({ longitude, latitude, altitude, address, weather, bagua }),
      { temperature: 0.7, timeoutMs: 90000 }
    )
  } catch (e) {
    console.error('AI 风水分析失败:', (e as Error).message)
    return res.status(502).json({ error: 'AI 分析失败，请稍后重试' })
  }

  // AI 成功后才消耗咨询次数（失败不扣）
  try {
    await consumeConsult(req.userId!)
  } catch (e: any) {
    return res.status(e.statusCode || 400).json({ error: e.message })
  }

  const analysis = await prisma.analysis.create({
    data: {
      userId: req.userId!,
      longitude,
      latitude,
      altitude: altitude || 0,
      address,
      weather,
      result: {
        content,
        model: process.env.AI_CHAT_MODEL,
        generatedAt: new Date().toISOString(),
      },
    },
  })

  res.json(analysis)
})

// 创建分析记录
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { longitude, latitude, altitude, address, weather, images } = req.body

  if (!longitude || !latitude) {
    return res.status(400).json({ error: '缺少位置信息' })
  }

  const analysis = await prisma.analysis.create({
    data: {
      userId: req.userId!,
      longitude,
      latitude,
      altitude: altitude || 0,
      address,
      weather,
      images,
    },
  })

  res.json(analysis)
})

// 获取分析记录
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params

  const analysis = await prisma.analysis.findFirst({
    where: { id, userId: req.userId },
  })

  if (!analysis) {
    return res.status(404).json({ error: '记录不存在' })
  }

  res.json(analysis)
})

// 更新分析结果
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params
  const { result } = req.body

  const analysis = await prisma.analysis.updateMany({
    where: { id, userId: req.userId },
    data: { result },
  })

  res.json(analysis)
})

// 获取用户分析历史
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const { page = 1, pageSize = 20 } = req.query

  const analyses = await prisma.analysis.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    skip: (parseInt(page as string) - 1) * parseInt(pageSize as string),
    take: parseInt(pageSize as string),
  })

  const total = await prisma.analysis.count({
    where: { userId: req.userId },
  })

  res.json({
    list: analyses,
    total,
    page: parseInt(page as string),
    pageSize: parseInt(pageSize as string),
  })
})

// 删除分析记录
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params

  await prisma.analysis.deleteMany({
    where: { id, userId: req.userId },
  })

  res.json({ message: '删除成功' })
})

export default router
