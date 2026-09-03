<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
defineOptions({ name: 'Analysis' })
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/common/NavBar.vue'
import { globeApi, type WeatherInfo } from '@/api/globe'
import { analysisApi, type AnalysisRecord } from '@/api/analysis'
import { getBaguaDirection } from '@/utils/bagua'
import { useGlobalLoading } from '@/composables/useGlobalLoading'

const { startLoading, stopLoading } = useGlobalLoading()

const route = useRoute()
const router = useRouter()

const queryNum = (v: unknown): number => {
  const s = Array.isArray(v) ? v[0] : v
  return (typeof s === 'string' ? parseFloat(s) : NaN) || 0
}

const longitude = ref(queryNum(route.query.lng))
const latitude = ref(queryNum(route.query.lat))
const altitude = ref<number | null>(route.query.alt ? queryNum(route.query.alt) : null)
const address = ref('')
const bagua = computed(() => getBaguaDirection(longitude.value))
const weather = ref<WeatherInfo | null>(null)
const contextLoading = ref(true)

const analyzing = ref(false)
const result = ref<AnalysisRecord | null>(null)
const errorMsg = ref('')
// 错误是否为「未选择位置」——此时点击提示可返回首页
const errorNeedsLocation = ref(false)

const hasLocation = () => longitude.value !== 0 && latitude.value !== 0

// 拉取完整上下文（海拔 / 天气 / 地址）
async function loadContext() {
  if (!hasLocation()) {
    contextLoading.value = false
    return
  }
  contextLoading.value = true
  try {
    const [altRes, weatherRes, locRes] = await Promise.all([
      globeApi.getAltitude(longitude.value, latitude.value).catch(() => null),
      globeApi.getWeather(longitude.value, latitude.value).catch(() => null),
      globeApi.getLocationInfo(longitude.value, latitude.value).catch(() => null),
    ])
    if (altRes && typeof altRes.altitude === 'number') altitude.value = altRes.altitude
    if (locRes?.address) address.value = locRes.address
    if (weatherRes) weather.value = weatherRes
  } finally {
    contextLoading.value = false
  }
}

onMounted(loadContext)

// 页面被 keep-alive 缓存：从首页重新选点进入（仅 query 变化）时，
// 重置状态并重新拉取上下文，否则界面停留旧位置导致无法分析
watch(
  () => [route.query.lng, route.query.lat, route.query.alt],
  ([lng, lat, alt]) => {
    if (route.name !== 'Analysis') return
    longitude.value = queryNum(lng)
    latitude.value = queryNum(lat)
    altitude.value = alt ? queryNum(alt) : null
    address.value = ''
    weather.value = null
    result.value = null
    errorMsg.value = ''
    errorNeedsLocation.value = false
    loadContext()
  }
)

const handleAnalyze = async () => {
  errorMsg.value = ''

  // 校验：必须选择了位置
  if (!hasLocation()) {
    errorMsg.value = '请先在地球仪上点击选择分析位置'
    errorNeedsLocation.value = true
    return
  }

  if (!confirm('确认使用当前位置进行风水分析吗？将消耗 1 次咨询次数。')) return

  startLoading('正在进行地理风水分析，请耐心等候…')
  analyzing.value = true
  try {
    result.value = await analysisApi.analyze({
      longitude: longitude.value,
      latitude: latitude.value,
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

// 记录详情视图态：非空时整页切换为详情界面
const viewingRecord = ref<AnalysisRecord | null>(null)
const historyCard = ref<HTMLElement | null>(null)

// 从结果文本提取综合评分（0-100）
function extractScore(content?: string): number | null {
  if (!content) return null
  const m = content.match(/综合评分[^\d]*?(\d{1,3})/)
  const n = m ? parseInt(m[1]) : null
  return n != null && n >= 0 && n <= 100 ? n : null
}

const score = computed(() => extractScore(result.value?.result?.content || ''))
const detailScore = computed(() => extractScore(viewingRecord.value?.result?.content || ''))

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

function openDetail(record: AnalysisRecord) {
  viewingRecord.value = record
  window.scrollTo({ top: 0 })
}

function closeDetail() {
  viewingRecord.value = null
  // 返回后定位回历史记录区域，避免回到页面顶部
  nextTick(() => historyCard.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function formatDate(d: string) { return new Date(d).toLocaleString('zh-CN') }
</script>

<template>
  <div class="analysis-page">
    <NavBar />
    <div class="analysis-wrap">
      <!-- 记录详情视图 -->
      <template v-if="viewingRecord">
        <button class="back-btn" @click="closeDetail">← 返回</button>

        <div class="analysis-header">
          <h1 class="title">记录详情</h1>
          <p class="subtitle">{{ viewingRecord.address || `${viewingRecord.latitude.toFixed(4)}, ${viewingRecord.longitude.toFixed(4)}` }}</p>
        </div>

        <section class="card">
          <h3 class="card-title">位置信息</h3>
          <div class="info-grid">
            <div class="info-item"><span class="label">经度</span><span class="value">{{ viewingRecord.longitude.toFixed(6) }}°</span></div>
            <div class="info-item"><span class="label">纬度</span><span class="value">{{ viewingRecord.latitude.toFixed(6) }}°</span></div>
            <div class="info-item"><span class="label">海拔</span><span class="value">{{ viewingRecord.altitude == null ? '—' : viewingRecord.altitude.toFixed(2) + ' m' }}</span></div>
            <div class="info-item"><span class="label">八卦方位</span><span class="value">{{ getBaguaDirection(viewingRecord.longitude) }}</span></div>
            <div class="info-item"><span class="label">分析时间</span><span class="value">{{ formatDate(viewingRecord.createdAt) }}</span></div>
            <div class="info-item"><span class="label">生成时间</span><span class="value">{{ viewingRecord.result?.generatedAt ? formatDate(viewingRecord.result.generatedAt) : '—' }}</span></div>
          </div>
          <div v-if="viewingRecord.address" class="info-item info-item--full"><span class="label">地址</span><span class="value">{{ viewingRecord.address }}</span></div>
          <div v-if="viewingRecord.weather" class="weather">
            <span class="weather-main">{{ viewingRecord.weather.weather }} · {{ viewingRecord.weather.temperature }}°C</span>
            <span class="weather-sub">湿度 {{ viewingRecord.weather.humidity }}% · {{ viewingRecord.weather.windDirection }} {{ viewingRecord.weather.windSpeed }} km/h</span>
          </div>
        </section>

        <section v-if="viewingRecord.result?.content" class="card result">
          <div class="result-head">
            <h3 class="card-title">分析结果</h3>
            <span v-if="detailScore != null" class="score">综合评分 {{ detailScore }}</span>
          </div>
          <div class="result-content">{{ viewingRecord.result.content }}</div>
        </section>
        <div v-else class="empty">该记录暂无分析结果</div>
      </template>

      <!-- 常规视图（分析 + 历史记录） -->
      <template v-else>
      <div class="analysis-header">
        <h1 class="title">地理分析</h1>
        <p class="subtitle">基于位置、海拔、天气与八卦方位的 AI 风水分析</p>
      </div>

      <!-- 分析按钮 + 错误提示（位于分析位置上方） -->
      <button class="analyze-btn" :disabled="analyzing || contextLoading" @click="handleAnalyze">
        {{ analyzing ? '分析中…' : (result ? '重新分析' : '开始分析') }}
      </button>

      <p
        v-if="errorMsg"
        class="error"
        :class="{ clickable: errorNeedsLocation }"
        @click="errorNeedsLocation && router.push('/')"
      >
        {{ errorMsg }}<span v-if="errorNeedsLocation" class="error-hint">，点击返回首页选择位置</span>
      </p>

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
      <section ref="historyCard" class="card history-card">
        <h2>历史记录</h2>
        <div v-if="historyLoading" class="loading">加载中...</div>
        <div v-else-if="history.length === 0" class="empty">暂无地理分析记录</div>
        <div v-else class="history-list">
          <div
            v-for="record in history"
            :key="record.id"
            class="history-item"
            role="button"
            @click="openDetail(record)"
          >
            <div class="history-info">
              <span class="history-addr">{{ record.address || `${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)}` }}</span>
              <span class="history-date">{{ formatDate(record.createdAt) }}</span>
            </div>
            <div class="history-actions">
              <button class="action-btn danger" @click.stop="deleteRecord(record.id)">删除</button>
            </div>
          </div>
        </div>
      </section>
      </template>
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

.back-btn {
  display: block;
  margin: 0 0 16px;
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #4a90d9;
    color: #4a90d9;
  }
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
  margin-bottom: 12px;
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

  &.clickable {
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(231, 76, 60, 0.3);
    }
  }

  .error-hint {
    font-size: 12px;
    opacity: 0.8;
  }
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
  cursor: pointer; transition: background 0.2s;
  &:hover { background: rgba(255,255,255,.08); }
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

  // 竖屏窄屏：记录行改上下布局，避免地址/日期把操作按钮挤出屏幕
  .history-item {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;

    .history-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .history-addr {
      max-width: 100%;
    }
    .history-actions {
      justify-content: flex-end;
    }
  }
}
</style>
