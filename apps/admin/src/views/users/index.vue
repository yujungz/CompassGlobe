<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi, type AdminUserInfo, type UserDetail } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const isSuper = () => authStore.isSuper

const loading = ref(false)
const users = ref<AdminUserInfo[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

const searchForm = ref({
  keyword: '',
  status: '',
})

// Detail dialog
const showDetail = ref(false)
const detailUser = ref<UserDetail | null>(null)
const detailLoading = ref(false)

// Edit dialog (super admin only)
const showEdit = ref(false)
const editForm = ref<Record<string, any>>({})
const editSaving = ref(false)

// Consumption dialog
const showConsumption = ref(false)
const consumptionForm = ref({ imageCount: 0, consultCount: 0 })
const consumptionUserId = ref('')

onMounted(() => {
  fetchUsers()
})

const fetchUsers = async () => {
  loading.value = true
  try {
    const res = await adminApi.getUsers({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchForm.value.keyword || undefined,
      status: searchForm.value.status || undefined,
    })
    users.value = res.list
    total.value = res.total
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  fetchUsers()
}

const handleReset = () => {
  searchForm.value = { keyword: '', status: '' }
  handleSearch()
}

const handleStatusChange = async (user: AdminUserInfo) => {
  const action = user.status === 1 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}该用户吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await adminApi.updateUserStatus(user.id, user.status === 1 ? 0 : 1)
    ElMessage.success(`${action}成功`)
    fetchUsers()
  } catch {
    // cancelled
  }
}

const openDetail = async (user: AdminUserInfo) => {
  showDetail.value = true
  detailLoading.value = true
  try {
    detailUser.value = await adminApi.getUserDetail(user.id)
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '获取用户详情失败')
  } finally {
    detailLoading.value = false
  }
}

const openEdit = async (user: AdminUserInfo) => {
  try {
    const detail = await adminApi.getUserDetail(user.id)
    editForm.value = { ...detail }
    showEdit.value = true
  } catch (error: any) {
    ElMessage.error('获取用户信息失败')
  }
}

const saveEdit = async () => {
  editSaving.value = true
  try {
    await adminApi.updateUser(editForm.value.id, {
      username: editForm.value.username,
      phone: editForm.value.phone || null,
      email: editForm.value.email || null,
      wechat: editForm.value.wechat || null,
      realName: editForm.value.realName || null,
      nickname: editForm.value.nickname || null,
      gender: editForm.value.gender || null,
      birthYear: editForm.value.birthYear || null,
      birthMonth: editForm.value.birthMonth || null,
      birthDay: editForm.value.birthDay || null,
      birthHour: editForm.value.birthHour || null,
      qq: editForm.value.qq || null,
      birthAddress: editForm.value.birthAddress || null,
      company: editForm.value.company || null,
      companyAddress: editForm.value.companyAddress || null,
      industry: editForm.value.industry || null,
      profession: editForm.value.profession || null,
      remark: editForm.value.remark || null,
      status: editForm.value.status,
      imageCount: editForm.value.imageCount,
      consultCount: editForm.value.consultCount,
    })
    ElMessage.success('保存成功')
    showEdit.value = false
    fetchUsers()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '保存失败')
  } finally {
    editSaving.value = false
  }
}

const handleRealNameAction = async (userId: string, status: string) => {
  const action = status === 'verified' ? '通过' : '驳回'
  try {
    await ElMessageBox.confirm(`确定要${action}该用户的实名认证吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await adminApi.updateUserRealName(userId, status)
    ElMessage.success(`实名认证已${action}`)
    if (showDetail.value) openDetail(users.value.find(u => u.id === userId)!)
  } catch {
    // cancelled
  }
}

const openConsumption = (user: AdminUserInfo) => {
  consumptionUserId.value = user.id
  consumptionForm.value = { imageCount: user.imageCount, consultCount: user.consultCount }
  showConsumption.value = true
}

const saveConsumption = async () => {
  try {
    await adminApi.updateUserConsumption(consumptionUserId.value, consumptionForm.value)
    ElMessage.success('调整成功')
    showConsumption.value = false
    fetchUsers()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '调整失败')
  }
}

// 修改密码
const showPassword = ref(false)
const passwordForm = ref({ userId: '', username: '', newPassword: '' })
const passwordSaving = ref(false)

const openPassword = (user: AdminUserInfo) => {
  passwordForm.value = { userId: user.id, username: user.username, newPassword: '' }
  showPassword.value = true
}

const savePassword = async () => {
  if (!passwordForm.value.newPassword || passwordForm.value.newPassword.length < 6) {
    ElMessage.error('密码至少6位')
    return
  }
  passwordSaving.value = true
  try {
    await adminApi.updateUserPassword(passwordForm.value.userId, passwordForm.value.newPassword)
    ElMessage.success('密码修改成功')
    showPassword.value = false
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '修改失败')
  } finally { passwordSaving.value = false }
}

// 删除用户
const handleDeleteUser = async (user: AdminUserInfo) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户「${user.username}」吗？该用户的所有数据（分析记录、居家风水、流年大运、八卦问事、AI 对话等）将被永久删除，此操作不可恢复。`,
      '危险操作',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'error', confirmButtonClass: 'el-button--danger' as any }
    )
    await adminApi.deleteUser(user.id)
    ElMessage.success('用户已删除')
    fetchUsers()
  } catch { /* cancelled */ }
}

const statusTagType = (status: number) => (status === 1 ? 'success' : 'danger')
const statusText = (status: number) => (status === 1 ? '正常' : '禁用')
const realNameTagType = (s: string) => {
  if (s === 'verified') return 'success'
  if (s === 'pending') return 'warning'
  return 'info'
}
const realNameText = (s: string) => {
  if (s === 'verified') return '已认证'
  if (s === 'pending') return '审核中'
  return '未认证'
}
const genderText = (g: string | null) => {
  if (g === 'male') return '男'
  if (g === 'female') return '女'
  return g || '-'
}
</script>

<template>
  <div>
    <!-- Search -->
    <el-card shadow="hover" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="搜索">
          <el-input v-model="searchForm.keyword" placeholder="用户名/手机/邮箱/姓名" clearable style="width: 240px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="正常" value="1" />
            <el-option label="禁用" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Table -->
    <el-card shadow="hover">
      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column prop="username" label="用户名" min-width="100" />
        <el-table-column prop="phone" label="手机号" min-width="110" />
        <el-table-column prop="email" label="邮箱" min-width="150" />
        <el-table-column prop="nickname" label="昵称" min-width="100" />
        <el-table-column prop="realNameStatus" label="实名" width="90">
          <template #default="{ row }">
            <el-tag :type="realNameTagType(row.realNameStatus)" size="small">
              {{ realNameText(row.realNameStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="imageCount" label="创作" width="60" />
        <el-table-column prop="consultCount" label="咨询" width="60" />
        <el-table-column prop="createdAt" label="注册时间" min-width="150">
          <template #default="{ row }">
            {{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="300">
          <template #default="{ row }">
            <el-button size="small" @click="openDetail(row)">详情</el-button>
            <el-button v-if="isSuper()" size="small" type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" @click="openConsumption(row)">次数</el-button>
            <el-button v-if="isSuper()" size="small" type="warning" @click="openPassword(row)">密码</el-button>
            <el-button
              :type="row.status === 1 ? 'warning' : 'success'"
              size="small"
              @click="handleStatusChange(row)"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button v-if="isSuper()" size="small" type="danger" @click="handleDeleteUser(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchUsers"
          @current-change="fetchUsers"
        />
      </div>
    </el-card>

    <!-- Detail Dialog -->
    <el-dialog v-model="showDetail" title="用户详情" width="640px" destroy-on-close>
      <div v-if="detailLoading" class="dialog-loading">加载中...</div>
      <div v-else-if="detailUser" class="detail-grid">
        <div class="detail-item"><label>用户ID</label><span>{{ detailUser.id }}</span></div>
        <div class="detail-item"><label>用户名</label><span>{{ detailUser.username }}</span></div>
        <div class="detail-item"><label>姓名</label><span>{{ detailUser.realName || '-' }}</span></div>
        <div class="detail-item"><label>昵称</label><span>{{ detailUser.nickname || '-' }}</span></div>
        <div class="detail-item"><label>性别</label><span>{{ genderText(detailUser.gender) }}</span></div>
        <div class="detail-item"><label>出生日期</label><span>{{ detailUser.birthYear ? `${detailUser.birthYear}-${detailUser.birthMonth}-${detailUser.birthDay} ${detailUser.birthHour}时` : '-' }}</span></div>
        <div class="detail-item"><label>手机号</label><span>{{ detailUser.phone || '-' }}</span></div>
        <div class="detail-item"><label>邮箱</label><span>{{ detailUser.email || '-' }}</span></div>
        <div class="detail-item"><label>微信号</label><span>{{ detailUser.wechat || '-' }}</span></div>
        <div class="detail-item"><label>QQ</label><span>{{ detailUser.qq || '-' }}</span></div>
        <div class="detail-item"><label>出生地址</label><span>{{ detailUser.birthAddress || '-' }}</span></div>
        <div class="detail-item"><label>公司</label><span>{{ detailUser.company || '-' }}</span></div>
        <div class="detail-item"><label>行业</label><span>{{ detailUser.industry || '-' }}</span></div>
        <div class="detail-item"><label>职业</label><span>{{ detailUser.profession || '-' }}</span></div>
        <div class="detail-item"><label>实名状态</label>
          <el-tag :type="realNameTagType(detailUser.realNameStatus)" size="small">{{ realNameText(detailUser.realNameStatus) }}</el-tag>
        </div>
        <div class="detail-item"><label>身份证号</label><span>{{ detailUser.idCard || '-' }}</span></div>
        <div class="detail-item"><label>备注</label><span>{{ detailUser.remark || '-' }}</span></div>
        <div class="detail-item"><label>创作次数</label><span>{{ detailUser.imageCount }}</span></div>
        <div class="detail-item"><label>咨询次数</label><span>{{ detailUser.consultCount }}</span></div>
        <div class="detail-item"><label>注册时间</label><span>{{ detailUser.createdAt ? new Date(detailUser.createdAt).toLocaleString('zh-CN') : '-' }}</span></div>
      </div>
      <template #footer v-if="detailUser && isSuper()">
        <el-button v-if="detailUser.realNameStatus === 'pending'" type="success" @click="handleRealNameAction(detailUser.id, 'verified')">通过实名</el-button>
        <el-button v-if="detailUser.realNameStatus === 'pending'" type="danger" @click="handleRealNameAction(detailUser.id, 'unverified')">驳回实名</el-button>
        <el-button @click="showDetail = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- Edit Dialog (Super Admin) -->
    <el-dialog v-model="showEdit" title="编辑用户" width="640px" destroy-on-close v-if="isSuper()">
      <div v-if="editForm.id" class="edit-grid">
        <div class="edit-item"><label>用户ID</label><span style="font-size:13px;color:#909399">{{ editForm.id }}</span></div>
        <div class="edit-item"><label>用户名</label><el-input v-model="editForm.username" /></div>
        <div class="edit-item"><label>姓名</label><el-input v-model="editForm.realName" /></div>
        <div class="edit-item"><label>昵称</label><el-input v-model="editForm.nickname" /></div>
        <div class="edit-item"><label>手机号</label><el-input v-model="editForm.phone" /></div>
        <div class="edit-item"><label>邮箱</label><el-input v-model="editForm.email" /></div>
        <div class="edit-item"><label>微信号</label><el-input v-model="editForm.wechat" /></div>
        <div class="edit-item"><label>QQ</label><el-input v-model="editForm.qq" /></div>
        <div class="edit-item"><label>出生地址</label><el-input v-model="editForm.birthAddress" /></div>
        <div class="edit-item"><label>公司</label><el-input v-model="editForm.company" /></div>
        <div class="edit-item"><label>行业</label><el-input v-model="editForm.industry" /></div>
        <div class="edit-item"><label>职业</label><el-input v-model="editForm.profession" /></div>
        <div class="edit-item"><label>备注</label><el-input v-model="editForm.remark" type="textarea" /></div>
      </div>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- Consumption Dialog -->
    <el-dialog v-model="showConsumption" title="调整消费次数" width="360px" destroy-on-close>
      <div class="edit-item"><label>创作次数</label><el-input-number v-model="consumptionForm.imageCount" :min="0" /></div>
      <div class="edit-item" style="margin-top:12px"><label>咨询次数</label><el-input-number v-model="consumptionForm.consultCount" :min="0" /></div>
      <template #footer>
        <el-button @click="showConsumption = false">取消</el-button>
        <el-button type="primary" @click="saveConsumption">保存</el-button>
      </template>
    </el-dialog>

    <!-- Password Dialog -->
    <el-dialog v-model="showPassword" title="修改用户密码" width="400px" destroy-on-close>
      <p style="margin-bottom:12px;color:#909399">用户：{{ passwordForm.username }}</p>
      <div class="edit-item">
        <label>新密码</label>
        <el-input v-model="passwordForm.newPassword" type="password" placeholder="至少6位" show-password />
      </div>
      <template #footer>
        <el-button @click="showPassword = false">取消</el-button>
        <el-button type="primary" :loading="passwordSaving" @click="savePassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.search-card { margin-bottom: 20px; }
.pagination { margin-top: 20px; display: flex; justify-content: flex-end; }
.dialog-loading { text-align: center; padding: 40px; color: #999; }

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    label { font-size: 12px; color: #999; }
    span { font-size: 14px; color: #333; }
  }
}

.edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  .edit-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    label { font-size: 12px; color: #999; }
  }
}
</style>
