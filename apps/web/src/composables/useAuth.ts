import { ref, computed } from 'vue'

interface User {
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

// 模块级共享状态
const user = ref<User | null>(null)
const token = ref<string | null>(localStorage.getItem('token'))
const isLoggedIn = computed(() => !!token.value)

export function useAuth() {
  const login = (newToken: string, userData: User) => {
    token.value = newToken
    user.value = userData
    localStorage.setItem('token', newToken)
  }

  const logout = () => {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  // 刷新用户信息
  async function refreshUser() {
    try {
      const { authApi } = await import('@/api/auth')
      const u = await authApi.getCurrentUser()
      user.value = {
        id: u.id,
        username: u.username,
        phone: u.phone,
        email: u.email,
        nickname: u.nickname || u.username,
        avatar: u.avatar,
        loginType: u.loginType,
        registrationMethod: u.registrationMethod,
        imageCount: u.imageCount,
        consultCount: u.consultCount,
      }
    } catch {
      // ignore
    }
  }

  return {
    user,
    token,
    isLoggedIn,
    login,
    logout,
    refreshUser,
  }
}
