<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
defineOptions({ name: 'Analysis' })
import { useRoute } from 'vue-router'
import NavBar from '@/components/common/NavBar.vue'
import { globeApi, type WeatherInfo } from '@/api/globe'
import { analysisApi, type AnalysisRecord } from '@/api/analysis'
import { getBaguaDirection } from '@/utils/bagua'
import { useGlobalLoading } from '@/composables/useGlobalLoading'

const { startLoading, stopLoading } = useGlobalLoading()

const route = useRoute()

const longitude = parseFloat(route.query.lng as string) || 0
const latitude = parseFloat(route.query.lat as string) || 0
const altitude = ref<number | null>(route.query.alt ? parseFloat(route.query.alt as string) : null)
const address = ref('')
const bagua = computed(() => getBaguaDirection(longitude))
const weather = ref<WeatherInfo | null>(null)
const contextLoading = ref(true)

const analyzing = ref(false)
const result = ref<AnalysisRecord | null>(null)
const errorMsg = ref('')

// 进入页面即拉取完整上下文（海拔 / 天气 / 地址）
onMounted(async () => {
  try {
    const [altRes, weatherRes, locRes] = await Promise.all([
      globeApi.getAltitude(longitude, latitude).catch(() => null),
      globeApi.getWeather(longitude, latitude).catch(() => null),
      globeApi.getLocationInfo(longitude, latitude).catch(() => null),
    ])
    if (altRes && typeof altRes.altitude === 'number') altitude.value = altRes.altitude
    if (locRes?.address) address.value = locRes.address
    if (weatherRes) weather.value = weatherRes
  } finally {
    contextLoading.value = false
  }
})

const handleAnalyze = async () => {
  errorMsg.value = ''

  // 校验：必须选择了位置
  if (!longitude || !latitude || (longitude === 0 && latitude === 0)) {
    errorMsg.value = '请先在地球仪上点击选择分析位置'
    return
  }

  if (!confirm('确认使用当前位置进行风水分析吗？将消耗 1 次咨询次数。')) return

  startLoading('正在进行地理风水分析，请耐心等候…')
  analyzing.value = true
  try {
    result.value = await analysisApi.analyze({
      longitude,
      latitude,
      altitude: altitude.value,
      address: address.value || undefined,
      weather: weather.value || undefined,
      bagua: bagua.value,
    })
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } } }
    errorMsg.value = err?.response?.data?.error || '分析失败，请稍后重试'
  } finally {
    stopLoading()
    analyzing.value = false
  }
}

// 从结果文本提取综合评分（0-100）
const score = computed(() => {
  const content = result.value?.result?.content || ''
  const m = content.match(/综合评分[^\d]*?(\d{1,3})/)
  const n = m ? parseInt(m[1]) : null
  return n != null && n >= 0 && n <= 100 ? n : null
})

// 历史记录
const history = ref<AnalysisRecord[]>([])
const historyLoading = ref(false)
const historyTotal = ref(0)
const historyPage = ref(1)

onMounted(async () => {
  loadHistory()
})

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await analysisApi.getList(historyPage.value, 10)
    history.value = res.list as unknown as AnalysisRecord[]
    historyTotal.value = res.total
  } catch { /* ignore */ }
  finally { historyLoading.value = false }
}

async function deleteRecord(id: string) {
  if (!confirm('确定删除该记录吗？')) return
  try {
    await analysisApi.remove(id)
    history.value = history.value.filter(h => h.id !== id)
  } catch { alert('删除失败') }
}

async function viewRecord(record: AnalysisRecord) {
  result.value = record
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function formatDate(d: string) { return new Date(d).toLocaleString('zh-CN') }
</script>

<template>
  <div class="analysis-page">
    <NavBar />
    <div class="analysis-wrap">
      <div class="analysis-header">
        <h1 class="title">地理分析</h1>
        <p class="subtitle">基于位置、海拔、天气与八卦方位的 AI 风水分析</p>
      </div>

      <!-- 上下文卡片 -->
      <section class="card">
        <h3 class="card-title">分析位置</h3>
        <div v-if="contextLoading" class="loading">正在获取地理信息…</div>
        <template v-else>
          <div class="info-grid">
            <div class="info-item"><span class="label">经度</span><span class="value">{{ longitude.toFixed(6) }}°</span></div>
            <div class="info-item"><span class="label">纬度</span><span class="value">{{ latitude.toFixed(6) }}°</span></div>
            <div class="info-item"><span class="label">海拔</span><span class="value">{{ altitude == null ? '—' : altitude.toFixed(2) + ' m' }}</span></div>
            <div class="info-item"><span class="label">八卦方位</span><span class="value">{{ bagua }}</span></div>
          </div>
          <div v-if="address" class="info-item info-item--full"><span class="label">地址</span><span class="value">{{ address }}</span></div>
          <div v-if="weather" class="weather">
            <span class="weather-main">{{ weather.weather }} · {{ weather.temperature }}°C</span>
            <span class="weather-sub">湿度 {{ weather.humidity }}% · {{ weather.windDirection }} {{ weather.windSpeed }} km/h</span>
          </div>
        </template>
      </section>

      <!-- 分析按钮 -->
      <button class="analyze-btn" :disabled="analyzing || contextLoading" @click="handleAnalyze">
        {{ analyzing ? '分析中…' : (result ? '重新分析' : '开始风水分析') }}
      </button>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

      <!-- 结果卡片 -->
      <section v-if="result?.result?.content" class="card result">
        <div class="result-head">
          <h3 class="card-title">分析结果</h3>
          <span v-if="score != null" class="score">综合评分 {{ score }}</span>
        </div>
        <div class="result-content">{{ result.result.content }}</div>
        <p v-if="result.result.generatedAt" class="result-meta">
          生成于 {{ new Date(result.result.generatedAt).toLocaleString() }}
        </p>
      </section>

      <!-- 历史记录 -->
      <section class="card history-card">
        <h2>历史记录</h2>
        <div v-if="historyLoading" class="loading">加载中...</div>
        <div v-else-if="history.length === 0" class="empty">暂无地理分析记录</div>
        <div v-else class="history-list">
          <div v-for="record in history" :key="record.id" class="history-item">
            <div class="history-info">
              <span class="history-addr">{{ record.address || `${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)}` }}</span>
              <span class="history-date">{{ formatDate(record.createdAt as any) }}</span>
            </div>
            <div class="history-actions">
              <button class="action-btn" @click="viewRecord(record)">查看</button>
              <button class="action-btn danger" @click="deleteRecord(record.id)">删除</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.analysis-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.analysis-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.analysis-header {
  text-align: center;
  margin-bottom: 24px;

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

.card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px;
  color: rgba(255, 255, 255, 0.85);
}

.loading {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  text-align: center;
  padding: 16px 0;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;

  .label {
    color: rgba(255, 255, 255, 0.55);
    font-size: 13px;
  }
  .value {
    font-size: 14px;
    font-weight: 500;
  }

  &--full {
    margin-top: 10px;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}

.weather {
  margin-top: 12px;
  padding: 12px;
  background: rgba(74, 144, 217, 0.12);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .weather-main {
    font-size: 16px;
    font-weight: 600;
    color: #4a90d9;
  }
  .weather-sub {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
  }
}

.analyze-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

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
  margin: 12px 0;
  padding: 12px;
  background: rgba(231, 76, 60, 0.15);
  border-radius: 8px;
  color: #ff9f9f;
  font-size: 14px;
  text-align: center;
}

.result {
  .result-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .card-title {
      margin: 0;
    }
  }

  .score {
    padding: 4px 12px;
    background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
  }

  .result-content {
    white-space: pre-wrap;
    line-height: 1.8;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.88);
  }

  .result-meta {
    margin: 16px 0 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    text-align: right;
  }
}

.history-card {
  h2 { margin: 0 0 12px; font-size: 18px; }
}
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; background: rgba(0,0,0,.15); border-radius: 8px;
  .history-info { display: flex; gap: 12px; font-size: 13px; align-items: center; }
  .history-addr { color: rgba(255,255,255,.7); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .history-date { color: rgba(255,255,255,.4); white-space: nowrap; }
  .history-actions { display: flex; gap: 8px; }
  .action-btn {
    background: none; border: 1px solid rgba(255,255,255,.2); color: rgba(255,255,255,.6);
    padding: 4px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;
    &:hover { border-color: #4a90d9; color: #4a90d9; }
    &.danger:hover { border-color: #e74c3c; color: #e74c3c; }
  }
}
.empty { text-align: center; padding: 24px; color: rgba(255,255,255,.4); font-size: 14px; }

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
