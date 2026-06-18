// 用户相关类型
export interface User {
  id: string
  phone: string
  nickname: string | null
  avatar: string | null
  createdAt: Date
  updatedAt: Date
}

// 位置信息
export interface Location {
  longitude: number
  latitude: number
  altitude: number
}

// 分析记录
export interface Analysis {
  id: string
  userId: string
  longitude: number
  latitude: number
  altitude: number
  address: string | null
  weather: WeatherInfo | null
  result: AnalysisResult | null
  images: string[] | null
  createdAt: Date
}

// 天气信息
export interface WeatherInfo {
  temperature: number
  humidity: number
  windSpeed: number
  windDirection: string
  weather: string
}

// 分析结果
export interface AnalysisResult {
  summary: string
  details: string
  recommendations: string[]
  score: number
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 分页参数
export interface PaginationParams {
  page: number
  pageSize: number
}

// 分页响应
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
