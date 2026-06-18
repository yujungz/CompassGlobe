import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { Response } from 'express'

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'admin-secret-key'
const ADMIN_JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '7d'

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10)
}

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

export const generateAdminToken = (adminId: string, role: string): string => {
  return jwt.sign({ adminId, role, type: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: ADMIN_JWT_EXPIRES_IN })
}

export const verifyAdminToken = (token: string): { adminId: string; role: string; type: string } | null => {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET) as { adminId: string; role: string; type: string }
  } catch {
    return null
  }
}
