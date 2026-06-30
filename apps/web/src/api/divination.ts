import request from './request'

export interface HexagramResult {
  originalHexagram: number
  originalName: string
  originalSymbol: string
  originalGuaCi: string
  changedHexagram: number | null
  changedName: string | null
  changedSymbol: string | null
  changingLines: number[]
  yaoCi: string[]
}

export interface DivinationAskResult {
  id: string
  hexagram: HexagramResult
  result: { analysis: string }
  createdAt: string
}

export interface DivinationRecordItem {
  id: string
  name: string
  question: string
  hexagram: HexagramResult
  result: { analysis: string } | null
  createdAt: string
}

export const divinationApi = {
  generateHexagram(data?: { name?: string; gender?: string; question?: string }) {
    return request.post<HexagramResult & { recordId?: string }>('/divination/generate-hexagram', data || {})
  },

  ask(data: { name: string; gender: string; question: string; hexagram: HexagramResult; recordId?: string }) {
    return request.post<DivinationAskResult>('/divination/ask', data, { timeout: 180000 })
  },

  getList(page = 1, pageSize = 10) {
    return request.get<{ list: DivinationRecordItem[]; total: number }>('/divination', { params: { page, pageSize } })
  },

  getDetail(id: string) {
    return request.get<DivinationRecordItem>(`/divination/${id}`)
  },

  getPdfUrl(id: string) {
    return `/api/divination/${id}/pdf`
  },

  delete(id: string) {
    return request.delete(`/divination/${id}`)
  },
}
