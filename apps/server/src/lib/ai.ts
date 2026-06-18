// AI 大模型默认配置（OpenAI 兼容接口）
// 三项能力：文本对话、文生图、修图。配置经环境变量 AI_* 注入，
// 默认值已在 csp.burncloud.com 代理（gpt-5.2 / gpt-image-2-pro）上验证可用。

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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

// 从环境变量读取配置（模块加载时快照，与 lib/email.ts 风格一致）
export const aiConfig = {
  chat: {
    url: process.env.AI_CHAT_URL || '',
    key: process.env.AI_CHAT_KEY || '',
    model: process.env.AI_CHAT_MODEL || '',
    system: process.env.AI_CHAT_SYSTEM || '你是一个有帮助的助手。',
  },
  image: {
    url: process.env.AI_IMAGE_URL || '', // 文生图 generations
    editUrl: process.env.AI_IMAGE_EDIT_URL || '', // 修图 edits
    key: process.env.AI_IMAGE_KEY || '',
    model: process.env.AI_IMAGE_MODEL || '',
  },
}

export const isAiChatConfigured = () => !!(aiConfig.chat.url && aiConfig.chat.key && aiConfig.chat.model)
export const isAiImageConfigured = () =>
  !!(aiConfig.image.url && aiConfig.image.editUrl && aiConfig.image.key && aiConfig.image.model)

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
  const body: Record<string, unknown> = { model: options?.model || aiConfig.chat.model, messages }
  if (options?.temperature != null) body.temperature = options.temperature

  const resp = await fetchWithTimeout(
    aiConfig.chat.url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${aiConfig.chat.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    options?.timeoutMs ?? 60000
  )
  const data = (await resp.json()) as ChatResponse
  const content = data.choices?.[0]?.message?.content
  if (!resp.ok || !content) {
    throw new Error(`AI 对话失败: HTTP ${resp.status}`)
  }
  return content
}

// 文生图
export const generateImage = async (
  prompt: string,
  options?: { model?: string; size?: string; n?: number; timeoutMs?: number }
): Promise<GeneratedImage> => {
  const resp = await fetchWithTimeout(
    aiConfig.image.url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${aiConfig.image.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options?.model || aiConfig.image.model,
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
  const form = new FormData()
  form.append('model', options?.model || aiConfig.image.model)
  form.append('prompt', prompt)
  form.append('n', '1')
  form.append('size', options?.size || '1024x1024')
  form.append('image', new Blob([image], { type: 'image/png' }), 'input.png')
  if (options?.mask) {
    form.append('mask', new Blob([options.mask], { type: 'image/png' }), 'mask.png')
  }

  const resp = await fetchWithTimeout(
    aiConfig.image.editUrl,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${aiConfig.image.key}` },
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
