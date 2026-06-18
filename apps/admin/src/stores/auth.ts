import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { adminApi, type AdminInfo } from '@/api/admin'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('admin_token') || '')
  const admin = ref<AdminInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const isSuper = computed(() => admin.value?.role === 'super')

  const login = async (username: string, password: string) => {
    const res = await adminApi.login({ username, password })
    token.value = res.token
    localStorage.setItem('admin_token', res.token)
    admin.value = res.admin
  }

  const fetchProfile = async () => {
    try {
      admin.value = await adminApi.getMe()
    } catch {
      logout()
    }
  }

  const logout = () => {
    token.value = ''
    admin.value = null
    localStorage.removeItem('admin_token')
  }

  return { token, admin, isLoggedIn, isSuper, login, fetchProfile, logout }
})
