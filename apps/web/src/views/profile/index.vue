<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authApi, type UserFullInfo } from '@/api/auth'
import { useAuth } from '@/composables'

const router = useRouter()
const { user, refreshUser, logout } = useAuth()

const loading = ref(false)
const saving = ref(false)
const profile = ref<UserFullInfo | null>(null)
const editMode = ref(false)

// 编辑表单
const form = ref({
  username: '',
  realName: '',
  nickname: '',
  gender: '',
  birthYear: null as number | null,
  birthMonth: null as number | null,
  birthDay: null as number | null,
  birthHour: null as number | null,
  phone: '',
  email: '',
  wechat: '',
  qq: '',
  birthAddress: '',
  company: '',
  companyAddress: '',
  industry: '',
  profession: '',
})

// 实名认证
const realNameForm = ref({ realName: '', idCard: '' })
const submittingRealName = ref(false)

// 修改密码
const showPasswordDialog = ref(false)
const passwordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const changingPassword = ref(false)

const genderOptions = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '其他', value: 'other' },
]

onMounted(async () => {
  await loadProfile()
})

async function loadProfile() {
  loading.value = true
  try {
    const data = await authApi.getCurrentUser()
    profile.value = data
    form.value = {
      username: data.username || '',
      realName: data.realName || '',
      nickname: data.nickname || '',
      gender: data.gender || '',
      birthYear: data.birthYear,
      birthMonth: data.birthMonth,
      birthDay: data.birthDay,
      birthHour: data.birthHour,
      phone: data.phone || '',
      email: data.email || '',
      wechat: data.wechat || '',
      qq: data.qq || '',
      birthAddress: data.birthAddress || '',
      company: data.company || '',
      companyAddress: data.companyAddress || '',
      industry: data.industry || '',
      profession: data.profession || '',
    }
    realNameForm.value.realName = data.realName || ''
    realNameForm.value.idCard = data.idCard || ''
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  if (!form.value.username || form.value.username.trim().length < 2) {
    alert('用户名至少2个字符')
    return
  }
  saving.value = true
  try {
    const res: any = await request.put('/user/profile', {
      username: form.value.username.trim(),
      realName: form.value.realName || null,
      nickname: form.value.nickname || null,
      gender: form.value.gender || null,
      birthYear: form.value.birthYear || null,
      birthMonth: form.value.birthMonth || null,
      birthDay: form.value.birthDay || null,
      birthHour: form.value.birthHour || null,
      phone: form.value.phone || null,
      email: form.value.email || null,
      wechat: form.value.wechat || null,
      qq: form.value.qq || null,
      birthAddress: form.value.birthAddress || null,
      company: form.value.company || null,
      companyAddress: form.value.companyAddress || null,
      industry: form.value.industry || null,
      profession: form.value.profession || null,
    })
    // 用 API 返回数据更新本地 profile，无需刷新
    if (res) {
      profile.value = { ...profile.value, ...res }
      form.value = {
        username: res.username || '',
        realName: res.realName || '',
        nickname: res.nickname || '',
        gender: res.gender || '',
        birthYear: res.birthYear,
        birthMonth: res.birthMonth,
        birthDay: res.birthDay,
        birthHour: res.birthHour,
        phone: res.phone || '',
        email: res.email || '',
        wechat: res.wechat || '',
        qq: res.qq || '',
        birthAddress: res.birthAddress || '',
        company: res.company || '',
        companyAddress: res.companyAddress || '',
        industry: res.industry || '',
        profession: res.profession || '',
      }
    }
    await refreshUser()
    editMode.value = false
    alert('保存成功')
  } catch (error: any) {
    alert(error.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

async function submitRealName() {
  if (!realNameForm.value.realName || !realNameForm.value.idCard) {
    alert('请填写姓名和身份证号')
    return
  }
  submittingRealName.value = true
  try {
    await authApi.submitRealName(realNameForm.value.realName, realNameForm.value.idCard)
    await loadProfile()
    alert('实名认证已提交，等待审核')
  } catch (error: any) {
    alert(error.response?.data?.error || '提交失败')
  } finally {
    submittingRealName.value = false
  }
}

async function changePassword() {
  if (!passwordForm.value.newPassword || passwordForm.value.newPassword.length < 6) {
    alert('新密码至少6位')
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    alert('两次密码不一致')
    return
  }
  changingPassword.value = true
  try {
    await request.put('/user/password', {
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword,
    })
    showPasswordDialog.value = false
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    alert('密码修改成功')
  } catch (error: any) {
    alert(error.response?.data?.error || '修改失败')
  } finally {
    changingPassword.value = false
  }
}

function handleLogout() {
  if (confirm('确定退出登录吗？')) {
    logout()
    router.push('/login')
  }
}
</script>

<template>
  <div class="profile-page">
    <!-- 头部 -->
    <div class="profile-header">
      <button class="home-icon" @click="router.push('/')" title="返回首页">🏠</button>
      <div class="avatar">
        <span class="avatar-text">{{ (profile?.nickname || profile?.username || '用')[0] }}</span>
      </div>
      <div class="user-info">
        <h2 class="display-name">{{ profile?.nickname || profile?.username || '用户' }}</h2>
        <p class="sub-info">
          用户名: {{ profile?.username }}
          <span v-if="profile?.realNameStatus === 'verified'" class="verified-badge">✓ 已实名</span>
        </p>
      </div>
    </div>

    <!-- 消费信息 -->
    <div class="consumption-bar" v-if="profile">
      <div class="count-item">
        <span class="count-label">创作次数</span>
        <span class="count-value">{{ profile.imageCount }}</span>
      </div>
      <div class="count-item">
        <span class="count-label">咨询次数</span>
        <span class="count-value">{{ profile.consultCount }}</span>
      </div>
    </div>

    <div class="profile-content" v-if="profile">
      <!-- 基本信息 -->
      <div class="section">
        <div class="section-header">
          <h3>基本信息</h3>
          <button class="edit-toggle" @click="editMode = !editMode">
            {{ editMode ? '取消' : '编辑' }}
          </button>
        </div>
        <div class="form-grid">
          <div class="form-item" v-if="editMode">
            <label>用户名 <span class="required">*</span></label>
            <input v-model="form.username" class="input" placeholder="用户名" maxlength="30" />
          </div>
          <div class="form-item" v-else>
            <label>用户名</label>
            <span class="value">{{ profile.username }}</span>
          </div>
          <div class="form-item">
            <label>姓名</label>
            <template v-if="editMode">
              <input v-model="form.realName" class="input" placeholder="真实姓名" />
            </template>
            <template v-else>
              <span class="value">{{ profile.realName || '-' }}</span>
            </template>
          </div>
          <div class="form-item">
            <label>昵称</label>
            <template v-if="editMode">
              <input v-model="form.nickname" class="input" placeholder="昵称" />
            </template>
            <template v-else>
              <span class="value">{{ profile.nickname || '-' }}</span>
            </template>
          </div>
          <div class="form-item">
            <label>性别</label>
            <template v-if="editMode">
              <select v-model="form.gender" class="input">
                <option value="">请选择</option>
                <option v-for="g in genderOptions" :key="g.value" :value="g.value">{{ g.label }}</option>
              </select>
            </template>
            <template v-else>
              <span class="value">{{ genderOptions.find(g => g.value === profile.gender)?.label || '-' }}</span>
            </template>
          </div>
          <div class="form-item">
            <label>出生年</label>
            <template v-if="editMode">
              <input v-model.number="form.birthYear" type="number" class="input" placeholder="如 1990" min="1900" max="2100" />
            </template>
            <template v-else>
              <span class="value">{{ profile.birthYear || '-' }}</span>
            </template>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>月</label>
              <template v-if="editMode">
                <input v-model.number="form.birthMonth" type="number" class="input" placeholder="月" min="1" max="12" />
              </template>
              <template v-else>
                <span class="value">{{ profile.birthMonth || '-' }}</span>
              </template>
            </div>
            <div class="form-item">
              <label>日</label>
              <template v-if="editMode">
                <input v-model.number="form.birthDay" type="number" class="input" placeholder="日" min="1" max="31" />
              </template>
              <template v-else>
                <span class="value">{{ profile.birthDay || '-' }}</span>
              </template>
            </div>
            <div class="form-item">
              <label>时(0-23)</label>
              <template v-if="editMode">
                <input v-model.number="form.birthHour" type="number" class="input" placeholder="时" min="0" max="23" />
              </template>
              <template v-else>
                <span class="value">{{ profile.birthHour !== null ? `${profile.birthHour}时` : '-' }}</span>
              </template>
            </div>
          </div>
          <div class="form-item" v-if="editMode">
            <label>出生地址</label>
            <input v-model="form.birthAddress" class="input" placeholder="出生地址" />
          </div>
          <div class="form-item" v-else>
            <label>出生地址</label>
            <span class="value">{{ profile.birthAddress || '-' }}</span>
          </div>
        </div>
        <button v-if="editMode" class="save-btn" :disabled="saving" @click="saveProfile">
          {{ saving ? '保存中...' : '保存修改' }}
        </button>
      </div>

      <!-- 联系方式 -->
      <div class="section">
        <div class="section-header"><h3>联系方式</h3></div>
        <div class="form-grid" v-if="editMode">
          <div class="form-item">
            <label>手机号</label>
            <input v-model="form.phone" class="input" placeholder="手机号" maxlength="11" />
          </div>
          <div class="form-item">
            <label>邮箱</label>
            <input v-model="form.email" class="input" placeholder="邮箱" />
          </div>
          <div class="form-item">
            <label>微信号</label>
            <input v-model="form.wechat" class="input" placeholder="微信号" maxlength="30" />
          </div>
          <div class="form-item">
            <label>QQ号</label>
            <input v-model="form.qq" class="input" placeholder="QQ号" />
          </div>
        </div>
        <div class="form-grid" v-else>
          <div class="form-item">
            <label>手机号</label>
            <span class="value">{{ profile.phone || '-' }}</span>
          </div>
          <div class="form-item">
            <label>邮箱</label>
            <span class="value">{{ profile.email || '-' }}</span>
          </div>
          <div class="form-item">
            <label>微信号</label>
            <span class="value">{{ profile.wechat || '-' }}</span>
          </div>
          <div class="form-item">
            <label>QQ号</label>
            <span class="value">{{ profile.qq || '-' }}</span>
          </div>
        </div>
      </div>

      <!-- 工作信息 -->
      <div class="section">
        <div class="section-header"><h3>工作信息</h3></div>
        <div class="form-grid" v-if="editMode">
          <div class="form-item">
            <label>所在公司</label>
            <input v-model="form.company" class="input" placeholder="如已失业填最后一家，没有就填无" />
          </div>
          <div class="form-item">
            <label>公司地址</label>
            <input v-model="form.companyAddress" class="input" placeholder="公司地址" />
          </div>
          <div class="form-item">
            <label>所属行业</label>
            <input v-model="form.industry" class="input" placeholder="所属行业" />
          </div>
          <div class="form-item full-width">
            <label>职业</label>
            <input v-model="form.profession" class="input" placeholder="职业" />
          </div>
        </div>
        <div class="form-grid" v-else>
          <div class="form-item">
            <label>所在公司</label>
            <span class="value">{{ profile.company || '-' }}</span>
          </div>
          <div class="form-item">
            <label>公司地址</label>
            <span class="value">{{ profile.companyAddress || '-' }}</span>
          </div>
          <div class="form-item">
            <label>所属行业</label>
            <span class="value">{{ profile.industry || '-' }}</span>
          </div>
          <div class="form-item">
            <label>职业</label>
            <span class="value">{{ profile.profession || '-' }}</span>
          </div>
        </div>
      </div>

      <!-- 实名认证 -->
      <div class="section">
        <div class="section-header"><h3>实名认证</h3></div>
        <div v-if="profile.realNameStatus === 'unverified'" class="real-name-form">
          <p class="hint">请填写真实姓名和身份证号进行实名认证</p>
          <div class="form-item">
            <label>真实姓名</label>
            <input v-model="realNameForm.realName" class="input" placeholder="姓名" />
          </div>
          <div class="form-item">
            <label>身份证号</label>
            <input v-model="realNameForm.idCard" class="input" placeholder="18位身份证号" maxlength="18" />
          </div>
          <button class="save-btn" :disabled="submittingRealName" @click="submitRealName">
            {{ submittingRealName ? '提交中...' : '提交认证' }}
          </button>
        </div>
        <div v-else-if="profile.realNameStatus === 'pending'" class="real-name-status">
          <p class="status pending">⏳ 实名认证审核中，请耐心等待...</p>
        </div>
        <div v-else-if="profile.realNameStatus === 'verified'" class="real-name-status">
          <p class="status verified">✅ 实名认证已通过</p>
          <p>姓名：{{ profile.realName }}</p>
          <p>身份证号：{{ (profile.idCard || '').replace(/^(.{3}).*(.{4})$/, '$1***********$2') }}</p>
        </div>
      </div>

      <!-- 账号操作 -->
      <div class="section">
        <div class="section-header"><h3>账号操作</h3></div>
        <div class="action-list">
          <button class="action-btn" @click="showPasswordDialog = true">修改密码</button>
          <button class="action-btn danger" @click="handleLogout">退出登录</button>
        </div>
      </div>
    </div>

    <div class="loading-container" v-else-if="loading">
      <p>加载中...</p>
    </div>

    <!-- 修改密码弹窗 -->
    <div v-if="showPasswordDialog" class="modal-overlay" @click.self="showPasswordDialog = false">
      <div class="modal-card">
        <h3>修改密码</h3>
        <div class="form-item">
          <label>旧密码</label>
          <input v-model="passwordForm.oldPassword" type="password" class="input" placeholder="输入旧密码" />
        </div>
        <div class="form-item">
          <label>新密码</label>
          <input v-model="passwordForm.newPassword" type="password" class="input" placeholder="至少6位" />
        </div>
        <div class="form-item">
          <label>确认新密码</label>
          <input v-model="passwordForm.confirmPassword" type="password" class="input" placeholder="再次输入新密码" />
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showPasswordDialog = false">取消</button>
          <button class="save-btn" :disabled="changingPassword" @click="changePassword">
            {{ changingPassword ? '修改中...' : '确认修改' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// 导入 request 用于直接调用 user API
import request from '@/api/request'
export default {}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40px;
}

.profile-header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 32px 20px 32px 60px;
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #4a90d9;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &-text {
    color: #fff;
    font-size: 24px;
    font-weight: 600;
  }
}

.user-info {
  .display-name { color: #fff; font-size: 20px; font-weight: 600; margin-bottom: 4px; }
  .sub-info { color: rgba(255,255,255,0.7); font-size: 13px; }
  .verified-badge { color: #4caf50; margin-left: 8px; font-size: 12px; }
}

.home-icon {
  position: absolute; top: 28px; left: 20px; z-index: 5;
  background: none; border: none; font-size: 28px;
  cursor: pointer; padding: 4px; line-height: 1;
  &:hover { opacity: .7; }
}

.consumption-bar {
  display: flex;
  background: #fff;
  margin: 12px 16px;
  border-radius: 10px;
  padding: 16px;
  gap: 24px;
  .count-item {
    flex: 1;
    text-align: center;
    .count-label { display: block; font-size: 12px; color: #999; margin-bottom: 4px; }
    .count-value { font-size: 22px; font-weight: 700; color: #1a1a2e; }
  }
}

.profile-content {
  padding: 0 16px;
}

.section {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-top: 12px;
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    h3 { font-size: 16px; font-weight: 600; color: #1a1a2e; margin: 0; }
  }
}

.edit-toggle {
  background: none;
  border: 1px solid #4a90d9;
  color: #4a90d9;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  grid-column: span 2;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  label { font-size: 12px; color: #888; }
  .value { font-size: 14px; color: #333; padding: 8px 0; }
  .input {
    padding: 10px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 14px;
    &:focus { outline: none; border-color: #4a90d9; }
  }
  select.input { background: #fff; }
}

.full-width { grid-column: span 2; }

.save-btn {
  margin-top: 16px;
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.real-name-form {
  .hint { font-size: 13px; color: #f5a623; margin-bottom: 12px; }
}

.real-name-status {
  .status { font-size: 15px; font-weight: 500; &.pending { color: #f5a623; } &.verified { color: #4caf50; } }
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  .action-btn {
    padding: 12px;
    border: 1px solid #e0e0e0;
    background: #fff;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    &:hover { background: #f5f5f5; }
    &.danger { color: #e74c3c; border-color: #fcc; }
  }
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 380px;
  h3 { margin-bottom: 16px; font-size: 18px; }
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  .cancel-btn {
    flex: 1; padding: 10px; border: 1px solid #e0e0e0; background: #fff;
    border-radius: 8px; cursor: pointer;
  }
  .save-btn {
    flex: 2; margin-top: 0;
  }
}

.loading-container {
  text-align: center;
  padding: 60px 0;
  color: #999;
}
</style>
