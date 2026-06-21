import request from './request'

export interface BaZiInfo {
  yearPillar: string
  monthPillar: string
  dayPillar: string
  timePillar: string
}

export interface DaYunItem {
  index: number
  startAge: number
  startYear: number
  endYear: number
  stemBranch: string
}

export interface DaYunInfo {
  startYear: number
  startAge: number
  startDate: string
  forward: boolean
  currentDaYun: { index: number; startYear: number; endYear: number; stemBranch: string } | null
  daYunList: DaYunItem[]
}

export interface BaZiResult {
  baZi: BaZiInfo
  daYun: DaYunInfo
  zodiac: string
  constellation: string
  predictYear: number
  solarBirth: { year: number; month: number; day: number }
}

export interface FortunePredictBody {
  name: string
  gender: string
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number
  isLunar: boolean
  birthAddress?: string
  company?: string
  industry?: string
  profession?: string
  remark?: string
}

export interface FortuneResult {
  id: string
  baZi: BaZiInfo
  zodiac: string
  constellation: string
  predictYear: number
  result: { analysis: string }
  createdAt: string
}

export interface FortuneRecordItem {
  id: string
  name: string
  gender: string
  predictYear: number
  baZi: BaZiInfo | null
  zodiac: string | null
  result: { analysis: string } | null
  createdAt: string
}

export const fortuneApi = {
  calculateBaZi(data: {
    birthYear: number
    birthMonth: number
    birthDay: number
    birthHour: number
    isLunar: boolean
    gender: string
  }) {
    return request.post<BaZiResult>('/fortune/calculate-bazi', data)
  },

  predict(data: FortunePredictBody) {
    return request.post<FortuneResult>('/fortune/predict', data, { timeout: 180000 })
  },

  getList(page = 1, pageSize = 10) {
    return request.get<{ list: FortuneRecordItem[]; total: number }>('/fortune', { params: { page, pageSize } })
  },

  getDetail(id: string) {
    return request.get<FortuneRecordItem>(`/fortune/${id}`)
  },

  getPdfUrl(id: string) {
    return `/api/fortune/${id}/pdf`
  },

  delete(id: string) {
    return request.delete(`/fortune/${id}`)
  },
}
