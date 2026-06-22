<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authApi } from '@/api/auth'
import { useAuth } from '@/composables'

const router = useRouter()
const route = useRoute()
const { login } = useAuth()

const loading = ref(false)
const loginType = ref<'password' | 'email'>('password')

// 密码登录
const passwordForm = ref({ email: '', password: '' })

// 邮箱验证码登录
const emailCodeForm = ref({ email: '', code: '' })
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

// ============ 登录逻辑 ============

const handlePasswordLogin = async () => {
  if (!passwordForm.value.email) {
    alert('请输入邮箱或用户名')
    return
  }
  if (!passwordForm.value.password) {
    alert('请输入密码')
    return
  }

  loading.value = true
  try {
    const res = await authApi.login({
      account: passwordForm.value.email,
      password: passwordForm.value.password,
      loginType: 'password',
    })
    handleLoginSuccess(res)
  } catch (error: any) {
    alert(error.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}

const handleEmailCodeLogin = async () => {
  if (!emailCodeForm.value.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCodeForm.value.email)) {
    alert('请输入正确的邮箱地址')
    return
  }
  if (!emailCodeForm.value.code) {
    alert('请输入验证码')
    return
  }

  loading.value = true
  try {
    const res = await authApi.login({
      email: emailCodeForm.value.email,
      emailCode: emailCodeForm.value.code,
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
  if (loginType.value === 'password') handlePasswordLogin()
  else handleEmailCodeLogin()
}

const handleLoginSuccess = (res: any) => {
  login(res.token, res.user)
  const redirect = route.query.redirect as string
  router.push(redirect || '/')
}

// ============ 发送验证码 ============

const handleSendCode = async () => {
  if (!emailCodeForm.value.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCodeForm.value.email)) {
    alert('请输入正确的邮箱地址')
    return
  }
  try {
    await authApi.sendEmailCode(emailCodeForm.value.email)
    countdown.value = 60
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0 && timer) clearInterval(timer)
    }, 1000)
  } catch {
    alert('发送失败，请稍后重试')
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="title">登录</h1>

      <div class="login-tabs">
        <button :class="['tab', { active: loginType === 'password' }]" @click="loginType = 'password'">密码登录</button>
        <button :class="['tab', { active: loginType === 'email' }]" @click="loginType = 'email'">验证码登录</button>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <!-- 密码登录 -->
        <template v-if="loginType === 'password'">
          <div class="form-item">
            <input v-model="passwordForm.email" type="text" placeholder="邮箱 / 用户名" class="input" />
          </div>
          <div class="form-item">
            <input v-model="passwordForm.password" type="password" placeholder="密码" class="input" />
          </div>
        </template>

        <!-- 验证码登录 -->
        <template v-if="loginType === 'email'">
          <div class="form-item">
            <input v-model="emailCodeForm.email" type="email" placeholder="邮箱地址" class="input" />
          </div>
          <div class="form-item sms-item">
            <input v-model="emailCodeForm.code" type="text" placeholder="验证码" maxlength="6" class="input" />
            <button type="button" class="code-btn" :disabled="countdown > 0" @click="handleSendCode">
              {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </button>
          </div>
        </template>

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
  .form-item { margin-bottom: 16px; }

  .input {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 15px;
    transition: border-color 0.2s;

    &:focus { outline: none; border-color: #4a90d9; }
  }

  .sms-item {
    display: flex;
    gap: 12px;
    .input { flex: 1; }
    .code-btn {
      padding: 0 16px; background: #4a90d9; color: #fff;
      border: none; border-radius: 8px; font-size: 13px;
      cursor: pointer; white-space: nowrap; min-width: 100px;
      &:hover:not(:disabled) { background: #357abd; }
      &:disabled { background: #a0c4e8; cursor: not-allowed; }
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

  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.footer-links {
  margin-top: 24px;
  text-align: center;

  .link {
    color: #4a90d9;
    text-decoration: none;
    font-size: 14px;
    &:hover { text-decoration: underline; }
  }
}
</style>
