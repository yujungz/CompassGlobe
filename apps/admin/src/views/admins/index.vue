<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi, type AdminInfo } from '@/api/admin'

const admins = ref<AdminInfo[]>([])
const loading = ref(false)

// 创建管理员弹窗
const createDialogVisible = ref(false)
const createForm = ref({ username: '', password: '', nickname: '', role: 'normal' })

// 修改密码弹窗
const passwordDialogVisible = ref(false)
const passwordForm = ref({ id: '', password: '' })

const fetchAdmins = async () => {
  loading.value = true
  try {
    admins.value = await adminApi.getAdmins()
  } finally {
    loading.value = false
  }
}

const handleCreate = async () => {
  if (!createForm.value.username || !createForm.value.password) {
    ElMessage.warning('请填写用户名和密码')
    return
  }
  if (createForm.value.password.length < 6) {
    ElMessage.warning('密码至少6位')
    return
  }
  try {
    await adminApi.createAdmin(createForm.value)
    ElMessage.success('创建成功')
    createDialogVisible.value = false
    createForm.value = { username: '', password: '', nickname: '', role: 'normal' }
    fetchAdmins()
  } catch {
    // handled by interceptor
  }
}

const handleUpdatePassword = async () => {
  if (!passwordForm.value.password || passwordForm.value.password.length < 6) {
    ElMessage.warning('密码至少6位')
    return
  }
  try {
    await adminApi.updatePassword(passwordForm.value.id, passwordForm.value.password)
    ElMessage.success('密码修改成功')
    passwordDialogVisible.value = false
  } catch {
    // handled by interceptor
  }
}

const openPasswordDialog = (admin: AdminInfo) => {
  passwordForm.value = { id: admin.id, password: '' }
  passwordDialogVisible.value = true
}

const handleToggleStatus = async (admin: AdminInfo) => {
  const newStatus = admin.status === 1 ? 0 : 1
  const action = newStatus === 1 ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(`确定要${action}管理员「${admin.username}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await adminApi.updateStatus(admin.id, newStatus)
    ElMessage.success(`已${action}`)
    fetchAdmins()
  } catch {
    // cancelled
  }
}

const handleDelete = async (admin: AdminInfo) => {
  try {
    await ElMessageBox.confirm(`确定要删除管理员「${admin.username}」吗？此操作不可恢复。`, '警告', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'error',
    })
    await adminApi.deleteAdmin(admin.id)
    ElMessage.success('删除成功')
    fetchAdmins()
  } catch {
    // cancelled
  }
}

onMounted(fetchAdmins)
</script>

<template>
  <div class="admins-page">
    <div class="page-header">
      <h2>管理员管理</h2>
      <el-button type="primary" @click="createDialogVisible = true">
        <el-icon><Plus /></el-icon>
        新增管理员
      </el-button>
    </div>

    <el-table :data="admins" v-loading="loading" border stripe>
      <el-table-column prop="username" label="用户名" width="150" />
      <el-table-column prop="nickname" label="昵称" width="150">
        <template #default="{ row }">{{ row.nickname || '-' }}</template>
      </el-table-column>
      <el-table-column prop="role" label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="row.role === 'super' ? 'danger' : 'info'">
            {{ row.role === 'super' ? '超级管理员' : '普通管理员' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'warning'">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="240">
        <template #default="{ row }">
          <el-button size="small" @click="openPasswordDialog(row)">修改密码</el-button>
          <el-button
            v-if="row.role !== 'super'"
            size="small"
            :type="row.status === 1 ? 'warning' : 'success'"
            @click="handleToggleStatus(row)"
          >
            {{ row.status === 1 ? '禁用' : '启用' }}
          </el-button>
          <el-button
            v-if="row.role !== 'super'"
            size="small"
            type="danger"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 创建管理员弹窗 -->
    <el-dialog v-model="createDialogVisible" title="新增管理员" width="460px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="createForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="createForm.password" type="password" placeholder="至少6位" show-password />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="createForm.nickname" placeholder="可选" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.role" style="width: 100%">
            <el-option label="普通管理员" value="normal" />
            <el-option label="超级管理员" value="super" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码弹窗 -->
    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="400px">
      <el-form :model="passwordForm" label-width="80px">
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.password" type="password" placeholder="至少6位" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleUpdatePassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.admins-page {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;

  h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }
}
</style>
