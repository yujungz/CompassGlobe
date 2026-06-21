<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const activeTab = ref('ports')
const loading = ref(false)

// ===== 端口映射 =====
const ports = ref({
  POSTGRES_PORT: '5432',
  REDIS_PORT: '6379',
  MINIO_API_PORT: '9000',
  MINIO_CONSOLE_PORT: '9001',
  SERVER_PORT: '3001',
  NGINX_PORT: '8110',
})

// ===== 第三方接口 =====
const thirdParty = ref({
  SMTP_HOST: 'smtp.qq.com',
  SMTP_PORT: '465',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: '',
  QWEATHER_API_HOST: '',
  QWEATHER_PROJECT_ID: '',
  QWEATHER_CREDENTIAL_ID: '',
  TDT_KEY: '',
  AMAP_KEY: '82f312a45f750e9962fff34d82421215',
})

// ===== 大模型参数 =====
const aiModel = ref({
  AI_CHAT_URL: '',
  AI_CHAT_KEY: '',
  AI_CHAT_MODEL: '',
  AI_IMAGE_URL: '',
  AI_IMAGE_EDIT_URL: '',
  AI_IMAGE_KEY: '',
  AI_IMAGE_MODEL: '',
})

onMounted(async () => {
  await loadAll()
})

async function loadAll() {
  loading.value = true
  try {
    const res: any = await request.get('/admin/config/all')
    if (res) {
      if (res.ports) ports.value = { ...ports.value, ...res.ports }
      if (res.thirdParty) thirdParty.value = { ...thirdParty.value, ...res.thirdParty }
      if (res.aiModel) aiModel.value = { ...aiModel.value, ...res.aiModel }
    }
  } catch { /* use defaults */ }
  finally { loading.value = false }
}

// ===== 端口冲突检测 =====
function findDuplicatePorts(): string[] {
  const map: Record<string, string[]> = {}
  const entries = Object.entries(ports.value)
  for (const [name, port] of entries) {
    if (!port) continue
    if (!map[port]) map[port] = []
    map[port].push(name)
  }
  return Object.entries(map).filter(([, names]) => names.length > 1).map(([port, names]) => `端口 ${port} 冲突: ${names.join(', ')}`)
}

// ===== 保存端口 =====
const savingPorts = ref(false)
async function savePorts() {
  const dupes = findDuplicatePorts()
  if (dupes.length > 0) {
    ElMessage.error(`端口冲突：${dupes.join('；')}`)
    return
  }
  savingPorts.value = true
  try {
    const res: any = await request.put('/admin/config/ports', ports.value)
    if (res?.conflicts?.length) {
      ElMessage.error(res.conflicts.join('\n'))
      return
    }
    ElMessage.success('端口配置已保存')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '保存失败')
  } finally { savingPorts.value = false }
}

// ===== 保存第三方接口 =====
const savingThird = ref(false)
async function saveThirdParty() {
  savingThird.value = true
  try {
    await request.put('/admin/config/third-party', thirdParty.value)
    ElMessage.success('第三方接口配置已保存')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '保存失败')
  } finally { savingThird.value = false }
}

// ===== 保存大模型 =====
const savingAI = ref(false)
async function saveAI() {
  savingAI.value = true
  try {
    await request.put('/admin/config/ai-model', aiModel.value)
    ElMessage.success('大模型参数已保存')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '保存失败')
  } finally { savingAI.value = false }
}

// ===== 测试功能 =====
const testing = ref('')
const testResults = ref<Record<string, { ok: boolean; msg: string; time: string }>>({})

async function testService(endpoint: string, data: any) {
  testing.value = endpoint
  try {
    const res: any = await request.post(`/admin/test/${endpoint}`, data, { timeout: 120000 })
    testResults.value[endpoint] = { ok: res.success, msg: res.message, time: new Date().toLocaleString('zh-CN') }
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || '测试失败'
    testResults.value[endpoint] = { ok: false, msg, time: new Date().toLocaleString('zh-CN') }
  } finally { testing.value = '' }
}

const portLabels: Record<string, string> = {
  POSTGRES_PORT: 'PostgreSQL', REDIS_PORT: 'Redis', MINIO_API_PORT: 'MinIO API',
  MINIO_CONSOLE_PORT: 'MinIO Console', SERVER_PORT: 'Server', NGINX_PORT: 'Nginx',
}
</script>

<template>
  <div class="config-page">
    <el-card shadow="hover">
      <template #header><span>系统配置</span></template>
      <el-tabs v-model="activeTab">
        <!-- 端口映射 -->
        <el-tab-pane label="端口映射" name="ports">
          <el-form label-width="160px" class="config-form">
            <el-form-item v-for="(val, key) in ports" :key="key" :label="portLabels[key] || key">
              <el-input v-model="ports[key]" placeholder="端口号" style="width:200px" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="savingPorts" @click="savePorts">保存端口配置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 第三方接口 -->
        <el-tab-pane label="第三方接口" name="third">
          <el-form label-width="160px" class="config-form">
            <el-divider content-position="left">邮箱服务</el-divider>
            <el-form-item label="SMTP 服务器"><el-input v-model="thirdParty.SMTP_HOST" placeholder="smtp.qq.com" /></el-form-item>
            <el-form-item label="SMTP 端口"><el-input v-model="thirdParty.SMTP_PORT" placeholder="465" /></el-form-item>
            <el-form-item label="SMTP 用户名"><el-input v-model="thirdParty.SMTP_USER" placeholder="邮箱地址" /></el-form-item>
            <el-form-item label="SMTP 密码"><el-input v-model="thirdParty.SMTP_PASS" type="password" show-password placeholder="授权码" /></el-form-item>
            <el-form-item label="发件人地址"><el-input v-model="thirdParty.SMTP_FROM" placeholder="与用户名相同" /></el-form-item>
            <el-form-item>
              <el-button type="success" :loading="testing === 'email'" @click="testService('email', thirdParty)">测试邮箱</el-button>
              <span v-if="testResults.email" :style="{ color: testResults.email.ok ? '#67c23a' : '#f56c6c', marginLeft: '12px', fontSize: '13px' }">[{{ testResults.email.time }}] {{ testResults.email.msg }}</span>
            </el-form-item>

            <el-divider content-position="left">和风天气</el-divider>
            <el-form-item label="API 地址"><el-input v-model="thirdParty.QWEATHER_API_HOST" placeholder="https://api.qweather.com" /></el-form-item>
            <el-form-item label="项目 ID"><el-input v-model="thirdParty.QWEATHER_PROJECT_ID" placeholder="Project ID" /></el-form-item>
            <el-form-item label="凭证 ID"><el-input v-model="thirdParty.QWEATHER_CREDENTIAL_ID" placeholder="Credential ID" /></el-form-item>
            <el-form-item>
              <el-button type="success" :loading="testing === 'qweather'" @click="testService('qweather', thirdParty)">测试和风天气</el-button>
              <span v-if="testResults.qweather" :style="{ color: testResults.qweather.ok ? '#67c23a' : '#f56c6c', marginLeft: '12px', fontSize: '13px' }">{{ testResults.qweather.msg }}</span>
            </el-form-item>

            <el-divider content-position="left">地图服务</el-divider>
            <el-form-item label="天地图 Key"><el-input v-model="thirdParty.TDT_KEY" /></el-form-item>
            <el-form-item label="高德地图 Key"><el-input v-model="thirdParty.AMAP_KEY" placeholder="82f312a45f750e9962fff34d82421215" /></el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="savingThird" @click="saveThirdParty">保存第三方配置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 大模型参数 -->
        <el-tab-pane label="大模型参数" name="ai">
          <el-form label-width="160px" class="config-form">
            <el-divider content-position="left">AI 对话</el-divider>
            <el-form-item label="BASE_URL"><el-input v-model="aiModel.AI_CHAT_URL" placeholder="https://api.openai.com/v1/chat/completions" /></el-form-item>
            <el-form-item label="AUTH_TOKEN"><el-input v-model="aiModel.AI_CHAT_KEY" type="password" show-password placeholder="sk-..." /></el-form-item>
            <el-form-item label="模型名称"><el-input v-model="aiModel.AI_CHAT_MODEL" placeholder="gpt-5.2" /></el-form-item>
            <el-form-item>
              <el-button type="success" :loading="testing === 'ai-chat'" @click="testService('ai-chat', aiModel)">测试对话</el-button>
              <span v-if="testResults['ai-chat']" :style="{ color: testResults['ai-chat'].ok ? '#67c23a' : '#f56c6c', marginLeft: '12px', fontSize: '13px' }">{{ testResults['ai-chat'].msg }}</span>
            </el-form-item>

            <el-divider content-position="left">图片处理 — 生图</el-divider>
            <el-form-item label="BASE_URL"><el-input v-model="aiModel.AI_IMAGE_URL" placeholder="https://api.openai.com/v1/images/generations" /></el-form-item>
            <el-form-item label="AUTH_TOKEN"><el-input v-model="aiModel.AI_IMAGE_KEY" type="password" show-password placeholder="与 AI 对话共用 AUTH_TOKEN" /></el-form-item>
            <el-form-item label="模型名称"><el-input v-model="aiModel.AI_IMAGE_MODEL" placeholder="gpt-image-2-pro" /></el-form-item>
            <el-form-item>
              <el-button type="success" :loading="testing === 'ai-image'" @click="testService('ai-image', aiModel)">测试生图</el-button>
              <span v-if="testResults['ai-image']" :style="{ color: testResults['ai-image'].ok ? '#67c23a' : '#f56c6c', marginLeft: '12px', fontSize: '13px' }">{{ testResults['ai-image'].msg }}</span>
            </el-form-item>

            <el-divider content-position="left">图片处理 — 修图</el-divider>
            <p style="color:#909399;font-size:12px;margin-bottom:12px">AUTH_TOKEN 和模型名称与「生图」共用，无需重复填写</p>
            <el-form-item label="BASE_URL"><el-input v-model="aiModel.AI_IMAGE_EDIT_URL" placeholder="https://api.openai.com/v1/images/edits" /></el-form-item>
            <el-form-item>
              <el-button type="success" :loading="testing === 'ai-edit'" @click="testService('ai-edit', aiModel)">测试修图</el-button>
              <span v-if="testResults['ai-edit']" :style="{ color: testResults['ai-edit'].ok ? '#67c23a' : '#f56c6c', marginLeft: '12px', fontSize: '13px' }">{{ testResults['ai-edit'].msg }}</span>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="savingAI" @click="saveAI">保存大模型配置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.config-page {
  .config-form { max-width: 640px; }
}
</style>
