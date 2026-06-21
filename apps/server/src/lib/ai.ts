// AI 大模型默认配置（OpenAI 兼容接口）
// 三项能力：文本对话、文生图、修图。配置经环境变量 AI_* 注入，
// 默认值已在 csp.burncloud.com 代理（gpt-5.2 / gpt-image-2-pro）上验证可用。

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatContentPart[]
}

export interface ChatContentPart {
  type: 'text' | 'image'
  text?: string
  image?: { data: string; media_type: string }
}

export interface GeneratedImage {
  b64?: string
  url?: string
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[]
}
interface ImageResponse {
  data?: { b64_json?: string; url?: string }[]
}

import { getConfig } from './config.js'

// 动态读取配置：DB 优先，回退 env
const aiUrl = () => getConfig('aiModel.AI_CHAT_URL', 'AI_CHAT_URL')
const aiKey = () => getConfig('aiModel.AI_CHAT_KEY', 'AI_CHAT_KEY')
const aiModel = () => getConfig('aiModel.AI_CHAT_MODEL', 'AI_CHAT_MODEL')
const imgUrl = () => getConfig('aiModel.AI_IMAGE_URL', 'AI_IMAGE_URL')
const imgEditUrl = () => getConfig('aiModel.AI_IMAGE_EDIT_URL', 'AI_IMAGE_EDIT_URL')
const imgKey = () => getConfig('aiModel.AI_IMAGE_KEY', 'AI_IMAGE_KEY')
const imgModel = () => getConfig('aiModel.AI_IMAGE_MODEL', 'AI_IMAGE_MODEL')

// 兼容旧代码的 sync 导出（模块加载时 snapshot env，异步 API 会优先 DB）
export const aiConfig = {
  chat: {
    url: process.env.AI_CHAT_URL || '',
    key: process.env.AI_CHAT_KEY || '',
    model: process.env.AI_CHAT_MODEL || '',
    system: process.env.AI_CHAT_SYSTEM || '你是一个有帮助的助手。',
  },
  image: {
    url: process.env.AI_IMAGE_URL || '',
    editUrl: process.env.AI_IMAGE_EDIT_URL || '',
    key: process.env.AI_IMAGE_KEY || '',
    model: process.env.AI_IMAGE_MODEL || '',
  },
}

export async function isAiChatConfigured(): Promise<boolean> {
  const u = await aiUrl(); const k = await aiKey(); const m = await aiModel()
  return !!(u && k && m)
}

export async function isAiImageConfigured(): Promise<boolean> {
  const u = await imgUrl(); const eu = await imgEditUrl(); const k = await imgKey(); const m = await imgModel()
  return !!(u && eu && k && m)
}

// 带超时的 fetch，避免长时间挂起
const fetchWithTimeout = (url: string, init: RequestInit, ms: number) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

// 文本对话
export const chatCompletion = async (
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number; timeoutMs?: number }
): Promise<string> => {
  const [url, key, model] = await Promise.all([aiUrl(), aiKey(), aiModel()])
  const body: Record<string, unknown> = { model: options?.model || model, messages }
  if (options?.temperature != null) body.temperature = options.temperature

  const resp = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    options?.timeoutMs ?? 60000
  )
  const data = (await resp.json()) as ChatResponse
  const content = data.choices?.[0]?.message?.content
  if (!resp.ok || !content) {
    const detail = (data as any).error?.message || JSON.stringify(data).slice(0, 300)
    throw new Error(`AI 对话失败: HTTP ${resp.status} — ${detail}`)
  }
  return content
}

// 文生图
export const generateImage = async (
  prompt: string,
  options?: { model?: string; size?: string; n?: number; timeoutMs?: number }
): Promise<GeneratedImage> => {
  const [url, key, model] = await Promise.all([imgUrl(), imgKey(), imgModel()])
  const resp = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options?.model || model,
        prompt,
        n: options?.n ?? 1,
        size: options?.size || '1024x1024',
      }),
    },
    options?.timeoutMs ?? 600000
  )
  const data = (await resp.json()) as ImageResponse
  const item = data.data?.[0]
  if (!resp.ok || !item) {
    throw new Error(`AI 文生图失败: HTTP ${resp.status}`)
  }
  return { b64: item.b64_json, url: item.url }
}

// 修图（multipart，image 为 PNG Buffer；可选 mask 限定编辑区域）
export const editImage = async (
  image: Buffer,
  prompt: string,
  options?: { model?: string; size?: string; mask?: Buffer; timeoutMs?: number }
): Promise<GeneratedImage> => {
  const [editUrl, key, model] = await Promise.all([imgEditUrl(), imgKey(), imgModel()])
  const form = new FormData()
  form.append('model', options?.model || model)
  form.append('prompt', prompt)
  form.append('n', '1')
  form.append('size', options?.size || '1024x1024')
  form.append('image', new Blob([image], { type: 'image/png' }), 'input.png')
  if (options?.mask) {
    form.append('mask', new Blob([options.mask], { type: 'image/png' }), 'mask.png')
  }

  const resp = await fetchWithTimeout(
    editUrl,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    },
    options?.timeoutMs ?? 600000
  )
  const data = (await resp.json()) as ImageResponse
  const item = data.data?.[0]
  if (!resp.ok || !item) {
    throw new Error(`AI 修图失败: HTTP ${resp.status}`)
  }
  return { b64: item.b64_json, url: item.url }
}

export default aiConfig
