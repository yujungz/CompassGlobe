<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authApi } from '@/api/auth'
import { useAuth } from '@/composables'

const router = useRouter()
const route = useRoute()
const { login } = useAuth()

type LoginTab = 'password' | 'sms' | 'email'
const activeTab = ref<LoginTab>('password')
const loading = ref(false)

// 密码登录
const passwordForm = ref({
  account: '',
  password: '',
})

// 手机验证码登录
const smsForm = ref({
  phone: '',
  smsCode: '',
})
const smsCountdown = ref(0)
let smsTimer: ReturnType<typeof setInterval> | null = null

// 邮箱验证码登录
const emailForm = ref({
  email: '',
  emailCode: '',
})
const emailCountdown = ref(0)
let emailTimer: ReturnType<typeof setInterval> | null = null

// 微信扫码
const showWechatModal = ref(false)
const wechatQrUrl = ref('')
const wechatTicket = ref('')
const wechatStatus = ref<'pending' | 'scanned' | 'confirmed'>('pending')
let wechatPollTimer: ReturnType<typeof setInterval> | null = null

const accountType = computed(() => {
  const val = passwordForm.value.account.trim()
  if (/^1[3-9]\d{9}$/.test(val)) return 'phone'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'email'
  return 'unknown'
})

// ============ 登录逻辑 ============

const handlePasswordLogin = async () => {
  if (!passwordForm.value.account) {
    alert('请输入手机号或邮箱')
    return
  }
  if (!passwordForm.value.password) {
    alert('请输入密码')
    return
  }
  if (accountType.value === 'unknown') {
    alert('请输入正确的手机号或邮箱地址')
    return
  }

  loading.value = true
  try {
    const data: any = {
      loginType: 'password',
      password: passwordForm.value.password,
    }
    if (accountType.value === 'phone') {
      data.phone = passwordForm.value.account
    } else {
      data.email = passwordForm.value.account
    }

    const res = await authApi.login(data)
    handleLoginSuccess(res)
  } catch (error: any) {
    alert(error.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}

const handleSmsLogin = async () => {
  if (!smsForm.value.phone || !/^1[3-9]\d{9}$/.test(smsForm.value.phone)) {
    alert('请输入正确的手机号')
    return
  }
  if (!smsForm.value.smsCode) {
    alert('请输入验证码')
    return
  }

  loading.value = true
  try {
    const res = await authApi.login({
      phone: smsForm.value.phone,
      smsCode: smsForm.value.smsCode,
      loginType: 'sms',
    })
    handleLoginSuccess(res)
  } catch (error: any) {
    alert(error.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}

const handleEmailLogin = async () => {
  if (!emailForm.value.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.value.email)) {
    alert('请输入正确的邮箱地址')
    return
  }
  if (!emailForm.value.emailCode) {
    alert('请输入验证码')
    return
  }

  loading.value = true
  try {
    const res = await authApi.login({
      email: emailForm.value.email,
      emailCode: emailForm.value.emailCode,
      loginType: 'email',
    })
    handleLoginSuccess(res)
  } catch (error: any) {
    alert(error.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}

const handleLogin = () => {
  if (activeTab.value === 'password') handlePasswordLogin()
  else if (activeTab.value === 'sms') handleSmsLogin()
  else handleEmailLogin()
}

const handleLoginSuccess = (res: any) => {
  login(res.token, res.user)
  const redirect = route.query.redirect as string
  router.push(redirect || '/')
}

// ============ 发送验证码 ============

const handleSendSms = async () => {
  if (!smsForm.value.phone || !/^1[3-9]\d{9}$/.test(smsForm.value.phone)) {
    alert('请输入正确的手机号')
    return
  }
  try {
    await authApi.sendSmsCode(smsForm.value.phone)
    startCountdown('sms')
  } catch {
    alert('发送失败，请稍后重试')
  }
}

const handleSendEmail = async () => {
  if (!emailForm.value.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.value.email)) {
    alert('请输入正确的邮箱地址')
    return
  }
  try {
    await authApi.sendEmailCode(emailForm.value.email)
    startCountdown('email')
  } catch {
    alert('发送失败，请稍后重试')
  }
}

const startCountdown = (type: 'sms' | 'email') => {
  const countdownRef = type === 'sms' ? smsCountdown : emailCountdown
  countdownRef.value = 60
  const timer = setInterval(() => {
    countdownRef.value--
    if (countdownRef.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
  if (type === 'sms') smsTimer = timer
  else emailTimer = timer
}

// ============ 微信扫码 ============

const openWechatLogin = async () => {
  try {
    const res = await authApi.getWechatQrcode()
    wechatTicket.value = res.ticket
    wechatQrUrl.value = res.url
    wechatStatus.value = 'pending'
    showWechatModal.value = true
    startWechatPoll()
  } catch {
    alert('获取二维码失败')
  }
}

const startWechatPoll = () => {
  stopWechatPoll()
  wechatPollTimer = setInterval(async () => {
    try {
      const res = await authApi.checkWechatScan(wechatTicket.value)
      wechatStatus.value = res.status
      if (res.status === 'confirmed' && res.token && res.user) {
        stopWechatPoll()
        login(res.token, res.user)
        showWechatModal.value = false
        const redirect = route.query.redirect as string
        router.push(redirect || '/')
      }
    } catch {
      stopWechatPoll()
      wechatStatus.value = 'pending'
    }
  }, 2000)
}

const stopWechatPoll = () => {
  if (wechatPollTimer) {
    clearInterval(wechatPollTimer)
    wechatPollTimer = null
  }
}

// 组件卸载时清理所有定时器，避免内存泄漏
onUnmounted(() => {
  if (smsTimer) clearInterval(smsTimer)
  if (emailTimer) clearInterval(emailTimer)
  stopWechatPoll()
})

const closeWechatModal = () => {
  stopWechatPoll()
  showWechatModal.value = false
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="title">登录</h1>

      <!-- 登录方式 Tab -->
      <div class="login-tabs">
        <button
          :class="['tab', { active: activeTab === 'password' }]"
          @click="activeTab = 'password'"
        >
          账号密码
        </button>
        <button
          :class="['tab', { active: activeTab === 'sms' }]"
          @click="activeTab = 'sms'"
        >
          手机验证码
        </button>
        <button
          :class="['tab', { active: activeTab === 'email' }]"
          @click="activeTab = 'email'"
        >
          邮箱验证码
        </button>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <!-- 账号密码登录 -->
        <template v-if="activeTab === 'password'">
          <div class="form-item">
            <input
              v-model="passwordForm.account"
              type="text"
              placeholder="手机号 / 邮箱"
              class="input"
            />
          </div>
          <div class="form-item">
            <input
              v-model="passwordForm.password"
              type="password"
              placeholder="密码"
              class="input"
            />
          </div>
        </template>

        <!-- 手机验证码登录 -->
        <template v-if="activeTab === 'sms'">
          <div class="form-item">
            <input
              v-model="smsForm.phone"
              type="tel"
              placeholder="手机号"
              maxlength="11"
              class="input"
            />
          </div>
          <div class="form-item sms-item">
            <input
              v-model="smsForm.smsCode"
              type="text"
              placeholder="验证码"
              maxlength="6"
              class="input"
            />
            <button
              type="button"
              class="code-btn"
              :disabled="smsCountdown > 0"
              @click="handleSendSms"
            >
              {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
            </button>
          </div>
        </template>

        <!-- 邮箱验证码登录 -->
        <template v-if="activeTab === 'email'">
          <div class="form-item">
            <input
              v-model="emailForm.email"
              type="email"
              placeholder="邮箱地址"
              class="input"
            />
          </div>
          <div class="form-item sms-item">
            <input
              v-model="emailForm.emailCode"
              type="text"
              placeholder="验证码"
              maxlength="6"
              class="input"
            />
            <button
              type="button"
              class="code-btn"
              :disabled="emailCountdown > 0"
              @click="handleSendEmail"
            >
              {{ emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码' }}
            </button>
          </div>
        </template>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <!-- 其他登录方式 -->
      <div class="divider">
        <span>其他登录方式</span>
      </div>

      <div class="social-login">
        <button class="wechat-btn" @click="openWechatLogin">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#07c160">
            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.373 6.373 0 0 1-.248-1.753c0-3.694 3.452-6.692 7.706-6.692.253 0 .502.014.749.034C17.311 4.706 13.34 2.188 8.691 2.188zm-2.5 5.5c-.544 0-.984-.44-.984-.983a.983.983 0 1 1 1.967 0c0 .544-.44.983-.983.983zm5.5 0c-.543 0-.983-.44-.983-.983a.983.983 0 1 1 1.967 0c0 .544-.44.983-.984.983zm5.367 3.908c-3.652 0-6.615 2.472-6.615 5.517S13.706 22.63 17.058 22.63c.8 0 1.567-.118 2.283-.329a.722.722 0 0 1 .577.078l1.532.897a.262.262 0 0 0 .134.043.237.237 0 0 0 .233-.237c0-.058-.023-.115-.039-.171l-.314-1.19a.475.475 0 0 1 .171-.535C23.233 19.902 24 18.197 24 16.313c0-3.045-2.963-5.517-6.615-5.517h-.327zm-2.62 3.376a.82.82 0 1 1 0 1.64.82.82 0 0 1 0-1.64zm5.24 0a.82.82 0 1 1 0 1.64.82.82 0 0 1 0-1.64z"/>
          </svg>
          <span>微信登录</span>
        </button>
      </div>

      <div class="footer-links">
        <router-link to="/register" class="link">没有账号？去注册</router-link>
      </div>
    </div>

    <!-- 微信扫码弹窗 -->
    <div v-if="showWechatModal" class="modal-overlay" @click.self="closeWechatModal">
      <div class="wechat-modal">
        <button class="modal-close" @click="closeWechatModal">&times;</button>
        <h3 class="modal-title">微信扫码登录</h3>

        <div class="qr-wrapper">
          <div class="qr-placeholder">
            <div class="qr-mock">
              <svg viewBox="0 0 100 100" width="160" height="160">
                <rect width="100" height="100" fill="#fff" stroke="#e0e0e0" stroke-width="1"/>
                <!-- 模拟二维码图案 -->
                <rect x="10" y="10" width="25" height="25" fill="#333"/>
                <rect x="65" y="10" width="25" height="25" fill="#333"/>
                <rect x="10" y="65" width="25" height="25" fill="#333"/>
                <rect x="15" y="15" width="15" height="15" fill="#fff"/>
                <rect x="70" y="15" width="15" height="15" fill="#fff"/>
                <rect x="15" y="70" width="15" height="15" fill="#fff"/>
                <rect x="19" y="19" width="7" height="7" fill="#333"/>
                <rect x="74" y="19" width="7" height="7" fill="#333"/>
                <rect x="19" y="74" width="7" height="7" fill="#333"/>
                <rect x="40" y="10" width="5" height="5" fill="#333"/>
                <rect x="48" y="10" width="5" height="5" fill="#333"/>
                <rect x="40" y="18" width="5" height="5" fill="#333"/>
                <rect x="48" y="25" width="5" height="5" fill="#333"/>
                <rect x="40" y="40" width="20" height="20" fill="#07c160" rx="2"/>
                <text x="50" y="54" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">W</text>
              </svg>
            </div>
          </div>
        </div>

        <div class="scan-status">
          <template v-if="wechatStatus === 'pending'">
            <p class="status-text">请使用微信扫描二维码登录</p>
            <p class="status-hint">打开微信 → 扫一扫</p>
          </template>
          <template v-else-if="wechatStatus === 'scanned'">
            <p class="status-text scanning">扫描成功</p>
            <p class="status-hint">请在手机上确认登录</p>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 40px 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  text-align: center;
  margin-bottom: 32px;
}

.login-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 4px;

  .tab {
    flex: 1;
    padding: 10px 4px;
    border: none;
    background: transparent;
    border-radius: 6px;
    font-size: 13px;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &.active {
      background: #fff;
      color: #1a1a2e;
      font-weight: 500;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  }
}

.login-form {
  .form-item {
    margin-bottom: 16px;
  }

  .input {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 15px;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: #4a90d9;
    }
  }

  .sms-item {
    display: flex;
    gap: 12px;

    .input {
      flex: 1;
    }

    .code-btn {
      padding: 0 16px;
      background: #4a90d9;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
      min-width: 100px;

      &:hover:not(:disabled) {
        background: #357abd;
      }

      &:disabled {
        background: #a0c4e8;
        cursor: not-allowed;
      }
    }
  }
}

.submit-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.divider {
  display: flex;
  align-items: center;
  margin: 24px 0 16px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e0e0e0;
  }

  span {
    padding: 0 16px;
    color: #999;
    font-size: 12px;
    white-space: nowrap;
  }
}

.social-login {
  display: flex;
  justify-content: center;
  gap: 24px;

  .wechat-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 8px;
    transition: background 0.2s;

    &:hover {
      background: #f5f5f5;
    }

    span {
      font-size: 12px;
      color: #666;
    }
  }
}

.footer-links {
  margin-top: 24px;
  text-align: center;

  .link {
    color: #4a90d9;
    text-decoration: none;
    font-size: 14px;

    &:hover {
      text-decoration: underline;
    }
  }
}

// 微信扫码弹窗
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.wechat-modal {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  width: 340px;
  text-align: center;
  position: relative;

  .modal-close {
    position: absolute;
    right: 16px;
    top: 12px;
    background: none;
    border: none;
    font-size: 24px;
    color: #999;
    cursor: pointer;

    &:hover {
      color: #333;
    }
  }

  .modal-title {
    font-size: 18px;
    font-weight: 600;
    color: #333;
    margin-bottom: 24px;
  }

  .qr-wrapper {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;

    .qr-placeholder {
      width: 200px;
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px dashed #e0e0e0;
      border-radius: 8px;
    }
  }

  .scan-status {
    .status-text {
      font-size: 15px;
      color: #333;
      font-weight: 500;

      &.scanning {
        color: #07c160;
      }
    }

    .status-hint {
      font-size: 13px;
      color: #999;
      margin-top: 4px;
    }
  }
}
</style>
