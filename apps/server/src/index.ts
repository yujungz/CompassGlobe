import 'dotenv/config'
import express, { type Express } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import helmet from 'helmet'
import { errorHandler, notFoundHandler } from './middlewares/error.js'
import authRoutes from './modules/auth/routes.js'
import globeRoutes from './modules/globe/routes.js'
import analysisRoutes from './modules/analysis/routes.js'
import userRoutes from './modules/user/routes.js'
import adminRoutes from './modules/admin/routes.js'
import aiRoutes from './modules/ai/routes.js'
import fengshuiHomeRoutes from './modules/fengshui-home/routes.js'
import fortuneRoutes from './modules/fortune/routes.js'
import divinationRoutes from './modules/divination/routes.js'
import { getObject } from './lib/storage.js'

const app: Express = express()
const PORT = process.env.PORT || 3001

// 中间件
app.use(helmet())
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-domain.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API 路由
app.use('/api/auth', authRoutes)
app.use('/api/globe', globeRoutes)
app.use('/api/analysis', analysisRoutes)
app.use('/api/user', userRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/fengshui-home', fengshuiHomeRoutes)
app.use('/api/fortune', fortuneRoutes)
app.use('/api/divination', divinationRoutes)

// MinIO 存储代理（通过 API 访问文件，避免直接暴露 MinIO）
app.get('/api/storage/*', async (req, res) => {
  try {
    const key = (req.params as Record<string, string>)['0']
    if (!key) return res.status(400).json({ error: '缺少文件路径' })
    const { buffer, mimeType } = await getObject(key)
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(buffer)
  } catch {
    res.status(404).json({ error: '文件不存在' })
  }
})

// 错误处理
app.use(notFoundHandler)
app.use(errorHandler)

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`)
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
