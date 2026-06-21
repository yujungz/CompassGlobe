/**
 * 动态配置 — 优先数据库，回退 process.env
 *
 * 后台保存配置后按 key 部分刷新缓存，无需重启服务。
 * 使用方式:
 *   const val = await getConfig('AI_CHAT_URL', 'AI_CHAT_URL')
 *   // 第一个参数是 DB key 路径（如 "aiModel.AI_CHAT_URL"），第二个是 env fallback
 */

import prisma from './prisma.js'

// 缓存: { "aiModel": { AI_CHAT_URL: "https://..." }, "thirdParty": {...}, "ports": {...} }
let cache: Record<string, Record<string, string>> | null = null
let cacheLoaded = false

async function loadCache(): Promise<void> {
  if (cacheLoaded) return
  try {
    const rows = await prisma.config.findMany()
    cache = {}
    for (const row of rows) {
      cache![row.key] = row.value as Record<string, string>
    }
  } catch { cache = {} }
  cacheLoaded = true
}

/** 获取单个配置值: DB 优先，回退 env（过滤占位符） */
export async function getConfig(dbKey: string, envFallback: string): Promise<string> {
  await loadCache()
  const [section, field] = dbKey.split('.')
  // DB 值优先（过滤占位符）
  const dbVal = cache?.[section]?.[field]
  if (dbVal && !String(dbVal).startsWith('your-') && dbVal !== '') return dbVal
  // 回退 env（过滤占位符）
  const envVal = process.env[envFallback] || ''
  if (envVal.startsWith('your-')) return ''
  return envVal
}

/** 后台保存配置后调用，刷新对应 section 的缓存 */
export function refreshCacheSection(section: string, value: Record<string, any>): void {
  if (!cache) cache = {}
  cache[section] = value as Record<string, string>
}

/** 获取完整 section 配置 */
export async function getConfigSection(section: string): Promise<Record<string, string>> {
  await loadCache()
  return cache?.[section] || {}
}
