import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/home/index.vue'),
    meta: { title: '首页' },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/login.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/register.vue'),
    meta: { title: '注册' },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/profile/index.vue'),
    meta: { title: '个人中心', requiresAuth: true },
  },
  {
    path: '/analysis',
    name: 'Analysis',
    component: () => import('@/views/analysis/index.vue'),
    meta: { title: '风水分析', requiresAuth: true },
  },
  // /history 重定向到地理分析页（历史已合并）
  {
    path: '/history',
    redirect: '/analysis',
  },
  {
    path: '/fengshui-home',
    name: 'FengshuiHome',
    component: () => import('@/views/fengshui-home/index.vue'),
    meta: { title: '居家风水', requiresAuth: true },
  },
  {
    path: '/fortune',
    name: 'Fortune',
    component: () => import('@/views/fortune/index.vue'),
    meta: { title: '流年大运', requiresAuth: true },
  },
  {
    path: '/divination',
    name: 'Divination',
    component: () => import('@/views/divination/index.vue'),
    meta: { title: '八卦问事', requiresAuth: true },
  },
  {
    path: '/ai',
    name: 'AI',
    component: () => import('@/views/ai/index.vue'),
    meta: { title: 'AI 创作', requiresAuth: true },
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/about/index.vue'),
    meta: { title: '关于我们' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在' },
  },
]

const router = createRouter({
  history: createWebHistory('/front/'),
  routes,
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  // 设置页面标题
  document.title = `${to.meta.title || '风水地球仪'} - 风水地球仪`

  // 检查是否需要登录
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('token')
    if (!token) {
      next({ name: 'Login', query: { redirect: to.fullPath } })
      return
    }
  }

  next()
})

export default router
