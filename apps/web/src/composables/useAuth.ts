import { ref, computed } from 'vue'

interface User {
  id: string
  phone: string | null
  email: string | null
  nickname: string
  avatar: string | null
  loginType: string
}

// 模块级共享状态：跨组件响应式（token 变化 → isLoggedIn 自动更新）
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

  return {
    user,
    token,
    isLoggedIn,
    login,
    logout,
  }
}
