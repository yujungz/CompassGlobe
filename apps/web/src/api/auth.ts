import request from './request'

export interface LoginParams {
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
  password: string
  smsCode?: string
  emailCode?: string
}

export interface UserInfo {
  id: string
  phone: string | null
  email: string | null
  nickname: string
  avatar: string | null
  loginType: string
  createdAt: string
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

export const authApi = {
  // 登录（支持密码、短信验证码、邮箱验证码）
  login(data: LoginParams) {
    return request.post<{ token: string; user: UserInfo }>('/auth/login', data)
  },

  // 注册（支持手机号、邮箱）
  register(data: RegisterParams) {
    return request.post<{ token: string; user: UserInfo }>('/auth/register', data)
  },

  // 发送短信验证码
  sendSmsCode(phone: string) {
    return request.post('/auth/sms-code', { phone })
  },

  // 发送邮箱验证码
  sendEmailCode(email: string) {
    return request.post('/auth/email-code', { email })
  },

  // 获取微信扫码二维码
  getWechatQrcode() {
    return request.get<WechatQrcode>('/auth/wechat/qrcode')
  },

  // 检查微信扫码状态
  checkWechatScan(ticket: string) {
    return request.get<WechatScanResult>(`/auth/wechat/check/${ticket}`)
  },

  // 获取当前用户信息
  getCurrentUser() {
    return request.get<UserInfo>('/auth/me')
  },

  // 退出登录
  logout() {
    return request.post('/auth/logout')
  },
}
