import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../../middlewares/auth.js'
import { chatCompletion, isAiChatConfigured } from '../../lib/ai.js'
import { consumeConsult } from '../../lib/consumption.js'
import { generateDivinationPDF } from '../../lib/pdf.js'
import { generateHexagram } from './hexagram.js'
import { buildDivinationPrompt } from './prompt.js'

const router: Router = Router()

// 生成卦象（不含 AI，不消耗次数，不保存）
router.post('/generate-hexagram', authMiddleware, (_req: AuthRequest, res) => {
  try {
    const hexagram = generateHexagram()
    res.json(hexagram)
  } catch (error: any) {
    console.error('Generate hexagram error:', error)
    res.status(500).json({ error: '卦象生成失败' })
  }
})

// 提交问题 + 卦象，获取 AI 解读
router.post('/ask', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, gender, question, hexagram } = req.body

    if (!name || !gender || !question || !hexagram) {
      return res.status(400).json({ error: '请填写完整信息' })
    }

    if (!isAiChatConfigured()) {
      return res.status(503).json({ error: 'AI 服务未配置' })
    }

    const messages = buildDivinationPrompt({ name, gender, question, hexagram })

    let aiResult: string
    try {
      aiResult = await chatCompletion(messages, { temperature: 0.7, timeoutMs: 120000 })
    } catch (e: any) {
      console.error('AI divination error:', e)
      return res.status(502).json({ error: 'AI 解读失败，请稍后重试' })
    }

    // AI 成功后才消耗咨询次数（失败不扣）
    try {
      await consumeConsult(req.userId!)
    } catch (e: any) {
      return res.status(e.statusCode || 400).json({ error: e.message })
    }

    try {

      const record = await prisma.divinationRecord.create({
        data: {
          userId: req.userId!,
          name,
          gender,
          question,
          hexagram,
          result: { analysis: aiResult },
        },
      })

      res.json({
        id: record.id,
        hexagram,
        result: { analysis: aiResult },
        createdAt: record.createdAt,
      })
    } catch (e: any) {
      console.error('AI divination error:', e)
      res.status(502).json({ error: 'AI 解读失败，请稍后重试' })
    }
  } catch (error: any) {
    console.error('Divination ask error:', error)
    res.status(500).json({ error: error.message || '请求失败' })
  }
})

// 获取历史记录
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const { page = '1', pageSize = '10' } = req.query as Record<string, string>
  const pageNum = Math.max(1, parseInt(page) || 1)
  const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize) || 10))

  try {
    const [list, total] = await Promise.all([
      prisma.divinationRecord.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
      prisma.divinationRecord.count({ where: { userId: req.userId! } }),
    ])

    res.json({ list, total, page: pageNum, pageSize: pageSizeNum })
  } catch (error) {
    console.error('List divination records error:', error)
    res.status(500).json({ error: '获取记录失败' })
  }
})

// 获取详情
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const record = await prisma.divinationRecord.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })
    if (!record) return res.status(404).json({ error: '记录不存在' })
    res.json(record)
  } catch (error) {
    console.error('Get divination record error:', error)
    res.status(500).json({ error: '获取详情失败' })
  }
})

// 下载 PDF
router.get('/:id/pdf', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const record = await prisma.divinationRecord.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })
    if (!record) return res.status(404).json({ error: '记录不存在' })

    const hex = record.hexagram as any
    await generateDivinationPDF(res, {
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
  } catch (error) {
    console.error('Generate divination PDF error:', error)
    res.status(500).json({ error: 'PDF 生成失败' })
  }
})

// 删除记录
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const record = await prisma.divinationRecord.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })
    if (!record) return res.status(404).json({ error: '记录不存在' })
    await prisma.divinationRecord.delete({ where: { id: record.id } })
    res.json({ message: '删除成功' })
  } catch (error) {
    console.error('Delete divination record error:', error)
    res.status(500).json({ error: '删除失败' })
  }
})

export default router
