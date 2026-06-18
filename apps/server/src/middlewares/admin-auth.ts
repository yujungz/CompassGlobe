import type { Request, Response, NextFunction } from 'express'
import { verifyAdminToken } from '../lib/admin-auth.js'

export interface AdminAuthRequest extends Request {
  adminId?: string
  adminRole?: string
}

export const adminAuthMiddleware = (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权访问' })
  }

  const token = authHeader.split(' ')[1]
  const decoded = verifyAdminToken(token)

  if (!decoded || decoded.type !== 'admin') {
    return res.status(401).json({ error: 'Token 无效或已过期' })
  }

  req.adminId = decoded.adminId
  req.adminRole = decoded.role
  next()
}

export const superAdminOnly = (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  if (req.adminRole !== 'super') {
    return res.status(403).json({ error: '仅超级管理员可执行此操作' })
  }
  next()
}
