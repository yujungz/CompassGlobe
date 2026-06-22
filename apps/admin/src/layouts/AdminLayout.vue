<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import request from '@/api/request'

const router = useRouter()
const authStore = useAuthStore()

const collapsed = ref(false)

const userInfo = computed(() => ({
  name: authStore.admin?.nickname || authStore.admin?.username || '管理员',
  role: authStore.admin?.role || 'normal',
}))

const menuItems = computed(() => {
  const items = [
    { path: '/dashboard', icon: 'DataLine', title: '数据概览' },
    { path: '/users', icon: 'User', title: '用户管理' },
    { path: '/analyses', icon: 'Document', title: '地理分析' },
    { path: '/fengshui-homes', icon: 'Picture', title: '居家风水' },
    { path: '/fortunes', icon: 'TrendCharts', title: '流年大运' },
    { path: '/divinations', icon: 'MagicStick', title: '八卦问事' },
    { path: '/ai-records', icon: 'ChatLineSquare', title: 'AI 创作' },
  ]
  if (authStore.isSuper) {
    items.push({ path: '/admins', icon: 'UserFilled', title: '管理员管理' })
  }
  items.push({ path: '/config', icon: 'Setting', title: '系统配置' })
  return items
})

// 修改昵称
const showNickname = ref(false)
const nicknameForm = ref('')
const nicknameSaving = ref(false)

const openNickname = () => {
  nicknameForm.value = authStore.admin?.nickname || ''
  showNickname.value = true
}

const saveNickname = async () => {
  nicknameSaving.value = true
  try {
    const res: any = await request.put('/admin/me/nickname', { nickname: nicknameForm.value })
    if (authStore.admin) authStore.admin.nickname = res.nickname
    ElMessage.success('昵称已修改')
    showNickname.value = false
  } catch (e: any) { ElMessage.error(e?.response?.data?.error || '修改失败') }
  finally { nicknameSaving.value = false }
}

// 修改密码
const showPassword = ref(false)
const passwordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const passwordSaving = ref(false)

const openPassword = () => {
  passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  showPassword.value = true
}

const savePassword = async () => {
  if (!passwordForm.value.oldPassword) { ElMessage.error('请输入旧密码'); return }
  if (!passwordForm.value.newPassword || passwordForm.value.newPassword.length < 6) { ElMessage.error('新密码至少6位'); return }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) { ElMessage.error('两次密码不一致'); return }
  passwordSaving.value = true
  try {
    await request.put('/admin/me/password', {
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword,
    })
    ElMessage.success('密码修改成功')
    showPassword.value = false
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '修改失败')
  } finally { passwordSaving.value = false }
}

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    authStore.logout()
    router.push('/login')
    ElMessage.success('已退出登录')
  })
}
</script>

<template>
  <el-container class="admin-layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo">
        <span class="logo-icon">🌍</span>
        <span v-if="!collapsed" class="logo-text">风水地球仪</span>
      </div>
      <el-menu
        :default-active="$route.path"
        :collapse="collapsed"
        router
        class="sidebar-menu"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon
            class="collapse-btn"
            @click="collapsed = !collapsed"
          >
            <Fold v-if="!collapsed" />
            <Expand v-else />
          </el-icon>
          <span class="page-title">{{ $route.meta.title }}</span>
        </div>
        <div class="header-right">
          <el-tag v-if="userInfo.role === 'super'" type="danger" size="small" style="margin-right: 12px">
            超级管理员
          </el-tag>
          <el-tag v-else type="info" size="small" style="margin-right: 12px">
            普通管理员
          </el-tag>
          <el-dropdown>
            <div class="user-info">
              <el-avatar :size="32" class="avatar">
                {{ userInfo.name[0] }}
              </el-avatar>
              <span class="username">{{ userInfo.name }}</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="openNickname">修改昵称</el-dropdown-item>
                <el-dropdown-item @click="openPassword">修改密码</el-dropdown-item>
                <el-dropdown-item @click="handleLogout" divided>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main">
        <RouterView />
      </el-main>
    </el-container>

    <!-- 修改昵称对话框 -->
    <el-dialog v-model="showNickname" title="修改昵称" width="400px" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="昵称"><el-input v-model="nicknameForm" placeholder="输入新昵称" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNickname = false">取消</el-button>
        <el-button type="primary" :loading="nicknameSaving" @click="saveNickname">确认</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码对话框 -->
    <el-dialog v-model="showPassword" title="修改登录密码" width="400px" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="旧密码">
          <el-input v-model="passwordForm.oldPassword" type="password" show-password placeholder="输入旧密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.newPassword" type="password" show-password placeholder="至少6位" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPassword = false">取消</el-button>
        <el-button type="primary" :loading="passwordSaving" @click="savePassword">确认修改</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<style lang="scss" scoped>
.admin-layout {
  height: 100vh;
}

.sidebar {
  background: #1a1a2e;
  transition: width 0.3s;

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    &-icon {
      font-size: 24px;
    }

    &-text {
      margin-left: 10px;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }
  }

  .sidebar-menu {
    border-right: none;
    background: transparent;

    :deep(.el-menu-item) {
      color: rgba(255, 255, 255, 0.7);

      &:hover,
      &.is-active {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
    }
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 20px;

  &-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .collapse-btn {
      font-size: 20px;
      cursor: pointer;
      color: #666;

      &:hover {
        color: #333;
      }
    }

    .page-title {
      font-size: 16px;
      font-weight: 500;
    }
  }

  &-right {
    display: flex;
    align-items: center;

    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;

      .avatar {
        background: #4a90d9;
      }

      .username {
        color: #333;
      }
    }
  }
}

.main {
  background: #f0f2f5;
  padding: 20px;
}
</style>
