// ============ 用户相关类型 ============

/** 用户完整信息（不含密码） */
export interface UserFull {
  id: string
  username: string
  phone: string | null
  email: string | null
  realName: string | null
  nickname: string | null
  gender: string | null
  birthYear: number | null
  birthMonth: number | null
  birthDay: number | null
  birthHour: number | null
  avatar: string | null
  wechat: string | null
  qq: string | null
  wechatOpenId: string | null
  wechatUnionId: string | null
  birthAddress: string | null
  company: string | null
  companyAddress: string | null
  industry: string | null
  profession: string | null
  remark: string | null
  realNameStatus: string
  idCard: string | null
  loginType: string
  registrationMethod: string
  imageCount: number
  consultCount: number
  status: number
  createdAt: Date
  updatedAt: Date
}

/** 简化用户信息 */
export interface UserBrief {
  id: string
  username: string
  phone: string | null
  email: string | null
  nickname: string | null
  avatar: string | null
  realNameStatus: string
}

/** 登录用户 */
export interface User {
  id: string
  username: string
  phone: string | null
  email: string | null
  nickname: string
  avatar: string | null
  loginType: string
  registrationMethod: string
  imageCount: number
  consultCount: number
}

// ============ 位置信息 ============

export interface Location {
  longitude: number
  latitude: number
  altitude: number
}

// ============ 分析记录 ============

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

export interface WeatherInfo {
  temperature: number
  humidity: number
  windSpeed: number
  windDirection: string
  weather: string
}

export interface AnalysisResult {
  summary: string
  details: string
  recommendations: string[]
  score: number
}

// ============ 居家风水 ============

export interface FengshuiHomeRecord {
  id: string
  userId: string
  images: string[]
  descriptions: string[]
  result: Record<string, any> | null
  createdAt: Date
}

// ============ 流年大运 ============

export interface FortuneRecord {
  id: string
  userId: string
  name: string
  gender: string
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number
  isLunar: boolean
  birthAddress: string | null
  company: string | null
  industry: string | null
  profession: string | null
  remark: string | null
  baZi: BaZiInfo | null
  zodiac: string | null
  constellation: string | null
  predictYear: number
  result: Record<string, any> | null
  createdAt: Date
}

export interface BaZiInfo {
  yearPillar: string
  monthPillar: string
  dayPillar: string
  timePillar: string
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

export interface BaZiResult {
  baZi: BaZiInfo
  zodiac: string
  constellation: string
  predictYear: number
}

// ============ 八卦问事 ============

export interface DivinationRecord {
  id: string
  userId: string
  name: string
  gender: string
  question: string
  hexagram: HexagramResult
  result: Record<string, any> | null
  createdAt: Date
}

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

export interface DivinationAskBody {
  name: string
  gender: string
  question: string
  hexagram: HexagramResult
}

// ============ AI 对话 ============

export interface ConversationRecord {
  id: string
  userId: string
  title: string | null
  createdAt: Date
  updatedAt: Date
  messages?: MessageRecord[]
}

export interface MessageRecord {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

// ============ API 通用类型 ============

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// ============ 消费信息 ============

export interface ConsumptionInfo {
  imageCount: number
  consultCount: number
}
