/**
 * 对象存储抽象层
 *
 * 优先使用 MinIO，如果 minio 包不可用则回退到本地文件系统。
 * 通过 Docker named volume 持久化文件。
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, '../../storage')

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function getMimeType(key: string): string {
  const mimeMap: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
    '.html': 'text/html', '.json': 'application/json',
  }
  return mimeMap[path.extname(key).toLowerCase()] || 'application/octet-stream'
}

// ---- MinIO 客户端（延迟导入，不阻塞服务启动） ----
let minioClient: any = null
let minioReady = false

async function getMinio() {
  if (minioClient) return minioClient
  try {
    // dynamic import to avoid build-time dependency on minio
    const minioMod = await eval('import("minio")') as any
    const { Client } = minioMod
    minioClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT || 'minio',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      useSSL: process.env.MINIO_USE_SSL === 'true',
    })
    const bucket = process.env.MINIO_BUCKET || 'compass'
    const exists = await minioClient.bucketExists(bucket)
    if (!exists) await minioClient.makeBucket(bucket)
    console.log('MinIO connected, bucket ready')
    minioReady = true
    return minioClient
  } catch (e: any) {
    console.warn('MinIO unavailable, using local storage:', e.message)
    return null
  }
}

function useLocal(): boolean {
  return !minioReady
}

/** 上传 */
export async function putObject(key: string, buffer: Buffer, mimeType: string): Promise<string> {
  const c = await getMinio()
  if (c) {
    const bucket = process.env.MINIO_BUCKET || 'compass'
    await c.putObject(bucket, key, buffer, buffer.length, { 'Content-Type': mimeType })
    return key
  }
  const filePath = path.join(STORAGE_ROOT, key)
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, buffer)
  return key
}

/** 对外访问 URL */
export function getObjectUrl(key: string): string {
  return useLocal()
    ? `/api/storage/${encodeURIComponent(key)}`
    : `/api/storage/${encodeURIComponent(key)}`
}

/** 获取文件 */
export async function getObject(key: string): Promise<{ buffer: Buffer; mimeType: string }> {
  // 优先从 MinIO 读取，失败则回退到本地文件系统
  const c = await getMinio()
  if (c) {
    try {
      const bucket = process.env.MINIO_BUCKET || 'compass'
      const stream = await c.getObject(bucket, key)
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk)
      const buffer = Buffer.concat(chunks)
      let mimeType = 'application/octet-stream'
      try { const stat = await c.statObject(bucket, key); mimeType = stat.metaData?.['content-type'] || mimeType } catch {}
      return { buffer, mimeType }
    } catch (e: any) {
      console.warn(`MinIO object not found, falling back to local storage: ${key} (${e.message})`)
      // fall through to local fallback
    }
  }
  const filePath = path.join(STORAGE_ROOT, key)
  if (!fs.existsSync(filePath)) throw new Error(`Object not found: ${key}`)
  return { buffer: fs.readFileSync(filePath), mimeType: getMimeType(key) }
}

/** 列出对象 */
export async function listObjects(prefix: string): Promise<string[]> {
  const c = await getMinio()
  if (c) {
    const bucket = process.env.MINIO_BUCKET || 'compass'
    const keys: string[] = []
    const stream = c.listObjects(bucket, prefix, true)
    for await (const obj of stream) { if (obj.name) keys.push(obj.name) }
    return keys
  }
  const dir = path.join(STORAGE_ROOT, prefix)
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else results.push(path.relative(STORAGE_ROOT, full).replace(/\\/g, '/'))
    }
  }
  walk(dir)
  return results
}

/** 删除单个 */
export async function removeObject(key: string): Promise<void> {
  const c = await getMinio()
  if (c) { await c.removeObject(process.env.MINIO_BUCKET || 'compass', key); return }
  const filePath = path.join(STORAGE_ROOT, key)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

/** 批量删除 */
export async function removeObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const c = await getMinio()
  if (c) { await c.removeObjects(process.env.MINIO_BUCKET || 'compass', keys); return }
  for (const k of keys) await removeObject(k)
}

/** 是否就绪 */
export async function isStorageReady(): Promise<boolean> {
  try { await (await getMinio()) ? true : (ensureDir(STORAGE_ROOT), true); return true }
  catch { return false }
}
