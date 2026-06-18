import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || '请求失败'
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token')
      window.location.href = '/back/login'
    } else {
      ElMessage.error(message)
    }
    return Promise.reject(error)
  }
)

export default request
