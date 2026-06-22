<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authApi } from '@/api/auth'
import { useAuth } from '@/composables'

const router = useRouter()
const route = useRoute()
const { login } = useAuth()

const loading = ref(false)

// 邮箱验证码登录
const emailForm = ref({ email: '', emailCode: '' })
const emailCountdown = ref(0)
let emailTimer: ReturnType<typeof setInterval> | null = null


// ============ 登录逻辑 ============

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

const handleLogin = () => handleEmailLogin()

const handleLoginSuccess = (res: any) => {
  login(res.token, res.user)
  const redirect = route.query.redirect as string
  router.push(redirect || '/')
}

// ============ 发送验证码 ============

const handleSendEmail = async () => {
  if (!emailForm.value.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.value.email)) {
    alert('请输入正确的邮箱地址')
    return
  }
  try {
    await authApi.sendEmailCode(emailForm.value.email)
    startCountdown()
  } catch {
    alert('发送失败，请稍后重试')
  }
}

const startCountdown = () => {
  emailCountdown.value = 60
  if (emailTimer) clearInterval(emailTimer)
  emailTimer = setInterval(() => {
    emailCountdown.value--
    if (emailCountdown.value <= 0 && emailTimer) clearInterval(emailTimer)
  }, 1000)
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="title">登录</h1>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-item">
          <input v-model="emailForm.email" type="email" placeholder="邮箱地址" class="input" />
        </div>
        <div class="form-item sms-item">
          <input v-model="emailForm.emailCode" type="text" placeholder="验证码" maxlength="6" class="input" />
          <button type="button" class="code-btn" :disabled="emailCountdown > 0" @click="handleSendEmail">
            {{ emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码' }}
          </button>
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <div class="footer-links">
        <router-link to="/register" class="link">没有账号？去注册</router-link>
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
