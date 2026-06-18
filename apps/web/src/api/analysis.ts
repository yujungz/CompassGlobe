import request from './request'
import type { WeatherInfo } from './globe'

// 分析记录（与后端 Analysis 模型对应）
export interface AnalysisRecord {
  id: string
  userId: string
  longitude: number
  latitude: number
  altitude: number
  address?: string | null
  weather?: Record<string, unknown> | null
  result?: { content?: string; model?: string; generatedAt?: string } | null
  images?: Record<string, unknown> | null
  createdAt: string
}

export interface AnalysisList {
  list: AnalysisRecord[]
  total: number
  page: number
  pageSize: number
}

export interface AnalyzeBody {
  longitude: number
  latitude: number
  altitude?: number | null
  address?: string
  weather?: WeatherInfo
  bagua?: string
}

export const analysisApi = {
  // AI 风水分析（生成 + 落库）；AI 耗时较长，单独放宽超时（后端上限 90s）
  analyze(body: AnalyzeBody) {
    return request.post<AnalysisRecord>('/analysis/analyze', body, { timeout: 120000 })
  },

  // 获取分析历史（分页）
  getList(page = 1, pageSize = 20) {
    return request.get<AnalysisList>('/analysis', { params: { page, pageSize } })
  },

  // 获取分析详情
  getById(id: string) {
    return request.get<AnalysisRecord>(`/analysis/${id}`)
  },

  // 删除分析记录
  remove(id: string) {
    return request.delete<{ message: string }>(`/analysis/${id}`)
  },
}
