<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import NavBar from '@/components/common/NavBar.vue'
defineOptions({ name: 'Divination' })
import { divinationApi, type HexagramResult, type DivinationAskResult, type DivinationRecordItem } from '@/api/divination'
import { authApi } from '@/api/auth'
import { useGlobalLoading } from '@/composables/useGlobalLoading'

const { startLoading, stopLoading } = useGlobalLoading()
import { useAuth } from '@/composables'

const { user, refreshUser } = useAuth()

// Form
const form = ref({ name: '', gender: 'male', question: '' })
const asking = ref(false)
const error = ref('')
const tossCompleted = ref(false) // 起卦是否完成
const currentRecordId = ref<string | null>(null) // 起卦时保存的记录ID

// Coin animation
const tossing = ref(false)
const tossCountdown = ref(0)
const coins = ref([0, 0, 0])
const tossRound = ref(0)
const tossResults = ref<number[]>([])

// Hexagram
const hexagram = ref<HexagramResult | null>(null)
const showHexagram = ref(false)

// Result
const currentResult = ref<DivinationAskResult | null>(null)

// DOM refs
const tossBtnRef = ref<HTMLElement | null>(null)
const askBtnRef = ref<HTMLElement | null>(null)

// History
const history = ref<DivinationRecordItem[]>([])

onMounted(async () => {
  try {
    const profile = await authApi.getCurrentUser()
    form.value.name = profile.realName || profile.nickname || user.value?.username || ''
    form.value.gender = profile.gender || 'male'
  } catch { /* ignore */ }
  loadHistory()
})

async function startToss() {
  if (!form.value.name || !form.value.name.trim()) {
    error.value = '请填写姓名'
    return
  }
  if (!form.value.gender) {
    error.value = '请选择性别'
    return
  }
  if (!form.value.question.trim()) {
    error.value = '请填写所问之事'
    return
  }
  if (form.value.question.trim().length < 2) {
    error.value = '所问之事未描述清楚！'
    return
  }
  if (!confirm('确认开始起卦吗？请摒除杂念，集中注意力默想所求之事。')) return
  error.value = ''
  tossResults.value = []
  tossing.value = true
  tossRound.value = 0
  showHexagram.value = false
  hexagram.value = null
  currentResult.value = null
  tossCompleted.value = false
  currentRecordId.value = null

  try {
    // Call API to generate hexagram (保存记录)
    const result = await divinationApi.generateHexagram({
      name: form.value.name,
      gender: form.value.gender,
      question: form.value.question.trim(),
    })
    if (result.recordId) currentRecordId.value = result.recordId

    // Animate 6 rounds of coin toss
    for (let i = 0; i < 6; i++) {
      tossRound.value = i + 1
      tossCountdown.value = 2

      // Animate coins spinning
      const interval = setInterval(() => {
        coins.value = [
          Math.random() < 0.5 ? 2 : 3,
          Math.random() < 0.5 ? 2 : 3,
          Math.random() < 0.5 ? 2 : 3,
        ]
      }, 100)

      await delay(2000) // 2 seconds per toss
      clearInterval(interval)
      tossCountdown.value = 0

      // Show result
      tossResults.value.push(i)
    }

    // Show hexagram
    hexagram.value = result
    showHexagram.value = true
    tossCompleted.value = true
    // 焦点移到 AI解卦 按钮
    await nextTick()
    askBtnRef.value?.focus()
    // 刷新历史
    loadHistory()
  } catch (e: any) {
    error.value = '起卦失败，请重试'
  } finally {
    tossing.value = false
  }
}

function resetToss() {
  tossCompleted.value = false
  hexagram.value = null
  showHexagram.value = false
  currentResult.value = null
  tossResults.value = []
  currentRecordId.value = null
  error.value = ''
  // 焦点移回开始起卦
  nextTick(() => tossBtnRef.value?.focus())
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function handleAsk() {
  if (!hexagram.value) return
  if (!confirm('确认进行 AI 解卦吗？将消耗 1 次咨询次数。')) return

  error.value = ''
  startLoading('AI 正在解读卦象，请耐心等候…（约 20-60 秒）')
  asking.value = true
  try {
    const result = await divinationApi.ask({
      name: form.value.name,
      gender: form.value.gender,
      question: form.value.question.trim(),
      hexagram: hexagram.value,
      recordId: currentRecordId.value || undefined,
    })
    currentResult.value = result
    await refreshUser()
    loadHistory()
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'AI 解读失败'
  } finally {
    stopLoading()
    asking.value = false
  }
}

async function loadHistory() {
  try {
    const res = await divinationApi.getList(1, 20)
    history.value = res.list
  } catch { /* ignore */ }
}

async function loadHistoryRecord(record: DivinationRecordItem) {
  form.value.name = record.name
  form.value.gender = record.gender
  form.value.question = record.question
  hexagram.value = record.hexagram
  showHexagram.value = true
  tossCompleted.value = true
  currentRecordId.value = record.id
  tossResults.value = [0,1,2,3,4,5]
  if (record.result?.analysis) {
    currentResult.value = { id: record.id, hexagram: record.hexagram, result: record.result, createdAt: record.createdAt }
  } else {
    currentResult.value = null
  }
  await nextTick()
  askBtnRef.value?.focus()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function deleteRecord(record: DivinationRecordItem) {
  if (!confirm('确定删除该记录吗？')) return
  try {
    await divinationApi.delete(record.id)
    history.value = history.value.filter(h => h.id !== record.id)
  } catch { alert('删除失败') }
}

async function downloadPdf(id: string) {
  try {
    const token = localStorage.getItem('token')
    const resp = await fetch(divinationApi.getPdfUrl(id), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: '下载失败' }))
      alert(err.error || '下载失败')
      return
    }
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().replace(/[-:T]/g,'').slice(0,15)
    a.download = `八卦问事分析_${ts}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    alert('下载失败，请重试')
  }
}

function coinSumText(sum: number): string {
  if (sum === 6) return '老阴 ▅▅  ▅▅ ×'
  if (sum === 7) return '少阳 ▅▅▅▅▅▅'
  if (sum === 8) return '少阴 ▅▅  ▅▅'
  if (sum === 9) return '老阳 ▅▅▅▅▅▅ ○'
  return ''
}

function lineName(index: number): string {
  const names = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']
  return names[index] || ''
}

function changingLineClass(index: number): string {
  if (!hexagram.value) return ''
  return hexagram.value.changingLines.includes(index + 1) ? 'changing' : ''
}
</script>

<template>
  <div class="divination-page">
    <NavBar />
    <div class="divination-wrap">
      <div class="divination-header">
        <h1 class="title">八卦问事</h1>
        <p class="subtitle">摒除杂念，集中注意力默想所问之事，然后起卦</p>
        <p class="count-info" v-if="user">剩余咨询次数：<strong>{{ user.consultCount }}</strong></p>
      </div>

      <!-- Form -->
      <section class="card">
        <h2>基本信息</h2>
        <div class="form-grid">
          <div class="form-item">
            <label>姓名</label>
            <input v-model="form.name" class="input" placeholder="姓名" />
          </div>
          <div class="form-item">
            <label>性别</label>
            <select v-model="form.gender" class="input">
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>
        </div>
        <div class="form-item" style="margin-top:8px">
          <label>所问之事</label>
          <textarea v-model="form.question" class="input textarea" rows="4"
            placeholder="请集中注意力，默想你所求之事，然后在此写下你的问题..."></textarea>
        </div>
      </section>

      <!-- Coin Toss Area -->
      <section class="card toss-card">
        <h2>起卦</h2>
        <p class="hint">点击下方按钮，系统将模拟三枚铜钱摇卦六次，生成卦象</p>

        <!-- Coin Animation -->
        <div v-if="tossing" class="coin-animation">
          <div class="coins">
            <div v-for="(coin, i) in coins" :key="i" :class="['coin', 'spinning']">
              {{ coin }}
            </div>
          </div>
          <p class="toss-info">第 {{ tossRound }} / 6 次摇卦</p>
          <p class="toss-countdown">{{ tossCountdown > 0 ? '...' : '✓' }}</p>
        </div>

        <!-- Line Results -->
        <div v-if="tossResults.length" class="lines-display">
          <div v-for="(_, i) in tossResults" :key="i" :class="['line-item', changingLineClass(5 - i)]">
            <span class="line-name">{{ lineName(5 - i) }}</span>
            <span class="line-val">{{ coinSumText([6,7,8,9][Math.floor(Math.random() * 4)]) }}</span>
          </div>
        </div>

        <button ref="tossBtnRef" class="btn-primary" :disabled="tossing || asking || tossCompleted" @click="startToss">
          {{ tossing ? '起卦中...' : '🎯 开始起卦' }}
        </button>
      </section>

      <!-- Hexagram Display -->
      <section v-if="showHexagram && hexagram" class="card hexagram-card">
        <h2>卦象排盘</h2>
        <div class="hexagram-display">
          <div class="hexagram-main">
            <span class="hexagram-symbol">{{ hexagram.originalSymbol }}</span>
            <div>
              <h3>本卦：{{ hexagram.originalName }}</h3>
              <p class="gua-ci">"{{ hexagram.originalGuaCi }}"</p>
            </div>
          </div>

          <div v-if="hexagram.changingLines.length > 0" class="changing-info">
            <p><strong>变爻：</strong>第{{ hexagram.changingLines.map(l => `${l}爻`).join('、') }}</p>
            <div v-for="(yao, i) in hexagram.yaoCi" :key="i" class="yao-ci">
              <p>{{ yao }}</p>
            </div>
          </div>
          <div v-else class="changing-info">
            <p><strong>静卦</strong> — 无变爻，以本卦卦辞为断</p>
          </div>

          <div v-if="hexagram.changedName" class="hexagram-changed">
            <span class="hexagram-symbol">{{ hexagram.changedSymbol }}</span>
            <strong>变卦：{{ hexagram.changedName }}</strong>
          </div>
        </div>

        <div class="hexagram-actions" style="margin-top:12px;display:flex;gap:12px">
          <button ref="askBtnRef" class="btn-primary" :disabled="asking" @click="handleAsk">
            {{ asking ? 'AI 解读中…（约20-60秒）' : '🔮 AI 解卦' }}
          </button>
          <button class="btn-secondary" @click="resetToss">🔄 重新起卦</button>
        </div>
      </section>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <!-- Result -->
      <section v-if="currentResult?.result?.analysis" class="card result-card">
        <h2>解卦结果</h2>
        <div class="analysis-text">{{ currentResult.result.analysis }}</div>
        <div class="result-actions">
          <button class="btn-secondary" @click="downloadPdf(currentResult.id)">📥 下载 PDF</button>
        </div>
      </section>

      <!-- History -->
      <section class="card history-card">
        <h2>历史记录</h2>
        <div v-if="history.length === 0" class="empty">暂无八卦问事记录</div>
        <div v-else class="history-list">
          <div v-for="record in history" :key="record.id" class="history-item">
            <div class="history-info">
              <span>{{ record.name }}</span>
              <span class="history-q">{{ record.question.slice(0, 20) }}...</span>
              <span class="history-date">{{ new Date(record.createdAt).toLocaleString('zh-CN') }}</span>
            </div>
            <div class="history-actions">
              <button class="action-btn" @click="loadHistoryRecord(record)">读取</button>
              <button v-if="record.result?.analysis" class="action-btn" @click="downloadPdf(record.id)">PDF</button>
              <button class="action-btn danger" @click="deleteRecord(record)">删除</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.divination-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}
.divination-wrap {
  max-width: 720px; margin: 0 auto; padding: 24px 16px 48px;
}
.divination-header { text-align: center; margin-bottom: 24px;
  .title { font-size: 26px; margin: 0 0 8px; }
  .subtitle { color: rgba(255,255,255,.55); font-size: 13px; margin: 0 0 8px; }
  .count-info { font-size: 13px; color: rgba(255,255,255,.45); strong { color: #f5a623; } }
}
.card {
  background: rgba(255,255,255,.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;
  h2 { margin: 0 0 12px; font-size: 18px; }
}
.hint { color: rgba(255,255,255,.4); font-size: 13px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-item { display: flex; flex-direction: column; gap: 4px;
  label { font-size: 12px; color: rgba(255,255,255,.5); }
}
.input {
  padding: 10px 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  border-radius: 6px; color: #fff; font-size: 14px;
  &:focus { outline: none; border-color: #4a90d9; }
}
.textarea { resize: vertical; font-family: inherit; }

// Coin Animation
.coin-animation {
  display: flex; flex-direction: column; align-items: center;
  padding: 24px; margin: 12px 0;
  .coins { display: flex; gap: 16px; }
  .coin {
    width: 60px; height: 60px; border-radius: 50%;
    background: linear-gradient(135deg, #f5d76e, #e6b422);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 700; color: #997a00;
    box-shadow: 0 4px 12px rgba(245,215,110,.3);
    &.spinning { animation: spin 0.5s ease-in-out infinite; }
  }
  .toss-info { font-size: 14px; margin-top: 12px; color: rgba(255,255,255,.6); }
  .toss-countdown { font-size: 18px; color: #4a90d9; }
}

@keyframes spin {
  0%, 100% { transform: rotateY(0deg); }
  50% { transform: rotateY(180deg); }
}

.lines-display {
  margin: 12px 0;
  .line-item {
    display: flex; gap: 12px; padding: 6px 0; align-items: center;
    font-size: 14px; border-bottom: 1px solid rgba(255,255,255,.06);
    &.changing { color: #e6b422; font-weight: 600; }
    .line-name { width: 40px; color: rgba(255,255,255,.5); font-size: 12px; }
  }
}

// Hexagram
.hexagram-display {
  background: rgba(0,0,0,.2); border-radius: 8px; padding: 16px;
  .hexagram-main { display: flex; gap: 16px; align-items: center; margin-bottom: 12px;
    .hexagram-symbol { font-size: 48px; }
  }
  .gua-ci { color: rgba(255,255,255,.7); font-style: italic; margin-top: 4px; }
  .changing-info { margin: 8px 0; font-size: 14px; }
  .yao-ci { padding-left: 12px; color: #e6b422; font-size: 13px; }
  .hexagram-changed { display: flex; gap: 12px; align-items: center;
    margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.1);
    .hexagram-symbol { font-size: 36px; }
  }
}

.btn-primary {
  width: 100%; padding: 14px; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; margin-top: 8px;
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(74,144,217,.4); }
  &:disabled { opacity: .6; cursor: not-allowed; }
}
.btn-secondary {
  padding: 10px 20px; border: 1px solid rgba(255,255,255,.2);
  background: transparent; color: #fff; border-radius: 8px;
  font-size: 14px; cursor: pointer; &:hover { background: rgba(255,255,255,.1); }
}
.error-msg { padding: 12px; background: rgba(231,76,60,.15); border-radius: 8px; color: #ff9f9f; font-size: 13px; margin-bottom: 12px; }
.analysis-text { white-space: pre-wrap; line-height: 1.8; font-size: 14px; color: rgba(255,255,255,.85); }
.result-actions { display: flex; gap: 12px; margin-top: 16px; }
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; background: rgba(0,0,0,.15); border-radius: 8px;
  .history-info { display: flex; gap: 10px; font-size: 13px; color: rgba(255,255,255,.6); }
  .history-q { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .history-actions { display: flex; gap: 8px; }
  .action-btn {
    background: none; border: 1px solid rgba(255,255,255,.2); color: rgba(255,255,255,.6);
    padding: 4px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;
    &:hover { border-color: #4a90d9; color: #4a90d9; }
    &.danger:hover { border-color: #e74c3c; color: #e74c3c; }
  }
}
.empty { text-align: center; padding: 24px; color: rgba(255,255,255,.4); font-size: 14px; }
</style>
