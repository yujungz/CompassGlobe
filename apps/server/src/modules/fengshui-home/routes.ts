import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../../middlewares/auth.js'
import { chatCompletion, isAiChatConfigured } from '../../lib/ai.js'
import { consumeConsult } from '../../lib/consumption.js'
import { fengshuiUpload } from '../../lib/image-upload.js'
import { putObject, removeObjects } from '../../lib/storage.js'
import { generateFengshuiHomePDF } from '../../lib/pdf.js'
import { buildFengshuiHomePrompt } from './prompt.js'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

const router: Router = Router()

// 上传图片 + AI 分析
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  fengshuiUpload(req as any, res as any, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || '图片上传失败' })
    }

    const files = (req as any).files as Express.Multer.File[] | undefined
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请至少上传1张图片' })
    }

    // 获取图片说明
    let descriptions: string[] = []
    try {
      descriptions = typeof req.body.descriptions === 'string'
        ? JSON.parse(req.body.descriptions)
        : (req.body.descriptions || [])
    } catch { descriptions = [] }
    while (descriptions.length < files.length) descriptions.push('')

    if (!isAiChatConfigured()) {
      return res.status(503).json({ error: 'AI 服务未配置' })
    }

    // 压缩图片后构建 prompt（原图太大会被 AI 接口拒绝）
    const imageBuffers: Buffer[] = []
    const mimeTypes: string[] = []
    for (const f of files) {
      try {
        const resized = await sharp(f.buffer)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer()
        imageBuffers.push(resized)
        mimeTypes.push('image/jpeg')
      } catch {
        imageBuffers.push(f.buffer)
        mimeTypes.push(f.mimetype)
      }
    }

    let aiResult: string
    try {
      const messages = buildFengshuiHomePrompt(descriptions, imageBuffers, mimeTypes)
      aiResult = await chatCompletion(messages, { temperature: 0.7, timeoutMs: 180000 })
    } catch (e) {
      console.error('AI 分析失败:', e)
      return res.status(502).json({ error: 'AI 分析失败，请稍后重试' })
    }

    // AI 成功后才消耗次数
    try { await consumeConsult(req.userId!) }
    catch (e: any) { return res.status(e.statusCode || 400).json({ error: e.message }) }

    // 保存图片到 MinIO
    const prefix = `fengshui-home/${req.userId!}/${Date.now()}`
    const storageKeys: string[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const key = `${prefix}/${i}_${uuidv4().slice(0, 8)}.${files[i].mimetype.split('/')[1] || 'jpg'}`
        await putObject(key, files[i].buffer, files[i].mimetype)
        storageKeys.push(key)
      }
    } catch (e) {
      console.error('MinIO 保存失败:', e)
      return res.status(500).json({ error: '图片保存失败' })
    }

    // 保存记录
    try {
      const record = await prisma.fengshuiHome.create({
        data: {
          userId: req.userId!,
          images: storageKeys,
          descriptions: descriptions.slice(0, files.length),
          result: { analysis: aiResult },
        },
      })
      res.json({ id: record.id, images: storageKeys, descriptions: record.descriptions, result: { analysis: aiResult }, createdAt: record.createdAt })
    } catch (e: any) {
      console.error('Save record error:', e)
      res.status(500).json({ error: '记录保存失败' })
    }
  })
})

// 获取历史记录
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const { page = '1', pageSize = '10' } = req.query as Record<string, string>
  const pageNum = Math.max(1, parseInt(page) || 1)
  const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize) || 10))

  try {
    const [list, total] = await Promise.all([
      prisma.fengshuiHome.findMany({
        where: { userId: req.userId! },
        select: { id: true, images: true, descriptions: true, result: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
      prisma.fengshuiHome.count({ where: { userId: req.userId! } }),
    ])
    res.json({ list, total, page: pageNum, pageSize: pageSizeNum })
  } catch (error) {
    console.error('List fengshui home error:', error)
    res.status(500).json({ error: '获取记录失败' })
  }
})

// 获取详情
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const record = await prisma.fengshuiHome.findFirst({ where: { id: req.params.id, userId: req.userId! } })
    if (!record) return res.status(404).json({ error: '记录不存在' })
    res.json(record)
  } catch (error) {
    console.error('Get fengshui home error:', error)
    res.status(500).json({ error: '获取详情失败' })
  }
})

// 下载 PDF
router.get('/:id/pdf', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const record = await prisma.fengshuiHome.findFirst({ where: { id: req.params.id, userId: req.userId! } })
    if (!record) return res.status(404).json({ error: '记录不存在' })
    generateFengshuiHomePDF(res, {
      descriptions: record.descriptions || [],
      result: (record.result as any)?.analysis || '',
      createdAt: record.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Generate fengshui home PDF error:', error)
    res.status(500).json({ error: 'PDF 生成失败' })
  }
})

// 删除记录（同时删除 MinIO 中的图片）
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const record = await prisma.fengshuiHome.findFirst({ where: { id: req.params.id, userId: req.userId! } })
    if (!record) return res.status(404).json({ error: '记录不存在' })

    // 删除 MinIO 中的图片
    if (record.images.length > 0) {
      try { await removeObjects(record.images) } catch { /* 图片可能已不存在 */ }
    }

    await prisma.fengshuiHome.delete({ where: { id: record.id } })
    res.json({ message: '删除成功' })
  } catch (error) {
    console.error('Delete fengshui home error:', error)
    res.status(500).json({ error: '删除失败' })
  }
})

export default router
