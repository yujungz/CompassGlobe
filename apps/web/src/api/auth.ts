import request from './request'

export interface LoginParams {
  account?: string
  phone?: string
  email?: string
  password?: string
  smsCode?: string
  emailCode?: string
  loginType: 'password' | 'sms' | 'email'
}

export interface RegisterParams {
  phone?: string
  email?: string
  wechat?: string
  password: string
  smsCode?: string
  emailCode?: string
}

export interface UserInfo {
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

export interface UserFullInfo {
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
  birthAddress: string | null
  company: string | null
  companyAddress: string | null
  industry: string | null
  profession: string | null
  realNameStatus: string
  idCard: string | null
  loginType: string
  registrationMethod: string
  imageCount: number
  consultCount: number
  status: number
  createdAt: string
}

export interface RealNameStatus {
  realName: string | null
  idCard: string | null
  realNameStatus: string
}

export interface WechatQrcode {
  ticket: string
  url: string
  expireSeconds: number
}

export interface WechatScanResult {
  status: 'pending' | 'scanned' | 'confirmed'
  message?: string
  token?: string
  user?: UserInfo
}

export interface ConsumptionInfo {
  imageCount: number
  consultCount: number
}

export const authApi = {
  login(data: LoginParams) {
    return request.post<{ token: string; user: UserInfo }>('/auth/login', data)
  },

  register(data: RegisterParams) {
    return request.post<{ token: string; user: UserInfo }>('/auth/register', data)
  },

  sendSmsCode(phone: string) {
    return request.post('/auth/sms-code', { phone })
  },

  sendEmailCode(email: string) {
    return request.post('/auth/email-code', { email })
  },

  getWechatQrcode() {
    return request.get<WechatQrcode>('/auth/wechat/qrcode')
  },

  checkWechatScan(ticket: string) {
    return request.get<WechatScanResult>(`/auth/wechat/check/${ticket}`)
  },

  getCurrentUser() {
    return request.get<UserFullInfo>('/auth/me')
  },

  logout() {
    return request.post('/auth/logout')
  },

  // 实名认证
  submitRealName(realName: string, idCard: string) {
    return request.post('/auth/real-name', { realName, idCard })
  },

  getRealNameStatus() {
    return request.get<RealNameStatus>('/auth/real-name/status')
  },
}
