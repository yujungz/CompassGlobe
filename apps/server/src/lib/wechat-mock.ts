import { v4 as uuidv4 } from 'uuid'

interface WechatScanState {
  ticket: string
  status: 'pending' | 'scanned' | 'confirmed'
  userId?: string
  nickname?: string
  avatar?: string
  createdAt: number
}

// 扫码状态缓存（生产环境应使用 Redis）
const scanCache = new Map<string, WechatScanState>()

// 生成模拟二维码 ticket
export const generateQrcode = (): { ticket: string; url: string; expireSeconds: number } => {
  const ticket = uuidv4()
  const url = `https://mock.weixin.qq.com/qr/${ticket}`

  scanCache.set(ticket, {
    ticket,
    status: 'pending',
    createdAt: Date.now(),
  })

  // 30秒后自动模拟「已确认」
  setTimeout(() => {
    const state = scanCache.get(ticket)
    if (state && state.status === 'pending') {
      // 先模拟「已扫码」
      state.status = 'scanned'
      state.nickname = '微信用户'
      state.avatar = ''

      // 再过3秒模拟「已确认」
      setTimeout(() => {
        state.status = 'confirmed'
        state.userId = `wechat_${ticket.slice(0, 8)}`
      }, 3000)
    }
  }, 10000) // 10秒后开始模拟

  return { ticket, url, expireSeconds: 120 }
}

// 检查扫码状态
export const checkScanStatus = (ticket: string): WechatScanState | null => {
  const state = scanCache.get(ticket)
  if (!state) return null

  // 过期清理（2分钟）
  if (Date.now() - state.createdAt > 120 * 1000) {
    scanCache.delete(ticket)
    return null
  }

  return state
}

// 确认登录后清理
export const confirmScan = (ticket: string): void => {
  scanCache.delete(ticket)
}
