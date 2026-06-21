import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../../middlewares/auth.js'
import { chatCompletion, isAiChatConfigured } from '../../lib/ai.js'
import { consumeConsult } from '../../lib/consumption.js'
import { generateFortunePDF } from '../../lib/pdf.js'
import { calculateFortune } from './fortune-utils.js'
import { buildFortunePrompt } from './prompt.js'

const router: Router = Router()

// 计算八字+大运（不含 AI，不消耗次数，不保存）
router.post('/calculate-bazi', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, isLunar, gender } = req.body

    if (!birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: '请提供完整的出生日期' })
    }

    const result = calculateFortune({
      birthYear: parseInt(birthYear),
      birthMonth: parseInt(birthMonth),
      birthDay: parseInt(birthDay),
      birthHour: parseInt(birthHour) || 0,
      isLunar: !!isLunar,
      gender: gender || 'male',
    })

    res.json(result)
  } catch (error: any) {
    console.error('Calculate BaZi error:', error)
    res.status(500).json({ error: error.message || '八字计算失败' })
  }
})

// 完整预测（计算八字 + AI 分析 + 保存记录）
router.post('/predict', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const {
      name, gender, birthYear, birthMonth, birthDay, birthHour, isLunar,
      birthAddress, company, industry, profession, remark,
    } = req.body

    if (!name || !gender || !birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: '请填写完整的出生信息' })
    }

    if (!isAiChatConfigured()) {
      return res.status(503).json({ error: 'AI 服务未配置' })
    }

    // 计算八字 + 大运
    const calcResult = calculateFortune({
      birthYear: parseInt(birthYear),
      birthMonth: parseInt(birthMonth),
      birthDay: parseInt(birthDay),
      birthHour: parseInt(birthHour) || 0,
      isLunar: !!isLunar,
      gender,
    })

    // 构建 prompt 并调用 AI
    const messages = buildFortunePrompt({
      name,
      gender,
      baZi: calcResult.baZi,
      daYun: calcResult.daYun,
      zodiac: calcResult.zodiac,
      constellation: calcResult.constellation,
      predictYear: calcResult.predictYear,
      birthAddress,
      company,
      industry,
      profession,
      remark,
    })

    let aiResult: string
    try {
      aiResult = await chatCompletion(messages, { temperature: 0.7, timeoutMs: 120000 })
    } catch (e: any) {
      console.error('AI fortune prediction error:', e)
      return res.status(502).json({ error: 'AI 分析失败，请稍后重试' })
    }

    // AI 成功后才消耗咨询次数（失败不扣）
    try {
      await consumeConsult(req.userId!)
    } catch (e: any) {
      return res.status(e.statusCode || 400).json({ error: e.message })
    }

    try {
      const record = await prisma.fortuneRecord.create({
        data: {
          userId: req.userId!,
          name,
          gender,
          birthYear: parseInt(birthYear),
          birthMonth: parseInt(birthMonth),
          birthDay: parseInt(birthDay),
          birthHour: parseInt(birthHour) || 0,
          isLunar: !!isLunar,
          birthAddress: birthAddress || null,
          company: company || null,
          industry: industry || null,
          profession: profession || null,
          remark: remark || null,
          baZi: JSON.parse(JSON.stringify(calcResult.baZi)),
          zodiac: calcResult.zodiac,
          constellation: calcResult.constellation,
          predictYear: calcResult.predictYear,
          result: { analysis: aiResult, daYun: calcResult.daYun },
        },
      })

      res.json({
        id: record.id,
        baZi: calcResult.baZi,
        daYun: calcResult.daYun,
        zodiac: calcResult.zodiac,
        constellation: calcResult.constellation,
        predictYear: calcResult.predictYear,
        result: { analysis: aiResult },
        createdAt: record.createdAt,
      })
    } catch (e: any) {
      console.error('AI fortune prediction error:', e)
      res.status(502).json({ error: 'AI 分析失败，请稍后重试' })
    }
  } catch (error: any) {
    console.error('Fortune predict error:', error)
    res.status(500).json({ error: error.message || '预测失败' })
  }
})

// 获取历史记录
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const { page = '1', pageSize = '10' } = req.query as Record<string, string>
  const pageNum = Math.max(1, parseInt(page) || 1)
  const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize) || 10))

  try {
    const [list, total] = await Promise.all([
      prisma.fortuneRecord.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
      prisma.fortuneRecord.count({ where: { userId: req.userId! } }),
    ])

    res.json({ list, total, page: pageNum, pageSize: pageSizeNum })
  } catch (error) {
    console.error('List fortune records error:', error)
    res.status(500).json({ error: '获取记录失败' })
  }
})

// 获取详情
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const record = await prisma.fortuneRecord.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })
    if (!record) return res.status(404).json({ error: '记录不存在' })
    res.json(record)
  } catch (error) {
    console.error('Get fortune record error:', error)
    res.status(500).json({ error: '获取详情失败' })
  }
})

// 下载 PDF
router.get('/:id/pdf', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const record = await prisma.fortuneRecord.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })
    if (!record) return res.status(404).json({ error: '记录不存在' })

    const birthInfo = record.isLunar
      ? `农历 ${record.birthYear}年${record.birthMonth}月${record.birthDay}日 ${record.birthHour}时（公历 ${record.birthYear}年）`
      : `公历 ${record.birthYear}年${record.birthMonth}月${record.birthDay}日 ${record.birthHour}时`

    await generateFortunePDF(res, {
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
  } catch (error) {
    console.error('Generate fortune PDF error:', error)
    res.status(500).json({ error: 'PDF 生成失败' })
  }
})

// 删除记录
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const record = await prisma.fortuneRecord.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })
    if (!record) return res.status(404).json({ error: '记录不存在' })
    await prisma.fortuneRecord.delete({ where: { id: record.id } })
    res.json({ message: '删除成功' })
  } catch (error) {
    console.error('Delete fortune record error:', error)
    res.status(500).json({ error: '删除失败' })
  }
})

export default router
