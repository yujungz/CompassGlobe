<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted } from 'vue'
defineOptions({ name: 'FengshuiHome' })
import NavBar from '@/components/common/NavBar.vue'
import { fengshuiHomeApi, type FengshuiHomeRecord } from '@/api/fengshui-home'
import { useAuth } from '@/composables'
import { useGlobalLoading } from '@/composables/useGlobalLoading'

const { startLoading, stopLoading } = useGlobalLoading()

const { user, refreshUser } = useAuth()

const selectedFiles = ref<File[]>([])
const descriptions = ref<string[]>([])
const analyzing = ref(false)
const currentResult = ref<FengshuiHomeRecord | null>(null)
const error = ref('')
const sourceTab = ref<'local' | 'camera' | 'url'>('local')

const history = ref<FengshuiHomeRecord[]>([])
const historyLoading = ref(false)
const detailRecord = ref<FengshuiHomeRecord | null>(null)
const showDetail = ref(false)

// 拍摄
const cameraStream = ref<MediaStream | null>(null)
const cameraVideo = ref<HTMLVideoElement | null>(null)
const cameraActive = ref(false)
const cameraEnabled = ref(false)

// 在线图片
const urlImage = ref('')

onMounted(() => { loadHistory() })
onUnmounted(() => { stopCamera() })

function addFiles(files: File[]) {
  if (selectedFiles.value.length + files.length > 10) {
    error.value = '最多上传 10 张图片'
    return
  }
  selectedFiles.value.push(...files)
  while (descriptions.value.length < selectedFiles.value.length) descriptions.value.push('')
  error.value = ''
}

function onFileChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  addFiles(files)
}

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1)
  descriptions.value.splice(index, 1)
}

function getPreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}

// ===== 拍摄 =====
async function toggleCamera() {
  if (cameraActive.value) { stopCamera(); cameraEnabled.value = false; return }
  cameraEnabled.value = true
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('NOT_SUPPORTED')
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true })
    }
    cameraStream.value = stream
    cameraActive.value = true
    await nextTick()
    if (cameraVideo.value) { cameraVideo.value.srcObject = stream; await cameraVideo.value.play() }
  } catch (e: any) {
    cameraEnabled.value = false
    const msg = e.message || e.name || ''
    if (msg.includes('NotAllowedError') || msg.includes('PermissionDeniedError')) {
      error.value = '摄像头权限被拒绝，请在浏览器设置中允许'
    } else if (location.protocol === 'http:') {
      error.value = '手机浏览器需 HTTPS 才能使用摄像头'
    } else {
      error.value = '无法访问摄像头，请确认已授权或设备存在摄像头'
    }
  }
}

function stopCamera() {
  if (cameraStream.value) { cameraStream.value.getTracks().forEach(t => t.stop()); cameraStream.value = null }
  cameraActive.value = false
}

async function capturePhoto() {
  const video = cameraVideo.value
  if (!video) { error.value = '摄像头未就绪'; return }
  if (!video.videoWidth) { error.value = '视频尚未加载完成'; return }
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth; canvas.height = video.videoHeight
  canvas.getContext('2d')!.drawImage(video, 0, 0)
  canvas.toBlob(async blob => {
    if (!blob) { error.value = '拍照失败'; return }
    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' })
    addFiles([file])
    // 关闭摄像头
    stopCamera()
    cameraEnabled.value = false
    // 聚焦到刚添加的图片说明输入框
    await nextTick()
    const inputs = document.querySelectorAll('.desc-input') as NodeListOf<HTMLInputElement>
    if (inputs.length > 0) {
      const last = inputs[inputs.length - 1]
      last.focus()
      last.placeholder = '请输入图片说明…'
    }
    error.value = ''
  }, 'image/jpeg', 0.9)
}

// ===== 在线图片 =====
async function loadUrlImage() {
  error.value = ''
  const url = urlImage.value.trim()
  if (!url) { error.value = '请输入图片 URL'; return }
  if (!/^https?:\/\/.+\.(png|jpg|jpeg|webp)/i.test(url)) { error.value = 'URL 格式不正确'; return }
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error('HTTP ' + resp.status)
    const blob = await resp.blob()
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const file = new File([blob], `url_${Date.now()}.${ext}`, { type: blob.type })
    addFiles([file])
    urlImage.value = ''
  } catch { error.value = '加载图片失败，请检查 URL 是否可访问' }
}

async function handleAnalyze() {
  if (selectedFiles.value.length === 0) {
    error.value = '请至少选择 1 张图片'
    return
  }
  if (!confirm(`确认使用 ${selectedFiles.value.length} 张图片进行居家风水分析吗？将消耗 1 次咨询次数。`)) return
  error.value = ''
  startLoading('正在进行居家风水分析，请耐心等候…')
  analyzing.value = true
  try {
    const result = await fengshuiHomeApi.analyze(
      selectedFiles.value,
      descriptions.value.slice(0, selectedFiles.value.length),
    )
    currentResult.value = result
    await refreshUser()
    loadHistory()
  } catch (e: any) {
    error.value = e?.response?.data?.error || '分析失败，请稍后重试'
  } finally {
    stopLoading()
    analyzing.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await fengshuiHomeApi.getList(1, 20)
    history.value = res.list
  } catch { /* ignore */ }
  finally { historyLoading.value = false }
}

async function openDetail(record: FengshuiHomeRecord) {
  try {
    detailRecord.value = await fengshuiHomeApi.getDetail(record.id)
    showDetail.value = true
  } catch { /* ignore */ }
}

async function deleteRecord(record: FengshuiHomeRecord) {
  if (!confirm('确定删除该记录吗？')) return
  try {
    await fengshuiHomeApi.delete(record.id)
    history.value = history.value.filter(h => h.id !== record.id)
    if (detailRecord.value?.id === record.id) showDetail.value = false
  } catch { alert('删除失败') }
}

async function downloadPDF(id: string) {
  try {
    const token = localStorage.getItem('token')
    const resp = await fetch(fengshuiHomeApi.getPdfUrl(id), { headers: { Authorization: `Bearer ${token}` } })
    if (!resp.ok) { const err = await resp.json().catch(() => ({ error: '下载失败' })); alert(err.error); return }
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; const ts = new Date().toISOString().replace(/[-:T]/g,'').slice(0,15)
    a.download = `居家风水分析报告_${ts}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  } catch { alert('下载失败') }
}

function reset() {
  selectedFiles.value = []
  descriptions.value = []
  currentResult.value = null
  error.value = ''
}
</script>

<template>
  <div class="fh-page">
    <NavBar />
    <div class="fh-wrap">
      <div class="fh-header">
        <h1 class="title">居家风水</h1>
        <p class="subtitle">上传室内照片，AI 风水顾问为您分析居家布局与优化建议</p>
        <p class="count-info" v-if="user">
          剩余咨询次数：<strong>{{ user.consultCount }}</strong>
        </p>
      </div>

      <!-- Upload area -->
      <section class="card upload-card">
        <h2>上传室内照片</h2>
        <p class="hint">支持 PNG / JPG，最多 10 张，每张不超过 5MB</p>

        <!-- Image source tabs -->
        <div class="source-tabs">
          <button :class="{ active: sourceTab === 'local' }" @click="sourceTab = 'local'; stopCamera()">本地选择</button>
          <button :class="{ active: sourceTab === 'camera' }" @click="sourceTab = 'camera'">拍摄</button>
          <button :class="{ active: sourceTab === 'url' }" @click="sourceTab = 'url'; stopCamera()">在线图片</button>
        </div>

        <!-- File list -->
        <div class="file-list" v-if="selectedFiles.length">
          <div v-for="(file, i) in selectedFiles" :key="i" class="file-item">
            <img :src="getPreviewUrl(file)" alt="预览" class="preview" />
            <div class="file-desc">
              <input v-model="descriptions[i]" class="desc-input" placeholder="图片说明（可选）" maxlength="100" />
            </div>
            <button class="remove-btn" @click="removeFile(i)">×</button>
          </div>
        </div>

        <!-- Local -->
        <label v-if="sourceTab === 'local' && selectedFiles.length < 10" class="add-btn">
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple @change="onFileChange" hidden />
          + 添加图片 ({{ selectedFiles.length }}/10)
        </label>

        <!-- Camera -->
        <div v-if="sourceTab === 'camera'" class="camera-area">
          <video v-if="cameraActive" ref="cameraVideo" class="camera-preview" autoplay playsinline></video>
          <p v-if="!cameraEnabled" class="upload-hint">开启摄像头后预览画面将显示在此处</p>
          <div class="camera-controls">
            <label class="camera-switch">
              <input type="checkbox" :checked="cameraEnabled" @change="toggleCamera" />
              <span>摄像头</span>
            </label>
            <button v-if="cameraActive && selectedFiles.length < 10" class="capture-btn" @click="capturePhoto">📸 拍照</button>
          </div>
        </div>

        <!-- Online URL -->
        <div v-if="sourceTab === 'url' && selectedFiles.length < 10" class="url-area">
          <div class="url-input-row">
            <input v-model="urlImage" class="input" placeholder="输入图片 URL" @keydown.enter="loadUrlImage" />
            <button class="url-load-btn" @click="loadUrlImage">加载</button>
          </div>
        </div>

        <button class="btn-primary" :disabled="analyzing || selectedFiles.length === 0" @click="handleAnalyze">
          {{ analyzing ? '分析中…（约20-60秒）' : '开始风水分析' }}
        </button>

        <p v-if="error" class="error-msg">{{ error }}</p>
      </section>

      <!-- Result -->
      <section class="card result-card" v-if="currentResult?.result?.analysis">
        <h2>分析结果</h2>
        <div class="analysis-text">{{ currentResult.result.analysis }}</div>
        <div class="result-actions">
          <button class="btn-secondary" @click="downloadPDF(currentResult.id)">📥 下载 PDF</button>
          <button class="btn-secondary" @click="reset">重新分析</button>
        </div>
      </section>

      <!-- History -->
      <section class="card history-card">
        <h2>历史记录</h2>
        <div v-if="historyLoading" class="loading">加载中...</div>
        <div v-else-if="history.length === 0" class="empty">暂无居家风水分析记录</div>
        <div v-else class="history-list">
          <div
            v-for="record in history"
            :key="record.id"
            class="history-item"
          >
            <div class="history-info">
              <span class="history-date">{{ new Date(record.createdAt).toLocaleString('zh-CN') }}</span>
              <span class="history-img-count">{{ record.images.length }} 张图片</span>
            </div>
            <div class="history-actions">
              <button class="action-btn" @click="downloadPDF(record.id)">PDF</button>
              <button class="action-btn" @click="openDetail(record)">查看</button>
              <button class="action-btn danger" @click="deleteRecord(record)">删除</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Detail Modal -->
      <div v-if="showDetail && detailRecord" class="modal-overlay" @click.self="showDetail = false">
        <div class="modal-card">
          <div class="modal-head">
            <h3>分析详情</h3>
            <button class="modal-close" aria-label="关闭" @click="showDetail = false">×</button>
          </div>
          <div class="modal-body">
            <div class="detail-images" v-if="detailRecord.images.length">
              <img
                v-for="(img, i) in detailRecord.images"
                :key="i"
                :src="'/api/storage/' + img"
                alt="图片"
                class="detail-img"
              />
            </div>
            <div class="detail-text" v-if="detailRecord.result?.analysis">
              {{ detailRecord.result.analysis }}
            </div>
            <button class="btn-secondary" @click="showDetail = false">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.fh-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.fh-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.fh-header {
  text-align: center;
  margin-bottom: 24px;
  .title { font-size: 26px; margin: 0 0 8px; }
  .subtitle { color: rgba(255,255,255,.55); font-size: 13px; margin: 0 0 8px; }
  .count-info { font-size: 13px; color: rgba(255,255,255,.45); strong { color: #f5a623; } }
}

.card {
  background: rgba(255,255,255,.05);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  h2 { margin: 0 0 12px; font-size: 18px; }
}

.hint { color: rgba(255,255,255,.4); font-size: 12px; margin-bottom: 12px; }

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.file-item {
  display: flex;
  gap: 10px;
  align-items: center;
  background: rgba(0,0,0,.2);
  padding: 8px;
  border-radius: 8px;
  .preview {
    width: 80px; height: 60px; object-fit: cover;
    border-radius: 4px; flex-shrink: 0;
  }
  .file-desc { flex: 1; }
  .desc-input {
    width: 100%; padding: 8px; background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.12); border-radius: 6px;
    color: #fff; font-size: 13px;
    &::placeholder { color: rgba(255,255,255,.3); }
  }
  .remove-btn {
    background: none; border: none; color: rgba(255,255,255,.5);
    font-size: 20px; cursor: pointer; padding: 0 8px;
    &:hover { color: #e74c3c; }
  }
}

.add-btn {
  display: block; padding: 16px; text-align: center;
  border: 2px dashed rgba(255,255,255,.15); border-radius: 8px;
  cursor: pointer; font-size: 14px; color: rgba(255,255,255,.5);
  margin-bottom: 12px; transition: border-color .2s;
  &:hover { border-color: #4a90d9; color: #4a90d9; }
}

.btn-primary {
  width: 100%; padding: 14px; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: #fff; font-size: 16px; font-weight: 500; cursor: pointer;
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(74,144,217,.4); }
  &:disabled { opacity: .6; cursor: not-allowed; }
}

.btn-secondary {
  margin-top: 16px; padding: 10px 24px; border: 1px solid rgba(255,255,255,.2);
  background: transparent; color: #fff; border-radius: 8px;
  font-size: 14px; cursor: pointer; &:hover { background: rgba(255,255,255,.1); }
}

.error-msg {
  margin-top: 12px; padding: 10px; background: rgba(231,76,60,.15);
  border-radius: 8px; color: #ff9f9f; font-size: 13px;
}

.result-actions { display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap; }

.analysis-text {
  white-space: pre-wrap; line-height: 1.8; font-size: 14px;
  color: rgba(255,255,255,.85);
}

.history-list {
  display: flex; flex-direction: column; gap: 8px;
}

.history-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; background: rgba(0,0,0,.15); border-radius: 8px;
  .history-info { display: flex; gap: 12px; font-size: 13px; color: rgba(255,255,255,.6); }
  .history-actions { display: flex; gap: 8px; }
  .action-btn {
    background: none; border: 1px solid rgba(255,255,255,.2); color: rgba(255,255,255,.6);
    padding: 4px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;
    &:hover { border-color: #4a90d9; color: #4a90d9; }
    &.danger:hover { border-color: #e74c3c; color: #e74c3c; }
  }
}

.loading, .empty { text-align: center; padding: 24px; color: rgba(255,255,255,.4); font-size: 14px; }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}

.modal-card {
  background: #1e2a3a; border-radius: 12px; padding: 24px;
  width: 90%; max-width: 640px; max-height: 80vh;
  display: flex; flex-direction: column;

  .modal-head {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px; flex-shrink: 0;
    h3 { margin: 0; }
  }

  .modal-close {
    background: none; border: none; color: rgba(255,255,255,.5);
    font-size: 24px; line-height: 1; cursor: pointer; padding: 0 6px;
    border-radius: 6px;
    &:hover { color: #fff; background: rgba(255,255,255,.1); }
  }

  .modal-body { overflow-y: auto; }
}

.detail-images {
  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
  .detail-img {
    width: 120px; height: 90px; object-fit: cover; border-radius: 6px;
  }
}

.detail-text {
  white-space: pre-wrap; line-height: 1.8; font-size: 14px;
  color: rgba(255,255,255,.85);
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
  margin-bottom: 12px;
  .camera-preview { width: 100%; max-width: 400px; border-radius: 8px; margin-bottom: 8px; }
  .camera-controls { display: flex; align-items: center; justify-content: center; gap: 16px; }
  .camera-switch {
    display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px; color: rgba(255,255,255,.8);
    input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
  }
  .capture-btn {
    padding: 12px 28px; font-size: 16px; border: none; border-radius: 8px;
    background: linear-gradient(135deg, #4a90d9, #357abd); color: #fff; cursor: pointer;
    &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(74,144,217,.4); }
  }
}

.url-area {
  margin-bottom: 12px;
  .url-input-row { display: flex; gap: 8px; }
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
    background: linear-gradient(135deg, #4a90d9, #357abd); color: #fff; cursor: pointer;
    &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(74,144,217,.4); }
  }
}
</style>
