import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { errorHandler, notFoundHandler } from './middlewares/error.js'
import authRoutes from './modules/auth/routes.js'
import globeRoutes from './modules/globe/routes.js'
import analysisRoutes from './modules/analysis/routes.js'
import userRoutes from './modules/user/routes.js'
import adminRoutes from './modules/admin/routes.js'
import aiRoutes from './modules/ai/routes.js'

const app = express()
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

// 错误处理
app.use(notFoundHandler)
app.use(errorHandler)

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`)
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
