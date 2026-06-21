import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../../middlewares/auth.js'
import { generateImage, editImage, chatCompletion, isAiImageConfigured, type ChatMessage } from '../../lib/ai.js'
import { consumeImage } from '../../lib/consumption.js'
import { putObject } from '../../lib/storage.js'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
const router: Router = Router()

// 去掉 data URL 前缀，拿到纯 base64
const stripDataUrl = (s: string) => String(s).replace(/^data:image\/\w+;base64,/, '')

// 文生图：{ prompt, size?, n? } → { image, key }
router.post('/image', authMiddleware, async (req: AuthRequest, res) => {
  const { prompt, size, n } = req.body
  if (!prompt) return res.status(400).json({ error: '请输入提示词' })
  if (!isAiImageConfigured()) return res.status(503).json({ error: 'AI 图像服务未配置' })

  try {
    const result = await generateImage(prompt, { size, n })
    const image = result.b64 ? `data:image/png;base64,${result.b64}` : result.url

    // 消耗创作次数
    try { await consumeImage(req.userId!) }
    catch (e: any) { return res.status(e.statusCode || 400).json({ error: e.message }) }

    // 保存到 MinIO
    const key = `ai-gen/${req.userId!}/${uuidv4()}.png`
    const b64 = result.b64 || stripDataUrl(String(image).split(',')[1] || '')
    const buf = Buffer.from(b64, 'base64')
    await putObject(key, buf, 'image/png')

    // 保存记录
    await prisma.history.create({
      data: { userId: req.userId!, type: 'gen', content: { prompt, size, storageKey: key } },
    })

    res.json({ image, key })
  } catch (e) {
    console.error('AI 文生图失败:', (e as Error).message)
    res.status(502).json({ error: 'AI 文生图失败，请稍后重试' })
  }
})

// 修图：{ prompt, image(base64 或 data URL), size?, mask? } → { image, key }
router.post('/edit', authMiddleware, async (req: AuthRequest, res) => {
  const { prompt, image, size, mask } = req.body
  if (!prompt) return res.status(400).json({ error: '请输入提示词' })
  if (!image) return res.status(400).json({ error: '缺少待编辑图片' })
  if (!isAiImageConfigured()) return res.status(503).json({ error: 'AI 图像服务未配置' })

  try {
    let imageBuffer = Buffer.from(stripDataUrl(image), 'base64')
    // Resize image to 512px to avoid AI API rejecting large payloads
    try {
      imageBuffer = await sharp(imageBuffer).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
    } catch { /* sharp fails? use original */ }
    const masksBuffer = mask ? Buffer.from(stripDataUrl(mask), 'base64') : undefined
    const result = await editImage(imageBuffer, prompt, { size, mask: masksBuffer })
    const out = result.b64 ? `data:image/png;base64,${result.b64}` : result.url

    // 消耗创作次数
    try { await consumeImage(req.userId!) }
    catch (e: any) { return res.status(e.statusCode || 400).json({ error: e.message }) }

    // 保存到 MinIO
    const key = `ai-edit/${req.userId!}/${uuidv4()}.png`
    const b64 = result.b64 || stripDataUrl(String(out).split(',')[1] || '')
    const buf = Buffer.from(b64, 'base64')
    await putObject(key, buf, 'image/png')

    // 保存记录
    await prisma.history.create({
      data: { userId: req.userId!, type: 'edit', content: { prompt, storageKey: key } },
    })

    res.json({ image: out, key })
  } catch (e) {
    console.error('AI 修图失败:', (e as Error).message)
    res.status(502).json({ error: 'AI 修图失败，请稍后重试' })
  }
})

// ============ AI 创作历史 ============

// 获取文生图/修图历史（最近 20 张）
router.get('/history', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const records = await prisma.history.findMany({
      where: { userId: req.userId!, type: { in: ['gen', 'edit'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    res.json(records)
  } catch (error) {
    console.error('List AI history error:', error)
    res.status(500).json({ error: '获取历史失败' })
  }
})

// 删除单条历史记录
router.delete('/history/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const record = await prisma.history.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })
    if (!record) return res.status(404).json({ error: '记录不存在' })
    await prisma.history.delete({ where: { id: record.id } })
    res.json({ message: '删除成功' })
  } catch (error) {
    console.error('Delete history error:', error)
    res.status(500).json({ error: '删除失败' })
  }
})

// ============ AI 对话 ============

// 创建对话
router.post('/conversations', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const count = await prisma.conversation.count({ where: { userId: req.userId! } })
    if (count >= 20) {
      return res.status(400).json({ error: '对话数量已达上限（20个），请删除旧对话后再创建' })
    }

    const conversation = await prisma.conversation.create({
      data: { userId: req.userId! },
      select: { id: true, userId: true, title: true, createdAt: true, updatedAt: true },
    })

    res.json(conversation)
  } catch (error) {
    console.error('Create conversation error:', error)
    res.status(500).json({ error: '创建对话失败' })
  }
})

// 获取对话列表
router.get('/conversations', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.userId! },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    res.json(conversations)
  } catch (error) {
    console.error('List conversations error:', error)
    res.status(500).json({ error: '获取对话列表失败' })
  }
})

// 获取对话详情（含消息）
router.get('/conversations/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    })

    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' })
    }

    res.json(conversation)
  } catch (error) {
    console.error('Get conversation error:', error)
    res.status(500).json({ error: '获取对话失败' })
  }
})

// 发送消息（流式响应）
router.post('/conversations/:id/messages', authMiddleware, async (req: AuthRequest, res) => {
  const { content } = req.body

  if (!content || !content.trim()) {
    return res.status(400).json({ error: '请输入消息内容' })
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })

    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' })
    }

    if (conversation.messages.length >= 100) {
      return res.status(400).json({ error: '消息数量已达上限（100条），请创建新对话' })
    }

    // 保存用户消息
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: content.trim(),
      },
    })

    // 自动生成标题（取第一条用户消息前20字）
    if (!conversation.title) {
      const title = content.trim().slice(0, 20)
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { title },
      })
    }

    // 构建消息历史
    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个友好、博学的AI助手，请用中文回答用户的问题。回答要清晰、有条理。' },
      ...conversation.messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: content.trim() },
    ]

    // 设置 SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    try {
      // 调用 AI（非流式，后续可改为流式）
      const reply = await chatCompletion(messages, { temperature: 0.7, timeoutMs: 120000 })

      // 保存 AI 回复
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: reply,
        },
      })

      // 发送完整回复（拆分为多个 SSE 事件模拟流式）
      const chunks = reply.match(/.{1,50}/g) || [reply]
      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
    } catch (aiError) {
      console.error('AI reply error:', aiError)
      // 如果 AI 调用失败，删除刚保存的用户消息
      await prisma.message.deleteMany({
        where: { conversationId: conversation.id, role: 'user', createdAt: { gte: new Date(Date.now() - 5000) } },
      })
      res.write(`data: ${JSON.stringify({ error: 'AI 回复失败，请稍后重试' })}\n\n`)
      res.end()
    }
  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ error: '发送消息失败' })
  }
})

// 删除对话
router.delete('/conversations/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' })
    }

    await prisma.conversation.delete({ where: { id: conversation.id } })
    res.json({ message: '删除成功' })
  } catch (error) {
    console.error('Delete conversation error:', error)
    res.status(500).json({ error: '删除失败' })
  }
})

export default router
