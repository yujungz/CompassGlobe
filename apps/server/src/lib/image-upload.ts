import multer from 'multer'
import path from 'path'
import { AppError } from '../middlewares/error.js'

// 使用内存存储，后续可转存磁盘或直接传 AI
const storage = multer.memoryStorage()

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_FILES = 10

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new AppError('仅支持 PNG、JPEG、WebP 格式的图片', 400))
  }
}

/**
 * 居家风水图片上传中间件
 * 接受最多 10 张图片，每张最大 5MB
 */
export const fengshuiUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
}).array('images', MAX_FILES)

/**
 * 将 Buffer 转为 base64 data URL
 */
export function bufferToDataUrl(buffer: Buffer, mimetype: string): string {
  const b64 = buffer.toString('base64')
  return `data:${mimetype};base64,${b64}`
}

/**
 * 将上传文件保存到磁盘
 * @returns 保存后的相对路径数组
 */
export async function saveUploadedFiles(
  files: Express.Multer.File[],
  baseDir: string
): Promise<string[]> {
  const fs = await import('fs/promises')
  const paths: string[] = []

  for (const file of files) {
    const ext = path.extname(file.originalname) || '.png'
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    const fullPath = path.join(baseDir, filename)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, file.buffer)
    paths.push(fullPath)
  }

  return paths
}
