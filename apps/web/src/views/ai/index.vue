<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import NavBar from '@/components/common/NavBar.vue'
import ChatPanel from '@/components/Chat/ChatPanel.vue'
import { aiApi } from '@/api/ai'
import { conversationApi, type ConversationItem } from '@/api/conversation'
import request from '@/api/request'

const tab = ref<'gen' | 'edit' | 'chat'>('gen')

// ===== 文生图 =====
const genPrompt = ref('')
const genSize = ref('1024x1792')
const genLoading = ref(false)
const genImage = ref('')
const genError = ref('')

function validPrompt(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  const chineseChars = (t.match(/[一-鿿]/g) || []).length
  const englishWords = (t.match(/[a-zA-Z]+/g) || []).length
  return chineseChars >= 3 || englishWords >= 3
}

function promptError(text: string): string {
  if (!text.trim()) return '请输入提示词'
  const chineseChars = (text.match(/[一-鿿]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  if (chineseChars < 3 && englishWords < 3) {
    return '提示词至少需要 3 个汉字或 3 个英文单词'
  }
  return ''
}

const handleGenerate = async () => {
  const err = promptError(genPrompt.value)
  if (err) { genError.value = err; return }
  if (!confirm('确认开始文生图吗？将消耗 1 次创作次数。')) return
  genError.value = ''
  genLoading.value = true
  try {
    const res = await aiApi.generateImage(genPrompt.value, { size: genSize.value })
    genImage.value = res.image
    loadGenHistoryList() // 刷新历史
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } } }
    genError.value = err?.response?.data?.error || '生成失败，请稍后重试'
  } finally {
    genLoading.value = false
  }
}

// ===== 文生图历史 =====
const genHistoryList = ref<any[]>([])
const genHistoryLoading = ref(false)

async function loadGenHistoryList() {
  genHistoryLoading.value = true
  try {
    const res: any[] = await request.get('/ai/history') as any[]
    genHistoryList.value = (res || []).filter((r: any) => r.type === 'gen')
  } catch { /* ignore */ }
  finally { genHistoryLoading.value = false }
}

// ===== 修图 =====
const editPrompt = ref('')
const editSource = ref('')
const editLoading = ref(false)
const editResult = ref('')
const editError = ref('')
const editSourceTab = ref<'local' | 'camera' | 'gen' | 'url'>('local')

// 在线图片
const urlImage = ref('')

function loadUrlImage() {
  editError.value = ''
  const url = urlImage.value.trim()
  if (!url) { editError.value = '请输入图片 URL'; return }
  if (!/^https?:\/\/.+\.(png|jpg|jpeg|webp|gif)/i.test(url)) {
    editError.value = 'URL 格式不正确，请输入以 http/https 开头、以 png/jpg/jpeg/webp/gif 结尾的图片地址'
    return
  }
  editSource.value = url
  editResult.value = ''
  editError.value = ''
}

// 图片验证（开始修图前调用）
function validateEditImage(): boolean {
  if (!editSource.value) {
    editError.value = '请先选择或上传一张图片'
    return false
  }
  // 对 URL 类型的来源做额外校验
  if (editSourceTab.value === 'url') {
    const url = editSource.value
    if (!/^https?:\/\//i.test(url)) {
      editError.value = '在线图片 URL 格式不正确'
      return false
    }
  }
  return true
}

// 拍摄
const cameraStream = ref<MediaStream | null>(null)
const cameraVideo = ref<HTMLVideoElement | null>(null)
const cameraActive = ref(false)
const cameraEnabled = ref(false) // 用户手动开关

async function toggleCamera() {
  if (cameraActive.value) {
    stopCamera()
    cameraEnabled.value = false
    return
  }
  editError.value = ''
  cameraEnabled.value = true
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('NOT_SUPPORTED')
    }
    // 移动端优先使用后置摄像头，失败则降级为任意摄像头
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true })
    }
    cameraStream.value = stream
    cameraActive.value = true
    await nextTick()
    if (cameraVideo.value) {
      cameraVideo.value.srcObject = stream
      await cameraVideo.value.play()
    }
  } catch (e: any) {
    cameraEnabled.value = false
    const msg = e.message || e.name || ''
    if (msg.includes('NOT_SUPPORTED') || msg.includes('NotFoundError')) {
      editError.value = '设备无摄像头或不支持'
    } else if (msg.includes('NotAllowedError') || msg.includes('PermissionDeniedError')) {
      editError.value = '摄像头权限被拒绝，请在浏览器设置中允许'
    } else if (msg.includes('NotReadableError') || msg.includes('AbortError')) {
      editError.value = '摄像头被其他应用占用'
    } else if (location.protocol === 'http:') {
      editError.value = '手机浏览器需 HTTPS 才能使用摄像头，请用局域网 IP + 自签证书访问'
    } else {
      editError.value = '无法访问摄像头: ' + (msg || '未知错误')
    }
  }
}

function stopCamera() {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(t => t.stop())
    cameraStream.value = null
  }
  cameraActive.value = false
}

function capturePhoto() {
  const video = cameraVideo.value
  if (!video) { editError.value = '摄像头未就绪'; return }
  if (!video.videoWidth || !video.videoHeight) { editError.value = '视频尚未加载完成，请稍后再拍'; return }
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) { editError.value = '拍照失败'; return }
  ctx.drawImage(video, 0, 0)
  editSource.value = canvas.toDataURL('image/jpeg', 0.9)
  editResult.value = ''
  editError.value = ''
}

// 文生图历史
const genHistory = ref<any[]>([])
const genHistoryLoaded = ref(false)
const showGenPicker = ref(false)

async function loadGenHistory() {
  try {
    const res = await request.get('/ai/history') as any[]
    genHistory.value = (res || []).filter((r: any) => r.type === 'gen')
    genHistoryLoaded.value = true
    showGenPicker.value = true
  } catch { editError.value = '加载文生图历史失败' }
}

async function selectGenImage(record: any) {
  const key = record.content?.storageKey
  if (!key) return
  try {
    const token = localStorage.getItem('token')
    const resp = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) throw new Error('加载失败')
    const blob = await resp.blob()
    // 用 Image 替代 createImageBitmap（兼容性更好）
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    const max = 512
    let w = img.naturalWidth, h = img.naturalHeight
    if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max } else { w = Math.round(w * max / h); h = max } }
    canvas.width = w; canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    // 输出 PNG（修图 API 要求 PNG 格式），尺寸已缩小到 800px 以内
    editSource.value = canvas.toDataURL('image/png')
    editResult.value = ''
    showGenPicker.value = false
  } catch (e) {
    editError.value = '加载图片失败: ' + (e as Error).message
  }
}

onUnmounted(() => { stopCamera() })

const onPickFile = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  editError.value = ''
  const reader = new FileReader()
  reader.onload = () => {
    editSource.value = reader.result as string
    editResult.value = ''
  }
  reader.readAsDataURL(file)
}

const handleEdit = async () => {
  if (!validateEditImage()) return
  const err = promptError(editPrompt.value)
  if (err) { editError.value = err; return }
  if (!confirm('确认开始修图吗？将消耗 1 次创作次数。')) return
  editError.value = ''
  editLoading.value = true
  try {
    const res = await aiApi.editImage({ prompt: editPrompt.value, image: editSource.value })
    editResult.value = res.image
    loadEditHistoryList() // 刷新历史
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } } }
    editError.value = err?.response?.data?.error || '修图失败，请稍后重试'
  } finally {
    editLoading.value = false
  }
}

// ===== 修图历史 =====
const editHistoryList = ref<any[]>([])
const editHistoryLoading = ref(false)

async function loadEditHistoryList() {
  editHistoryLoading.value = true
  try {
    const res: any[] = await request.get('/ai/history') as any[]
    editHistoryList.value = (res || []).filter((r: any) => r.type === 'edit')
  } catch { /* ignore */ }
  finally { editHistoryLoading.value = false }
}

// ===== AI 对话 =====
const conversations = ref<ConversationItem[]>([])
const activeConvId = ref<string | null>(null)
const activeConvTitle = ref('')
const convLoading = ref(false)

const loadConversations = async () => {
  convLoading.value = true
  try {
    conversations.value = await conversationApi.getList()
  } catch {
    // ignore
  } finally {
    convLoading.value = false
  }
}

const createConversation = async () => {
  try {
    const conv = await conversationApi.create()
    conversations.value.unshift(conv)
    activeConvId.value = conv.id
    activeConvTitle.value = ''
  } catch (error: any) {
    alert(error.response?.data?.error || '创建对话失败')
  }
}

const deleteConversation = async (id: string) => {
  if (!confirm('确定删除该对话吗？')) return
  try {
    await conversationApi.delete(id)
    conversations.value = conversations.value.filter(c => c.id !== id)
    if (activeConvId.value === id) {
      activeConvId.value = null
      activeConvTitle.value = ''
    }
  } catch {
    alert('删除失败')
  }
}

const selectConversation = (conv: ConversationItem) => {
  activeConvId.value = conv.id
  activeConvTitle.value = conv.title || ''
}

// 删除历史记录
async function deleteHistoryItem(id: string) {
  if (!confirm('确定删除该历史记录吗？')) return
  try {
    await request.delete(`/ai/history/${id}`)
    genHistoryList.value = genHistoryList.value.filter(r => r.id !== id)
    editHistoryList.value = editHistoryList.value.filter(r => r.id !== id)
  } catch (e: any) { alert(e?.response?.data?.error || '删除失败') }
}

// 点击历史图片在新窗口中查看大图
function openHistoryImage(key: string) {
  if (key) window.open(`/api/storage/${encodeURIComponent(key)}`, '_blank')
}

// 加载对话列表（切换到对话tab时）
// 初始化时加载历史
onMounted(() => { loadGenHistoryList(); loadEditHistoryList() })

const onChatTab = () => {
  tab.value = 'chat'
  loadConversations()
}

const onGenTab = () => {
  tab.value = 'gen'
  loadGenHistoryList()
}

const onEditTab = () => {
  tab.value = 'edit'
  loadEditHistoryList()
}
</script>

<template>
  <div class="ai-page">
    <NavBar />
    <div class="ai-wrap">
      <div class="ai-header">
        <h1 class="title">AI 创作</h1>
        <p class="subtitle">文生图 / 修图（约 10–60 秒，请耐心等待）</p>
      </div>

      <!-- 标签 -->
      <div class="tabs">
        <button :class="['tab', { active: tab === 'gen' }]" @click="onGenTab">文生图</button>
        <button :class="['tab', { active: tab === 'edit' }]" @click="onEditTab">修图</button>
        <button :class="['tab', { active: tab === 'chat' }]" @click="onChatTab">对话</button>
      </div>

      <!-- 文生图 -->
      <section v-if="tab === 'gen'" class="card">
        <textarea v-model="genPrompt" class="prompt-input" rows="3" placeholder="描述你想要的画面，例如：一只在月球上的橘猫，卡通风格"></textarea>
        <div class="form-row">
          <select v-model="genSize" class="size-select">
            <option value="1024x1792">1024 × 1792（竖版）</option>
            <option value="1792x1024">1792 × 1024（横版）</option>
            <option value="2160x3840">2160 × 3840（竖版）</option>
            <option value="3840x2160">3840 × 2160（横版）</option>
            <option value="1024x1024">1024 × 1024（方图）</option>
            <option value="1536x1024">1536 × 1024（横图）</option>
            <option value="1024x1536">1024 × 1536（竖图）</option>
          </select>
          <button class="btn-primary" :disabled="genLoading" @click="handleGenerate">
            {{ genLoading ? '生成中…' : '生成图片' }}
          </button>
        </div>
        <p v-if="genError" class="error">{{ genError }}</p>
        <div v-if="genImage" class="result">
          <img :src="genImage" alt="生成结果" class="result-img" />
          <a :href="genImage" download="compassglobe-gen.png" class="download-link">下载</a>
        </div>

        <!-- 文生图历史 -->
        <section class="card history-card">
          <h2>生成历史</h2>
          <div v-if="genHistoryLoading" class="loading">加载中...</div>
          <div v-else-if="genHistoryList.length === 0" class="empty">暂无文生图记录</div>
          <div v-else class="gen-history-grid">
            <div v-for="rec in genHistoryList" :key="rec.id" class="history-item">
              <img :src="'/api/storage/' + (rec.content?.storageKey || '')" alt="历史" class="history-thumb" @click="genImage = '/api/storage/' + (rec.content?.storageKey || ''); genPrompt.value = rec.content?.prompt || ''" />
              <div class="history-actions-row">
                <span class="history-date">{{ new Date(rec.createdAt).toLocaleString('zh-CN') }}</span>
                <button class="del-btn" @click.stop="deleteHistoryItem(rec.id)">×</button>
              </div>
            </div>
          </div>
        </section>
      </section>

      <!-- 修图 -->
      <section v-else-if="tab === 'edit'" class="card">
        <!-- 图片来源选择 -->
        <div class="source-tabs">
          <button :class="{ active: editSourceTab === 'local' }" @click="editSourceTab = 'local'; editSource = ''; editResult = ''">本地</button>
          <button :class="{ active: editSourceTab === 'camera' }" @click="editSourceTab = 'camera'; editSource = ''; editResult = ''">拍摄</button>
          <button :class="{ active: editSourceTab === 'gen' }" @click="editSourceTab = 'gen'; editSource = ''; editResult = ''; loadGenHistory()">文生图</button>
          <button :class="{ active: editSourceTab === 'url' }" @click="editSourceTab = 'url'; editSource = ''; editResult = ''">在线</button>
        </div>

        <!-- 本地选择 -->
        <label v-if="editSourceTab === 'local'" class="upload-area">
          <input type="file" accept="image/png,image/jpeg" @change="onPickFile" />
          <span v-if="!editSource" class="upload-hint">点击选择要编辑的图片（PNG / JPG）</span>
          <img v-else :src="editSource" alt="原图" class="source-img" />
        </label>

        <!-- 拍摄 -->
        <div v-if="editSourceTab === 'camera'" class="camera-area">
          <video v-if="cameraActive" ref="cameraVideo" class="camera-preview" autoplay playsinline></video>
          <p v-if="!cameraEnabled && !editSource" class="upload-hint">开启摄像头后预览画面将显示在此处</p>
          <img v-if="editSource && !cameraActive" :src="editSource" alt="拍摄照片" class="source-img" />
          <div class="camera-controls">
            <label class="camera-switch">
              <input type="checkbox" :checked="cameraEnabled" @change="toggleCamera" />
              <span>摄像头</span>
            </label>
            <button v-if="cameraActive" class="capture-btn" @click="capturePhoto">📸 拍照</button>
          </div>
        </div>

        <!-- 在线图片 -->
        <div v-if="editSourceTab === 'url'" class="url-area">
          <div class="url-input-row">
            <input v-model="urlImage" class="input" placeholder="输入图片 URL，如 https://example.com/photo.jpg" @keydown.enter="loadUrlImage" />
            <button class="url-load-btn" @click="loadUrlImage">加载</button>
          </div>
          <img v-if="editSource && editSourceTab === 'url'" :src="editSource" alt="在线图片" class="source-img" style="margin-top:8px" />
          <p v-if="!editSource && editSourceTab === 'url'" class="upload-hint">输入图片 URL 并点击「加载」</p>
        </div>

        <!-- 文生图历史 -->
        <div v-if="editSourceTab === 'gen'" class="gen-picker">
          <p v-if="!genHistoryLoaded" class="upload-hint">点击上方「文生图」加载历史</p>
          <div v-if="showGenPicker" class="gen-grid">
            <div v-if="genHistory.length === 0" class="upload-hint">暂无文生图历史，请先生成图片</div>
            <img
              v-for="rec in genHistory" :key="rec.id"
              :src="'/api/storage/' + (rec.content?.storageKey || '')"
              :class="{ selected: editSource === '/api/storage/' + (rec.content?.storageKey || '') }"
              class="gen-thumb"
              @click="selectGenImage(rec)"
            />
          </div>
        </div>

        <textarea v-model="editPrompt" class="prompt-input" rows="2" placeholder="修改要求，至少 3 个汉字或 3 个英文单词"></textarea>
        <div class="form-row">
          <button class="btn-primary" :disabled="editLoading" @click="handleEdit">
            {{ editLoading ? '编辑中…' : '开始修图' }}
          </button>
        </div>
        <p v-if="editError" class="error">{{ editError }}</p>
        <div v-if="editResult" class="result">
          <img :src="editResult" alt="修图结果" class="result-img" />
          <a :href="editResult" download="compassglobe-edit.png" class="download-link">下载</a>
        </div>

        <!-- 修图历史 -->
        <section class="card history-card">
          <h2>修图历史</h2>
          <div v-if="editHistoryLoading" class="loading">加载中...</div>
          <div v-else-if="editHistoryList.length === 0" class="empty">暂无修图记录</div>
          <div v-else class="gen-history-grid">
            <div v-for="rec in editHistoryList" :key="rec.id" class="history-item">
              <img :src="'/api/storage/' + (rec.content?.storageKey || '')" alt="历史" class="history-thumb" @click="openHistoryImage(rec.content?.storageKey || '')" />
              <div class="history-actions-row">
                <span class="history-date">{{ new Date(rec.createdAt).toLocaleString('zh-CN') }}</span>
                <button class="del-btn" @click.stop="deleteHistoryItem(rec.id)">×</button>
              </div>
            </div>
          </div>
        </section>
      </section>

      <!-- AI 对话 -->
      <section v-else class="chat-section">
        <div class="chat-sidebar">
          <button class="new-conv-btn" @click="createConversation">+ 新建对话</button>
          <div class="conv-list" v-if="conversations.length">
            <div
              v-for="conv in conversations"
              :key="conv.id"
              :class="['conv-item', { active: conv.id === activeConvId }]"
              @click="selectConversation(conv)"
            >
              <span class="conv-title">{{ conv.title || '新对话' }}</span>
              <span class="conv-msg-count">{{ conv._count?.messages || 0 }}</span>
              <button class="conv-delete" @click.stop="deleteConversation(conv.id)">×</button>
            </div>
          </div>
          <p v-else-if="!convLoading" class="conv-empty">暂无对话，点击上方按钮创建</p>
        </div>
        <div class="chat-main">
          <template v-if="activeConvId">
            <ChatPanel
              :key="activeConvId"
              :conversation-id="activeConvId"
              @title-update="activeConvTitle = $event"
            />
          </template>
          <div v-else class="chat-placeholder">
            <p>选择一个对话或创建新对话开始聊天</p>
            <p class="hint">每个用户最多创建 20 个对话，每个对话最多 100 条消息</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ai-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.ai-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.ai-header {
  text-align: center;
  margin-bottom: 20px;

  .title {
    font-size: 26px;
    margin: 0 0 8px;
  }
  .subtitle {
    color: rgba(255, 255, 255, 0.55);
    font-size: 13px;
    margin: 0;
  }
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 4px;

  .tab {
    flex: 1;
    padding: 10px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    cursor: pointer;

    &.active {
      background: rgba(74, 144, 217, 0.2);
      color: #fff;
      font-weight: 500;
    }
  }
}

.card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
}

.prompt-input {
  width: 100%;
  padding: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;

  &::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }
  &:focus {
    outline: none;
    border-color: #4a90d9;
  }
}

.form-row {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  align-items: center;
}

.size-select {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;

  option {
    background: #1a1a2e;
    color: #fff;
  }
}

.btn-primary {
  margin-left: auto;
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.error {
  margin: 12px 0 0;
  padding: 10px;
  background: rgba(231, 76, 60, 0.15);
  border-radius: 8px;
  color: #ff9f9f;
  font-size: 13px;
}

.result {
  margin-top: 16px;
  text-align: center;

  .result-img,
  .source-img {
    max-width: 100%;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .download-link {
    display: inline-block;
    margin-top: 10px;
    color: #4a90d9;
    font-size: 13px;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  cursor: pointer;
  overflow: hidden;

  input[type='file'] {
    display: none;
  }

  .upload-hint {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
  }
}

.prompt-input + .form-row,
.upload-area + .prompt-input {
  margin-top: 12px;
}

.source-tabs {
  display: flex; gap: 4px; margin-bottom: 12px;
  background: rgba(255,255,255,.05); border-radius: 6px; padding: 3px;
  button {
    flex: 1; padding: 8px; border: none; background: transparent;
    color: rgba(255,255,255,.5); border-radius: 4px; cursor: pointer; font-size: 13px;
    &.active { background: rgba(74,144,217,.2); color: #fff; }
  }
}

.camera-area {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  .camera-preview { width: 100%; max-width: 400px; border-radius: 8px; }
  .camera-controls {
    display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 10px;
  }
  .camera-switch {
    display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px; color: rgba(255,255,255,.8);
    input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
  }
  .capture-btn {
    padding: 12px 28px; font-size: 16px; border: none; border-radius: 8px;
    background: linear-gradient(135deg, #4a90d9, #357abd);
    color: #fff; cursor: pointer;
    &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(74,144,217,.4); }
  }
}

.url-area {
  .url-input-row {
    display: flex; gap: 8px;
    .input {
      flex: 1; padding: 10px 12px; background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12); border-radius: 6px;
      color: #fff; font-size: 14px;
      &:focus { outline: none; border-color: #4a90d9; }
      &::placeholder { color: rgba(255,255,255,.35); }
    }
    .url-load-btn {
      padding: 10px 20px; font-size: 14px; white-space: nowrap;
      border: none; border-radius: 8px;
      background: linear-gradient(135deg, #4a90d9, #357abd);
      color: #fff; cursor: pointer;
      &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(74,144,217,.4); }
    }
  }
}

.history-card {
  margin-top: 16px; padding: 16px;
  h2 { margin: 0 0 12px; font-size: 16px; color: rgba(255,255,255,.85); }
}
.gen-history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.history-item {
  display: flex; flex-direction: column; gap: 4px;
  .history-thumb { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background: rgba(255,255,255,.05); cursor: pointer; }
  .history-actions-row { display: flex; align-items: center; justify-content: space-between; }
  .history-date { font-size: 10px; color: rgba(255,255,255,.4); }
  .history-prompt { font-size: 11px; color: rgba(255,255,255,.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .del-btn { background: none; border: none; color: rgba(255,255,255,.3); font-size: 16px; cursor: pointer; padding: 0 4px; line-height: 1; &:hover { color: #e74c3c; } }
}

.gen-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  .gen-thumb {
    width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px;
    cursor: pointer; border: 2px solid transparent;
    &:hover { border-color: #4a90d9; }
    &.selected { border-color: #4caf50; }
  }
}

// Chat section
.chat-section {
  display: flex;
  gap: 0;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
  min-height: 500px;
  max-height: 70vh;
}

.chat-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.new-conv-btn {
  width: 100%;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(74, 144, 217, 0.15);
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  &:hover { background: rgba(74, 144, 217, 0.3); }
}

.conv-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  &:hover { background: rgba(255, 255, 255, 0.05); }
  &.active { background: rgba(74, 144, 217, 0.2); color: #fff; }
  .conv-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .conv-msg-count {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
  }
  .conv-delete {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
    &:hover { color: #e74c3c; }
  }
}

.conv-empty {
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.4);
  p { margin: 4px 0; }
  .hint { font-size: 12px; color: rgba(255, 255, 255, 0.25); }
}
</style>
