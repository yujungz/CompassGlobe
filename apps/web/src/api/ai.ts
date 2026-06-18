import request from './request'

export interface AiImageResult {
  image: string // data URL（base64）或 https URL
}

export const aiApi = {
  // 文生图（AI 生成较慢，单独放宽超时）
  generateImage(prompt: string, opts?: { size?: string; n?: number }) {
    return request.post<AiImageResult>('/ai/image', { prompt, ...opts }, { timeout: 620000 })
  },

  // 修图（image 为 data URL 或 base64 字符串）
  editImage(payload: { prompt: string; image: string; size?: string; mask?: string }) {
    return request.post<AiImageResult>('/ai/edit', payload, { timeout: 620000 })
  },
}
