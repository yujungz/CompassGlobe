<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import NavBar from '@/components/common/NavBar.vue'
import { fortuneApi, type BaZiResult, type FortuneResult, type FortuneRecordItem } from '@/api/fortune'
import { authApi } from '@/api/auth'
import { useAuth } from '@/composables'

const { user, refreshUser } = useAuth()

// Form
const form = ref({
  name: '',
  gender: 'male',
  birthYear: null as number | null,
  birthMonth: null as number | null,
  birthDay: null as number | null,
  birthHour: 12,
  isLunar: false,
  birthAddress: '',
  company: '',
  industry: '',
  profession: '',
  remark: '',
})

const predicting = ref(false)
const currentResult = ref<FortuneResult | null>(null)
const baziResult = ref<BaZiResult | null>(null)
const error = ref('')

// History
const history = ref<FortuneRecordItem[]>([])
const historyLoading = ref(false)

onMounted(async () => {
  // Pre-fill from user profile
  try {
    const profile = await authApi.getCurrentUser()
    form.value.name = profile.realName || profile.nickname || user.value?.username || ''
    form.value.gender = profile.gender || 'male'
    if (profile.birthYear) form.value.birthYear = profile.birthYear
    if (profile.birthMonth) form.value.birthMonth = profile.birthMonth
    if (profile.birthDay) form.value.birthDay = profile.birthDay
    if (profile.birthHour !== null) form.value.birthHour = profile.birthHour
    form.value.birthAddress = profile.birthAddress || ''
    form.value.company = profile.company || ''
    form.value.industry = profile.industry || ''
    form.value.profession = profile.profession || ''
  } catch { /* ignore */ }
  loadHistory()
})

const genderOptions = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
]

async function calculateBaZi() {
  if (!form.value.birthYear || !form.value.birthMonth || !form.value.birthDay) {
    error.value = '请填写完整的出生日期'
    return
  }
  error.value = ''
  try {
    baziResult.value = await fortuneApi.calculateBaZi({
      birthYear: form.value.birthYear,
      birthMonth: form.value.birthMonth,
      birthDay: form.value.birthDay,
      birthHour: form.value.birthHour || 0,
      isLunar: form.value.isLunar,
      gender: form.value.gender,
    })
  } catch (e: any) {
    error.value = e?.response?.data?.error || '计算失败'
  }
}

async function handlePredict() {
  if (!form.value.name || !form.value.name.trim()) {
    error.value = '请填写姓名'
    return
  }
  if (!form.value.gender) {
    error.value = '请选择性别'
    return
  }
  if (!form.value.birthYear || !form.value.birthMonth || !form.value.birthDay) {
    error.value = '请填写完整的出生日期'
    return
  }
  if (!confirm('确认进行流年大运分析吗？将消耗 1 次咨询次数。')) return
  error.value = ''
  predicting.value = true
  try {
    currentResult.value = await fortuneApi.predict({
      name: form.value.name,
      gender: form.value.gender,
      birthYear: form.value.birthYear,
      birthMonth: form.value.birthMonth,
      birthDay: form.value.birthDay,
      birthHour: form.value.birthHour || 0,
      isLunar: form.value.isLunar,
      birthAddress: form.value.birthAddress || undefined,
      company: form.value.company || undefined,
      industry: form.value.industry || undefined,
      profession: form.value.profession || undefined,
      remark: form.value.remark || undefined,
    })
    baziResult.value = currentResult.value
    await refreshUser()
    loadHistory()
  } catch (e: any) {
    error.value = e?.response?.data?.error || '预测失败，请稍后重试'
  } finally {
    predicting.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await fortuneApi.getList(1, 20)
    history.value = res.list
  } catch { /* ignore */ }
  finally { historyLoading.value = false }
}

async function deleteRecord(record: FortuneRecordItem) {
  if (!confirm('确定删除该记录吗？')) return
  try {
    await fortuneApi.delete(record.id)
    history.value = history.value.filter(h => h.id !== record.id)
  } catch { alert('删除失败') }
}

async function downloadPdf(id: string) {
  try {
    const token = localStorage.getItem('token')
    const resp = await fetch(fortuneApi.getPdfUrl(id), {
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
    a.download = `流年大运分析_${id.slice(0, 8)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    alert('下载失败，请重试')
  }
}

function reset() {
  currentResult.value = null
  baziResult.value = null
  error.value = ''
}
</script>

<template>
  <div class="fortune-page">
    <NavBar />
    <div class="fortune-wrap">
      <div class="fortune-header">
        <h1 class="title">流年大运</h1>
        <p class="subtitle">结合八字命理，AI 为您详解流年运势</p>
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
              <option v-for="g in genderOptions" :key="g.value" :value="g.value">{{ g.label }}</option>
            </select>
          </div>
        </div>

        <div class="form-item" style="margin-top:8px">
          <label>出生地址</label>
          <input v-model="form.birthAddress" class="input" placeholder="出生地址" />
        </div>

        <div class="calendar-toggle">
          <button :class="{ active: !form.isLunar }" @click="form.isLunar = false">公历</button>
          <button :class="{ active: form.isLunar }" @click="form.isLunar = true">农历</button>
        </div>

        <div class="form-row-4">
          <div class="form-item">
            <label>年</label>
            <input v-model.number="form.birthYear" type="number" class="input" placeholder="1990" min="1900" max="2100" />
          </div>
          <div class="form-item">
            <label>月</label>
            <input v-model.number="form.birthMonth" type="number" class="input" placeholder="1" min="1" max="12" />
          </div>
          <div class="form-item">
            <label>日</label>
            <input v-model.number="form.birthDay" type="number" class="input" placeholder="1" min="1" max="31" />
          </div>
          <div class="form-item">
            <label>时</label>
            <input v-model.number="form.birthHour" type="number" class="input" placeholder="12" min="0" max="23" />
          </div>
        </div>

        <button class="btn-secondary" @click="calculateBaZi" :disabled="!form.birthYear">查看八字 / 生肖 / 星座</button>

        <!-- BaZi Display -->
        <div v-if="baziResult" class="bazi-display">
          <div class="bazi-pillars">
            <div class="pillar"><span class="pillar-label">年柱</span><span class="pillar-val">{{ baziResult.baZi.yearPillar }}</span></div>
            <div class="pillar"><span class="pillar-label">月柱</span><span class="pillar-val">{{ baziResult.baZi.monthPillar }}</span></div>
            <div class="pillar"><span class="pillar-label">日柱</span><span class="pillar-val">{{ baziResult.baZi.dayPillar }}</span></div>
            <div class="pillar"><span class="pillar-label">时柱</span><span class="pillar-val">{{ baziResult.baZi.timePillar }}</span></div>
          </div>
          <div class="bazi-extra">
            <span>🐲 生肖：{{ baziResult.zodiac }}</span>
            <span>♈ 星座：{{ baziResult.constellation }}</span>
            <span>📅 预测：{{ baziResult.predictYear }}年</span>
          </div>
          <div class="bazi-extra" v-if="baziResult.daYun">
            <span>🔮 {{ baziResult.daYun.startAge }}岁起运（{{ baziResult.daYun.forward ? '顺行' : '逆行' }}）</span>
            <span v-if="baziResult.daYun.currentDaYun">
              当前大运：{{ baziResult.daYun.currentDaYun.stemBranch }}
            </span>
          </div>
        </div>

        <h3 style="margin-top:16px">补充信息（可选，越详细分析越精确）</h3>
        <div class="form-grid">
          <div class="form-item">
            <label>所在公司</label>
            <input v-model="form.company" class="input" placeholder="所在公司" />
          </div>
          <div class="form-item">
            <label>所属行业</label>
            <input v-model="form.industry" class="input" placeholder="行业" />
          </div>
          <div class="form-item">
            <label>职业</label>
            <input v-model="form.profession" class="input" placeholder="职业" />
          </div>
        </div>
        <div class="form-item" style="margin-top:8px">
          <label>备注</label>
          <textarea v-model="form.remark" class="input textarea" rows="3" placeholder="其他需要说明的信息..."></textarea>
        </div>

        <button class="btn-primary" :disabled="predicting || !form.name" @click="handlePredict" style="margin-top:16px">
          {{ predicting ? '预测中…（约20-60秒）' : '开始预测' }}
        </button>
        <p v-if="error" class="error-msg">{{ error }}</p>
      </section>

      <!-- Result -->
      <section class="card result-card" v-if="currentResult?.result?.analysis">
        <h2>预测结果</h2>
        <div class="analysis-text">{{ currentResult.result.analysis }}</div>
        <div class="result-actions">
          <button class="btn-secondary" @click="downloadPdf(currentResult.id)">📥 下载 PDF</button>
          <button class="btn-secondary" @click="reset">重新预测</button>
        </div>
      </section>

      <!-- History -->
      <section class="card history-card">
        <h2>历史记录</h2>
        <div v-if="historyLoading" class="loading">加载中...</div>
        <div v-else-if="history.length === 0" class="empty">暂无流年大运分析记录</div>
        <div v-else class="history-list">
          <div v-for="record in history" :key="record.id" class="history-item">
            <div class="history-info">
              <span>{{ record.name }}</span>
              <span>{{ record.predictYear }}年</span>
              <span class="history-date">{{ new Date(record.createdAt).toLocaleString('zh-CN') }}</span>
            </div>
            <div class="history-actions">
              <button class="action-btn" @click="downloadPdf(record.id)">PDF</button>
              <button class="action-btn danger" @click="deleteRecord(record)">删除</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.fortune-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}
.fortune-wrap {
  max-width: 720px; margin: 0 auto; padding: 24px 16px 48px;
}
.fortune-header { text-align: center; margin-bottom: 24px;
  .title { font-size: 26px; margin: 0 0 8px; }
  .subtitle { color: rgba(255,255,255,.55); font-size: 13px; margin: 0 0 8px; }
  .count-info { font-size: 13px; color: rgba(255,255,255,.45); strong { color: #f5a623; } }
}
.card {
  background: rgba(255,255,255,.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;
  h2 { margin: 0 0 12px; font-size: 18px; }
  h3 { font-size: 14px; color: rgba(255,255,255,.6); }
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-row-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
.form-item { display: flex; flex-direction: column; gap: 4px;
  label { font-size: 12px; color: rgba(255,255,255,.5); }
}
.input {
  padding: 10px 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  border-radius: 6px; color: #fff; font-size: 14px;
  &:focus { outline: none; border-color: #4a90d9; }
}
.textarea { resize: vertical; font-family: inherit; }
.calendar-toggle {
  display: flex; gap: 4px; margin: 12px 0;
  background: rgba(255,255,255,.05); border-radius: 6px; padding: 3px;
  button {
    flex: 1; padding: 8px; border: none; background: transparent;
    color: rgba(255,255,255,.5); border-radius: 4px; cursor: pointer; font-size: 13px;
    &.active { background: rgba(74,144,217,.2); color: #fff; }
  }
}
.bazi-display {
  margin-top: 12px; padding: 12px; background: rgba(0,0,0,.2); border-radius: 8px;
  .bazi-pillars { display: flex; gap: 8px; margin-bottom: 8px; }
  .pillar {
    flex: 1; text-align: center; background: rgba(74,144,217,.15); border-radius: 6px; padding: 8px 4px;
    .pillar-label { display: block; font-size: 11px; color: rgba(255,255,255,.5); margin-bottom: 4px; }
    .pillar-val { font-size: 15px; font-weight: 600; }
  }
  .bazi-extra { display: flex; gap: 16px; font-size: 13px; color: rgba(255,255,255,.7); }
}
.btn-primary {
  width: 100%; padding: 14px; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: #fff; font-size: 16px; font-weight: 500; cursor: pointer;
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(74,144,217,.4); }
  &:disabled { opacity: .6; cursor: not-allowed; }
}
.btn-secondary {
  padding: 10px 20px; border: 1px solid rgba(255,255,255,.2);
  background: transparent; color: #fff; border-radius: 8px;
  font-size: 14px; cursor: pointer; &:hover { background: rgba(255,255,255,.1); }
}
.error-msg { margin-top: 12px; padding: 10px; background: rgba(231,76,60,.15); border-radius: 8px; color: #ff9f9f; font-size: 13px; }
.analysis-text { white-space: pre-wrap; line-height: 1.8; font-size: 14px; color: rgba(255,255,255,.85); }
.result-actions { display: flex; gap: 12px; margin-top: 16px; }
.history-list { display: flex; flex-direction: column; gap: 8px; }
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
</style>
