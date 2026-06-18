import { Router } from 'express'
import { authMiddleware, type AuthRequest } from '../../middlewares/auth.js'
import { generateImage, editImage, isAiImageConfigured } from '../../lib/ai.js'

const router = Router()

// 去掉 data URL 前缀，拿到纯 base64
const stripDataUrl = (s: string) => String(s).replace(/^data:image\/\w+;base64,/, '')

// 文生图：{ prompt, size?, n? } → { image }
router.post('/image', authMiddleware, async (req: AuthRequest, res) => {
  const { prompt, size, n } = req.body
  if (!prompt) return res.status(400).json({ error: '请输入提示词' })
  if (!isAiImageConfigured()) return res.status(503).json({ error: 'AI 图像服务未配置' })

  try {
    const result = await generateImage(prompt, { size, n })
    const image = result.b64 ? `data:image/png;base64,${result.b64}` : result.url
    res.json({ image })
  } catch (e) {
    console.error('AI 文生图失败:', (e as Error).message)
    res.status(502).json({ error: 'AI 文生图失败，请稍后重试' })
  }
})

// 修图：{ prompt, image(base64 或 data URL), size?, mask? } → { image }
router.post('/edit', authMiddleware, async (req: AuthRequest, res) => {
  const { prompt, image, size, mask } = req.body
  if (!prompt) return res.status(400).json({ error: '请输入提示词' })
  if (!image) return res.status(400).json({ error: '缺少待编辑图片' })
  if (!isAiImageConfigured()) return res.status(503).json({ error: 'AI 图像服务未配置' })

  try {
    const imageBuffer = Buffer.from(stripDataUrl(image), 'base64')
    const maskBuffer = mask ? Buffer.from(stripDataUrl(mask), 'base64') : undefined
    const result = await editImage(imageBuffer, prompt, { size, mask: maskBuffer })
    const out = result.b64 ? `data:image/png;base64,${result.b64}` : result.url
    res.json({ image: out })
  } catch (e) {
    console.error('AI 修图失败:', (e as Error).message)
    res.status(502).json({ error: 'AI 修图失败，请稍后重试' })
  }
})

export default router
