<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { useAuth } from '@/composables'

const router = useRouter()
const { login } = useAuth()

const activeTab = ref<'email'>('email')
const loading = ref(false)

// 邮箱注册
const emailForm = ref({
  email: '',
  emailCode: '',
  password: '',
  confirmPassword: '',
})
const emailCountdown = ref(0)

const currentPassword = computed({
  get: () => emailForm.value.password,
  set: (val: string) => { emailForm.value.password = val },
})

const currentConfirmPassword = computed({
  get: () => emailForm.value.confirmPassword,
  set: (val: string) => { emailForm.value.confirmPassword = val },
})

// ============ 注册逻辑 ============

const handleEmailRegister = async () => {
  if (!emailForm.value.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.value.email)) {
    alert('请输入正确的邮箱地址')
    return
  }
  if (!emailForm.value.emailCode) {
    alert('请输入验证码')
    return
  }
  if (!emailForm.value.password || emailForm.value.password.length < 6) {
    alert('密码至少6位')
    return
  }
  if (emailForm.value.password !== emailForm.value.confirmPassword) {
    alert('两次密码不一致')
    return
  }

  loading.value = true
  try {
    const res = await authApi.register({
      email: emailForm.value.email,
      password: emailForm.value.password,
      emailCode: emailForm.value.emailCode,
    })
    login(res.token, res.user)
    router.push('/')
  } catch (error: any) {
    alert(error.response?.data?.error || '注册失败')
  } finally {
    loading.value = false
  }
}

const handleRegister = () => {
  handleEmailRegister()
}

// ============ 发送验证码 ============

const handleSendSms = async () => {
  if (!phoneForm.value.phone || !/^1[3-9]\d{9}$/.test(phoneForm.value.phone)) {
    alert('请输入正确的手机号')
    return
  }
  try {
    await authApi.sendSmsCode(phoneForm.value.phone)
    startCountdown('sms')
  } catch {
    alert('发送失败')
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
    alert('发送失败')
  }
}

const startCountdown = (type: 'sms' | 'email') => {
  const countdownRef = type === 'sms' ? smsCountdown : emailCountdown
  countdownRef.value = 60
  const timer = setInterval(() => {
    countdownRef.value--
    if (countdownRef.value <= 0) clearInterval(timer)
  }, 1000)
}
</script>

<template>
  <div class="register-page">
    <div class="register-card">
      <h1 class="title">注册</h1>

      <form class="register-form" @submit.prevent="handleRegister">
        <!-- 邮箱注册 -->
        <div class="form-item">
          <input
            v-model="emailForm.email"
            type="email"
            placeholder="邮箱地址"
            class="input"
          />
        </div>
        <div class="form-item code-item">
          <input
            v-model="emailForm.emailCode"
            type="text"
            placeholder="邮箱验证码"
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

        <div class="form-item">
          <input
            v-model="currentPassword"
            type="password"
            placeholder="设置密码（至少6位）"
            class="input"
          />
        </div>
        <div class="form-item">
          <input
            v-model="currentConfirmPassword"
            type="password"
            placeholder="确认密码"
            class="input"
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>

      <div class="footer-links">
        <router-link to="/login" class="link">已有账号？去登录</router-link>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.register-page {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 20px;
}

.register-card {
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

.register-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 4px;

  .tab {
    flex: 1;
    padding: 10px;
    border: none;
    background: transparent;
    border-radius: 6px;
    font-size: 14px;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;

    &.active {
      background: #fff;
      color: #1a1a2e;
      font-weight: 500;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  }
}

.register-form {
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

  .code-item {
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
</style>
