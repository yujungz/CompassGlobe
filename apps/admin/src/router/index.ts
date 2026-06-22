import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '数据概览' },
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/users/index.vue'),
        meta: { title: '用户管理' },
      },
      {
        path: 'analyses',
        name: 'Analyses',
        component: () => import('@/views/analyses/index.vue'),
        meta: { title: '分析记录' },
      },
      {
        path: 'admins',
        name: 'Admins',
        component: () => import('@/views/admins/index.vue'),
        meta: { title: '管理员管理', requireSuper: true },
      },
      {
        path: 'fengshui-homes',
        name: 'FengshuiHomes',
        component: () => import('@/views/fengshui-homes/index.vue'),
        meta: { title: '居家风水' },
      },
      {
        path: 'fortunes',
        name: 'Fortunes',
        component: () => import('@/views/fortunes/index.vue'),
        meta: { title: '流年大运' },
      },
      {
        path: 'divinations',
        name: 'Divinations',
        component: () => import('@/views/divinations/index.vue'),
        meta: { title: '八卦问事' },
      },
      {
        path: 'ai-records',
        name: 'AIRecords',
        component: () => import('@/views/ai-records/index.vue'),
        meta: { title: 'AI 创作' },
      },
      {
        path: 'config',
        name: 'Config',
        component: () => import('@/views/config/index.vue'),
        meta: { title: '系统配置' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在' },
  },
]

const router = createRouter({
  history: createWebHistory('/back/'),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  document.title = `${to.meta.title || '后台管理'} - 风水地球仪`

  if (to.path !== '/login') {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }

    const authStore = useAuthStore()
    if (!authStore.admin) {
      try {
        await authStore.fetchProfile()
      } catch {
        next({ path: '/login', query: { redirect: to.fullPath } })
        return
      }
    }

    if (to.meta.requireSuper && authStore.admin?.role !== 'super') {
      next('/dashboard')
      return
    }
  }

  next()
})

export default router
